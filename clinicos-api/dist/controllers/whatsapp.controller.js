"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWhatsAppStatus = getWhatsAppStatus;
exports.getWhatsAppSignupConfig = getWhatsAppSignupConfig;
exports.connectWhatsApp = connectWhatsApp;
exports.disconnectWhatsApp = disconnectWhatsApp;
exports.getWhatsAppHub = getWhatsAppHub;
exports.getWhatsAppRecentLog = getWhatsAppRecentLog;
exports.verifyWaba = verifyWaba;

const meta_whatsapp_service_1 = require("../services/meta-whatsapp.service");
const logger_1 = require("../lib/logger");
const prisma_1 = require("../lib/prisma");

// ── GET /api/whatsapp/status ──────────────────────────────────────────────────

async function getWhatsAppStatus(req, res) {
    try {
        const clinicId = req.clinicId || req.user?.clinicId;
        const account = await (0, meta_whatsapp_service_1.getAccountByClinicId)(clinicId);
        res.json({
            connected: !!account,
            phoneNumber: account?.displayPhoneNumber || null,
            wabaId: account?.wabaId || null,
            phoneNumberId: account?.phoneNumberId || null,
            provider: account
                ? "meta"
                : (process.env.TWILIO_ACCOUNT_SID ? "twilio" : "none"),
        });
    } catch (err) {
        logger_1.logger.error("getWhatsAppStatus", { err });
        res.status(500).json({ error: "Failed to load WhatsApp status" });
    }
}

// ── GET /api/whatsapp/signup-config ───────────────────────────────────────────

async function getWhatsAppSignupConfig(req, res) {
    const appId = process.env.META_APP_ID || "";
    const configId = process.env.META_CONFIG_ID || "";
    const graphVersion = process.env.META_GRAPH_API_VERSION || "v21.0";

    if (!appId || !configId) {
        res.status(503).json({
            error:
                "Meta WhatsApp is not configured yet. Ask your platform admin to set " +
                "META_APP_ID and META_CONFIG_ID under Superadmin → Integrations.",
            configured: false,
        });
        return;
    }

    res.json({
        configured: true,
        appId,
        configId,
        graphVersion,
        extras: {
            version: "v4",
            sessionInfoVersion: "3",
            featureType: "whatsapp_business_app_onboarding",
        },
    });
}

// ── POST /api/whatsapp/connect ────────────────────────────────────────────────

async function connectWhatsApp(req, res) {
    try {
        const clinicId = req.clinicId || req.user?.clinicId;
        const { code, waba_id, phone_number_id, display_phone_number } = req.body || {};

        if (!code) {
            res.status(400).json({
                error: "Missing OAuth code from Meta Embedded Signup",
            });
            return;
        }

        // Log what the frontend captured — makes it easy to see in
        // clinicos-api/logs/combined.log whether sessionInfo was captured
        logger_1.logger.info("connectWhatsApp: payload received", {
            clinicId,
            hasCode: !!code,
            waba_id: waba_id || "(not captured)",
            phone_number_id: phone_number_id || "(not captured)",
            display_phone_number: display_phone_number || "(not captured)",
        });

        // Exchange code + resolve assets
        const result = await (0, meta_whatsapp_service_1.exchangeOAuthCode)(String(code), {
            sdkMode: true,
            wabaId: waba_id ? String(waba_id) : "",
            phoneNumberId: phone_number_id ? String(phone_number_id) : "",
            displayPhoneNumber: display_phone_number ? String(display_phone_number) : "",
        });

        logger_1.logger.info("connectWhatsApp: exchangeOAuthCode result", {
            clinicId,
            success: result.success,
            wabaId: result.wabaId || "(none)",
            phoneNumberId: result.phoneNumberId || "(none)",
            displayPhoneNumber: result.displayPhoneNumber || "(none)",
            error: result.error || null,
        });

        if (!result.success) {
            res.status(400).json({ error: result.error || "Connection failed" });
            return;
        }

        // Persist account (with encrypt/decrypt safety check inside)
        await (0, meta_whatsapp_service_1.saveClinicWhatsAppAccount)(clinicId, {
            wabaId: result.wabaId,
            phoneNumberId: result.phoneNumberId,
            displayPhoneNumber: result.displayPhoneNumber,
            accessToken: result.accessToken,
        });

        // ── CRITICAL: Subscribe WABA to this app for inbound webhooks ─────────
        // Without this step the connection appears "active" but Meta never
        // delivers any inbound messages to the webhook.
        if (result.wabaId && result.accessToken) {
            const sub = await (0, meta_whatsapp_service_1.subscribeWabaToApp)(
                result.wabaId,
                result.accessToken
            );
            if (!sub.success) {
                // Non-fatal — log and surface as a warning so the doctor can
                // re-trigger via the /verify-waba endpoint.
                logger_1.logger.warn("WABA subscription failed after connect", {
                    clinicId,
                    wabaId: result.wabaId,
                    err: sub.error,
                });
            }
        }

        res.json({
            success: true,
            phoneNumber: result.displayPhoneNumber,
            wabaId: result.wabaId,
        });
    } catch (err) {
        logger_1.logger.error("connectWhatsApp", { err });
        res.status(500).json({
            error:
                err instanceof Error && err.message.includes("encryption")
                    ? err.message
                    : "WhatsApp connection failed. Try again or contact support.",
        });
    }
}

