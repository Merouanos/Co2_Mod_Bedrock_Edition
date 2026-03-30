/**
 * ══════════════════════════════════════════════════════════
 *  THE HUNTER — JOURNAL ENTRIES
 *  Dropped sequentially each time the player defeats him.
 *  The story builds from mystery → tragedy → doubt → resolution.
 * ══════════════════════════════════════════════════════════
 *
 *  Story arc:
 *   01 — First contact. He's watching. Mysterious, cold.
 *   02 — The world he left. A dying planet.
 *   03 — Her. The woman he loved in silence.
 *   04 — The machine. How he got here.
 *   05 — The science. Probability and cold equations.
 *   06 — Doubt. The player's actions surprised him.
 *   07 — Fractures. The paradox is eating him alive.
 *   08 — The last variable. He's solving the wrong problem.
 *   GOOD: He lets go. The cure, not the virus.
 *   BAD:  He breaks. The final confrontation begins.
 */

export const JOURNALS = [
    // ── JOURNAL 1 ─────────────────────────────────────────
    {
        title: "Entry 001  ·  First Contact",
        text: `If you're reading this, I let you find it.

 Entry 001 story

                                                          — T.H.`,
        loot: ["minecraft:iron_ingot", "minecraft:golden_apple"],
        lootCount: [3, 1],
    },

    // ── JOURNAL 2 ─────────────────────────────────────────
    {
        title: "Entry 002  ·  The World I Left",
        text: `The sky isn't blue anymore.
Entry 02 story.

                                                          — T.H.`,
        loot: ["minecraft:diamond", "minecraft:ender_pearl"],
        lootCount: [2, 2],
    },

    // ── JOURNAL 3 ─────────────────────────────────────────
    {
        title: "Entry 003  ·  Her",
        text: `I never spoke to her. Not once. Not even once.

Entry 03 story.

                                                          — T.H.`,
        loot: ["minecraft:book", "minecraft:compass"],
        lootCount: [1, 1],
    },

    // ── JOURNAL 4 ─────────────────────────────────────────
    {
        title: "Entry 004  ·  The Machine",
        text: `I built it in fourteen months.
Entry 04 story.

                                                          — T.H.`,
        loot: ["minecraft:clock", "minecraft:redstone_block"],
        lootCount: [1, 2],
    },

    // ── JOURNAL 5 ─────────────────────────────────────────
    {
        title: "Entry 005  ·  The Math",
        text: `My models identified twelve key individuals.
Entry 05 story.

                                                          — T.H.`,
        loot: ["minecraft:experience_bottle", "minecraft:name_tag"],
        lootCount: [5, 1],
    },

    // ── JOURNAL 6 ─────────────────────────────────────────
    {
        title: "Entry 006  ·  Doubt",
        text: `I've been watching you longer than I planned.

Entry 06 story.

                                                          — T.H.`,
        loot: ["minecraft:totem_of_undying"],
        lootCount: [1],
    },

    // ── JOURNAL 7 ─────────────────────────────────────────
    {
        title: "Entry 007  ·  Fractures",
        text: `The paradox equations are destabilizing.

Entry 07 story.

                                                          — T.H.`,
        loot: ["minecraft:elytra", "minecraft:phantom_membrane"],
        lootCount: [1, 4],
    },

    // ── JOURNAL 8 ─────────────────────────────────────────
    {
        title: "Entry 008  ·  The Last Variable",
        text: `I have not eaten in three days.
Entry 08 story.

                                                          — T.H.`,
        loot: ["minecraft:netherite_ingot", "minecraft:recovery_compass"],
        lootCount: [1, 1],
    },
];

// ── GOOD ENDING JOURNAL ────────────────────────────────────────────────────────
// Triggered when the player maintains low CO2 long enough — not by defeating him.
export const GOOD_ENDING_JOURNAL = {
    title: "Entry 009  ·  The Cure",
    text: `Maybe you are the cure. Not the virus.

Good ending.

                                                          — T.H.

[The page smells faintly of smoke and something like pine.]`,
    loot: [
        "minecraft:netherite_sword",
        "minecraft:totem_of_undying",
        "minecraft:diamond_chestplate",
        "minecraft:recovery_compass",
        "minecraft:elytra",
    ],
    lootCount: [1, 2, 1, 1, 1],
};

// ── BAD ENDING TRIGGER MESSAGE ─────────────────────────────────────────────────
export const BAD_ENDING_JOURNAL = {
    title: "Entry 009  ·  No More Time",
    text: `I gave you every chance.

Bad ending.

                                                          — T.H.`,
};

// ── ATMOSPHERIC MESSAGES ──────────────────────────────────────────────────────
// Shown randomly while the Hunter is lurking, to build dread.
export const STALK_MESSAGES = [
    "§8A distant figure stands perfectly still on the ridge...",
    "§8You hear footsteps behind you. When you turn, nothing is there.",
    "§8Something moved at the edge of your vision.",
    "§8The birds went quiet a moment ago. They're still quiet.",
    "§7You feel watched.",
    "§8There are boot prints near your base that weren't there before.",
    "§8A low hum — almost mechanical — echoes from somewhere underground.",
    "§8You could swear the shadows moved.",
];

export const VANISH_MESSAGES = {
    STANDARD:  "§8The Hunter dissolved into shadow...",
    TOO_CLOSE: "§7The Hunter: '...Not yet.'",
    EXPIRE:    "§8The figure was gone before you could reach it.",
    HIT:       "§c§lThe Hunter: '7 minutes is all I can spare...'",
    WATCHING:  "§8He was here. He's not anymore.",
};

export const GOOD_END_RADIO = [
    "§7[Radio Static] ...still watching. For different reasons now.",
    "§7[Radio Static] ...planted 847 trees in my first week back. Small things matter.",
    "§7[Radio Static] The sky is still orange. But it's a lighter shade.",
    "§7[Radio Static] I told her story to someone today. It helped.",
    "§7[Radio Static] I think... I think the model was wrong about a lot of things.",
];
