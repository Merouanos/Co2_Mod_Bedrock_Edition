import { world, system } from "@minecraft/server";
import { SCORE } from "./config.js";
import { co2 } from "./co2System.js";
import { score } from "./scoreSystem.js";
import { hud } from "./hudSystem.js";

/**
 * ChallengeSystem
 * ────────────────
 * Generates 3 daily objectives at the start of each game-day.
 * Completing all 3 triggers a big score bonus + fireworks announcement.
 * Partially completing gives partial credit.
 *
 * Challenges are randomly selected from a pool, weighted by current CO2.
 * At low CO2: harder "maintain" challenges. At high CO2: urgent "fix it" ones.
 *
 * State is persisted across sessions so progress isn't lost on quit.
 */

const CHALLENGE_POOL = [
    // id                   label                                   type        target  co2Range
    { id: "plant_1",        label: "Plant 1 sapling",              type: "plant",   n: 1,   maxCO2: 9999 },
    { id: "plant_3",        label: "Plant 3 saplings",             type: "plant",   n: 3,   maxCO2: 650  },
    { id: "solar_1",        label: "Install a solar panel",        type: "solar",   n: 1,   maxCO2: 9999 },
    { id: "solar_2",        label: "Install 2 solar panels",       type: "solar",   n: 2,   maxCO2: 600  },
    { id: "stay_low",       label: "Keep CO₂ below 440 for 3min", type: "maintain", n: 180, maxCO2: 450  },
    { id: "no_coal",        label: "Mine 0 coal this day",         type: "avoid",   n: 0,   maxCO2: 9999 },
    { id: "no_trees",       label: "Cut 0 trees this day",         type: "avoid_log",n: 0,  maxCO2: 9999 },
    { id: "bone_3",         label: "Use bone meal 3 times",        type: "bone",    n: 3,   maxCO2: 9999 },
    { id: "reduce_5",       label: "Reduce CO₂ by 5ppm",          type: "reduce",  n: 5,   maxCO2: 9999 },
    { id: "recover",        label: "Bring CO₂ below 460",          type: "threshold", n: 460, maxCO2: 9999 },
    { id: "crisis_solar",   label: "Install solar during crisis",   type: "solar",   n: 1,   maxCO2: 9999 },
];

export class ChallengeSystem {
    constructor() {
        /** @type {Array<{id:string, label:string, type:string, n:number, progress:number, done:boolean}>} */
        this.active  = [];
        this._dayStart = { co2: 0, saplings: 0, solar: 0, coal: 0, logs: 0, bone: 0 };
        this._maintainTicks = 0;
        this._dayIdx = 0;
        this._ready  = false;
        this._allCompleteBonusGiven = false;
    }

    init() {
        system.runTimeout(() => {
            const saved = world.getDynamicProperty("challenge_state");
            if (saved && typeof saved === "string") {
                try {
                    const s = JSON.parse(saved);
                    this.active    = s.active || [];
                    this._dayIdx   = s.dayIdx || 0;
                    this._allCompleteBonusGiven = s.bonusGiven || false;
                } catch (_) {}
            }
            this._ready = true;
        }, 150);
    }

    /** Called once per game-day — rotate challenges. */
    tickDay(currentDay) {
        if (this._dayIdx !== currentDay) {
            this._dayIdx = currentDay;
            this._rollChallenges();
            this._allCompleteBonusGiven = false;
        }
        // Capture day-start stats for delta tracking
        this._dayStart = {
            co2:      co2.global,
            saplings: score.saplingsPlanted,
            solar:    score.solarInstalled,
            coal:     score._coalCount   || 0,
            logs:     score._logCount    || 0,
            bone:     score._boneCount   || 0,
        };
        this._maintainTicks = 0;
        this._persist();
    }

    /** Call every 20 ticks (1s) — updates time-based challenges. */
    tick() {
        if (!this._ready || this.active.length === 0) return;

        const level = co2.global;

        for (const c of this.active) {
            if (c.done) continue;

            switch (c.type) {
                case "maintain":
                    if (level < 440) {
                        c.progress++;
                        if (c.progress >= c.n) this._complete(c);
                    } else {
                        // Tiny forgiveness window: only reset if CO2 stays high 3+ seconds
                        if (level > 445) c.progress = Math.max(0, c.progress - 3);
                    }
                    break;
                case "threshold":
                    if (level <= c.n) this._complete(c);
                    break;
                case "avoid":
                    // "avoid coal" — fail if coal count has risen
                    if ((score._coalCount || 0) > this._dayStart.coal) {
                        c.done = true; // Forfeited — doesn't complete, just removes
                    }
                    break;
                case "avoid_log":
                    if ((score._logCount || 0) > this._dayStart.logs) {
                        c.done = true;
                    }
                    break;
            }
        }

        this._checkAllComplete();
    }

