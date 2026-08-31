"use strict";
/**
 * WhatsApp Connection Service — Doctors My Agency
 *
 * Unified lifecycle for ClinicWhatsAppConnection records.
 * Both Manual and Embedded Signup flows write through this service.
 * Webhook routing reads through this service.
 *
 * Uses Prisma ClinicWhatsAppConnection model (added in schema.prisma task #4).
 * Token is encrypted at rest using AES-256-GCM via token-crypto.service.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnectionByClinicId = getConnectionByClinicId;
exports.getConnectionByPhoneNumberId = getConnectionByPhoneNumberId;
exports.saveConnection = saveConnection;
exports.disconnectClinic = disconnectClinic;
exports.updateWebhookStatus = updateWebhookStatus;
exports.updateLastError = updateLastError;
exports.markVerified = markVerified;
exports.listAllConnections = listAllConnections;

const prisma_1 = require("../../lib/prisma");
const logger_1 = require("../../lib/logger");
const token_crypto_1 = require("../token-crypto.service");
// ── Read operations ────────────────────────────────────────────────────────────

/**
 * Get the active WhatsApp connection for a clinic.
 * Returns null if the clinic has no active connection.
 * Throws if the encryption key is wrong or ciphertext is corrupted — callers must handle.
 */
async function getConnectionByClinicId(clinicId) {
    try {
        const row = await prisma_1.prisma.clinicWhatsAppConnection.findFirst({
            where: { clinicId, connectionStatus: "active" },
        });
        if (!row) return null;
        return hydrateConnection(row);   // throws on wrong-key / corrupt — propagate
    } catch (err) {
        // ENCRYPTION_KEY_MISSING: key not configured — treat as no connection
        if (err && err.code === "ENCRYPTION_KEY_MISSING") {
            logger_1.logger.warn(`getConnectionByClinicId: encryption key not configured for clinic ${clinicId}`);
            return null;
        }
        // P2021 / table not found: ClinicWhatsAppConnection table not migrated yet.
        // Treat as no connection — avoids 500 on fresh deploys before migration runs.
        const msg = err instanceof Error ? err.message : String(err);
        if (
            (err && (err.code === "P2021" || err.code === "P2025")) ||
            msg.includes("Table") || msg.includes("doesn't exist") ||
            msg.includes("Unknown table") || msg.includes("ClinicWhatsAppConnection")
        ) {
            logger_1.logger.warn(`getConnectionByClinicId: ClinicWhatsAppConnection table not ready — returning null`, { clinicId });
            return null;
        }
        // All other errors (WRONG_KEY, AUTH_FAILURE, INVALID_FORMAT) — must propagate
        logger_1.logger.error("getConnectionByClinicId: decryption failed", {
            clinicId,
            code: err && err.code,
            error: msg,
        });
        throw err;
    }
}

/**
 * Get the active WhatsApp connection for a specific phone number ID.
 * Used by the webhook engine to route inbound messages to the correct clinic.
 * Throws on wrong-key / auth-failure so webhook engine can log and skip the message.
 */
async function getConnectionByPhoneNumberId(phoneNumberId) {
    try {
        const row = await prisma_1.prisma.clinicWhatsAppConnection.findFirst({
            where: { phoneNumberId, connectionStatus: "active" },
        });
        if (!row) return null;
        return hydrateConnection(row);   // throws on wrong-key / corrupt — propagate
    } catch (err) {
        if (err && err.code === "ENCRYPTION_KEY_MISSING") {
            logger_1.logger.warn(`getConnectionByPhoneNumberId: encryption key not configured for ${phoneNumberId}`);
            return null;
        }
        // P2021: table not migrated yet — return null so webhook skips gracefully
        const msg = err instanceof Error ? err.message : String(err);
        if (
            (err && (err.code === "P2021" || err.code === "P2025")) ||
            msg.includes("Table") || msg.includes("doesn't exist") ||
            msg.includes("Unknown table") || msg.includes("ClinicWhatsAppConnection")
        ) {
            logger_1.logger.warn(`getConnectionByPhoneNumberId: ClinicWhatsAppConnection table not ready`, { phoneNumberId });
            return null;
        }
        logger_1.logger.error("getConnectionByPhoneNumberId: decryption failed", {
            phoneNumberId,
            code: err && err.code,
            error: msg,
        });
        throw err;
    }
}

/**
 * List all active connections (for superadmin dashboard).
 */
async function listAllConnections() {
    try {
        const rows = await prisma_1.prisma.clinicWhatsAppConnection.findMany({
            where: { connectionStatus: "active" },
            include: { clinic: { select: { name: true, email: true, ownerName: true } } },
            orderBy: { connectedAt: "desc" },
        });
        return rows.map((r) => ({
            ...hydrateConnection(r),
            clinicName: r.clinic?.name,
            clinicEmail: r.clinic?.email,
            ownerName: r.clinic?.ownerName,
            accessToken: undefined, // never expose token in list
        }));
    } catch (err) {
        logger_1.logger.error("listAllConnections failed", { err });
        return [];
    }
}

// ── Write operations ───────────────────────────────────────────────────────────

/**
 * Create or update a clinic's WhatsApp connection.
 * Called by both Manual and Embedded Signup flows after validation.
 *
 * @param clinicId     — The Doctors My Agency clinic ID
 * @param data         — Connection data from validation
 */
