"use strict";
/**
 * Token Crypto Service — Doctors My Agency
 *
 * AES-256-GCM encryption/decryption for Meta WhatsApp access tokens stored in MySQL.
 *
 * KEY POLICY
 *   META_ENCRYPTION_KEY is MANDATORY.
 *   There is NO fallback key.
 *   There is NO generated default key.
 *   If the key is missing or too short:
 *     - encryptToken() throws { code: "ENCRYPTION_KEY_MISSING" }
 *     - decryptToken() throws { code: "ENCRYPTION_KEY_MISSING" }
 *   Once production connections exist, NEVER rotate the key.
 *
 * ERROR DISTINCTION
 *   Three failure modes are kept separate and never silently converted:
 *
 *   1. ENCRYPTION_KEY_MISSING   — META_ENCRYPTION_KEY absent or too short
 *                                  → configuration error; admin must act
 *                                  → application keeps running; no token stored
 *
 *   2. DECRYPTION_WRONG_KEY     — key is present but incorrect
 *     / DECRYPTION_AUTH_FAILURE   (GCM auth-tag verification fails)
 *                                  → key rotation occurred or token was saved
 *                                    with a different key; requires reconnection
 *                                  → must NOT be silently treated as disconnected
 *
 *   3. DECRYPTION_INVALID_FORMAT — stored value is not a valid
 *                                    iv:tag:ciphertext base64 triple
 *                                  → database corruption or migration issue
 *                                  → must NOT be silently treated as disconnected
 *
 * SECURITY GUARANTEES
 *   - META_ENCRYPTION_KEY is never logged (only its length is reported at boot)
 *   - Plain-text tokens are never logged
 *   - No fallback key string exists anywhere in runtime code
 *   - Tokens are never returned to the frontend
 *   - Tokens are never stored in localStorage
 *   - Tokens never appear in API error responses
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptToken    = encryptToken;
exports.decryptToken    = decryptToken;
exports.isKeyConfigured = isKeyConfigured;

const crypto = require("crypto");

const ALGO           = "aes-256-gcm";
const MIN_KEY_LENGTH = 16; // minimum raw character length before SHA-256 derivation

// ── Error codes ────────────────────────────────────────────────────────────────

const ERR_KEY_MISSING      = "ENCRYPTION_KEY_MISSING";
const ERR_WRONG_KEY        = "DECRYPTION_WRONG_KEY";
const ERR_AUTH_FAILURE     = "DECRYPTION_AUTH_FAILURE";
const ERR_INVALID_FORMAT   = "DECRYPTION_INVALID_FORMAT";

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns true when META_ENCRYPTION_KEY is present and meets the minimum length.
 * Use as a pre-flight guard before calling encryptToken / decryptToken.
 */
function isKeyConfigured() {
    const raw = (process.env.META_ENCRYPTION_KEY || "").trim();
    return raw.length >= MIN_KEY_LENGTH;
}

/**
 * Encrypt a plain-text access token for database storage.
 *
 * Throws { code: "ENCRYPTION_KEY_MISSING" } if META_ENCRYPTION_KEY is not configured.
 * No fallback key. No silent failure. No token stored on key misconfiguration.
 *
 * @param  plain   Raw Meta System User access token
 * @returns        "base64(iv):base64(authTag):base64(ciphertext)"
 */
