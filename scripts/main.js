/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║             CO2 RESEARCH MOD — BEDROCK EDITION               ║
 * ║              main.js — System Orchestrator                   ║
 * ╠═══════════════════════════════════════════════════════════════╣
 * ║  Architecture:                                               ║
 * ║    config.js        — All tunable constants                  ║
 * ║    co2System.js     — Dual-pool CO2 management               ║
 * ║    hudSystem.js     — Action-bar HUD with overrides          ║
 * ║    playerEffects.js — Status effects, toxic air, acid rain   ║
 * ║    worldEffects.js  — Environmental degradation              ║
 * ║    eventHandlers.js — Block break/place, hunter combat       ║
 * ║    hunterSystem.js  — Full hunter AI + story state machine   ║
 * ║    journals.js      — Journal content + narrative arc        ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import { system } from "@minecraft/server";

import { co2 }           from "./co2System.js";
import { hud }           from "./hudSystem.js";
import { playerEffects } from "./playerEffects.js";
import { worldEffects }  from "./worldEffects.js";
import { hunterSystem }  from "./hunterSystem.js";
import { registerAll }   from "./eventHandlers.js";
import { SCAN, HUNTER }  from "./config.js";

// ── INITIALIZATION ────────────────────────────────────────────────────────────
// Systems init in a staggered sequence so the world is fully loaded.

system.runTimeout(() => {
    co2.init();            // Load saved CO2 from world storage
}, 10);

system.runTimeout(() => {
    hunterSystem.init();   // Load saved hunter progress (journals, endings)
}, 30);

system.runTimeout(() => {
    registerAll();         // Attach all block/entity event listeners
}, 50);

// ── TICK SCHEDULES ────────────────────────────────────────────────────────────

// 1. HUD — update action bar every second
system.runInterval(() => {
    hud.tick();
}, 20);

// 2. Player status effects — weakness, slowness, nausea every second
system.runInterval(() => {
    playerEffects.tickEffects();
}, 20);

// 3. Toxic atmosphere — tree shelter check + damage every second
system.runInterval(() => {
    playerEffects.tickToxicAtmosphere();
}, 20);

// 4. Acid rain — damage + terrain erosion every 2 seconds
system.runInterval(() => {
    playerEffects.tickAcidRain();
}, 40);

// 5. World block effects — ice melt, desertification, deforestation, fires
//    Runs every second, samples SCAN.SAMPLES_PER_TICK random blocks per player
system.runInterval(() => {
    worldEffects.tickWorld();
}, 20);

// 6. Sea level rise — slow flooding every ~2 minutes
system.runInterval(() => {
    worldEffects.tickSeaRise();
}, SCAN.SEA_RISE_INTERVAL);

// 7. Potential CO2 drain — once every full game-day (24000 ticks = 20 real min)
//    This converts "queued" CO2 (from tree planting etc.) into global CO2
system.runInterval(() => {
    co2.tickPotential();
}, 24000);

// 8. Hunter AI — evaluated every HUNTER.UPDATE_INTERVAL ticks (~2 seconds)
//    Kept slower than world effects to reduce entity query overhead
system.runInterval(() => {
    hunterSystem.update();
}, HUNTER.UPDATE_INTERVAL);
