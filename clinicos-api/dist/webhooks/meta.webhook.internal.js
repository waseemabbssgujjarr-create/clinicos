"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupPhoneNumber = lookupPhoneNumber;
exports.processMetaWebhookPayload = processMetaWebhookPayload;
const meta_whatsapp_service_1 = require("../services/meta-whatsapp.service");
const inbound_message_service_1 = require("../services/inbound-message.service");
const twilio_service_1 = require("../services/twilio.service");
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../lib/logger");
const CLINIC_SELECT = {
    id: true, name: true, specialty: true, workingHours: true,
    address: true, phone: true, treatments: true, aiEnabled: true,
    aiLanguage: true, aiPersonality: true, autoConfirm: true,
    planStatus: true, customIntroMsg: true, defaultFee: true,
};
function normalizePhone(raw) {
    if (!raw)
        return "";
    const d = String(raw).replace(/\D/g, "");
    return d ? (d.startsWith("+") ? d : `+${d}`) : "";
}
async function lookupPhoneNumber(req, res) {
    try {
        const account = await (0, meta_whatsapp_service_1.getAccountByPhoneNumberId)(req.params.phoneNumberId);
        if (!account) {
            res.json({ registered: false });
            return;
        }
        res.json({
            registered: true,
            clinicId: account.clinicId,
            displayPhoneNumber: account.displayPhoneNumber,
        });
    }
    catch (err) {
        logger_1.logger.error("lookupPhoneNumber", { err });
        res.status(500).json({ registered: false, error: "lookup failed" });
    }
}
async function processMetaWebhookPayload(req, res) {
    res.status(200).send("OK");
    try {
        const body = req.body || {};
        const entries = body.entry || [];
        for (const entry of entries) {
            for (const change of entry.changes || []) {
                if (change.field !== "messages")
                    continue;
                const value = change.value || {};
                const phoneNumberId = String(value.metadata?.phone_number_id || "");
                if (!phoneNumberId)
                    continue;
                const account = await (0, meta_whatsapp_service_1.getAccountByPhoneNumberId)(phoneNumberId);
                if (!account)
                    continue;
                const clinic = await prisma_1.prisma.clinic.findUnique({
                    where: { id: account.clinicId },
                    select: CLINIC_SELECT,
                });
                if (!clinic)
                    continue;
                const displayNumber = value.metadata?.display_phone_number || account.displayPhoneNumber || clinic.phone;
                for (const msg of value.messages || []) {
                    if (msg.type !== "text" || !msg.text?.body)
                        continue;
                    const fromPhone = normalizePhone(msg.from);
                    const toPhone = normalizePhone(displayNumber) || normalizePhone(clinic.phone);
                    const sendReply = async (to, text, channel) => {
                        if (channel === "WHATSAPP") {
                            await (0, meta_whatsapp_service_1.sendWhatsAppForClinic)(clinic.id, to, text);
                        }
                        else {
                            await (0, twilio_service_1.sendSMS)(to, text);
                        }
                    };
                    await (0, inbound_message_service_1.processInboundPatientMessage)({
                        clinic,
                        fromPhone,
                        toPhone,
                        body: msg.text.body,
                        channel: "WHATSAPP",
                        externalMessageId: msg.id,
                        sendReply,
                    });
                }
            }
        }
    }
    catch (err) {
        logger_1.logger.error("internal meta-webhook", { err });
    }
}
