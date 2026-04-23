import { world, system } from "@minecraft/server";
import { COMBO } from "./config.js";

/**
 * ComboSystem
 * ────────────
 * Tracks consecutive good actions within a time window to build
 * a score multiplier — adds urgency and rewards focused play.
 *
 * Good actions: sapling planted, solar installed, bone meal used,
 *               coal ore NOT mined, natural log NOT cut.
 * Bad actions:  coal mined, log cut, coal block placed → break combo.
 *
 * Multiplier tiers (configurable in config.js COMBO):
 *   ×1.0 (no combo), ×1.5 (×2), ×2.0 (×3), ×2.5 (×4+)
 *
 * HUD: shows "§6×2 COMBO" appended to the action-bar when active.
 */
export class ComboSystem {
    constructor() {
        this.count        = 0;   // Current combo count
        this.lastActionTs = 0;   // system.currentTick of last good action
        this.multiplier   = 1.0;
    }

    /** Call when a positive environmental action occurs. */
    onGoodAction() {
        const now = system.currentTick;
        const gap = now - this.lastActionTs;

        if (this.lastActionTs > 0 && gap > COMBO.WINDOW_TICKS) {
            // Too slow — combo resets
            this.count = 0;
        }

        this.count++;
        this.lastActionTs = now;
        this._updateMult();

        if (this.count >= 2) this._flashCombo();
    }

    /** Call when a harmful action occurs — breaks combo instantly. */
    onBadAction() {
        if (this.count >= 2) {
            // Brief penalty flash before reset
            for (const p of world.getAllPlayers()) {
                try {
                    p.onScreenDisplay.setTitle("§c", {
                        subtitle: "§8Combo broken.", fadeInDuration: 2, stayDuration: 20, fadeOutDuration: 10,
                    });
                } catch (_) {}
            }
        }
        this.count = 0;
        this._updateMult();
    }

    /**
     * Returns the score bonus multiplier for a delta amount.
     * Only applies to positive score deltas.
     * @param {number} delta
     */
    applyMultiplier(delta) {
        if (delta <= 0) return delta;
        return delta * this.multiplier;
    }

    /** HUD fragment — empty if no combo. */
    get hudStr() {
        if (this.count < 2) return "";
        const color = this.count >= 4 ? "§4" : this.count >= 3 ? "§c" : "§6";
        return ` §8|§r ${color}×${this.count} COMBO`;
    }

    /** Tick to decay combo if idle. Call every second. */
    tick() {
        if (this.count === 0) return;
        const gap = system.currentTick - this.lastActionTs;
        if (gap > COMBO.WINDOW_TICKS) {
            this.count = 0;
            this._updateMult();
        }
    }

    _updateMult() {
        const tiers = COMBO.MULTIPLIERS;
        let mx = 1.0;
        for (const [minCount, mult] of tiers) {
            if (this.count >= minCount) mx = mult;
        }
        this.multiplier = mx;
    }

    _flashCombo() {
        const color  = this.count >= 4 ? "§c" : "§6";
        const label  = this.count >= 4 ? "§4🔥 ON FIRE!" : `§6×${this.count} Combo`;
        const sub    = this.count >= 4 ? "§cScore ×2.5" :
                       this.count >= 3 ? "§6Score ×2.0" : "§eScore ×1.5";
        for (const p of world.getAllPlayers()) {
            try {
                p.onScreenDisplay.setTitle(label, {
                    subtitle: sub, fadeInDuration: 2, stayDuration: 25, fadeOutDuration: 8,
                });
            } catch (_) {}
        }
    }
}

export const combo = new ComboSystem();
