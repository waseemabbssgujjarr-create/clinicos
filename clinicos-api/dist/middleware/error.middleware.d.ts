import { Request, Response, NextFunction } from 'express';
export interface AppError extends Error {
    statusCode?: number;
    code?: string;
}
/**
 * Global error handler — must be registered LAST in Express middleware chain.
 * Returns consistent JSON error responses to the frontend.
 */
export declare function errorMiddleware(err: AppError, req: Request, res: Response, _next: NextFunction): void;
/** Helper to create typed AppErrors with status codes */
export declare function createError(message: string, statusCode: number, code: string): AppError;
