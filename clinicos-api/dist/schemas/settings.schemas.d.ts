import { z } from 'zod';
export declare const UpdateClinicSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    ownerName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    specialty: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    timezone: z.ZodOptional<z.ZodString>;
    bookingSlug: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string;
    phone?: string;
    email?: string;
    ownerName?: string;
    specialty?: string;
    address?: string;
    bookingSlug?: string;
    timezone?: string;
}, {
    name?: string;
    phone?: string;
    email?: string;
    ownerName?: string;
    specialty?: string;
    address?: string;
    bookingSlug?: string;
    timezone?: string;
}>;
export declare const UpdateAISettingsSchema: z.ZodObject<{
    aiEnabled: z.ZodOptional<z.ZodBoolean>;
    aiLanguage: z.ZodOptional<z.ZodEnum<["english", "arabic", "urdu", "hindi"]>>;
    aiPersonality: z.ZodOptional<z.ZodEnum<["professional", "friendly", "formal"]>>;
    autoConfirm: z.ZodOptional<z.ZodBoolean>;
    reminderTiming: z.ZodOptional<z.ZodEnum<["24h", "2h", "both"]>>;
    reviewTiming: z.ZodOptional<z.ZodString>;
    customIntroMsg: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    aiEnabled?: boolean;
    aiLanguage?: "english" | "arabic" | "urdu" | "hindi";
    aiPersonality?: "professional" | "friendly" | "formal";
    autoConfirm?: boolean;
    reminderTiming?: "24h" | "2h" | "both";
    reviewTiming?: string;
    customIntroMsg?: string;
}, {
    aiEnabled?: boolean;
    aiLanguage?: "english" | "arabic" | "urdu" | "hindi";
    aiPersonality?: "professional" | "friendly" | "formal";
    autoConfirm?: boolean;
    reminderTiming?: "24h" | "2h" | "both";
    reviewTiming?: string;
    customIntroMsg?: string;
}>;
export declare const UpdateWorkingHoursSchema: z.ZodObject<{
    workingHours: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workingHours?: string;
}, {
    workingHours?: string;
}>;
export declare const UpdateTreatmentsSchema: z.ZodObject<{
    treatments: z.ZodString;
}, "strip", z.ZodTypeAny, {
    treatments?: string;
}, {
    treatments?: string;
}>;
export type UpdateClinicInput = z.infer<typeof UpdateClinicSchema>;
export type UpdateAISettingsInput = z.infer<typeof UpdateAISettingsSchema>;
