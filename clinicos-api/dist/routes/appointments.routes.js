"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const appointments_controller_1 = require("../controllers/appointments.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware, auth_middleware_1.doctorOrStaff);
router.get('/slots', appointments_controller_1.getAvailableSlots);
router.get('/', appointments_controller_1.listAppointments);
router.post('/', appointments_controller_1.createAppointment);
router.get('/:id', appointments_controller_1.getAppointment);
router.patch('/:id', appointments_controller_1.updateAppointment);
router.delete('/:id', appointments_controller_1.cancelAppointment);
exports.default = router;
//# sourceMappingURL=appointments.routes.js.map