"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = require("crypto");
const prisma_1 = require("../lib/prisma");
const meta_whatsapp_service_1 = require("../services/meta-whatsapp.service");
const inbound_message_service_1 = require("../services/inbound-message.service");
const twilio_service_1 = require("../services/twilio.service");
const logger_1 = require("../lib/logger");

const router = (0, express_1.Router)();

const CLINIC_SELECT = {
    id: true, name: true, specialty: true, workingHours: true,
    address: true, phone: true, treatments: true, aiEnabled: true,
    aiLanguage: true, aiPersonality: true, autoConfirm: true,
    planStatus: true, customIntroMsg: true, defaultFee: true,
};

function normalizePhone(raw) {
    if (!raw) return "";
    return String(raw).replace(/\D/g, "");
}

// ── HMAC signature verification ───────────────────────────────────────────────
//
// Meta signs every webhook POST with:
//   X-Hub-Signature-256: sha256=<hex>
// where the HMAC key is your App Secret.
// Without this check, anyone who knows your webhook URL can inject fake messages.
//
function verifyWebhookSignature(req) {
    const appSecret = process.env.META_APP_SECRET || "";
    if (!appSecret) {
        // App secret not configured — skip verification but warn once per process
        if (!verifyWebhookSignature._warned) {
            logger_1.logger.warn(
                "META_APP_SECRET not set — webhook signature verification is DISABLED. " +
                "Set META_APP_SECRET in .env to enable it."
            );
            verifyWebhookSignature._warned = true;
        }
        return true;
    }

    const sigHeader = req.headers["x-hub-signature-256"] || "";
    if (!sigHeader) {
        logger_1.logger.warn("Meta webhook: missing X-Hub-Signature-256 header");
        return false;
    }

    // req.body must be the raw buffer — Express must be configured with
    // express.raw() for this route, OR we fall back to re-serialising the
    // parsed JSON (less ideal but still works in practice for this platform).
    const rawBody = Buffer.isBuffer(req.rawBody)
        ? req.rawBody
        : Buffer.from(JSON.stringify(req.body || {}), "utf8");

    const expected = "sha256=" + crypto_1.default
        .createHmac("sha256", appSecret)
        .update(rawBody)
        .digest("hex");

    try {
        return crypto_1.default.timingSafeEqual(
            Buffer.from(expected, "utf8"),
            Buffer.from(sigHeader, "utf8")
        );
    } catch (_) {
        return false;
    }
}
verifyWebhookSignature._warned = false;

// ── Extract human-readable body from any message type ─────────────────────────
//
// Previously the webhook only handled type="text" and silently dropped every
// other message type. A patient sending a voice note, image, sticker, or
// location would get no reply at all — not even the fallback "our team will
// contact you" message. This function extracts a descriptive body for every
// supported type so the AI / fallback pipeline can still respond.
//
function extractMessageBody(msg) {
    if (!msg) return null;

    switch (msg.type) {
        case "text":
            return msg.text?.body || null;

        case "image":
            return msg.image?.caption
                ? `[Image] ${msg.image.caption}`
                : "[Patient sent an image]";

        case "audio":
        case "voice":
            return "[Patient sent a voice note]";

        case "video":
            return msg.video?.caption
                ? `[Video] ${msg.video.caption}`
                : "[Patient sent a video]";

        case "document":
            return msg.document?.filename
                ? `[Document: ${msg.document.filename}]`
                : "[Patient sent a document]";

        case "sticker":
            return "[Patient sent a sticker]";

        case "location": {
            const loc = msg.location || {};
            const parts = ["[Patient shared their location"];
            if (loc.name) parts.push(loc.name);
            if (loc.address) parts.push(loc.address);
            return parts.join(" — ") + "]";
        }

        case "contacts": {
            const contacts = msg.contacts || [];
            if (contacts.length) {
                const names = contacts
                    .map((c) => c.name?.formatted_name || "Unknown")
                    .join(", ");
                return `[Patient shared contact(s): ${names}]`;
            }
            return "[Patient shared a contact]";
        }

        case "button":
            // Quick-reply button tap
            return msg.button?.text || "[Button tap]";

        case "interactive": {
            const ia = msg.interactive || {};
            if (ia.type === "button_reply") return ia.button_reply?.title || "[Button reply]";
            if (ia.type === "list_reply") return ia.list_reply?.title || "[List reply]";
            return "[Interactive reply]";
        }

        case "reaction":
            // Patient reacted with an emoji — not actionable, skip silently
            return null;

        case "order":
            return "[Patient placed an order via WhatsApp]";

        default:
            return `[Patient sent a ${msg.type || "unknown"} message]`;
    }
}

