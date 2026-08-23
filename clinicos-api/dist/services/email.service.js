"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.sendWelcomeEmail = sendWelcomeEmail;
exports.sendVerificationEmail = sendVerificationEmail;
exports.sendStaffInviteEmail = sendStaffInviteEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
exports.sendPaymentFailedEmail = sendPaymentFailedEmail;
exports.sendDailySummaryEmail = sendDailySummaryEmail;
exports.sendTrialExpiryEmail = sendTrialExpiryEmail;
exports.isEmailConfigured = isEmailConfigured;
exports.verifyEmailTransport = verifyEmailTransport;
exports.resetEmailTransport = resetEmailTransport;
exports.ensureFreshSmtpConfig = ensureFreshSmtpConfig;
exports.sendTestEmail = sendTestEmail;
exports.sanitizeSmtpEnv = sanitizeSmtpEnv;
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = require("../lib/logger");
const email_templates_1 = require("../lib/email-templates");
let transporter = null;

function stripQuotes(v) {
    if (v == null) return '';
    let s = String(v).trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1);
    }
    return s.trim();
}

/** Normalize SMTP_* env values (strip quotes / whitespace). */
function sanitizeSmtpEnv() {
    ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'APP_URL', 'APP_NAME'].forEach((key) => {
        if (process.env[key] != null) process.env[key] = stripQuotes(process.env[key]);
    });
}

function isEmailConfigured() {
    sanitizeSmtpEnv();
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getSmtpPort() {
    const p = Number(process.env.SMTP_PORT ?? 465);
    return Number.isFinite(p) && p > 0 ? p : 465;
}

function resetEmailTransport() {
    transporter = null;
}

/**
 * Reload PlatformSetting into process.env, then rebuild transporter.
 * Prevents stale SMTP (e.g. old .env password + new Integrations host).
 */
async function ensureFreshSmtpConfig() {
    try {
        const platformConfig = require('./platform-config.service');
        if (platformConfig && typeof platformConfig.applyFromDatabase === 'function') {
            await platformConfig.applyFromDatabase();
        }
    }
    catch (err) {
        logger_1.logger.warn('Could not refresh PlatformSetting before email', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    sanitizeSmtpEnv();
    resetEmailTransport();
}

function getTransporter(opts) {
    sanitizeSmtpEnv();
    if (!isEmailConfigured()) {
        return null;
    }
    // Boot verify uses short timeouts so CloudLinux LVE is not held open
    const boot = opts && opts.boot;
    const connectionTimeout = boot ? 4000 : 20000;
    const greetingTimeout = boot ? 4000 : 20000;
    const socketTimeout = boot ? 8000 : 30000;
    if (!transporter || boot) {
        const port = getSmtpPort();
        const secure = port === 465;
        const tx = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST,
            port,
            secure,
            requireTLS: !secure && port === 587,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            tls: {
                rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
            },
            connectionTimeout,
            greetingTimeout,
            socketTimeout,
        });
        if (!boot) transporter = tx;
        return tx;
    }
    return transporter;
}

async function verifyEmailTransport(opts) {
    const boot = opts && opts.boot;
    try {
        // On boot: skip PlatformSetting reload (already deferred / may panic Prisma)
        if (!boot) {
            await ensureFreshSmtpConfig();
        }
        else {
            sanitizeSmtpEnv();
        }
        if (!isEmailConfigured()) {
            return { ok: false, error: 'SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in Integrations or .env' };
        }
        const tx = getTransporter(boot ? { boot: true } : undefined);
        if (!tx)
            return { ok: false, error: 'SMTP transporter could not be created' };
        await tx.verify();
        return {
            ok: true,
            host: process.env.SMTP_HOST,
            port: getSmtpPort(),
            user: process.env.SMTP_USER,
            from: process.env.SMTP_FROM || null,
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            ok: false,
            error: message,
            host: process.env.SMTP_HOST,
            port: getSmtpPort(),
            user: process.env.SMTP_USER,
        };
    }
}

function defaultFrom() {
    const brand = (0, email_templates_1.brandName)();
    const user = process.env.SMTP_USER || 'support@clinicos.workee.online';
    const raw = stripQuotes(process.env.SMTP_FROM || '');
    // Reject invalid From like "Name <clinicos.workee.online>" (no @ email)
    const hasAngleEmail = /<[^>]+@[^>]+>/.test(raw);
    const isBareEmail = /^[^\s<>]+@[^\s<>]+$/.test(raw);
    if (hasAngleEmail || isBareEmail) return raw;
    if (raw && process.env.SMTP_DEBUG === '1') {
        logger_1.logger.warn('SMTP_FROM invalid — falling back to SMTP_USER', { smtpFrom: raw });
    }
    return `${brand} <${user}>`;
}

async function sendEmail(options) {
    await ensureFreshSmtpConfig();
    if (!isEmailConfigured()) {
        const msg = 'Email not configured: set SMTP_HOST, SMTP_USER, SMTP_PASS in Superadmin → Integrations (Email)';
        logger_1.logger.error(msg);
        throw new Error(msg);
    }
    const tx = getTransporter();
    if (!tx) {
        throw new Error('SMTP transporter unavailable');
    }
    const from = defaultFrom();
    try {
        const info = await tx.sendMail({
            from,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
            replyTo: process.env.SMTP_USER || undefined,
        });
        logger_1.logger.info(`Email sent to ${options.to}: ${options.subject}`, { messageId: info.messageId, from });
        return info;
    }
    catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        logger_1.logger.error('Failed to send email', { to: options.to, subject: options.subject, error: detail, from });
        throw new Error(`Email delivery failed: ${detail}`);
    }
}

