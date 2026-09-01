"use strict";
/**
 * WhatsApp Embedded Signup Service — Doctors My Agency
 *
 * Implements the Meta Embedded Signup OAuth flow, isolated behind a feature flag.
 *
 * FEATURE FLAG: WHATSAPP_EMBEDDED_SIGNUP_ENABLED
 *   false (default) — Embedded Signup is completely disabled.
 *                     No OAuth calls. No FB SDK init required.
 *                     Manual Meta Connection is the only available method.
 *   true            — Activated after Meta App Review approval.
 *                     Changing the flag to true requires NO code changes.
 *
 * Both this service and whatsapp-manual.service ultimately call
 * whatsapp-connection.service.saveConnection() — identical storage path.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmbeddedSignupEnabled = isEmbeddedSignupEnabled;
exports.getEmbeddedSignupConfig = getEmbeddedSignupConfig;
exports.exchangeEmbeddedSignupCode = exchangeEmbeddedSignupCode;

const meta_client_1 = require("./meta-client.service");
const whatsapp_connection_1 = require("./whatsapp-connection.service");
const whatsapp_manual_1 = require("./whatsapp-manual.service");
const logger_1 = require("../../lib/logger");

// ── Feature flag ──────────────────────────────────────────────────────────────

/**
 * Returns true when:
 *  1. WHATSAPP_EMBEDDED_SIGNUP_ENABLED is explicitly "true" or "1", OR
 *  2. All three required Meta credentials are configured (auto-enable)
 *     — META_APP_ID + META_APP_SECRET + META_CONFIG_ID all present.
 *
 * Auto-enable means: once the admin saves credentials in Integrations,
 * the Connect button appears automatically without needing a separate toggle.
 * Setting WHATSAPP_EMBEDDED_SIGNUP_ENABLED=false explicitly overrides this.
 */
function isEmbeddedSignupEnabled() {
    const raw = (process.env.WHATSAPP_EMBEDDED_SIGNUP_ENABLED || "").trim().toLowerCase();

    // Explicit disable always wins
    if (raw === "false" || raw === "0") return false;

    // Explicit enable
    if (raw === "true" || raw === "1") return true;

    // Auto-enable: all three Meta credentials are present
    const appId    = (process.env.META_APP_ID    || "").trim();
    const secret   = (process.env.META_APP_SECRET || "").trim();
    const configId = (process.env.META_CONFIG_ID  || "").trim();
    return !!(appId && secret && configId);
}

/**
 * Return the Embedded Signup configuration needed by the frontend FB SDK.
 * If the flag is disabled OR credentials are incomplete, returns { enabled: false }.
 */
function getEmbeddedSignupConfig() {
    const appId    = (process.env.META_APP_ID    || "").trim();
    const secret   = (process.env.META_APP_SECRET || "").trim();
    const configId = (process.env.META_CONFIG_ID  || "").trim();

    // Explicit disable
    const rawFlag = (process.env.WHATSAPP_EMBEDDED_SIGNUP_ENABLED || "").trim().toLowerCase();
    if (rawFlag === "false" || rawFlag === "0") {
        return {
            enabled: false,
            code: "EMBEDDED_SIGNUP_DISABLED",
            message: "Meta Embedded Signup is disabled. Set WHATSAPP_EMBEDDED_SIGNUP_ENABLED=true in Superadmin → Integrations to enable.",
        };
    }

    if (!appId || !secret) {
        return {
            enabled: false,
            code: "META_CREDENTIALS_MISSING",
            message: "Meta App ID and App Secret are required. Set them in Superadmin → Integrations.",
        };
    }

    if (!configId) {
        return {
            enabled: false,
            code: "META_CONFIG_ID_MISSING",
            message: "Embedded Signup Config ID is required. Go to Meta App → WhatsApp → Embedded Signup, create a configuration, and paste the Config ID in Superadmin → Integrations.",
        };
    }

    return {
        enabled: true,
        appId,
        configId,
        graphVersion: meta_client_1.graphVersion(),
        extras: {
            version: "v4",
            sessionInfoVersion: "3",
            featureType: "whatsapp_business_app_onboarding",
        },
    };
}

// ── OAuth code exchange ───────────────────────────────────────────────────────

/**
 * Complete the Embedded Signup flow after FB.login() returns a code.
 *
 * Steps:
 *  1. Check feature flag
 *  2. Verify app credentials
 *  3. Exchange OAuth code for access token
 *  4. Resolve WABA + phone number from session info or Graph API walk
 *  5. Subscribe WABA to webhook
 *  6. Save via whatsapp-connection.service (same path as manual)
 */
