"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeployCheck = exports.getPlatformStatus = exports.getFeatures = exports.getLeadScores = exports.getDailyBrief = exports.getBookingConversion = exports.updateLead = exports.getLeads = void 0;
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const ai_client_1 = require("../lib/ai-client");
const email_service_1 = require("../services/email.service");
const lead_service_1 = require("../services/lead.service");
const killer_features_service_1 = require("../services/killer-features.service");
const features_1 = require("../constants/features");
exports.getLeads = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const { status, score, page = '1', limit = '20' } = req.query;
    const where = { clinicId };
    if (status)
        where.status = status;
    if (score)
        where.leadScore = score;
    const skip = (Number(page) - 1) * Number(limit);
    const [leads, total, pipeline] = await Promise.all([
        prisma_1.prisma.lead.findMany({
            where,
            orderBy: [{ leadScore: 'asc' }, { updatedAt: 'desc' }],
            skip,
            take: Number(limit),
            include: { patient: { select: { fullName: true } } },
        }),
        prisma_1.prisma.lead.count({ where }),
        (0, lead_service_1.getLeadPipeline)(clinicId),
    ]);
    res.json({ leads, total, page: Number(page), pipeline });
});
exports.updateLead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const { id } = req.params;
    const { status, leadScore, treatmentInterest } = req.body;
    const lead = await prisma_1.prisma.lead.updateMany({
        where: { id, clinicId },
        data: {
            ...(status ? { status } : {}),
            ...(leadScore ? { leadScore } : {}),
            ...(treatmentInterest ? { treatmentInterest } : {}),
            ...(status === 'CONVERTED' ? { convertedAt: new Date() } : {}),
        },
    });
    if (lead.count === 0) {
        res.status(404).json({ error: 'Lead not found' });
        return;
    }
    const updated = await prisma_1.prisma.lead.findUnique({ where: { id } });
    res.json(updated);
});
exports.getBookingConversion = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const days = Number(req.query.days ?? 30);
    const stats = await (0, killer_features_service_1.getBookingConversionStats)(clinicId, days);
    res.json(stats);
});
exports.getDailyBrief = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    let brief = await (0, killer_features_service_1.getLatestDailyBrief)(clinicId);
    if (!brief || brief.briefDate < new Date(new Date().setHours(0, 0, 0, 0))) {
        brief = await (0, killer_features_service_1.generateDailyBrief)(clinicId);
    }
    res.json(brief);
});
exports.getLeadScores = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const [hot, warm, cold, hotLeads] = await Promise.all([
        prisma_1.prisma.lead.count({ where: { clinicId, leadScore: 'HOT', status: { notIn: ['CONVERTED', 'LOST'] } } }),
        prisma_1.prisma.lead.count({ where: { clinicId, leadScore: 'WARM', status: { notIn: ['CONVERTED', 'LOST'] } } }),
        prisma_1.prisma.lead.count({ where: { clinicId, leadScore: 'COLD', status: { notIn: ['CONVERTED', 'LOST'] } } }),
        prisma_1.prisma.lead.findMany({
            where: { clinicId, leadScore: 'HOT', status: { notIn: ['CONVERTED', 'LOST'] } },
            orderBy: { updatedAt: 'desc' },
            take: 10,
            select: { id: true, fullName: true, phone: true, treatmentInterest: true, intent: true, status: true, updatedAt: true },
        }),
    ]);
    res.json({ hot, warm, cold, hotLeads });
});
exports.getFeatures = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    res.json({
        version: 'V1',
        product: 'Doctors My Agency — AI Receptionist SaaS',
        features: features_1.FEATURES,
        signatureFeatures: features_1.SIGNATURE_FEATURES,
        leadPipeline: features_1.LEAD_PIPELINE,
    });
});
function envReady(key) {
    const v = process.env[key];
    return Boolean(v && !String(v).toLowerCase().includes('placeholder') && v !== 'REPLACE_WITH_BCRYPT_HASH');
}
exports.getDeployCheck = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const staff = require('../controllers/staff.controller');
    const superadmin = require('../controllers/superadmin.controller');
    const limits = staff.PLAN_STAFF_LIMITS || {};
    res.json({
        build: '2026-07-20-cron',
        port: process.env.PORT || 'unset',
        pid: process.pid,
        uptimeSec: Math.floor(process.uptime()),
        staffTrialLimit: limits.TRIAL ?? null,
        superadminDeleteRoute: typeof superadmin.deleteClinic === 'function',
        publicRoutesDeploy: '2026-07-30-crm-webchat-persist',
        ok: limits.TRIAL === 2 && typeof superadmin.deleteClinic === 'function',
        restartNote: 'API runs on cron port 3002 — cPanel Restart does NOT reload it. After upload visit /force-restart.php?key=DMA-SETUP-2026 then wait up to 5 min.',
    });
});
exports.getPlatformStatus = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const aiSettings = (0, ai_client_1.getAISettings)();
    let aiLive = false;
    let aiError = null;
    if (aiSettings.configured) {
        try {
            await (0, ai_client_1.testAIConnection)();
            aiLive = true;
        }
        catch (err) {
            aiError = String(err?.message || err);
        }
    }
    let smtpLive = false;
    let smtpError = null;
    if (envReady('SMTP_PASS')) {
        const smtpCheck = await (0, email_service_1.verifyEmailTransport)();
        smtpLive = smtpCheck.ok;
        smtpError = smtpCheck.error || null;
    }
    res.json({
        product: 'Doctors My Agency — AI Receptionist SaaS',
        version: 'V1',
        liveUrl: process.env.APP_URL || process.env.FRONTEND_URL || 'https://doctorsmyagency.com',
        productMode: 'crm',
        platformReady: aiLive,
        components: {
            website: { status: 'live', note: 'Landing page + registration + dashboard' },
            database: { status: 'live', note: 'MySQL connected' },
            api: { status: 'live', note: 'Node.js API on production server' },
            ai: {
                status: aiLive ? 'live' : aiSettings.configured ? 'error' : 'not_configured',
                engine: ai_client_1.getPublicAIBranding().engine,
                version: ai_client_1.getPublicAIBranding().version,
                error: aiError,
            },
            cloudinary: { status: envReady('CLOUDINARY_API_KEY') ? 'configured' : 'pending', note: 'Clinic logos & uploads' },
            email: {
                status: smtpLive ? 'live' : envReady('SMTP_PASS') ? 'error' : 'pending',
                note: 'Password reset, verification, welcome emails',
                error: smtpError,
            },
            whatsapp: { status: envReady('TWILIO_ACCOUNT_SID') ? 'configured' : 'deferred', note: 'WhatsApp messaging — coming soon' },
            stripe: { status: envReady('STRIPE_SECRET_KEY') ? 'configured' : 'pending', note: 'Subscription billing — pending' },
            instagram: { status: 'planned', note: 'Meta Business API — post-launch' },
        },
        signatureFeatures: [
            'Booking Conversion Insights',
            'AI Lead Score (Hot/Warm/Cold)',
            'AI Daily Clinic Brief',
            'Lost Lead Rescue (24–48h follow-up)',
        ],
        demoEndpoints: {
            features: '/api/leads/features',
            platformStatus: '/api/leads/platform-status',
            aiDemo: 'POST /api/public/ai-demo',
            register: '/register/',
            dashboard: '/dashboard/',
        },
        pendingForClient: [
            'Stripe API keys (subscription payments)',
        ],
        optionalLater: [
            'Twilio (WhatsApp / SMS) — coming soon',
            'Instagram DM (Meta API)',
            'Website chat widget embed',
        ],
    });
});
