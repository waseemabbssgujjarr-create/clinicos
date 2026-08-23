import { Request, Response, NextFunction } from 'express';
/**
 * Validates that a resourceId in the URL actually belongs to the logged-in clinic.
 * Prevents doctors from accessing other clinics' data by guessing IDs.
 *
 * Usage: router.get('/:id', authMiddleware, tenantGuard('appointment'), handler)
 */
export declare function tenantGuard(resource: 'appointment' | 'patient' | 'message' | 'staff'): (req: Request, res: Response, next: NextFunction) => Promise<void>;
