import { Request, Response } from 'express';
export declare const listNotifications: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const markAllRead: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const getUnreadCount: (req: Request, res: Response, next: import("express").NextFunction) => void;
export declare const notificationStream: (req: Request, res: Response) => void;
