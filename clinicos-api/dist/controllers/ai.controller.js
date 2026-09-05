"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testAI = exports.testAIChat = exports.updateAIConfig = exports.getAIConfig = exports.getAIStats = exports.getAILogs = void 0;
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const settings_schemas_1 = require("../schemas/settings.schemas");
const whatsapp_provider_1 = require("../services/meta/whatsapp-provider.service");
const conversation_engine_1 = require("../services/conversation-engine.service");
const ai_client_1 = require("../lib/ai-client");
// GET /api/ai/logs
exports.getAILogs = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { page = '1', limit = '50' } = req.query;
    const clinicId = req.clinicId;
    const logs = await prisma_1.prisma.aILog.findMany({
        where: { clinicId },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
    });
    res.json(logs);
});
// GET /api/ai/stats
exports.getAIStats = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [callsHandled, apptBooked, avgDuration] = await Promise.all([
        prisma_1.prisma.aILog.count({ where: { clinicId, action: 'answered_faq' } }),
        prisma_1.prisma.aILog.count({ where: { clinicId, action: 'booked_appointment' } }),
        prisma_1.prisma.aILog.aggregate({
            where: { clinicId, durationMs: { not: null } },
            _avg: { durationMs: true },
        }),
    ]);
    res.json({
        callsHandled,
        appointmentsBooked: apptBooked,
        avgResponseTimeMs: Math.round(avgDuration._avg.durationMs ?? 0),
    });
});
// GET /api/ai/config
exports.getAIConfig = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: {
            aiEnabled: true, aiLanguage: true, aiPersonality: true,
            autoConfirm: true, reminderTiming: true, reviewTiming: true, customIntroMsg: true,
        },
    });
    res.json(clinic);
});
// PATCH /api/ai/config
exports.updateAIConfig = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = settings_schemas_1.UpdateAISettingsSchema.parse(req.body);
    const clinic = await prisma_1.prisma.clinic.update({
        where: { id: req.clinicId },
        data,
    });
    res.json(clinic);
});
// POST /api/ai/test — send a test WhatsApp message
exports.testAI = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { phone } = req.body;
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: { name: true, aiEnabled: true },
    });
    const testMessage = `👋 Hello! This is a test message from ${clinic?.name ?? 'your clinic'}'s AI receptionist. Your AI is configured and working correctly!`;
    const sid = await whatsapp_provider_1.sendText(req.clinicId, phone, testMessage);
    if (!sid) {
        res.status(502).json({ error: 'Failed to send test message. Connect WhatsApp in Dashboard → WhatsApp or check Twilio configuration.' });
        return;
    }
    res.json({ message: 'Test message sent!', sid });
});
// POST /api/ai/test-chat — test AI receptionist without WhatsApp
exports.testAIChat = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { message = 'Hi, I want to book a dental appointment tomorrow', history = [] } = req.body;
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: {
            id: true, name: true, specialty: true, phone: true, address: true,
            workingHours: true, treatments: true, aiPersonality: true, customIntroMsg: true,
            aiLanguage: true, autoConfirm: true,
        },
    });
    if (!clinic) {
        res.status(404).json({ error: 'Clinic not found' });
        return;
    }
    const historyText = Array.isArray(history)
        ? history.map((h) => {
            const role = h.role === 'assistant' || h.role === 'ai' ? 'AI' : 'Patient';
            return `${role}: ${h.content || h.text || ''}`;
        }).join('\n')
        : String(history || '');
    let profile = {};
    let customRules = [];
    try {
        const tp = require("./ai.training-profile.controller");
        profile = await tp.getProfileForEngine(clinic.id, { live: false });
    } catch (_) { /* optional */ }
    try {
        const tr = require("./ai.training-rules.controller");
        customRules = await tr.getTrainingRulesForAI(clinic.id);
    } catch (_) { /* optional */ }
    const branding = (0, ai_client_1.getPublicAIBranding)();
    const result = await conversation_engine_1.planAndGenerateReply({
        clinicId: clinic.id,
        clinicName: clinic.name,
        specialty: clinic.specialty || 'general practice',
        phone: clinic.phone,
        address: clinic.address || '',
        workingHours: clinic.workingHours || '{}',
        treatments: clinic.treatments || 'General consultations',
        aiPersonality: (profile.personality && profile.personality.tone) || clinic.aiPersonality || 'professional',
        aiLanguage: (profile.personality && profile.personality.language) || clinic.aiLanguage || 'english',
        customIntroMsg: (profile.personality && profile.personality.introMessage) || clinic.customIntroMsg || null,
        patientHistory: 'Test chat — no patient record',
        conversationHistory: historyText,
        live: false,
        trainingProfile: profile,
    }, message, {
        patientId: null,
        profile,
        customRules,
        source: 'test-chat',
    });
    res.json({
        engine: branding.engine,
        version: branding.version,
        testMessage: message,
        path: result.enginePath,
        ...result,
    });
});
//# sourceMappingURL=ai.controller.js.map