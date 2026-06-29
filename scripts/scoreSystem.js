import { world, system } from "@minecraft/server";
import { SCORE, BADGES } from "./config.js";
import { co2 } from "./co2System.js";

export class ScoreSystem {
    constructor() {
        this.value           = 0;
        this._badgeCache     = new Map();
        this._ready          = false;
        this.saplingsPlanted = 0;   // Track count (badge only, no score on plant)
        this.saplingsMature  = 0;   // Score awarded on maturation
        this.solarInstalled  = 0;
        this.journalsFound   = 0;
        this._keeperTicks    = 0;
        this._survivorTicks  = 0;
        this._streakMult     = 1.0; // Set externally by streakSystem
    }

    /** @param {number} mult */
    setStreakMultiplier(mult) { this._streakMult = mult; }

    init() {
        system.runTimeout(() => {
            const saved = world.getDynamicProperty("score_total");
            if (saved !== undefined) this.value = /** @type {number} */ (saved);

            for (const badge of BADGES) {
                const earned = world.getDynamicProperty(`badge_${badge.id}`);
                this._badgeCache.set(badge.id, earned === true);
            }

            const sc = world.getDynamicProperty("score_saplings");
            const sm = world.getDynamicProperty("score_saplings_mature");
            const ss = world.getDynamicProperty("score_solar");
            const sj = world.getDynamicProperty("score_journals");
            if (sc !== undefined) this.saplingsPlanted = /** @type {number} */ (sc);
            if (sm !== undefined) this.saplingsMature  = /** @type {number} */ (sm);
            if (ss !== undefined) this.solarInstalled  = /** @type {number} */ (ss);
            if (sj !== undefined) this.journalsFound   = /** @type {number} */ (sj);

            this._ready = true;
        }, 80);
    }

    add(delta) {
        this.value = Math.round(this.value + delta);
        world.setDynamicProperty("score_total", this.value);
        this._checkScoreBadges();
    }

    tickPassive() {
        const level = co2.global;
        let base = 0;
        if      (level < 450) base = SCORE.PER_MIN_SAFE;
        else if (level < 500) base = SCORE.PER_MIN_CAUTION;
        else if (level < 600) base = SCORE.PER_MIN_WARNING;
        else if (level < 700) base = SCORE.PER_MIN_DANGER;
        else                  base = SCORE.PER_MIN_CRITICAL;

        // Apply streak multiplier only to positive ticks
        const delta = base > 0 ? base * this._streakMult : base;
        this.add(delta);

        if (level < 450) {
            this._keeperTicks++;
            if (this._keeperTicks >= 300) this.awardBadge("keeper");
        } else {
            this._keeperTicks = Math.max(0, this._keeperTicks - 20);
        }
    }

    tickSurvivor() {
        if (co2.global > 600) {
            this._survivorTicks++;
            if (this._survivorTicks >= 60) this.awardBadge("survivor");
        } else {
            this._survivorTicks = 0;
        }
    }

    awardBadge(id) {
        if (this._badgeCache.get(id)) return;
        const badge = BADGES.find(b => b.id === id);
        if (!badge) return;

        this._badgeCache.set(id, true);
        world.setDynamicProperty(`badge_${id}`, true);
        this.add(SCORE.BADGE_BONUS);

        for (const player of world.getAllPlayers()) {
            try {
                player.onScreenDisplay.setTitle(`${badge.label}`, {
                    subtitle: badge.desc, fadeInDuration: 5, stayDuration: 70, fadeOutDuration: 15,
                });
                player.dimension.playSound("random.levelup", player.location, { volume: 0.7, pitch: 1.3 });
            } catch (_) {}
        }
    }

    hasBadge(id) { return this._badgeCache.get(id) === true; }

    // ── Event hooks ───────────────────────────────────────────────────────────

    /** Called when a sapling is placed — track count for badges only. */
    onSaplingPlanted() {
        this.saplingsPlanted++;
        world.setDynamicProperty("score_saplings", this.saplingsPlanted);
        if (this.saplingsPlanted === 1) this.awardBadge("first_sapling");
    }

    /** Called by saplingSystem when a sapling actually matures. */
    onSaplingMatured() {
        this.saplingsMature++;
        world.setDynamicProperty("score_saplings_mature", this.saplingsMature);
        this.add(SCORE.SAPLING_MATURED);
        if (this.saplingsMature >= 10) this.awardBadge("ten_saplings");
    }

    onSolarInstalled() {
        this.add(SCORE.SOLAR_INSTALLED);
        this.solarInstalled++;
        world.setDynamicProperty("score_solar", this.solarInstalled);
        if (this.solarInstalled === 1)  this.awardBadge("solar_pioneer");
        if (this.solarInstalled >= 5)   this.awardBadge("five_solar");
    }

    onJournalFound() {
        this.add(SCORE.JOURNAL_FOUND);
        this.journalsFound++;
        world.setDynamicProperty("score_journals", this.journalsFound);
        if (this.journalsFound === 1)   this.awardBadge("archivist");
        if (this.journalsFound >= 8)    this.awardBadge("full_archive");
    }

    onLogCut()    { this.add(SCORE.LOG_CUT);    }
    onCoalMined() { this.add(SCORE.COAL_MINED); }
    onCoalBlock() { this.add(SCORE.COAL_BLOCK); }
    onGoodEnding() { this.add(SCORE.GOOD_ENDING); this.awardBadge("good_ending"); }

    get formatted() {
        const n = Math.floor(this.value);
        return (n < 0 ? "-" : "") + Math.abs(n).toLocaleString();
    }

    get hudStr() {
        const n = Math.floor(this.value);
        const c = n >= 1000 ? "§a" : n >= 0 ? "§e" : n >= -200 ? "§6" : "§c";
        return `${c}${this.formatted}`;
    }

    _checkScoreBadges() {
        if (this.value >= 500)  this.awardBadge("score_500");
        if (this.value >= 1000) this.awardBadge("score_1000");
        if (this.value >= 2500) this.awardBadge("score_2500");
    }
}

export const score = new ScoreSystem();
