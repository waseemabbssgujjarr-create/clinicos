"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePatientSchema = exports.CreatePatientSchema = void 0;
const zod_1 = require("zod");
exports.CreatePatientSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2, 'Full name is required'),
    phone: zod_1.z.string().min(7, 'Phone number is required'),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    dateOfBirth: zod_1.z.string().optional(),
    gender: zod_1.z.enum(['male', 'female', 'other']).optional(),
    bloodGroup: zod_1.z.string().optional(),
    medicalNotes: zod_1.z.string().optional(),
    allergies: zod_1.z.string().optional(),
    emergencyName: zod_1.z.string().optional(),
    emergencyPhone: zod_1.z.string().optional(),
});
exports.UpdatePatientSchema = exports.CreatePatientSchema.partial();
//# sourceMappingURL=patient.schemas.js.map