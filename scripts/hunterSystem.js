import { world, system, ItemStack } from "@minecraft/server";
import { HUNTER, CO2 as CO2_THRESHOLDS } from "./config.js";
import { co2 } from "./co2System.js";
import { score } from "./scoreSystem.js";
import { advisor } from "./advisorSystem.js";
import {
    JOURNALS,
    GOOD_ENDING_JOURNAL,
    BAD_ENDING_JOURNAL,
    STALK_MESSAGES,
    VANISH_MESSAGES,
    GOOD_END_RADIO,
    BAD_END_HALLUCINATIONS,
} from "./journals.js";

// ── HUNTER PHASES ────────────────────────────────────────────────────────────
const PHASE = {
    DORMANT:   "dormant",   // CO2 too low — not active
    WATCHING:  "watching",  // CO2 ≥ 400 — watches from a distance, barely seen
    STALKING:  "stalking",  // CO2 ≥ 450 — active lurking, sets traps
    HUNTING:   "hunting",   // CO2 ≥ 500 — aggressive, occasionally helps vs mobs
    GOOD_END:  "good_end",  // Player earned the good ending
    BAD_END:   "bad_end",   // CO2 ≥ 700 — final confrontation
};

/**
 * HunterSystem
 * ─────────────
 * Full state machine for the Hunter NPC. Manages:
 *   - Phase transitions based on CO2 and player behavior
 *   - Spawn / vanish logic
 *   - Sequential journal drops with loot
 *   - Good / bad ending tracking and triggers
 *   - Atmospheric messages, mob-help behavior
 *   - Post-ending radio transmissions
 */
export class HunterSystem {
    constructor() {
        this.HUNTER_TAG      = "the_hunter";
        this.BOSS_TAG        = "hunter_boss";
        this.phase           = PHASE.DORMANT;

        this.cooldownTicks   = 0;
        this.stalkTimer      = 0;
        this.goodTicks       = 0;
        this.journalCooldown = 0;
        this._hallucinationCooldown = 0; // Post-bad-ending

        this.journalIndex    = 0;
        this.goodEndingDone  = false;
        this.badEndingDone   = false;
    }

    /** Load saved hunter state. Call once at world start. */
    init() {
        system.runTimeout(() => {
            const j = world.getDynamicProperty("hunter_journal_idx");
            const g = world.getDynamicProperty("hunter_good_ending");
            const b = world.getDynamicProperty("hunter_bad_ending");
            if (j !== undefined) this.journalIndex   = /** @type {number}  */ (j);
            if (g !== undefined) this.goodEndingDone  = /** @type {boolean} */ (g);
            if (b !== undefined) this.badEndingDone   = /** @type {boolean} */ (b);
        }, 60);
    }

    // ── MAIN UPDATE LOOP (called every HUNTER.UPDATE_INTERVAL ticks) ──────────
    update() {
        if (this.journalCooldown > 0) this.journalCooldown--;
        if (this.cooldownTicks > 0) { this.cooldownTicks--; return; }

        const players = world.getAllPlayers();
        if (players.length === 0) return;

        const level = co2.global;
        this._updateGoodTicks(level);
        this._updatePhase(level);
        this._runPhase(players);

        // Notify advisor whether hunter is actively present
        const isActive = this.phase !== PHASE.DORMANT && this.phase !== PHASE.GOOD_END;
        advisor.setHunterActive(isActive);

        // Post-bad-ending hallucinations
        if (this.badEndingDone) this._tickHallucinations();
    }

    // ── PHASE LOGIC ───────────────────────────────────────────────────────────

    _updateGoodTicks(level) {
        if (level < HUNTER.GOOD_CO2_THRESHOLD) {
            this.goodTicks++;
        } else {
            // Decay faster than it accumulates — can't "cheat" by briefly dipping
            this.goodTicks = Math.max(0, this.goodTicks - 3);
        }

        // Trigger good ending once threshold is reached
        if (!this.goodEndingDone && this.goodTicks >= HUNTER.GOOD_TICKS_NEEDED) {
            this._triggerGoodEnding(world.getAllPlayers());
        }
    }

    _updatePhase(level) {
        if (this.goodEndingDone)  { this.phase = PHASE.GOOD_END; return; }
        if (this.badEndingDone)   { this.phase = PHASE.BAD_END;  return; }

        if (level >= CO2_THRESHOLDS.CRITICAL) {
            if (this.phase !== PHASE.BAD_END) this._triggerBadEnding(world.getAllPlayers());
        } else if (level >= CO2_THRESHOLDS.WARNING) {
            this.phase = PHASE.HUNTING;
        } else if (level >= CO2_THRESHOLDS.CAUTION) {
            this.phase = PHASE.STALKING;
        } else if (level >= HUNTER.SPAWN_CO2) {
            this.phase = PHASE.WATCHING;
        } else {
            this.phase = PHASE.DORMANT;
        }
    }

