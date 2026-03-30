import { world, system } from "@minecraft/server";
import { POTENTIAL, GLOBAL, WORLD_FX } from "./config.js";
import { co2 } from "./co2System.js";
import { hud } from "./hudSystem.js";
import { hunterSystem } from "./hunterSystem.js";

/**
 * EventHandlers
 * ──────────────
 * Registers all world event listeners and owns the FeedbackSystem —
 * the silent, visual-only teaching layer that replaces chat messages.
 *
 * Philosophy: the player learns by watching numbers change and feeling
 * consequences, not by being lectured. No sendMessage() calls anywhere.
 *
 * Events handled:
 *   • playerBreakBlock  — coal ore, natural logs, placed saplings (anti-cheese)
 *   • playerPlaceBlock  — saplings, coal, concrete, campfires, solar, furnaces
 *   • itemUseOn         — bone meal on saplings, crop blocking at critical CO2
 *   • entityHitEntity   — Hunter combat: journal drop on hit
 *
 * Anti-cheese for saplings:
 *   Placed sapling positions are tracked in a session-scoped Set.
 *   Breaking a player-placed sapling cancels its potential credit.
 */

// ── FEEDBACK SYSTEM ───────────────────────────────────────────────────────────
/**
 * Silent teaching through visuals and sound only.
 * Shows a brief delta flash in the HUD + particles + sound.
 * The player sees "+12⟳" appear and the counter rise — they make the connection.
 */
const Feedback = {
    /**
     * @param {import("@minecraft/server").Player} player
     * @param {number} delta         — CO2 change (positive or negative)
     * @param {"potential"|"global"} pool
     * @param {{ x:number, y:number, z:number }} blockPos — for particles
     */
    show(player, delta, pool, blockPos) {
        const isPositive = delta > 0;
        const sign       = isPositive ? "+" : "";
        const co2Clr     = isPositive ? "§c" : "§a";
        const poolTag    = pool === "potential" ? "§8⟳" : "§f!";

        // Brief HUD flash: e.g.  "§c+12⟳  |  CO₂: 432ppm  +12⟳"
        hud.setOverride(
            player,
            `${co2Clr}${sign}${Math.round(delta)}ppm ${poolTag}  §8|  ${hud.co2Line()}`,
            35   // ~1.75 seconds — long enough to read, short enough not to block
        );

        // Particles at the block
        try {
            const dim = player.dimension;
            const pLoc = { x: blockPos.x + 0.5, y: blockPos.y + 1, z: blockPos.z + 0.5 };
            if (isPositive) {
                dim.spawnParticle("minecraft:basic_smoke_particle", pLoc);
                dim.spawnParticle("minecraft:basic_smoke_particle",
                    { x: pLoc.x + 0.2, y: pLoc.y + 0.4, z: pLoc.z - 0.2 });
            } else {
                dim.spawnParticle("minecraft:crop_growth_emitter", pLoc);
            }
        } catch (_) {}

        // Sound cues — distinct per direction
        try {
            if (isPositive) {
                player.dimension.playSound("random.fizz", blockPos,
                    { volume: 0.35, pitch: 0.6 + Math.random() * 0.2 });
            } else {
                player.dimension.playSound("random.levelup", blockPos,
                    { volume: 0.2, pitch: 1.6 });
            }
        } catch (_) {}
    },

    /**
     * Threshold crossing — shows a one-time subtitle when CO2 hits a new level.
     * Subtle, atmospheric, no explanation given. Player pieces it together.
     */
    thresholdCrossed(level) {
        let msg = "";
        if (level >= 700) msg = "§4The world is burning.";
        else if (level >= 600) msg = "§cThe air tastes wrong.";
        else if (level >= 500) msg = "§6Something feels different.";
        else if (level >= 450) msg = "§eA faint unease settles in.";
        if (!msg) return;

        for (const p of world.getAllPlayers()) {
            try {
                p.onScreenDisplay.setTitle("§r", {
                    subtitle: msg,
                    fadeInDuration: 10,
                    stayDuration:   60,
                    fadeOutDuration: 20,
                });
            } catch (_) {}
        }
    },
};

