"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settings_controller_1 = require("../controllers/settings.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware, auth_middleware_1.doctorOnly);
router.get('/', settings_controller_1.getSettings);
router.patch('/clinic', settings_controller_1.updateClinicInfo);
router.patch('/ai', settings_controller_1.updateAISettings);
router.patch('/hours', settings_controller_1.updateWorkingHours);
router.patch('/treatments', settings_controller_1.updateTreatments);
router.post('/logo', settings_controller_1.uploadMiddleware, settings_controller_1.uploadLogo);
exports.default = router;
//# sourceMappingURL=settings.routes.js.map