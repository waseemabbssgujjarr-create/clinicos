"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMagicLink = exports.getPatientMessages = exports.getPatientAppointments = exports.deactivatePatient = exports.updatePatient = exports.getPatient = exports.createPatient = exports.listPatients = void 0;
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const patient_schemas_1 = require("../schemas/patient.schemas");
const notification_service_1 = require("../services/notification.service");
const crypto_1 = __importDefault(require("crypto"));
// GET /api/patients
exports.listPatients = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { search, page = '1', limit = '20' } = req.query;
    const clinicId = req.clinicId;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const where = {
        clinicId,
        isActive: true,
        ...(search
            ? {
                OR: [
                    { fullName: { contains: search } },
                    { phone: { contains: search } },
                    { email: { contains: search } },
                ],
            }
            : {}),
    };
    const [total, patients] = await Promise.all([
        prisma_1.prisma.patient.count({ where }),
        prisma_1.prisma.patient.findMany({
            where,
            select: {
                id: true,
                fullName: true,
                phone: true,
                email: true,
                gender: true,
                createdAt: true,
                _count: { select: { appointments: true } },
                appointments: {
                    orderBy: { dateTime: 'desc' },
                    take: 1,
                    select: { dateTime: true, status: true },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
        }),
    ]);
    res.json({ data: patients, total, page: pageNum, limit: limitNum });
});
// POST /api/patients
exports.createPatient = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = patient_schemas_1.CreatePatientSchema.parse(req.body);
    const clinicId = req.clinicId;
    const existing = await prisma_1.prisma.patient.findUnique({
        where: { clinicId_phone: { clinicId, phone: data.phone } },
    });
    if (existing)
        throw (0, error_middleware_1.createError)('A patient with this phone number already exists', 409, 'DUPLICATE_PATIENT');
    const patient = await prisma_1.prisma.patient.create({
        data: {
            clinicId,
            fullName: data.fullName,
            phone: data.phone,
            email: data.email || null,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            gender: data.gender,
            bloodGroup: data.bloodGroup,
            medicalNotes: data.medicalNotes,
            allergies: data.allergies,
            emergencyName: data.emergencyName,
            emergencyPhone: data.emergencyPhone,
        },
    });
    await (0, notification_service_1.createNotification)({
        clinicId,
        title: 'New Patient',
        body: `${patient.fullName} has been added as a new patient`,
        type: 'new_patient',
        link: `/dashboard/patients/${patient.id}`,
    });
    res.status(201).json(patient);
});
// GET /api/patients/:id
exports.getPatient = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const patient = await prisma_1.prisma.patient.findFirst({
        where: { id: req.params.id, clinicId },
        include: {
            appointments: {
                orderBy: { dateTime: 'desc' },
                take: 20,
                select: {
                    id: true, treatment: true, dateTime: true, status: true, fee: true, channel: true, notes: true,
                },
            },
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    id: true, channel: true, direction: true, body: true, isRead: true, createdAt: true,
                },
            },
        },
    });
    if (!patient)
        throw (0, error_middleware_1.createError)('Patient not found', 404, 'NOT_FOUND');
    res.json(patient);
});
// PATCH /api/patients/:id
exports.updatePatient = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = patient_schemas_1.UpdatePatientSchema.parse(req.body);
    const clinicId = req.clinicId;
    const existing = await prisma_1.prisma.patient.findFirst({ where: { id: req.params.id, clinicId } });
    if (!existing)
        throw (0, error_middleware_1.createError)('Patient not found', 404, 'NOT_FOUND');
    const patient = await prisma_1.prisma.patient.update({
        where: { id: req.params.id },
        data: {
            ...(data.fullName && { fullName: data.fullName }),
            ...(data.phone && { phone: data.phone }),
            ...(data.email !== undefined && { email: data.email || null }),
            ...(data.dateOfBirth && { dateOfBirth: new Date(data.dateOfBirth) }),
            ...(data.gender && { gender: data.gender }),
            ...(data.bloodGroup !== undefined && { bloodGroup: data.bloodGroup }),
            ...(data.medicalNotes !== undefined && { medicalNotes: data.medicalNotes }),
            ...(data.allergies !== undefined && { allergies: data.allergies }),
            ...(data.emergencyName !== undefined && { emergencyName: data.emergencyName }),
            ...(data.emergencyPhone !== undefined && { emergencyPhone: data.emergencyPhone }),
        },
    });
    res.json(patient);
});
// DELETE /api/patients/:id — soft deactivate (Doctor only)
exports.deactivatePatient = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    if (req.user?.role !== 'DOCTOR')
        throw (0, error_middleware_1.createError)('Only doctors can deactivate patients', 403, 'FORBIDDEN');
    const existing = await prisma_1.prisma.patient.findFirst({ where: { id: req.params.id, clinicId } });
    if (!existing)
        throw (0, error_middleware_1.createError)('Patient not found', 404, 'NOT_FOUND');
    await prisma_1.prisma.patient.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Patient deactivated' });
});
// GET /api/patients/:id/appointments
exports.getPatientAppointments = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const patient = await prisma_1.prisma.patient.findFirst({ where: { id: req.params.id, clinicId } });
    if (!patient)
        throw (0, error_middleware_1.createError)('Patient not found', 404, 'NOT_FOUND');
    const appointments = await prisma_1.prisma.appointment.findMany({
        where: { patientId: req.params.id, clinicId },
        orderBy: { dateTime: 'desc' },
    });
    res.json(appointments);
});
// GET /api/patients/:id/messages
exports.getPatientMessages = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const patient = await prisma_1.prisma.patient.findFirst({ where: { id: req.params.id, clinicId } });
    if (!patient)
        throw (0, error_middleware_1.createError)('Patient not found', 404, 'NOT_FOUND');
    const messages = await prisma_1.prisma.message.findMany({
        where: { patientId: req.params.id, clinicId },
        orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
});
// POST /api/patients/:id/magic-link
exports.sendMagicLink = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const patient = await prisma_1.prisma.patient.findFirst({ where: { id: req.params.id, clinicId } });
    if (!patient)
        throw (0, error_middleware_1.createError)('Patient not found', 404, 'NOT_FOUND');
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await prisma_1.prisma.patient.update({
        where: { id: patient.id },
        data: { magicLinkToken: token, magicLinkExpiry: expiry, portalEnabled: true },
    });
    const link = `${process.env.APP_URL}/verify/?token=${token}`;
    // In production: send via WhatsApp/SMS
    res.json({ message: 'Magic link created', link });
});
//# sourceMappingURL=patients.controller.js.map