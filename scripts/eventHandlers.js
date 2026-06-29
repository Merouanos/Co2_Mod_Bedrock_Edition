import { world, system } from "@minecraft/server";
import { POTENTIAL, GLOBAL, WORLD_FX } from "./config.js";
import { co2 } from "./co2System.js";
import { hud } from "./hudSystem.js";
import { score } from "./scoreSystem.js";
import { advisor } from "./advisorSystem.js";
import { saplingSystem } from "./saplingSystem.js";
import { climateEvents } from "./climateEvents.js";
import { hunterSystem } from "./hunterSystem.js";
import { combo } from "./comboSystem.js";
import { challenges } from "./challengeSystem.js";

// ── FEEDBACK ──────────────────────────────────────────────────────────────────
const Feedback = {
    show(player, delta, pool, pos) {
        const pos_ = delta > 0;
        const clr  = pos_ ? "§c" : "§a";
        const sign = pos_ ? "+" : "";
        const mark = pool === "potential" ? "⟳" : "!";
        hud.setOverride(player, `${clr}${sign}${Math.round(delta)}ppm ${mark}  §8|  ${hud.co2Line()}`, 35);
        try {
            const dim = player.dimension;
            const p   = { x: pos.x + 0.5, y: pos.y + 1.2, z: pos.z + 0.5 };
            if (pos_) {
                dim.spawnParticle("minecraft:basic_smoke_particle", p);
                dim.spawnParticle("minecraft:basic_smoke_particle", { x: p.x+0.3, y: p.y+0.3, z: p.z-0.3 });
                dim.playSound("random.fizz", pos, { volume: 0.3, pitch: 0.55 + Math.random() * 0.15 });
            } else {
                dim.spawnParticle("minecraft:crop_growth_emitter", p);
                dim.playSound("random.levelup", pos, { volume: 0.2, pitch: 1.65 });
            }
        } catch (_) {}
    },

    thresholdFlash(level) {
        const m = {700:["§4","§cThe world is choking."],600:["§c","§6The air burns."],500:["§6","§eThe atmosphere is destabilising."],450:["§e","§7Something in the air has changed."]};
        const [t, s] = m[level] ?? [];
        if (!s) return;
        for (const p of world.getAllPlayers()) {
            try { p.onScreenDisplay.setTitle(t, { subtitle: s, fadeInDuration: 8, stayDuration: 50, fadeOutDuration: 20 }); } catch (_) {}
        }
    },

    // Threshold WARNING — shows 10ppm before a threshold (urgent, not crossing yet)
    proximityWarning(level) {
        const thresholds = [450, 500, 600, 700];
        for (const t of thresholds) {
            if (level >= t - 10 && level < t) {
                const ppm = Math.floor(t - level);
                for (const p of world.getAllPlayers()) {
                    hud.setOverride(p, `§6⚠ ${ppm}ppm from ${t}ppm threshold!  §8|  ${hud.co2Line()}`, 40);
                }
                break;
            }
        }
    },

    milestoneFlash(scoreVal) {
        const milestone = Math.floor(scoreVal / 100) * 100;
        if (scoreVal - milestone < 3 && milestone > 0) {
            for (const p of world.getAllPlayers()) {
                try { p.onScreenDisplay.setTitle("§e", { subtitle: `§a${milestone} score!`, fadeInDuration: 3, stayDuration: 30, fadeOutDuration: 10 }); } catch (_) {}
            }
        }
    },
};

const _crossed = new Set();
function checkThreshold() {
    for (const t of [450, 500, 600, 700]) {
        if (co2.global >= t && !_crossed.has(t)) {
            _crossed.add(t);
            system.run(() => Feedback.thresholdFlash(t));
        }
    }
    Feedback.proximityWarning(co2.global);
}

// Proximity warning: call every second
export function tickProximityWarning() {
    Feedback.proximityWarning(co2.global);
}

let _prevScore = 0;
export function checkScoreMilestone() {
    const s = Math.floor(score.value);
    if (Math.floor(s / 100) > Math.floor(_prevScore / 100) && s > 0) {
        Feedback.milestoneFlash(s);
    }
    _prevScore = s;
}

// ── SAPLING TRACKING ──────────────────────────────────────────────────────────
const placedSaplings = new Set();
function saplingKey(pos) { return `${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`; }

// ── REGISTER ──────────────────────────────────────────────────────────────────
export function registerAll() {
    _blockBreak();
    _blockPlace();
    _itemUse();
    _hunterCombat();
}

