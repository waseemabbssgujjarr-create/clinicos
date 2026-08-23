import { Request, Response, NextFunction } from 'express';
type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
/**
 * Wraps async route handlers so errors are passed to Express error middleware
 * instead of causing unhandled promise rejections.
 */
export declare const asyncHandler: (fn: AsyncFn) => (req: Request, res: Response, next: NextFunction) => void;
export {};