    // ── Hooks called by eventHandlers ─────────────────────────────────────────

    onSaplingPlanted() { this._advance("plant"); }
    onSolarInstalled() { this._advance("solar"); this._advance("crisis_solar"); }
    onBonemeal()       { this._advance("bone"); }
    onCO2Reduced(delta) {
        for (const c of this.active) {
            if (c.done || c.type !== "reduce") continue;
            c.progress += delta;
            if (c.progress >= c.n) this._complete(c);
        }
    }

    // ── HUD fragment ──────────────────────────────────────────────────────────

    /** Returns a short challenge status string for embedding in HUD. */
    get hudStr() {
        if (!this._ready || this.active.length === 0) return "";
        const done  = this.active.filter(c => c.done).length;
        const total = this.active.length;
        const color = done === total ? "§a" : done >= 2 ? "§e" : done >= 1 ? "§6" : "§8";
        return ` §8|§r ${color}📋${done}/${total}`;
    }

    /** Cycle through challenge descriptions for the HUD panel. */
    getChallengeLines() {
        return this.active.map(c => {
            const pct = Math.min(1, c.progress / Math.max(1, c.n));
            const bar = _bar(pct, 8);
            const col = c.done ? "§a" : pct > 0.5 ? "§e" : "§7";
            return `${col}${c.done ? "✓" : "○"} ${c.label}  ${bar}`;
        });
    }

    // ── Private ───────────────────────────────────────────────────────────────

    _rollChallenges() {
        const level = co2.global;
        const eligible = CHALLENGE_POOL.filter(c => c.maxCO2 >= level || level > 600);
        // Shuffle and pick 3
        const shuffled = eligible.sort(() => Math.random() - 0.5).slice(0, 3);
        this.active = shuffled.map(c => ({ ...c, progress: 0, done: false }));
        // Announce
        world.sendMessage("§6§l  📋 Today's Challenges");
        for (const c of this.active) world.sendMessage(`§7  • ${c.label}`);
    }

    _advance(type) {
        for (const c of this.active) {
            if (c.done || c.type !== type) continue;
            c.progress++;
            if (c.progress >= c.n) this._complete(c);
            break;
        }
        this._persist();
    }

    _complete(c) {
        if (c.done) return;
        c.done     = true;
        c.progress = c.n;
        score.add(SCORE.EVENT_COMPLETE);
        world.sendMessage(`§a✓ Challenge complete: §f${c.label}  §a+${SCORE.EVENT_COMPLETE}pts`);
        for (const p of world.getAllPlayers()) {
            try {
                p.dimension.playSound("random.levelup", p.location, { volume: 0.5, pitch: 1.4 });
            } catch (_) {}
        }
        this._persist();
    }

    _checkAllComplete() {
        if (this._allCompleteBonusGiven) return;
        if (this.active.length === 0) return;
        if (this.active.every(c => c.done)) {
            this._allCompleteBonusGiven = true;
            const bonus = SCORE.EVENT_COMPLETE * 2;
            score.add(bonus);
            world.sendMessage(`§a§l🌟 ALL CHALLENGES COMPLETE! §r§a+${bonus}pts bonus`);
            for (const p of world.getAllPlayers()) {
                try {
                    p.onScreenDisplay.setTitle("§a🌟", {
                        subtitle: "§eDailyObjectives complete!", fadeInDuration: 5,
                        stayDuration: 80, fadeOutDuration: 20,
                    });
                    p.dimension.playSound("random.levelup", p.location, { volume: 1.0, pitch: 0.9 });
                } catch (_) {}
            }
            this._persist();
        }
    }

    _persist() {
        try {
            world.setDynamicProperty("challenge_state", JSON.stringify({
                active: this.active, dayIdx: this._dayIdx, bonusGiven: this._allCompleteBonusGiven,
            }));
        } catch (_) {}
    }
}

function _bar(pct, len) {
    const filled = Math.round(pct * len);
    return "§a" + "█".repeat(filled) + "§8" + "░".repeat(len - filled);
}

export const challenges = new ChallengeSystem();
