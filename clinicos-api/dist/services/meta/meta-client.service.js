"use strict";
/**
 * Meta Graph API Client — Doctors My Agency
 *
 * Centralised HTTP layer for all Meta Graph API calls.
 * Business logic MUST NOT call fetch() against graph.facebook.com directly.
 * Every outbound call to Meta goes through this module.
 *
 * No IQPigeon dependency. No external platform dependency.
 * Directly implements Meta Cloud API v21.0+.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphVersion = graphVersion;
exports.metaAppCreds = metaAppCreds;
exports.graphGet = graphGet;
exports.graphPost = graphPost;
exports.graphDelete = graphDelete;
exports.inspectToken = inspectToken;
exports.verifyAppCredentials = verifyAppCredentials;

const logger_1 = require("../../lib/logger");

// All outbound Meta API requests must complete within this budget.
// api-proxy.php has a 45 s timeout; we use 25 s so Express responds
// with a proper JSON error rather than the proxy returning a raw 502.
const META_FETCH_TIMEOUT_MS = 25000;

function metaSignal() {
    // AbortSignal.timeout() is available in Node 17.3+.
    // Fall back silently on older runtimes (no timeout, original behaviour).
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        return AbortSignal.timeout(META_FETCH_TIMEOUT_MS);
    }
    return undefined;
}

function graphVersion() {
    return process.env.META_GRAPH_API_VERSION || "v21.0";
}

function metaAppCreds() {
    return {
        appId: process.env.META_APP_ID || "",
        appSecret: process.env.META_APP_SECRET || "",
    };
}

function graphBaseUrl() {
    return `https://graph.facebook.com/${graphVersion()}`;
}

/**
 * Build a full URL from a path (absolute or relative) + optional query params.
 */
function buildUrl(path, params = {}) {
    const base = path.startsWith("http") ? path : `${graphBaseUrl()}/${path.replace(/^\//, "")}`;
    const entries = Object.entries(params).filter(([, v]) => v != null && v !== "");
    if (!entries.length) return base;
    const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
    return base.includes("?") ? `${base}&${qs}` : `${base}?${qs}`;
}

/**
 * GET a Meta Graph API resource.
 * Returns { success, data } or { success: false, error, httpStatus }.
 */
async function graphGet(path, accessToken, params = {}) {
    const url = buildUrl(path, params);
    try {
        const signal = metaSignal();
        const fetchOpts = {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
            },
        };
        if (signal) fetchOpts.signal = signal;
        const res = await fetch(url, fetchOpts);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = data?.error?.message || data?.error?.type || res.statusText;
            logger_1.logger.debug(`Meta GET ${path} → ${res.status}: ${err}`);
            return { success: false, error: err, httpStatus: res.status, data };
        }
        return { success: true, data };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const isTimeout = e?.name === "TimeoutError" || msg.includes("timed out") || msg.includes("AbortError");
        logger_1.logger.error(`Meta GET ${path} ${isTimeout ? "timed out" : "network error"}: ${msg}`);
        return {
            success: false,
            error: isTimeout ? `Meta API timed out after ${META_FETCH_TIMEOUT_MS / 1000}s` : `Network error: ${msg}`,
            httpStatus: 0,
        };
    }
}

/**
 * POST to a Meta Graph API endpoint.
 */
async function graphPost(path, accessToken, body = {}) {
    const url = buildUrl(path);
    try {
        const signal = metaSignal();
        const fetchOpts = {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(body),
        };
        if (signal) fetchOpts.signal = signal;
        const res = await fetch(url, fetchOpts);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = data?.error?.message || data?.error?.type || res.statusText;
            logger_1.logger.debug(`Meta POST ${path} → ${res.status}: ${err}`);
            return { success: false, error: err, httpStatus: res.status, data };
        }
        return { success: true, data };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const isTimeout = e?.name === "TimeoutError" || msg.includes("timed out") || msg.includes("AbortError");
        logger_1.logger.error(`Meta POST ${path} ${isTimeout ? "timed out" : "network error"}: ${msg}`);
        return {
            success: false,
            error: isTimeout ? `Meta API timed out after ${META_FETCH_TIMEOUT_MS / 1000}s` : `Network error: ${msg}`,
            httpStatus: 0,
        };
    }
}

/**
 * DELETE a Meta Graph API resource.
 */
async function graphDelete(path, accessToken) {
    const url = buildUrl(path);
    try {
        const signal = metaSignal();
        const fetchOpts = {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
            },
        };
        if (signal) fetchOpts.signal = signal;
        const res = await fetch(url, fetchOpts);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = data?.error?.message || res.statusText;
            return { success: false, error: err, httpStatus: res.status, data };
        }
        return { success: true, data };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: `Network error: ${msg}`, httpStatus: 0 };
    }
}

/**
 * Inspect a token via Meta's debug_token endpoint.
 * Returns token metadata: app_id, type, application, expires_at, scopes, etc.
 */
async function inspectToken(accessToken) {
    const { appId, appSecret } = metaAppCreds();
    if (!appId || !appSecret) {
        return { success: false, error: "META_APP_ID and META_APP_SECRET must be configured." };
    }
    const appToken = `${appId}|${appSecret}`;
    const res = await graphGet(
        `https://graph.facebook.com/${graphVersion()}/debug_token`,
        appToken,
        { input_token: accessToken }
    );
    if (!res.success) return res;
    const d = res.data?.data || res.data || {};
    if (!d.is_valid) {
        return {
            success: false,
            error: d.error?.message || "Access token is not valid",
            data: d,
        };
    }
    return { success: true, data: d };
}

/**
 * Verify our own Meta App ID + App Secret pair using client_credentials grant.
 * This must pass before we attempt any per-clinic token exchange.
 */
async function verifyAppCredentials() {
    const { appId, appSecret } = metaAppCreds();
    if (!appId || !appSecret) {
        return {
            success: false,
            error: "META_APP_ID and META_APP_SECRET are not configured. Set them in Superadmin → Integrations.",
        };
    }
    const url =
        `https://graph.facebook.com/${graphVersion()}/oauth/access_token` +
        `?client_id=${encodeURIComponent(appId)}` +
        `&client_secret=${encodeURIComponent(appSecret)}` +
        `&grant_type=client_credentials`;
    try {
        const signal = metaSignal();
        const fetchOpts = {};
        if (signal) fetchOpts.signal = signal;
        const res = await fetch(url, fetchOpts);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.access_token) {
            return { success: true };
        }
        const err = data?.error?.message || "Invalid App ID / App Secret pair";
        logger_1.logger.warn(`verifyAppCredentials failed: ${err}`);
        return { success: false, error: err };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const isTimeout = e?.name === "TimeoutError" || msg.includes("timed out");
        logger_1.logger.error(`verifyAppCredentials ${isTimeout ? "timed out" : "network error"}: ${msg}`);
        return {
            success: false,
            error: isTimeout
                ? `Meta credential check timed out after ${META_FETCH_TIMEOUT_MS / 1000}s — check connectivity to graph.facebook.com`
                : `Network error: ${msg}`,
        };
    }
}
