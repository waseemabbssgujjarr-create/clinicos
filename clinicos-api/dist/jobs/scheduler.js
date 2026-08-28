"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = startScheduler;

const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1    = require("../lib/prisma");
const reminder_service_1 = require("../services/reminder.service");
const email_service_1    = require("../services/email.service");
const logger_1           = require("../lib/logger");
const date_fns_1         = require("date-fns");
// Meta WhatsApp provider — all outbound messaging goes through this
const whatsapp_provider_1 = require("../services/meta/whatsapp-provider.service");

/**
 * Clinics eligible for automated patient messaging.
 *
 * FIX: removed { whatsAppAccount: { connectionStatus: 'active' } } which was
 * referencing a Prisma relation that does not exist in schema.prisma.
 * ClinicWhatsAppConnection is now a proper Prisma model so the relation IS
 * available, but filtering here is overly broad — any clinic with AI enabled
 * or an active subscription is eligible. Webhook delivery is what actually
 * requires a WhatsApp connection; the scheduler just needs active clinics.
 */
const ACTIVE_MESSAGING_CLINIC = {
    planStatus: { in: ['ACTIVE', 'TRIALING'] },
    isActive: true,
    aiEnabled: true,
};

/**
 * Run a cron job safely — catch and log errors so the scheduler keeps running.
 */
async function safeRun(jobName, fn) {
    try {
        await fn();
    } catch (err) {
        logger_1.logger.error(`Cron job failed: ${jobName}`, { err });
    }
}

