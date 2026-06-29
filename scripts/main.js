/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          CO2 RESEARCH MOD — BEDROCK EDITION  v6                 ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  authSystem.js     ─ World identity + account linking           ║
 * ║  comboSystem.js    ─ Action combo multiplier (addictive hook)   ║
 * ║  challengeSystem.js─ 3 daily objectives + bonus                 ║
 * ║  saplingSystem.js  ─ Sapling lifecycle / anti-cheese            ║
 * ║  streakSystem.js   ─ Day streak + score multiplier              ║
 * ║  climateEvents.js  ─ Random climate challenges                  ║
 * ║  scoreSystem.js    ─ Score, badges, milestones                  ║
 * ║  advisorSystem.js  ─ Contextual subtitle hints                  ║
 * ║  hudSystem.js      ─ Action-bar HUD                             ║
 * ║  playerEffects.js  ─ Status effects, toxic air, acid rain       ║
 * ║  worldEffects.js   ─ Environmental degradation                  ║
 * ║  eventHandlers.js  ─ Block/item events + combo/challenge hooks  ║
 * ║  hunterSystem.js   ─ Hunter AI + endings                        ║
 * ║  statsExporter.js  ─ Authenticated share code + live sync       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { system } from "@minecraft/server";

import { auth }            from "./authSystem.js";
import { co2 }             from "./co2System.js";
import { hud }             from "./hudSystem.js";
import { score }           from "./scoreSystem.js";
import { streak }          from "./streakSystem.js";
import { combo }           from "./comboSystem.js";
import { challenges }      from "./challengeSystem.js";
//import { saplingSystem }   from "./saplingSystem.js";
import {saplingSys}         from "./saplingSys.js";
import { climateEvents }   from "./climateEvents.js";
import { advisor }         from "./advisorSystem.js";
import { playerEffects }   from "./playerEffects.js";
import { worldEffects }    from "./worldEffects.js";
import { hunterSystem }    from "./hunterSystem.js";
import { statsExporter }   from "./statsExporter.js";
import { registerAll, tickProximityWarning, checkScoreMilestone } from "./eventHandlers.js";
import { SCAN, HUNTER, CLIMATE_EVENTS } from "./config.js";

// ── STAGGERED INIT ────────────────────────────────────────────────────────────
system.runTimeout(() => { auth.init();           }, 10);
system.runTimeout(() => { co2.init();            }, 20);
system.runTimeout(() => { score.init();          }, 40);
system.runTimeout(() => { streak.init();         }, 60);
//system.runTimeout(() => { saplingSystem.init();  }, 80);
system.runTimeout(() => {saplingSys.init();}, 20);
system.runTimeout(() => { challenges.init();     }, 100);
system.runTimeout(() => { hunterSystem.init();   }, 120);
system.runTimeout(() => { advisor.init();        }, 140);
system.runTimeout(() => { registerAll();         }, 160);
system.runTimeout(() => { statsExporter.showOnLoad(); }, 350);

// ── 1s TICKS ─────────────────────────────────────────────────────────────────
system.runInterval(() => { hud.tick(); }, 20);
system.runInterval(() => { playerEffects.tickEffects(); }, 20);
system.runInterval(() => { playerEffects.tickToxicAtmosphere(); }, 20);
system.runInterval(() => { worldEffects.tickWorld(climateEvents.isHeatWave); }, 20);
system.runInterval(() => { combo.tick(); }, 20);          // Decay idle combo
system.runInterval(() => { challenges.tick(); }, 20);     // Time-based challenge progress
system.runInterval(() => { tickProximityWarning(); }, 20);
system.runInterval(() => { checkScoreMilestone(); }, 20);


// ── 2s TICKS ─────────────────────────────────────────────────────────────────
system.runInterval(() => {
    playerEffects.tickAcidRain(climateEvents.acidStormActive, climateEvents.clearSkies);
}, 40);
system.runInterval(() => { hunterSystem.update(); }, HUNTER.UPDATE_INTERVAL);


// ── 3s TICKS ─────────────────────────────────────────────────────────────────
system.runInterval(() => { score.tickSurvivor(); }, 60);

// ── 1min TICKS ───────────────────────────────────────────────────────────────
system.runInterval(() => {
    score.setStreakMultiplier(streak.multiplier);
    score.tickPassive();
}, 1200);
system.runInterval(() => { advisor.tick(); }, 1200);

// ── CLIMATE EVENTS ────────────────────────────────────────────────────────────
system.runInterval(() => { climateEvents.tickRoll(); }, CLIMATE_EVENTS.CHECK_INTERVAL);

// ── SEA LEVEL (~2min) ─────────────────────────────────────────────────────────
system.runInterval(() => { worldEffects.tickSeaRise(); }, SCAN.SEA_RISE_INTERVAL);

// ── GAME-DAY (24000 ticks ≈ 20 real minutes) ─────────────────────────────────
system.runInterval(() => {
    co2.addDailyEmission();
    co2.tickPotential();
    streak.tickDay();
    score.setStreakMultiplier(streak.multiplier);
    //saplingSystem.tickDay();
    challenges.tickDay(saplingSystem._currentDay);
    statsExporter.tickDaily();
}, 24000);
