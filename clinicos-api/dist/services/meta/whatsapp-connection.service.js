"use strict";
/**
 * WhatsApp Connection Service — Doctors My Agency
 *
 * Unified lifecycle for ClinicWhatsAppConnection records.
 * Both Manual and Embedded Signup flows write through this service.
 * Webhook routing reads through this service.
 *
 * IMPLEMENTATION NOTE — Raw SQL instead of Prisma typed accessor:
 *   The Prisma generated client (generated/prisma/index.js) was compiled
 *   before ClinicWhatsAppConnection was added to the schema, so
 *   prisma.clinicWhatsAppConnection is undefined at runtime → TypeError.
 *   All operations use prisma.$queryRawUnsafe / $executeRawUnsafe which are
 *   always available regardless of the generated client version.
 *   Running `npx prisma generate` in clinicos-api/ will regenerate the typed
 *   client and allow reverting to the typed accessor in the future.
 *
 * Token is encrypted at rest using AES-256-GCM via token-crypto.service.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnectionByClinicId     = getConnectionByClinicId;
exports.getConnectionByPhoneNumberId = getConnectionByPhoneNumberId;
exports.saveConnection               = saveConnection;
exports.disconnectClinic             = disconnectClinic;
exports.updateWebhookStatus          = updateWebhookStatus;
exports.updateLastError              = updateLastError;
exports.markVerified                 = markVerified;
exports.listAllConnections           = listAllConnections;

const prisma_1        = require("../../lib/prisma");
const logger_1        = require("../../lib/logger");
const token_crypto_1  = require("../token-crypto.service");
const crypto          = require("crypto");

// ── Read operations ────────────────────────────────────────────────────────────

/**
 * Get the active WhatsApp connection for a clinic.
 * Returns null if the clinic has no active connection.
 * Returns null (not throw) for all decryption / table-missing errors so that
 * /api/whatsapp/connections/status can return { connected: false } instead of 500.
 */
async function getConnectionByClinicId(clinicId) {
    try {
        const rows = await prisma_1.prisma.$queryRawUnsafe(
            "SELECT * FROM `ClinicWhatsAppConnection` WHERE `clinicId` = ? AND `connectionStatus` = 'active' LIMIT 1",
            clinicId
        );
        const row = Array.isArray(rows) ? rows[0] : null;
        if (!row) return null;
        return hydrateConnection(row);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Table not yet created — not connected
        if (isTableMissingError(err, msg)) {
            logger_1.logger.warn("getConnectionByClinicId: ClinicWhatsAppConnection table not ready", { clinicId });
            return null;
        }
        // Encryption key missing — not connected until key is set
        if (err && err.code === "ENCRYPTION_KEY_MISSING") {
            logger_1.logger.warn("getConnectionByClinicId: META_ENCRYPTION_KEY not configured", { clinicId });
            return null;
        }
        // Decryption failure (wrong key, corrupted value) — treat as disconnected,
        // log the problem code so the admin can diagnose, but do NOT throw so that
        // /status returns { connected: false } instead of HTTP 500.
        if (err && (
            err.code === "DECRYPTION_AUTH_FAILURE" ||
            err.code === "DECRYPTION_WRONG_KEY"    ||
            err.code === "DECRYPTION_INVALID_FORMAT"
        )) {
            logger_1.logger.error("getConnectionByClinicId: token decryption failed — treating as disconnected", {
                clinicId, code: err.code,
            });
            return null;
        }
        logger_1.logger.error("getConnectionByClinicId error", { clinicId, code: err && err.code, error: msg });
        throw err;
    }
}

/**
 * Get the active WhatsApp connection by phone number ID.
 * Used by the webhook engine to route inbound messages.
 */
async function getConnectionByPhoneNumberId(phoneNumberId) {
    try {
        const rows = await prisma_1.prisma.$queryRawUnsafe(
            "SELECT * FROM `ClinicWhatsAppConnection` WHERE `phoneNumberId` = ? AND `connectionStatus` = 'active' LIMIT 1",
            phoneNumberId
        );
        const row = Array.isArray(rows) ? rows[0] : null;
        if (!row) return null;
        return hydrateConnection(row);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isTableMissingError(err, msg)) {
            logger_1.logger.warn("getConnectionByPhoneNumberId: table not ready", { phoneNumberId });
            return null;
        }
        if (err && err.code === "ENCRYPTION_KEY_MISSING") {
            logger_1.logger.warn("getConnectionByPhoneNumberId: META_ENCRYPTION_KEY not configured");
            return null;
        }
        if (err && (
            err.code === "DECRYPTION_AUTH_FAILURE" ||
            err.code === "DECRYPTION_WRONG_KEY"    ||
            err.code === "DECRYPTION_INVALID_FORMAT"
        )) {
            logger_1.logger.error("getConnectionByPhoneNumberId: token decryption failed", {
                phoneNumberId, code: err.code,
            });
            return null;
        }
        logger_1.logger.error("getConnectionByPhoneNumberId error", { phoneNumberId, error: msg });
        throw err;
    }
}