async function exchangeEmbeddedSignupCode(clinicId, code, sessionInfo = {}) {
    // ── Guard: feature flag ───────────────────────────────────────────────────
    if (!isEmbeddedSignupEnabled()) {
        return {
            success: false,
            code: "EMBEDDED_SIGNUP_DISABLED",
            error:
                "Meta Embedded Signup is currently disabled. " +
                "Use Manual Meta Connection instead.",
        };
    }

    // ── Step 1: App credentials ───────────────────────────────────────────────
    const appCheck = await meta_client_1.verifyAppCredentials();
    if (!appCheck.success) {
        return { success: false, error: appCheck.error };
    }

    // ── Step 2: Exchange code for token ───────────────────────────────────────
    const exchanged = await tryExchangeCode(code);
    if (!exchanged.success) {
        return { success: false, error: friendlyOAuthError(exchanged.error || "") };
    }

    const accessToken = exchanged.accessToken;

    // ── Step 3: Resolve WABA + phone number ───────────────────────────────────
    const wabaIdInput      = sessionInfo.waba_id       || sessionInfo.wabaId       || "";
    const phoneNumberInput = sessionInfo.phone_number_id || sessionInfo.phoneNumberId || "";
    const displayInput     = sessionInfo.display_phone_number || sessionInfo.displayPhoneNumber || "";

    logger_1.logger.info("Embedded Signup: resolving assets", {
        clinicId,
        wabaIdPresent:       !!wabaIdInput,
        phoneNumberIdPresent: !!phoneNumberInput,
        displayPresent:       !!displayInput,
    });

    const assets = await resolveEmbeddedAssets(accessToken, wabaIdInput, phoneNumberInput, displayInput);

    logger_1.logger.info("Embedded Signup: resolveEmbeddedAssets result", {
        clinicId,
        assetsFound:    !!assets,
        wabaId:         assets?.wabaId         || "(none)",
        phoneNumberId:  assets?.phoneNumberId  || "(none)",
        displayPhone:   assets?.displayPhoneNumber || "(none)",
    });

    if (!assets || !assets.phoneNumberId) {
        return {
            success: false,
            error:
                "Could not read WhatsApp phone number from Meta. " +
                "Complete all steps in the Embedded Signup flow including phone selection, then try again.",
        };
    }

    // ── Step 4: Subscribe WABA webhook ────────────────────────────────────────
    const subResult = await whatsapp_manual_1.subscribeWabaWebhook(assets.wabaId, accessToken);
    if (!subResult.success) {
        logger_1.logger.warn("Embedded Signup: WABA subscription failed (non-fatal)", {
            clinicId, wabaId: assets.wabaId, err: subResult.error,
        });
    }

    // ── Step 5: Save — same path as manual connection ─────────────────────────
    await whatsapp_connection_1.saveConnection(clinicId, {
        connectionMethod:    "EMBEDDED_SIGNUP",
        businessPortfolioId: null,
        wabaId:              assets.wabaId,
        phoneNumberId:       assets.phoneNumberId,
        phoneNumber:         assets.displayPhoneNumber,
        displayName:         assets.displayPhoneNumber,
        accessToken,
        webhookStatus:       subResult.success ? "subscribed" : "pending",
    });

    logger_1.logger.info(`Embedded Signup complete for clinic ${clinicId}: ${assets.displayPhoneNumber}`);

    return {
        success: true,
        phoneNumber:  assets.displayPhoneNumber,
        wabaId:       assets.wabaId,
        phoneNumberId: assets.phoneNumberId,
        webhookStatus: subResult.success ? "subscribed" : "pending",
    };
}

// ── Private helpers ────────────────────────────────────────────────────────────

