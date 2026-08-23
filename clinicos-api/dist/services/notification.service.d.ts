import { Server as SocketServer } from 'socket.io';
export declare function setSocketServer(socketServer: SocketServer): void;
export interface CreateNotificationInput {
    clinicId: string;
    title: string;
    body: string;
    type: 'message' | 'cancellation' | 'new_patient' | 'ai_action' | 'payment' | 'missed_call' | 'ai_escalate';
    color?: string;
    link?: string;
}
/**
 * Creates a notification in the DB and emits it via Socket.io for real-time delivery.
 */
export declare function createNotification(input: CreateNotificationInput): Promise<void>;
