"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivateStaff = exports.updateStaff = exports.inviteStaff = exports.listStaff = void 0;
const bcrypt_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const email_service_1 = require("../services/email.service");
const date_fns_1 = require("date-fns");
const PLAN_STAFF_LIMITS = {
    TRIAL: 2,
    STARTER: 1,
    PRO: 3,
    ENTERPRISE: 10,
};
exports.PLAN_STAFF_LIMITS = PLAN_STAFF_LIMITS;
const VERIFY_HOURS = 24;
// GET /api/staff
exports.listStaff = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const staff = await prisma_1.prisma.staffMember.findMany({
        where: { clinicId: req.clinicId },
        select: {
            id: true, name: true, email: true, phone: true, role: true,
            isActive: true, lastLogin: true, createdAt: true,
            inviteToken: true, // present means invite still pending
        },
        orderBy: { createdAt: 'desc' },
    });
    const withStatus = staff.map((s) => ({
        ...s,
        status: s.inviteToken ? 'PENDING' : s.isActive ? 'ACTIVE' : 'INACTIVE',
        inviteToken: undefined, // don't expose token to frontend
    }));
    res.json(withStatus);
});
// POST /api/staff/invite
exports.inviteStaff = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name, email, role } = req.body;
    const clinicId = req.clinicId;
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: clinicId },
        select: {
            plan: true,
            name: true,
            _count: {
                select: {
                    staff: {
                        where: {
                            OR: [
                                { inviteToken: { not: null } },
                                { isActive: true },
                            ],
                        },
                    },
                },
            },
        },
    });
    if (!clinic)
        throw (0, error_middleware_1.createError)('Clinic not found', 404, 'NOT_FOUND');
    const planKey = String(clinic.plan || 'TRIAL').toUpperCase();
    const limit = PLAN_STAFF_LIMITS[planKey] ?? PLAN_STAFF_LIMITS.TRIAL ?? 2;
    if (clinic._count.staff >= limit) {
        throw (0, error_middleware_1.createError)(`Your ${clinic.plan} plan allows a maximum of ${limit} staff member${limit !== 1 ? 's' : ''}. Please upgrade to add more.`, 403, 'STAFF_LIMIT_REACHED');
    }
    const existing = await prisma_1.prisma.staffMember.findUnique({ where: { email } });
    if (existing)
        throw (0, error_middleware_1.createError)('A staff member with this email already exists', 409, 'DUPLICATE_STAFF');
    const inviteToken = crypto_1.default.randomBytes(32).toString('hex');
    const inviteExpiry = (0, date_fns_1.addHours)(new Date(), 48);
    const tempHash = await bcrypt_1.default.hash(crypto_1.default.randomBytes(16).toString('hex'), 10);
    const staff = await prisma_1.prisma.staffMember.create({
        data: {
            clinicId,
            name,
            email,
            role: role,
            passwordHash: tempHash,
            inviteToken,
            inviteExpiry,
            isActive: false, // becomes active when they set their password
        },
    });
    const appUrl = process.env.APP_URL || 'https://doctorsmyagency.com';
    const inviteLink = `${appUrl}/accept-invite/?token=${inviteToken}`;
    await (0, email_service_1.sendStaffInviteEmail)(email, name, clinic.name, inviteLink).catch(() => null);
    const verifyToken = crypto_1.default.randomBytes(32).toString('hex');
    const verifyExpires = (0, date_fns_1.addHours)(new Date(), VERIFY_HOURS);
    await prisma_1.prisma.$executeRaw `UPDATE StaffMember SET emailVerified = 0, emailVerifyToken = ${verifyToken}, emailVerifyExpires = ${verifyExpires} WHERE id = ${staff.id}`;
    const verifyUrl = `${appUrl}/verify-email/?token=${verifyToken}&email=${encodeURIComponent(email)}`;
    await (0, email_service_1.sendVerificationEmail)(email, name, verifyUrl).catch(() => null);
    res.status(201).json({ id: staff.id, name, email, role, status: 'PENDING' });
});
// PATCH /api/staff/:id
exports.updateStaff = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { role, isActive } = req.body;
    const existing = await prisma_1.prisma.staffMember.findFirst({
        where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing)
        throw (0, error_middleware_1.createError)('Staff member not found', 404, 'NOT_FOUND');
    const updated = await prisma_1.prisma.staffMember.update({
        where: { id: req.params.id },
        data: {
            ...(role && { role: role }),
            ...(isActive !== undefined && { isActive }),
        },
    });
    res.json(updated);
});
// DELETE /api/staff/:id — deactivate
exports.deactivateStaff = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const existing = await prisma_1.prisma.staffMember.findFirst({
        where: { id: req.params.id, clinicId: req.clinicId },
    });
    if (!existing)
        throw (0, error_middleware_1.createError)('Staff member not found', 404, 'NOT_FOUND');
    await prisma_1.prisma.staffMember.update({
        where: { id: req.params.id },
        data: { isActive: false },
    });
    res.json({ message: 'Staff member deactivated' });
});
//# sourceMappingURL=staff.controller.js.map