// ── BLOCK BREAKING ────────────────────────────────────────────────────────────
function _blockBreak() {
    world.afterEvents.playerBreakBlock.subscribe((event) => {
        const id     = event.brokenBlockPermutation.type.id;
        const pos    = event.block.location;
        const player = event.player;
        const dim    = event.dimension;

        if (id.includes("coal_ore")) {
            const impact = climateEvents.coalRushActive
                ? POTENTIAL.COAL_ORE_MINED * 2 : POTENTIAL.COAL_ORE_MINED;
            co2.changePotential(impact);
            score.onCoalMined();
            combo.onBadAction();
            advisor.onLogCut();
            challenges.tick(); // Update avoid_coal challenge
            Feedback.show(player, impact, "potential", pos);
            checkThreshold();
            return;
        }

        if (id.includes("_log") && !id.includes("stripped")) {
            if (_isNaturalTree(pos, dim)) {
                co2.changePotential(POTENTIAL.LOG_CUT_NATURAL);
                score.onLogCut();
                combo.onBadAction();
                advisor.onLogCut();
                challenges.tick(); // Update avoid_log challenge
                Feedback.show(player, POTENTIAL.LOG_CUT_NATURAL, "potential", pos);
                checkThreshold();
            }
            return;
        }

        if (id.includes("sapling")) {
            saplingSystem.onUproot(pos, dim.id);
            return;
        }

        if (id.includes("leaves")) {
            if (Math.random() < 0.05) {
                hud.setOverride(player, "§a🌱 Rare sapling drop!  §8|  " + hud.co2Line(), 50);
                try { player.dimension.playSound("random.levelup", pos, { volume: 0.25, pitch: 1.8 }); } catch (_) {}
            }
        }
    });
}

// ── BLOCK PLACEMENT ───────────────────────────────────────────────────────────
function _blockPlace() {
    world.afterEvents.playerPlaceBlock.subscribe((event) => {
        const id     = event.block.typeId;
        const pos    = event.block.location;
        const player = event.player;

        if (id.includes("sapling")) {
            const result = saplingSystem.onPlant(player, pos, event.block.dimension);
            if (result && Math.abs(result.credit) > 0.01) {
                co2.changePotential(result.credit);
                Feedback.show(player, result.credit, "potential", pos);
            }
            score.onSaplingPlanted();
            combo.onGoodAction();
            challenges.onSaplingPlanted();
            if (combo.count >= 4) score.awardBadge("combo_fire");
            return;
        }

        if (id === "minecraft:coal_block") {
            co2.changePotential(POTENTIAL.COAL_BLOCK_PLACED);
            score.onCoalBlock();
            combo.onBadAction();
            Feedback.show(player, POTENTIAL.COAL_BLOCK_PLACED, "potential", pos);
            checkThreshold();
            return;
        }

        if (id.includes("concrete") && !id.includes("powder")) {
            co2.changePotential(POTENTIAL.CONCRETE_PLACED);
            combo.onBadAction();
            Feedback.show(player, POTENTIAL.CONCRETE_PLACED, "potential", pos);
            return;
        }

        if (id === "minecraft:campfire" || id === "minecraft:soul_campfire") {
            co2.changePotential(POTENTIAL.CAMPFIRE_LIT);
            Feedback.show(player, POTENTIAL.CAMPFIRE_LIT, "potential", pos);
            return;
        }

        if (id === "minecraft:furnace" || id === "minecraft:blast_furnace" || id === "minecraft:smoker") {
            co2.changePotential(POTENTIAL.FURNACE_PLACED);
            Feedback.show(player, POTENTIAL.FURNACE_PLACED, "potential", pos);
            return;
        }

        if (id === "minecraft:daylight_detector") {
            const prevCO2 = co2.global;
            co2.changeGlobal(GLOBAL.SOLAR_INSTALLED);
            score.onSolarInstalled();
            combo.onGoodAction();
            challenges.onSolarInstalled();
            challenges.onCO2Reduced(prevCO2 - co2.global);
            if (combo.count >= 4) score.awardBadge("combo_fire");
            Feedback.show(player, GLOBAL.SOLAR_INSTALLED, "global", pos);
            return;
        }

        if (id === "minecraft:moss_block" || id === "minecraft:podzol") {
            score.add(2);
            combo.onGoodAction();
        }
    });
}

// ── ITEM USE ──────────────────────────────────────────────────────────────────
function _itemUse() {
    world.beforeEvents.itemUseOn.subscribe((event) => {
        const level   = co2.global;
        const itemId  = event.itemStack.typeId;
        const player  = event.source;
        const block   = event.block;
        const blockId = block?.typeId ?? "";

        if (itemId === "minecraft:bone_meal") {
            if (blockId.includes("sapling") || blockId === "minecraft:bamboo_sapling") {
                saplingSystem.onBonemeal(block.location, block.dimension.id, player);
                combo.onGoodAction();
                challenges.onBonemeal();
                if (combo.count >= 4) score.awardBadge("combo_fire");
            }
            return;
        }

        if (level >= WORLD_FX.CROP_BLOCK) {
            const isPlantable = itemId.includes("seeds") || itemId.includes("sapling") ||
                itemId === "minecraft:carrot" || itemId === "minecraft:potato" ||
                itemId === "minecraft:beetroot_seeds";
            if (isPlantable) {
                event.cancel = true;
                hud.setOverride(player, `§4☠ SOIL DEAD  §8|  ${hud.co2Line()}`, 60);
            }
        }
    });
}

// ── HUNTER COMBAT ─────────────────────────────────────────────────────────────
function _hunterCombat() {
    world.afterEvents.entityHitEntity.subscribe((event) => {
        if (!event.hitEntity.hasTag("the_hunter")) return;
        hunterSystem.onHunterDefeated(event.hitEntity);
    });
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function _isNaturalTree(pos, dim) {
    for (let x = -2; x <= 2; x++) for (let y = 0; y <= 6; y++) for (let z = -2; z <= 2; z++) {
        try { const b = dim.getBlock({ x: pos.x+x, y: pos.y+y, z: pos.z+z }); if (b?.typeId.includes("leaves")) return true; } catch (_) {}
    }
    return false;
}
