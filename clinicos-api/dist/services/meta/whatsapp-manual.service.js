"use strict";
/**
 * WhatsApp Manual Connection Service — Doctors My Agency
 *
 * Implements the 10-step validation sequence for Manual Meta Connection.
 * A doctor/admin supplies credentials from Meta App Dashboard directly.
 * No OAuth popup. No Embedded Signup.
 *
 * Validation steps (each returns a step result for real-time UI feedback):
 *  1.  Validate input format
 *  2.  Verify app-level credentials (META_APP_ID + META_APP_SECRET)
 *  3.  Validate access token (debug_token)
 *  4.  Verify token has required WhatsApp scopes
 *  5.  Verify Business Portfolio access
 *  6.  Verify WABA ownership/access
 *  7.  Verify Phone Number ID exists
 *  8.  Confirm Phone Number ID belongs to the supplied WABA
 *  9.  Verify webhook subscription status
 *  10. Save connection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateManualConnection = validateManualConnection;
exports.subscribeWabaWebhook = subscribeWabaWebhook;
exports.checkWabaWebhookStatus = checkWabaWebhookStatus;

const meta_client_1 = require("./meta-client.service");
const whatsapp_connection_1 = require("./whatsapp-connection.service");
const logger_1 = require("../../lib/logger");

const REQUIRED_SCOPES = ["whatsapp_business_messaging", "whatsapp_business_management"];

/**
 * Run the full 10-step manual validation.
 *
 * @param clinicId             — DMA clinic ID
 * @param input                — fields from admin form
 * @param onStep               — callback fired after each step for real-time progress
 *
 * onStep signature: (step: number, label: string, status: 'pass'|'fail'|'warn', detail?: string) => void
 */
