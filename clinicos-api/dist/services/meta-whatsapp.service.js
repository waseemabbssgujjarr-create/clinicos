"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureWhatsAppTable = ensureWhatsAppTable;
exports.getAccountByClinicId = getAccountByClinicId;
exports.getAccountByPhoneNumberId = getAccountByPhoneNumberId;
exports.saveClinicWhatsAppAccount = saveClinicWhatsAppAccount;
exports.disconnectClinicWhatsApp = disconnectClinicWhatsApp;
exports.exchangeOAuthCode = exchangeOAuthCode;
exports.sendWhatsAppForClinic = sendWhatsAppForClinic;
exports.graphGet = graphGet;
exports.subscribeWabaToApp = subscribeWabaToApp;
exports.getWabaSubscriptionStatus = getWabaSubscriptionStatus;

const prisma_1 = require("../lib/prisma");
const logger_1 = require("../lib/logger");
const token_crypto_service_1 = require("./token-crypto.service");
const crypto_1 = require("crypto");

// ── Helpers ───────────────────────────────────────────────────────────────────

function graphVersion() {
    return process.env.META_GRAPH_API_VERSION || "v21.0";
}

function metaCreds() {
    return {
        appId: process.env.META_APP_ID || "",
        appSecret: process.env.META_APP_SECRET || "",
    };
}

/**
 * Map Meta Graph API error messages to doctor-friendly instructions.
 */
function friendlyOAuthError(error) {
    const lower = (error || "").toLowerCase();

    if (lower.includes("client secret") || lower.includes("validating client secret")) {
        const { appId } = metaCreds();
        return (
            `Meta App Secret does not match App ID. In Superadmin → Integrations, re-enter the ` +
            `App Secret from Meta → App Dashboard → Settings → Basic for App ID ${appId}, then Save and try again.`
        );
    }
    if (lower.includes("redirect_uri") || lower.includes("redirect uri")) {
        const appUrl = process.env.APP_URL || "https://your-domain.com";
        return (
            `OAuth redirect URI mismatch. In Meta → Facebook Login → Settings add: ` +
            `${appUrl}/dashboard/settings/ — then try Connect again.`
        );
    }
    if (lower.includes("has been used") || lower.includes("authorization code has been used")) {
        return "Signup code already used. Click Connect WhatsApp again — do not refresh the callback page.";
    }
    if (
        (lower.includes("code") && lower.includes("expired")) ||
        (lower.includes("code") && lower.includes("invalid"))
    ) {
        return "Signup code expired. Click Connect WhatsApp again and complete Meta Embedded Signup without using browser Back.";
    }
    if (lower.includes("domain") || lower.includes("app domains") || lower.includes("can't load url")) {
        const appUrl = process.env.APP_URL || "https://your-domain.com";
        return (
            `Domain not allowed by Meta App. In Meta → App Dashboard → Settings → Basic, ` +
            `add ${new URL(appUrl).hostname} to App Domains, then Save Changes.`
        );
    }
    if (!error || error === "Token exchange failed — check Meta App ID, Secret, and redirect URIs.") {
        const { appId } = metaCreds();
        const appUrl = process.env.APP_URL || "https://your-domain.com";
        return (
            `Meta token exchange failed. Check Superadmin → Integrations: App ID must match ` +
            `Meta and App Secret must match Meta → Settings → Basic for App ID ${appId}. ` +
            `Also add OAuth redirect: ${appUrl}/dashboard/settings/`
        );
    }
    return error;
}

// ── Table bootstrap ───────────────────────────────────────────────────────────

