/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║        CO2 RESEARCH MOD — MASTER CONFIG  v6                 ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * SETUP: Register at the website → copy your Player Token below.
 */

// ┌─ WORLD LINK ──────────────────────────────────────────────────────────────┐
// │ Register on the website, then paste your Player Token here.               │
// │ Without this, your stats cannot be submitted to the leaderboard.          │
// │ Example: "CO2-A3F9-K2M1-P7X3"                                             │
export const PLAYER_TOKEN = "";    // ← PASTE YOUR TOKEN HERE
// └───────────────────────────────────────────────────────────────────────────┘

// ── SCENARIOS ─────────────────────────────────────────────────────────────────
export const SCENARIOS = {
    ICE_AGE:    { ppm: 240, label: "ICE AGE [50,000 BCE]",    tempOffset: -8,  dailyEmission: 0.1  },
    ROMAN:      { ppm: 280, label: "ROMAN EMPIRE [0 CE]",      tempOffset:  0,  dailyEmission: 0.4  },
    INDUSTRIAL: { ppm: 280, label: "INDUSTRIALIZATION [1850]", tempOffset:  0,  dailyEmission: 2.0  },
    SIXTIES:    { ppm: 310, label: "1960s",                    tempOffset:  1,  dailyEmission: 2.8  },
    MODERN:     { ppm: 425, label: "TODAY [2026]",             tempOffset: 1.5, dailyEmission: 3.5  },
    FUTURE:     { ppm: 700, label: "FUTURE [2100]",            tempOffset:  4,  dailyEmission: 6.0  },
};
export const ACTIVE_SCENARIO = "MODERN";

// ── CO2 THRESHOLDS ────────────────────────────────────────────────────────────
export const CO2 = {
    CAUTION:   450,
    WARNING:   500,
    DANGER:    600,
    CRITICAL:  700,
    MAX:      1200,
};

// ── CO2 ACTIONS ───────────────────────────────────────────────────────────────
export const POTENTIAL = {
    COAL_ORE_MINED:        +5,
    LOG_CUT_NATURAL:       +4,
    CAMPFIRE_LIT:          +3,
    FURNACE_PLACED:        +2,
    COAL_BLOCK_PLACED:    +12,
    CONCRETE_PLACED:       +3,
    SAPLING_PLANTED:       -4,
    BONEMEAL_ON_SAPLING:   -1,
};
export const GLOBAL = { SOLAR_INSTALLED: -8 };

// ── SAPLING SYSTEM ────────────────────────────────────────────────────────────
export const SAPLING = {
    GROW_DAYS_NORMAL:   3,
    GROW_DAYS_CAUTION:  2,
    GROW_DAYS_HIGH_CO2: 1,
    BONEMEAL_PER_DAY:   5,
    BONEMEAL_MAX_DAYS:  2,
    SPACE_RADIUS:       10,
    HEIGHT_RADIUS:       2,
    TOXIC_CO2:        550,
    PURE_SOIL: ["minecraft:moss_block","minecraft:podzol","minecraft:mycelium"],
    MAX_TRACKED:       80,
};

// ── COMBO SYSTEM ──────────────────────────────────────────────────────────────
export const COMBO = {
    WINDOW_TICKS: 900,   // 45 seconds — window for consecutive actions
    MULTIPLIERS: [       // [minComboCount, scoreMultiplier]
        [0, 1.0],
        [2, 1.5],
        [3, 2.0],
        [4, 2.5],
    ],
};

// ── STREAK SYSTEM ─────────────────────────────────────────────────────────────
export const STREAK = {
    TARGET_CO2: 420,
    MULTIPLIERS: [[0,1.0],[3,1.1],[7,1.25],[14,1.5],[30,2.0]],
};

// ── CLIMATE EVENTS ────────────────────────────────────────────────────────────
export const CLIMATE_EVENTS = {
    CHECK_INTERVAL:    2400,
    BASE_CHANCE:       0.15,
    EXTRA_CHANCE_HIGH: 0.25,
};

// ── PLAYER FX ─────────────────────────────────────────────────────────────────
export const PLAYER_FX = {
    WEAKNESS_CO2:   450,
    SLOWNESS_CO2:   500,
    NAUSEA_CO2:     700,
    BLINDNESS_CO2:  750,
    TOXIC_CO2:      600,
    ACID_RAIN_CO2:  600,
};