// ── DELETE /api/whatsapp/disconnect ──────────────────────────────────────────

async function disconnectWhatsApp(req, res) {
    try {
        await (0, meta_whatsapp_service_1.disconnectClinicWhatsApp)(
            req.clinicId || req.user?.clinicId
        );
        res.json({ success: true });
    } catch (err) {
        logger_1.logger.error("disconnectWhatsApp", { err });
        res.status(500).json({ error: "Failed to disconnect WhatsApp" });
    }
}

// ── GET /api/whatsapp/hub ─────────────────────────────────────────────────────

async function getWhatsAppHub(req, res) {
    try {
        const clinicId = req.clinicId || req.user?.clinicId;
        const account = await (0, meta_whatsapp_service_1.getAccountByClinicId)(clinicId);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            inboundToday,
            aiHandledToday,
            needsReview,
            appointmentsBooked,
            leadsHot,
        ] = await Promise.all([
            prisma_1.prisma.message.count({
                where: {
                    clinicId, channel: "WHATSAPP",
                    direction: "INBOUND", createdAt: { gte: today },
                },
            }),
            prisma_1.prisma.message.count({
                where: {
                    clinicId, channel: "WHATSAPP",
                    isHandledByAI: true, createdAt: { gte: today },
                },
            }),
            prisma_1.prisma.message.count({
                where: {
                    clinicId, channel: "WHATSAPP",
                    needsReview: true, isRead: false,
                },
            }),
            prisma_1.prisma.appointment.count({
                where: {
                    clinicId, channel: "WHATSAPP",
                    bookedByAI: true, createdAt: { gte: today },
                },
            }),
            prisma_1.prisma.lead.count({
                where: {
                    clinicId, leadScore: "HOT",
                    status: { notIn: ["BOOKED", "LOST"] },
                },
            }),
        ]);

        const clinic = await prisma_1.prisma.clinic.findUnique({
            where: { id: clinicId },
            select: { aiEnabled: true, name: true, specialty: true },
        });

        res.json({
            connected: !!account,
            phoneNumber: account?.displayPhoneNumber || null,
            wabaId: account?.wabaId || null,
            aiEnabled: clinic?.aiEnabled ?? true,
            clinicName: clinic?.name,
            stats: {
                inboundToday,
                aiHandledToday,
                needsReview,
                appointmentsBooked,
                leadsHot,
            },
            capabilities: [
                "24/7 human-like receptionist",
                "Book / reschedule / cancel appointments",
                "Capture leads & patient CRM",
                "Multi-language replies (EN / AR / Urdu)",
                "Staff escalation with summary",
                "Missed-call recovery follow-up",
            ],
            advancedToolsUrl: process.env.WHATSAPP_PHP_URL || "/whatsapp/client/leads",
        });
    } catch (err) {
        logger_1.logger.error("getWhatsAppHub", { err });
        res.status(500).json({ error: "Failed to load WhatsApp hub" });
    }
}

// ── GET /api/whatsapp/message-log ────────────────────────────────────────────

async function getWhatsAppRecentLog(req, res) {
    try {
        const clinicId = req.clinicId || req.user?.clinicId;
        const messages = await prisma_1.prisma.message.findMany({
            where: { clinicId, channel: "WHATSAPP" },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
                id: true,
                direction: true,
                body: true,
                fromNumber: true,
                toNumber: true,
                isHandledByAI: true,
                needsReview: true,
                createdAt: true,
                patient: { select: { fullName: true } },
            },
        });
        res.json({ messages });
    } catch (err) {
        logger_1.logger.error("getWhatsAppRecentLog", { err });
        res.status(500).json({ error: "Failed to load message log" });
    }
}

