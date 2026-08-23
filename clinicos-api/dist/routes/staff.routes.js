"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const staff_controller_1 = require("../controllers/staff.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware, auth_middleware_1.doctorOnly);
router.get('/', staff_controller_1.listStaff);
router.post('/invite', staff_controller_1.inviteStaff);
router.patch('/:id', staff_controller_1.updateStaff);
router.delete('/:id', staff_controller_1.deactivateStaff);
exports.default = router;
//# sourceMappingURL=staff.routes.js.map