async function tryExchangeCode(code) {
    const { appId, appSecret } = meta_client_1.metaAppCreds();
    const base = `https://graph.facebook.com/${meta_client_1.graphVersion()}/oauth/access_token`;
    const redirectUri = `${process.env.APP_URL || "https://doctorsmyagency.com"}/dashboard/settings/`;

    // Abort if Meta doesn't respond within 25 seconds (proxy timeout is 45s)
    function makeSignal() {
        if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
            return AbortSignal.timeout(25000);
        }
        return undefined;
    }

    // Try SDK mode first (no redirect_uri), then with redirect_uri fallback
    const attempts = [
        { client_id: appId, client_secret: appSecret, code },
        { client_id: appId, client_secret: appSecret, code, redirect_uri: redirectUri },
    ];

    let lastError = "Token exchange failed";
    for (const params of attempts) {
        try {
            const qs = new URLSearchParams(params).toString();
            const res = await fetch(`${base}?${qs}`, { signal: makeSignal() });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.access_token) {
                return { success: true, accessToken: data.access_token };
            }
            lastError = data?.error?.message || data?.error_description || lastError;
            if (/has been used|authorization code has been used/i.test(lastError)) break;
        } catch (e) {
            lastError = e instanceof Error ? e.message : String(e);
        }
    }
    return { success: false, error: lastError };
}

async function resolveEmbeddedAssets(accessToken, wabaIdInput, phoneNumberIdInput, displayInput) {
    const version = meta_client_1.graphVersion();

    // Session info from Embedded Signup is authoritative
    if (wabaIdInput && phoneNumberIdInput) {
        let displayPhoneNumber = displayInput || null;
        if (!displayPhoneNumber) {
            const pr = await meta_client_1.graphGet(
                `${phoneNumberIdInput}?fields=display_phone_number,verified_name`,
                accessToken
            );
            if (pr.success && pr.data?.display_phone_number) {
                displayPhoneNumber = String(pr.data.display_phone_number);
            }
        }
        return { wabaId: wabaIdInput, phoneNumberId: phoneNumberIdInput, displayPhoneNumber };
    }

    // Fallback: walk Graph API hierarchy
    logger_1.logger.warn("Embedded Signup: session info missing — walking Graph API for WABA/phone");
    const me = await meta_client_1.graphGet(`https://graph.facebook.com/${version}/me?fields=id`, accessToken);
    if (!me.success) {
        logger_1.logger.error("Embedded Signup: /me failed", { httpStatus: me.httpStatus, error: me.error });
        return null;
    }
    logger_1.logger.info("Embedded Signup: /me OK", { userId: me.data?.id });

    const biz = await meta_client_1.graphGet(`https://graph.facebook.com/${version}/${me.data.id}/businesses`, accessToken);
    logger_1.logger.info("Embedded Signup: businesses", { count: (biz.data?.data || []).length });
    for (const b of biz.data?.data || []) {
        for (const endpoint of ["owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"]) {
            const wabaRes = await meta_client_1.graphGet(
                `https://graph.facebook.com/${version}/${b.id}/${endpoint}`, accessToken
            );
            for (const w of wabaRes.data?.data || []) {
                const wabaId = String(w.id || "");
                if (!wabaId) continue;
                const phones = await meta_client_1.graphGet(
                    `https://graph.facebook.com/${version}/${wabaId}/phone_numbers?fields=id,display_phone_number`,
                    accessToken
                );
                const list = phones.data?.data || [];
                if (list.length) {
                    return {
                        wabaId,
                        phoneNumberId: String(list[0].id),
                        displayPhoneNumber: String(list[0].display_phone_number || ""),
                    };
                }
            }
        }
    }

    if (phoneNumberIdInput) {
        return { wabaId: wabaIdInput || "", phoneNumberId: phoneNumberIdInput, displayPhoneNumber: displayInput || null };
    }
    return null;
}

function friendlyOAuthError(error) {
    const lower = error.toLowerCase();
    if (lower.includes("client secret") || lower.includes("validating client secret")) {
        return "Meta App Secret mismatch. Re-enter App Secret from Meta → App Dashboard → Settings → Basic in Superadmin → Integrations.";
    }
    if (lower.includes("redirect_uri") || lower.includes("redirect uri")) {
        return `OAuth redirect URI mismatch. In Meta → Facebook Login → Settings add: ${process.env.APP_URL || "https://doctorsmyagency.com"}/dashboard/settings/`;
    }
    if (lower.includes("has been used")) {
        return "Signup code already used. Click Connect WhatsApp again for a fresh code.";
    }
    if (lower.includes("expired") || (lower.includes("code") && lower.includes("invalid"))) {
        return "Signup code expired. Click Connect WhatsApp again and complete the flow without using browser Back.";
    }
    if (lower.includes("domain") || lower.includes("app domains")) {
        return `Domain not allowed. Add ${new URL(process.env.APP_URL || "https://doctorsmyagency.com").hostname} to Meta App Domains in Meta App → Settings → Basic.`;
    }
    return error || "Meta token exchange failed. Check app credentials in Superadmin → Integrations.";
}
