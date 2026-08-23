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
    return {
        provider: 'deepseek',
        apiKey,
        baseURL: process.env.AI_BASE_URL || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        model: process.env.AI_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
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
