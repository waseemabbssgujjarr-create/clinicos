"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processInboundPatientMessage = processInboundPatientMessage;
const prisma_1 = require("../lib/prisma");
const ai_service_1 = require("./ai.service");
const notification_service_1 = require("./notification.service");
const lead_service_1 = require("./lead.service");
const killer_features_service_1 = require("./killer-features.service");
const logger_1 = require("../lib/logger");
const date_fns_1 = require("date-fns");
const date_fns_2 = require("date-fns");
async function processInboundPatientMessage(ctx) {
    const { clinic, fromPhone, toPhone, body, channel, externalMessageId, sendReply } = ctx;
    let patient = await prisma_1.prisma.patient.findFirst({
        where: { clinicId: clinic.id, phone: fromPhone },
    });
    if (!patient) {
        patient = await prisma_1.prisma.patient.create({
            data: { clinicId: clinic.id, fullName: fromPhone, phone: fromPhone },
        });
    }
    if ((0, lead_service_1.isOptOutMessage)(body)) {
        await (0, lead_service_1.handleOptOut)(clinic.id, patient.id, fromPhone);
        await sendReply(fromPhone, `You have been unsubscribed from automated messages from ${clinic.name}. Reply START to re-subscribe.`, channel);
        return;
    }
    if (patient.optedOut)
        return;
    const inboundMsg = await prisma_1.prisma.message.create({
        data: {
            clinicId: clinic.id,
            patientId: patient.id,
            channel,
            direction: "INBOUND",
            fromNumber: fromPhone,
            toNumber: toPhone,
            body,
            twilioSid: channel === "SMS" ? externalMessageId : null,
            metaMessageId: channel === "WHATSAPP" ? externalMessageId : null,
        },
    });
    const missedCall = await prisma_1.prisma.missedCall.findFirst({
        where: { clinicId: clinic.id, callerPhone: fromPhone, recoverySent: true, replied: false },
        orderBy: { calledAt: "desc" },
    });
    if (missedCall) {
        await prisma_1.prisma.missedCall.update({
            where: { id: missedCall.id },
            data: { replied: true, repliedAt: new Date() },
        });
    }
    if (!clinic.aiEnabled || clinic.planStatus === "CANCELLED" || clinic.planStatus === "PAST_DUE") {
        await sendReply(fromPhone, `Thank you for contacting ${clinic.name}. Our team will get back to you shortly.`, channel);
        return;
    }
    const recentMessages = await prisma_1.prisma.message.findMany({
        where: { clinicId: clinic.id, patientId: patient.id },
        orderBy: { createdAt: "desc" },
        take: 10,
    });
    const conversationHistory = recentMessages
        .reverse()
        .map((m) => `${m.direction === "INBOUND" ? "Patient" : "AI"}: ${m.body}`)
        .join("\n");
    const recentAppts = await prisma_1.prisma.appointment.findMany({
        where: { clinicId: clinic.id, patientId: patient.id },
        orderBy: { dateTime: "desc" },
        take: 5,
        select: { id: true, treatment: true, dateTime: true, status: true },
    });
    const patientHistory = recentAppts.length > 0
        ? recentAppts.map((a) => `${(0, date_fns_1.format)(a.dateTime, "MMM d, yyyy")} - ${a.treatment} (${a.status})`).join("\n")
        : "First-time patient";
    const startTime = Date.now();
    const aiResponse = await (0, ai_service_1.processInboundMessage)({
        clinicId: clinic.id,
        clinicName: clinic.name,
        specialty: clinic.specialty ?? "medical",
        workingHours: clinic.workingHours ?? "{}",
        address: clinic.address ?? "",
        phone: clinic.phone,
        treatments: clinic.treatments ?? "",
        patientPhone: fromPhone,
        patientHistory,
        conversationHistory,
        aiLanguage: clinic.aiLanguage,
        aiPersonality: clinic.aiPersonality,
        customIntroMsg: clinic.customIntroMsg ?? undefined,
    }, body);
    const durationMs = Date.now() - startTime;
    await prisma_1.prisma.message.update({
        where: { id: inboundMsg.id },
        data: {
            intent: aiResponse.intent,
            tags: aiResponse.tags?.length ? JSON.stringify(aiResponse.tags) : null,
        },
    });
    await (0, lead_service_1.upsertLeadFromMessage)({
        clinicId: clinic.id,
        patientId: patient.id,
        phone: fromPhone,
        fullName: patient.fullName,
        email: patient.email ?? undefined,
        enquiryReason: body.slice(0, 500),
        treatmentInterest: aiResponse.treatmentInterest ?? undefined,
        intent: aiResponse.intent,
        leadScore: aiResponse.leadScore,
        source: channel,
        tags: aiResponse.tags,
    });
    if (aiResponse.leadScore) {
        await prisma_1.prisma.patient.update({
            where: { id: patient.id },
            data: { leadScore: aiResponse.leadScore.toUpperCase() },
        }).catch(() => null);
    }
    if (aiResponse.action === "book_appointment" && aiResponse.appointmentData?.requestedDateTime) {
        try {
            const apptDateTime = (0, date_fns_2.parseISO)(aiResponse.appointmentData.requestedDateTime);
            const appt = await prisma_1.prisma.appointment.create({
                data: {
                    clinicId: clinic.id,
                    patientId: patient.id,
                    treatment: aiResponse.appointmentData.treatment ?? "Consultation",
                    dateTime: apptDateTime,
                    durationMin: 30,
                    channel,
                    fee: clinic.defaultFee ?? null,
                    notes: aiResponse.appointmentData.notes ?? null,
                    bookedByAI: true,
                    status: clinic.autoConfirm ? "CONFIRMED" : "PENDING",
                    confirmationSent: true,
                },
            });
            await prisma_1.prisma.lead.updateMany({
                where: { clinicId: clinic.id, phone: fromPhone },
                data: { status: "BOOKED", convertedAt: new Date(), nextFollowUpAt: null },
            });
            await (0, killer_features_service_1.markMissedCallBooked)(clinic.id, fromPhone, appt.id, Number(clinic.defaultFee ?? 0));
            await prisma_1.prisma.aILog.create({
                data: {
                    clinicId: clinic.id,
                    action: "booked_appointment",
                    details: `Booked ${aiResponse.appointmentData.treatment} for ${(0, date_fns_1.format)(apptDateTime, "PPp")}`,
                    patientId: patient.id,
                    durationMs,
                    success: true,
                },
            });
            await (0, notification_service_1.createNotification)({
                clinicId: clinic.id,
                title: "AI Booked Appointment",
                body: `AI booked ${patient.fullName} for ${(0, date_fns_1.format)(apptDateTime, "MMM d h:mm a")}`,
                type: "ai_action",
                link: "/dashboard/appointments",
            });
        }
        catch (err) {
            logger_1.logger.error("Failed to create AI-booked appointment", { err });
        }
    }
    else if (aiResponse.action === "cancel") {
        const upcoming = recentAppts.find((a) => ["PENDING", "CONFIRMED"].includes(a.status));
        if (upcoming) {
            await prisma_1.prisma.appointment.update({
                where: { id: upcoming.id },
                data: { status: "CANCELLED" },
            });
        }
    }
    else if (aiResponse.action === "reschedule" && aiResponse.appointmentData?.requestedDateTime) {
        const upcoming = recentAppts.find((a) => ["PENDING", "CONFIRMED"].includes(a.status));
        if (upcoming) {
            await prisma_1.prisma.appointment.update({
                where: { id: upcoming.id },
                data: {
                    dateTime: (0, date_fns_2.parseISO)(aiResponse.appointmentData.requestedDateTime),
                    status: "RESCHEDULED",
                },
            });
        }
    }
    else if (aiResponse.action === "escalate") {
        await prisma_1.prisma.message.update({
            where: { id: inboundMsg.id },
            data: {
                needsReview: true,
                summary: aiResponse.conversationSummary,
            },
        });
        await (0, notification_service_1.createNotification)({
            clinicId: clinic.id,
            title: "AI Needs Your Help",
            body: aiResponse.conversationSummary || `AI could not handle ${patient.fullName}'s message — please review`,
            type: "ai_escalate",
            link: "/dashboard/messages",
        });
    }
    await prisma_1.prisma.message.create({
        data: {
            clinicId: clinic.id,
            patientId: patient.id,
            channel,
            direction: "OUTBOUND",
            fromNumber: toPhone,
            toNumber: fromPhone,
            body: aiResponse.reply,
            isHandledByAI: true,
            aiConfidence: aiResponse.confidence,
            isRead: true,
        },
    });
    await prisma_1.prisma.aILog.create({
        data: {
            clinicId: clinic.id,
            action: aiResponse.action === "none" ? "answered_faq" : aiResponse.action,
            details: `Patient: "${body.slice(0, 100)}" | Intent: ${aiResponse.intent} | Score: ${aiResponse.leadScore}`,
            patientId: patient.id,
            durationMs,
            success: true,
        },
    });
    await sendReply(fromPhone, aiResponse.reply, channel);
}
