"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateTreatmentsSchema = exports.UpdateWorkingHoursSchema = exports.UpdateAISettingsSchema = exports.UpdateClinicSchema = void 0;
const zod_1 = require("zod");
exports.UpdateClinicSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    ownerName: zod_1.z.string().min(2).optional(),
    phone: zod_1.z.string().min(7).optional(),
    email: zod_1.z.string().email().optional(),
    specialty: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    timezone: zod_1.z.string().optional(),
    googlePlaceId: zod_1.z.string().optional(),
    defaultFee: zod_1.z.number().positive().optional(),
    bookingSlug: zod_1.z
        .string()
        .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
        .optional(),
});
exports.UpdateAISettingsSchema = zod_1.z.object({
    aiEnabled: zod_1.z.boolean().optional(),
    aiLanguage: zod_1.z.enum(['english', 'arabic', 'urdu', 'hindi']).optional(),
    aiPersonality: zod_1.z.enum(['professional', 'friendly', 'formal']).optional(),
    autoConfirm: zod_1.z.boolean().optional(),
    reminderTiming: zod_1.z.enum(['24h', '2h', 'both']).optional(),
    reviewTiming: zod_1.z.string().optional(),
    customIntroMsg: zod_1.z.string().optional(),
});
exports.UpdateWorkingHoursSchema = zod_1.z.object({
    workingHours: zod_1.z.string(), // JSON string of working hours
});
exports.UpdateTreatmentsSchema = zod_1.z.object({
    treatments: zod_1.z.string(), // JSON string of treatments array
});
//# sourceMappingURL=settings.schemas.js.map