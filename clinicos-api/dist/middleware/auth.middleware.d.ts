import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from '../lib/jwt';
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
            clinicId?: string;
        }
    }
}
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): void;
export declare function doctorOnly(req: Request, res: Response, next: NextFunction): void;
export declare function doctorOrStaff(req: Request, res: Response, next: NextFunction): void;