// ── POST /api/whatsapp/verify-waba ────────────────────────────────────────────
//
// Lets the doctor (or superadmin) check whether the WABA is subscribed to the
// Meta app and optionally re-subscribe if it isn't. This is the self-service
// fix for the most common "connected but no messages" problem.
//
async function verifyWaba(req, res) {
    try {
        const clinicId = req.clinicId || req.user?.clinicId;
        const account = await (0, meta_whatsapp_service_1.getAccountByClinicId)(clinicId);

        if (!account) {
            res.status(404).json({
                ok: false,
                error: "No active WhatsApp connection found. Connect WhatsApp first.",
            });
            return;
        }

        if (!account.wabaId) {
            res.status(400).json({
                ok: false,
                error: "WABA ID missing — disconnect and reconnect WhatsApp to fix this.",
            });
            return;
        }

        // Check current subscription status
        const status = await (0, meta_whatsapp_service_1.getWabaSubscriptionStatus)(
            account.wabaId,
            account.accessToken
        );

        if (status.subscribed) {
            res.json({
                ok: true,
                subscribed: true,
                message: "WABA is subscribed. Inbound messages will be delivered.",
                wabaId: account.wabaId,
            });
            return;
        }

        // Not subscribed — attempt to fix it automatically
        const { resubscribe } = req.body || {};
        if (resubscribe !== false) {
            const sub = await (0, meta_whatsapp_service_1.subscribeWabaToApp)(
                account.wabaId,
                account.accessToken
            );
            if (sub.success) {
                res.json({
                    ok: true,
                    subscribed: true,
                    message: "WABA was not subscribed — successfully re-subscribed. Inbound messages will now be delivered.",
                    wabaId: account.wabaId,
                });
                return;
            }
            res.status(502).json({
                ok: false,
                subscribed: false,
                error:
                    `WABA subscription failed: ${sub.error}. ` +
                    "Disconnect and reconnect WhatsApp, or contact support.",
                wabaId: account.wabaId,
            });
            return;
        }

        res.json({
            ok: false,
            subscribed: false,
            message:
                "WABA is not subscribed to this app. Inbound messages will NOT be delivered. " +
                "Call this endpoint with POST body { resubscribe: true } to fix it.",
            wabaId: account.wabaId,
        });
    } catch (err) {
        logger_1.logger.error("verifyWaba", { err });
        res.status(500).json({ error: "Failed to verify WABA subscription" });
    }
}

// ── POST /api/whatsapp/test-connect ──────────────────────────────────────────
//
// Development / testing helper — bypasses Meta OAuth entirely.
// Saves a WhatsApp account directly using a pre-obtained access token.
//
// ONLY available when NODE_ENV !== 'production' OR when the request includes
// the correct X-Test-Key header matching TEST_CONNECT_KEY in .env.
//
// How to use (get values from Meta App → WhatsApp → API Setup):
//   curl -X POST https://your-site.com/api/whatsapp/test-connect \
//     -H "Authorization: Bearer <doctor_jwt>" \
//     -H "X-Test-Key: <TEST_CONNECT_KEY from .env>" \
//     -H "Content-Type: application/json" \
//     -d '{
//       "access_token":        "<24h token from Meta API Setup page>",
//       "waba_id":             "<WABA ID from Meta API Setup page>",
//       "phone_number_id":     "<Phone Number ID from Meta API Setup page>",
//       "display_phone_number":"<e.g. +15550000000>"
//     }'
//
async function testConnect(req, res) {
    // Guard: must be dev env OR caller must supply the test key
    const isDev = process.env.NODE_ENV !== "production";
    const testKey = process.env.TEST_CONNECT_KEY || "";
    const suppliedKey = req.headers["x-test-key"] || "";

    if (!isDev && (!testKey || suppliedKey !== testKey)) {
        res.status(403).json({
            error: "test-connect is disabled in production. Set TEST_CONNECT_KEY in .env and pass it as X-Test-Key header.",
        });
        return;
    }

    try {
        const clinicId = req.clinicId || req.user?.clinicId;
        const { access_token, waba_id, phone_number_id, display_phone_number } = req.body || {};

        if (!access_token || !waba_id || !phone_number_id) {
            res.status(400).json({
                error: "Required: access_token, waba_id, phone_number_id",
                hint: "Get these from Meta App Dashboard → WhatsApp → API Setup",
            });
            return;
        }

        logger_1.logger.info("testConnect: saving account directly (no OAuth)", {
            clinicId,
            waba_id,
            phone_number_id,
            display_phone_number: display_phone_number || "(not provided)",
        });

        await (0, meta_whatsapp_service_1.saveClinicWhatsAppAccount)(clinicId, {
            wabaId: String(waba_id),
            phoneNumberId: String(phone_number_id),
            displayPhoneNumber: display_phone_number ? String(display_phone_number) : null,
            accessToken: String(access_token),
        });

        // Also attempt WABA subscription
        const sub = await (0, meta_whatsapp_service_1.subscribeWabaToApp)(
            String(waba_id),
            String(access_token)
        );

        res.json({
            success: true,
            message: "WhatsApp account saved directly (test-connect — no OAuth).",
            wabaSubscription: sub.success ? "subscribed" : `failed: ${sub.error}`,
            phoneNumberId: phone_number_id,
            wabaId: waba_id,
        });
    } catch (err) {
        logger_1.logger.error("testConnect", { err });
        res.status(500).json({
            error: err instanceof Error ? err.message : "test-connect failed",
        });
    }
}
exports.testConnect = testConnect;

