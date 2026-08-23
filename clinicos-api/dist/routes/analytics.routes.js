"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = require("../controllers/analytics.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware, auth_middleware_1.doctorOnly);
router.get('/overview', analytics_controller_1.getOverview);
router.get('/weekly-appointments', analytics_controller_1.getWeeklyAppointments);
router.get('/monthly-revenue', analytics_controller_1.getMonthlyRevenue);
router.get('/messages-by-channel', analytics_controller_1.getMessagesByChannel);
router.get('/top-treatments', analytics_controller_1.getTopTreatments);
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map