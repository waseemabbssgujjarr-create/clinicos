"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const billing_controller_1 = require("../controllers/billing.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware, auth_middleware_1.doctorOnly);
router.get('/subscription', billing_controller_1.getSubscriptionInfo);
router.get('/invoices', billing_controller_1.getInvoices);
router.post('/checkout', billing_controller_1.createCheckout);
router.post('/portal', billing_controller_1.openPortal);
exports.default = router;
//# sourceMappingURL=billing.routes.js.map