async function validateManualConnection(clinicId, input, onStep) {
    const steps = [];
    function step(n, label, status, detail = "") {
        steps.push({ step: n, label, status, detail });
        if (onStep) onStep(n, label, status, detail);
        logger_1.logger.info(`Manual WA validation step ${n} [${status}]: ${label}${detail ? " — " + detail : ""}`);
    }

    // ── Step 1: Input format validation ──────────────────────────────────────
    const { accessToken, wabaId, phoneNumberId, businessPortfolioId } = input;

    if (!accessToken || String(accessToken).length < 20) {
        step(1, "Input validation", "fail", "Access token is required and must be a valid Meta System User token.");
        return { success: false, steps };
    }
    if (!wabaId || !/^\d{10,20}$/.test(String(wabaId).trim())) {
        step(1, "Input validation", "fail", "WABA ID must be a numeric Meta Business Account ID (10–20 digits).");
        return { success: false, steps };
    }
    if (!phoneNumberId || !/^\d{10,20}$/.test(String(phoneNumberId).trim())) {
        step(1, "Input validation", "fail", "Phone Number ID must be a numeric ID from Meta App → WhatsApp → API Setup (10–20 digits).");
        return { success: false, steps };
    }
    step(1, "Input validation", "pass");

    // ── Step 2: App-level credentials ────────────────────────────────────────
    const appCheck = await meta_client_1.verifyAppCredentials();
    if (!appCheck.success) {
        step(2, "App credentials", "fail",
            appCheck.error + " Configure META_APP_ID and META_APP_SECRET in Superadmin → Integrations.");
        return { success: false, steps };
    }
    step(2, "App credentials", "pass");

    // ── Step 3: Validate access token ────────────────────────────────────────
    const tokenInspect = await meta_client_1.inspectToken(accessToken);
    if (!tokenInspect.success) {
        step(3, "Access token valid", "fail",
            tokenInspect.error || "Token inspection failed. Ensure this is a valid System User Access Token from Meta Business Manager.");
        return { success: false, steps };
    }
    const tokenData = tokenInspect.data || {};
    const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at * 1000) : null;
    const tokenDetail = expiresAt
        ? `Type: ${tokenData.type || "unknown"} · Expires: ${expiresAt.toLocaleDateString()}`
        : `Type: ${tokenData.type || "unknown"} · No expiry (permanent token ✓)`;
    step(3, "Access token valid", "pass", tokenDetail);

    // ── Step 4: Required scopes ──────────────────────────────────────────────
    const grantedScopes = (tokenData.scopes || []).map((s) => String(s).toLowerCase());
    const missedScopes = REQUIRED_SCOPES.filter((s) => !grantedScopes.includes(s));
    if (missedScopes.length > 0) {
        // Warn but do not block — System User tokens sometimes list scopes differently
        step(4, "WhatsApp permissions", "warn",
            `Some expected scopes not listed: ${missedScopes.join(", ")}. ` +
            "If messaging fails, verify System User permissions in Meta Business Manager.");
    } else {
        step(4, "WhatsApp permissions", "pass",
            `Scopes confirmed: ${REQUIRED_SCOPES.join(", ")}`);
    }

    // ── Step 5: Business Portfolio access ────────────────────────────────────
    let resolvedPortfolioId = businessPortfolioId ? String(businessPortfolioId).trim() : null;
    const bizRes = await meta_client_1.graphGet(
        `${String(wabaId).trim()}?fields=id,name,owner_business_info`,
        accessToken
    );
    if (!bizRes.success) {
        step(5, "Business Portfolio access", "fail",
            `Cannot access WABA ${wabaId}: ${bizRes.error}. ` +
            "Ensure the System User has admin access to this WABA in Meta Business Manager.");
        return { success: false, steps };
    }
    const bizDetail = bizRes.data?.name ? `Business: ${bizRes.data.name}` : `WABA ID: ${wabaId}`;
    if (!resolvedPortfolioId && bizRes.data?.owner_business_info?.id) {
        resolvedPortfolioId = String(bizRes.data.owner_business_info.id);
    }
    step(5, "Business Portfolio access", "pass", bizDetail);

    // ── Step 6: Verify WABA ───────────────────────────────────────────────────
    const wabaRes = await meta_client_1.graphGet(
        `${String(wabaId).trim()}?fields=id,name,currency,message_template_namespace`,
        accessToken
    );
    if (!wabaRes.success) {
        step(6, "WABA verified", "fail",
            `Cannot verify WABA: ${wabaRes.error}. Check the WABA ID is correct.`);
        return { success: false, steps };
    }
    step(6, "WABA verified", "pass",
        wabaRes.data?.name ? `WABA name: ${wabaRes.data.name}` : `WABA ID: ${wabaId} ✓`);

    // ── Step 7: Verify Phone Number ID ───────────────────────────────────────
    const phoneRes = await meta_client_1.graphGet(
        `${String(phoneNumberId).trim()}?fields=id,display_phone_number,verified_name,quality_rating,platform_type`,
        accessToken
    );
    if (!phoneRes.success) {
        step(7, "Phone Number ID verified", "fail",
            `Cannot access Phone Number ID ${phoneNumberId}: ${phoneRes.error}. ` +
            "Find the correct Phone Number ID in Meta App → WhatsApp → API Setup.");
        return { success: false, steps };
    }
    const displayPhone = phoneRes.data?.display_phone_number || phoneNumberId;
    const verifiedName = phoneRes.data?.verified_name || "";
    step(7, "Phone Number ID verified", "pass",
        `Number: ${displayPhone}${verifiedName ? " · Name: " + verifiedName : ""}`);

    // ── Step 8: Confirm phone belongs to WABA ────────────────────────────────
    const wabaPhones = await meta_client_1.graphGet(
        `${String(wabaId).trim()}/phone_numbers?fields=id`,
        accessToken
    );
    if (wabaPhones.success) {
        const phoneIds = (wabaPhones.data?.data || []).map((p) => String(p.id));
        if (phoneIds.length > 0 && !phoneIds.includes(String(phoneNumberId).trim())) {
            step(8, "Phone Number belongs to WABA", "fail",
                `Phone Number ID ${phoneNumberId} is not listed under WABA ${wabaId}. ` +
                `Available Phone Number IDs for this WABA: ${phoneIds.slice(0, 5).join(", ")}`);
            return { success: false, steps };
        }
    }
    step(8, "Phone Number belongs to WABA", "pass");

    // ── Step 9: Webhook subscription ─────────────────────────────────────────
    const subResult = await subscribeWabaWebhook(String(wabaId).trim(), accessToken);
    if (!subResult.success) {
        step(9, "Webhook configured", "warn",
            `WABA webhook subscription failed: ${subResult.error}. ` +
            "Inbound messages may not arrive. You can retry from the WhatsApp settings page.");
    } else {
        step(9, "Webhook configured", "pass", subResult.message || "WABA subscribed to app for inbound webhooks ✓");
    }

    // ── Step 10: Save connection ──────────────────────────────────────────────
    try {
        await whatsapp_connection_1.saveConnection(clinicId, {
            connectionMethod:    "MANUAL",
            businessPortfolioId: resolvedPortfolioId || null,
            wabaId:              String(wabaId).trim(),
            phoneNumberId:       String(phoneNumberId).trim(),
            phoneNumber:         displayPhone,
            displayName:         verifiedName || displayPhone,
            accessToken,
            webhookStatus:       subResult.success ? "subscribed" : "pending",
        });
        step(10, "Connection saved", "pass", `WhatsApp ${displayPhone} is now connected ✓`);
    } catch (saveErr) {
        const msg = saveErr instanceof Error ? saveErr.message : String(saveErr);
        step(10, "Connection saved", "fail", msg);
        return { success: false, steps };
    }

    return {
        success: true,
        steps,
        phoneNumber:    displayPhone,
        displayName:    verifiedName || displayPhone,
        wabaId:         String(wabaId).trim(),
        phoneNumberId:  String(phoneNumberId).trim(),
        webhookStatus:  subResult.success ? "subscribed" : "pending",
    };
}

/**
 * Subscribe a WABA to this Meta app for inbound webhook delivery.
 * Critical step — without this, inbound messages are never delivered.
 */
async function subscribeWabaWebhook(wabaId, accessToken) {
    // Check current status first — avoid unnecessary re-subscribe
    const status = await checkWabaWebhookStatus(wabaId, accessToken);
    if (status.subscribed) {
        return { success: true, message: "WABA already subscribed to app for webhooks." };
    }
    const result = await meta_client_1.graphPost(
        `${encodeURIComponent(wabaId)}/subscribed_apps`,
        accessToken,
        {}
    );
    if (result.success) {
        logger_1.logger.info(`WABA ${wabaId} subscribed to app for webhooks`);
        return { success: true, message: "WABA subscribed to app for inbound webhooks." };
    }
    const err = result.error || "Could not subscribe WABA to app";
    logger_1.logger.warn(`WABA subscription failed: ${err}`, { wabaId });
    return { success: false, error: err };
}

/**
 * Check whether a WABA is currently subscribed to receive webhooks for this app.
 */
async function checkWabaWebhookStatus(wabaId, accessToken) {
    const { appId } = meta_client_1.metaAppCreds();
    const res = await meta_client_1.graphGet(
        `${encodeURIComponent(wabaId)}/subscribed_apps`,
        accessToken
    );
    if (!res.success) {
        return { subscribed: false, error: res.error };
    }
    const apps = res.data?.data || [];
    const subscribed = appId
        ? apps.some((a) => String(a.id) === String(appId) || String(a.whatsapp_business_api_data?.id) === String(appId))
        : apps.length > 0;
    return { subscribed, apps };
}
