import { world, system } from "@minecraft/server";
import { WORLD_FX, SCAN, CO2 as CO2_LEVELS } from "./config.js";
import { co2 } from "./co2System.js";

/**
 * WorldEffectsSystem
 * ───────────────────
 * Drives all CO2-triggered environmental changes in the world.
 * Runs on two cadences:
 *
 *   TICK (every 20 ticks / 1 second)
 *     - Ice melt
 *     - Desertification (grass → sand)
 *     - Deforestation (natural decay of logs and leaves)
 *     - Wildfires (spontaneous log ignition)
 *
 *   SEA RISE (every SCAN.SEA_RISE_INTERVAL ticks / ~2 minutes)
 *     - Places water at sea level in coastal areas
 *
 * The "apocalypse tick" randomly samples SCAN.SAMPLES_PER_TICK blocks
 * around each player within SCAN.RADIUS. This keeps performance
 * reasonable while still creating visible, creeping environmental change.
 *
 * All effects are threshold-gated — nothing happens until the
 * relevant CO2 level is reached.
 */
export class WorldEffectsSystem {

    /**
     * Main world change tick. Call every 20 ticks.
     */
    tickWorld() {
        const level = co2.global;

        // Nothing to do below caution threshold
        if (level < CO2_LEVELS.CAUTION) return;

        for (const player of world.getAllPlayers()) {
            this._sampleBlocks(player, level);
        }
    }

    /**
     * Slow sea level rise. Call every SCAN.SEA_RISE_INTERVAL ticks.
     */
    tickSeaRise() {
        const level = co2.global;
        if (level < WORLD_FX.SEA_LEVEL_RISE) return;

        // The higher the CO2, the higher the water rises
        // At 650ppm: sea+1. At 800: sea+2. At 1000+: sea+3.
        const riseOffset = Math.floor(Math.min(3, (level - 650) / 120));
        const targetY    = SCAN.SEA_LEVEL + riseOffset;

        for (const player of world.getAllPlayers()) {
            const pos = player.location;
            const dim = player.dimension;

            if (dim.id !== "minecraft:overworld") continue;

            // Place water at coastal areas near sea level
            for (let i = 0; i < 25; i++) {
                const fx = Math.floor(pos.x + (Math.random() - 0.5) * 120);
                const fz = Math.floor(pos.z + (Math.random() - 0.5) * 120);

                try {
                    const block = dim.getBlock({ x: fx, y: targetY, z: fz });
                    if (!block?.isValid()) continue;

                    // Only flood air and surface-level grass (coastal edges)
                    if (block.typeId === "minecraft:air" ||
                        block.typeId === "minecraft:grass_block") {
                        block.setType("minecraft:water");
                    }
                } catch (_) {}
            }

            // Alert players about rising seas
            if (Math.random() < 0.05) {
                world.sendMessage("§9§l[!] §bSea levels are rising...");
            }
        }
    }

    // ── BLOCK-LEVEL EFFECTS ───────────────────────────────────────────────────

    _sampleBlocks(player, level) {
        const pos = player.location;
        const dim = player.dimension;

        for (let i = 0; i < SCAN.SAMPLES_PER_TICK; i++) {
            const bx = Math.floor(pos.x + (Math.random() - 0.5) * SCAN.RADIUS);
            const by = Math.floor(pos.y + (Math.random() - 0.5) * SCAN.HEIGHT_RANGE);
            const bz = Math.floor(pos.z + (Math.random() - 0.5) * SCAN.RADIUS);

            try {
                const block = dim.getBlock({ x: bx, y: by, z: bz });
                if (!block?.isValid()) continue;

                const id = block.typeId;
                this._applyBlockEffect(block, id, level, dim, pos);
            } catch (_) {}
        }
    }

    _applyBlockEffect(block, id, level, dim, playerPos) {
        // ── 1. ICE MELT (≥450ppm) ─────────────────────────────────────────
        if (level >= WORLD_FX.ICE_MELT) {
            if (id === "minecraft:ice" || id === "minecraft:blue_ice") {
                block.setType("minecraft:water");
                return;
            }
            if (id === "minecraft:snow_block") {
                block.setType("minecraft:water");
                return;
            }
            if (id === "minecraft:snow") {
                block.setType("minecraft:air");
                return;
            }
            if (id === "minecraft:powder_snow") {
                block.setType("minecraft:water");
                return;
            }
        }

        // ── 2. DESERTIFICATION (≥480ppm) ──────────────────────────────────
        if (level >= WORLD_FX.DESERTIFICATION) {
            if (id === "minecraft:grass_block") {
                block.setType("minecraft:sand");
                return;
            }
            if (id === "minecraft:mycelium") {
                block.setType("minecraft:sand");
                return;
            }
            if (id === "minecraft:farmland") {
                block.setType("minecraft:sand");
                return;
            }
        }

        // ── 3. NATURAL DEFORESTATION (≥500ppm) ────────────────────────────
        // Trees begin dying — leaves fall, logs rot
        if (level >= WORLD_FX.DEFORESTATION) {
            if (id.includes("leaves")) {
                // Leaves decay at a moderate rate (~40% chance when sampled)
                if (Math.random() > 0.6) {
                    block.setType("minecraft:air");
                    return;
                }
            }
            if (id.includes("_log") && Math.random() > 0.85) {
                // Logs rot slower than leaves
                block.setType("minecraft:air");
                // Play a soft break sound occasionally
                if (Math.random() > 0.92) {
                    try {
                        dim.playSound("block.wood.break",
                            block.location, { volume: 0.3, pitch: 0.7 });
                    } catch (_) {}
                }
                return;
            }
        }

        // ── 4. WILDFIRES (≥650ppm) ────────────────────────────────────────
        if (level >= WORLD_FX.WILDFIRE && Math.random() > 0.995) {
            if (id.includes("_log") || id.includes("leaves")) {
                try {
                    const above = block.above();
                    if (above?.isValid() && above.typeId === "minecraft:air") {
                        above.setType("minecraft:fire");
                        world.sendMessage(
                            `§4[WILDFIRE] §cSpontaneous combustion near ` +
                            `${Math.floor(block.location.x)}, ${Math.floor(block.location.z)}`
                        );
                        dim.playSound("ambient.weather.thunder", playerPos,
                            { volume: 0.3, pitch: 1.4 });
                    }
                } catch (_) {}
            }
        }
    }
}

export const worldEffects = new WorldEffectsSystem();
