"use strict";
/**
 * WhatsApp Provider Service — Doctors My Agency
 *
 * Abstraction layer for all outbound WhatsApp messaging.
 * Business logic MUST call this service — never call Meta Graph API directly.
 *
 * Currently implements MetaWhatsAppProvider (Cloud API).
 * Swapping providers in the future requires only this file.
 *
 * Methods:
 *   sendText(clinicId, to, body)
 *   sendTemplate(clinicId, to, templateName, langCode, components)
 *   sendMedia(clinicId, to, mediaType, mediaUrl, caption)
 *   markAsRead(clinicId, messageId)
 *   getStatus(clinicId)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendText = sendText;
exports.sendTemplate = sendTemplate;
exports.sendMedia = sendMedia;
exports.markAsRead = markAsRead;
exports.getStatus = getStatus;

const meta_client_1 = require("./meta-client.service");
const whatsapp_connection_1 = require("./whatsapp-connection.service");
const logger_1 = require("../../lib/logger");

// ── Provider: Meta WhatsApp Cloud API ─────────────────────────────────────────

/**
 * Send a plain text WhatsApp message to a phone number.
 *
 * @param clinicId  — Doctors My Agency clinic ID
 * @param to        — Recipient phone number (any format; digits will be extracted)
 * @param body      — Message body (max 4096 chars)
 * @returns         — Meta message ID or null on failure
 */
async function sendText(clinicId, to, body) {
    const conn = await getActiveConnection(clinicId);
    if (!conn) return null;

    const toDigits = normalizePhone(to);
    if (!toDigits) {
        logger_1.logger.warn(`sendText: invalid phone number "${to}"`, { clinicId });
        return null;
    }

    const result = await meta_client_1.graphPost(
        `${conn.phoneNumberId}/messages`,
        conn.accessToken,
        {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: toDigits,
            type: "text",
            text: { preview_url: false, body: String(body).slice(0, 4096) },
        }
    );

    if (!result.success) {
        logger_1.logger.error("sendText failed", { clinicId, to: toDigits, err: result.error });
        return null;
    }

    const msgId = result.data?.messages?.[0]?.id || null;
    logger_1.logger.info(`sendText → ${toDigits} msgId=${msgId}`, { clinicId });
    return msgId;
}

/**
 * Send an approved WhatsApp template message.
 * Used for outbound messages outside the 24-hour customer service window.
 *
 * @param components — Array of template component objects (header, body, buttons)
 */
async function sendTemplate(clinicId, to, templateName, langCode = "en", components = []) {
    const conn = await getActiveConnection(clinicId);
    if (!conn) return null;

    const toDigits = normalizePhone(to);
    if (!toDigits) return null;

    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toDigits,
        type: "template",
        template: {
            name: templateName,
            language: { code: langCode },
            ...(components.length > 0 ? { components } : {}),
        },
    };

    const result = await meta_client_1.graphPost(`${conn.phoneNumberId}/messages`, conn.accessToken, payload);
    if (!result.success) {
        logger_1.logger.error("sendTemplate failed", { clinicId, templateName, err: result.error });
        return null;
    }
    return result.data?.messages?.[0]?.id || null;
}

/**
 * Send a media message (image, document, video, audio).
 *
 * @param mediaType — 'image' | 'document' | 'video' | 'audio'
 * @param mediaUrl  — Publicly accessible URL or Media ID
 * @param caption   — Optional caption (image/video/document only)
 */
async function sendMedia(clinicId, to, mediaType, mediaUrl, caption = "") {
    const conn = await getActiveConnection(clinicId);
    if (!conn) return null;

    const toDigits = normalizePhone(to);
    if (!toDigits) return null;

    const validTypes = ["image", "document", "video", "audio", "sticker"];
    const type = validTypes.includes(mediaType) ? mediaType : "document";

    const mediaObj = mediaUrl.startsWith("http")
        ? { link: mediaUrl, ...(caption && type !== "audio" ? { caption } : {}) }
        : { id: mediaUrl, ...(caption && type !== "audio" ? { caption } : {}) };

    const result = await meta_client_1.graphPost(
        `${conn.phoneNumberId}/messages`,
        conn.accessToken,
        {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: toDigits,
            type,
            [type]: mediaObj,
        }
    );

    if (!result.success) {
        logger_1.logger.error("sendMedia failed", { clinicId, type, err: result.error });
        return null;
    }
    return result.data?.messages?.[0]?.id || null;
}

/**
 * Mark an inbound message as read (shows double blue tick to patient).
 * Best-effort — failure is non-fatal.
 */
async function markAsRead(clinicId, messageId) {
    const conn = await getActiveConnection(clinicId);
    if (!conn || !messageId) return;

    try {
        await meta_client_1.graphPost(
            `${conn.phoneNumberId}/messages`,
            conn.accessToken,
            {
                messaging_product: "whatsapp",
                status: "read",
                message_id: messageId,
            }
        );
    } catch (_) { /* non-fatal */ }
}

/**
 * Get the connection status for a clinic's WhatsApp.
 */
async function getStatus(clinicId) {
    const conn = await whatsapp_connection_1.getConnectionByClinicId(clinicId);
    if (!conn) {
        return { connected: false, provider: "none" };
    }
    return {
        connected: true,
        provider: "meta",
        connectionMethod: conn.connectionMethod,
        phoneNumber: conn.phoneNumber || conn.displayName,
        phoneNumberId: conn.phoneNumberId,
        wabaId: conn.wabaId,
        webhookStatus: conn.webhookStatus,
        lastVerifiedAt: conn.lastVerifiedAt,
        lastError: conn.lastError,
    };
}

// ── Private helpers ────────────────────────────────────────────────────────────

async function getActiveConnection(clinicId) {
    const conn = await whatsapp_connection_1.getConnectionByClinicId(clinicId);
    if (!conn?.accessToken) {
        logger_1.logger.warn(`WhatsApp provider: no active connection for clinic ${clinicId}`);
        return null;
    }
    return conn;
}

function normalizePhone(raw) {
    if (!raw) return "";
    const digits = String(raw).replace(/\D/g, "");
    return digits || "";
}