async function saveConnection(clinicId, data) {
    // ── KEY GUARD — fail before touching the token ────────────────────────────
    // Do not use a fallback key. If META_ENCRYPTION_KEY is not configured,
    // return a clear error. The application keeps running; only this clinic
    // cannot connect WhatsApp until the key is configured.
    if (!token_crypto_1.isKeyConfigured()) {
        throw new Error(
            "META_ENCRYPTION_KEY is not configured. " +
            "Set it in Hostinger Environment Variables or Superadmin → Integrations before connecting WhatsApp. " +
            "Generate a key with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
        );
    }

    // Encrypt token before persisting — never store plain text
    const enc = token_crypto_1.encryptToken(data.accessToken);

    // Safety check: verify round-trip before saving
    const roundtrip = token_crypto_1.decryptToken(enc);
    if (roundtrip !== data.accessToken) {
        throw new Error(
            "Token encryption round-trip failed. " +
            "Verify META_ENCRYPTION_KEY in Superadmin → Integrations — use one stable key, then reconnect."
        );
    }

    const tokenMeta = JSON.stringify({
        method: data.connectionMethod || "MANUAL",
        savedAt: new Date().toISOString(),
    });

    try {
        await prisma_1.prisma.clinicWhatsAppConnection.upsert({
            where: { clinicId },
            update: {
                connectionMethod:    data.connectionMethod    || "MANUAL",
                businessPortfolioId: data.businessPortfolioId || null,
                wabaId:              data.wabaId,
                phoneNumberId:       data.phoneNumberId,
                phoneNumber:         data.phoneNumber         || null,
                displayName:         data.displayName         || null,
                accessTokenEnc:      enc,
                connectionStatus:    "active",
                webhookStatus:       data.webhookStatus       || "unknown",
                tokenMetadata:       tokenMeta,
                lastVerifiedAt:      new Date(),
                lastError:           null,
                updatedAt:           new Date(),
            },
            create: {
                clinicId,
                connectionMethod:    data.connectionMethod    || "MANUAL",
                businessPortfolioId: data.businessPortfolioId || null,
                wabaId:              data.wabaId,
                phoneNumberId:       data.phoneNumberId,
                phoneNumber:         data.phoneNumber         || null,
                displayName:         data.displayName         || null,
                accessTokenEnc:      enc,
                connectionStatus:    "active",
                webhookStatus:       data.webhookStatus       || "unknown",
                tokenMetadata:       tokenMeta,
                lastVerifiedAt:      new Date(),
                lastError:           null,
            },
        });
        logger_1.logger.info(`WhatsApp connection saved for clinic ${clinicId} via ${data.connectionMethod || "MANUAL"}`);
    } catch (err) {
        // Handle unique constraint on phoneNumberId (another clinic already has it)
        if (String(err?.code) === "P2002" || String(err?.message).includes("phoneNumberId")) {
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
 * Does not delete the record — preserves audit history.
 */
async function disconnectClinic(clinicId) {
    try {
        await prisma_1.prisma.clinicWhatsAppConnection.updateMany({
            where: { clinicId },
            data: {
                connectionStatus: "disconnected",
                webhookStatus:    "disconnected",
                lastError:        null,
                updatedAt:        new Date(),
            },
        });
        logger_1.logger.info(`WhatsApp disconnected for clinic ${clinicId}`);
    } catch (err) {
        logger_1.logger.error("disconnectClinic failed", { clinicId, err });
        throw err;
    }
}

/**
 * Update webhook subscription status.
 * Called after subscribeWabaToApp succeeds or fails.
 */
async function updateWebhookStatus(clinicId, status) {
    try {
        await prisma_1.prisma.clinicWhatsAppConnection.updateMany({
            where: { clinicId },
            data: { webhookStatus: status, updatedAt: new Date() },
        });
    } catch (_) { /* non-fatal */ }
}

/**
 * Record the last error on a connection (for diagnostics).
 */
async function updateLastError(clinicId, error) {
    try {
        await prisma_1.prisma.clinicWhatsAppConnection.updateMany({
            where: { clinicId },
            data: {
                lastError:  String(error).slice(0, 2000),
                updatedAt:  new Date(),
            },
        });
    } catch (_) { /* non-fatal */ }
}

/**
 * Mark connection as verified (lastVerifiedAt = now, lastError = null).
 */
async function markVerified(clinicId) {
    try {
        await prisma_1.prisma.clinicWhatsAppConnection.updateMany({
            where: { clinicId },
            data: { lastVerifiedAt: new Date(), lastError: null, updatedAt: new Date() },
        });
    } catch (_) { /* non-fatal */ }
}

// ── Private ────────────────────────────────────────────────────────────────────

/**
 * Convert a DB row to a hydrated connection object with decrypted token.
 * The accessToken is ONLY decrypted when needed for an API call — never returned to frontend.
 *
 * Throws if the encryption key is missing or wrong — callers must handle this.
 * DECRYPTION_WRONG_KEY / DECRYPTION_AUTH_FAILURE must NOT be silently swallowed.
 */
function hydrateConnection(row) {
    const token = token_crypto_1.decryptToken(row.accessTokenEnc);  // throws on key/format errors
    return {
        id:                  row.id,
        clinicId:            row.clinicId,
        connectionMethod:    row.connectionMethod,
        businessPortfolioId: row.businessPortfolioId,
        wabaId:              row.wabaId,
        phoneNumberId:       row.phoneNumberId,
        phoneNumber:         row.phoneNumber,
        displayName:         row.displayName,
        accessToken:         token,
        connectionStatus:    row.connectionStatus,
        webhookStatus:       row.webhookStatus,
        lastVerifiedAt:      row.lastVerifiedAt,
        lastError:           row.lastError,
        connectedAt:         row.connectedAt,
    };
}
