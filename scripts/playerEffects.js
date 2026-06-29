import { world, system } from "@minecraft/server";
import { PLAYER_FX } from "./config.js";
import { co2 } from "./co2System.js";
import { hud } from "./hudSystem.js";
import { advisor } from "./advisorSystem.js";

/**
 * PlayerEffectsSystem
 * ────────────────────
 * Manages all CO2-driven effects on players:
 *
 *   1. STATUS EFFECTS  — weakness, slowness, nausea, blindness
 *      Scale with CO2 level, applied every second.
 *
 *   2. TOXIC ATMOSPHERE (CO2 ≥ 600)
 *      Players take 1 damage/second unless they are within 4 blocks
 *      of leaf blocks ("natural canopy shelter").
 *      Trees become refuges — player must make choices.
 *
 *   3. ACID RAIN (CO2 ≥ 600, raining)
 *      Players exposed to the sky take damage.
 *      Nearby grass erodes into dirt.
 */
export class PlayerEffectsSystem {
    /**
     * Apply status effects based on CO2. Call every 20 ticks.
     */
    tickEffects() {
        const level = co2.global;

        for (const player of world.getAllPlayers()) {
            if (level >= PLAYER_FX.WEAKNESS_CO2) {
                player.addEffect("weakness",  40, { amplifier: 0, showParticles: false });
            }
            if (level >= PLAYER_FX.SLOWNESS_CO2) {
                player.addEffect("slowness",  40, { amplifier: 0, showParticles: false });
            }
            if (level >= PLAYER_FX.NAUSEA_CO2) {
                player.addEffect("nausea",    40, { amplifier: 1, showParticles: false });
            }
            if (level >= PLAYER_FX.BLINDNESS_CO2) {
                // Partial blindness — strong nausea doubles as vision-blurring
                player.addEffect("blindness", 40, { amplifier: 0, showParticles: false });
            }
        }
    }

    /**
     * Toxic atmosphere check. Call every 20 ticks.
     * Damages players not sheltered by nearby leaf blocks.
     */
    tickToxicAtmosphere() {
        const level = co2.global;
        if (level < PLAYER_FX.TOXIC_CO2) return;

        for (const player of world.getAllPlayers()) {
            const protected_ = this._isUnderCanopy(player);

            // Keep advisor informed so it can fire the canopy hint
            advisor.setNearLeaves(protected_);

            if (protected_) {
                hud.setOverride(
                    player,
                    `§a✦ CANOPY SHELTER  §8|  ${hud.co2Line()}`,
                    30
                );

                // Small green particle burst to reward canopy use
                if (system.currentTick % 15 === 0) {
                    player.dimension.spawnParticle("minecraft:crop_growth_emitter", player.location);
                }
            } else {
                // Scale damage with CO2 severity
                const dmg = level >= 700 ? 2 : 1;
                player.applyDamage(dmg, { cause: "none" });

                hud.setOverride(
                    player,
                    `§4☠ TOXIC ATMOSPHERE — Find trees!  §8|  ${hud.co2Line()}`,
                    30
                );

                player.dimension.spawnParticle("minecraft:basic_smoke_particle", player.location);

                if (system.currentTick % 40 === 0) {
                    player.dimension.playSound("random.breath", player.location, {
                        volume: 0.4, pitch: 0.5,
                    });
                }
            }
        }
    }

    /**
     * Acid rain mechanic. Call every 40 ticks.
     * Rain becomes acidic at CO2 ≥ 600 — hurts exposed players, erodes terrain.
     */
    tickAcidRain(isAcidStorm = false, clearSkies = false) {
        const level = co2.global;
        if (clearSkies) return;
        if (level < PLAYER_FX.ACID_RAIN_CO2 && !isAcidStorm) return;

        let isRaining = false;
        try {
            const weather = world.getWeather();
            isRaining = (weather === "Rain" || weather === "Thunder");
        } catch (_) {
            return;
        }
        if (!isRaining) return;

        for (const player of world.getAllPlayers()) {
            const dim = player.dimension;
            const pos = player.location;

            // ── Player exposure check ────────────────────────────────────────
            let exposed = false;
            try {
                const topBlock = dim.getTopmostBlock({ x: pos.x, z: pos.z });
                exposed = topBlock !== undefined && pos.y >= topBlock.location.y;
            } catch (_) {}

            if (exposed) {
                player.applyDamage(1, { cause: "none" });
                hud.setOverride(
                    player,
                    `§e☁ ACID RAIN — Get inside!  §8|  ${hud.co2Line()}`,
                    50
                );
                dim.spawnParticle("minecraft:crop_growth_emitter", pos); // Acid mist
            }

            // ── Terrain erosion ───────────────────────────────────────────────
            // Exposed grass slowly turns to dirt under acid rain
            for (let i = 0; i < 30; i++) {
                const sx = Math.floor(pos.x + (Math.random() - 0.5) * 60);
                const sy = Math.floor(pos.y + (Math.random() - 0.5) * 20);
                const sz = Math.floor(pos.z + (Math.random() - 0.5) * 60);

                try {
                    const block = dim.getBlock({ x: sx, y: sy, z: sz });
                    if (!block?.isValid() || block.typeId !== "minecraft:grass_block") continue;

                    const surface = dim.getTopmostBlock({ x: sx, z: sz });
                    if (surface && sy >= surface.location.y - 1) {
                        block.setType("minecraft:dirt");
                    }
                } catch (_) {}
            }
        }
    }

    // ── HELPERS ───────────────────────────────────────────────────────────────

    /**
     * Returns true if the player is within 4 blocks of any leaf block.
     * Scans a 9x6x9 area.
     */
    _isUnderCanopy(player) {
        const pos = player.location;
        const dim = player.dimension;

        for (let x = -4; x <= 4; x++) {
            for (let y = -1; y <= 5; y++) {
                for (let z = -4; z <= 4; z++) {
                    try {
                        const b = dim.getBlock({
                            x: Math.floor(pos.x) + x,
                            y: Math.floor(pos.y) + y,
                            z: Math.floor(pos.z) + z,
                        });
                        if (b?.typeId.includes("leaves")) return true;
                    } catch (_) {}
                }
            }
        }
        return false;
    }
}

export const playerEffects = new PlayerEffectsSystem();
