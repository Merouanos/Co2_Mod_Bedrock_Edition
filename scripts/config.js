/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║        CO2 RESEARCH MOD — MASTER CONFIGURATION              ║
 * ║  Edit values here to tune gameplay without touching logic.  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── SCENARIOS ─────────────────────────────────────────────────────────────────
// Each scenario defines starting CO2, a display label, and a base temperature.
// Set ACTIVE_SCENARIO to any key below to change the world's starting state.
export const SCENARIOS = {
    ICE_AGE:    { ppm: 240, label: "ICE AGE [50,000 BCE]",       tempOffset: -8   },
    ROMAN:      { ppm: 280, label: "ROMAN EMPIRE [0 CE]",         tempOffset:  0   },
    INDUSTRIAL: { ppm: 280, label: "INDUSTRIALIZATION [1850]",    tempOffset:  0   },
    SIXTIES:    { ppm: 310, label: "1960s",                       tempOffset:  1   },
    MODERN:     { ppm: 425, label: "TODAY [2026]",                tempOffset:  1.5 },
    FUTURE:     { ppm: 700, label: "FUTURE [2100]",               tempOffset:  4   },
};

/** Change this key to switch the starting scenario */
export const ACTIVE_SCENARIO = "MODERN";

// ── CO2 WARNING THRESHOLDS (ppm) ───────────────────────────────────────────────
export const CO2 = {
    CAUTION:   450,   // L1 — "Be careful, it's getting dangerous"
    WARNING:   500,   // L2 — "Climate destabilizing"
    DANGER:    600,   // L3 — "Critical CO2 levels"
    CRITICAL:  700,   // L4 — "Apocalyptic — the world is ending"
    MAX:      1200,   // Hard ceiling safety cap
};

// ── CO2 IMPACT PER ACTION (ppm delta) ─────────────────────────────────────────
// Positive = adds CO2,  Negative = removes CO2
//
// POTENTIAL pool — slow-release. Drains into global once per game-day.
// Reflects the real-world delay between action and atmospheric consequence.
// Players see the pending debt accumulate in the HUD and learn to anticipate it.
export const POTENTIAL = {
    COAL_ORE_MINED:        +5,   // Burning fossil fuel, released into air
    LOG_CUT_NATURAL:       +4,   // Living tree lost — oxygen sink removed
    CAMPFIRE_LIT:          +3,   // Open wood combustion
    FURNACE_PLACED:        +2,   // Industrial heat source
    COAL_BLOCK_PLACED:    +12,   // Dense fossil fuel — worst single action
    CONCRETE_PLACED:       +3,   // High embodied carbon in production
    SAPLING_PLANTED:       -4,   // Slow absorption as tree matures
    BONEMEAL_ON_SAPLING:   -2,   // Accelerated growth = faster absorption
};

// GLOBAL pool — immediate effect. Reserved for high-impact or infrastructural
// actions where the consequence is felt right away (policy-level changes).
export const GLOBAL = {
    SOLAR_INSTALLED:       -8,   // Clean energy infrastructure — instant offset
};

// ── PLAYER EFFECT THRESHOLDS ───────────────────────────────────────────────────
export const PLAYER_FX = {
    WEAKNESS_CO2:   450,   // Player becomes weaker
    SLOWNESS_CO2:   500,   // Player slows down
    NAUSEA_CO2:     700,   // Camera shake
    BLINDNESS_CO2:  750,   // Vision severely restricted
    TOXIC_CO2:      600,   // Player takes damage if not near trees
    ACID_RAIN_CO2:  600,   // Rain deals damage when exposed to sky
};

// ── WORLD EFFECT THRESHOLDS ───────────────────────────────────────────────────
export const WORLD_FX = {
    ICE_MELT:         450,
    DESERTIFICATION:  480,
    DEFORESTATION:    500,
    ACID_RAIN:        600,
    WILDFIRE:         650,
    SEA_LEVEL_RISE:   650,
    CROP_INHIBIT:     550,   // Crops grow slower
    CROP_BLOCK:       700,   // Seeds cannot be planted
};

// ── HUNTER AI CONFIGURATION ───────────────────────────────────────────────────
export const HUNTER = {
    // Spawn conditions
    SPAWN_CO2:              400,    // CO2 level before the Hunter first appears

    // Distances (blocks)
    VIEW_DISTANCE:           20,    // How far from player he spawns
    SCARE_DISTANCE:           6,    // He vanishes if player gets this close
    HELP_DISTANCE:           15,    // Range in which he kills mobs "for you"

    // Timing (game ticks, 20 ticks = 1 second)
    COOLDOWN_TICKS:         600,    // Min ticks between appearances (~30s)
    MAX_STALK_TICKS:        500,    // Max ticks he lingers before vanishing
    UPDATE_INTERVAL:         40,    // Ticks between hunter AI updates (~2s)
    JOURNAL_COOLDOWN:      1200,    // Min ticks between journal drops (~1min)

    // Good ending
    GOOD_CO2_THRESHOLD:     360,    // CO2 must stay below this for good ending tracking
    GOOD_TICKS_NEEDED:    12000,    // Ticks of good behavior needed (~10 real minutes)

    // Total journals (not counting the final ending journal)
    JOURNAL_COUNT:            8,
};

// ── WORLD SCAN PARAMETERS ─────────────────────────────────────────────────────
export const SCAN = {
    SAMPLES_PER_TICK:  500,    // Random blocks checked per apocalypse tick
    RADIUS:             80,    // Horizontal scan radius (blocks) around player
    HEIGHT_RANGE:       40,    // Vertical scan range (blocks)
    SEA_RISE_INTERVAL: 2400,   // Ticks between sea level rise events (~2 min)
    ACID_SCAN_COUNT:    30,    // Block samples checked per acid rain tick
    SEA_LEVEL:          63,    // Standard Minecraft sea level
};
