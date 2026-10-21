import { z } from 'zod';
export declare const StaffRoleSchema: z.ZodEnum<["RECEPTIONIST", "NURSE", "ASSISTANT", "MANAGER"]>;
export declare const InviteStaffSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    role: z.ZodEffects<z.ZodEnum<["RECEPTIONIST", "NURSE", "ASSISTANT", "MANAGER"]>, "RECEPTIONIST" | "NURSE" | "ASSISTANT" | "MANAGER", unknown>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    role: "RECEPTIONIST" | "NURSE" | "ASSISTANT" | "MANAGER";
}, {
    name: string;
    email: string;
    role?: unknown;
}>;
export declare const UpdateStaffSchema: z.ZodObject<{
    role: z.ZodOptional<z.ZodEffects<z.ZodEnum<["RECEPTIONIST", "NURSE", "ASSISTANT", "MANAGER"]>, "RECEPTIONIST" | "NURSE" | "ASSISTANT" | "MANAGER", unknown>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    role?: "RECEPTIONIST" | "NURSE" | "ASSISTANT" | "MANAGER" | undefined;
    isActive?: boolean | undefined;
}, {
    role?: unknown;
    isActive?: boolean | undefined;
}>;
