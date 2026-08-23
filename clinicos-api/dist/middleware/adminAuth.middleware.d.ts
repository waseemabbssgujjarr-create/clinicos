import { Request, Response, NextFunction } from 'express';
/**
 * Super Admin only middleware.
 * Only allows requests with role === SUPERADMIN.
 */
export declare function adminAuth(req: Request, res: Response, next: NextFunction): void;
