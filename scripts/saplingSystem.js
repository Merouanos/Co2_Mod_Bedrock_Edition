import { world, system } from "@minecraft/server";
import { SAPLING, CO2 as CO2_LEVELS, POTENTIAL, SCORE } from "./config.js";
import { co2 } from "./co2System.js";
import { score } from "./scoreSystem.js";
import { hud } from "./hudSystem.js";

/**
 * SaplingSystem
 * ─────────────
 * Full sapling lifecycle manager. The CO2 credit from planting a sapling
 * is NOT granted immediately — it is held in the potential pool and only
 * released once the sapling has matured (growth days elapsed).
 *
 * Mechanics:
 *   • 5×5 clear space required to receive full credit
 *   • At CO2 ≥ 550 (TOXIC_CO2), purified soil required (moss/podzol/mycelium)
 *   • Sand/gravel below = dead sapling, no credit
 *   • Growth time: 3 days normally, 2 at caution, 1 at high CO2
 *   • Bone meal reduces growth by 1 day per 5 applications (max 2 days)
 *   • When sapling breaks: all unreleased credit is reversed
 *   • Registry persisted to world storage (survives restarts)
 */

const DEAD_SOIL = ["minecraft:sand", "minecraft:gravel", "minecraft:red_sand"];

export class SaplingSystem {
    constructor() {
        /**
         * Map of "x,y,z,dim" → {plantedDay, bonemeal, credit, creditGranted}
         * @type {Map<string, {plantedDay:number, bonemeal:number, credit:number, creditGranted:boolean, pureSoil:boolean}>}
         */
        this._registry = new Map();
        this._currentDay = 0;
        this._matureCount = 0;   // Total saplings matured (for badges)
    }

    // ── INIT ──────────────────────────────────────────────────────────────────

    init() {
        system.runTimeout(() => {
            // Load current day counter
            const d = world.getDynamicProperty("sapling_day");
            if (d !== undefined) this._currentDay = /** @type {number} */ (d);

            // Load sapling registry
            const raw = world.getDynamicProperty("sapling_registry");
            if (raw && typeof raw === "string") {
                try {
                    const arr = JSON.parse(raw);
                    for (const e of arr) {
                        this._registry.set(e.k, { plantedDay: e.d, bonemeal: e.b, credit: e.c, creditGranted: e.g, pureSoil: e.p });
                    }
                } catch (_) {}
            }

            const mc = world.getDynamicProperty("sapling_mature_count");
            if (mc !== undefined) this._matureCount = /** @type {number} */ (mc);
        }, 120);
    }

    // ── PLANT ─────────────────────────────────────────────────────────────────

    /**
     * Called when a sapling is placed by a player.
     * Validates conditions and registers for timed growth credit.
     * @param {import("@minecraft/server").Player} player
     * @param {{ x:number, y:number, z:number }} pos
     * @param {import("@minecraft/server").Dimension} dim
     */
    onPlant(player, pos, dim) {
        const below = _blockBelow(pos, dim);

        // ── Dead soil: sand/gravel = no growth, no credit ─────────────────────
        if (below && DEAD_SOIL.some(id => id === below.typeId)) {
            hud.setOverride(player,
                "§8🌵 Dead soil — sapling won't survive here.  §8|  " + hud.co2Line(), 60);
            return; // No registry entry → no credit
        }

        // ── Toxic soil: needs purified blocks ─────────────────────────────────
        let pureSoil = true;
        if (co2.global >= SAPLING.TOXIC_CO2) {
            pureSoil = below
                ? SAPLING.PURE_SOIL.includes(below.typeId)
                : false;

            if (!pureSoil) {
                hud.setOverride(player,
                    "§6⚠ Toxic soil — needs moss/podzol to absorb CO₂.  §8|  " + hud.co2Line(), 80);
                // Still register but credit will be 0 until soil is purified externally
                // (we simply don't grant credit at maturation — more realistic)
            }
        }

        // ── Space check: 5×5 footprint ────────────────────────────────────────
        const spaceFactor = _spaceScore(pos, dim); // 0.0–1.0
        const credit = POTENTIAL.SAPLING_PLANTED * spaceFactor * (pureSoil ? 1.0 : 0.0);

        // Register entry
        const key = _key(pos, dim.id);
        this._registry.set(key, {
            plantedDay:   this._currentDay,
            bonemeal:     0,
            credit,
            creditGranted: false,
            pureSoil,
        });
        this._trimRegistry();
        this._persist();

        if (spaceFactor < 0.8) {
            hud.setOverride(player,
                "§e🌱 Limited space — plant further apart for full effect.  §8|  " + hud.co2Line(), 60);
        } else if (!pureSoil && co2.global >= SAPLING.TOXIC_CO2) {
            // Already shown toxic message
        } else {
            // No override — let the normal HUD Feedback.show handle it from eventHandlers
        }

        return { credit }; // Return so eventHandlers can call changePotential
    }

