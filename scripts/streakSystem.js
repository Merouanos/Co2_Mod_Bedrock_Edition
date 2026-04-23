import { world, system } from "@minecraft/server";
import { STREAK, SCORE, CO2 as CO2_LEVELS } from "./config.js";
import { co2 } from "./co2System.js";
import { score } from "./scoreSystem.js";

/**
 * StreakSystem
 * ────────────
 * Tracks consecutive game-days where CO2 ends below STREAK.TARGET_CO2.
 * A streak multiplies passive score gain and earns bonus points.
 * Breaking the streak resets the multiplier instantly.
 *
 * The streak count is shown in the HUD as: 🔥7
 *
 * Recovery mechanic: if CO2 was above CAUTION but drops below it,
 * a one-time "recovery bonus" fires and the streak restarts.
 */
export class StreakSystem {
    constructor() {
        this.days           = 0;      // Current streak in game-days
        this.multiplier     = 1.0;
        this._wasAbove      = false;  // Was CO2 above CAUTION last check?
        this._recoveryDone  = false;  // One-time recovery bonus per crisis
    }

    init() {
        system.runTimeout(() => {
            const d = world.getDynamicProperty("streak_days");
            if (d !== undefined) this.days = /** @type {number} */ (d);
            this._updateMultiplier();
        }, 130);
    }

    /**
     * Called once per game-day to evaluate streak.
     */
    tickDay() {
        const level = co2.global;

        // ── Recovery bonus ────────────────────────────────────────────────────
        if (this._wasAbove && level < CO2_LEVELS.CAUTION && !this._recoveryDone) {
            this._recoveryDone = true;
            score.add(SCORE.RECOVERY_BONUS);
            score.awardBadge("recovered");
            world.sendMessage("§a💚 Atmosphere recovering. Keep it up.");
        }
        if (level >= CO2_LEVELS.CAUTION) {
            this._wasAbove     = true;
            this._recoveryDone = false;
        } else {
            this._wasAbove = false;
        }

        // ── Streak evaluation ─────────────────────────────────────────────────
        if (level < STREAK.TARGET_CO2) {
            this.days++;
            score.add(SCORE.STREAK_BONUS * this.multiplier); // Streak bonus
            if (this.days === 7)  score.awardBadge("streak_7");
            if (this.days === 14) score.awardBadge("streak_14");

            if (this.days % 7 === 0) {
                world.sendMessage(`§6🔥 ${this.days}-day streak! Multiplier: ×${this.multiplier.toFixed(1)}`);
            }
        } else {
            if (this.days >= 7) {
                world.sendMessage(`§8Streak broken at ${this.days} days.`);
            }
            this.days = 0;
        }

        this._updateMultiplier();
        world.setDynamicProperty("streak_days", this.days);
    }

    _updateMultiplier() {
        let mx = 1.0;
        for (const [minDays, mult] of STREAK.MULTIPLIERS) {
            if (this.days >= minDays) mx = mult;
        }
        this.multiplier = mx;
    }

    /** HUD fragment — empty string if no streak. */
    get hudStr() {
        if (this.days < 2) return "";
        return ` §8|§r §6🔥${this.days}`;
    }
}

export const streak = new StreakSystem();
