import { world, system } from "@minecraft/server";
import { SCENARIOS, ACTIVE_SCENARIO } from "./config.js";
import { co2 } from "./co2System.js";
import { score } from "./scoreSystem.js";
import { streak } from "./streakSystem.js";
import { combo } from "./comboSystem.js";
import { challenges } from "./challengeSystem.js";

const SCENARIO = SCENARIOS[ACTIVE_SCENARIO];

export class HUDSystem {
    constructor() {
        this._overrides = new Map();
        this._challengeCycle = 0;  // Cycles through challenge lines in HUD
    }

    setOverride(player, message, durationTicks) {
        this._overrides.set(player.id, { message, expiry: system.currentTick + durationTicks });
    }

    co2Line() {
        const { color } = this._severity(co2.global);
        const p = co2.potential;
        const ps = Math.abs(p) >= 0.5 ? ` ${p > 0 ? "§c+" : "§a"}${Math.floor(p)}⟳§r` : "";
        return `§fCO₂: ${color}${co2.ppm}ppm§r${ps}`;
    }

    tick() {
        this._challengeCycle++;
        for (const player of world.getAllPlayers()) {
            const ov = this._overrides.get(player.id);
            if (ov) {
                if (system.currentTick < ov.expiry) {
                    player.onScreenDisplay.setActionBar(ov.message);
                    continue;
                }
                this._overrides.delete(player.id);
            }
            player.onScreenDisplay.setActionBar(this._buildHUD());
        }
    }

    _buildHUD() {
        const level = co2.global;
        const p     = co2.potential;
        const { color, status } = this._severity(level);

        const tempC  = (SCENARIO.tempOffset + ((level - 280) / 420) * 4).toFixed(1);
        const ps     = Math.abs(p) >= 0.5 ? ` ${p > 0 ? "§c+" : "§a"}${Math.floor(p)}⟳§r` : "";

        // Cycle challenge status every 5 seconds
        let challengeStr = "";
        if (Math.floor(this._challengeCycle / 100) % 3 === 0) {
            challengeStr = challenges.hudStr;
        }

        return (
            `§7[${SCENARIO.label}] ` +
            `${color}${status}§r ` +
            `§8|§r ${color}${Math.floor(level)}ppm§r${ps} ` +
            `§8|§r §7${tempC > 0 ? "+" : ""}${tempC}°C ` +
            `§8|§r §fScore: ${score.hudStr}` +
            streak.hudStr +
            combo.hudStr +
            challengeStr
        );
    }

    _severity(level) {
        if (level >= 700) return { color: "§4", status: "☠ CRITICAL" };
        if (level >= 600) return { color: "§c", status: "⚠ DANGEROUS" };
        if (level >= 500) return { color: "§6", status: "WARNING" };
        if (level >= 450) return { color: "§e", status: "CAUTION" };
        return                   { color: "§a", status: "STABLE" };
    }
}

export const hud = new HUDSystem();
