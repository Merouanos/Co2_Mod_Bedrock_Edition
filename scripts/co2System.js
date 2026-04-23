import { world, system } from "@minecraft/server";
import { SCENARIOS, ACTIVE_SCENARIO, CO2 as CO2_LEVELS } from "./config.js";

/**
 * CO2System
 * ──────────
 * Two CO2 pools:
 *
 *  global    — Atmospheric CO2 (ppm). Affects the world immediately.
 *              Persisted to world storage.
 *
 *  potential — Queued CO2 change. Drains into global gradually over
 *              game-day cycles. Higher pollution = faster drain rate.
 *              Also receives daily passive emissions from the scenario
 *              (background civilisation activity).
 *
 * API:
 *   co2.changeGlobal(delta)     — immediate global change
 *   co2.changePotential(delta)  — queued change
 *   co2.tickPotential()         — drain potential into global (call once/day)
 *   co2.addDailyEmission()      — passive scenario pollution (call once/day)
 *   co2.warningLevel()          — 0–4 severity index
 *   co2.ppm                     — floor of global (for display)
 */
export class CO2System {
    constructor() {
        const scenario    = SCENARIOS[ACTIVE_SCENARIO];
        this.global       = scenario.ppm;
        this.potential    = 0;
        this.scenario     = scenario;
        this.ready        = false;
        // Track previous level for threshold-crossing detection
        this._prevGlobal  = scenario.ppm;
    }

    init() {
        system.runTimeout(() => {
            const g = world.getDynamicProperty("co2_global");
            const p = world.getDynamicProperty("co2_potential");
            this.global       = (g !== undefined) ? /** @type {number} */ (g) : this.scenario.ppm;
            this.potential    = (p !== undefined) ? /** @type {number} */ (p) : 0;
            this._prevGlobal  = this.global;
            this._persist();
            this.ready = true;
        }, 20);
    }

    /** @param {number} delta */
    changeGlobal(delta) {
        this._prevGlobal = this.global;
        this.global = Math.max(0, Math.min(CO2_LEVELS.MAX, this.global + delta));
        this._persist();
    }

    /** @param {number} delta */
    changePotential(delta) {
        this.potential += delta;
        world.setDynamicProperty("co2_potential", this.potential);
    }

    /**
     * Drain potential pool into global. Called once per game-day.
     * At high CO2 the rate doubles — ecosystems lose their buffering capacity.
     */
    tickPotential() {
        if (Math.abs(this.potential) < 0.05) return;

        const rate       = this.global > CO2_LEVELS.WARNING ? 0.24 : 0.12;
        const drain      = this.potential * rate;
        this.potential  -= drain;
        world.setDynamicProperty("co2_potential", this.potential);
        this.changeGlobal(drain);
    }

    /**
     * Add the scenario's daily background emission to the potential pool.
     * This represents civilisation: population growth, industry, transport —
     * things happening regardless of the player's own actions.
     * Players must actively offset this baseline just to stay neutral.
     */
    addDailyEmission() {
        const base = this.scenario.dailyEmission;
        // At high CO2 the feedback loop accelerates (methane releases, permafrost)
        const multiplier = this.global > CO2_LEVELS.DANGER ? 1.6
                         : this.global > CO2_LEVELS.WARNING ? 1.2
                         : 1.0;
        this.changePotential(base * multiplier);
    }

    /** @returns {0|1|2|3|4} */
    warningLevel() {
        if (this.global >= CO2_LEVELS.CRITICAL) return 4;
        if (this.global >= CO2_LEVELS.DANGER)   return 3;
        if (this.global >= CO2_LEVELS.WARNING)  return 2;
        if (this.global >= CO2_LEVELS.CAUTION)  return 1;
        return 0;
    }

    /** True if global CO2 just crossed upward through a threshold this tick. */
    crossedThresholdUp(threshold) {
        return this._prevGlobal < threshold && this.global >= threshold;
    }

    get ppm() { return Math.floor(this.global); }

    _persist() {
        world.setDynamicProperty("co2_global", this.global);
    }
}

export const co2 = new CO2System();
