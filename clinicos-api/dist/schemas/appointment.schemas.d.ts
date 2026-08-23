import { z } from 'zod';
export declare const CreateAppointmentSchema: z.ZodObject<{
    patientId: z.ZodString;
    treatment: z.ZodString;
    dateTime: z.ZodString;
    durationMin: z.ZodDefault<z.ZodNumber>;
    fee: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
    channel: z.ZodDefault<z.ZodEnum<["MANUAL", "WHATSAPP", "SMS", "CALL", "EMAIL", "ONLINE_BOOKING", "STAFF_PORTAL"]>>;
    sendConfirmation: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    patientId?: string;
    treatment?: string;
    dateTime?: string;
    durationMin?: number;
    channel?: "WHATSAPP" | "SMS" | "MANUAL" | "CALL" | "EMAIL" | "ONLINE_BOOKING" | "STAFF_PORTAL";
    notes?: string;
    fee?: number;
    sendConfirmation?: boolean;
}, {
    patientId?: string;
    treatment?: string;
    dateTime?: string;
    durationMin?: number;
    channel?: "WHATSAPP" | "SMS" | "MANUAL" | "CALL" | "EMAIL" | "ONLINE_BOOKING" | "STAFF_PORTAL";
    notes?: string;
    fee?: number;
    sendConfirmation?: boolean;
}>;
export declare const UpdateAppointmentSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"]>>;
    treatment: z.ZodOptional<z.ZodString>;
    dateTime: z.ZodOptional<z.ZodString>;
    durationMin: z.ZodOptional<z.ZodNumber>;
    fee: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    treatment?: string;
    dateTime?: string;
    durationMin?: number;
    status?: "PENDING" | "CONFIRMED" | "ARRIVED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "RESCHEDULED";
    notes?: string;
    fee?: number;
}, {
    treatment?: string;
    dateTime?: string;
    durationMin?: number;
    status?: "PENDING" | "CONFIRMED" | "ARRIVED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "RESCHEDULED";
    notes?: string;
    fee?: number;
}>;
export declare const SlotsQuerySchema: z.ZodObject<{
    date: z.ZodString;
    duration: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date?: string;
    duration?: string;
}, {
    date?: string;
    duration?: string;
}>;
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentSchema>;