async function sendTestEmail(to) {
    const brand = (0, email_templates_1.brandName)();
    const appUrl = process.env.APP_URL || 'https://clinicos.workee.online';
    await sendEmail({
        to,
        subject: `SMTP test — ${brand}`,
        html: (0, email_templates_1.emailLayout)({
            title: 'SMTP is working',
            preheader: 'Test email from platform Integrations.',
            bodyHtml: `
        <p>This is a test message from <strong>${brand}</strong>.</p>
        <p style="color:#64748b;font-size:13px;">If you received this, verification and password-reset emails can be delivered.</p>
        <p style="color:#64748b;font-size:13px;">Host: ${process.env.SMTP_HOST} · User: ${process.env.SMTP_USER}</p>
      `,
            ctaLabel: 'Open admin →',
            ctaUrl: `${appUrl}/superadmin/integrations/`,
        }),
        text: `SMTP test from ${brand}. Host=${process.env.SMTP_HOST} User=${process.env.SMTP_USER}`,
    });
    return { ok: true, to, host: process.env.SMTP_HOST, user: process.env.SMTP_USER, from: defaultFrom() };
}

async function sendWelcomeEmail(to, doctorName, clinicName) {
    const brand = (0, email_templates_1.brandName)();
    const appUrl = process.env.APP_URL || 'https://clinicos.workee.online';
    await sendEmail({
        to,
        subject: `Welcome to ${brand}, ${doctorName}!`,
        html: (0, email_templates_1.emailLayout)({
            title: 'Your clinic is ready',
            preheader: `Welcome to ${brand} — your AI receptionist is live.`,
            bodyHtml: `
        <p>Hi <strong>Dr. ${doctorName}</strong>,</p>
        <p>Your clinic <strong>${clinicName}</strong> is registered on <strong>${brand}</strong>.</p>
        <p>Your AI receptionist can handle patient enquiries, online booking, and follow-ups 24/7.</p>
        <p style="margin-top:20px;color:#64748b;font-size:13px;">Next step: complete your dashboard setup — working hours, treatments, and your booking link.</p>
      `,
            ctaLabel: 'Open Dashboard →',
            ctaUrl: `${appUrl}/dashboard/`,
        }),
    });
}

async function sendVerificationEmail(to, name, verifyUrl) {
    const brand = (0, email_templates_1.brandName)();
    // Plain text first — HTML verify mails often miss Gmail while plain SMTP tests arrive
    const text = `Hi ${name},\n\nVerify your ${brand} account:\n\n${verifyUrl}\n\nThis link expires in 24 hours.\n`;
    await sendEmail({
        to,
        subject: `Verify your email — ${brand}`,
        text,
        html: (0, email_templates_1.emailLayout)({
            title: 'Verify your email address',
            preheader: 'Confirm your email to activate your account.',
            bodyHtml: `
        <p>Hi <strong>${name}</strong>,</p>
        <p>Thanks for joining <strong>${brand}</strong>. Please verify your email address to activate your account and sign in.</p>
        <p style="color:#64748b;font-size:13px;">This link expires in <strong>24 hours</strong>. If you did not create this account, you can ignore this email.</p>
      `,
            ctaLabel: 'Verify Email Address →',
            ctaUrl: verifyUrl,
        }),
    });
}

