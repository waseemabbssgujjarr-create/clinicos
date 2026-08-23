"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantGuard = tenantGuard;
const prisma_1 = require("../lib/prisma");
/**
 * Validates that a resourceId in the URL actually belongs to the logged-in clinic.
 * Prevents doctors from accessing other clinics' data by guessing IDs.
 *
 * Usage: router.get('/:id', authMiddleware, tenantGuard('appointment'), handler)
 */
function tenantGuard(resource) {
    return async (req, res, next) => {
        const resourceId = req.params.id;
        const clinicId = req.clinicId;
        if (!resourceId || !clinicId) {
            next();
            return;
        }
        try {
            let record = null;
            if (resource === 'appointment') {
                record = await prisma_1.prisma.appointment.findUnique({
                    where: { id: resourceId },
                    select: { clinicId: true },
                });
            }
            else if (resource === 'patient') {
                record = await prisma_1.prisma.patient.findUnique({
                    where: { id: resourceId },
                    select: { clinicId: true },
                });
            }
            else if (resource === 'message') {
                record = await prisma_1.prisma.message.findUnique({
                    where: { id: resourceId },
                    select: { clinicId: true },
                });
            }
            else if (resource === 'staff') {
                record = await prisma_1.prisma.staffMember.findUnique({
                    where: { id: resourceId },
                    select: { clinicId: true },
                });
            }
            if (!record) {
                res.status(404).json({ error: 'Resource not found', code: 'NOT_FOUND' });
                return;
            }
            if (record.clinicId !== clinicId) {
                // Do NOT reveal that the resource exists — return 404 to prevent enumeration
                res.status(404).json({ error: 'Resource not found', code: 'NOT_FOUND' });
                return;
            }
            next();
        }
        catch {
            res.status(500).json({ error: 'Authorization check failed', code: 'SERVER_ERROR' });
        }
    };
}
//# sourceMappingURL=tenantGuard.middleware.js.map