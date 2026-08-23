"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ai_controller_1 = require("../controllers/ai.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware, auth_middleware_1.doctorOnly);
router.get('/logs', ai_controller_1.getAILogs);
router.get('/stats', ai_controller_1.getAIStats);
router.get('/config', ai_controller_1.getAIConfig);
router.patch('/config', ai_controller_1.updateAIConfig);
router.post('/test', ai_controller_1.testAI);
router.post('/test-chat', ai_controller_1.testAIChat);
exports.default = router;
//# sourceMappingURL=ai.routes.js.map