function encryptToken(plain) {
    const key    = getDerivedKey();          // throws ENCRYPTION_KEY_MISSING if absent
    const iv     = crypto.randomBytes(12);   // 96-bit nonce — unique per call
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const enc    = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
    const tag    = cipher.getAuthTag();      // 128-bit GCM authentication tag
    return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

/**
 * Decrypt a stored encrypted token.
 *
 * Three distinct thrown errors — callers MUST handle each case separately:
 *
 *   { code: "ENCRYPTION_KEY_MISSING"   }  key not configured      → configuration error
 *   { code: "DECRYPTION_WRONG_KEY"     }  wrong key / auth failure → reconnection required
 *   { code: "DECRYPTION_AUTH_FAILURE"  }  GCM tag mismatch        → same as wrong key
 *   { code: "DECRYPTION_INVALID_FORMAT"}  malformed stored value  → DB corruption
 *
 * IMPORTANT: callers are not allowed to silently swallow WRONG_KEY or AUTH_FAILURE
 * as "disconnected". Those errors require explicit handling (log + surface error).
 *
 * @param  stored  "base64(iv):base64(authTag):base64(ciphertext)" from database
 * @returns        Plain-text token
 */
function decryptToken(stored) {
    // Empty/null stored value — treat as "no token saved" (not a key error)
    if (!stored || String(stored).trim() === "") {
        const err = new Error("No token stored for this connection.");
        err.code  = ERR_INVALID_FORMAT;
        throw err;
    }

    // Will throw ENCRYPTION_KEY_MISSING if key is absent — do not catch here
    const key   = getDerivedKey();
    const parts = String(stored).split(":");

    if (parts.length !== 3) {
        const err = new Error(
            "Stored token is not in the expected format (iv:tag:ciphertext). " +
            "The database record may be corrupted. Reconnect WhatsApp to generate a fresh token."
        );
        err.code = ERR_INVALID_FORMAT;
        throw err;
    }

    let iv, tag, data;
    try {
        iv   = Buffer.from(parts[0], "base64");
        tag  = Buffer.from(parts[1], "base64");
        data = Buffer.from(parts[2], "base64");
    } catch (_) {
        const err = new Error(
            "Stored token contains invalid base64 data. " +
            "The database record may be corrupted. Reconnect WhatsApp to generate a fresh token."
        );
        err.code = ERR_INVALID_FORMAT;
        throw err;
    }

    // Validate component lengths — GCM IV = 12 bytes, auth tag = 16 bytes
    if (iv.length !== 12) {
        const err = new Error("Stored token has an invalid IV length. Database record may be corrupted.");
        err.code = ERR_INVALID_FORMAT;
        throw err;
    }
    if (tag.length !== 16) {
        const err = new Error("Stored token has an invalid authentication tag length. Database record may be corrupted.");
        err.code = ERR_INVALID_FORMAT;
        throw err;
    }

    let plain;
    try {
        const decipher = crypto.createDecipheriv(ALGO, key, iv);
        decipher.setAuthTag(tag);
        plain = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    } catch (cipherErr) {
        // GCM authentication-tag failure means either:
        //   a) the key is wrong (rotated / changed)
        //   b) the ciphertext was tampered
        // Both require reconnection — do not silently return empty.
        const msg = cipherErr instanceof Error ? cipherErr.message : String(cipherErr);
        const isAuthFailure = /unsupported state|auth tag|authentication/i.test(msg) ||
                              msg.includes("Unsupported state or unable to authenticate data");
        const err = new Error(
            isAuthFailure
                ? "WhatsApp token authentication failed — the encryption key does not match " +
                  "the key used when this token was stored. If META_ENCRYPTION_KEY was recently " +
                  "changed, restore the original key or disconnect and reconnect WhatsApp."
                : "WhatsApp token decryption failed. Reconnect WhatsApp to generate a fresh token."
        );
        err.code          = isAuthFailure ? ERR_AUTH_FAILURE : ERR_WRONG_KEY;
        err.originalError = msg; // internal only — never exposed to frontend
        throw err;
    }

    return plain;
}

// ── Private ────────────────────────────────────────────────────────────────────

/**
 * Derive the 32-byte AES-256 key from META_ENCRYPTION_KEY.
 * Throws { code: "ENCRYPTION_KEY_MISSING" } if absent or too short.
 * The raw key value is never logged, never returned, never included in errors.
 */
function getDerivedKey() {
    const raw = (process.env.META_ENCRYPTION_KEY || "").trim();
    if (!raw || raw.length < MIN_KEY_LENGTH) {
        const err = new Error(
            "META_ENCRYPTION_KEY is not configured or is too short (minimum 16 characters). " +
            "Set it in Hostinger Environment Variables or Superadmin → Integrations. " +
            "Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" — " +
            "then restart the application. " +
            "WARNING: Once set and clinics have connected, never change this key."
        );
        err.code = ERR_KEY_MISSING;
        throw err;
    }
    // SHA-256 stretches arbitrary-length input to exactly 32 bytes for AES-256.
    // The raw key value is consumed internally and never stored or returned.
    return crypto.createHash("sha256").update(raw, "utf8").digest();
}
