"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reviews_controller_1 = require("../controllers/reviews.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware, auth_middleware_1.doctorOnly);
router.get('/', reviews_controller_1.getReviews);
router.post('/request', reviews_controller_1.requestReviews);
router.post('/reply', reviews_controller_1.replyToReview);
exports.default = router;
//# sourceMappingURL=reviews.routes.js.map