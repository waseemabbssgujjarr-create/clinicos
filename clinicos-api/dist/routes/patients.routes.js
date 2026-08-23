"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const patients_controller_1 = require("../controllers/patients.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware, auth_middleware_1.doctorOrStaff);
router.get('/', patients_controller_1.listPatients);
router.post('/', patients_controller_1.createPatient);
router.get('/:id', patients_controller_1.getPatient);
router.patch('/:id', patients_controller_1.updatePatient);
router.delete('/:id', auth_middleware_1.doctorOnly, patients_controller_1.deactivatePatient);
router.get('/:id/appointments', patients_controller_1.getPatientAppointments);
router.get('/:id/messages', patients_controller_1.getPatientMessages);
router.post('/:id/magic-link', auth_middleware_1.doctorOnly, patients_controller_1.sendMagicLink);
exports.default = router;
//# sourceMappingURL=patients.routes.js.map