    _runPhase(players) {
        switch (this.phase) {
            case PHASE.DORMANT:  this._doPhaseDormant(players);  break;
            case PHASE.WATCHING: this._doPhaseWatching(players); break;
            case PHASE.STALKING: this._phaseStalking(players);   break;
            case PHASE.HUNTING:  this._phaseHunting(players);    break;
            case PHASE.GOOD_END: this._phaseGoodEnd(players);    break;
            case PHASE.BAD_END:  /* handled by trigger, no repeat */ break;
        }
    }

    // ── DORMANT ───────────────────────────────────────────────────────────────
    _doPhaseDormant(players) {
        const hunter = this._findHunter(players);
        if (hunter) this._vanish(hunter, VANISH_MESSAGES.WATCHING);
    }

    // ── WATCHING ──────────────────────────────────────────────────────────────
    _doPhaseWatching(players) {
        let hunter = this._findHunter(players);

        if (!hunter) {
            // 8% chance to materialize per update cycle
            if (Math.random() < 0.08) {
                const p = this._randomPlayer(players);
                hunter  = this._spawn(p, HUNTER.VIEW_DISTANCE + 10);
                if (hunter) world.sendMessage("§8Something is watching from the treeline.");
            }
            return;
        }

        // Emit atmospheric messages occasionally
        if (Math.random() < 0.015) {
            world.sendMessage(this._pick(STALK_MESSAGES));
        }

        this._advanceStalkTimer(hunter, players, VANISH_MESSAGES.EXPIRE);
    }

    // ── STALKING ──────────────────────────────────────────────────────────────
    _phaseStalking(players) {
        let hunter = this._findHunter(players);

        if (!hunter) {
            if (Math.random() < 0.2) {
                const p = this._randomPlayer(players);
                hunter  = this._spawn(p, HUNTER.VIEW_DISTANCE);
                if (hunter) world.sendMessage("§7[!] A cold chill runs down your spine.");
            }
            return;
        }

        this._advanceStalkTimer(hunter, players, VANISH_MESSAGES.STANDARD);
    }

    // ── HUNTING ───────────────────────────────────────────────────────────────
    _phaseHunting(players) {
        let hunter = this._findHunter(players);

        if (!hunter) {
            if (Math.random() < 0.35) {
                const p = this._randomPlayer(players);
                // Closer spawn in hunting phase — he's getting impatient
                hunter  = this._spawn(p, HUNTER.VIEW_DISTANCE - 5);
                if (hunter) world.sendMessage("§c[!] A dark figure steps out of the haze.");
            }
            return;
        }

        // Occasionally eliminate nearby mobs — he's protecting his prey
        if (Math.random() < 0.004) {
            this._helpKillMob(hunter, players);
        }

        this._advanceStalkTimer(hunter, players, VANISH_MESSAGES.STANDARD);
    }

    // ── GOOD ENDING (post-resolution) ─────────────────────────────────────────
    _phaseGoodEnd(players) {
        // Occasionally transmit radio messages — he made it back
        if (Math.random() < 0.0008) {
            world.sendMessage(this._pick(GOOD_END_RADIO));
        }
    }

    // ── CORE STALK LOOP ───────────────────────────────────────────────────────
    /**
     * Ticks the stalk timer, faces the hunter toward the nearest player,
     * and checks escape/timeout conditions.
     */
    _advanceStalkTimer(hunter, players, expireMsg) {
        if (!hunter?.isValid()) return;
        this.stalkTimer++;

        const { player: closest, dist } = this._closestPlayer(hunter, players);
        if (!closest) return;

        // Always face the player — eerie, unblinking
        try {
            hunter.teleport(hunter.location, { facingLocation: closest.location });
        } catch (_) {}

        // Player got too close — hunter vanishes to stay elusive
        if (dist < HUNTER.SCARE_DISTANCE) {
            this._vanish(hunter, VANISH_MESSAGES.TOO_CLOSE);
            this._startCooldown();
            return;
        }

        // Player moved too far — no point continuing this encounter
        if (dist > HUNTER.VIEW_DISTANCE + 18) {
            this._vanish(hunter, expireMsg);
            this._startCooldown();
            return;
        }

        // Stalk timed out
        if (this.stalkTimer > HUNTER.MAX_STALK_TICKS) {
            this._vanish(hunter);
            this._startCooldown();
        }
    }

    // ── ENDINGS ───────────────────────────────────────────────────────────────

