"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptToken = encryptToken;
exports.decryptToken = decryptToken;
const crypto_1 = require("crypto");
const ALGO = "aes-256-gcm";
function getKey() {
    const raw = process.env.META_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || "";
    if (!raw || raw.length < 16) {
        return crypto_1.default.createHash("sha256").update("clinicos-meta-fallback-key").digest();
    }
    return crypto_1.default.createHash("sha256").update(raw).digest();
}
function encryptToken(plain) {
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv(ALGO, getKey(), iv);
    const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}
function decryptToken(stored) {
    if (!stored)
        return "";
    const parts = String(stored).split(":");
    if (parts.length !== 3)
        return "";
    const iv = Buffer.from(parts[0], "base64");
    const tag = Buffer.from(parts[1], "base64");
    const data = Buffer.from(parts[2], "base64");
    const decipher = crypto_1.default.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