async function ensureWhatsAppTable() {
    await prisma_1.prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ClinicWhatsAppAccount (
      id varchar(191) NOT NULL,
      clinicId varchar(191) NOT NULL,
      wabaId varchar(191) NOT NULL,
      phoneNumberId varchar(191) NOT NULL,
      displayPhoneNumber varchar(191) NULL,
      accessTokenEnc text NOT NULL,
      connectionStatus varchar(191) NOT NULL DEFAULT 'active',
      connectedAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY ClinicWhatsAppAccount_clinicId_key (clinicId),
      UNIQUE KEY ClinicWhatsAppAccount_phoneNumberId_key (phoneNumberId),
      KEY ClinicWhatsAppAccount_phoneNumberId_idx (phoneNumberId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    // Add metaMessageId column to Message table if it doesn't exist yet
    try {
        await prisma_1.prisma.$executeRawUnsafe(
            `ALTER TABLE Message ADD COLUMN metaMessageId varchar(191) NULL`
        );
    } catch (_) { /* column already exists — safe to ignore */ }
}

// ── Row helpers ───────────────────────────────────────────────────────────────

async function rowToAccount(row) {
    if (!row) return null;
    const token = (0, token_crypto_service_1.decryptToken)(row.accessTokenEnc);
    return {
        id: row.id,
        clinicId: row.clinicId,
        wabaId: row.wabaId,
        phoneNumberId: row.phoneNumberId,
        displayPhoneNumber: row.displayPhoneNumber,
        accessToken: token,
        connectionStatus: row.connectionStatus,
    };
}

// ── Account CRUD ──────────────────────────────────────────────────────────────

async function getAccountByClinicId(clinicId) {
    await ensureWhatsAppTable();
    const rows = await prisma_1.prisma.$queryRawUnsafe(
        "SELECT * FROM ClinicWhatsAppAccount WHERE clinicId = ? AND connectionStatus = 'active' LIMIT 1",
        clinicId
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    return rowToAccount(row);
}

async function getAccountByPhoneNumberId(phoneNumberId) {
    await ensureWhatsAppTable();
    const rows = await prisma_1.prisma.$queryRawUnsafe(
        "SELECT * FROM ClinicWhatsAppAccount WHERE phoneNumberId = ? AND connectionStatus = 'active' LIMIT 1",
        phoneNumberId
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    return rowToAccount(row);
}

async function saveClinicWhatsAppAccount(clinicId, data) {
    await ensureWhatsAppTable();
    const enc = (0, token_crypto_service_1.encryptToken)(data.accessToken);

    // Verify encrypt → decrypt round-trip before saving
    const roundtrip = (0, token_crypto_service_1.decryptToken)(enc);
    if (roundtrip !== data.accessToken) {
        throw new Error(
            "Token encryption round-trip failed. Check META_ENCRYPTION_KEY in .env — " +
            "use one stable key, then reconnect WhatsApp."
        );
    }

    const existing = await prisma_1.prisma.$queryRawUnsafe(
        "SELECT id FROM ClinicWhatsAppAccount WHERE clinicId = ? LIMIT 1",
        clinicId
    );
    const ex = Array.isArray(existing) ? existing[0] : null;

    if (ex) {
        await prisma_1.prisma.$executeRawUnsafe(
            `UPDATE ClinicWhatsAppAccount SET wabaId = ?, phoneNumberId = ?, displayPhoneNumber = ?,
             accessTokenEnc = ?, connectionStatus = 'active',
             connectedAt = CURRENT_TIMESTAMP(3), updatedAt = CURRENT_TIMESTAMP(3)
             WHERE clinicId = ?`,
            data.wabaId, data.phoneNumberId, data.displayPhoneNumber || null, enc, clinicId
        );
    } else {
        const id = crypto_1.randomBytes(12).toString("hex").slice(0, 24);
        await prisma_1.prisma.$executeRawUnsafe(
            `INSERT INTO ClinicWhatsAppAccount
             (id, clinicId, wabaId, phoneNumberId, displayPhoneNumber, accessTokenEnc, connectionStatus, connectedAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
            id, clinicId, data.wabaId, data.phoneNumberId, data.displayPhoneNumber || null, enc
        );
    }
}

async function disconnectClinicWhatsApp(clinicId) {
    await ensureWhatsAppTable();
    await prisma_1.prisma.$executeRawUnsafe(
        `UPDATE ClinicWhatsAppAccount SET connectionStatus = 'disconnected', updatedAt = CURRENT_TIMESTAMP(3) WHERE clinicId = ?`,
        clinicId
    );
}

// ── Graph API helpers ─────────────────────────────────────────────────────────

async function graphGet(url, token) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        return { success: false, error: data.error?.message || res.statusText, data };
    }
    return { success: true, data };
}

async function graphPost(path, token, body = {}) {
    const version = graphVersion();
    const url = path.startsWith("http")
        ? path
        : `https://graph.facebook.com/${version}/${path}`;
    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

// ── WABA subscription (CRITICAL — without this inbound webhooks are never delivered) ──

/**
 * Subscribe the WABA to this Meta app so inbound messages trigger the webhook.
 * This is the critical step — without this, inbound messages are never delivered.
 */
async function subscribeWabaToApp(wabaId, accessToken) {
    if (!wabaId || !accessToken) {
        return { success: false, error: "wabaId and accessToken are required" };
    }

    // Check current subscription status first
    const status = await getWabaSubscriptionStatus(wabaId, accessToken);
    if (status.subscribed) {
        logger_1.logger.info(`Meta WABA ${wabaId} already subscribed to app`);
        return { success: true, message: "WABA already subscribed to app." };
    }

    const result = await graphPost(
        `${encodeURIComponent(wabaId)}/subscribed_apps`,
        accessToken,
        {}
    );

    if (result.ok) {
        logger_1.logger.info(`Meta WABA ${wabaId} subscribed to app for inbound webhooks`);
        return { success: true, message: "WABA subscribed to app for inbound webhooks." };
    }

    const errMsg = result.data?.error?.message || "Could not subscribe WABA to app";
    logger_1.logger.error("WABA subscription failed", { wabaId, err: errMsg });
    return { success: false, error: errMsg };
}

/**
 * Return subscription status of a WABA.
 */
async function getWabaSubscriptionStatus(wabaId, accessToken) {
    const res = await graphGet(
        `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(wabaId)}/subscribed_apps`,
        accessToken
    );
    if (!res.success) {
        return { subscribed: false, error: res.error };
    }
    const apps = res.data?.data || [];
    const { appId } = metaCreds();
    // If we have our app ID, check specifically for it; otherwise any subscription is fine
    const subscribed = appId
        ? apps.some((a) => String(a.id) === String(appId) || String(a.whatsapp_business_api_data?.id) === String(appId))
        : apps.length > 0;
    return { subscribed, apps };
}

// ── Token exchange ─────────────────────────────────────────────────────────────

/**
 * Verify the App ID + Secret pair using the client_credentials grant before
 * attempting code exchange.
 */
async function verifyMetaCredentials(appId, appSecret) {
    const url =
        `https://graph.facebook.com/${graphVersion()}/oauth/access_token` +
        `?client_id=${encodeURIComponent(appId)}` +
        `&client_secret=${encodeURIComponent(appSecret)}` +
        `&grant_type=client_credentials`;
    try {
        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.access_token) return { success: true };
        const err = data.error?.message || "Invalid App ID / App Secret pair";
        return { success: false, error: err };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}

/**
 * Try exchanging the OAuth code with the given set of parameters.
 * Tries SDK mode (no redirect_uri) first, then falls back to redirect-URI mode
 * so both FB.login (Embedded Signup) and traditional OAuth flows work.
 */
async function tryExchangeCode(code, redirectUri) {
    const { appId, appSecret } = metaCreds();
    const base = `https://graph.facebook.com/${graphVersion()}/oauth/access_token`;

    const attempts = [];
    // SDK mode first (what Embedded Signup FB.login returns)
    attempts.push({ client_id: appId, client_secret: appSecret, code });
    // Then with redirect_uri (traditional OAuth callback)
    if (redirectUri) {
        attempts.push({ client_id: appId, client_secret: appSecret, code, redirect_uri: redirectUri });
    }

    let lastError = "Token exchange failed — check Meta App ID, Secret, and redirect URIs.";
    for (const params of attempts) {
        const qs = new URLSearchParams(params).toString();
        const res = await fetch(`${base}?${qs}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.access_token) {
            return { success: true, accessToken: data.access_token };
        }
        const err = data.error?.message || data.error_description || lastError;
        lastError = err;
        // Code already used — no point trying remaining attempts
        const lower = err.toLowerCase();
        if (lower.includes("has been used") || lower.includes("authorization code has been used")) {
            break;
        }
    }
    return { success: false, error: lastError };
}

/**
 * Resolve WABA ID, phone number ID, and display number from the access token
 * by walking the Graph API hierarchy (user → businesses → WABAs → phone numbers).
 * Short-circuits immediately when the Embedded Signup sessionInfo already provided them.
 *
 * Key improvement vs previous version:
 *  - When wabaId + phoneNumberId are provided but displayPhoneNumber is missing,
 *    fetches it directly from the phoneNumberId endpoint.
 */
async function resolveEmbeddedAssets(accessToken, wabaIdInput, phoneNumberIdInput, displayNumberInput) {
    const version = graphVersion();

    // Session info from Embedded Signup is authoritative — trust it
    if (wabaIdInput && phoneNumberIdInput) {
        let displayPhoneNumber = displayNumberInput || null;

        // Fetch display number if not provided
        if (!displayPhoneNumber) {
            const phoneRes = await graphGet(
                `https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberIdInput)}` +
                `?fields=display_phone_number,verified_name`,
                accessToken
            );
            if (phoneRes.success && phoneRes.data?.display_phone_number) {
                displayPhoneNumber = String(phoneRes.data.display_phone_number);
            }
        }

        return {
            wabaId: wabaIdInput,
            phoneNumberId: phoneNumberIdInput,
            displayPhoneNumber,
        };
    }

    // ── Fallback: walk the Graph API ──────────────────────────────────────────
    // This runs when sessionInfo postMessage was not captured (race condition,
    // popup blocked, or user completed flow without Embedded Signup extras).

    logger_1.logger.warn("resolveEmbeddedAssets: no wabaId/phoneNumberId from session — walking Graph API");

    // Try /me?fields=id first to confirm token is valid
    const me = await graphGet(
        `https://graph.facebook.com/${version}/me?fields=id`,
        accessToken
    );
    if (!me.success) {
        logger_1.logger.error("resolveEmbeddedAssets: /me failed", { err: me.error });
        return null;
    }

    // Try business hierarchy: user → businesses → WABAs → phone numbers
    const biz = await graphGet(
        `https://graph.facebook.com/${version}/${me.data.id}/businesses`,
        accessToken
    );
    const businesses = biz.data?.data || [];

    for (const b of businesses) {
        // Try owned WABAs first, then client WABAs (agencies)
        for (const wabaEndpoint of ["owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"]) {
            const wabaRes = await graphGet(
                `https://graph.facebook.com/${version}/${b.id}/${wabaEndpoint}`,
                accessToken
            );
            const wabas = wabaRes.data?.data || [];
            for (const w of wabas) {
                const wabaId = String(w.id || "");
                if (!wabaId) continue;
                const phones = await graphGet(
                    `https://graph.facebook.com/${version}/${wabaId}/phone_numbers` +
                    `?fields=id,display_phone_number,verified_name`,
                    accessToken
                );
                const list = phones.data?.data || [];
                if (list.length) {
                    return {
                        wabaId,
                        phoneNumberId: String(list[0].id || ""),
                        displayPhoneNumber: String(list[0].display_phone_number || ""),
                    };
                }
            }
        }
    }

    // Last resort: use whatever the caller passed even if partial
    if (phoneNumberIdInput) {
        return {
            wabaId: wabaIdInput || "",
            phoneNumberId: phoneNumberIdInput,
            displayPhoneNumber: displayNumberInput || null,
        };
    }

    logger_1.logger.error("resolveEmbeddedAssets: could not find any WABA/phone_number via Graph API", {
        userId: me.data?.id,
        businessCount: businesses.length,
    });
    return null;
}

/**
 * Full Embedded Signup OAuth flow:
 *  1. Verify App ID + Secret (fail fast with a friendly error)
 *  2. Exchange code for access token
 *  3. Resolve WABA + phone number IDs
 *  4. (Caller must also call subscribeWabaToApp after saving the account)
 */
async function exchangeOAuthCode(code, opts = {}) {
    const { appId, appSecret } = metaCreds();

    if (!appId || !appSecret) {
        return {
            success: false,
            error: "META_APP_ID and META_APP_SECRET must be configured in Superadmin → Integrations.",
        };
    }

    // Verify credentials pair before burning the one-time code
    const credCheck = await verifyMetaCredentials(appId, appSecret);
    if (!credCheck.success) {
        return { success: false, error: friendlyOAuthError(credCheck.error || "") };
    }

    const redirectUri = opts.redirectUri || `${process.env.APP_URL || ""}/dashboard/settings/`;
    const exchanged = await tryExchangeCode(code, opts.sdkMode ? "" : redirectUri);
    if (!exchanged.success) {
        return { success: false, error: friendlyOAuthError(exchanged.error || "") };
    }

    const assets = await resolveEmbeddedAssets(
        exchanged.accessToken,
        opts.wabaId || "",
        opts.phoneNumberId || "",
        opts.displayPhoneNumber || ""
    );

    if (!assets || !assets.phoneNumberId) {
        return {
            success: false,
            error:
                "Could not read WhatsApp number from Meta. Complete the Embedded Signup flow in Meta " +
                "(all steps including phone selection), then try Connect again.",
        };
    }

    return {
        success: true,
        accessToken: exchanged.accessToken,
        wabaId: assets.wabaId,
        phoneNumberId: assets.phoneNumberId,
        displayPhoneNumber: assets.displayPhoneNumber,
    };
}

// ── Outbound messaging ────────────────────────────────────────────────────────

async function sendWhatsAppForClinic(clinicId, to, body) {
    const account = await getAccountByClinicId(clinicId);
    if (!account?.accessToken) {
        logger_1.logger.warn("Meta WhatsApp: no active account for clinic", { clinicId });
        return null;
    }

    // Strip all non-digit characters; Meta expects pure digits (no +)
    const toDigits = String(to).replace(/\D/g, "");
    const url = `https://graph.facebook.com/${graphVersion()}/${account.phoneNumberId}/messages`;

    const payload = {
        messaging_product: "whatsapp",
        to: toDigits,
        type: "text",
        text: { body: String(body).slice(0, 4096) },
    };

    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${account.accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        logger_1.logger.error("Meta WhatsApp send failed", { clinicId, err: data.error?.message });
        return null;
    }

    const msgId = data.messages?.[0]?.id || null;
    logger_1.logger.info(`Meta WhatsApp sent to ${to}: ${msgId}`);
    return msgId;
}
