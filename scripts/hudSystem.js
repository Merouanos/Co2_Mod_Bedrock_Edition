import { world, system } from "@minecraft/server";
import { SCENARIOS, ACTIVE_SCENARIO } from "./config.js";
import { co2 } from "./co2System.js";

const SCENARIO = SCENARIOS[ACTIVE_SCENARIO];

/**
 * HUD System
 * ───────────
 * Drives the player's action bar with:
 *   - Scenario label
 *   - CO2 level (ppm) with colour-coded severity
 *   - Pending CO2 (⟳) — the "debt" from unresolved actions, drains over time
 *   - Simple temperature estimate
 *
 * External systems (toxic atmosphere, acid rain, action feedback) override
 * the HUD temporarily via setOverride(). The co2Line() method is exposed
 * so override messages can append live CO2 data without repeating logic.
 */
export class HUDSystem {
    constructor() {
        // Map of player UUID → { message, expiryTick }
        this._overrides = new Map();
    }

    /**
     * Set a temporary HUD override for one player.
     * @param {import("@minecraft/server").Player} player
     * @param {string}  message
     * @param {number}  durationTicks
     */
    setOverride(player, message, durationTicks) {
        this._overrides.set(player.id, {
            message,
            expiry: system.currentTick + durationTicks,
        });
    }

    /**
     * Returns the live CO₂ + pending segment for embedding in override messages.
     * Example: "§fCO₂: §c487ppm §8+12⟳"
     */
    co2Line() {
        const { color } = this._severity(co2.global);
        const pending    = co2.potential;
        const pendingStr = Math.abs(pending) >= 0.5
            ? ` §8${pending > 0 ? "+" : ""}${Math.floor(pending)}⟳`
            : "";
        return `§fCO₂: ${color}${co2.ppm}ppm${pendingStr}`;
    }

    /** Update the HUD for all players. Call every 20 ticks (1 second). */
    tick() {
        for (const player of world.getAllPlayers()) {
            const override = this._overrides.get(player.id);

            if (override) {
                if (system.currentTick < override.expiry) {
                    player.onScreenDisplay.setActionBar(override.message);
                    continue;
                } else {
                    this._overrides.delete(player.id);
                }
            }

            player.onScreenDisplay.setActionBar(this._buildHUD());
        }
    }

    _buildHUD() {
        const level   = co2.global;
        const pending = co2.potential;
        const { color, status } = this._severity(level);

        // Temperature estimate: scenario base + CO2 scaling (~4°C across full range)
        const tempDelta = ((level - 280) / 420) * 4;
        const tempC     = (SCENARIO.tempOffset + tempDelta).toFixed(1);
        const tempStr   = `${tempC > 0 ? "+" : ""}${tempC}°C`;

        // Pending pool — colour-coded by direction (red = debt, green = credit)
        const pendingStr = Math.abs(pending) >= 0.5
            ? ` §8${pending > 0 ? "§c+" : "§a"}${Math.floor(pending)}⟳`
            : "";

        return (
            `§7[${SCENARIO.label}] ` +
            `${color}${status} ` +
            `§8| §fCO₂: ${color}${Math.floor(level)}ppm${pendingStr} ` +
            `§8| §7${tempStr}`
        );
    }

    _severity(level) {
        if (level >= 700) return { color: "§4", status: "CRITICAL ☠" };
        if (level >= 600) return { color: "§c", status: "DANGEROUS ⚠" };
        if (level >= 500) return { color: "§6", status: "WARNING" };
        if (level >= 450) return { color: "§e", status: "CAUTION" };
        return                   { color: "§a", status: "STABLE" };
    }
}

export const hud = new HUDSystem();
