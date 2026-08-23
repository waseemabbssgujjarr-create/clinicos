import { z } from 'zod';
export declare const RegisterSchema: z.ZodObject<{
    ownerName: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    phone: z.ZodString;
    clinicName: z.ZodString;
    specialty: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    timezone: z.ZodDefault<z.ZodString>;
    workingHours: z.ZodOptional<z.ZodString>;
    treatments: z.ZodOptional<z.ZodString>;
    bookingSlug: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phone?: string;
    email?: string;
    ownerName?: string;
    specialty?: string;
    address?: string;
    bookingSlug?: string;
    timezone?: string;
    workingHours?: string;
    treatments?: string;
    password?: string;
    clinicName?: string;
}, {
    phone?: string;
    email?: string;
    ownerName?: string;
    specialty?: string;
    address?: string;
    bookingSlug?: string;
    timezone?: string;
    workingHours?: string;
    treatments?: string;
    password?: string;
    clinicName?: string;
}>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email?: string;
    password?: string;
}, {
    email?: string;
    password?: string;
}>;
export declare const StaffLoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email?: string;
    password?: string;
}, {
    email?: string;
    password?: string;
}>;
export declare const ForgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email?: string;
}, {
    email?: string;
}>;
export declare const ResetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password?: string;
    token?: string;
}, {
    password?: string;
    token?: string;
}>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
