"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testIntegrationsEmail = exports.getIntegrations = exports.saveIntegrations = exports.sendAnnouncement = exports.getRevenue = exports.overridePlan = exports.deleteClinic = exports.updateClinicStatus = exports.getClinicDetail = exports.listClinics = exports.getPlatformStats = exports.listWhatsAppClinics = exports.revokeWhatsAppClinic = void 0;
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const email_service_1 = require("../services/email.service");
const platform_config_service_1 = require("../services/platform-config.service");
const date_fns_1 = require("date-fns");
// GET /api/superadmin/stats
exports.getPlatformStats = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const now = new Date();
    const monthStart = (0, date_fns_1.startOfMonth)(now);
    const [totalClinics, activeClinics, totalPatients, totalAppointments, newThisMonth, cancelled,] = await Promise.all([
        prisma_1.prisma.clinic.count(),
        prisma_1.prisma.clinic.count({ where: { isActive: true, planStatus: 'ACTIVE' } }),
        prisma_1.prisma.patient.count(),
        prisma_1.prisma.appointment.count(),
        prisma_1.prisma.clinic.count({ where: { createdAt: { gte: monthStart } } }),
        prisma_1.prisma.clinic.count({ where: { planStatus: 'CANCELLED' } }),
    ]);
    // MRR estimate
    const mrrData = await prisma_1.prisma.clinic.groupBy({
        by: ['plan'],
        where: { planStatus: 'ACTIVE', plan: { notIn: ['TRIAL'] } },
        _count: { plan: true },
    });
    const planPrices = { STARTER: 29, PRO: 59, ENTERPRISE: 99 };
    const mrr = mrrData.reduce((sum, g) => {
        return sum + (planPrices[g.plan] ?? 0) * g._count.plan;
    }, 0);
    const recentSignups = await prisma_1.prisma.clinic.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
            id: true, name: true, ownerName: true, email: true, plan: true,
            planStatus: true, createdAt: true, specialty: true,
        },
    });
    res.json({
        totalClinics,
        activeClinics,
        totalPatients,
        totalAppointments,
        newThisMonth,
        cancelled,
        mrr,
        recentSignups,
    });
});
// GET /api/superadmin/clinics
exports.listClinics = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { search, plan, status, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const where = {
        ...(search ? {
            OR: [
                { name: { contains: search } },
                { email: { contains: search } },
                { ownerName: { contains: search } },
            ],
        } : {}),
        ...(plan ? { plan: plan } : {}),
        ...(status === 'active' ? { isActive: true } : status === 'suspended' ? { isActive: false } : {}),
    };
    const [total, clinics] = await Promise.all([
        prisma_1.prisma.clinic.count({ where }),
        prisma_1.prisma.clinic.findMany({
            where,
            select: {
                id: true, name: true, ownerName: true, email: true, specialty: true,
                plan: true, planStatus: true, isActive: true, createdAt: true,
                _count: { select: { patients: true, appointments: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
        }),
    ]);
    res.json({ data: clinics, total, page: pageNum, limit: limitNum });
});
// GET /api/superadmin/clinics/:id
exports.getClinicDetail = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: req.params.id },
        select: {
            id: true, name: true, ownerName: true, email: true, phone: true,
            specialty: true, address: true, plan: true, planStatus: true,
            isActive: true, createdAt: true, trialEndsAt: true, currentPeriodEnd: true,
            aiEnabled: true, bookingSlug: true,
            _count: { select: { patients: true, appointments: true, staff: true } },
        },
    });
    if (!clinic)
        throw (0, error_middleware_1.createError)('Clinic not found', 404, 'NOT_FOUND');
    res.json(clinic);
});
// PATCH /api/superadmin/clinics/:id/status
exports.updateClinicStatus = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { isActive } = req.body;
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: req.params.id },
        select: { id: true, name: true },
    });
    if (!clinic)
        throw (0, error_middleware_1.createError)('Clinic not found', 404, 'NOT_FOUND');
    await prisma_1.prisma.clinic.update({
        where: { id: req.params.id },
        data: {
            isActive: Boolean(isActive),
            ...(isActive ? {} : { planStatus: 'CANCELLED' }),
        },
    });
    res.json({
        message: isActive ? `"${clinic.name}" activated` : `"${clinic.name}" suspended`,
        isActive: Boolean(isActive),
    });
});
// DELETE /api/superadmin/clinics/:id — permanent removal
exports.deleteClinic = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: req.params.id },
        select: { id: true, name: true, email: true },
    });
    if (!clinic)
        throw (0, error_middleware_1.createError)('Clinic not found', 404, 'NOT_FOUND');
    const clinicId = clinic.id;
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.appointment.deleteMany({ where: { clinicId } }),
        prisma_1.prisma.message.deleteMany({ where: { clinicId } }),
        prisma_1.prisma.aILog.deleteMany({ where: { clinicId } }),
        prisma_1.prisma.notification.deleteMany({ where: { clinicId } }),
        prisma_1.prisma.broadcast.deleteMany({ where: { clinicId } }),
        prisma_1.prisma.invoice.deleteMany({ where: { clinicId } }),
        prisma_1.prisma.lead.deleteMany({ where: { clinicId } }),
        prisma_1.prisma.missedCall.deleteMany({ where: { clinicId } }),
        prisma_1.prisma.dailyBrief.deleteMany({ where: { clinicId } }),
        prisma_1.prisma.patient.deleteMany({ where: { clinicId } }),
        prisma_1.prisma.staffMember.deleteMany({ where: { clinicId } }),
        prisma_1.prisma.passwordReset.deleteMany({ where: { email: clinic.email } }),
        prisma_1.prisma.clinic.delete({ where: { id: clinicId } }),
    ]);
    res.json({ message: `"${clinic.name}" permanently deleted` });
});
// PATCH /api/superadmin/clinics/:id/plan
exports.overridePlan = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { plan, planStatus } = req.body;
    await prisma_1.prisma.clinic.update({
        where: { id: req.params.id },
        data: { plan: plan, planStatus: planStatus },
    });
    res.json({ message: 'Plan updated' });
});
// GET /api/superadmin/revenue
exports.getRevenue = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
        const month = (0, date_fns_1.subMonths)(new Date(), i);
        const clinicsActive = await prisma_1.prisma.clinic.count({
            where: {
                planStatus: 'ACTIVE',
                plan: { notIn: ['TRIAL'] },
                createdAt: { lte: (0, date_fns_1.endOfMonth)(month) },
            },
        });
        // Estimate revenue (real data would come from Stripe)
        monthlyData.push({
            month: month.toISOString().slice(0, 7),
            estimatedRevenue: clinicsActive * 44, // average of plan prices
        });
    }
    // Plan distribution
    const distribution = await prisma_1.prisma.clinic.groupBy({
        by: ['plan'],
        _count: { plan: true },
    });
    res.json({ monthly: monthlyData, distribution });
});
// POST /api/superadmin/announce
exports.sendAnnouncement = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { subject, body } = req.body;
    const clinics = await prisma_1.prisma.clinic.findMany({
        where: { isActive: true },
        select: { email: true, ownerName: true },
    });
    let sent = 0;
    for (const clinic of clinics) {
        await (0, email_service_1.sendEmail)({
            to: clinic.email,
            subject,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1e293b;">${subject}</h2>
          <div style="color: #64748b; white-space: pre-wrap;">${body}</div>
          <hr style="margin: 24px 0; border-color: #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px;">MediCore AI Platform Announcement</p>
        </div>
      `,
        }).catch(() => null);
        sent++;
    }
    res.json({ sent, total: clinics.length });
});
// GET /api/superadmin/integrations
exports.getIntegrations = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const payload = await (0, platform_config_service_1.getIntegrationsPayload)();
    let smtpLive = null;
    try {
        const email = require('../services/email.service');
        smtpLive = await email.verifyEmailTransport();
        if (payload.groups && payload.groups.email) {
            if (smtpLive && smtpLive.ok) {
                payload.groups.email.status = 'ready';
                payload.groups.email.liveOk = true;
            }
            else {
                payload.groups.email.status = payload.groups.email.configured ? 'partial' : 'empty';
                payload.groups.email.liveOk = false;
                payload.groups.email.liveError = smtpLive && smtpLive.error ? smtpLive.error : 'SMTP verify failed';
            }
        }
    }
    catch (err) {
        smtpLive = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    res.json({ ...payload, smtpLive });
});
// PUT /api/superadmin/integrations
exports.saveIntegrations = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const updates = req.body && typeof req.body === 'object' ? (req.body.settings || req.body) : {};
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        throw new error_middleware_1.AppError('Body must be { settings: { KEY: value } }', 400);
    }
    const updatedBy = (req.user && (req.user.email || req.user.sub || req.user.id)) || null;
    const result = await (0, platform_config_service_1.upsertSettings)(updates, updatedBy);
    try {
        const email = require('../services/email.service');
        if (typeof email.resetEmailTransport === 'function') email.resetEmailTransport();
        if (typeof email.sanitizeSmtpEnv === 'function') email.sanitizeSmtpEnv();
    }
    catch (_) { /* ignore */ }
    const payload = await (0, platform_config_service_1.getIntegrationsPayload)();
    res.json({ ok: true, ...result, integrations: payload });
});
// POST /api/superadmin/integrations/test-email
exports.testIntegrationsEmail = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const to = (req.body && req.body.to) || (req.user && req.user.email);
    if (!to || typeof to !== 'string' || !to.includes('@')) {
        throw new error_middleware_1.AppError('Provide { to: "email@domain.com" }', 400);
    }
    const email = require('../services/email.service');
    try {
        const result = await email.sendTestEmail(to.trim());
        res.json({ ok: true, message: 'Test email sent. Check inbox and spam.', ...result });
    }
    catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        res.status(503).json({
            ok: false,
            error: detail,
            code: 'EMAIL_SEND_FAILED',
            hint: 'Re-enter SMTP password on Integrations (must match the mailbox for SMTP username), Save, then retry. Port 465 SSL or 587 STARTTLS.',
        });
    }
});
exports.listWhatsAppClinics = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const meta = require('../services/meta-whatsapp.service');
    await meta.ensureWhatsAppTable();
    const rows = await prisma_1.prisma.$queryRawUnsafe(`
    SELECT c.id, c.name, c.email, c.ownerName, c.plan, c.planStatus, c.isActive,
           w.displayPhoneNumber, w.wabaId, w.phoneNumberId, w.connectionStatus, w.connectedAt
    FROM Clinic c
    LEFT JOIN ClinicWhatsAppAccount w ON w.clinicId = c.id AND w.connectionStatus = 'active'
    ORDER BY w.connectedAt DESC, c.createdAt DESC
    LIMIT 500
  `);
    const list = Array.isArray(rows) ? rows : [];
    const enriched = await Promise.all(list.map(async (row) => {
        const msgCount = await prisma_1.prisma.message.count({
            where: { clinicId: row.id, channel: 'WHATSAPP' },
        }).catch(() => 0);
        return { ...row, whatsappMessages: msgCount, connected: !!row.phoneNumberId };
    }));
    res.json({
        total: enriched.length,
        connected: enriched.filter((r) => r.connected).length,
        clinics: enriched,
    });
});
exports.revokeWhatsAppClinic = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const meta = require('../services/meta-whatsapp.service');
    await meta.disconnectClinicWhatsApp(req.params.id);
    res.json({ success: true });
});
//# sourceMappingURL=superadmin.controller.js.map