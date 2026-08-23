"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptInvite = exports.logout = exports.resetPassword = exports.forgotPassword = exports.updateMe = exports.getMe = exports.resendVerificationEmail = exports.verifyEmail = exports.superadminLogin = exports.staffLogin = exports.login = exports.register = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../lib/prisma");
const jwt_1 = require("../lib/jwt");
const password_1 = require("../lib/password");
const slugify_1 = require("../lib/slugify");
const asyncHandler_1 = require("../lib/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const auth_schemas_1 = require("../schemas/auth.schemas");
const email_service_1 = require("../services/email.service");
const logger_1 = require("../lib/logger");
const date_fns_1 = require("date-fns");
const VERIFY_HOURS = 24;
async function hasEmailVerificationColumns() {
    try {
        await prisma_1.prisma.$queryRaw `SELECT emailVerified FROM Clinic LIMIT 1`;
        return true;
    }
    catch {
        return false;
    }
}
async function setDoctorVerification(clinicId, email, ownerName) {
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const expires = (0, date_fns_1.addHours)(new Date(), VERIFY_HOURS);
    await prisma_1.prisma.$executeRaw `UPDATE Clinic SET emailVerified = 0, emailVerifyToken = ${token}, emailVerifyExpires = ${expires} WHERE id = ${clinicId}`;
    const verifyUrl = `${process.env.APP_URL || 'https://clinicos.workee.online'}/verify-email/?token=${token}&email=${encodeURIComponent(email)}`;
    let emailSent = false;
    let emailError = null;
    try {
        await (0, email_service_1.sendVerificationEmail)(email, ownerName, verifyUrl);
        emailSent = true;
    }
    catch (err) {
        emailError = err instanceof Error ? err.message : String(err);
        logger_1.logger.error('Verification email failed', { email, error: emailError });
    }
    return { token, emailSent, emailError };
}
async function isDoctorEmailVerified(clinicId) {
    if (!(await hasEmailVerificationColumns()))
        return true;
    const rows = await prisma_1.prisma.$queryRaw `SELECT emailVerified FROM Clinic WHERE id = ${clinicId} LIMIT 1`;
    const v = rows[0]?.emailVerified;
    return v === 1 || v === true;
}
async function isStaffEmailVerified(staffId) {
    if (!(await hasEmailVerificationColumns()))
        return true;
    const rows = await prisma_1.prisma.$queryRaw `SELECT emailVerified FROM StaffMember WHERE id = ${staffId} LIMIT 1`;
    const v = rows[0]?.emailVerified;
    return v === 1 || v === true;
}
// ─── POST /api/auth/register ──────────────────────────────────────────────────
exports.register = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = auth_schemas_1.RegisterSchema.parse(req.body);
    const existing = await prisma_1.prisma.clinic.findFirst({
        where: { OR: [{ email: data.email }, { phone: data.phone }] },
    });
    if (existing) {
        throw (0, error_middleware_1.createError)('An account with this email or phone already exists', 409, 'DUPLICATE_CLINIC');
    }
    let slug = data.bookingSlug || (0, slugify_1.slugify)(data.clinicName);
    if (!slug)
        slug = (0, slugify_1.slugify)(`dr-${data.ownerName}`);
    const slugExists = await prisma_1.prisma.clinic.findUnique({ where: { bookingSlug: slug } });
    if (slugExists) {
        slug = `${slug}-${Math.floor(Math.random() * 9000) + 1000}`;
    }
    const passwordHash = await (0, password_1.hashPassword)(data.password);
    const trialEndsAt = (0, date_fns_1.addDays)(new Date(), Number(process.env.TRIAL_DAYS ?? 14));
    const clinic = await prisma_1.prisma.clinic.create({
        data: {
            ownerName: data.ownerName,
            email: data.email,
            passwordHash,
            phone: data.phone,
            name: data.clinicName,
            specialty: data.specialty,
            address: data.address,
            timezone: data.timezone,
            bookingSlug: slug,
            workingHours: data.workingHours,
            treatments: data.treatments,
            plan: 'TRIAL',
            planStatus: 'TRIALING',
            trialEndsAt,
        },
    });
    if (await hasEmailVerificationColumns()) {
        const verification = await setDoctorVerification(clinic.id, clinic.email, clinic.ownerName);
        const token = (0, jwt_1.signToken)({
            id: clinic.id,
            clinicId: clinic.id,
            role: 'DOCTOR',
            email: clinic.email,
            plan: clinic.plan,
        });
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.status(201).json({
            message: verification.emailSent
                ? 'Registration successful! Please check your email to verify your account before signing in.'
                : 'Account created, but we could not send the verification email. Use Resend on the next screen or contact support.',
            requiresVerification: true,
            verificationEmailSent: verification.emailSent,
            verificationEmailError: verification.emailSent ? undefined : verification.emailError,
            email: clinic.email,
            token,
            user: {
                id: clinic.id,
                clinicId: clinic.id,
                role: 'DOCTOR',
                name: clinic.ownerName,
                email: clinic.email,
                clinicName: clinic.name,
                plan: clinic.plan,
                planStatus: clinic.planStatus,
                onboardingDone: clinic.onboardingDone,
                logoUrl: clinic.logoUrl,
            },
            clinic: {
                id: clinic.id,
                name: clinic.name,
                email: clinic.email,
                ownerName: clinic.ownerName,
                bookingSlug: clinic.bookingSlug,
            },
        });
        return;
    }
    (0, email_service_1.sendWelcomeEmail)(clinic.email, clinic.ownerName, clinic.name).catch(() => null);
    const token = (0, jwt_1.signToken)({
        id: clinic.id,
        clinicId: clinic.id,
        role: 'DOCTOR',
        email: clinic.email,
        plan: clinic.plan,
    });
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({
        message: 'Clinic registered successfully',
        token,
        user: {
            id: clinic.id,
            clinicId: clinic.id,
            role: 'DOCTOR',
            name: clinic.ownerName,
            email: clinic.email,
            clinicName: clinic.name,
            plan: clinic.plan,
            planStatus: clinic.planStatus,
            onboardingDone: clinic.onboardingDone,
            logoUrl: clinic.logoUrl,
        },
        clinic: {
            id: clinic.id,
            name: clinic.name,
            email: clinic.email,
            ownerName: clinic.ownerName,
            plan: clinic.plan,
            bookingSlug: clinic.bookingSlug,
            onboardingDone: clinic.onboardingDone,
        },
    });
});
// ─── POST /api/auth/login ─────────────────────────────────────────────────────
exports.login = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = auth_schemas_1.LoginSchema.parse(req.body);
    const clinic = await prisma_1.prisma.clinic.findUnique({ where: { email: data.email } });
    if (!clinic)
        throw (0, error_middleware_1.createError)('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    const valid = await (0, password_1.comparePassword)(data.password, clinic.passwordHash);
    if (!valid)
        throw (0, error_middleware_1.createError)('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    if (!(await isDoctorEmailVerified(clinic.id))) {
        throw (0, error_middleware_1.createError)('Please verify your email before signing in. Check your inbox or request a new verification link.', 403, 'EMAIL_NOT_VERIFIED');
    }
    if (!clinic.isActive) {
        throw (0, error_middleware_1.createError)('This clinic account has been suspended. Please contact support@clinicos.workee.online', 403, 'ACCOUNT_SUSPENDED');
    }
    const token = (0, jwt_1.signToken)({
        id: clinic.id,
        clinicId: clinic.id,
        role: 'DOCTOR',
        email: clinic.email,
        plan: clinic.plan,
    });
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({
        token,
        user: {
            id: clinic.id,
            clinicId: clinic.id,
            role: 'DOCTOR',
            name: clinic.ownerName,
            email: clinic.email,
            clinicName: clinic.name,
            plan: clinic.plan,
            planStatus: clinic.planStatus,
            onboardingDone: clinic.onboardingDone,
            logoUrl: clinic.logoUrl,
        },
    });
});
// ─── POST /api/auth/staff/login ───────────────────────────────────────────────
exports.staffLogin = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = auth_schemas_1.StaffLoginSchema.parse(req.body);
    const staff = await prisma_1.prisma.staffMember.findUnique({
        where: { email: data.email },
        include: { clinic: { select: { id: true, name: true, isActive: true, logoUrl: true } } },
    });
    if (!staff)
        throw (0, error_middleware_1.createError)('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    const valid = await (0, password_1.comparePassword)(data.password, staff.passwordHash);
    if (!valid)
        throw (0, error_middleware_1.createError)('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    if (!(await isStaffEmailVerified(staff.id))) {
        throw (0, error_middleware_1.createError)('Please verify your email before signing in. Ask your clinic admin to resend your invite.', 403, 'EMAIL_NOT_VERIFIED');
    }
    if (!staff.isActive)
        throw (0, error_middleware_1.createError)('Your account has been deactivated', 403, 'ACCOUNT_INACTIVE');
    if (!staff.clinic.isActive)
        throw (0, error_middleware_1.createError)('This clinic has been suspended', 403, 'CLINIC_SUSPENDED');
    await prisma_1.prisma.staffMember.update({
        where: { id: staff.id },
        data: { lastLogin: new Date() },
    });
    const token = (0, jwt_1.signToken)({
        id: staff.id,
        clinicId: staff.clinicId,
        role: 'STAFF',
        email: staff.email,
        staffRole: staff.role,
    });
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({
        token,
        user: {
            id: staff.id,
            clinicId: staff.clinicId,
            role: 'STAFF',
            staffRole: staff.role,
            name: staff.name,
            email: staff.email,
            clinicName: staff.clinic.name,
            logoUrl: staff.clinic.logoUrl,
        },
    });
});
// ─── POST /api/auth/superadmin/login ─────────────────────────────────────────
exports.superadminLogin = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = auth_schemas_1.LoginSchema.parse(req.body);
    const admin = await prisma_1.prisma.superAdmin.findUnique({ where: { email: data.email } });
    if (!admin)
        throw (0, error_middleware_1.createError)('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    const valid = await (0, password_1.comparePassword)(data.password, admin.passwordHash);
    if (!valid)
        throw (0, error_middleware_1.createError)('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    const token = (0, jwt_1.signToken)({
        id: admin.id,
        clinicId: '',
        role: 'SUPERADMIN',
        email: admin.email,
    });
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({
        token,
        user: { id: admin.id, name: admin.name, email: admin.email, role: 'SUPERADMIN' },
    });
});
// ─── POST /api/auth/verify-email ─────────────────────────────────────────────
exports.verifyEmail = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { token, email } = req.body;
    if (!token)
        throw (0, error_middleware_1.createError)('Verification token required', 400, 'MISSING_TOKEN');
    const clinics = await prisma_1.prisma.$queryRaw `SELECT id, email, ownerName, name, emailVerifyExpires FROM Clinic WHERE emailVerifyToken = ${token} LIMIT 1`;
    if (clinics.length) {
        const c = clinics[0];
        if (email && c.email !== email) {
            logger_1.logger.warn('Verify email param mismatch — verifying by token', { param: email, clinic: c.email });
        }
        if (c.emailVerifyExpires && new Date(c.emailVerifyExpires) < new Date())
            throw (0, error_middleware_1.createError)('Verification link expired. Request a new one.', 400, 'TOKEN_EXPIRED');
        await prisma_1.prisma.$executeRaw `UPDATE Clinic SET emailVerified = 1, emailVerifyToken = NULL, emailVerifyExpires = NULL WHERE id = ${c.id}`;
        (0, email_service_1.sendWelcomeEmail)(c.email, c.ownerName, c.name).catch(() => null);
        res.json({ message: 'Email verified successfully! You can now sign in.', email: c.email, role: 'DOCTOR' });
        return;
    }
    const staffRows = await prisma_1.prisma.$queryRaw `SELECT id, email, name, emailVerifyExpires FROM StaffMember WHERE emailVerifyToken = ${token} LIMIT 1`;
    if (!staffRows.length)
        throw (0, error_middleware_1.createError)('Invalid or already-used verification link', 400, 'INVALID_TOKEN');
    const s = staffRows[0];
    if (s.emailVerifyExpires && new Date(s.emailVerifyExpires) < new Date())
        throw (0, error_middleware_1.createError)('Verification link expired. Request a new one.', 400, 'TOKEN_EXPIRED');
    await prisma_1.prisma.$executeRaw `UPDATE StaffMember SET emailVerified = 1, emailVerifyToken = NULL, emailVerifyExpires = NULL WHERE id = ${s.id}`;
    res.json({ message: 'Email verified successfully! You can now sign in.', email: s.email, role: 'STAFF' });
});
// ─── POST /api/auth/resend-verification ──────────────────────────────────────
exports.resendVerificationEmail = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email } = req.body;
    if (!email)
        throw (0, error_middleware_1.createError)('Email required', 400, 'MISSING_EMAIL');
    const clinic = await prisma_1.prisma.clinic.findUnique({ where: { email }, select: { id: true, email: true, ownerName: true } });
    if (!clinic) {
        res.json({ found: false, message: 'No account is registered with this email address.' });
        return;
    }
    if (await isDoctorEmailVerified(clinic.id)) {
        res.json({ found: true, alreadyVerified: true, message: 'This email is already verified. You can sign in.' });
        return;
    }
    const verification = await setDoctorVerification(clinic.id, clinic.email, clinic.ownerName);
    if (!verification.emailSent) {
        res.status(503).json({
            found: true,
            error: 'We could not send the verification email. Check SMTP settings on the server or try again later.',
            code: 'EMAIL_SEND_FAILED',
            detail: verification.emailError || undefined,
        });
        return;
    }
    res.json({ found: true, message: 'Verification email sent. Please check your inbox and spam folder.' });
});
// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
exports.getMe = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (req.user?.role === 'DOCTOR') {
        const clinic = await prisma_1.prisma.clinic.findUnique({
            where: { id: req.clinicId },
            select: {
                id: true, name: true, ownerName: true, email: true, phone: true,
                specialty: true, logoUrl: true, plan: true, planStatus: true,
                bookingSlug: true, onboardingDone: true, aiEnabled: true,
                trialEndsAt: true, currentPeriodEnd: true,
            },
        });
        if (!clinic)
            throw (0, error_middleware_1.createError)('Clinic not found', 404, 'NOT_FOUND');
        const emailVerified = await isDoctorEmailVerified(clinic.id);
        res.json({ ...clinic, role: 'DOCTOR', emailVerified });
    }
    else if (req.user?.role === 'STAFF') {
        const staff = await prisma_1.prisma.staffMember.findUnique({
            where: { id: req.user.id },
            select: {
                id: true, name: true, email: true, role: true, clinicId: true,
                clinic: { select: { name: true, logoUrl: true } },
            },
        });
        if (!staff)
            throw (0, error_middleware_1.createError)('Staff not found', 404, 'NOT_FOUND');
        res.json({ ...staff, role: 'STAFF' });
    }
    else {
        throw (0, error_middleware_1.createError)('Unauthorized', 401, 'UNAUTHORIZED');
    }
});
// ─── PATCH /api/auth/me — update own profile ─────────────────────────────────
exports.updateMe = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { name, currentPassword, newPassword } = req.body;
    if (req.user?.role === 'STAFF') {
        const staff = await prisma_1.prisma.staffMember.findUnique({ where: { id: req.user.id } });
        if (!staff)
            throw (0, error_middleware_1.createError)('Not found', 404, 'NOT_FOUND');
        const updates = {};
        if (name)
            updates.name = name;
        if (newPassword) {
            if (!currentPassword)
                throw (0, error_middleware_1.createError)('Current password is required', 400, 'MISSING_FIELD');
            const valid = await (0, password_1.comparePassword)(currentPassword, staff.passwordHash);
            if (!valid)
                throw (0, error_middleware_1.createError)('Current password is incorrect', 400, 'WRONG_PASSWORD');
            updates.passwordHash = await (0, password_1.hashPassword)(newPassword);
        }
        const updated = await prisma_1.prisma.staffMember.update({
            where: { id: staff.id },
            data: updates,
        });
        res.json({ name: updated.name, email: updated.email });
    }
    else if (req.user?.role === 'DOCTOR') {
        const clinic = await prisma_1.prisma.clinic.findUnique({ where: { id: req.clinicId } });
        if (!clinic)
            throw (0, error_middleware_1.createError)('Not found', 404, 'NOT_FOUND');
        const updates = {};
        if (name)
            updates.ownerName = name;
        if (newPassword) {
            if (!currentPassword)
                throw (0, error_middleware_1.createError)('Current password is required', 400, 'MISSING_FIELD');
            const valid = await (0, password_1.comparePassword)(currentPassword, clinic.passwordHash);
            if (!valid)
                throw (0, error_middleware_1.createError)('Current password is incorrect', 400, 'WRONG_PASSWORD');
            updates.passwordHash = await (0, password_1.hashPassword)(newPassword);
        }
        const updated = await prisma_1.prisma.clinic.update({
            where: { id: clinic.id },
            data: updates,
        });
        res.json({ name: updated.ownerName, email: updated.email });
    }
    else {
        throw (0, error_middleware_1.createError)('Unauthorized', 401, 'UNAUTHORIZED');
    }
});
// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
exports.forgotPassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = auth_schemas_1.ForgotPasswordSchema.parse(req.body);
    const clinic = await prisma_1.prisma.clinic.findUnique({ where: { email: data.email } });
    const staff = !clinic
        ? await prisma_1.prisma.staffMember.findUnique({ where: { email: data.email } })
        : null;
    const admin = !clinic && !staff
        ? await prisma_1.prisma.superAdmin.findUnique({ where: { email: data.email } })
        : null;
    const recipientEmail = clinic?.email ?? staff?.email ?? admin?.email;
    if (!recipientEmail) {
        res.json({
            found: false,
            message: 'No account is registered with this email address. Please check the spelling or register a new clinic.',
        });
        return;
    }
    // Invalidate old tokens
    await prisma_1.prisma.passwordReset.updateMany({
        where: { email: recipientEmail, used: false },
        data: { used: true },
    });
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await prisma_1.prisma.passwordReset.create({
        data: { email: recipientEmail, token, expiresAt },
    });
    const appUrl = process.env.APP_URL || 'https://clinicos.workee.online';
    const resetLink = `${appUrl}/reset-password/?token=${token}&email=${encodeURIComponent(recipientEmail)}`;
    try {
        await (0, email_service_1.sendPasswordResetEmail)(recipientEmail, resetLink);
    }
    catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        logger_1.logger.error('Password reset email failed', { email: recipientEmail, error: detail });
        await prisma_1.prisma.passwordReset.updateMany({
            where: { email: recipientEmail, token, used: false },
            data: { used: true },
        });
        res.status(503).json({
            found: true,
            error: 'We could not send the reset email. Please check SMTP settings (Superadmin → Integrations → Email) or contact support.',
            code: 'EMAIL_SEND_FAILED',
            detail: process.env.SMTP_DEBUG === '1' ? detail : undefined,
        });
        return;
    }
    res.json({
        found: true,
        message: 'A password reset link has been sent to your email. Check your inbox and spam folder — the link is valid for 1 hour.',
    });
});
// ─── POST /api/auth/reset-password ───────────────────────────────────────────
exports.resetPassword = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = auth_schemas_1.ResetPasswordSchema.parse(req.body);
    const record = await prisma_1.prisma.passwordReset.findUnique({ where: { token: data.token } });
    if (!record || record.used) {
        throw (0, error_middleware_1.createError)('Invalid or already-used reset link', 400, 'INVALID_TOKEN');
    }
    if (record.expiresAt < new Date()) {
        throw (0, error_middleware_1.createError)('This reset link has expired. Please request a new one.', 400, 'TOKEN_EXPIRED');
    }
    const passwordHash = await (0, password_1.hashPassword)(data.password);
    let role = 'DOCTOR';
    const clinic = await prisma_1.prisma.clinic.findUnique({ where: { email: record.email } });
    if (clinic) {
        await prisma_1.prisma.clinic.update({ where: { id: clinic.id }, data: { passwordHash } });
        role = 'DOCTOR';
    }
    else {
        const staff = await prisma_1.prisma.staffMember.findUnique({ where: { email: record.email } });
        if (staff) {
            await prisma_1.prisma.staffMember.update({ where: { id: staff.id }, data: { passwordHash } });
            role = 'STAFF';
        }
        else {
            const admin = await prisma_1.prisma.superAdmin.findUnique({ where: { email: record.email } });
            if (!admin) {
                throw (0, error_middleware_1.createError)('Account not found for this reset link', 404, 'NOT_FOUND');
            }
            await prisma_1.prisma.superAdmin.update({ where: { id: admin.id }, data: { passwordHash } });
            role = 'SUPERADMIN';
        }
    }
    await prisma_1.prisma.passwordReset.update({ where: { id: record.id }, data: { used: true } });
    res.json({
        message: 'Password reset successfully. You can now log in.',
        role,
        loginUrl: role === 'SUPERADMIN' ? '/admin-login/' : role === 'STAFF' ? '/staff-login/' : '/doctor-login/',
    });
});
// ─── POST /api/auth/logout ────────────────────────────────────────────────────
exports.logout = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});
// ─── POST /api/auth/accept-invite ────────────────────────────────────────────
exports.acceptInvite = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { token, password } = req.body;
    const staff = await prisma_1.prisma.staffMember.findUnique({ where: { inviteToken: token } });
    if (!staff)
        throw (0, error_middleware_1.createError)('Invalid or expired invite link', 400, 'INVALID_TOKEN');
    if (staff.inviteExpiry && staff.inviteExpiry < new Date()) {
        throw (0, error_middleware_1.createError)('This invite link has expired. Ask your clinic to resend it.', 400, 'TOKEN_EXPIRED');
    }
    const passwordHash = await (0, password_1.hashPassword)(password);
    await prisma_1.prisma.staffMember.update({
        where: { id: staff.id },
        data: { passwordHash, inviteToken: null, inviteExpiry: null, isActive: true },
    });
    if (await hasEmailVerificationColumns()) {
        await prisma_1.prisma.$executeRaw `UPDATE StaffMember SET emailVerified = 1, emailVerifyToken = NULL, emailVerifyExpires = NULL WHERE id = ${staff.id}`;
    }
    res.json({ message: 'Account activated. You can now log in.' });
});
//# sourceMappingURL=auth.controller.js.map