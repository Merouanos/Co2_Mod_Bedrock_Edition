/**
 * ══════════════════════════════════════════════════════════
 *  THE HUNTER — JOURNAL ENTRIES
 *
 *  Text fields are intentionally left blank.
 *  Fill in your own story under each entry.
 *  Titles, loot, and structure are all set and ready.
 *
 *  Story beats (suggested arc):
 *   01 — First contact. Cold. Mysterious. A warning.
 *   02 — The world he came from.
 *   03 — Her. The woman he never spoke to.
 *   04 — The machine. How he got here.
 *   05 — The math. Why you were chosen.
 *   06 — Doubt. Your actions surprised him.
 *   07 — Fractures. The paradox is breaking him.
 *   08 — The last variable. Wrong question all along.
 *   GOOD — He lets you go. You are the cure.
 *   BAD  — No more patience. It ends now.
 * ══════════════════════════════════════════════════════════
 */

export const JOURNALS = [
    {
        title: "Entry 001",
        text: `[Write your story here]`,
        loot: ["minecraft:iron_ingot", "minecraft:golden_apple"],
        lootCount: [3, 1],
    },
    {
        title: "Entry 002",
        text: `[Write your story here]`,
        loot: ["minecraft:diamond", "minecraft:ender_pearl"],
        lootCount: [2, 2],
    },
    {
        title: "Entry 003",
        text: `[Write your story here]`,
        loot: ["minecraft:book", "minecraft:compass"],
        lootCount: [1, 1],
    },
    {
        title: "Entry 004",
        text: `[Write your story here]`,
        loot: ["minecraft:clock", "minecraft:redstone_block"],
        lootCount: [1, 2],
    },
    {
        title: "Entry 005",
        text: `[Write your story here]`,
        loot: ["minecraft:experience_bottle", "minecraft:name_tag"],
        lootCount: [5, 1],
    },
    {
        title: "Entry 006",
        text: `[Write your story here]`,
        loot: ["minecraft:totem_of_undying"],
        lootCount: [1],
    },
    {
        title: "Entry 007",
        text: `[Write your story here]`,
        loot: ["minecraft:elytra", "minecraft:phantom_membrane"],
        lootCount: [1, 4],
    },
    {
        title: "Entry 008",
        text: `[Write your story here]`,
        loot: ["minecraft:netherite_ingot", "minecraft:recovery_compass"],
        lootCount: [1, 1],
    },
];

// ── GOOD ENDING JOURNAL ───────────────────────────────────────────────────────
export const GOOD_ENDING_JOURNAL = {
    title: "Final Entry — The Cure",
    text: `[Write your good ending here]`,
    loot: [
        "minecraft:netherite_sword",
        "minecraft:totem_of_undying",
        "minecraft:diamond_chestplate",
        "minecraft:recovery_compass",
        "minecraft:elytra",
    ],
    lootCount: [1, 2, 1, 1, 1],
};

// ── BAD ENDING JOURNAL ────────────────────────────────────────────────────────
export const BAD_ENDING_JOURNAL = {
    title: "Final Entry — No More Time",
    text: `[Write your bad ending here]`,
};

// ── ATMOSPHERIC MESSAGES ──────────────────────────────────────────────────────
// Shown in chat while the Hunter is lurking. Build dread without explaining.
export const STALK_MESSAGES = [
    "§8A distant figure stands perfectly still on the ridge...",
    "§8You hear footsteps behind you. When you turn, nothing is there.",
    "§8Something moved at the edge of your vision.",
    "§8The birds went quiet a moment ago. They're still quiet.",
    "§7You feel watched.",
    "§8There are boot prints near your base that weren't there before.",
    "§8A low mechanical hum echoes from somewhere underground.",
    "§8You could swear the shadows moved.",
    "§8A trap. Carefully placed. Not by an animal.",
    "§8Something has been watching your base. The signs are everywhere.",
];

export const VANISH_MESSAGES = {
    STANDARD:  "§8The Hunter dissolved into shadow...",
    TOO_CLOSE: "§7The Hunter: '...Not yet.'",
    EXPIRE:    "§8The figure was gone before you could reach it.",
    HIT:       "§c§lThe Hunter: '7 minutes is all I can spare...'",
    WATCHING:  "§8He was here. He's not anymore.",
    MOB_KILL:  "§8[Something killed it. Whatever it was, it wasn't for your benefit.]",
};

// ── POST GOOD-ENDING RADIO ────────────────────────────────────────────────────
// Occasional transmissions after the good ending resolves.
export const GOOD_END_RADIO = [
    "§7[Static] ...still out there. Watching differently now.",
    "§7[Static] ...the trees you planted. I counted them.",
    "§7[Static] The equations were wrong about you.",
    "§7[Static] She would have liked you. I think.",
    "§7[Static] ...it's a lighter shade of orange up here. Maybe.",
];

// ── POST BAD-ENDING HALLUCINATIONS ───────────────────────────────────────────
// After the bad ending, the player occasionally sees/hears phantom Hunter signs.
// No Hunter spawns — just atmosphere. Pure psychological aftermath.
export const BAD_END_HALLUCINATIONS = [
    "§8You see a figure on the hill. When you look again, nothing.",
    "§4Something is behind you.",
    "§8His voice, just at the edge of hearing: '...I warned you.'",
    "§4The smoke. The smell of it. Where is it coming from?",
    "§8Footsteps. Measured. Deliberate. Gone.",
    "§4You are not safe here.",
];