function startScheduler() {
    logger_1.logger.info('Starting background job scheduler...');

    // ─── 24h Appointment Reminders — every hour ──────────────────────────────
    node_cron_1.default.schedule('0 * * * *', () => safeRun('24h-reminders', async () => {
        const now  = new Date();
        const in24h  = (0, date_fns_1.addHours)(now, 24);
        const window = (0, date_fns_1.addMinutes)(in24h, 5);
        const appointments = await prisma_1.prisma.appointment.findMany({
            where: {
                dateTime: { gte: (0, date_fns_1.subHours)(in24h, 0), lte: window },
                status: { in: ['CONFIRMED', 'PENDING'] },
                reminder24hSent: false,
                clinic: ACTIVE_MESSAGING_CLINIC,
            },
            select: { id: true },
        });
        logger_1.logger.info(`24h reminder job: found ${appointments.length} appointments`);
        for (const appt of appointments) {
            await (0, reminder_service_1.send24hReminder)(appt.id);
        }
    }));

    // ─── 2h Appointment Reminders — every 15 minutes ─────────────────────────
    node_cron_1.default.schedule('*/15 * * * *', () => safeRun('2h-reminders', async () => {
        const now  = new Date();
        const in2h   = (0, date_fns_1.addHours)(now, 2);
        const window = (0, date_fns_1.addMinutes)(in2h, 15);
        const appointments = await prisma_1.prisma.appointment.findMany({
            where: {
                dateTime: { gte: in2h, lte: window },
                status: { in: ['CONFIRMED', 'PENDING'] },
                reminder2hSent: false,
                clinic: ACTIVE_MESSAGING_CLINIC,
            },
            select: { id: true },
        });
        for (const appt of appointments) {
            await (0, reminder_service_1.send2hReminder)(appt.id);
        }
    }));

    // ─── Review Requests — every hour ─────────────────────────────────────────
    node_cron_1.default.schedule('0 * * * *', () => safeRun('review-requests', async () => {
        const oneHourAgo  = (0, date_fns_1.subHours)(new Date(), 1);
        const twoHoursAgo = (0, date_fns_1.subHours)(new Date(), 2);
        const appointments = await prisma_1.prisma.appointment.findMany({
            where: {
                dateTime: { gte: twoHoursAgo, lte: oneHourAgo },
                status: 'COMPLETED',
                reviewSent: false,
                clinic: { googlePlaceId: { not: null }, ...ACTIVE_MESSAGING_CLINIC },
            },
            select: { id: true },
        });
        for (const appt of appointments) {
            await (0, reminder_service_1.sendReviewRequest)(appt.id);
        }
    }));

    // ─── Lapsed Patient Reactivation — every Monday at 10am ──────────────────
    // FIX: replaced Twilio sendWhatsApp with Meta WhatsApp provider.
    // Twilio is no longer the primary messaging channel — Meta Cloud API is.
    node_cron_1.default.schedule('0 10 * * 1', () => safeRun('lapsed-patients', async () => {
        const ninetyDaysAgo = (0, date_fns_1.subDays)(new Date(), 90);
        const lapsedPatients = await prisma_1.prisma.patient.findMany({
            where: {
                isActive: true,
                optedOut: false,
                clinic: ACTIVE_MESSAGING_CLINIC,
                appointments: {
                    some: { dateTime: { lt: ninetyDaysAgo } },
                    none: { dateTime: { gte: ninetyDaysAgo } },
                },
            },
            include: {
                clinic: {
                    select: {
                        id: true,
                        name: true,
                        // Only send if clinic has an active WhatsApp connection
                        whatsAppConnection: { select: { connectionStatus: true } },
                    },
                },
            },
            take: 50,
        });

        let sent = 0;
        for (const patient of lapsedPatients) {
            // Skip clinics without active WhatsApp connection
            if (patient.clinic.whatsAppConnection?.connectionStatus !== 'active') continue;

            const firstName = patient.fullName.split(' ')[0];
            const msg =
                `Hi ${firstName}! 👋 It's been a while since your last visit to ${patient.clinic.name}. ` +
                `We'd love to see you again! Reply to book your next appointment.`;

            const msgId = await whatsapp_provider_1.sendText(patient.clinicId, patient.phone, msg).catch(() => null);
            if (msgId) sent++;
        }
        logger_1.logger.info(`Lapsed patient job: sent ${sent}/${lapsedPatients.length} reactivation messages via Meta WhatsApp`);
    }));

    // ─── Daily Summary Email + AI Daily Brief — every day at 7am ─────────────
    node_cron_1.default.schedule('0 7 * * *', () => safeRun('daily-summary', async () => {
        const yesterday  = (0, date_fns_1.subDays)(new Date(), 1);
        const todayStart = (0, date_fns_1.startOfDay)(new Date());
        const todayEnd   = (0, date_fns_1.endOfDay)(new Date());
        const activeClinics = await prisma_1.prisma.clinic.findMany({
            where: { isActive: true, planStatus: { in: ['ACTIVE', 'TRIALING'] } },
            select: { id: true, email: true, ownerName: true },
        });
        const { generateDailyBrief } = await Promise.resolve().then(() => __importStar(require('../services/killer-features.service')));
        for (const clinic of activeClinics) {
            const brief = await generateDailyBrief(clinic.id).catch(() => null);
            const [todayCount, aiHandled] = await Promise.all([
                prisma_1.prisma.appointment.count({
                    where: { clinicId: clinic.id, dateTime: { gte: todayStart, lte: todayEnd } },
                }),
                prisma_1.prisma.message.count({
                    where: {
                        clinicId: clinic.id,
                        isHandledByAI: true,
                        createdAt: {
                            gte: (0, date_fns_1.startOfDay)(yesterday),
                            lte: (0, date_fns_1.endOfDay)(yesterday),
                        },
                    },
                }),
            ]);
            await (0, email_service_1.sendDailySummaryEmail)(clinic.email, clinic.ownerName, {
                todayCount,
                yesterdayMessages: aiHandled,
                aiHandled,
                briefSummary: brief?.summary,
            }).catch(() => null);
            if (brief) {
                await prisma_1.prisma.dailyBrief.update({
                    where: { id: brief.id },
                    data: { sentAt: new Date() },
                }).catch(() => null);
            }
        }
    }));

    // ─── Lost Lead Rescue — every 2 hours ────────────────────────────────────
    node_cron_1.default.schedule('0 */2 * * *', () => safeRun('lost-lead-rescue', async () => {
        const { runLostLeadRescue } = await Promise.resolve().then(() => __importStar(require('../services/killer-features.service')));
        const rescued = await runLostLeadRescue();
        logger_1.logger.info(`Lost lead rescue job: sent ${rescued} follow-ups`);
    }));

    // ─── No-Show Follow-Up — every day at 6pm ────────────────────────────────
    // FIX: replaced Twilio sendWhatsApp with Meta WhatsApp provider.
    node_cron_1.default.schedule('0 18 * * *', () => safeRun('no-show-followup', async () => {
        const today = (0, date_fns_1.startOfDay)(new Date());
        const noShows = await prisma_1.prisma.appointment.findMany({
            where: {
                dateTime: { gte: today, lte: (0, date_fns_1.endOfDay)(new Date()) },
                status: 'NO_SHOW',
                clinic: ACTIVE_MESSAGING_CLINIC,
            },
            include: {
                patient: { select: { phone: true, fullName: true, optedOut: true } },
                clinic: {
                    select: {
                        id: true,
                        name: true,
                        whatsAppConnection: { select: { connectionStatus: true } },
                    },
                },
            },
            take: 30,
        });

        let sent = 0;
        for (const appt of noShows) {
            if (appt.patient.optedOut) continue;
            if (appt.clinic.whatsAppConnection?.connectionStatus !== 'active') continue;

            const firstName = appt.patient.fullName.split(' ')[0];
            const msg =
                `Hi ${firstName}, we noticed you missed your appointment at ${appt.clinic.name} today. ` +
                `We'd love to help you reschedule. Reply with a preferred date and time.`;

            const msgId = await whatsapp_provider_1.sendText(appt.clinicId, appt.patient.phone, msg).catch(() => null);
            if (msgId) sent++;
        }
        logger_1.logger.info(`No-show follow-up job: sent ${sent} messages via Meta WhatsApp`);
    }));

    // ─── Trial Expiry Check — every day at midnight ───────────────────────────
    node_cron_1.default.schedule('0 0 * * *', () => safeRun('trial-expiry', async () => {
        const now = new Date();
        // Expire trials that have ended
        await prisma_1.prisma.clinic.updateMany({
            where: { plan: 'TRIAL', planStatus: 'TRIALING', trialEndsAt: { lt: now } },
            data: { planStatus: 'CANCELLED', isActive: false },
        });
        // Warn clinics with 3 days left
        const threeDaysFromNow = (0, date_fns_1.addHours)(now, 72);
        const trialEndingSoon = await prisma_1.prisma.clinic.findMany({
            where: {
                plan: 'TRIAL',
                planStatus: 'TRIALING',
                trialEndsAt: { gte: now, lte: threeDaysFromNow },
            },
            select: { email: true, ownerName: true, trialEndsAt: true },
        });
        for (const clinic of trialEndingSoon) {
            const daysLeft = Math.ceil(
                (clinic.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );
            await (0, email_service_1.sendTrialExpiryEmail)(clinic.email, clinic.ownerName, daysLeft).catch(() => null);
        }
    }));

    // ─── Failed Payment Reminder — every day at 9am ───────────────────────────
    node_cron_1.default.schedule('0 9 * * *', () => safeRun('payment-reminder', async () => {
        const pastDueClinics = await prisma_1.prisma.clinic.findMany({
            where: { planStatus: 'PAST_DUE', isActive: true },
            select: { email: true, ownerName: true },
        });
        for (const clinic of pastDueClinics) {
            const { sendPaymentFailedEmail } = await Promise.resolve().then(() => __importStar(require('../services/email.service')));
            await sendPaymentFailedEmail(clinic.email, clinic.ownerName).catch(() => null);
        }
    }));

    logger_1.logger.info('All cron jobs scheduled successfully');
}
//# sourceMappingURL=scheduler.js.map
