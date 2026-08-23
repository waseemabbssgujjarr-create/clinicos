import { Request, Response } from 'express';
export declare const listAppointments: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const createAppointment: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getAppointment: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const updateAppointment: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const cancelAppointment: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getAvailableSlots: (req: Request, res: Response, next: import("express").NextFunction) => void;
