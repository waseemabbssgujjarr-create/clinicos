"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsapp_controller_1 = require("../controllers/whatsapp.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");

const router = (0, express_1.Router)();

// All WhatsApp routes require an authenticated doctor
router.use(auth_middleware_1.authMiddleware, auth_middleware_1.doctorOnly);

// Status & configuration
router.get("/status",        whatsapp_controller_1.getWhatsAppStatus);
router.get("/signup-config", whatsapp_controller_1.getWhatsAppSignupConfig);
router.get("/hub",           whatsapp_controller_1.getWhatsAppHub);
router.get("/message-log",   whatsapp_controller_1.getWhatsAppRecentLog);

// Connect / disconnect
router.post("/connect",       whatsapp_controller_1.connectWhatsApp);
router.delete("/disconnect",  whatsapp_controller_1.disconnectWhatsApp);

// WABA subscription health check + self-service fix
// GET  — check subscription status
// POST — check + auto re-subscribe if not subscribed ({ resubscribe: false } to check only)
router.get("/verify-waba",  whatsapp_controller_1.verifyWaba);
router.post("/verify-waba", whatsapp_controller_1.verifyWaba);

// ── Testing endpoints (no Meta OAuth needed) ──────────────────────────────────
// Requires X-Test-Key header matching TEST_CONNECT_KEY in .env (production)
// or just works in NODE_ENV=development.
//
// POST /api/whatsapp/test-connect  — save account directly with a raw access token
// POST /api/whatsapp/test-inbound  — simulate a patient WhatsApp message through AI

router.post("/test-connect", whatsapp_controller_1.testConnect);
router.post("/test-inbound", whatsapp_controller_1.testInbound);

exports.default = router;
