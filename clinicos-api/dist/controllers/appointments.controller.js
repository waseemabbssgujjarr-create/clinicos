"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableSlots = exports.cancelAppointment = exports.updateAppointment = exports.getAppointment = exports.createAppointment = exports.listAppointments = void 0;
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const appointment_schemas_1 = require("../schemas/appointment.schemas");
const reminder_service_1 = require("../services/reminder.service");
const notification_service_1 = require("../services/notification.service");
const schedule_service_1 = require("../services/schedule.service");
const roster_service_1 = require("../services/roster.service");
const clinical_service_1 = require("../services/clinical.service");
const audit_service_1 = require("../services/audit.service");
const date_fns_1 = require("date-fns");
// GET /api/appointments
exports.listAppointments = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { date, status, page = '1', limit = '20', filter } = req.query;
    const clinicId = req.clinicId;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    let dateFilter = {};
    const today = new Date();
    if (filter === 'today') {
        dateFilter = { gte: (0, date_fns_1.startOfDay)(today), lte: (0, date_fns_1.endOfDay)(today) };
    }
    else if (filter === 'tomorrow') {
        const tomorrow = (0, date_fns_1.addDays)(today, 1);
        dateFilter = { gte: (0, date_fns_1.startOfDay)(tomorrow), lte: (0, date_fns_1.endOfDay)(tomorrow) };
    }
    else if (filter === 'week') {
        dateFilter = { gte: (0, date_fns_1.startOfWeek)(today), lte: (0, date_fns_1.endOfWeek)(today) };
    }
    else if (filter === 'month') {
        dateFilter = { gte: (0, date_fns_1.startOfMonth)(today), lte: (0, date_fns_1.endOfMonth)(today) };
    }
    else if (date) {
        const d = (0, date_fns_1.parseISO)(date);
        dateFilter = { gte: (0, date_fns_1.startOfDay)(d), lte: (0, date_fns_1.endOfDay)(d) };
    }
    const where = {
        clinicId,
        ...(Object.keys(dateFilter).length > 0 ? { dateTime: dateFilter } : {}),
        ...(status ? { status: status } : {}),
    };
    const [total, appointments] = await Promise.all([
        prisma_1.prisma.appointment.count({ where }),
        prisma_1.prisma.appointment.findMany({
            where,
            include: {
                patient: { select: { id: true, fullName: true, phone: true, email: true } },
                practitioner: { select: { id: true, name: true, specialty: true } },
                location: { select: { id: true, name: true } },
                room: { select: { id: true, name: true, status: true } },
            },
            orderBy: { dateTime: 'asc' },
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
        }),
    ]);
    res.json({ data: appointments, total, page: pageNum, limit: limitNum });
});
// POST /api/appointments
exports.createAppointment = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = appointment_schemas_1.CreateAppointmentSchema.parse(req.body);
    const clinicId = req.clinicId;
    // Verify patient belongs to this clinic
    const patient = await prisma_1.prisma.patient.findFirst({
        where: { id: data.patientId, clinicId },
    });
    if (!patient)
        throw (0, error_middleware_1.createError)('Patient not found', 404, 'PATIENT_NOT_FOUND');
    const roster = await (0, roster_service_1.ensureClinicRoster)(clinicId);
    const practitionerId = data.practitionerId || (roster.primaryPractitioner && roster.primaryPractitioner.id) || null;
    const locationId = data.locationId || (roster.primaryLocation && roster.primaryLocation.id) || null;
    const start = (0, date_fns_1.parseISO)(data.dateTime);
    const conflict = await (0, schedule_service_1.findSlotConflict)(clinicId, start, data.durationMin, {
        practitionerId,
        locationId,
        roomId: data.roomId,
    });
    if (conflict)
        throw (0, error_middleware_1.createError)('This time slot is already booked', 409, 'SLOT_CONFLICT');
    const appointment = await prisma_1.prisma.appointment.create({
        data: {
            clinicId,
            patientId: data.patientId,
            practitionerId,
            locationId,
            roomId: data.roomId || null,
            treatment: data.treatment,
            dateTime: start,
            durationMin: data.durationMin,
            fee: data.fee,
            notes: data.notes,
            channel: data.channel,
            bookedByStaffId: req.user?.role === 'STAFF' ? req.user.id : null,
        },
        include: { patient: true, practitioner: true, location: true },
    });
    // Send WhatsApp confirmation (non-blocking)
    if (data.sendConfirmation) {
        (0, reminder_service_1.sendAppointmentConfirmation)(appointment.id).catch(() => null);
    }
    // Notify clinic dashboard
    await (0, notification_service_1.createNotification)({
        clinicId,
        title: 'New Appointment',
        body: `New appointment booked for ${patient.fullName}`,
        type: 'ai_action',
        link: '/dashboard/appointments',
    });
    res.status(201).json(appointment);
});
// GET /api/appointments/:id
exports.getAppointment = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const appointment = await prisma_1.prisma.appointment.findUnique({
        where: { id: req.params.id },
        include: {
            patient: { select: { id: true, fullName: true, phone: true, email: true, medicalNotes: true, allergies: true, dateOfBirth: true, gender: true } },
            practitioner: { select: { id: true, name: true, specialty: true } },
            location: { select: { id: true, name: true } },
            room: { select: { id: true, name: true, status: true } },
        },
    });
    if (!appointment || appointment.clinicId !== req.clinicId) {
        throw (0, error_middleware_1.createError)('Appointment not found', 404, 'NOT_FOUND');
    }
    let clinical = null;
    try {
        const enc = await (0, clinical_service_1.getOrCreateEncounter)(appointment, (0, audit_service_1.actorOf)(req));
        clinical = (0, clinical_service_1.toClinicalDto)(enc, appointment);
    }
    catch (_) { /* tables may not exist yet */ }
    res.json({ ...appointment, clinical });
});
// PATCH /api/appointments/:id
exports.updateAppointment = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = appointment_schemas_1.UpdateAppointmentSchema.parse(req.body);
    const existing = await prisma_1.prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.clinicId !== req.clinicId) {
        throw (0, error_middleware_1.createError)('Appointment not found', 404, 'NOT_FOUND');
    }
    const dateChanged = !!(data.dateTime && (0, date_fns_1.parseISO)(data.dateTime).getTime() !== existing.dateTime.getTime());
    if (data.dateTime || data.durationMin || data.practitionerId || data.roomId) {
        const start = data.dateTime ? (0, date_fns_1.parseISO)(data.dateTime) : existing.dateTime;
        const duration = data.durationMin || existing.durationMin;
        const conflict = await (0, schedule_service_1.findSlotConflict)(req.clinicId, start, duration, {
            ignoreId: existing.id,
            practitionerId: data.practitionerId || existing.practitionerId,
            locationId: data.locationId || existing.locationId,
            roomId: data.roomId || existing.roomId,
        });
        if (conflict)
            throw (0, error_middleware_1.createError)('This time slot is already booked', 409, 'SLOT_CONFLICT');
    }
    const appointment = await prisma_1.prisma.appointment.update({
        where: { id: req.params.id },
        data: {
            ...(data.status && { status: data.status }),
            ...(data.status === 'CALLED' ? { calledAt: new Date(), calledBy: req.user.id } : {}),
            ...(data.treatment && { treatment: data.treatment }),
            ...(data.dateTime && { dateTime: (0, date_fns_1.parseISO)(data.dateTime) }),
            ...(data.durationMin && { durationMin: data.durationMin }),
            ...(data.fee !== undefined && { fee: data.fee }),
            ...(data.notes !== undefined && { notes: data.notes }),
            ...(data.practitionerId !== undefined && { practitionerId: data.practitionerId }),
            ...(data.locationId !== undefined && { locationId: data.locationId }),
            ...(data.roomId !== undefined && { roomId: data.roomId }),
        },
        include: { patient: { select: { fullName: true, phone: true } }, practitioner: true, location: true },
    });
    if (data.status && data.status !== existing.status) {
        await (0, audit_service_1.writeAudit)({
            ...(0, audit_service_1.actorOf)(req),
            clinicId: req.clinicId,
            action: 'appointment.status_changed',
            entityType: 'Appointment',
            entityId: appointment.id,
            details: JSON.stringify({ from: existing.status, to: data.status }),
            success: true,
        });
    }
    // Notify on cancellation
    if (data.status === 'CANCELLED') {
        await (0, notification_service_1.createNotification)({
            clinicId: req.clinicId,
            title: 'Appointment Cancelled',
            body: `${appointment.patient.fullName} cancelled their appointment`,
            type: 'cancellation',
            link: '/dashboard/appointments',
        });
        (0, reminder_service_1.sendAppointmentCancellation)(appointment.id).catch(() => null);
    }
    else if (dateChanged) {
        (0, reminder_service_1.sendAppointmentReschedule)(appointment.id).catch(() => null);
    }
    res.json(appointment);
});
// DELETE /api/appointments/:id (soft cancel)
exports.cancelAppointment = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const existing = await prisma_1.prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.clinicId !== req.clinicId) {
        throw (0, error_middleware_1.createError)('Appointment not found', 404, 'NOT_FOUND');
    }
    await prisma_1.prisma.appointment.update({
        where: { id: req.params.id },
        data: { status: 'CANCELLED' },
    });
    (0, reminder_service_1.sendAppointmentCancellation)(req.params.id).catch(() => null);
    res.json({ message: 'Appointment cancelled' });
});
// GET /api/appointments/slots
exports.getAvailableSlots = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { date, duration } = appointment_schemas_1.SlotsQuerySchema.parse(req.query);
    const clinicId = req.clinicId;
    const durationMin = parseInt(duration ?? '30');
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, workingHours: true },
    });
    const built = await (0, schedule_service_1.buildDaySlots)({ id: clinicId, workingHours: clinic?.workingHours }, date, durationMin, {
        practitionerId: req.query.practitionerId,
        locationId: req.query.locationId,
        roomId: req.query.roomId,
    });
    res.json(built);
});
//# sourceMappingURL=appointments.controller.js.map