    // ── BONE MEAL ─────────────────────────────────────────────────────────────

    /**
     * Called when bone meal is applied to a sapling.
     * @param {{ x:number, y:number, z:number }} pos
     * @param {string} dimId
     * @param {import("@minecraft/server").Player} player
     */
    onBonemeal(pos, dimId, player) {
        const key = _key(pos, dimId);
        const entry = this._registry.get(key);
        if (!entry || entry.creditGranted) return;

        entry.bonemeal++;
        this._persist();

        const daysReduced = Math.min(
            Math.floor(entry.bonemeal / SAPLING.BONEMEAL_PER_DAY),
            SAPLING.BONEMEAL_MAX_DAYS
        );
        const growthDays = Math.max(1, _growthDays(co2.global) - daysReduced);
        const daysLeft = Math.max(0, (entry.plantedDay + growthDays) - this._currentDay);

        co2.changePotential(POTENTIAL.BONEMEAL_ON_SAPLING);
        hud.setOverride(player,
            `§a🌱 Growing — ~${daysLeft} day${daysLeft === 1 ? '' : 's'} to mature  §8|  ${hud.co2Line()}`, 60);
    }

    // ── UPROOT (anti-cheese) ──────────────────────────────────────────────────

    /**
     * Called when a sapling is broken.
     * Reverses any potential credit that was queued but not yet released.
     * @param {{ x:number, y:number, z:number }} pos
     * @param {string} dimId
     */
    onUproot(pos, dimId) {
        const key = _key(pos, dimId);
        const entry = this._registry.get(key);
        if (!entry) return;
        this._registry.delete(key);
        this._persist();

        if (!entry.creditGranted && Math.abs(entry.credit) > 0.01) {
            // Reverse the potential credit
            co2.changePotential(-entry.credit);
        }
    }

    // ── DAILY GROWTH TICK ─────────────────────────────────────────────────────