    _triggerGoodEnding(players) {
        this.goodEndingDone = true;
        world.setDynamicProperty("hunter_good_ending", true);
        this.phase = PHASE.GOOD_END;

        const hunter = this._findHunter(players);
        if (hunter) this._vanish(hunter);

        score.onGoodEnding();

        const target = players[0];
        if (target) {
            this._displayJournal(GOOD_ENDING_JOURNAL);
            this._dropLoot(target.location, target.dimension, GOOD_ENDING_JOURNAL);
            score.onJournalFound();
        }

        system.runTimeout(() => {
            world.sendMessage("§a§l The Hunter: '...Maybe you are the cure. Not the virus.'");
        }, 40);

        system.runTimeout(() => {
            world.sendMessage(
                "§7[A final journal lands at your feet. The Hunter steps backward " +
                "into a shimmer of cold light... and is gone.]"
            );
        }, 100);
    }

    _triggerBadEnding(players) {
        this.badEndingDone = true;
        world.setDynamicProperty("hunter_bad_ending", true);
        this.phase = PHASE.BAD_END;

        this._displayJournal(BAD_ENDING_JOURNAL);
        score.onJournalFound();

        system.runTimeout(() => {
            world.sendMessage("§4§l The Hunter: 'I gave you every chance. Now it ends.'");
        }, 60);

        system.runTimeout(() => {
            for (const p of players) this._spawn(p, 8, true);
        }, 120);
    }

    // ── JOURNAL SYSTEM ────────────────────────────────────────────────────────

    /**
     * Called when a player defeats (hits) the Hunter.
     * Drops the next sequential journal entry and loot, then vanishes.
     * @param {import("@minecraft/server").Entity} hunter
     */
    onHunterDefeated(hunter) {
        if (this.journalCooldown > 0) {
            // Journal on cooldown — just vanish
            this._vanish(hunter, VANISH_MESSAGES.HIT);
            this._startCooldown();
            return;
        }

        // Drop the next journal (cap before the final good-ending journal)
        const idx = Math.min(this.journalIndex, JOURNALS.length - 1);
        const journal = JOURNALS[idx];

        if (journal) {
            const players = world.getAllPlayers();
            const target  = players[0];
            if (target) {
                this._displayJournal(journal);
                this._dropLoot(hunter.location, hunter.dimension, journal);
                score.onJournalFound();
            }

            this.journalIndex++;
            world.setDynamicProperty("hunter_journal_idx", this.journalIndex);
            this.journalCooldown = HUNTER.JOURNAL_COOLDOWN;
        }

        this._vanish(hunter, VANISH_MESSAGES.HIT);
        this._startCooldown();
    }

    /** Display journal text to all players via chat. */
    _displayJournal(journal) {
        const separator = "§8§m                                              ";
        system.runTimeout(() => { world.sendMessage(separator); }, 10);
        system.runTimeout(() => { world.sendMessage(`§6§l  📖 ${journal.title}`); }, 20);
        system.runTimeout(() => { world.sendMessage(separator); }, 30);

        const lines = journal.text.split("\n");
        let delay = 40;
        for (const line of lines) {
            const l = line;
            system.runTimeout(() => {
                world.sendMessage(l.trim() === "" ? "§r" : `§7  ${l}`);
            }, delay);
            delay += 5;
        }
        system.runTimeout(() => { world.sendMessage(separator); }, delay + 10);
    }

    /** Drop physical loot items at a location. */
    _dropLoot(location, dimension, journal) {
        if (!journal.loot) return;
        for (let i = 0; i < journal.loot.length; i++) {
            const itemId = journal.loot[i];
            const count  = journal.lootCount ? (journal.lootCount[i] ?? 1) : 1;
            try {
                dimension.spawnItem(new ItemStack(itemId, count), location);
            } catch (_) {}
        }
    }

    // ── SPAWN / VANISH ────────────────────────────────────────────────────────

