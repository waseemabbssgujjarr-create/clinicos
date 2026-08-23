"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const meta_webhook_internal_1 = require("../webhooks/meta.webhook.internal");
const router = (0, express_1.Router)();
function bridgeAuth(req, res, next) {
    const expected = process.env.CLINICOS_BRIDGE_KEY || process.env.INTERNAL_WEBHOOK_KEY || "";
    const key = req.headers["x-clinicos-bridge-key"] || req.headers["x-internal-webhook-key"] || "";
    if (!expected || !key || key !== expected) {
        res.status(401).json({ error: "Unauthorized", code: "BRIDGE_AUTH" });
        return;
    }
    next();
}
router.use(bridgeAuth);
router.get("/whatsapp/lookup/:phoneNumberId", meta_webhook_internal_1.lookupPhoneNumber);
router.post("/meta-webhook", meta_webhook_internal_1.processMetaWebhookPayload);
exports.default = router;