/**
 * List all active connections (for superadmin dashboard).
 */
async function listAllConnections() {
    try {
        const rows = await prisma_1.prisma.$queryRawUnsafe(
            "SELECT c.*, cl.name AS clinicName, cl.email AS clinicEmail, cl.ownerName " +
            "FROM `ClinicWhatsAppConnection` c " +
            "LEFT JOIN `Clinic` cl ON c.clinicId = cl.id " +
            "WHERE c.connectionStatus = 'active' " +
            "ORDER BY c.connectedAt DESC"
        );
        return (Array.isArray(rows) ? rows : []).map((r) => {
            try {
                const conn = hydrateConnection(r);
                return {
                    ...conn,
                    clinicName:  r.clinicName  || null,
                    clinicEmail: r.clinicEmail || null,
                    ownerName:   r.ownerName   || null,
                    accessToken: undefined, // never expose
                };
            } catch (_) {
                return null; // skip rows with decryption issues
            }
        }).filter(Boolean);
    } catch (err) {
        logger_1.logger.error("listAllConnections failed", { err });
        return [];
    }
}

// ── Write operations ───────────────────────────────────────────────────────────

/**
 * Create or update a clinic's WhatsApp connection.
 * Called by both Manual and Embedded Signup flows after validation.
 */
async function saveConnection(clinicId, data) {
    // KEY GUARD — fail before touching the token
    if (!token_crypto_1.isKeyConfigured()) {
        throw new Error(
            "META_ENCRYPTION_KEY is not configured. " +
            "Set it in Hostinger Environment Variables or Superadmin → Integrations before connecting WhatsApp. " +
            'Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
    }

    const enc       = token_crypto_1.encryptToken(data.accessToken);
    const roundtrip = token_crypto_1.decryptToken(enc);
    if (roundtrip !== data.accessToken) {
        throw new Error(
            "Token encryption round-trip failed. " +
            "Verify META_ENCRYPTION_KEY in Superadmin → Integrations — use one stable key, then reconnect."
        );
    }

    const tokenMeta = JSON.stringify({ method: data.connectionMethod || "MANUAL", savedAt: new Date().toISOString() });
    const now       = new Date();
    const nowStr    = now.toISOString().slice(0, 19).replace("T", " ");

    try {
        // Check if a row already exists for this clinic
        const existing = await prisma_1.prisma.$queryRawUnsafe(
            "SELECT id FROM `ClinicWhatsAppConnection` WHERE `clinicId` = ? LIMIT 1",
            clinicId
        );
        const hasRow = Array.isArray(existing) && existing.length > 0;

        if (hasRow) {
            await prisma_1.prisma.$executeRawUnsafe(
                "UPDATE `ClinicWhatsAppConnection` SET " +
                "  `connectionMethod`    = ?, " +
                "  `businessPortfolioId` = ?, " +
                "  `wabaId`              = ?, " +
                "  `phoneNumberId`       = ?, " +
                "  `phoneNumber`         = ?, " +
                "  `displayName`         = ?, " +
                "  `accessTokenEnc`      = ?, " +
                "  `connectionStatus`    = 'active', " +
                "  `webhookStatus`       = ?, " +
                "  `tokenMetadata`       = ?, " +
                "  `lastVerifiedAt`      = ?, " +
                "  `lastError`           = NULL, " +
                "  `updatedAt`           = ? " +
                "WHERE `clinicId` = ?",
                data.connectionMethod    || "MANUAL",
                data.businessPortfolioId || null,
                data.wabaId,
                data.phoneNumberId,
                data.phoneNumber         || null,
                data.displayName         || null,
                enc,
                data.webhookStatus       || "unknown",
                tokenMeta,
                nowStr,
                nowStr,
                clinicId
            );
        } else {
            const id = "cwc_" + crypto.randomBytes(12).toString("hex");
            await prisma_1.prisma.$executeRawUnsafe(
                "INSERT INTO `ClinicWhatsAppConnection` " +
                "  (`id`,`clinicId`,`connectionMethod`,`businessPortfolioId`,`wabaId`,`phoneNumberId`," +
                "   `phoneNumber`,`displayName`,`accessTokenEnc`,`connectionStatus`,`webhookStatus`," +
                "   `tokenMetadata`,`lastVerifiedAt`,`lastError`,`connectedAt`,`updatedAt`) " +
                "VALUES (?,?,?,?,?,?,?,?,?,'active',?,?,?,NULL,?,?)",
                id,
                clinicId,
                data.connectionMethod    || "MANUAL",
                data.businessPortfolioId || null,
                data.wabaId,
                data.phoneNumberId,
                data.phoneNumber         || null,
                data.displayName         || null,
                enc,
                data.webhookStatus       || "unknown",
                tokenMeta,
                nowStr,
                nowStr,
                nowStr
            );
        }
        logger_1.logger.info(`WhatsApp connection saved for clinic ${clinicId} via ${data.connectionMethod || "MANUAL"}`);
    } catch (err) {
        const msg = String(err?.message || err);
        if (String(err?.code) === "P2002" || msg.includes("phoneNumberId") || msg.includes("Duplicate entry")) {
            throw new Error(
                "This WhatsApp Phone Number ID is already connected to another clinic. " +
                "Disconnect it from that clinic first, or verify you entered the correct Phone Number ID."
            );
        }
        throw err;
    }
}

/**
 * Mark a clinic's WhatsApp connection as disconnected.
 */
async function disconnectClinic(clinicId) {
    try {
        await prisma_1.prisma.$executeRawUnsafe(
            "UPDATE `ClinicWhatsAppConnection` SET " +
            "  `connectionStatus` = 'disconnected', " +
            "  `webhookStatus`    = 'disconnected', " +
            "  `lastError`        = NULL, " +
            "  `updatedAt`        = NOW() " +
            "WHERE `clinicId` = ?",
            clinicId
        );
        logger_1.logger.info(`WhatsApp disconnected for clinic ${clinicId}`);
    } catch (err) {
        logger_1.logger.error("disconnectClinic failed", { clinicId, err });
        throw err;
    }
}

/**
 * Update webhook subscription status (non-fatal).
 */
async function updateWebhookStatus(clinicId, status) {
    try {
        await prisma_1.prisma.$executeRawUnsafe(
            "UPDATE `ClinicWhatsAppConnection` SET `webhookStatus` = ?, `updatedAt` = NOW() WHERE `clinicId` = ?",
            status, clinicId
        );
    } catch (_) { /* non-fatal */ }
}

/**
 * Record the last error on a connection (non-fatal).
 */
async function updateLastError(clinicId, error) {
    try {
        await prisma_1.prisma.$executeRawUnsafe(
            "UPDATE `ClinicWhatsAppConnection` SET `lastError` = ?, `updatedAt` = NOW() WHERE `clinicId` = ?",
            String(error).slice(0, 2000), clinicId
        );
    } catch (_) { /* non-fatal */ }
}

/**
 * Mark connection as verified (non-fatal).
 */
async function markVerified(clinicId) {
    try {
        await prisma_1.prisma.$executeRawUnsafe(
            "UPDATE `ClinicWhatsAppConnection` SET `lastVerifiedAt` = NOW(), `lastError` = NULL, `updatedAt` = NOW() WHERE `clinicId` = ?",
            clinicId
        );
    } catch (_) { /* non-fatal */ }
}

// ── Private helpers ────────────────────────────────────────────────────────────

/**
 * Convert a DB row to a hydrated connection object with decrypted token.
 * The accessToken is ONLY decrypted when needed for an API call — never returned to frontend.
 * Throws on key/format errors — callers must handle or catch.
 */
function hydrateConnection(row) {
    const token = token_crypto_1.decryptToken(row.accessTokenEnc);
    return {
        id:                  row.id,
        clinicId:            row.clinicId,
        connectionMethod:    row.connectionMethod,
        businessPortfolioId: row.businessPortfolioId || null,
        wabaId:              row.wabaId,
        phoneNumberId:       row.phoneNumberId,
        phoneNumber:         row.phoneNumber  || null,
        displayName:         row.displayName  || null,
        accessToken:         token,
        connectionStatus:    row.connectionStatus,
        webhookStatus:       row.webhookStatus,
        lastVerifiedAt:      row.lastVerifiedAt  || null,
        lastError:           row.lastError        || null,
        connectedAt:         row.connectedAt,
    };
}

function isTableMissingError(err, msg) {
    return (
        (err && (err.code === "P2021" || err.code === "P2025")) ||
        (typeof msg === "string" && (
            msg.includes("ClinicWhatsAppConnection") ||
            msg.includes("doesn't exist") ||
            msg.includes("Unknown table") ||
            msg.includes("Table") ||
            msg.includes("no such table")
        ))
    );
}
