import { Request, Response } from 'express';
export declare const listMessages: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getMessageStats: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const sendMessage: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const broadcastMessage: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const markAsRead: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getThread: (req: Request, res: Response, next: import("express").NextFunction) => void;