// ── GET — webhook verification (Meta "subscribe" handshake) ───────────────────

// #8 — also serves as a probe: returns JSON with clinic count when called with
//       ?probe=1 so ops can confirm the webhook URL is reachable and wired up.
router.get("/", async (req, res) => {
    // Probe mode (no Meta params)
    if (req.query["probe"] === "1") {
        try {
            const count = await prisma_1.prisma.$queryRawUnsafe(
                "SELECT COUNT(*) AS cnt FROM ClinicWhatsAppAccount WHERE connectionStatus = 'active'"
            );
            const connected = Number(Array.isArray(count) ? count[0]?.cnt : 0);
            res.json({
                ok: true,
                webhook: "meta-whatsapp",
                connectedClinics: connected,
                timestamp: new Date().toISOString(),
            });
        } catch (_) {
            res.json({ ok: true, webhook: "meta-whatsapp", note: "DB not yet initialised" });
        }
        return;
    }

    // Standard Meta verification handshake
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    const verifyToken =
        process.env.META_WEBHOOK_VERIFY_TOKEN ||
        process.env.WEBHOOK_VERIFY_TOKEN ||
        "";

    if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
        res.status(200).send(challenge || "");
        return;
    }
    res.status(403).send("Forbidden");
});

// ── POST — receive Meta webhook events ────────────────────────────────────────

router.post("/", async (req, res) => {
    // Always ACK immediately — Meta will retry if we don't respond within 20 s
    res.status(200).send("EVENT_RECEIVED");

    // Signature check — reject spoofed payloads
    if (!verifyWebhookSignature(req)) {
        logger_1.logger.warn("Meta webhook: invalid HMAC signature — payload rejected");
        return;
    }

    try {
        const body = req.body || {};
        const entries = body.entry || [];

        for (const entry of entries) {
            const changes = entry.changes || [];
            for (const change of changes) {
                if (change.field !== "messages") continue;

                const value = change.value || {};
                const phoneNumberId = value.metadata?.phone_number_id;
                const displayNumber =
                    value.metadata?.display_phone_number || phoneNumberId;

                if (!phoneNumberId) continue;

                const account = await (0, meta_whatsapp_service_1.getAccountByPhoneNumberId)(
                    String(phoneNumberId)
                );
                if (!account) {
                    logger_1.logger.warn(
                        `Meta webhook: no clinic for phone_number_id ${phoneNumberId}`
                    );
                    continue;
                }

                const clinic = await prisma_1.prisma.clinic.findUnique({
                    where: { id: account.clinicId },
                    select: CLINIC_SELECT,
                });
                if (!clinic) continue;

                const messages = value.messages || [];
                for (const msg of messages) {
                    // Extract body for ALL message types (not just text)
                    const msgBody = extractMessageBody(msg);

                    // Reactions and truly unknown types return null — skip silently
                    if (msgBody === null) continue;

                    const fromPhone = normalizePhone(msg.from);
                    const toPhone =
                        normalizePhone(displayNumber) ||
                        (clinic.phone || "").replace(/\D/g, "");

                    const sendReply = async (to, text, channel) => {
                        if (channel === "WHATSAPP") {
                            await (0, meta_whatsapp_service_1.sendWhatsAppForClinic)(
                                clinic.id, to, text
                            );
                        } else {
                            await (0, twilio_service_1.sendSMS)(to, text);
                        }
                    };

                    await (0, inbound_message_service_1.processInboundPatientMessage)({
                        clinic,
                        fromPhone: fromPhone.startsWith("+") ? fromPhone : `+${fromPhone}`,
                        toPhone: toPhone.startsWith("+") ? toPhone : `+${toPhone}`,
                        body: msgBody,
                        channel: "WHATSAPP",
                        externalMessageId: msg.id,
                        sendReply,
                    });
                }
            }
        }
    } catch (err) {
        logger_1.logger.error("Meta webhook error", { err });
    }
});

exports.default = router;
