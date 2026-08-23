"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notifications_controller_1 = require("../controllers/notifications.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get('/', notifications_controller_1.listNotifications);
router.get('/unread-count', notifications_controller_1.getUnreadCount);
router.patch('/read-all', notifications_controller_1.markAllRead);
router.get('/stream', notifications_controller_1.notificationStream);
exports.default = router;
//# sourceMappingURL=notifications.routes.js.map