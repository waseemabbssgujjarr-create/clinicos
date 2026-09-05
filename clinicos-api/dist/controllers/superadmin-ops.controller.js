"use strict";
/**
 * Superadmin inspect APIs — patients, appointments, messages, AI, users, health, audit.
 * Never returns access tokens, password hashes, or Stripe secrets.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listClinicPatients = exports.listClinicAppointments = exports.listClinicMessages = exports.listClinicActivity = exports.getClinicAI = exports.patchClinic = exports.listUsers = exports.getPlatformHealth = exports.listAudit = exports.writeAudit = void 0;

const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const crypto = require("crypto");

async function writeAudit(entry) {
    try {
        await prisma_1.prisma.$executeRawUnsafe(
            "INSERT INTO `AuditLog` (`id`,`clinicId`,`actorId`,`actorRole`,`action`,`entityType`,`entityId`,`details`,`success`,`createdAt`) VALUES (?,?,?,?,?,?,?,?,?,?)",
            "aud_" + crypto.randomBytes(10).toString("hex"),
            entry.clinicId || null,
            entry.actorId || null,
            entry.actorRole || null,
            entry.action,
            entry.entityType || null,
            entry.entityId || null,
            entry.details ? String(entry.details).slice(0, 4000) : null,
            entry.success === false ? 0 : 1,
            new Date()
        );
    } catch (_) { /* table optional */ }
}
exports.writeAudit = writeAudit;

function pageParams(req) {
    const page = Math.max(1, parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
}

exports.listClinicPatients = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.params.id;
    const { page, limit, skip } = pageParams(req);
    const search = String(req.query.search || "").trim();
    const where = {
        clinicId,
        ...(search ? { OR: [{ fullName: { contains: search } }, { phone: { contains: search } }] } : {}),
    };
    const [total, data] = await Promise.all([
        prisma_1.prisma.patient.count({ where }),
        prisma_1.prisma.patient.findMany({
            where,
            select: {
                id: true, fullName: true, phone: true, email: true, isActive: true,
                leadScore: true, createdAt: true, updatedAt: true, optedOut: true,
            },
            orderBy: { updatedAt: "desc" },
            skip,
            take: limit,
        }),
    ]);
    res.json({ data, total, page, limit });
});

exports.listClinicAppointments = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.params.id;
    const { page, limit, skip } = pageParams(req);
    const status = req.query.status;
    const where = { clinicId, ...(status ? { status } : {}) };
    const [total, data] = await Promise.all([
        prisma_1.prisma.appointment.count({ where }),
        prisma_1.prisma.appointment.findMany({
            where,
            include: { patient: { select: { id: true, fullName: true, phone: true } } },
            orderBy: { dateTime: "desc" },
            skip,
            take: limit,
        }),
    ]);
    res.json({ data, total, page, limit });
});

exports.listClinicMessages = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.params.id;
    const { page, limit, skip } = pageParams(req);
    const [total, data] = await Promise.all([
        prisma_1.prisma.message.count({ where: { clinicId } }),
        prisma_1.prisma.message.findMany({
            where: { clinicId },
            include: { patient: { select: { id: true, fullName: true, phone: true } } },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
    ]);
    res.json({ data, total, page, limit });
});

exports.listClinicActivity = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.params.id;
    const logs = await prisma_1.prisma.aILog.findMany({
        where: { clinicId },
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    res.json({ data: logs });
});

exports.getClinicAI = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.params.id;
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: clinicId },
        select: {
            aiEnabled: true, aiLanguage: true, aiPersonality: true,
            customIntroMsg: true, autoConfirm: true, treatments: true, workingHours: true,
        },
    });
    if (!clinic) throw (0, error_middleware_1.createError)("Clinic not found", 404, "NOT_FOUND");
    let profile = null;
    try {
        const tp = require("./ai.training-profile.controller");
        const rowish = await tp.getProfileForEngine(clinicId, { live: true });
        profile = rowish;
    } catch (_) { /* optional */ }
    let rules = [];
    try {
        const tr = require("./ai.training-rules.controller");
        rules = await tr.getTrainingRulesForAI(clinicId);
    } catch (_) { /* optional */ }
    const stats = {
        logs: await prisma_1.prisma.aILog.count({ where: { clinicId } }),
        failures: await prisma_1.prisma.aILog.count({ where: { clinicId, success: false } }),
    };
    res.json({ clinic, profile, rules, stats });
});

const EDITABLE = ["name", "ownerName", "phone", "email", "specialty", "address", "timezone", "isActive"];

