"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSocketServer = setSocketServer;
exports.createNotification = createNotification;
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../lib/logger");
let io = null;
function setSocketServer(socketServer) {
    io = socketServer;
}
const typeColorMap = {
    message: 'teal',
    ai_action: 'teal',
    cancellation: 'red',
    new_patient: 'blue',
    missed_call: 'amber',
    payment: 'red',
    ai_escalate: 'amber',
};
/**
 * Creates a notification in the DB and emits it via Socket.io for real-time delivery.
 */
async function createNotification(input) {
    try {
        const color = input.color ?? typeColorMap[input.type] ?? 'teal';
        const notification = await prisma_1.prisma.notification.create({
            data: {
                clinicId: input.clinicId,
                title: input.title,
                body: input.body,
                type: input.type,
                color,
                link: input.link,
            },
        });
        // Emit real-time notification to the clinic's private Socket.io room
        if (io) {
            io.to(input.clinicId).emit('notification:new', {
                id: notification.id,
                title: notification.title,
                body: notification.body,
                type: notification.type,
                color: notification.color,
                link: notification.link,
                createdAt: notification.createdAt,
            });
        }
    }
    catch (err) {
        logger_1.logger.error('Failed to create notification', { input, err });
    }
}
//# sourceMappingURL=notification.service.js.map