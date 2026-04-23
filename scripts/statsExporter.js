import { world, system } from "@minecraft/server";
import { SCENARIOS, ACTIVE_SCENARIO, LIVE_SYNC } from "./config.js";
import { co2 } from "./co2System.js";
import { score } from "./scoreSystem.js";
import { streak } from "./streakSystem.js";
import { auth } from "./authSystem.js";

/**
 * StatsExporter  v3
 * ──────────────────
 * CODE FORMAT: 35 base-36 chars in 5 groups of 7
 *   XXXXXXX-XXXXXXX-XXXXXXX-XXXXXXX-XXXXXXX
 *
 *   [0]     sign (P/N)
 *   [1-4]   score          (4)
 *   [5-8]   co2            (4)
 *   [9-11]  badge mask     (3)
 *   [12]    journals       (1)
 *   [13]    scenario       (1)
 *   [14]    flags          (1)
 *   [15-16] saplings       (2)
 *   [17-18] solar          (2)
 *   [19-22] timestamp      (4)
 *   [23-26] token hash     (4)  — fnv32(PLAYER_TOKEN) mod 36^4
 *   [27-30] world fp       (4)  — fnv32(worldUUID+":"+token) mod 36^4
 *   [31-34] checksum       (4)  — fnv32(chars 0-30) mod 36^4
 */

export const WEBSITE_URL = "https://your-site.com";

const SCENARIO_KEYS = Object.keys(SCENARIOS);
const EPOCH_REF     = 473352; // hours since 2024-01-01

export class StatsExporter {
    constructor() { this._shownOnLoad = false; }

    showOnLoad() {
        if (this._shownOnLoad) return;
        system.runTimeout(() => {
            if (score._ready && auth._ready) {
                this._shownOnLoad = true;
                this._display();
            }
        }, 300);
    }

    tickDaily() {
        if (score._ready && auth._ready) this._display();
    }

    generateCode() {
        try {
            return _encode({
                score:       Math.floor(score.value),
                co2:         Math.floor(co2.global),
                badgeMask:   _badgeMask(),
                journals:    Math.min(score.journalsFound, 8),
                scenarioIdx: Math.max(0, SCENARIO_KEYS.indexOf(ACTIVE_SCENARIO)),
                flags:       _flags(),
                saplings:    Math.min(score.saplingsPlanted, 1295),
                solar:       Math.min(score.solarInstalled,  1295),
                tsHours:     _nowHours(),
                tokenHash:   auth.tokenHashVal,
                worldFp:     auth.worldFpVal,
            });
        } catch (_) { return null; }
    }

    _display() {
        const code = this.generateCode();
        if (!code) return;
        const rank = _rankTitle(score.value);

        world.sendMessage("§8§m───────────────────────────────────────────────");
        world.sendMessage(`§6§l  📊 Daily Stats  ${auth.isLinked ? "§a✓ World Linked" : "§c⚠ Not Linked"}`);
        world.sendMessage(`§7  Rank: §f${rank.icon} ${rank.title}   §7Streak: §6🔥${streak.days}`);
        world.sendMessage(`§7  Score: §e${Math.floor(score.value)}  §8|  §7CO₂: §c${Math.floor(co2.global)}ppm`);
        if (!auth.isLinked) {
            world.sendMessage(`§c  Register at ${WEBSITE_URL} to join the leaderboard.`);
            world.sendMessage(`§c  Then set PLAYER_TOKEN in config.js.`);
        } else {
            world.sendMessage(`§7  Code: §b${code}`);
            world.sendMessage(`§7  Submit: §3${WEBSITE_URL}`);
        }
        world.sendMessage("§8§m───────────────────────────────────────────────");

        if (LIVE_SYNC.ENABLED && auth.isLinked) _livePost(code, score.value, co2.global);
    }
}

// ── CODEC ─────────────────────────────────────────────────────────────────────

function _encode(d) {
    const sign = d.score >= 0 ? 'P' : 'N';
    const b36  = (n, w) => Math.max(0, Math.floor(n)).toString(36).toUpperCase().padStart(w, '0');
    const raw  = [
        sign,
        b36(Math.abs(d.score),    4),
        b36(d.co2,                4),
        b36(d.badgeMask,          3),
        b36(d.journals,           1),
        b36(d.scenarioIdx,        1),
        b36(d.flags,              1),
        b36(d.saplings,           2),
        b36(d.solar,              2),
        b36(d.tsHours % 1679616,  4),
        b36(d.tokenHash,          4),
        b36(d.worldFp,            4),
    ].join(''); // 31 chars

    const cs   = _fnv32(raw);
    const full = raw + b36(cs, 4); // 35 chars
    // Format: 5 groups of 7
    return `${full.slice(0,7)}-${full.slice(7,14)}-${full.slice(14,21)}-${full.slice(21,28)}-${full.slice(28)}`;
}

function _fnv32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = ((h * 0x01000193) >>> 0);
    }
    return h % 1679616;
}

function _nowHours() { return Math.floor(Date.now() / 3600000) - EPOCH_REF; }

function _badgeMask() {
    const ids = [
        "first_sapling","solar_pioneer","archivist","keeper","survivor",
        "good_ending","full_archive","ten_saplings","five_solar",
        "streak_7","streak_14","combo_fire","score_500","score_1000","score_2500","recovered"
    ];
    return ids.reduce((m, id, i) => m | (score.hasBadge(id) ? (1 << i) : 0), 0);
}

function _flags() {
    return (score.hasBadge("good_ending")  ? 1 : 0)
         | (score.hasBadge("full_archive") ? 2 : 0)
         | (streak.days >= 7              ? 4 : 0);
}

function _rankTitle(s) {
    if (s >= 5000) return { icon:"🌟", title:"Climate Hero" };
    if (s >= 2500) return { icon:"🌍", title:"Guardian" };
    if (s >= 1000) return { icon:"🌿", title:"Activist" };
    if (s >= 500)  return { icon:"🌱", title:"Aware" };
    if (s >= 0)    return { icon:"💧", title:"Wanderer" };
    if (s >= -500) return { icon:"🌫",  title:"Indifferent" };
    return               { icon:"💀", title:"Climate Criminal" };
}

async function _livePost(code, scoreVal, co2Val) {
    try {
        const { HttpClient, HttpRequest, HttpRequestMethod, HttpHeader } =
            await import("@minecraft/server-net");
        const req = new HttpRequest(`${LIVE_SYNC.SERVER_URL}/api/live`);
        req.method  = HttpRequestMethod.Post;
        req.headers = [new HttpHeader("Content-Type","application/json"),
                       new HttpHeader("X-Secret", LIVE_SYNC.BDS_SECRET)];
        req.body    = JSON.stringify({ code, score: scoreVal, co2: co2Val, ts: Date.now() });
        await HttpClient.request(req);
    } catch (_) {}
}

export const statsExporter = new StatsExporter();
