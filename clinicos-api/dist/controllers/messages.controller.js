"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getThread = exports.markAsRead = exports.broadcastMessage = exports.sendMessage = exports.getMessageStats = exports.listMessages = void 0;
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const twilio_service_1 = require("../services/twilio.service");
const whatsapp_provider_1 = require("../services/meta/whatsapp-provider.service");
const ai_service_1 = require("../services/ai.service");
// GET /api/messages
exports.listMessages = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { channel, unread, page = '1', limit = '30' } = req.query;
    const clinicId = req.clinicId;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const where = {
        clinicId,
        ...(channel && channel !== 'ALL' ? { channel: channel } : {}),
        ...(unread === 'true' ? { isRead: false, direction: 'INBOUND' } : {}),
    };
    // Get unique threads (latest message per patient)
    const threads = await prisma_1.prisma.message.findMany({
        where,
        include: {
            patient: { select: { id: true, fullName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
    });
    res.json(threads);
});
// GET /api/messages/stats
exports.getMessageStats = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [aiHandledToday, needsManualReply, totalToday] = await Promise.all([
        prisma_1.prisma.message.count({
            where: { clinicId, isHandledByAI: true, createdAt: { gte: today } },
        }),
        prisma_1.prisma.message.count({
            where: { clinicId, needsReview: true, isRead: false },
        }),
        prisma_1.prisma.message.count({
            where: { clinicId, createdAt: { gte: today } },
        }),
    ]);
    const responseRate = totalToday > 0 ? Math.round((aiHandledToday / totalToday) * 100) : 0;
    res.json({ aiHandledToday, needsManualReply, responseRate });
});
// POST /api/messages/send
exports.sendMessage = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { patientId, body, channel } = req.body;
    const clinicId = req.clinicId;
    const patient = await prisma_1.prisma.patient.findFirst({ where: { id: patientId, clinicId } });
    if (!patient)
        throw (0, error_middleware_1.createError)('Patient not found', 404, 'NOT_FOUND');
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { phone: true },
    });
    let providerId = null;
    let deliveryStatus = "sending";
    if (channel === "WHATSAPP") {
        providerId = await whatsapp_provider_1.sendText(clinicId, patient.phone, body);
        if (!providerId) {
            providerId = await (0, twilio_service_1.sendReply)(patient.phone, body, channel, clinicId);
        }
    } else {
        providerId = await (0, twilio_service_1.sendReply)(patient.phone, body, channel, clinicId);
    }
    deliveryStatus = providerId ? "sent" : "failed";
    if (!providerId) {
        throw (0, error_middleware_1.createError)("Failed to send. Check WhatsApp connection.", 502, "SEND_FAILED");
    }
    const message = await prisma_1.prisma.message.create({
        data: {
            clinicId,
            patientId,
            channel,
            direction: 'OUTBOUND',
            fromNumber: clinic?.phone ?? '',
            toNumber: patient.phone,
            body,
            isRead: true,
            twilioSid: providerId ?? undefined,
        },
    });
    try {
        await prisma_1.prisma.$executeRawUnsafe(
            "UPDATE `Message` SET `metaMessageId` = ?, `deliveryStatus` = ?, `senderType` = 'HUMAN' WHERE `id` = ?",
            String(providerId),
            deliveryStatus,
            message.id
        );
    } catch (_) { /* optional columns */ }
    res.status(201).json({ ...message, deliveryStatus, senderType: "HUMAN", metaMessageId: providerId });
});
// POST /api/messages/broadcast
exports.broadcastMessage = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { channel, targetGroup, messageBody } = req.body;
    const clinicId = req.clinicId;
    let patients = await prisma_1.prisma.patient.findMany({
        where: { clinicId, isActive: true },
        select: { id: true, phone: true, fullName: true },
    });
    // Filter by target group
    if (targetGroup === 'recent') {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const recentPatientIds = await prisma_1.prisma.appointment.findMany({
            where: { clinicId, dateTime: { gte: cutoff } },
            select: { patientId: true },
            distinct: ['patientId'],
        });
        const ids = recentPatientIds.map((r) => r.patientId);
        patients = patients.filter((p) => ids.includes(p.id));
    }
    let sentCount = 0;
    let failedCount = 0;
    for (const patient of patients) {
        const personalizedMsg = messageBody.replace('{{name}}', patient.fullName.split(' ')[0]);
        const sid = channel === 'WHATSAPP'
            ? await (0, twilio_service_1.sendReply)(patient.phone, personalizedMsg, 'WHATSAPP', clinicId)
            : await (0, twilio_service_1.sendReply)(patient.phone, personalizedMsg, 'SMS', clinicId);
        if (sid) {
            sentCount++;
            await prisma_1.prisma.message.create({
                data: {
                    clinicId,
                    patientId: patient.id,
                    channel,
                    direction: 'OUTBOUND',
                    fromNumber: '',
                    toNumber: patient.phone,
                    body: personalizedMsg,
                    isRead: true,
                    twilioSid: sid,
                },
            });
        }
        else {
            failedCount++;
        }
    }
    await prisma_1.prisma.broadcast.create({
        data: { clinicId, channel, targetGroup, messageBody, sentCount, failedCount },
    });
    res.json({ sentCount, failedCount, total: patients.length });
});
// PATCH /api/messages/:id/read
exports.markAsRead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const message = await prisma_1.prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message || message.clinicId !== req.clinicId) {
        throw (0, error_middleware_1.createError)('Message not found', 404, 'NOT_FOUND');
    }
    await prisma_1.prisma.message.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json({ message: 'Marked as read' });
});
// GET /api/messages/threads/:patientId
exports.getThread = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const patient = await prisma_1.prisma.patient.findFirst({
        where: { id: req.params.patientId, clinicId },
    });
    if (!patient)
        throw (0, error_middleware_1.createError)('Patient not found', 404, 'NOT_FOUND');
    const messages = await prisma_1.prisma.message.findMany({
        where: { clinicId, patientId: req.params.patientId },
        orderBy: { createdAt: 'asc' },
    });
    // Mark inbound as read
    await prisma_1.prisma.message.updateMany({
        where: { clinicId, patientId: req.params.patientId, direction: 'INBOUND', isRead: false },
        data: { isRead: true },
    });
    // Get AI suggestion for the latest message
    const lastMessages = messages
        .slice(-5)
        .map((m) => `${m.direction === 'INBOUND' ? 'Patient' : 'Clinic'}: ${m.body}`)
        .join('\n');
    const aiSuggestion = await (0, ai_service_1.generateReplySuggestion)(patient.fullName, lastMessages, '').catch(() => '');
    let extra = {};
    try {
        const rows = await prisma_1.prisma.$queryRawUnsafe(
            "SELECT `id`, `deliveryStatus`, `senderType`, `metaMessageId` FROM `Message` WHERE `clinicId` = ? AND `patientId` = ?",
            clinicId,
            req.params.patientId
        );
        if (Array.isArray(rows)) {
            rows.forEach((r) => { extra[r.id] = r; });
        }
    } catch (_) { /* columns optional */ }
    const enriched = messages.map((m) => ({
        ...m,
        deliveryStatus: extra[m.id]?.deliveryStatus || (m.direction === "OUTBOUND" ? "sent" : "delivered"),
        senderType: extra[m.id]?.senderType || (m.isHandledByAI ? "AI" : "HUMAN"),
        metaMessageId: extra[m.id]?.metaMessageId || m.metaMessageId || null,
    }));
    res.json({ patient, messages: enriched, aiSuggestion });
});
//# sourceMappingURL=messages.controller.js.map