"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResetPasswordSchema = exports.ForgotPasswordSchema = exports.StaffLoginSchema = exports.LoginSchema = exports.RegisterSchema = void 0;
const zod_1 = require("zod");
exports.RegisterSchema = zod_1.z.object({
    // Doctor personal info
    ownerName: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    phone: zod_1.z.string().min(7, 'Phone number is required'),
    // Clinic info
    clinicName: zod_1.z.string().min(2, 'Clinic name is required'),
    specialty: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    timezone: zod_1.z.string().default('Asia/Dubai'),
    // Onboarding optional at register time
    workingHours: zod_1.z.string().optional(),
    treatments: zod_1.z.string().optional(),
    bookingSlug: zod_1.z.string().optional(),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.StaffLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
exports.ForgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
exports.ResetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
//# sourceMappingURL=auth.schemas.js.map