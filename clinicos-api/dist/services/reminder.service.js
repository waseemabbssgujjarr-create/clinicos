"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAppointmentConfirmation = sendAppointmentConfirmation;
exports.sendAppointmentCancellation = sendAppointmentCancellation;
exports.sendAppointmentReschedule = sendAppointmentReschedule;
exports.send24hReminder = send24hReminder;
exports.send2hReminder = send2hReminder;
exports.sendReviewRequest = sendReviewRequest;
const prisma_1 = require("../lib/prisma");
const twilio_service_1 = require("./twilio.service");
const logger_1 = require("../lib/logger");
const date_fns_1 = require("date-fns");
async function clinicUsesWhatsApp(clinicId, channel) {
    if (channel === 'WHATSAPP')
        return true;
    try {
        const meta = require("./meta-whatsapp.service");
        const acc = await meta.getAccountByClinicId(clinicId);
        if (acc && acc.connectionStatus === 'active')
            return true;
    }
    catch (_) { /* ignore */ }
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { aiEnabled: true },
    });
    return !!clinic?.aiEnabled;
}
async function deliverPatientMessage(appt, msg) {
    if (appt.patient?.optedOut)
        return null;
    const useWhatsApp = await clinicUsesWhatsApp(appt.clinicId, appt.channel);
    if (useWhatsApp) {
        return (0, twilio_service_1.sendWhatsApp)(appt.patient.phone, msg, appt.clinicId);
    }
    return (0, twilio_service_1.sendSMS)(appt.patient.phone, msg);
}
/**
 * Send appointment confirmation message to patient.
 */
async function sendAppointmentConfirmation(appointmentId) {
    try {
        const appt = await prisma_1.prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { patient: true, clinic: true },
        });
        if (!appt || appt.confirmationSent)
            return;
        const dateStr = (0, date_fns_1.format)(appt.dateTime, 'EEEE, MMMM d');
        const timeStr = (0, date_fns_1.format)(appt.dateTime, 'h:mm a');
        const msg = `✅ Hi ${appt.patient.fullName}, your appointment at ${appt.clinic.name} has been confirmed for ${dateStr} at ${timeStr} (${appt.treatment}). See you then! 🏥`;
        const sid = await deliverPatientMessage(appt, msg);
        if (sid) {
            await prisma_1.prisma.appointment.update({
                where: { id: appointmentId },
                data: { confirmationSent: true },
            });
        }
    }
    catch (err) {
        logger_1.logger.error('Failed to send appointment confirmation', { appointmentId, err });
    }
}
/**
 * Notify patient when staff cancels an appointment from the dashboard.
 */
async function sendAppointmentCancellation(appointmentId) {
    try {
        const appt = await prisma_1.prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { patient: true, clinic: true },
        });
        if (!appt || appt.status !== 'CANCELLED')
            return;
        const dateStr = (0, date_fns_1.format)(appt.dateTime, 'EEEE, MMMM d');
        const timeStr = (0, date_fns_1.format)(appt.dateTime, 'h:mm a');
        const msg = `❌ Hi ${appt.patient.fullName.split(' ')[0]}, your appointment at ${appt.clinic.name} on ${dateStr} at ${timeStr} has been cancelled. Reply to book a new time.`;
        const sid = await deliverPatientMessage(appt, msg);
        if (sid) {
            await prisma_1.prisma.aILog.create({
                data: {
                    clinicId: appt.clinicId,
                    action: 'appointment_cancelled_notify',
                    details: `Cancellation WhatsApp sent to ${appt.patient.fullName}`,
                    patientId: appt.patientId,
                    success: true,
                },
            }).catch(() => null);
        }
    }
    catch (err) {
        logger_1.logger.error('Failed to send appointment cancellation', { appointmentId, err });
    }
}
/**
 * Notify patient when staff reschedules an appointment from the dashboard.
 */