exports.patchClinic = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinic = await prisma_1.prisma.clinic.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!clinic) throw (0, error_middleware_1.createError)("Clinic not found", 404, "NOT_FOUND");
    const data = {};
    for (const key of EDITABLE) {
        if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    if (!Object.keys(data).length) {
        res.status(400).json({ error: "No editable fields provided" });
        return;
    }
    const updated = await prisma_1.prisma.clinic.update({
        where: { id: clinic.id },
        data,
        select: {
            id: true, name: true, ownerName: true, email: true, phone: true,
            specialty: true, address: true, timezone: true, isActive: true,
        },
    });
    await writeAudit({
        clinicId: clinic.id,
        actorId: req.user && req.user.id,
        actorRole: "SUPERADMIN",
        action: "clinic.update",
        entityType: "Clinic",
        entityId: clinic.id,
        details: JSON.stringify(Object.keys(data)),
    });
    res.json(updated);
});

exports.listUsers = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { page, limit, skip } = pageParams(req);
    const search = String(req.query.search || "").trim();
    const where = search
        ? { OR: [{ name: { contains: search } }, { email: { contains: search } }, { ownerName: { contains: search } }] }
        : {};
    const [total, clinics] = await Promise.all([
        prisma_1.prisma.clinic.count({ where }),
        prisma_1.prisma.clinic.findMany({
            where,
            select: {
                id: true, name: true, ownerName: true, email: true, phone: true,
                isActive: true, plan: true, planStatus: true, createdAt: true, updatedAt: true,
                _count: { select: { staff: true, patients: true } },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
    ]);
    const staff = await prisma_1.prisma.staffMember.findMany({
        where: search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {},
        select: {
            id: true, name: true, email: true, role: true, isActive: true,
            lastLogin: true, createdAt: true, clinicId: true,
            clinic: { select: { name: true } },
        },
        take: 50,
        orderBy: { createdAt: "desc" },
    });
    res.json({
        owners: clinics.map((c) => ({
            id: c.id,
            kind: "owner",
            name: c.ownerName,
            email: c.email,
            phone: c.phone,
            clinicId: c.id,
            clinicName: c.name,
            isActive: c.isActive,
            plan: c.plan,
            planStatus: c.planStatus,
            createdAt: c.createdAt,
            lastActivity: c.updatedAt,
            staffCount: c._count.staff,
            patientCount: c._count.patients,
        })),
        staff: staff.map((s) => ({
            id: s.id,
            kind: "staff",
            name: s.name,
            email: s.email,
            clinicId: s.clinicId,
            clinicName: s.clinic && s.clinic.name,
            role: s.role,
            isActive: s.isActive,
            lastLogin: s.lastLogin,
            createdAt: s.createdAt,
        })),
        total,
        page,
        limit,
    });
});

exports.getPlatformHealth = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const dbOk = await prisma_1.prisma.$queryRaw`SELECT 1 AS ok`.then(() => true).catch(() => false);
    let waCount = 0;
    try {
        const rows = await prisma_1.prisma.$queryRawUnsafe(
            "SELECT COUNT(*) AS c FROM `ClinicWhatsAppConnection` WHERE LOWER(`connectionStatus`) = 'active'"
        );
        waCount = Number((rows && rows[0] && (rows[0].c || rows[0]["COUNT(*)"])) || 0);
    } catch (_) { /* optional */ }
    const recentFail = await prisma_1.prisma.aILog.count({
        where: { success: false, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    }).catch(() => 0);
    res.json({
        api: "healthy",
        database: dbOk ? "healthy" : "unavailable",
        whatsappConnections: waCount,
        aiFailures24h: recentFail,
        timestamp: new Date().toISOString(),
        checks: [
            { name: "API", status: "ok" },
            { name: "Database", status: dbOk ? "ok" : "error" },
            { name: "WhatsApp connections", status: waCount > 0 ? "ok" : "warn", detail: String(waCount) },
            { name: "AI failures (24h)", status: recentFail > 20 ? "warn" : "ok", detail: String(recentFail) },
        ],
    });
});

exports.listAudit = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { page, limit, skip } = pageParams(req);
    try {
        const rows = await prisma_1.prisma.$queryRawUnsafe(
            "SELECT * FROM `AuditLog` ORDER BY `createdAt` DESC LIMIT ? OFFSET ?",
            limit,
            skip
        );
        const countRows = await prisma_1.prisma.$queryRawUnsafe("SELECT COUNT(*) AS c FROM `AuditLog`");
        const total = Number((countRows && countRows[0] && (countRows[0].c || countRows[0]["COUNT(*)"])) || 0);
        res.json({ data: Array.isArray(rows) ? rows : [], total, page, limit });
    } catch (_) {
        const logs = await prisma_1.prisma.aILog.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
            skip,
        });
        res.json({ data: logs, total: logs.length, page, limit, source: "ailog" });
    }
});
