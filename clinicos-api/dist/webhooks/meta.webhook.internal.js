"use strict";
/**
 * Meta Webhook Internal Bridge — Doctors My Agency
 *
 * Internal API endpoints used by the /api/internal router.
 * Protected by CLINICOS_BRIDGE_KEY header (bridgeAuth middleware).
 *
 * These endpoints allow other trusted internal services to:
 *  - Look up which clinic owns a phone number ID
 *  - Inject a webhook payload for processing (e.g. from a proxy)
 *
 * All message types are supported (not just text — matches main webhook).
 * No IQPigeon dependency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupPhoneNumber      = lookupPhoneNumber;
exports.processMetaWebhookPayload = processMetaWebhookPayload;

const prisma_1 = require("../lib/prisma");
const logger_1 = require("../lib/logger");
const whatsapp_connection_1 = require("../services/meta/whatsapp-connection.service");
const inbound_message_service_1 = require("../services/inbound-message.service");
const whatsapp_provider_1 = require("../services/meta/whatsapp-provider.service");

const CLINIC_SELECT = {
    id: true, name: true, specialty: true, workingHours: true,
    address: true, phone: true, treatments: true, aiEnabled: true,
    aiLanguage: true, aiPersonality: true, autoConfirm: true,
    planStatus: true, customIntroMsg: true, defaultFee: true,
};

// ── GET /api/internal/whatsapp/lookup/:phoneNumberId ─────────────────────────

async function lookupPhoneNumber(req, res) {
    try {
        const conn = await whatsapp_connection_1.getConnectionByPhoneNumberId(req.params.phoneNumberId);
        if (!conn) {
            res.json({ registered: false });
            return;
        }
        res.json({
            registered: true,
            clinicId:           conn.clinicId,
            phoneNumber:        conn.phoneNumber,
            displayName:        conn.displayName,
            wabaId:             conn.wabaId,
            connectionMethod:   conn.connectionMethod,
        });
    } catch (err) {
        logger_1.logger.error("lookupPhoneNumber", { err });
        res.status(500).json({ registered: false, error: "Lookup failed" });
    }
}

// ── POST /api/internal/meta-webhook ──────────────────────────────────────────

async function processMetaWebhookPayload(req, res) {
    res.status(200).send("OK");

    try {
        const body = req.body || {};
        if (body.object !== "whatsapp_business_account" && body.entry === undefined) return;

        for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
                if (change.field !== "messages") continue;

                const value         = change.value || {};
                const phoneNumberId = String(value.metadata?.phone_number_id || "");
                if (!phoneNumberId) continue;

                let conn;
                try {
                    conn = await whatsapp_connection_1.getConnectionByPhoneNumberId(phoneNumberId);
                } catch (decryptErr) {
                    logger_1.logger.error("Internal webhook: token decryption failed — skipping event", {
                        phoneNumberId,
                        code: decryptErr?.code,
                        error: decryptErr instanceof Error ? decryptErr.message : String(decryptErr),
                    });
                    continue;
                }
                if (!conn) continue;

                const clinic = await prisma_1.prisma.clinic.findUnique({
                    where: { id: conn.clinicId },
                    select: CLINIC_SELECT,
                });
                if (!clinic) continue;

                const displayNumber = value.metadata?.display_phone_number
                    || conn.phoneNumber
                    || clinic.phone;

                for (const msg of value.messages || []) {
                    const msgBody = extractMessageBody(msg);
                    if (msgBody === null) continue;

                    const fromPhone = normalizePhone(msg.from);
                    const toPhone   = normalizePhone(displayNumber) || normalizePhone(clinic.phone);

                    const sendReply = async (to, text, _channel) => {
                        await whatsapp_provider_1.sendText(clinic.id, to, text);
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
                }
            }
        }
    } catch (err) {
        logger_1.logger.error("Internal meta-webhook processing error", { err });
    }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function extractMessageBody(msg) {
    if (!msg) return null;
    switch (msg.type) {
        case "text":          return msg.text?.body || null;
        case "image":         return msg.image?.caption   ? `[Image] ${msg.image.caption}`   : "[Patient sent an image]";
        case "audio":
        case "voice":         return "[Patient sent a voice note]";
        case "video":         return msg.video?.caption   ? `[Video] ${msg.video.caption}`   : "[Patient sent a video]";
        case "document": {
            const fn = msg.document?.filename || msg.document?.caption || "";
            return fn ? `[Document: ${fn}]` : "[Patient sent a document]";
        }
        case "sticker":       return "[Patient sent a sticker]";
        case "location": {
            const loc = msg.location || {};
            const parts = ["[Patient shared location"];
            if (loc.name)    parts.push(loc.name);
            if (loc.address) parts.push(loc.address);
            return parts.join(" — ") + "]";
        }
        case "contacts": {
            const names = (msg.contacts || []).map((c) => c.name?.formatted_name || "Unknown").join(", ");
            return names ? `[Patient shared contact: ${names}]` : "[Patient shared a contact]";
        }
        case "button":        return msg.button?.text || "[Button tap]";
        case "interactive": {
            const ia = msg.interactive || {};
            if (ia.type === "button_reply") return ia.button_reply?.title || "[Button reply]";
            if (ia.type === "list_reply")   return ia.list_reply?.title   || "[List reply]";
            return "[Interactive reply]";
        }
        case "reaction":      return null;
        case "order":         return "[Patient placed an order via WhatsApp]";
        default:              return `[Patient sent a ${msg.type || "unknown"} message]`;
    }
}

function normalizePhone(raw) {
    if (!raw) return "";
    return String(raw).replace(/\D/g, "");
}

function ensurePlus(digits) {
    if (!digits) return digits;
    return digits.startsWith("+") ? digits : `+${digits}`;
}
