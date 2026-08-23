"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlotsQuerySchema = exports.UpdateAppointmentSchema = exports.CreateAppointmentSchema = void 0;
const zod_1 = require("zod");
exports.CreateAppointmentSchema = zod_1.z.object({
    patientId: zod_1.z.string().min(1, 'Patient is required'),
    treatment: zod_1.z.string().min(1, 'Treatment is required'),
    dateTime: zod_1.z.string().datetime({ message: 'Valid date/time required' }),
    durationMin: zod_1.z.number().int().min(15).max(120).default(30),
    fee: zod_1.z.number().positive().optional(),
    notes: zod_1.z.string().optional(),
    channel: zod_1.z
        .enum(['MANUAL', 'WHATSAPP', 'SMS', 'CALL', 'EMAIL', 'ONLINE_BOOKING', 'STAFF_PORTAL'])
        .default('MANUAL'),
    sendConfirmation: zod_1.z.boolean().default(true),
});
exports.UpdateAppointmentSchema = zod_1.z.object({
    status: zod_1.z
        .enum([
        'PENDING',
        'CONFIRMED',
        'ARRIVED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW',
        'RESCHEDULED',
    ])
        .optional(),
    treatment: zod_1.z.string().optional(),
    dateTime: zod_1.z.string().datetime().optional(),
    durationMin: zod_1.z.number().int().min(15).max(120).optional(),
    fee: zod_1.z.number().positive().optional(),
    notes: zod_1.z.string().optional(),
});
exports.SlotsQuerySchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    duration: zod_1.z.string().optional(),
});
//# sourceMappingURL=appointment.schemas.js.map