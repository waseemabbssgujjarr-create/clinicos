"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWhatsApp = sendWhatsApp;
exports.sendSMS = sendSMS;
exports.sendReply = sendReply;
exports.generateVoiceTwiML = generateVoiceTwiML;
exports.validateTwilioSignature = validateTwilioSignature;
const twilio_1 = __importDefault(require("twilio"));
const logger_1 = require("../lib/logger");
let client = null;
function getClient() {
    if (!client) {
        client = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
    return client;
}
/**
 * Send a WhatsApp message via Twilio.
 * @param to   Recipient phone number (e.g. +97155XXXXXXX)
 * @param body Message text
 */
async function sendWhatsApp(to, body, clinicId) {
    if (clinicId) {
        try {
            const meta = require("./meta-whatsapp.service");
            const msgId = await meta.sendWhatsAppForClinic(clinicId, to, body);
            if (msgId)
                return msgId;
        }
        catch (_) { /* fall through to Twilio */ }
    }
    try {
        const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
        const from = process.env.TWILIO_WHATSAPP_NUMBER;
        if (!from || !process.env.TWILIO_ACCOUNT_SID)
            return null;
        const message = await getClient().messages.create({ from, to: formattedTo, body });
        logger_1.logger.info(`WhatsApp sent to ${to}: SID ${message.sid}`);
        return message.sid;
    }
    catch (err) {
        logger_1.logger.error('Failed to send WhatsApp', { to, err });
        return null;
    }
}
/**
 * Send an SMS via Twilio.
 */
async function sendSMS(to, body) {
    try {
        const message = await getClient().messages.create({
            from: process.env.TWILIO_SMS_NUMBER,
            to,
            body,
        });
        logger_1.logger.info(`SMS sent to ${to}: SID ${message.sid}`);
        return message.sid;
    }
    catch (err) {
        logger_1.logger.error('Failed to send SMS', { to, err });
        return null;
    }
}
/**
 * Send a message via the same channel the patient originally used.
 */
async function sendReply(to, body, channel, clinicId) {
    if (channel === 'WHATSAPP') {
        return sendWhatsApp(to, body, clinicId);
    }
    return sendSMS(to, body);
}
/**
 * Generate TwiML for inbound voice calls.
 * Returns XML string for Twilio to execute.
 */
function generateVoiceTwiML(clinicName, greeting) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${greeting}</Say>
  <Gather numDigits="1" action="/api/webhooks/twilio/voice/gather" method="POST">
    <Say voice="Polly.Joanna">Press 1 to book an appointment. Press 2 to cancel or reschedule. Press 3 to speak with our team.</Say>
  </Gather>
  <Say voice="Polly.Joanna">We didn't receive your input. Please call back and try again. Thank you for calling ${clinicName}.</Say>
</Response>`;
}
/**
 * Validate that a webhook request genuinely came from Twilio.
 */
function validateTwilioSignature(url, params, signature) {
    if (!process.env.TWILIO_AUTH_TOKEN)
        return false;
    return twilio_1.default.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, url, params);
}
//# sourceMappingURL=twilio.service.js.map