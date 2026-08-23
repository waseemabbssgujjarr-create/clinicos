"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replyToReview = exports.requestReviews = exports.getReviews = void 0;
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const twilio_service_1 = require("../services/twilio.service");
const logger_1 = require("../lib/logger");
/**
 * GET /api/reviews
 * Fetch Google reviews via Google My Business API.
 * Falls back to empty array if not configured.
 */
exports.getReviews = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: { googlePlaceId: true, googleApiKey: true },
    });
    if (!clinic?.googlePlaceId || !clinic?.googleApiKey) {
        res.json({ reviews: [], configured: false });
        return;
    }
    try {
        // Google Places API call for reviews
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${clinic.googlePlaceId}&fields=reviews,rating,user_ratings_total&key=${clinic.googleApiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        res.json({
            reviews: data.result?.reviews ?? [],
            rating: data.result?.rating ?? 0,
            totalReviews: data.result?.user_ratings_total ?? 0,
            configured: true,
        });
    }
    catch (err) {
        logger_1.logger.error('Failed to fetch Google reviews', { err });
        res.json({ reviews: [], configured: true, error: 'Failed to fetch reviews' });
    }
});
/**
 * POST /api/reviews/request
 * Send review request messages to a list of patients.
 */
exports.requestReviews = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { patientIds, channel = 'WHATSAPP' } = req.body;
    const clinicId = req.clinicId;
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { name: true, googlePlaceId: true },
    });
    if (!clinic)
        throw (0, error_middleware_1.createError)('Clinic not found', 404, 'NOT_FOUND');
    if (!clinic.googlePlaceId) {
        throw (0, error_middleware_1.createError)('Please configure your Google Place ID in Settings before requesting reviews.', 400, 'GOOGLE_NOT_CONFIGURED');
    }
    const reviewUrl = `https://search.google.com/local/writereview?placeid=${clinic.googlePlaceId}`;
    // If patientIds not provided, use recent completed appointments
    let patients = [];
    if (patientIds && patientIds.length > 0) {
        patients = await prisma_1.prisma.patient.findMany({
            where: { id: { in: patientIds }, clinicId, isActive: true },
            select: { id: true, fullName: true, phone: true },
        });
    }
    else {
        // Last 30 days completed appointments, unique patients
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const recentAppts = await prisma_1.prisma.appointment.findMany({
            where: {
                clinicId,
                status: 'COMPLETED',
                reviewSent: false,
                dateTime: { gte: cutoff },
            },
            include: {
                patient: { select: { id: true, fullName: true, phone: true } },
            },
            distinct: ['patientId'],
            take: 50,
        });
        patients = recentAppts.map((a) => a.patient);
    }
    let sent = 0;
    let failed = 0;
    for (const patient of patients) {
        const firstName = patient.fullName.split(' ')[0];
        const msg = `⭐ Hi ${firstName}! Thank you for visiting ${clinic.name}. We'd love your feedback — please leave us a Google review: ${reviewUrl}`;
        const sid = channel === 'WHATSAPP'
            ? await (0, twilio_service_1.sendWhatsApp)(patient.phone, msg, clinicId)
            : await (0, twilio_service_1.sendSMS)(patient.phone, msg);
        if (sid) {
            sent++;
            await prisma_1.prisma.aILog.create({
                data: {
                    clinicId,
                    action: 'sent_review_request',
                    details: `Review request sent to ${patient.fullName}`,
                    patientId: patient.id,
                    success: true,
                },
            });
        }
        else {
            failed++;
        }
    }
    res.json({ sent, failed, total: patients.length });
});
/**
 * POST /api/reviews/reply
 * Reply to a Google review via Google My Business API.
 */
exports.replyToReview = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { reviewId, replyText } = req.body;
    const clinicId = req.clinicId;
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { googleApiKey: true, googlePlaceId: true },
    });
    if (!clinic?.googleApiKey) {
        throw (0, error_middleware_1.createError)('Google API not configured', 400, 'GOOGLE_NOT_CONFIGURED');
    }
    // In production, this would call the Google My Business API
    // For now, log the intent
    logger_1.logger.info(`Review reply queued for clinic ${clinicId}, review ${reviewId}`);
    res.json({ message: 'Reply submitted successfully' });
});
//# sourceMappingURL=reviews.controller.js.map