    /**
     * Spawn the Hunter at a random angle around a player.
     * @param {import("@minecraft/server").Player} player
     * @param {number} distance
     * @param {boolean} [isBoss=false]
     * @returns {import("@minecraft/server").Entity|null}
     */
    _spawn(player, distance, isBoss = false) {
        const angle = Math.random() * Math.PI * 2;
        const tx    = player.location.x + Math.cos(angle) * distance;
        const tz    = player.location.z + Math.sin(angle) * distance;

        // Precision ground scan — find the top surface block
        let spawnY = player.location.y;
        try {
            const ray = player.dimension.getBlockFromRay(
                { x: tx, y: player.location.y + 20, z: tz },
                { x: 0, y: -1, z: 0 },
                { maxDistance: 40 }
            );
            if (ray?.block) spawnY = ray.block.location.y + 1;
        } catch (_) {}

        const spawnPos = { x: tx, y: spawnY, z: tz };

        try {
            const hunter = player.dimension.spawnEntity("minecraft:stray", spawnPos);
            hunter.addTag(this.HUNTER_TAG);

            if (isBoss) {
                hunter.addTag(this.BOSS_TAG);
                hunter.nameTag = "§4§l⚠ The Hunter ⚠";
                hunter.addEffect("strength",    99999, { amplifier: 5, showParticles: true  });
                hunter.addEffect("resistance",  99999, { amplifier: 4, showParticles: false });
                hunter.addEffect("speed",       99999, { amplifier: 2, showParticles: false });
            } else {
                hunter.nameTag = "§8The Hunter";
                // Slowness 255 = locked in place — he stalks by teleportation only
                hunter.addEffect("slowness", 99999, { amplifier: 255, showParticles: false });
            }

            hunter.addEffect("fire_resistance", 99999, { showParticles: false });

            // Snap to ground 1 tick after spawn
            system.run(() => {
                if (hunter.isValid()) hunter.teleport(hunter.location, { keepVelocity: false });
            });

            this.stalkTimer = 0;
            return hunter;
        } catch (_) {
            return null; // Chunk likely not loaded
        }
    }

    /**
     * Remove the hunter with a dramatic smoke-and-sound effect.
     * @param {import("@minecraft/server").Entity} entity
     * @param {string} [message=""]
     */
    _vanish(entity, message = "") {
        if (!entity?.isValid()) return;
        const dim = entity.dimension;
        const loc = entity.location;

        try {
            dim.spawnParticle("minecraft:large_smoke_puff", loc);
            dim.playSound("mob.enderman.portal", loc, { volume: 1.0, pitch: 0.75 });
        } catch (_) {}

        if (message) world.sendMessage(message);
        try { entity.remove(); } catch (_) {}
    }

    // ── POST-BAD-ENDING HALLUCINATIONS ───────────────────────────────────────
    /**
     * After the bad ending, the world never fully feels safe again.
     * No Hunter spawns — just atmospheric chat messages that suggest his presence.
     * Fires every 3–8 minutes randomly.
     */
    _tickHallucinations() {
        if (this._hallucinationCooldown > 0) {
            this._hallucinationCooldown--;
            return;
        }
        if (Math.random() > 0.004) return; // ~0.4% chance per update tick

        world.sendMessage(this._pick(BAD_END_HALLUCINATIONS));

        // Random cooldown: 3–8 minutes (in update ticks at 40ms each)
        const minTicks  = (3 * 60 * 1000) / 40;
        const maxTicks  = (8 * 60 * 1000) / 40;
        this._hallucinationCooldown = Math.floor(minTicks + Math.random() * (maxTicks - minTicks));
    }

    // ── MOB HELP ─────────────────────────────────────────────────────────────
    _helpKillMob(hunter, players) {
        if (!hunter?.isValid()) return;
        const { player: p } = this._closestPlayer(hunter, players);
        if (!p || p.dimension.id !== hunter.dimension.id) return;

        const HOSTILE = ["minecraft:zombie", "minecraft:skeleton", "minecraft:creeper",
                         "minecraft:spider", "minecraft:witch", "minecraft:drowned"];

        const entities = p.dimension.getEntities({
            location: p.location,
            maxDistance: HUNTER.HELP_DISTANCE,
            excludeTags: [this.HUNTER_TAG],
        });

        for (const mob of entities) {
            if (HOSTILE.includes(mob.typeId)) {
                try {
                    mob.kill();
                    world.sendMessage(VANISH_MESSAGES.MOB_KILL);
                } catch (_) {}
                break;
            }
        }
    }

    // ── HELPERS ───────────────────────────────────────────────────────────────

    /** Find an active hunter entity in any player's dimension. */
    _findHunter(players) {
        for (const p of players) {
            const found = p.dimension.getEntities({
                typeId: "minecraft:stray",
                tags:   [this.HUNTER_TAG],
            })[0];
            if (found?.isValid()) return found;
        }
        return null;
    }

    /** Find the player closest to a given entity. */
    _closestPlayer(entity, players) {
        let closest = null;
        let minDist = Infinity;
        for (const p of players) {
            if (p.dimension.id !== entity.dimension.id) continue;
            const d = this._dist(entity.location, p.location);
            if (d < minDist) { minDist = d; closest = p; }
        }
        return { player: closest, dist: minDist };
    }

    _randomPlayer(players) {
        return players[Math.floor(Math.random() * players.length)];
    }

    _startCooldown() {
        this.stalkTimer     = 0;
        this.cooldownTicks  = HUNTER.COOLDOWN_TICKS;
    }

    _dist(a, b) {
        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
    }

    _pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}

export const hunterSystem = new HunterSystem();
