import { Request, Response } from 'express';
export declare const listPatients: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const createPatient: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getPatient: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const updatePatient: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const deactivatePatient: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getPatientAppointments: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getPatientMessages: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const sendMagicLink: (req: Request, res: Response, next: import("express").NextFunction) => void;