    /**
     * Called once per game-day. Checks all registered saplings for maturation.
     * Releases CO2 credit for saplings that have grown.
     */
    tickDay() {
        this._currentDay++;
        world.setDynamicProperty("sapling_day", this._currentDay);

        const level = co2.global;
        const matured = [];

        for (const [key, entry] of this._registry) {
            if (entry.creditGranted) continue;

            const daysReduced = Math.min(
                Math.floor(entry.bonemeal / SAPLING.BONEMEAL_PER_DAY),
                SAPLING.BONEMEAL_MAX_DAYS
            );
            const targetDays = Math.max(1, _growthDays(level) - daysReduced);
            const elapsed    = this._currentDay - entry.plantedDay;

            if (elapsed < targetDays) continue;

            // Sapling has matured — check if it's still in the world
            const [x, y, z, dimId] = key.split(",").map((v, i) => i < 3 ? parseInt(v) : v);
            const dim = _getDim(dimId);
            if (!dim) { entry.creditGranted = true; continue; }

            try {
                const block = dim.getBlock({ x, y, z });
                if (!block?.isValid()) { entry.creditGranted = true; continue; }

                const blockId = block.typeId;

                // If it grew into a log → full success!
                if (blockId.includes("_log") || blockId === "minecraft:air") {
                    if (entry.pureSoil && Math.abs(entry.credit) > 0.01) {
                        co2.changePotential(entry.credit); // Release the credit
                    }
                    entry.creditGranted = true;
                    matured.push(entry);
                }
                // Still a sapling → reset timer (it hasn't grown, check next day)
                else if (blockId.includes("sapling")) {
                    entry.plantedDay = this._currentDay; // Reset wait
                }
            } catch (_) { entry.creditGranted = true; }
        }

        if (matured.length > 0) {
            this._matureCount += matured.length;
            world.setDynamicProperty("sapling_mature_count", this._matureCount);
            for (const _ of matured) {
                score.onSaplingMatured();
            }
            if (this._matureCount >= 10) score.awardBadge("ten_saplings");
        }

        // Prune granted entries
        for (const [key, entry] of this._registry) {
            if (entry.creditGranted) this._registry.delete(key);
        }
        this._persist();
    }

    // ── HELPERS ───────────────────────────────────────────────────────────────

    _trimRegistry() {
        if (this._registry.size <= SAPLING.MAX_TRACKED) return;
        // Remove oldest entries
        const sorted = [...this._registry.entries()]
            .sort((a, b) => a[1].plantedDay - b[1].plantedDay);
        for (let i = 0; i < sorted.length - SAPLING.MAX_TRACKED; i++) {
            this._registry.delete(sorted[i][0]);
        }
    }

    _persist() {
        const arr = [...this._registry.entries()].map(([k, v]) => ({
            k, d: v.plantedDay, b: v.bonemeal, c: v.credit, g: v.creditGranted, p: v.pureSoil
        }));
        try {
            world.setDynamicProperty("sapling_registry", JSON.stringify(arr));
        } catch (_) {}
    }

    get matureCount() { return this._matureCount; }
}

// ── MODULE HELPERS ────────────────────────────────────────────────────────────

function _key(pos, dimId) {
    return `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)},${dimId}`;
}

function _blockBelow(pos, dim) {
    try {
        return dim.getBlock({ x: Math.floor(pos.x), y: Math.floor(pos.y) - 1, z: Math.floor(pos.z) });
    } catch (_) { return null; }
}

function _growthDays(co2Level) {
    if (co2Level >= CO2_LEVELS.DANGER)   return SAPLING.GROW_DAYS_HIGH_CO2;
    if (co2Level >= CO2_LEVELS.CAUTION)  return SAPLING.GROW_DAYS_CAUTION;
    return SAPLING.GROW_DAYS_NORMAL;
}

/** Returns 0.0–1.0: fraction of 5×5 area that is clear (non-solid) above ground. */
function _spaceScore(pos, dim) {
    let clear = 0, total = 0;
    const r = SAPLING.SPACE_RADIUS;
    for (let x = -r; x <= r; x++) {
        for (let z = -r; z <= r; z++) {
            if (x === 0 && z === 0) continue; // Skip sapling itself
            total++;
            try {
                const b = dim.getBlock({ x: pos.x + x, y: pos.y + 1, z: pos.z + z });
                if (!b || b.typeId === "minecraft:air" || b.typeId.includes("leaves")) clear++;
            } catch (_) { clear++; } // Assume clear if unloaded
        }
    }
    return total > 0 ? clear / total : 1.0;
}

function _getDim(dimId) {
    try {
        if (dimId === "minecraft:overworld") return world.getDimension("overworld");
        if (dimId === "minecraft:nether")    return world.getDimension("nether");
        if (dimId === "minecraft:the_end")   return world.getDimension("the_end");
        return null;
    } catch (_) { return null; }
}

export const saplingSystem = new SaplingSystem();
