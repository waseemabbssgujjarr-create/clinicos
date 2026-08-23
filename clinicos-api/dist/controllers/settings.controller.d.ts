import { Request, Response } from 'express';
export declare const getSettings: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const updateClinicInfo: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const updateAISettings: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const updateWorkingHours: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const updateTreatments: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const uploadLogo: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const uploadMiddleware: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
