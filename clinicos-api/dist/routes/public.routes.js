"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const patient_schemas_1 = require("../schemas/patient.schemas");
const reminder_service_1 = require("../services/reminder.service");
const notification_service_1 = require("../services/notification.service");
const ai_service_1 = require("../services/ai.service");
const ai_client_1 = require("../lib/ai-client");
const lead_service_1 = require("../services/lead.service");
const killer_features_service_1 = require("../services/killer-features.service");
const logger_1 = require("../lib/logger");
const date_fns_1 = require("date-fns");
const date_fns_2 = require("date-fns");
const router = (0, express_1.Router)();
/** Bump when public.routes.js is redeployed — verify via GET /api/public/deploy-check */
const PUBLIC_ROUTES_DEPLOY = '2026-07-30-crm-webchat-persist';
function extractCity(address) {
    if (!address)
        return null;
    const parts = String(address).split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2)
        return parts[parts.length - 1];
    return parts[0] || null;
}
function parseWorkingHours(raw) {
    try {
        return JSON.parse(raw || '{}');
    }
    catch {
        return {};
    }
}
function formatHoursRange(dayConfig) {
    if (!dayConfig?.isOpen)
        return 'Closed';
    return `${dayConfig.open || '09:00'} – ${dayConfig.close || '17:00'}`;
}
async function getClinicAvailability(clinicId, workingHoursRaw) {
    const hours = parseWorkingHours(workingHoursRaw);
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const todayConfig = hours[dayName];
    if (!todayConfig?.isOpen) {
        for (let i = 1; i <= 7; i++) {
            const d = (0, date_fns_1.addDays)(now, i);
            const dn = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            const dc = hours[dn];
            if (dc?.isOpen) {
                return {
                    status: 'next_day',
                    label: 'Next: ' + d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                    hoursToday: 'Closed today',
                    openToday: false,
                };
            }
        }
        return { status: 'closed', label: 'Closed', hoursToday: 'Closed today', openToday: false };
    }
    const [openH, openM] = (todayConfig.open || '09:00').split(':').map(Number);
    const [closeH, closeM] = (todayConfig.close || '17:00').split(':').map(Number);
    const durationMin = todayConfig.slotDuration || 30;
    const targetDate = now;
    const booked = await prisma_1.prisma.appointment.findMany({
        where: {
            clinicId,
            dateTime: { gte: (0, date_fns_1.startOfDay)(targetDate), lte: (0, date_fns_1.endOfDay)(targetDate) },
            status: { notIn: ['CANCELLED', 'NO_SHOW', 'RESCHEDULED'] },
        },
        select: { dateTime: true, durationMin: true },
    });
    let slotTime = (0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(targetDate, openH), openM);
    const closeTime = (0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(targetDate, closeH), closeM);
    let nextSlot = null;
    while ((0, date_fns_1.isBefore)(slotTime, closeTime)) {
        const slotEnd = (0, date_fns_1.addMinutes)(slotTime, durationMin);
        const isBooked = booked.some((b) => {
            const bEnd = (0, date_fns_1.addMinutes)(b.dateTime, b.durationMin);
            return slotTime < bEnd && slotEnd > b.dateTime;
        });
        if (!isBooked && (0, date_fns_1.isAfter)(slotTime, now)) {
            nextSlot = slotTime;
            break;
        }
        slotTime = (0, date_fns_1.addMinutes)(slotTime, durationMin);
    }
    const hoursToday = formatHoursRange(todayConfig);
    if (nextSlot) {
        const timeLabel = nextSlot.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return {
            status: 'available_today',
            label: 'Available today · ' + timeLabel,
            nextSlot: nextSlot.toISOString(),
            hoursToday,
            openToday: true,
        };
    }
    return {
        status: 'full_today',
        label: 'Fully booked today',
        hoursToday,
        openToday: true,
    };
}
function staffRoleLabel(role) {
    const map = { NURSE: 'Nurse / Specialist', MANAGER: 'Consultant', RECEPTIONIST: 'Reception', ASSISTANT: 'Assistant' };
    return map[role] || role;
}
/** Fast label for marketplace list — no DB query (avoids slow/hung list on shared hosting) */
function quickAvailabilityLabel(workingHoursRaw) {
    const hours = parseWorkingHours(workingHoursRaw);
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const todayConfig = hours[dayName];
    if (todayConfig?.isOpen) {
        const range = formatHoursRange(todayConfig);
        return { status: 'available_today', label: 'Open today · ' + range };
    }
    for (let i = 1; i <= 7; i++) {
        const d = (0, date_fns_1.addDays)(new Date(), i);
        const dn = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        if (hours[dn]?.isOpen) {
            return {
                status: 'next_day',
                label: 'Next: ' + d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            };
        }
    }
    return { status: 'closed', label: 'View hours on clinic page' };
}
async function buildDoctorsList(clinic) {
    const staff = await prisma_1.prisma.staffMember.findMany({
        where: { clinicId: clinic.id, isActive: true },
        select: { id: true, name: true, role: true, phone: true },
        orderBy: { name: 'asc' },
    });
    const availability = await getClinicAvailability(clinic.id, clinic.workingHours);
    const providerRoles = new Set(['NURSE', 'MANAGER']);
    const doctors = [
        {
            id: 'owner',
            name: clinic.ownerName,
            role: 'Doctor',
            specialty: clinic.specialty || 'General Practice',
            isPrimary: true,
            availability: availability.label,
            availabilityStatus: availability.status,
            hoursToday: availability.hoursToday,
        },
    ];
    for (const s of staff) {
        if (providerRoles.has(s.role)) {
            doctors.push({
                id: s.id,
                name: s.name,
                role: staffRoleLabel(s.role),
                specialty: clinic.specialty || 'General Practice',
                isPrimary: false,
                availability: availability.label,
                availabilityStatus: availability.status,
                hoursToday: availability.hoursToday,
            });
        }
    }
    return { doctors, availability, staffCount: staff.length, isMultiProvider: doctors.length > 1 };
}
function clinicPublicWhere(extra) {
    return {
        isActive: true,
        planStatus: { not: 'CANCELLED' },
        ...extra,
    };
}
/** Persist web chat turn to CRM (mirrors WhatsApp webhook path). */
async function persistWebChatToCrm(clinic, patient, userMessage, aiResponse, durationMs, inboundMsgId, recentAppts) {
    const channel = 'WEBSITE';
    await prisma_1.prisma.message.update({
        where: { id: inboundMsgId },
        data: {
            intent: aiResponse.intent,
            tags: aiResponse.tags?.length ? JSON.stringify(aiResponse.tags) : null,
        },
    });
    await (0, lead_service_1.upsertLeadFromMessage)({
        clinicId: clinic.id,
        patientId: patient.id,
        phone: patient.phone,
        fullName: patient.fullName,
        email: patient.email ?? undefined,
        enquiryReason: userMessage.slice(0, 500),
        treatmentInterest: aiResponse.treatmentInterest ?? undefined,
        intent: aiResponse.intent,
        leadScore: aiResponse.leadScore,
        source: channel,
        tags: aiResponse.tags,
    });
    if (aiResponse.leadScore) {
        await prisma_1.prisma.patient.update({
            where: { id: patient.id },
            data: { leadScore: aiResponse.leadScore.toUpperCase() },
        }).catch(() => null);
    }
    if (aiResponse.action === 'book_appointment' && aiResponse.appointmentData?.requestedDateTime) {
        try {
            const apptDateTime = (0, date_fns_2.parseISO)(aiResponse.appointmentData.requestedDateTime);
            const appt = await prisma_1.prisma.appointment.create({
                data: {
                    clinicId: clinic.id,
                    patientId: patient.id,
                    treatment: aiResponse.appointmentData.treatment ?? 'Consultation',
                    dateTime: apptDateTime,
                    durationMin: 30,
                    channel: 'ONLINE_BOOKING',
                    fee: clinic.defaultFee ?? null,
                    notes: aiResponse.appointmentData.notes ?? null,
                    bookedByAI: true,
                    status: clinic.autoConfirm ? 'CONFIRMED' : 'PENDING',
                    confirmationSent: false,
                },
            });
            await prisma_1.prisma.lead.updateMany({
                where: { clinicId: clinic.id, phone: patient.phone },
                data: { status: 'BOOKED', convertedAt: new Date(), nextFollowUpAt: null },
            });
            await (0, killer_features_service_1.markMissedCallBooked)(clinic.id, patient.phone, appt.id, Number(clinic.defaultFee ?? 0));
            await prisma_1.prisma.aILog.create({
                data: {
                    clinicId: clinic.id,
                    action: 'booked_appointment',
                    details: `Web chat booked ${aiResponse.appointmentData.treatment} for ${(0, date_fns_1.format)(apptDateTime, 'PPp')}`,
                    patientId: patient.id,
                    durationMs,
                    success: true,
                },
            });
            await (0, notification_service_1.createNotification)({
                clinicId: clinic.id,
                title: 'AI Booked Appointment (Web)',
                body: `AI booked ${patient.fullName} for ${(0, date_fns_1.format)(apptDateTime, 'MMM d h:mm a')}`,
                type: 'ai_action',
                link: '/dashboard/appointments',
            });
        }
        catch (err) {
            logger_1.logger.error('Web chat: failed to create AI appointment', { err });
        }
    }
    else if (aiResponse.action === 'cancel') {
        const upcoming = recentAppts.find((a) => ['PENDING', 'CONFIRMED'].includes(a.status));
        if (upcoming) {
            await prisma_1.prisma.appointment.update({
                where: { id: upcoming.id },
                data: { status: 'CANCELLED' },
            });
        }
    }
    else if (aiResponse.action === 'reschedule' && aiResponse.appointmentData?.requestedDateTime) {
        const upcoming = recentAppts.find((a) => ['PENDING', 'CONFIRMED'].includes(a.status));
        if (upcoming) {
            await prisma_1.prisma.appointment.update({
                where: { id: upcoming.id },
                data: {
                    dateTime: (0, date_fns_2.parseISO)(aiResponse.appointmentData.requestedDateTime),
                    status: 'RESCHEDULED',
                },
            });
        }
    }
    else if (aiResponse.action === 'escalate') {
        await prisma_1.prisma.message.update({
            where: { id: inboundMsgId },
            data: {
                needsReview: true,
                summary: aiResponse.conversationSummary,
            },
        });
        await (0, notification_service_1.createNotification)({
            clinicId: clinic.id,
            title: 'AI Needs Your Help (Web Chat)',
            body: aiResponse.conversationSummary || `Web chat from ${patient.fullName} needs staff review`,
            type: 'ai_escalate',
            link: '/dashboard/messages',
        });
    }
    await prisma_1.prisma.message.create({
        data: {
            clinicId: clinic.id,
            patientId: patient.id,
            channel,
            direction: 'OUTBOUND',
            fromNumber: clinic.phone || 'web',
            toNumber: patient.phone,
            body: aiResponse.reply,
            isHandledByAI: true,
            aiConfidence: aiResponse.confidence,
            isRead: true,
        },
    });
    await prisma_1.prisma.aILog.create({
        data: {
            clinicId: clinic.id,
            action: aiResponse.action === 'none' ? 'answered_faq' : aiResponse.action,
            details: `Web: "${userMessage.slice(0, 100)}" | Intent: ${aiResponse.intent} | Score: ${aiResponse.leadScore}`,
            patientId: patient.id,
            durationMs,
            success: true,
        },
    });
}
// ─── GET /api/public/clinics — disabled (CRM-only; no public directory) ───
router.get('/clinics', (_req, res) => {
    res.json({
        crmMode: true,
        count: 0,
        clinics: [],
        message: 'Doctors My Agency is a CRM for clinics. Patients book via their clinic\'s direct link (WhatsApp, website chat, or private booking page) — not a public directory.',
        _deploy: PUBLIC_ROUTES_DEPLOY,
    });
});
// ─── GET /api/public/deploy-check — verify public.routes.js version on disk ─
router.get('/deploy-check', (_req, res) => {
    res.json({
        ok: true,
        publicRoutesDeploy: PUBLIC_ROUTES_DEPLOY,
        clinicPublicWhere: 'isActive:true planStatus:{not:CANCELLED}',
    });
});
// ─── GET /api/public/clinics/:slug — clinic detail + doctors ────────────────
router.get('/clinics/:slug', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { bookingSlug: req.params.slug },
        select: {
            id: true, name: true, ownerName: true, specialty: true,
            address: true, phone: true, logoUrl: true, treatments: true,
            workingHours: true, defaultFee: true, isActive: true, planStatus: true,
            bookingSlug: true, aiPersonality: true, customIntroMsg: true,
        },
    });
    if (!clinic) {
        res.status(404).json({ error: 'Clinic not found', code: 'NOT_FOUND' });
        return;
    }
    if (!clinic.isActive || clinic.planStatus === 'CANCELLED') {
        res.status(403).json({
            error: 'This clinic is not currently accepting online bookings.',
            code: 'CLINIC_INACTIVE',
        });
        return;
    }
    const { doctors, availability, isMultiProvider } = await buildDoctorsList(clinic);
    const hours = parseWorkingHours(clinic.workingHours);
    const hoursSummary = Object.entries(hours).map(([day, cfg]) => ({
        day,
        label: day.charAt(0).toUpperCase() + day.slice(1),
        hours: formatHoursRange(cfg),
        isOpen: !!cfg?.isOpen,
    }));
    res.json({
        ...clinic,
        slug: clinic.bookingSlug,
        city: extractCity(clinic.address),
        doctors,
        doctorCount: doctors.length,
        isMultiProvider,
        availability,
        hoursSummary,
    });
}));
// ─── POST /api/public/clinics/:slug/ai-chat — clinic-scoped AI (persists to CRM) ─
router.post('/clinics/:slug/ai-chat', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { message = '', conversationHistory = '', sessionId = '', patientPhone = '', patientName = '' } = req.body;
    if (!message || String(message).length > 500) {
        res.status(400).json({ error: 'Message required (max 500 characters)' });
        return;
    }
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { bookingSlug: req.params.slug },
        select: {
            id: true, name: true, ownerName: true, specialty: true,
            address: true, phone: true, workingHours: true, treatments: true,
            aiPersonality: true, customIntroMsg: true, isActive: true, planStatus: true,
            aiEnabled: true, autoConfirm: true, defaultFee: true,
        },
    });
    if (!clinic || !clinic.isActive || clinic.planStatus === 'CANCELLED') {
        res.status(404).json({ error: 'Clinic not found or not accepting inquiries.' });
        return;
    }
    const visitorPhone = String(patientPhone || '').trim().replace(/\s/g, '');
    const webKey = visitorPhone || `web:${String(sessionId || 'guest').slice(0, 36)}`;
    let patient = await prisma_1.prisma.patient.findFirst({
        where: { clinicId: clinic.id, phone: webKey },
    });
    if (!patient) {
        patient = await prisma_1.prisma.patient.create({
            data: {
                clinicId: clinic.id,
                phone: webKey,
                fullName: String(patientName || '').trim() || 'Web visitor',
            },
        });
    }
    else if (patientName && patient.fullName === 'Web visitor') {
        await prisma_1.prisma.patient.update({
            where: { id: patient.id },
            data: { fullName: String(patientName).trim() },
        }).catch(() => null);
        patient.fullName = String(patientName).trim();
    }
    const inboundMsg = await prisma_1.prisma.message.create({
        data: {
            clinicId: clinic.id,
            patientId: patient.id,
            channel: 'WEBSITE',
            direction: 'INBOUND',
            fromNumber: webKey,
            toNumber: clinic.phone || 'web',
            body: String(message),
        },
    });
    const recentAppts = await prisma_1.prisma.appointment.findMany({
        where: { clinicId: clinic.id, patientId: patient.id },
        orderBy: { dateTime: 'desc' },
        take: 5,
        select: { id: true, treatment: true, dateTime: true, status: true },
    });
    const patientHistory = recentAppts.length > 0
        ? recentAppts.map((a) => `${(0, date_fns_1.format)(a.dateTime, 'MMM d, yyyy')} - ${a.treatment} (${a.status})`).join('\n')
        : 'First-time patient (web chat)';
    const { doctors } = await buildDoctorsList(clinic);
    const doctorList = doctors.map((d) => `${d.name} (${d.role}${d.specialty ? ', ' + d.specialty : ''}) — ${d.availability}`).join('; ');
    const history = String(conversationHistory || '').slice(0, 3000);
    const branding = (0, ai_client_1.getPublicAIBranding)();
    const startTime = Date.now();
    let result;
    if (!clinic.aiEnabled) {
        result = {
            reply: `Thank you for contacting ${clinic.name}. Our team will get back to you shortly.`,
            action: 'escalate',
            confidence: 0,
            intent: 'general',
            leadScore: 'warm',
            tags: ['Web Chat'],
            conversationSummary: 'AI disabled — staff follow-up needed',
        };
    }
    else {
        result = await (0, ai_service_1.processInboundMessage)({
            clinicId: clinic.id,
            clinicName: clinic.name,
            specialty: clinic.specialty || 'Medical clinic',
            phone: clinic.phone,
            address: clinic.address || '',
            workingHours: clinic.workingHours || '{}',
            treatments: (clinic.treatments || '') + (doctorList ? `\n\nDOCTORS / PROVIDERS:\n${doctorList}` : ''),
            aiPersonality: clinic.aiPersonality || 'friendly',
            customIntroMsg: clinic.customIntroMsg || `Welcome to ${clinic.name}! How can we help you today?`,
            patientPhone: webKey,
            patientHistory,
            conversationHistory: history,
        }, String(message));
    }
    const durationMs = Date.now() - startTime;
    await persistWebChatToCrm(clinic, patient, String(message), result, durationMs, inboundMsg.id, recentAppts);
    res.json({
        demo: false,
        persisted: true,
        clinicSlug: req.params.slug,
        clinicName: clinic.name,
        engine: branding.engine,
        version: branding.version,
        patientMessage: message,
        aiReply: result.reply,
        intent: result.intent,
        leadScore: result.leadScore,
        action: result.action,
        tags: result.tags,
        _deploy: PUBLIC_ROUTES_DEPLOY,
    });
}));
// ─── GET /api/public/clinic/:slug — legacy alias (booking flow) ───────────────
router.get('/clinic/:slug', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { bookingSlug: req.params.slug },
        select: {
            id: true, name: true, ownerName: true, specialty: true,
            address: true, phone: true, logoUrl: true, treatments: true,
            workingHours: true, defaultFee: true, isActive: true, planStatus: true,
            bookingSlug: true,
        },
    });
    if (!clinic) {
        res.status(404).json({ error: 'Clinic not found', code: 'NOT_FOUND' });
        return;
    }
    if (!clinic.isActive || clinic.planStatus === 'CANCELLED') {
        res.status(403).json({
            error: 'This clinic is not currently accepting online bookings.',
            code: 'CLINIC_INACTIVE',
        });
        return;
    }
    res.json(clinic);
}));
// ─── GET /api/public/slots/:slug ──────────────────────────────────────────────
router.get('/slots/:slug', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { date, duration = '30' } = req.query;
    if (!date) {
        res.status(400).json({ error: 'date parameter is required' });
        return;
    }
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { bookingSlug: req.params.slug },
        select: { id: true, workingHours: true, isActive: true },
    });
    if (!clinic || !clinic.isActive) {
        res.status(404).json({ error: 'Clinic not found' });
        return;
    }
    const targetDate = (0, date_fns_1.parseISO)(date);
    const hours = JSON.parse(clinic.workingHours ?? '{}');
    const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayConfig = hours[dayName];
    if (!dayConfig?.isOpen) {
        res.json({ slots: [] });
        return;
    }
    const [openH, openM] = (dayConfig.open || '09:00').split(':').map(Number);
    const [closeH, closeM] = (dayConfig.close || '17:00').split(':').map(Number);
    const durationMin = parseInt(duration);
    const booked = await prisma_1.prisma.appointment.findMany({
        where: {
            clinicId: clinic.id,
            dateTime: { gte: (0, date_fns_1.startOfDay)(targetDate), lte: (0, date_fns_1.endOfDay)(targetDate) },
            status: { notIn: ['CANCELLED', 'NO_SHOW', 'RESCHEDULED'] },
        },
        select: { dateTime: true, durationMin: true },
    });
    const slots = [];
    let slotTime = (0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(targetDate, openH), openM);
    const closeTime = (0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(targetDate, closeH), closeM);
    while ((0, date_fns_1.isBefore)(slotTime, closeTime)) {
        const slotEnd = (0, date_fns_1.addMinutes)(slotTime, durationMin);
        const isBooked = booked.some((b) => {
            const bEnd = (0, date_fns_1.addMinutes)(b.dateTime, b.durationMin);
            return slotTime < bEnd && slotEnd > b.dateTime;
        });
        if (!isBooked && (0, date_fns_1.isAfter)(slotTime, new Date())) {
            slots.push(slotTime.toISOString());
        }
        slotTime = (0, date_fns_1.addMinutes)(slotTime, durationMin);
    }
    res.json({ slots });
}));
// ─── POST /api/public/book/:slug ──────────────────────────────────────────────
router.post('/book/:slug', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { bookingSlug: req.params.slug },
        select: { id: true, name: true, isActive: true, planStatus: true },
    });
    if (!clinic || !clinic.isActive || clinic.planStatus === 'CANCELLED') {
        res.status(403).json({ error: 'This clinic is not currently accepting bookings.' });
        return;
    }
    const patientData = patient_schemas_1.CreatePatientSchema.parse({
        fullName: req.body.fullName,
        phone: req.body.phone,
        email: req.body.email,
    });
    // Find or create patient
    let patient = await prisma_1.prisma.patient.findUnique({
        where: { clinicId_phone: { clinicId: clinic.id, phone: patientData.phone } },
    });
    if (!patient) {
        patient = await prisma_1.prisma.patient.create({
            data: {
                clinicId: clinic.id,
                fullName: patientData.fullName,
                phone: patientData.phone,
                email: patientData.email || null,
            },
        });
    }
    const { treatment, dateTime, notes } = req.body;
    if (!treatment || !dateTime) {
        res.status(400).json({ error: 'Treatment and date/time are required' });
        return;
    }
    const start = (0, date_fns_1.parseISO)(dateTime);
    // Conflict check
    const conflict = await prisma_1.prisma.appointment.findFirst({
        where: {
            clinicId: clinic.id,
            dateTime: start,
            status: { notIn: ['CANCELLED', 'NO_SHOW', 'RESCHEDULED'] },
        },
    });
    if (conflict) {
        res.status(409).json({
            error: 'This time slot is no longer available. Please choose another time.',
        });
        return;
    }
    const appointment = await prisma_1.prisma.appointment.create({
        data: {
            clinicId: clinic.id,
            patientId: patient.id,
            treatment,
            dateTime: start,
            notes: notes || null,
            channel: 'ONLINE_BOOKING',
            bookedByAI: false,
        },
    });
    // Non-blocking side effects
    (0, reminder_service_1.sendAppointmentConfirmation)(appointment.id).catch(() => null);
    (0, notification_service_1.createNotification)({
        clinicId: clinic.id,
        title: 'New Online Booking',
        body: `${patient.fullName} booked via your booking page`,
        type: 'new_patient',
        link: '/dashboard/appointments',
    }).catch(() => null);
    res.status(201).json({
        message: '✅ Your appointment request has been sent! You will receive a WhatsApp confirmation shortly.',
        appointmentId: appointment.id,
    });
}));
// ─── POST /api/public/ai-demo — public AI receptionist demo ───────────────
router.post('/ai-demo', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { message = 'Hi, I want to book an appointment', conversationHistory = '' } = req.body;
    if (!message || String(message).length > 500) {
        res.status(400).json({ error: 'Message required (max 500 characters)' });
        return;
    }
    const history = String(conversationHistory || '').slice(0, 3000);
    const branding = (0, ai_client_1.getPublicAIBranding)();
    const result = await (0, ai_service_1.processInboundMessage)({
        clinicId: 'demo',
        clinicName: 'City Clinic (Demo)',
        specialty: 'Dental & General Practice',
        phone: '+971 4 000 0000',
        address: 'Dubai Healthcare City',
        workingHours: JSON.stringify({
            monday: { isOpen: true, open: '09:00', close: '18:00', slotDuration: 30 },
            tuesday: { isOpen: true, open: '09:00', close: '18:00', slotDuration: 30 },
            wednesday: { isOpen: true, open: '09:00', close: '18:00', slotDuration: 30 },
            thursday: { isOpen: true, open: '09:00', close: '18:00', slotDuration: 30 },
            friday: { isOpen: true, open: '09:00', close: '17:00', slotDuration: 30 },
            saturday: { isOpen: false },
            sunday: { isOpen: false },
        }),
        treatments: 'Dental cleaning ($80), Consultation ($50), Teeth whitening ($200), Root canal ($350)',
        aiPersonality: 'friendly',
        customIntroMsg: 'Welcome to City Clinic! How can we help you today?',
        patientHistory: 'New patient',
        conversationHistory: history,
    }, message);
    res.json({
        demo: true,
        engine: branding.engine,
        version: branding.version,
        patientMessage: message,
        aiReply: result.reply,
        intent: result.intent,
        leadScore: result.leadScore,
        action: result.action,
        tags: result.tags,
    });
}));
exports.default = router;
//# sourceMappingURL=public.routes.js.map