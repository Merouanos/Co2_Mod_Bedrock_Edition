import { world, system } from "@minecraft/server";
import { PLAYER_TOKEN, LIVE_SYNC } from "./config.js";

/**
 * AuthSystem
 * ──────────
 * Manages the World Identity that cryptographically binds this Minecraft
 * world to exactly one website account.
 *
 * On first run: generates a permanent worldUUID and derives two values:
 *   tokenHash  = fnv32(PLAYER_TOKEN)              mod 36^4
 *   worldFp    = fnv32(worldUUID + ":" + PLAYER_TOKEN) mod 36^4
 *
 * Both are embedded in every share code. The server checks:
 *   1. tokenHash matches the account's registered token
 *   2. worldFp matches the world fingerprint locked to that account
 *
 * If PLAYER_TOKEN is empty, tokenHash and worldFp are 0 — the server
 * will reject the submission but the mod still works normally.
 */
export class AuthSystem {
    constructor() {
        this.worldUUID   = "";
        this.tokenHash   = 0;
        this.worldFp     = 0;
        this.isLinked    = false;
        this._ready      = false;
    }

    init() {
        system.runTimeout(() => {
            // Load or generate permanent world UUID
            let uuid = world.getDynamicProperty("auth_world_uuid");
            if (!uuid || typeof uuid !== "string") {
                uuid = _genUUID();
                world.setDynamicProperty("auth_world_uuid", uuid);
            }
            this.worldUUID = uuid;

            if (PLAYER_TOKEN && PLAYER_TOKEN.startsWith("CO2-")) {
                this.tokenHash = _fnv32(PLAYER_TOKEN);
                this.worldFp   = _fnv32(uuid + ":" + PLAYER_TOKEN);
                this.isLinked  = true;
            } else {
                // Not configured — show setup hint once
                this.tokenHash = 0;
                this.worldFp   = 0;
                this.isLinked  = false;
                system.runTimeout(() => {
                    world.sendMessage(
                        "§e[CO2 Mod] Register at the website to link your world to the leaderboard. " +
                        "Then set PLAYER_TOKEN in config.js."
                    );
                }, 200);
            }
            this._ready = true;
        }, 30);
    }

    /** Returns the token hash (4 base-36 chars as number) */
    get tokenHashVal() { return this.tokenHash; }

    /** Returns the world fingerprint (4 base-36 chars as number) */
    get worldFpVal() { return this.worldFp; }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _fnv32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        // Bedrock JS doesn't have Math.imul in all versions — use manual multiply
        h = ((h * 0x01000193) >>> 0);
    }
    return h % 1679616; // mod 36^4
}

function _genUUID() {
    // Generates a stable-looking UUID from pseudo-random values
    const chars = "0123456789abcdef";
    let r = "";
    for (let i = 0; i < 32; i++) r += chars[Math.floor(Math.random() * 16)];
    return `${r.slice(0,8)}-${r.slice(8,12)}-${r.slice(12,16)}-${r.slice(16,20)}-${r.slice(20)}`;
}

export const auth = new AuthSystem();
