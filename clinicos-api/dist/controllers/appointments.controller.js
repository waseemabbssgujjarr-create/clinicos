"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableSlots = exports.cancelAppointment = exports.updateAppointment = exports.getAppointment = exports.createAppointment = exports.listAppointments = void 0;
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const appointment_schemas_1 = require("../schemas/appointment.schemas");
const reminder_service_1 = require("../services/reminder.service");
const notification_service_1 = require("../services/notification.service");
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
    // Check for slot conflict
    const start = (0, date_fns_1.parseISO)(data.dateTime);
    const end = (0, date_fns_1.addMinutes)(start, data.durationMin);
    const conflict = await prisma_1.prisma.appointment.findFirst({
        where: {
            clinicId,
            status: { notIn: ['CANCELLED', 'NO_SHOW', 'RESCHEDULED'] },
            dateTime: { gte: start, lt: end },
        },
    });
    if (conflict)
        throw (0, error_middleware_1.createError)('This time slot is already booked', 409, 'SLOT_CONFLICT');
    const appointment = await prisma_1.prisma.appointment.create({
        data: {
            clinicId,
            patientId: data.patientId,
            treatment: data.treatment,
            dateTime: start,
            durationMin: data.durationMin,
            fee: data.fee,
            notes: data.notes,
            channel: data.channel,
            bookedByStaffId: req.user?.role === 'STAFF' ? req.user.id : null,
        },
        include: { patient: true },
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
            patient: { select: { id: true, fullName: true, phone: true, email: true, medicalNotes: true } },
        },
    });
    if (!appointment || appointment.clinicId !== req.clinicId) {
        throw (0, error_middleware_1.createError)('Appointment not found', 404, 'NOT_FOUND');
    }
    res.json(appointment);
});
// PATCH /api/appointments/:id
exports.updateAppointment = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = appointment_schemas_1.UpdateAppointmentSchema.parse(req.body);
    const existing = await prisma_1.prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.clinicId !== req.clinicId) {
        throw (0, error_middleware_1.createError)('Appointment not found', 404, 'NOT_FOUND');
    }
    const dateChanged = !!(data.dateTime && (0, date_fns_1.parseISO)(data.dateTime).getTime() !== existing.dateTime.getTime());
    const appointment = await prisma_1.prisma.appointment.update({
        where: { id: req.params.id },
        data: {
            ...(data.status && { status: data.status }),
            ...(data.treatment && { treatment: data.treatment }),
            ...(data.dateTime && { dateTime: (0, date_fns_1.parseISO)(data.dateTime) }),
            ...(data.durationMin && { durationMin: data.durationMin }),
            ...(data.fee !== undefined && { fee: data.fee }),
            ...(data.notes !== undefined && { notes: data.notes }),
        },
        include: { patient: { select: { fullName: true, phone: true } } },
    });
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
        select: { workingHours: true },
    });
    const hours = JSON.parse(clinic?.workingHours ?? '{}');
    const targetDate = (0, date_fns_1.parseISO)(date);
    const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayConfig = hours[dayName];
    if (!dayConfig?.isOpen) {
        res.json({ slots: [], message: 'Clinic is closed on this day' });
        return;
    }
    const [openH, openM] = (dayConfig.open || '09:00').split(':').map(Number);
    const [closeH, closeM] = (dayConfig.close || '17:00').split(':').map(Number);
    const booked = await prisma_1.prisma.appointment.findMany({
        where: {
            clinicId,
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
});
//# sourceMappingURL=appointments.controller.js.map