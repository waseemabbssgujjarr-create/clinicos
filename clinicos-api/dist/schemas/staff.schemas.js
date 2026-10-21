"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateStaffSchema = exports.InviteStaffSchema = exports.StaffRoleSchema = void 0;
const zod_1 = require("zod");
const ROLE_ALIASES = {
    receptionist: 'RECEPTIONIST',
    nurse: 'NURSE',
    assistant: 'ASSISTANT',
    manager: 'MANAGER',
};
function normalizeStaffRoleInput(val) {
    const s = String(val ?? '').trim();
    if (!s)
        return 'RECEPTIONIST';
    const alias = ROLE_ALIASES[s.toLowerCase()];
    if (alias)
        return alias;
    return s.toUpperCase();
}
exports.StaffRoleSchema = zod_1.z.enum(['RECEPTIONIST', 'NURSE', 'ASSISTANT', 'MANAGER'], {
    errorMap: () => ({ message: 'Role must be receptionist, nurse, assistant, or manager' }),
});
exports.InviteStaffSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    email: zod_1.z.string().email('Invalid email address'),
    role: zod_1.z.preprocess(normalizeStaffRoleInput, exports.StaffRoleSchema),
});
exports.UpdateStaffSchema = zod_1.z.object({
    role: zod_1.z
        .preprocess((val) => (val === undefined || val === null || val === '' ? undefined : normalizeStaffRoleInput(val)), exports.StaffRoleSchema.optional()),
    isActive: zod_1.z.boolean().optional(),
});