// ── SAPLING TRACKING (anti-cheese) ────────────────────────────────────────────
// Session-scoped. Resets on world reload — acceptable, saves complexity.
// Key format: "x,y,z" (integer coords).
/** @type {Set<string>} */
const placedSaplings = new Set();

function _saplingKey(pos) {
    return `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
}

// Track the CO2 level of the last threshold crossed, to detect new crossings
let _lastThreshold = 0;

function _checkThreshold() {
    const lvl = co2.global;
    const thresholds = [450, 500, 600, 700];
    for (const t of thresholds) {
        if (lvl >= t && _lastThreshold < t) {
            _lastThreshold = t;
            system.run(() => Feedback.thresholdCrossed(t));
            return;
        }
    }
}

// ── ENTRY POINT ───────────────────────────────────────────────────────────────
export function registerAll() {
    _registerBlockBreak();
    _registerBlockPlace();
    _registerItemUse();
    _registerHunterCombat();
}

// ── BLOCK BREAKING ────────────────────────────────────────────────────────────
function _registerBlockBreak() {
    world.afterEvents.playerBreakBlock.subscribe((event) => {
        const blockId = event.brokenBlockPermutation.type.id;
        const pos     = event.block.location;
        const player  = event.player;
        const dim     = event.dimension;

        // ── Coal ore ──────────────────────────────────────────────────────────
        if (blockId.includes("coal_ore")) {
            co2.changePotential(POTENTIAL.COAL_ORE_MINED);
            Feedback.show(player, POTENTIAL.COAL_ORE_MINED, "potential", pos);
            _checkThreshold();
            return;
        }

        // ── Natural log ───────────────────────────────────────────────────────
        // Anti-cheese: only penalised if the log is part of a living tree.
        if (blockId.includes("_log") && !blockId.includes("stripped")) {
            if (_isNaturalTree(pos, dim)) {
                co2.changePotential(POTENTIAL.LOG_CUT_NATURAL);
                Feedback.show(player, POTENTIAL.LOG_CUT_NATURAL, "potential", pos);
                _checkThreshold();
            }
            return;
        }

        // ── Sapling broken (anti-cheese reversal) ─────────────────────────────
        // If the player planted this sapling themselves and uproots it,
        // the CO2 credit is cancelled. You can't game the system by cycling saplings.
        if (blockId.includes("sapling")) {
            const key = _saplingKey(pos);
            if (placedSaplings.has(key)) {
                placedSaplings.delete(key);
                // Reverse the credit — potential goes back up
                co2.changePotential(-POTENTIAL.SAPLING_PLANTED); // negate the negative
                Feedback.show(player, -POTENTIAL.SAPLING_PLANTED, "potential", pos);
            }
        }
    });
}

// ── BLOCK PLACEMENT ───────────────────────────────────────────────────────────
function _registerBlockPlace() {
    world.afterEvents.playerPlaceBlock.subscribe((event) => {
        const blockId = event.block.typeId;
        const pos     = event.block.location;
        const player  = event.player;

        // ── Sapling planted ───────────────────────────────────────────────────
        if (blockId.includes("sapling")) {
            placedSaplings.add(_saplingKey(pos));
            co2.changePotential(POTENTIAL.SAPLING_PLANTED);
            Feedback.show(player, POTENTIAL.SAPLING_PLANTED, "potential", pos);
            return;
        }

        // ── Coal block — raw fossil fuel ──────────────────────────────────────
        if (blockId === "minecraft:coal_block") {
            co2.changePotential(POTENTIAL.COAL_BLOCK_PLACED);
            Feedback.show(player, POTENTIAL.COAL_BLOCK_PLACED, "potential", pos);
            _checkThreshold();
            return;
        }

        // ── Concrete — high embodied carbon ──────────────────────────────────
        if (blockId.includes("concrete") && !blockId.includes("powder")) {
            co2.changePotential(POTENTIAL.CONCRETE_PLACED);
            Feedback.show(player, POTENTIAL.CONCRETE_PLACED, "potential", pos);
            return;
        }

        // ── Campfire — open combustion ────────────────────────────────────────
        if (blockId === "minecraft:campfire" || blockId === "minecraft:soul_campfire") {
            co2.changePotential(POTENTIAL.CAMPFIRE_LIT);
            Feedback.show(player, POTENTIAL.CAMPFIRE_LIT, "potential", pos);
            return;
        }

        // ── Furnace / blast furnace / smoker ──────────────────────────────────
        if (blockId === "minecraft:furnace"       ||
            blockId === "minecraft:blast_furnace" ||
            blockId === "minecraft:smoker") {
            co2.changePotential(POTENTIAL.FURNACE_PLACED);
            Feedback.show(player, POTENTIAL.FURNACE_PLACED, "potential", pos);
            return;
        }

        // ── Solar panel (daylight detector) — immediate global reduction ───────
        // Infrastructure that immediately offsets emissions — only action
        // that hits the global pool directly.
        if (blockId === "minecraft:daylight_detector") {
            co2.changeGlobal(GLOBAL.SOLAR_INSTALLED);
            Feedback.show(player, GLOBAL.SOLAR_INSTALLED, "global", pos);
            return;
        }
    });
}

// ── ITEM USE ──────────────────────────────────────────────────────────────────
function _registerItemUse() {
    world.beforeEvents.itemUseOn.subscribe((event) => {
        const level   = co2.global;
        const itemId  = event.itemStack.typeId;
        const player  = event.source;
        const blockId = event.block?.typeId ?? "";

        // ── Bone meal on saplings = accelerated absorption ────────────────────
        if (itemId === "minecraft:bone_meal") {
            if (blockId.includes("sapling") || blockId === "minecraft:bamboo_sapling") {
                // Additional potential credit — the tree grows faster
                co2.changePotential(POTENTIAL.BONEMEAL_ON_SAPLING);
                Feedback.show(player, POTENTIAL.BONEMEAL_ON_SAPLING, "potential",
                    event.block.location);
            }
            return;
        }

        // ── Crop / seed planting blocked at critical CO2 ──────────────────────
        // The soil is too toxic. No explanation — the player just finds it doesn't work.
        // The HUD shows why (CRITICAL status + CO2 level). They connect the dots.
        if (level >= WORLD_FX.CROP_BLOCK) {
            const isPlantable =
                itemId.includes("seeds")         ||
                itemId.includes("sapling")        ||
                itemId === "minecraft:carrot"     ||
                itemId === "minecraft:potato"     ||
                itemId === "minecraft:beetroot_seeds";

            if (isPlantable) {
                event.cancel = true;
                hud.setOverride(
                    player,
                    `§4☠ SOIL DEAD  §8|  ${hud.co2Line()}`,
                    60
                );
            }
        }
    });
}

// ── HUNTER COMBAT ─────────────────────────────────────────────────────────────
function _registerHunterCombat() {
    world.afterEvents.entityHitEntity.subscribe((event) => {
        if (!event.hitEntity.hasTag("the_hunter")) return;
        hunterSystem.onHunterDefeated(event.hitEntity);
    });
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

/**
 * Returns true if a log block is part of a living tree.
 * Scans 5×7×5 area for leaf blocks.
 * Prevents CO2 penalty for cutting player-built log structures.
 */
function _isNaturalTree(pos, dim) {
    for (let x = -2; x <= 2; x++) {
        for (let y = 0; y <= 6; y++) {
            for (let z = -2; z <= 2; z++) {
                try {
                    const b = dim.getBlock({ x: pos.x + x, y: pos.y + y, z: pos.z + z });
                    if (b?.typeId.includes("leaves")) return true;
                } catch (_) {}
            }
        }
    }
    return false;
}
