import { world, system } from "@minecraft/server";
import { SCENARIOS, ACTIVE_SCENARIO, CO2 as CO2_LEVELS } from "./config.js";

/**
 * CO2System
 * ──────────
 * Manages two CO2 pools:
 *
 *  • global    — Current atmospheric CO2 (ppm). Affects world immediately.
 *                Persisted to world storage so it survives restarts.
 *
 *  • potential — Queued CO2 changes that drain into global gradually.
 *                Used for slow-release actions: a sapling reduces potential CO2
 *                while it matures; cutting a standing tree adds potential as the
 *                ecosystem impact plays out.
 *
 * Potential drains once per game-day cycle.
 * Higher global CO2 → faster drain (positive feedback / runaway effect).
 */
export class CO2System {
    constructor() {
        const scenario = SCENARIOS[ACTIVE_SCENARIO];
        /** @type {number} */
        this.global    = scenario.ppm;
        /** @type {number} */
        this.potential = 0;
        this.scenario  = scenario;
        this.ready     = false;
    }

    /** Load saved state from world storage. Call once at startup. */
    init() {
        system.runTimeout(() => {
            const savedGlobal    = /** @type {number|undefined} */ (world.getDynamicProperty("co2_global"));
            const savedPotential = /** @type {number|undefined} */ (world.getDynamicProperty("co2_potential"));
            this.global    = (savedGlobal    !== undefined) ? savedGlobal    : this.scenario.ppm;
            this.potential = (savedPotential !== undefined) ? savedPotential : 0;
            this._persist();
            this.ready = true;
        }, 20);
    }

    /**
     * Immediately change the global CO2 level.
     * @param {number} delta  Positive = more CO2, negative = less.
     */
    changeGlobal(delta) {
        this.global = Math.max(0, Math.min(CO2_LEVELS.MAX, this.global + delta));
        this._persist();
    }

    /**
     * Queue a slow CO2 change (drains into global once per day cycle).
     * @param {number} delta
     */
    changePotential(delta) {
        this.potential += delta;
        world.setDynamicProperty("co2_potential", this.potential);
    }

    /**
     * Called once per game-day. Drains potential pool into global.
     * Higher pollution = faster drain rate (runaway positive feedback).
     */
    tickPotential() {
        if (Math.abs(this.potential) < 0.05) return;

        const pollutionMod = this.global > CO2_LEVELS.WARNING ? 2.0 : 1.0;
        const drainAmount  = this.potential * (0.12 * pollutionMod);

        this.potential -= drainAmount;
        world.setDynamicProperty("co2_potential", this.potential);
        this.changeGlobal(drainAmount);
    }

    /**
     * Returns the current severity level: 0 (safe) → 4 (critical).
     * @returns {0|1|2|3|4}
     */
    warningLevel() {
        if (this.global >= CO2_LEVELS.CRITICAL) return 4;
        if (this.global >= CO2_LEVELS.DANGER)   return 3;
        if (this.global >= CO2_LEVELS.WARNING)  return 2;
        if (this.global >= CO2_LEVELS.CAUTION)  return 1;
        return 0;
    }

    /** Formatted ppm string for display. */
    get ppm() {
        return Math.floor(this.global);
    }

    _persist() {
        world.setDynamicProperty("co2_global", this.global);
    }
}

export const co2 = new CO2System();
