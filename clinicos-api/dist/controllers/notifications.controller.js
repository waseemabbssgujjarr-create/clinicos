"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationStream = exports.getUnreadCount = exports.markAllRead = exports.listNotifications = void 0;
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
// GET /api/notifications
exports.listNotifications = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const notifications = await prisma_1.prisma.notification.findMany({
        where: { clinicId: req.clinicId },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    res.json(notifications);
});
// PATCH /api/notifications/read-all
exports.markAllRead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    await prisma_1.prisma.notification.updateMany({
        where: { clinicId: req.clinicId, isRead: false },
        data: { isRead: true },
    });
    res.json({ message: 'All notifications marked as read' });
});
// GET /api/notifications/unread-count
exports.getUnreadCount = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const count = await prisma_1.prisma.notification.count({
        where: { clinicId: req.clinicId, isRead: false },
    });
    res.json({ count });
});
// SSE stream for real-time notifications (fallback if Socket.io not available)
const notificationStream = (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    // Keep alive ping every 30s
    const interval = setInterval(() => {
        res.write('event: ping\ndata: {}\n\n');
    }, 30000);
    req.on('close', () => {
        clearInterval(interval);
    });
};
exports.notificationStream = notificationStream;
//# sourceMappingURL=notifications.controller.js.map