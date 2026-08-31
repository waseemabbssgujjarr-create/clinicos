"use strict";
/**
 * WhatsApp Controller — Doctors My Agency
 *
 * All WhatsApp operations for clinics.
 * Uses the new meta/ service layer exclusively.
 * No direct Meta Graph API calls here.
 * No IQPigeon dependency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnectionStatus   = getConnectionStatus;
exports.getSignupConfig       = getSignupConfig;
exports.connectManual         = connectManual;
exports.connectEmbedded       = connectEmbedded;
exports.disconnectWhatsApp    = disconnectWhatsApp;
exports.getWhatsAppHub        = getWhatsAppHub;
exports.getWhatsAppRecentLog  = getWhatsAppRecentLog;
exports.verifyWaba            = verifyWaba;

const whatsapp_connection_1  = require("../services/meta/whatsapp-connection.service");
const whatsapp_manual_1      = require("../services/meta/whatsapp-manual.service");
const whatsapp_embedded_1    = require("../services/meta/whatsapp-embedded.service");
const whatsapp_provider_1    = require("../services/meta/whatsapp-provider.service");
const logger_1               = require("../lib/logger");
const prisma_1               = require("../lib/prisma");

// ── GET /api/whatsapp/connections/status ──────────────────────────────────────

async function getConnectionStatus(req, res) {
    try {
        const clinicId = req.clinicId;
        const status = await whatsapp_provider_1.getStatus(clinicId);
        res.json(status);
    } catch (err) {
        logger_1.logger.error("getConnectionStatus", { err });
        res.status(500).json({ error: "Failed to load WhatsApp status" });
    }
}

// ── GET /api/whatsapp/connections/config ──────────────────────────────────────
// Returns signup config for frontend. When Embedded Signup is disabled
// the response tells the frontend to show Manual connection only.

async function getSignupConfig(_req, res) {
    const config = whatsapp_embedded_1.getEmbeddedSignupConfig();
    // Always include manual connection availability
    res.json({
        ...config,
        manualConnectionAvailable: true,
    });
}

// ── POST /api/whatsapp/connections/manual ─────────────────────────────────────
// Primary connection method. Works regardless of Embedded Signup flag.
// Runs 10-step validation with real-time step progress in response.

async function connectManual(req, res) {
    const clinicId = req.clinicId;
    const { access_token, waba_id, phone_number_id, business_portfolio_id } = req.body || {};

    if (!access_token || !waba_id || !phone_number_id) {
        res.status(400).json({
            error: "Missing required fields: access_token, waba_id, phone_number_id",
            hint: "Get these from Meta App Dashboard → WhatsApp → API Setup",
        });
        return;
    }

    logger_1.logger.info("connectManual: starting validation", {
        clinicId,
        wabaId: waba_id,
        phoneNumberId: phone_number_id,
        hasToken: !!access_token,
    });

    try {
        const steps = [];
        const result = await whatsapp_manual_1.validateManualConnection(
            clinicId,
            {
                accessToken:         String(access_token),
                wabaId:              String(waba_id).trim(),
                phoneNumberId:       String(phone_number_id).trim(),
                businessPortfolioId: business_portfolio_id ? String(business_portfolio_id).trim() : "",
            },
            (stepNum, label, status, detail) => {
                steps.push({ step: stepNum, label, status, detail: detail || "" });
            }
        );

        if (!result.success) {
            const failedStep = steps.find((s) => s.status === "fail");
            res.status(400).json({
                success: false,
                error: failedStep?.detail || "Manual connection validation failed",
                steps,
            });
            return;
        }

        res.json({
            success: true,
            phoneNumber:   result.phoneNumber,
            displayName:   result.displayName,
            wabaId:        result.wabaId,
            phoneNumberId: result.phoneNumberId,
            webhookStatus: result.webhookStatus,
            steps,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger_1.logger.error("connectManual error", { clinicId, err: msg });
        // Surface encryption-key errors clearly — they need admin action, not a retry
        const isKeyError = err?.code === "ENCRYPTION_KEY_MISSING" || msg.includes("META_ENCRYPTION_KEY");
        res.status(isKeyError ? 503 : 500).json({
            success: false,
            error: msg,
            ...(isKeyError && { code: "ENCRYPTION_KEY_MISSING" }),
        });
    }
}

// ── POST /api/whatsapp/connections/embedded ───────────────────────────────────
// Meta Embedded Signup flow. Controlled by WHATSAPP_EMBEDDED_SIGNUP_ENABLED flag.
// Returns controlled error when disabled — never leaks internal errors.

async function connectEmbedded(req, res) {
    // Gate check — return controlled response when disabled
    if (!whatsapp_embedded_1.isEmbeddedSignupEnabled()) {
        res.status(403).json({
            success: false,
            enabled: false,
            code: "EMBEDDED_SIGNUP_DISABLED",
            error: "WhatsApp connection is currently unavailable. Please contact your administrator.",
        });
        return;
    }

    const clinicId = req.clinicId;
    const { code, waba_id, phone_number_id, display_phone_number } = req.body || {};

    if (!code) {
        res.status(400).json({
            success: false,
            error: "Missing OAuth code from Meta Embedded Signup",
        });
        return;
    }

    logger_1.logger.info("connectEmbedded: received code", {
        clinicId,
        wabaId: waba_id || "(not in sessionInfo)",
        phoneNumberId: phone_number_id || "(not in sessionInfo)",
    });

    try {
        const result = await whatsapp_embedded_1.exchangeEmbeddedSignupCode(
            clinicId,
            String(code),
            {
                waba_id,
                phone_number_id,
                display_phone_number,
            }
        );

        if (!result.success) {
            res.status(400).json({ success: false, error: result.error });
            return;
        }

        res.json({
            success: true,
            phoneNumber:   result.phoneNumber,
            wabaId:        result.wabaId,
            phoneNumberId: result.phoneNumberId,
            webhookStatus: result.webhookStatus,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger_1.logger.error("connectEmbedded error", { clinicId, err: msg });
        const isKeyError = err?.code === "ENCRYPTION_KEY_MISSING" || msg.includes("META_ENCRYPTION_KEY");
        res.status(isKeyError ? 503 : 500).json({
            success: false,
            ...(isKeyError && { code: "ENCRYPTION_KEY_MISSING" }),
            error: msg.includes("encryption") || isKeyError ? msg : "Embedded Signup connection failed. Try again or use Manual Connection.",
        });
    }
}

// ── DELETE /api/whatsapp/connections/disconnect ───────────────────────────────

async function disconnectWhatsApp(req, res) {
    try {
        const clinicId = req.clinicId;
        await whatsapp_connection_1.disconnectClinic(clinicId);
        logger_1.logger.info(`WhatsApp disconnected by doctor for clinic ${clinicId}`);
        res.json({ success: true });
    } catch (err) {
        logger_1.logger.error("disconnectWhatsApp", { err });
        res.status(500).json({ error: "Failed to disconnect WhatsApp" });
    }
}

// ── GET /api/whatsapp/hub ─────────────────────────────────────────────────────
// Dashboard Command Center data — stats, capabilities, recent activity summary.

async function getWhatsAppHub(req, res) {
    try {
        const clinicId = req.clinicId;

        // getStatus gracefully returns { connected: false } if ClinicWhatsAppConnection
        // table doesn't exist yet or encryption key is missing — never throws to caller.
        let status = { connected: false, provider: "none" };
        try {
            status = await whatsapp_provider_1.getStatus(clinicId);
        } catch (statusErr) {
            logger_1.logger.warn("getWhatsAppHub: getStatus failed (non-fatal)", { clinicId, err: statusErr?.message });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // All DB queries are individually guarded — missing tables return 0 instead of 500.
        async function safeCount(query) {
            try { return await query; }
            catch (_) { return 0; }
        }

        const [
            inboundToday,
            aiHandledToday,
            needsReview,
            appointmentsBooked,
            leadsHot,
        ] = await Promise.all([
            safeCount(prisma_1.prisma.message.count({
                where: { clinicId, channel: "WHATSAPP", direction: "INBOUND", createdAt: { gte: today } },
            })),
            safeCount(prisma_1.prisma.message.count({
                where: { clinicId, channel: "WHATSAPP", isHandledByAI: true, createdAt: { gte: today } },
            })),
            safeCount(prisma_1.prisma.message.count({
                where: { clinicId, channel: "WHATSAPP", needsReview: true, isRead: false },
            })),
            safeCount(prisma_1.prisma.appointment.count({
                where: { clinicId, channel: "WHATSAPP", bookedByAI: true, createdAt: { gte: today } },
            })),
            safeCount(prisma_1.prisma.lead.count({
                where: { clinicId, leadScore: "HOT", status: { notIn: ["BOOKED", "LOST"] } },
            })),
        ]);

        let clinic = null;
        try {
            clinic = await prisma_1.prisma.clinic.findUnique({
                where: { id: clinicId },
                select: { aiEnabled: true, name: true, specialty: true },
            });
        } catch (_) {}

        const embeddedConfig = whatsapp_embedded_1.getEmbeddedSignupConfig();

        res.json({
            ...status,
            clinicName: clinic?.name,
            aiEnabled:  clinic?.aiEnabled ?? true,
            stats: {
                inboundToday,
                aiHandledToday,
                needsReview,
                appointmentsBooked,
                leadsHot,
            },
            embeddedSignupEnabled: embeddedConfig.enabled === true,
            capabilities: [
                "24/7 AI receptionist — replies in seconds",
                "Book / reschedule / cancel appointments",
                "Patient CRM — lead scoring, follow-ups",
                "Multi-language replies (English / Arabic / Urdu)",
                "Staff escalation with conversation summary",
                "Missed-call recovery via WhatsApp",
            ],
        });
    } catch (err) {
        logger_1.logger.error("getWhatsAppHub", { err });
        res.status(500).json({ error: "Failed to load WhatsApp hub" });
    }
}

// ── GET /api/whatsapp/message-log ─────────────────────────────────────────────

async function getWhatsAppRecentLog(req, res) {
    try {
        const clinicId = req.clinicId;
        const messages = await prisma_1.prisma.message.findMany({
            where: { clinicId, channel: "WHATSAPP" },
            orderBy: { createdAt: "desc" },
            take: 25,
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

// ── GET|POST /api/whatsapp/verify-waba ────────────────────────────────────────
// Self-service webhook subscription health check + auto-repair.
// GET  → check only
// POST → check and auto re-subscribe if not subscribed

async function verifyWaba(req, res) {
    try {
        const clinicId = req.clinicId;
        const conn = await whatsapp_connection_1.getConnectionByClinicId(clinicId);

        if (!conn) {
            res.status(404).json({
                ok: false,
                error: "No active WhatsApp connection. Connect WhatsApp from the WhatsApp Command Center.",
            });
            return;
        }

        if (!conn.wabaId) {
            res.status(400).json({
                ok: false,
                error: "WABA ID missing. Disconnect and reconnect WhatsApp to fix this.",
            });
            return;
        }

        const status = await whatsapp_manual_1.checkWabaWebhookStatus(conn.wabaId, conn.accessToken);

        if (status.subscribed) {
            await whatsapp_connection_1.updateWebhookStatus(clinicId, "subscribed");
            res.json({
                ok: true,
                subscribed: true,
                message: "WABA is subscribed. Inbound messages will be delivered.",
                wabaId: conn.wabaId,
                phoneNumber: conn.phoneNumber,
            });
            return;
        }

        // Not subscribed — auto-repair on POST
        if (req.method === "POST") {
            const sub = await whatsapp_manual_1.subscribeWabaWebhook(conn.wabaId, conn.accessToken);
            if (sub.success) {
                await whatsapp_connection_1.updateWebhookStatus(clinicId, "subscribed");
                res.json({
                    ok: true,
                    subscribed: true,
                    message: "WABA was not subscribed — re-subscribed successfully. Inbound messages will now be delivered.",
                    wabaId: conn.wabaId,
                    phoneNumber: conn.phoneNumber,
                });
                return;
            }
            await whatsapp_connection_1.updateWebhookStatus(clinicId, "failed");
            res.status(502).json({
                ok: false,
                subscribed: false,
                error: `Re-subscription failed: ${sub.error}. Disconnect and reconnect WhatsApp, or contact support.`,
                wabaId: conn.wabaId,
            });
            return;
        }

        // GET — report only
        await whatsapp_connection_1.updateWebhookStatus(clinicId, "not_subscribed");
        res.json({
            ok: false,
            subscribed: false,
            message:
                "WABA is NOT subscribed. Inbound messages will not be delivered. " +
                "POST this endpoint to auto-fix.",
            wabaId: conn.wabaId,
            phoneNumber: conn.phoneNumber,
        });
    } catch (err) {
        logger_1.logger.error("verifyWaba", { err });
        res.status(500).json({ error: "Failed to verify WABA subscription" });
    }
}