async function sendStaffInviteEmail(to, staffName, clinicName, inviteLink) {
    const brand = (0, email_templates_1.brandName)();
    await sendEmail({
        to,
        subject: `You're invited to ${clinicName} on ${brand}`,
        html: (0, email_templates_1.emailLayout)({
            title: "You're invited to join the team",
            preheader: `${clinicName} invited you to ${brand}.`,
            bodyHtml: `
        <p>Hi <strong>${staffName}</strong>,</p>
        <p>You've been invited to join <strong>${clinicName}</strong> as a staff member on <strong>${brand}</strong>.</p>
        <p>Click below to set your password and access the staff portal.</p>
        <p style="color:#ef4444;font-size:13px;">This invite link expires in 48 hours.</p>
      `,
            ctaLabel: 'Accept Invitation →',
            ctaUrl: inviteLink,
        }),
    });
}

async function sendPasswordResetEmail(to, resetLink) {
    const brand = (0, email_templates_1.brandName)();
    await sendEmail({
        to,
        subject: `Reset your ${brand} password`,
        html: (0, email_templates_1.emailLayout)({
            title: 'Password reset request',
            preheader: 'Reset your password — link expires in 1 hour.',
            bodyHtml: `
        <p>We received a request to reset your password.</p>
        <p style="color:#64748b;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      `,
            ctaLabel: 'Reset Password →',
            ctaUrl: resetLink,
        }),
        text: `Reset your password: ${resetLink}`,
    });
}

async function sendPaymentFailedEmail(to, doctorName) {
    const brand = (0, email_templates_1.brandName)();
    const appUrl = process.env.APP_URL || 'https://clinicos.workee.online';
    await sendEmail({
        to,
        subject: `Action required: ${brand} payment failed`,
        html: (0, email_templates_1.emailLayout)({
            title: 'Payment failed',
            bodyHtml: `<p>Hi <strong>Dr. ${doctorName}</strong>, your subscription payment failed. Please update your payment method to keep your AI receptionist running.</p>`,
            ctaLabel: 'Update Billing →',
            ctaUrl: `${appUrl}/dashboard/billing`,
        }),
    });
}

async function sendDailySummaryEmail(to, doctorName, data) {
    const appUrl = process.env.APP_URL || 'https://clinicos.workee.online';
    await sendEmail({
        to,
        subject: `Your daily clinic summary — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
        html: (0, email_templates_1.emailLayout)({
            title: `Good morning, Dr. ${doctorName}`,
            bodyHtml: `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
          <tr>
            <td width="48%" style="background:rgba(34,197,94,0.12);border-radius:12px;padding:20px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:#22c55e;">${data.todayCount}</div>
              <div style="color:#94a3b8;font-size:12px;">Appointments Today</div>
            </td>
            <td width="4%"></td>
            <td width="48%" style="background:rgba(249,115,22,0.12);border-radius:12px;padding:20px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:#F97316;">${data.aiHandled}</div>
              <div style="color:#94a3b8;font-size:12px;">AI Messages Yesterday</div>
            </td>
          </tr>
        </table>
      `,
            ctaLabel: 'View Dashboard →',
            ctaUrl: `${appUrl}/dashboard/`,
        }),
    });
}

async function sendTrialExpiryEmail(to, doctorName, daysLeft) {
    const brand = (0, email_templates_1.brandName)();
    const appUrl = process.env.APP_URL || 'https://clinicos.workee.online';
    await sendEmail({
        to,
        subject: `Your free trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
        html: (0, email_templates_1.emailLayout)({
            title: 'Your trial is almost over',
            bodyHtml: `<p>Hi <strong>Dr. ${doctorName}</strong>, your <strong>${brand}</strong> free trial ends in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>. Upgrade now to keep your AI receptionist running without interruption.</p>`,
            ctaLabel: 'Upgrade Now →',
            ctaUrl: `${appUrl}/dashboard/billing`,
        }),
    });
}
