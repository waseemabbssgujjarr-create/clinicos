"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAISettings = getAISettings;
exports.getPublicAIBranding = getPublicAIBranding;
exports.getAIClient = getAIClient;
exports.getAIModel = getAIModel;
exports.testAIConnection = testAIConnection;
const openai_1 = __importDefault(require("openai"));
let client = null;

// Known-good DeepSeek model names. Any value from PlatformSetting that doesn't
// match (e.g. "DeepSeek-v4" — wrong case, wrong name) is replaced with the
// correct default so the API request never fails with "supported API model names".
const DEEPSEEK_VALID_MODELS = [
    'deepseek-v4-flash',
    'deepseek-v4-pro',
    'deepseek-v4-flash-vision-exp',
    'deepseek-chat',
    'deepseek-coder',
    'deepseek-reasoner',
];
const DEEPSEEK_DEFAULT_MODEL = 'deepseek-v4-flash';

function sanitizeDeepSeekModel(raw) {
    if (!raw) return DEEPSEEK_DEFAULT_MODEL;
    const trimmed = raw.trim();
    // Exact match (case-sensitive) — trust it
    if (DEEPSEEK_VALID_MODELS.includes(trimmed)) return trimmed;
    // Case-insensitive match — normalise to the correct casing
    const lower = trimmed.toLowerCase();
    const found = DEEPSEEK_VALID_MODELS.find((m) => m.toLowerCase() === lower);
    if (found) return found;
    // Unrecognised value (e.g. "DeepSeek-v4", "deepseek-v4") — use default and warn
    const logger = require('./logger').logger;
    logger.warn(`AI_MODEL value "${trimmed}" is not a recognised DeepSeek model. ` +
        `Falling back to "${DEEPSEEK_DEFAULT_MODEL}". ` +
        `Fix via Superadmin → Integrations → AI Model, or set AI_MODEL=${DEEPSEEK_DEFAULT_MODEL} in .env.`);
    return DEEPSEEK_DEFAULT_MODEL;
}

function isPlaceholder(value) {
    if (!value)
        return true;
    const v = value.toLowerCase();
    return v === 'placeholder' || v.includes('placeholder') || v === 'replace_me';
}
function getPublicAIBranding() {
    return {
        engine: 'DMA Clinic Knowledge Engine',
        version: '1.0',
    };
}
function getAISettings() {
    const provider = (process.env.AI_PROVIDER || 'deepseek').toLowerCase();
    if (provider === 'openai') {
        return {
            provider: 'openai',
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.AI_BASE_URL || process.env.DEEPSEEK_BASE_URL || undefined,
            model: process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o',
            configured: !isPlaceholder(process.env.OPENAI_API_KEY),
        };
    }
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
    // Sanitize: PlatformSetting may have stored a bad model name (e.g. "DeepSeek-v4").
    // sanitizeDeepSeekModel() corrects case errors and unknown names before the API call.
    const rawModel = process.env.AI_MODEL || process.env.DEEPSEEK_MODEL || DEEPSEEK_DEFAULT_MODEL;
    const model = sanitizeDeepSeekModel(rawModel);
    return {
        provider: 'deepseek',
        apiKey,
        baseURL: process.env.AI_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        model,
        configured: !isPlaceholder(apiKey),
    };
}
function getAIClient() {
    const settings = getAISettings();
    if (!settings.configured) {
        throw new Error('AI engine is not configured');
    }
    if (!client) {
        const opts = { apiKey: settings.apiKey };
        if (settings.baseURL)
            opts.baseURL = settings.baseURL;
        client = new openai_1.default(opts);
    }
    return client;
}
function getAIModel() {
    return getAISettings().model;
}
async function testAIConnection() {
    const settings = getAISettings();
    const ai = getAIClient();
    const completion = await ai.chat.completions.create({
        model: settings.model,
        messages: [{ role: 'user', content: 'Reply with exactly the word OK' }],
        max_tokens: 10,
        temperature: 0,
    });
    return {
        ok: true,
        ...getPublicAIBranding(),
        reply: completion.choices[0]?.message?.content?.trim() ?? '',
    };
}
