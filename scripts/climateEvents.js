import { world, system } from "@minecraft/server";
import { CLIMATE_EVENTS, CO2 as CO2_LEVELS, SCORE } from "./config.js";
import { co2 } from "./co2System.js";
import { score } from "./scoreSystem.js";
import { hud } from "./hudSystem.js";

/**
 * ClimateEvents
 * ─────────────
 * Random environmental events that create urgency, tension, and reward.
 * Events fire on a random roll every CHECK_INTERVAL ticks.
 * High CO2 increases chance and unlocks the worst events.
 *
 * Positive events (low CO2 reward):
 *   • Green Pulse      — brief CO2 reduction bonus near trees
 *   • Seed Rain        — bonus saplings placed randomly near player
 *   • Clear Skies      — score bonus, safe from acid rain for 3 min
 *
 * Negative events (high CO2 penalty):
 *   • Heat Wave        — temperature spike, faster desertification
 *   • Acid Storm       — forced rain + double acid rain damage (warning given)
 *   • Coal Rush        — coal ore gives double CO2 for 2 min (announced)
 *   • Methane Burst    — large instant CO2 spike (≥700 only)
 */

const EVENTS_LOW_CO2 = ["green_pulse", "clear_skies"];
const EVENTS_HIGH_CO2 = ["heat_wave", "acid_storm", "coal_rush"];
const EVENTS_CRITICAL = ["methane_burst"];

export class ClimateEventSystem {
    constructor() {
        this._activeEvent    = null;
        this._eventTimer     = 0;
        this.acidStormActive = false;
        this.coalRushActive  = false;
        this.clearSkiesUntil = 0;
    }

    /** Main event roll tick — call every CLIMATE_EVENTS.CHECK_INTERVAL ticks. */
    tickRoll() {
        if (this._activeEvent) {
            this._tickActive();
            return;
        }

        const level = co2.global;
        let chance  = CLIMATE_EVENTS.BASE_CHANCE;
        if (level > CO2_LEVELS.DANGER) chance += CLIMATE_EVENTS.EXTRA_CHANCE_HIGH;
        if (Math.random() > chance) return;

        // Pick event pool based on CO2
        let pool = [];
        if (level < CO2_LEVELS.CAUTION)  pool = EVENTS_LOW_CO2;
        else if (level < CO2_LEVELS.DANGER) pool = EVENTS_HIGH_CO2;
        else                              pool = [...EVENTS_HIGH_CO2, ...EVENTS_CRITICAL];

        // Bias: low CO2 occasionally spawns a positive event too
        if (level < CO2_LEVELS.WARNING && Math.random() < 0.4) pool = EVENTS_LOW_CO2;

        const event = pool[Math.floor(Math.random() * pool.length)];
        this._fireEvent(event);
    }

    _fireEvent(id) {
        this._activeEvent = id;
        const players = world.getAllPlayers();

        switch (id) {

            case "green_pulse": {
                // Find players near leaves — reward them with a CO2 dip
                let nearTrees = false;
                for (const p of players) {
                    if (_isNearLeaves(p)) { nearTrees = true; break; }
                }
                if (nearTrees) {
                    co2.changeGlobal(-3);
                    score.add(SCORE.EVENT_COMPLETE);
                    _titleAll("§a✦ Green Pulse", "§7The forest exhaled.");
                }
                this._activeEvent = null;
                break;
            }

            case "clear_skies": {
                this.clearSkiesUntil = system.currentTick + 3600; // 3 min
                score.add(SCORE.EVENT_COMPLETE);
                _titleAll("§a☀ Clear Skies", "§7No acid rain for 3 minutes.");
                this._activeEvent = null;
                break;
            }

            case "heat_wave": {
                this._eventTimer = 2400; // 2 min
                world.sendMessage("§c🌡 Heat wave incoming — desertification accelerating.");
                _titleAll("§c🌡 HEAT WAVE", "§6The ground is cracking.");
                break;
            }

            case "acid_storm": {
                // 30 second warning, then activate rain + double damage
                this._eventTimer = 600; // 30s warning
                world.sendMessage("§e⚠ Acid storm forming. Seek shelter in 30 seconds.");
                _titleAll("§e⚠ ACID STORM", "§7Find cover within 30 seconds.");
                break;
            }

            case "coal_rush": {
                this.coalRushActive = true;
                this._eventTimer    = 2400; // 2 min
                world.sendMessage("§6[Coal Rush] Mining coal causes double CO₂ for 2 minutes!");
                _titleAll("§6⛏ COAL RUSH", "§8Mining coal is doubly harmful.");
                break;
            }

            case "methane_burst": {
                const spike = 8 + Math.floor(Math.random() * 12); // 8–20ppm
                co2.changeGlobal(spike);
                world.sendMessage(`§4💨 Methane burst from thawing permafrost: +${spike}ppm CO₂`);
                _titleAll("§4💨 METHANE BURST", `§c+${spike}ppm — permafrost is thawing.`);
                this._activeEvent = null;
                break;
            }

            default:
                this._activeEvent = null;
        }
    }

    _tickActive() {
        if (this._eventTimer > 0) this._eventTimer--;

        switch (this._activeEvent) {

            case "heat_wave":
                // Boost desertification rate temporarily (handled by worldEffects checking this flag)
                if (this._eventTimer <= 0) {
                    this._activeEvent = null;
                    world.sendMessage("§8The heat wave has passed.");
                }
                break;

            case "acid_storm":
                if (this._eventTimer <= 0 && !this.acidStormActive) {
                    // Activate storm
                    this.acidStormActive = true;
                    this._eventTimer = 1200; // 1 min of storm
                    try { world.setWeather("Rain", 1200); } catch (_) {}
                    world.sendMessage("§c☁ Acid storm hits! Seek shelter NOW.");
                } else if (this._eventTimer <= 0 && this.acidStormActive) {
                    this.acidStormActive = false;
                    this._activeEvent    = null;
                    world.sendMessage("§8The acid storm has cleared.");
                }
                break;

            case "coal_rush":
                if (this._eventTimer <= 0) {
                    this.coalRushActive  = false;
                    this._activeEvent    = null;
                    world.sendMessage("§8Coal rush ended.");
                }
                break;
        }
    }

    get isHeatWave()   { return this._activeEvent === "heat_wave"; }
    get clearSkies()   { return system.currentTick < this.clearSkiesUntil; }
}

function _isNearLeaves(player) {
    const pos = player.location;
    const dim = player.dimension;
    for (let x = -4; x <= 4; x++) {
        for (let y = -1; y <= 4; y++) {
            for (let z = -4; z <= 4; z++) {
                try {
                    const b = dim.getBlock({ x: Math.floor(pos.x)+x, y: Math.floor(pos.y)+y, z: Math.floor(pos.z)+z });
                    if (b?.typeId.includes("leaves")) return true;
                } catch (_) {}
            }
        }
    }
    return false;
}

function _titleAll(title, sub) {
    for (const p of world.getAllPlayers()) {
        try {
            p.onScreenDisplay.setTitle(title, {
                subtitle: sub, fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 20,
            });
        } catch (_) {}
    }
}

export const climateEvents = new ClimateEventSystem();
