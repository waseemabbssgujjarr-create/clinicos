"use strict";
/**
 * WhatsApp Routes — Doctors My Agency
 *
 * All routes require an authenticated doctor.
 *
 * Customer-facing connection:
 *   POST   /api/whatsapp/connections/embedded     — Meta Embedded Signup (only customer flow)
 *   GET    /api/whatsapp/connections/config       — Feature-flag-aware config for frontend
 *   GET    /api/whatsapp/connections/status       — Current connection state
 *   DELETE /api/whatsapp/connections/disconnect   — Disconnect
 *
 * Internal/admin-only (not exposed in clinic dashboard UI):
 *   POST   /api/whatsapp/connections/manual       — Manual token connection (admin recovery only)
 *
 * Hub + activity:
 *   GET    /api/whatsapp/hub                      — Command Center data
 *   GET    /api/whatsapp/message-log              — Recent messages
 *
 * Health:
 *   GET    /api/whatsapp/verify-waba              — Check webhook subscription
 *   POST   /api/whatsapp/verify-waba              — Check + auto re-subscribe
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsapp_controller_1 = require("../controllers/whatsapp.controller");
const auth_middleware_1     = require("../middleware/auth.middleware");

const router = (0, express_1.Router)();

// All WhatsApp routes require an authenticated doctor
router.use(auth_middleware_1.authMiddleware, auth_middleware_1.doctorOnly);

// ── Connection management ─────────────────────────────────────────────────────
// Manual connection — retained for internal/admin recovery only.
// NOT rendered or linked from the clinic dashboard UI.
router.post("/connections/manual",     whatsapp_controller_1.connectManual);

// Embedded Signup — the ONLY customer-facing WhatsApp connection method.
// Returns 403 { code: "EMBEDDED_SIGNUP_DISABLED" } when flag is false.
router.post("/connections/embedded",   whatsapp_controller_1.connectEmbedded);

// Status and config
router.get("/connections/status",      whatsapp_controller_1.getConnectionStatus);
router.get("/connections/config",      whatsapp_controller_1.getSignupConfig);

// Disconnect
router.delete("/connections/disconnect", whatsapp_controller_1.disconnectWhatsApp);

// ── Backwards-compatible aliases (existing API calls still work) ───────────────
// Old route: POST /api/whatsapp/connect — kept for any in-flight requests
router.post("/connect",      whatsapp_controller_1.connectEmbedded);
// Old route: DELETE /api/whatsapp/disconnect
router.delete("/disconnect", whatsapp_controller_1.disconnectWhatsApp);
// Old route: GET /api/whatsapp/status
router.get("/status",        whatsapp_controller_1.getConnectionStatus);
// Old route: GET /api/whatsapp/signup-config
router.get("/signup-config", whatsapp_controller_1.getSignupConfig);
// Extra alias: GET /api/whatsapp/config — matches dma-doctor-app.js waStatus fallback paths
router.get("/config",        whatsapp_controller_1.getSignupConfig);

// ── Hub + activity ────────────────────────────────────────────────────────────
router.get("/hub",         whatsapp_controller_1.getWhatsAppHub);
router.get("/message-log", whatsapp_controller_1.getWhatsAppRecentLog);

// ── Webhook health ────────────────────────────────────────────────────────────
router.get("/verify-waba",  whatsapp_controller_1.verifyWaba);
router.post("/verify-waba", whatsapp_controller_1.verifyWaba);

exports.default = router;