// ── POST /api/whatsapp/test-inbound ──────────────────────────────────────────
//
// Simulates an inbound WhatsApp message for a connected clinic.
// Runs the full AI pipeline (intent detection, booking, etc.) without a
// real Meta webhook — useful for testing AI replies and appointment flow.
//
// Requires the clinic to already have a connected WhatsApp account.
//
//   curl -X POST https://your-site.com/api/whatsapp/test-inbound \
//     -H "Authorization: Bearer <doctor_jwt>" \
//     -H "X-Test-Key: <TEST_CONNECT_KEY>" \
//     -H "Content-Type: application/json" \
//     -d '{
//       "from": "+923001234567",
//       "message": "I want to book an appointment for next Monday"
//     }'
//
async function testInbound(req, res) {
    const isDev = process.env.NODE_ENV !== "production";
    const testKey = process.env.TEST_CONNECT_KEY || "";
    const suppliedKey = req.headers["x-test-key"] || "";

    if (!isDev && (!testKey || suppliedKey !== testKey)) {
        res.status(403).json({ error: "test-inbound requires X-Test-Key header in production." });
        return;
    }

    try {
        const clinicId = req.clinicId || req.user?.clinicId;
        const { from, message } = req.body || {};

        if (!from || !message) {
            res.status(400).json({ error: "Required: from (phone number), message (text)" });
            return;
        }

        const account = await (0, meta_whatsapp_service_1.getAccountByClinicId)(clinicId);
        if (!account) {
            res.status(404).json({
                error: "No connected WhatsApp account. Use /test-connect first.",
            });
            return;
        }

        const clinic = await prisma_1.prisma.clinic.findUnique({
            where: { id: clinicId },
            select: {
                id: true, name: true, specialty: true, workingHours: true,
                address: true, phone: true, treatments: true, aiEnabled: true,
                aiLanguage: true, aiPersonality: true, autoConfirm: true,
                planStatus: true, customIntroMsg: true, defaultFee: true,
            },
        });

        if (!clinic) {
            res.status(404).json({ error: "Clinic not found." });
            return;
        }

        // Capture the reply sent by the AI
        const replies = [];
        const sendReply = async (to, text, channel) => {
            replies.push({ to, text, channel });
            logger_1.logger.info(`testInbound reply: [${channel}] to=${to} body=${text.slice(0, 80)}`);
        };

        const fromPhone = String(from).replace(/\D/g, "");
        const toPhone = (account.displayPhoneNumber || clinic.phone || "").replace(/\D/g, "");

        const { processInboundPatientMessage } = require("../services/inbound-message.service");
        await processInboundPatientMessage({
            clinic,
            fromPhone: fromPhone.startsWith("+") ? fromPhone : `+${fromPhone}`,
            toPhone: toPhone.startsWith("+") ? toPhone : `+${toPhone}`,
            body: String(message),
            channel: "WHATSAPP",
            externalMessageId: `test-${Date.now()}`,
            sendReply,
        });

        res.json({
            success: true,
            message: "Inbound message processed through AI pipeline.",
            from: from,
            input: message,
            replies,
        });
    } catch (err) {
        logger_1.logger.error("testInbound", { err });
        res.status(500).json({
            error: err instanceof Error ? err.message : "test-inbound failed",
        });
    }
}
exports.testInbound = testInbound;