async function sendAppointmentReschedule(appointmentId) {
    try {
        const appt = await prisma_1.prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { patient: true, clinic: true },
        });
        if (!appt || appt.status === 'CANCELLED')
            return;
        const dateStr = (0, date_fns_1.format)(appt.dateTime, 'EEEE, MMMM d');
        const timeStr = (0, date_fns_1.format)(appt.dateTime, 'h:mm a');
        const msg = `📅 Hi ${appt.patient.fullName.split(' ')[0]}, your appointment at ${appt.clinic.name} has been updated to ${dateStr} at ${timeStr} (${appt.treatment}). Reply if you need to change it.`;
        const sid = await deliverPatientMessage(appt, msg);
        if (sid) {
            await prisma_1.prisma.aILog.create({
                data: {
                    clinicId: appt.clinicId,
                    action: 'appointment_rescheduled_notify',
                    details: `Reschedule WhatsApp sent to ${appt.patient.fullName}`,
                    patientId: appt.patientId,
                    success: true,
                },
            }).catch(() => null);
        }
    }
    catch (err) {
        logger_1.logger.error('Failed to send appointment reschedule', { appointmentId, err });
    }
}
/**
 * Send 24-hour reminder.
 */
async function send24hReminder(appointmentId) {
    try {
        const appt = await prisma_1.prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { patient: true, clinic: true },
        });
        if (!appt || appt.reminder24hSent)
            return;
        const timeStr = (0, date_fns_1.format)(appt.dateTime, 'h:mm a');
        const msg = `⏰ Reminder: You have an appointment at ${appt.clinic.name} tomorrow at ${timeStr} for ${appt.treatment}. Reply CANCEL to cancel or RESCHEDULE to change the time.`;
        const sid = await (0, twilio_service_1.sendWhatsApp)(appt.patient.phone, msg, appt.clinicId);
        if (sid) {
            await prisma_1.prisma.appointment.update({
                where: { id: appointmentId },
                data: { reminder24hSent: true },
            });
            await prisma_1.prisma.aILog.create({
                data: {
                    clinicId: appt.clinicId,
                    action: 'sent_reminder',
                    details: `24h reminder sent to ${appt.patient.fullName} for ${(0, date_fns_1.format)(appt.dateTime, 'PPp')}`,
                    patientId: appt.patientId,
                    success: true,
                },
            });
        }
    }
    catch (err) {
        logger_1.logger.error('Failed to send 24h reminder', { appointmentId, err });
    }
}
/**
 * Send 2-hour reminder.
 */
async function send2hReminder(appointmentId) {
    try {
        const appt = await prisma_1.prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { patient: true, clinic: true },
        });
        if (!appt || appt.reminder2hSent)
            return;
        const timeStr = (0, date_fns_1.format)(appt.dateTime, 'h:mm a');
        const msg = `🏥 Don't forget! Your appointment at ${appt.clinic.name} is in 2 hours at ${timeStr}. See you soon!`;
        const sid = await (0, twilio_service_1.sendWhatsApp)(appt.patient.phone, msg, appt.clinicId);
        if (sid) {
            await prisma_1.prisma.appointment.update({
                where: { id: appointmentId },
                data: { reminder2hSent: true },
            });
        }
    }
    catch (err) {
        logger_1.logger.error('Failed to send 2h reminder', { appointmentId, err });
    }
}
/**
 * Send Google Review request.
 */
async function sendReviewRequest(appointmentId) {
    try {
        const appt = await prisma_1.prisma.appointment.findUnique({
            where: { id: appointmentId },
            include: { patient: true, clinic: true },
        });
        if (!appt || appt.reviewSent || !appt.clinic.googlePlaceId)
            return;
        const reviewUrl = `https://search.google.com/local/writereview?placeid=${appt.clinic.googlePlaceId}`;
        const msg = `⭐ Hi ${appt.patient.fullName}, thank you for visiting ${appt.clinic.name}! We hope your experience was great. We'd love to hear your feedback: ${reviewUrl}`;
        const sid = await (0, twilio_service_1.sendWhatsApp)(appt.patient.phone, msg, appt.clinicId);
        if (sid) {
            await prisma_1.prisma.appointment.update({
                where: { id: appointmentId },
                data: { reviewSent: true },
            });
            await prisma_1.prisma.aILog.create({
                data: {
                    clinicId: appt.clinicId,
                    action: 'sent_review_request',
                    details: `Review request sent to ${appt.patient.fullName}`,
                    patientId: appt.patientId,
                    success: true,
                },
            });
        }
    }
    catch (err) {
        logger_1.logger.error('Failed to send review request', { appointmentId, err });
    }
}
