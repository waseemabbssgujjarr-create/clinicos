"use strict";
/**
 * Meta WhatsApp Webhook — Doctors My Agency
 *
 * Receives inbound events from Meta Cloud API.
 * Routes to the correct clinic via PhoneNumberId lookup.
 *
 * Security:
 *   - HMAC-SHA256 signature verified on every POST (X-Hub-Signature-256)
 *   - Idempotent: duplicate meta message IDs are skipped
 *   - ACK 200 immediately before processing (Meta retry logic)
 *
 * Message types handled:
 *   text, image, audio, voice, video, document, sticker,
 *   location, contacts, button, interactive, reaction, order
 *
 * No IQPigeon dependency. Webhook URL: https://doctorsmyagency.com/api/webhooks/meta
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1  = require("crypto");
const prisma_1  = require("../lib/prisma");
const logger_1  = require("../lib/logger");
const whatsapp_connection_1 = require("../services/meta/whatsapp-connection.service");
const inbound_message_service_1 = require("../services/inbound-message.service");
const whatsapp_provider_1 = require("../services/meta/whatsapp-provider.service");

const router = (0, express_1.Router)();

const CLINIC_SELECT = {
    id: true, name: true, specialty: true, workingHours: true,
    address: true, phone: true, treatments: true, aiEnabled: true,
    aiLanguage: true, aiPersonality: true, autoConfirm: true,
    planStatus: true, customIntroMsg: true, defaultFee: true,
};

// ── HMAC signature verification ───────────────────────────────────────────────

let _sigWarnLogged = false;

function verifyWebhookSignature(req) {
    const appSecret = process.env.META_APP_SECRET || "";
    if (!appSecret) {
        if (!_sigWarnLogged) {
            logger_1.logger.warn(
                "META_APP_SECRET not configured — webhook HMAC verification is DISABLED. " +
                "Set META_APP_SECRET in Superadmin → Integrations to enable security."
            );
            _sigWarnLogged = true;
        }
        return true; // allow but warn
    }

    const sigHeader = String(req.headers["x-hub-signature-256"] || "");
    if (!sigHeader.startsWith("sha256=")) {
        logger_1.logger.warn("Meta webhook: missing or malformed X-Hub-Signature-256 header");
        return false;
    }

    // Use raw body if available (Stripe raw body pattern), otherwise re-serialize
    const rawBody = Buffer.isBuffer(req.rawBody)
        ? req.rawBody
        : Buffer.from(JSON.stringify(req.body || {}), "utf8");

    const expected = "sha256=" + crypto_1
        .createHmac("sha256", appSecret)
        .update(rawBody)
        .digest("hex");

    try {
        return crypto_1.timingSafeEqual(
            Buffer.from(expected, "utf8"),
            Buffer.from(sigHeader, "utf8")
        );
    } catch (_) {
        return false;
    }
}

// ── Message body extractor — all supported types ──────────────────────────────

function extractMessageBody(msg) {
    if (!msg) return null;
    switch (msg.type) {
        case "text":
            return msg.text?.body || null;
        case "image":
            return msg.image?.caption ? `[Image] ${msg.image.caption}` : "[Patient sent an image]";
        case "audio":
        case "voice":
            return "[Patient sent a voice note]";
        case "video":
            return msg.video?.caption ? `[Video] ${msg.video.caption}` : "[Patient sent a video]";
        case "document": {
            const fn = msg.document?.filename || msg.document?.caption || "";
            return fn ? `[Document: ${fn}]` : "[Patient sent a document]";
        }
        case "sticker":
            return "[Patient sent a sticker]";
        case "location": {
            const loc = msg.location || {};
            const parts = ["[Patient shared location"];
            if (loc.name)    parts.push(loc.name);
            if (loc.address) parts.push(loc.address);
            return parts.join(" — ") + "]";
        }
        case "contacts": {
            const names = (msg.contacts || [])
                .map((c) => c.name?.formatted_name || "Unknown")
                .join(", ");
            return names ? `[Patient shared contact: ${names}]` : "[Patient shared a contact]";
        }
        case "button":
            return msg.button?.text || "[Button tap]";
        case "interactive": {
            const ia = msg.interactive || {};
            if (ia.type === "button_reply") return ia.button_reply?.title || "[Button reply]";
            if (ia.type === "list_reply")   return ia.list_reply?.title   || "[List reply]";
            return "[Interactive reply]";
        }
        case "reaction":
            return null; // reactions don't need AI reply — skip silently
        case "order":
            return "[Patient placed an order via WhatsApp]";
        default:
            return `[Patient sent a ${msg.type || "unknown"} message]`;
    }
}

// ── Idempotency check — deduplicate Meta retry deliveries ─────────────────────
// NOTE: metaMessageId is NOT in the Prisma-generated client (schema added the
// column after the client was compiled). Use $queryRawUnsafe so this works
// regardless of whether the column has been migrated onto the live DB yet.
// If the column is missing MySQL returns an error → catch returns false
// (allow processing — better to duplicate than lose a message).

async function isMessageAlreadyProcessed(metaMessageId) {
    if (!metaMessageId) return false;
    try {
        const rows = await prisma_1.prisma.$queryRawUnsafe(
            "SELECT id FROM `Message` WHERE `metaMessageId` = ? LIMIT 1",
            metaMessageId
        );
        return Array.isArray(rows) && rows.length > 0;
    } catch (err) {
        // Column may not exist yet — allow processing
        const msg = err instanceof Error ? err.message : String(err);
        logger_1.logger.debug("isMessageAlreadyProcessed: raw query failed (column may be missing), allowing", { err: msg });
        return false;
    }
}

// ── GET — Meta webhook verification handshake ─────────────────────────────────

router.get("/", async (req, res) => {
    // Probe mode: ?probe=1 — confirms webhook is reachable, no Meta params needed
    if (req.query["probe"] === "1") {
        try {
            const count = await prisma_1.prisma.clinicWhatsAppConnection.count({
                where: { connectionStatus: "active" },
            });
            res.json({
                ok: true,
                service: "doctors-my-agency-webhook",
                connectedClinics: count,
                timestamp: new Date().toISOString(),
            });
        } catch (_) {
            res.json({
                ok: true,
                service: "doctors-my-agency-webhook",
                note: "DB not yet initialised",
                timestamp: new Date().toISOString(),
            });
        }
        return;
    }

    // Standard Meta verification handshake
    const mode      = req.query["hub.mode"];
    const token     = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN || "";

    if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
        res.status(200).send(challenge || "");
        return;
    }
    res.status(403).send("Forbidden");
});

// ── POST — receive Meta webhook events ───────────────────────────────────────

router.post("/", async (req, res) => {
    // ACK immediately — Meta retries if response takes > 20s
    res.status(200).send("EVENT_RECEIVED");

    // ── Diagnostic: log every inbound POST before any rejection ──────────────
    const sigHeader = String(req.headers["x-hub-signature-256"] || "");
    const rawBodyLen = Buffer.isBuffer(req.rawBody) ? req.rawBody.length
                     : (req.body ? JSON.stringify(req.body).length : 0);
    logger_1.logger.info("META_WEBHOOK_POST_RECEIVED", {
        method: req.method,
        path: req.path,
        hasSignatureHeader: !!sigHeader,
        signaturePrefix: sigHeader ? sigHeader.slice(0, 14) + "…" : "(none)",
        rawBodyLength: rawBodyLen,
        bodyType: typeof req.body,
    });

    // Reject payloads with invalid signatures
    if (!verifyWebhookSignature(req)) {
        logger_1.logger.warn("META_WEBHOOK_HMAC_FAILED", {
            hasSecret: !!(process.env.META_APP_SECRET),
            hasSignatureHeader: !!sigHeader,
            rawBodyLength: rawBodyLen,
        });
        return;
    }

    logger_1.logger.info("META_WEBHOOK_HMAC_VALID");

    try {
        const body = req.body || {};
        if (body.object !== "whatsapp_business_account") {
            logger_1.logger.info("META_WEBHOOK_NOT_WHATSAPP", { object: body.object });
            return;
        }

        for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
                if (change.field !== "messages") continue;

                const value        = change.value || {};
                const phoneNumberId = String(value.metadata?.phone_number_id || "");
                if (!phoneNumberId) continue;

                logger_1.logger.info("META_WEBHOOK_MESSAGE_RECEIVED", {
                    phoneNumberId,
                    wabaId: entry.id || "(unknown)",
                    messageCount: (value.messages || []).length,
                    statusCount: (value.statuses || []).length,
                });

                // Delivery / read / failed receipts — no clinic token needed for DB update
                for (const st of value.statuses || []) {
                    try {
                        await whatsapp_provider_1.applyStatusUpdate(
                            st.id,
                            st.status,
                            (st.errors && st.errors[0]) || null
                        );
                    } catch (stErr) {
                        logger_1.logger.debug("META_WEBHOOK_STATUS_UPDATE_FAILED", {
                            err: stErr instanceof Error ? stErr.message : String(stErr),
                        });
                    }
                }

                if (!(value.messages || []).length) continue;

                let conn;
                try {
                    conn = await whatsapp_connection_1.getConnectionByPhoneNumberId(phoneNumberId);
                } catch (decryptErr) {
                    // WRONG_KEY or AUTH_FAILURE: log clearly, skip message.
                    // Never silently swallow — must be visible in logs for diagnosis.
                    logger_1.logger.error("Meta webhook: token decryption failed — skipping event", {
                        phoneNumberId,
                        code: decryptErr?.code,
                        error: decryptErr instanceof Error ? decryptErr.message : String(decryptErr),
                    });
                    continue;
                }
                if (!conn) {
                    logger_1.logger.warn(`META_WEBHOOK_NO_CLINIC_FOR_PHONE_NUMBER_ID`, { phoneNumberId });
                    continue;
                }

                logger_1.logger.info("META_WEBHOOK_CLINIC_RESOLVED", {
                    phoneNumberId,
                    clinicId: conn.clinicId,
                });

                const clinic = await prisma_1.prisma.clinic.findUnique({
                    where: { id: conn.clinicId },
                    select: CLINIC_SELECT,
                });
                if (!clinic) continue;

                const displayNumber = value.metadata?.display_phone_number
                    || conn.phoneNumber
                    || clinic.phone;

                for (const msg of value.messages || []) {
                    // Idempotency — skip if already processed
                    if (await isMessageAlreadyProcessed(msg.id)) {
                        logger_1.logger.debug(`Meta webhook: duplicate message ${msg.id} — skipped`);
                        continue;
                    }

                    const msgBody = extractMessageBody(msg);
                    if (msgBody === null) continue; // reactions etc.

                    const fromPhone = normalizePhone(msg.from);
                    const toPhone   = normalizePhone(displayNumber) || normalizePhone(clinic.phone);

                    logger_1.logger.info("META_WEBHOOK_PROCESSING_MESSAGE", {
                        messageId: msg.id,
                        messageType: msg.type,
                        fromPhone: fromPhone ? fromPhone.slice(0, 6) + "…" : "(none)",
                        clinicId: clinic.id,
                        aiEnabled: clinic.aiEnabled,
                        planStatus: clinic.planStatus,
                    });

                    const sendReply = async (to, text, _channel) => {
                        logger_1.logger.info("META_WEBHOOK_SENDING_REPLY", {
                            clinicId: clinic.id,
                            toPrefix: to ? String(to).slice(0, 6) + "…" : "(none)",
                            bodyLength: text ? text.length : 0,
                        });
                        return whatsapp_provider_1.sendText(clinic.id, to, text);
                    };

                    await inbound_message_service_1.processInboundPatientMessage({
                        clinic,
                        fromPhone: ensurePlus(fromPhone),
                        toPhone:   ensurePlus(toPhone),
                        body:      msgBody,
                        channel:   "WHATSAPP",
                        externalMessageId: msg.id,
                        sendReply,
                    });

                    logger_1.logger.info("META_WEBHOOK_MESSAGE_PROCESSED", {
                        messageId: msg.id,
                        clinicId: clinic.id,
                    });
                }
            }
        }
    } catch (err) {
        // Log the full error — never swallow silently so we can diagnose
        logger_1.logger.error("META_WEBHOOK_PROCESSING_ERROR", {
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
            name: err instanceof Error ? err.name : undefined,
        });
    }
});

exports.default = router;

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePhone(raw) {
    if (!raw) return "";
    return String(raw).replace(/\D/g, "");
}

function ensurePlus(digits) {
    if (!digits) return digits;
    return digits.startsWith("+") ? digits : `+${digits}`;
}
