import { Request, Response } from 'express';
/**
 * GET /api/reviews
 * Fetch Google reviews via Google My Business API.
 * Falls back to empty array if not configured.
 */
export declare const getReviews: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /api/reviews/request
 * Send review request messages to a list of patients.
 */
export declare const requestReviews: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * POST /api/reviews/reply
 * Reply to a Google review via Google My Business API.
 */
export declare const replyToReview: (req: Request, res: Response, next: import("express").NextFunction) => void;
