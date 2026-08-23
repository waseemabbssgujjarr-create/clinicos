"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const jwt_1 = require("../lib/jwt");
const twilio_service_1 = require("../services/twilio.service");
const router = (0, express_1.Router)();
// POST /api/patient/request-otp
router.post('/request-otp', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { phone } = req.body;
    if (!phone) {
        res.status(400).json({ error: 'Phone number is required' });
        return;
    }
    // Find all patients with this phone across all clinics
    const patients = await prisma_1.prisma.patient.findMany({
        where: { phone },
        include: { clinic: { select: { name: true } } },
    });
    if (patients.length === 0) {
        // Don't reveal if patient exists
        res.json({ message: 'If this number is registered, an OTP has been sent.' });
        return;
    }
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const token = Buffer.from(JSON.stringify({ phone, otp, exp: expiry.getTime() })).toString('base64');
    // Send OTP via SMS
    await (0, twilio_service_1.sendSMS)(phone, `Your MediCore AI verification code is: ${otp}. Valid for 10 minutes.`).catch(() => null);
    // We return a session token so client can match it on verify
    res.json({ message: 'OTP sent', sessionToken: token });
}));
// POST /api/patient/verify-otp
router.post('/verify-otp', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { otp, sessionToken, clinicSlug } = req.body;
    let decoded;
    try {
        decoded = JSON.parse(Buffer.from(sessionToken, 'base64').toString());
    }
    catch {
        throw (0, error_middleware_1.createError)('Invalid session', 400, 'INVALID_SESSION');
    }
    if (Date.now() > decoded.exp)
        throw (0, error_middleware_1.createError)('OTP expired', 400, 'OTP_EXPIRED');
    if (decoded.otp !== otp)
        throw (0, error_middleware_1.createError)('Invalid OTP', 400, 'INVALID_OTP');
    // Find patient — if clinicSlug is provided, filter to that clinic
    const whereClause = clinicSlug
        ? {
            phone: decoded.phone,
            clinic: { bookingSlug: clinicSlug },
        }
        : { phone: decoded.phone };
    const patient = await prisma_1.prisma.patient.findFirst({
        where: whereClause,
        include: { clinic: { select: { name: true, id: true } } },
    });
    if (!patient)
        throw (0, error_middleware_1.createError)('Patient not found', 404, 'NOT_FOUND');
    const token = (0, jwt_1.signToken)({
        id: patient.id,
        clinicId: patient.clinicId,
        role: 'STAFF', // reuse role mechanism, identify by id lookup
        email: patient.email ?? '',
    });
    res.json({
        token,
        patient: {
            id: patient.id,
            fullName: patient.fullName,
            phone: patient.phone,
            clinicName: patient.clinic.name,
        },
    });
}));
// GET /api/patient/appointments — patient JWT required
router.get('/appointments', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        throw (0, error_middleware_1.createError)('Authentication required', 401, 'NO_TOKEN');
    }
    const token = authHeader.split(' ')[1];
    const payload = (0, jwt_1.verifyToken)(token);
    const appointments = await prisma_1.prisma.appointment.findMany({
        where: { patientId: payload.id, clinicId: payload.clinicId },
        orderBy: { dateTime: 'desc' },
        include: { clinic: { select: { name: true, phone: true, address: true } } },
    });
    res.json(appointments);
}));
// PATCH /api/patient/appointments/:id/cancel — patient self-cancel
router.patch('/appointments/:id/cancel', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        throw (0, error_middleware_1.createError)('Authentication required', 401, 'NO_TOKEN');
    }
    const token = authHeader.split(' ')[1];
    const payload = (0, jwt_1.verifyToken)(token);
    const appointment = await prisma_1.prisma.appointment.findFirst({
        where: { id: req.params.id, patientId: payload.id },
    });
    if (!appointment)
        throw (0, error_middleware_1.createError)('Appointment not found', 404, 'NOT_FOUND');
    // Cannot cancel if less than 2 hours away
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    if (appointment.dateTime <= twoHoursFromNow) {
        throw (0, error_middleware_1.createError)('Appointments can only be cancelled more than 2 hours in advance. Please call the clinic directly.', 400, 'TOO_LATE_TO_CANCEL');
    }
    await prisma_1.prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: 'CANCELLED' },
    });
    res.json({ message: 'Appointment cancelled successfully' });
}));
exports.default = router;
//# sourceMappingURL=patient.routes.js.map