"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const messages_controller_1 = require("../controllers/messages.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware, auth_middleware_1.doctorOrStaff);
router.get('/', messages_controller_1.listMessages);
router.get('/stats', messages_controller_1.getMessageStats);
router.post('/send', messages_controller_1.sendMessage);
router.post('/broadcast', messages_controller_1.broadcastMessage);
router.patch('/:id/read', messages_controller_1.markAsRead);
router.get('/threads/:patientId', messages_controller_1.getThread);
exports.default = router;
//# sourceMappingURL=messages.routes.js.map