// ── WORLD FX ─────────────────────────────────────────────────────────────────
export const WORLD_FX = {
    ICE_MELT:         450,
    DESERTIFICATION:  480,
    DEFORESTATION:    500,
    ACID_RAIN:        600,
    WILDFIRE:         650,
    SEA_LEVEL_RISE:   650,
    CROP_INHIBIT:     550,
    CROP_BLOCK:       700,
};

// ── SCORE ─────────────────────────────────────────────────────────────────────
export const SCORE = {
    PER_MIN_SAFE:     +6,
    PER_MIN_CAUTION:  +2,
    PER_MIN_WARNING:  -4,
    PER_MIN_DANGER:  -10,
    PER_MIN_CRITICAL:-20,
    SAPLING_MATURED:  +8,
    SOLAR_INSTALLED: +25,
    JOURNAL_FOUND:   +50,
    GOOD_ENDING:    +500,
    LOG_CUT:          -8,
    COAL_MINED:       -4,
    COAL_BLOCK:      -15,
    BADGE_BONUS:     +30,
    STREAK_BONUS:    +15,
    RECOVERY_BONUS:  +20,
    EVENT_COMPLETE:  +35,
};

// ── BADGES ────────────────────────────────────────────────────────────────────
export const BADGES = [
    { id:"first_sapling",  label:"🌱 First Sapling",   desc:"Plant your first sapling."           },
    { id:"solar_pioneer",  label:"☀ Solar Pioneer",    desc:"Install your first solar panel."     },
    { id:"archivist",      label:"📖 Archivist",        desc:"Recover your first Hunter journal."  },
    { id:"keeper",         label:"🌍 Keeper",           desc:"Hold CO₂ below 420 for 5 minutes."  },
    { id:"survivor",       label:"💀 Survivor",         desc:"Survive 60s with CO₂ above 600."    },
    { id:"good_ending",    label:"✦ The Cure",          desc:"Earn the Hunter's good ending."     },
    { id:"full_archive",   label:"📚 Full Archive",     desc:"All 8 Hunter journals recovered."   },
    { id:"ten_saplings",   label:"🌳 Forester",         desc:"Mature 10 saplings."                },
    { id:"five_solar",     label:"⚡ Grid",             desc:"Install 5 solar panels."           },
    { id:"streak_7",       label:"🔥 Week of Green",    desc:"7-day low-CO₂ streak."              },
    { id:"streak_14",      label:"🔥🔥 Fortnight",      desc:"14-day low-CO₂ streak."             },
    { id:"combo_fire",     label:"🎯 On Fire",          desc:"Reach a ×4 action combo."           },
    { id:"score_500",      label:"★ Rising",            desc:"Reach a score of 500."              },
    { id:"score_1000",     label:"★★ Established",      desc:"Reach a score of 1,000."           },
    { id:"score_2500",     label:"★★★ Guardian",        desc:"Reach a score of 2,500."           },
    { id:"recovered",      label:"💚 Recovery",         desc:"Bring CO₂ below 450 after crisis."  },
];

// ── HUNTER ────────────────────────────────────────────────────────────────────
export const HUNTER = {
    SPAWN_CO2:           400,
    VIEW_DISTANCE:        20,
    SCARE_DISTANCE:        6,
    HELP_DISTANCE:        15,
    COOLDOWN_TICKS:      600,
    MAX_STALK_TICKS:     500,
    UPDATE_INTERVAL:      40,
    JOURNAL_COOLDOWN:   1200,
    GOOD_CO2_THRESHOLD:  360,
    GOOD_TICKS_NEEDED: 12000,
    JOURNAL_COUNT:         8,
};

// ── SCAN ──────────────────────────────────────────────────────────────────────
export const SCAN = {
    SAMPLES_PER_TICK:  400,
    RADIUS:             80,
    HEIGHT_RANGE:       40,
    SEA_RISE_INTERVAL: 2400,
    SEA_LEVEL:          63,
};

// ── ADVISOR ───────────────────────────────────────────────────────────────────
export const ADVISOR = { HINT_DURATION_TICKS: 80, MIN_GAP_TICKS: 600 };

// ── LIVE SYNC ─────────────────────────────────────────────────────────────────
export const LIVE_SYNC = {
    ENABLED:    false,
    SERVER_URL: "http://localhost:3000",
    BDS_SECRET: "change-bds-secret-in-production",
};
