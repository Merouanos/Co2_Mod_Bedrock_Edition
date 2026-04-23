import { world, system } from "@minecraft/server";
import { ADVISOR } from "./config.js";
import { co2 } from "./co2System.js";
import { score } from "./scoreSystem.js";

/**
 * AdvisorSystem
 * ──────────────
 * Context-sensitive guidance delivered as subtitle flashes.
 * Never uses chat messages. Never repeats the same hint.
 * Never explains game mechanics directly — nudges the player to discover them.
 *
 * Philosophy: show a consequence, let the player form the habit.
 * "The CO2 rose." — not "You should plant trees to lower CO2."
 *
 * Tips fire based on conditions checked once per minute.
 * Each tip fires at most once per world (persisted via dynamic property).
 */

const HINTS = [
    // id              condition(co2, score, elapsed, ctx)       title                subtitle
    {
        id: "h_start",
        condition: (c, s, e) => e >= 1 && e <= 2,
        title: "",
        subtitle: "§7The atmosphere is yours to shape.",
    },
    {
        id: "h_co2_rise",
        condition: (c) => c.global > 430 && c.global < 460,
        title: "",
        subtitle: "§eSomething in the air has changed.",
    },
    {
        id: "h_first_caution",
        condition: (c) => c.global >= 450 && c.global < 470,
        title: "§e450 ppm",
        subtitle: "§7A threshold the scientists warned about.",
    },
    {
        id: "h_trees_help",
        condition: (c, s, e, ctx) => ctx.logsCut >= 3 && s.saplingsPlanted === 0,
        title: "",
        subtitle: "§7The forest remembers what you took.",
    },
    {
        id: "h_sapling_reward",
        condition: (c, s) => s.saplingsPlanted >= 1 && s.saplingsPlanted < 5,
        title: "",
        subtitle: "§aSomething is growing.",
    },
    {
        id: "h_solar_hint",
        condition: (c, s, e) => e >= 5 && s.solarInstalled === 0 && c.global > 440,
        title: "",
        subtitle: "§7The sun gives freely. Most things don't.",
    },
    {
        id: "h_co2_500",
        condition: (c) => c.global >= 500 && c.global < 520,
        title: "§6500 ppm",
        subtitle: "§7Last time the planet saw this, there were no humans.",
    },
    {
        id: "h_co2_falling",
        condition: (c, s, e, ctx) => ctx.co2Falling && c.global > 380,
        title: "",
        subtitle: "§aCO₂ is falling. Keep going.",
    },
    {
        id: "h_score_negative",
        condition: (c, s) => s.value < -100,
        title: "",
        subtitle: "§cThe world has noticed your choices.",
    },
    {
        id: "h_co2_600",
        condition: (c) => c.global >= 600 && c.global < 620,
        title: "§c600 ppm",
        subtitle: "§7The trees are dying on their own now.",
    },
    {
        id: "h_canopy",
        condition: (c, s, e, ctx) => c.global >= 600 && ctx.nearLeaves,
        title: "",
        subtitle: "§aThe canopy holds.",
    },
    {
        id: "h_hunter_near",
        condition: (c, s, e, ctx) => ctx.hunterActive && c.global >= 450,
        title: "",
        subtitle: "§8You are not alone out here.",
    },
    {
        id: "h_co2_700",
        condition: (c) => c.global >= 700,
        title: "§4700 ppm",
        subtitle: "§cThis is what the end looks like.",
    },
    {
        id: "h_score_rising",
        condition: (c, s) => s.value >= 500,
        title: "",
        subtitle: "§aYour choices are making a difference.",
    },
    {
        id: "h_daily_pressure",
        condition: (c, s, e) => e >= 10 && c.potential > 15,
        title: "",
        subtitle: "§6The world pollutes itself. What will you offset?",
    },
];

export class AdvisorSystem {
    constructor() {
        /** @type {Set<string>} IDs of hints already shown this world */
        this._shown = new Set();
        this._cooldown = 0;
        this._ready    = false;

        // Context passed to conditions
        this._ctx = {
            logsCut:     0,
            nearLeaves:  false,
            hunterActive: false,
            co2Falling:  false,
            minutesElapsed: 0,
        };
        this._prevCO2 = 0;
    }

    init() {
        system.runTimeout(() => {
            for (const hint of HINTS) {
                const shown = world.getDynamicProperty(`advisor_${hint.id}`);
                if (shown === true) this._shown.add(hint.id);
            }
            this._prevCO2 = co2.global;
            this._ready   = true;
        }, 100);
    }

    // ── CONTEXT SETTERS (called by event handlers) ────────────────────────────

    onLogCut()             { this._ctx.logsCut++;          }
    setNearLeaves(v)       { this._ctx.nearLeaves = v;      }
    setHunterActive(v)     { this._ctx.hunterActive = v;    }

    // ── MAIN TICK (call once per real minute) ─────────────────────────────────
    tick() {
        if (!this._ready) return;
        if (this._cooldown > 0) { this._cooldown--; return; }

        this._ctx.minutesElapsed++;
        this._ctx.co2Falling = co2.global < this._prevCO2 - 0.5;
        this._prevCO2 = co2.global;

        // Find the first un-shown hint whose condition is met
        for (const hint of HINTS) {
            if (this._shown.has(hint.id)) continue;

            const condMet = hint.condition(co2, score, this._ctx.minutesElapsed, this._ctx);
            if (!condMet) continue;

            this._fire(hint);
            this._shown.add(hint.id);
            world.setDynamicProperty(`advisor_${hint.id}`, true);
            this._cooldown = ADVISOR.MIN_GAP_TICKS / 60; // convert ticks to minutes
            break; // one hint per tick cycle
        }
    }

    // ── DISPLAY ───────────────────────────────────────────────────────────────

    _fire(hint) {
        const dur = Math.floor(ADVISOR.HINT_DURATION_TICKS);
        for (const player of world.getAllPlayers()) {
            try {
                player.onScreenDisplay.setTitle(hint.title || "§r", {
                    subtitle:        hint.subtitle,
                    fadeInDuration:  8,
                    stayDuration:    dur,
                    fadeOutDuration: 20,
                });
            } catch (_) {}
        }
    }
}

export const advisor = new AdvisorSystem();
