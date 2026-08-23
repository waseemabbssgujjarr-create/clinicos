"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordMissedCall = recordMissedCall;
exports.sendMissedCallRecovery = sendMissedCallRecovery;
exports.markMissedCallBooked = markMissedCallBooked;
exports.getBookingConversionStats = getBookingConversionStats;
exports.generateDailyBrief = generateDailyBrief;
exports.getLatestDailyBrief = getLatestDailyBrief;
exports.runLostLeadRescue = runLostLeadRescue;
const prisma_1 = require("../lib/prisma");
const twilio_service_1 = require("./twilio.service");
const date_fns_1 = require("date-fns");
async function recordMissedCall(clinicId, callerPhone) {
    return prisma_1.prisma.missedCall.create({
        data: { clinicId, callerPhone },
    });
}
async function sendMissedCallRecovery(clinicId, callerPhone, clinicName) {
    const existing = await prisma_1.prisma.missedCall.findFirst({
        where: { clinicId, callerPhone, recoverySent: true, calledAt: { gte: (0, date_fns_1.subHours)(new Date(), 24) } },
    });
    if (existing)
        return null;
    const missedCall = await recordMissedCall(clinicId, callerPhone);
    const msg = `Hi! We noticed you tried calling ${clinicName} but we couldn't reach you. Reply here to book an appointment or ask any question — we're happy to help! 😊`;
    await (0, twilio_service_1.sendWhatsApp)(callerPhone, msg, clinicId);
    return prisma_1.prisma.missedCall.update({
        where: { id: missedCall.id },
        data: { recoverySent: true, recoverySentAt: new Date() },
    });
}
async function markMissedCallBooked(clinicId, callerPhone, appointmentId, recoveredValue) {
    const missedCall = await prisma_1.prisma.missedCall.findFirst({
        where: { clinicId, callerPhone, booked: false },
        orderBy: { calledAt: 'desc' },
    });
    if (!missedCall)
        return null;
    return prisma_1.prisma.missedCall.update({
        where: { id: missedCall.id },
        data: {
            booked: true,
            bookedAt: new Date(),
            appointmentId,
            recoveredValue: recoveredValue ?? null,
            replied: true,
            repliedAt: new Date(),
        },
    });
}
async function getBookingConversionStats(clinicId, days = 30) {
    const since = (0, date_fns_1.subDays)(new Date(), days);
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { defaultFee: true },
    });
    const defaultFee = Number(clinic?.defaultFee ?? 0);
    const convertedStatuses = ['BOOKED', 'CONVERTED', 'VISITED'];
    const [totalEnquiries, convertedLeads, newAppointments, revenueAgg, recent] = await Promise.all([
        prisma_1.prisma.lead.count({ where: { clinicId, createdAt: { gte: since } } }),
        prisma_1.prisma.lead.count({
            where: { clinicId, createdAt: { gte: since }, status: { in: convertedStatuses } },
        }),
        prisma_1.prisma.appointment.count({
            where: { clinicId, createdAt: { gte: since }, status: { notIn: ['CANCELLED'] } },
        }),
        prisma_1.prisma.lead.aggregate({
            where: { clinicId, createdAt: { gte: since }, status: { in: convertedStatuses } },
            _sum: { estimatedValue: true },
        }),
        prisma_1.prisma.lead.findMany({
            where: { clinicId, createdAt: { gte: since } },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
                id: true, fullName: true, phone: true, status: true, leadScore: true,
                treatmentInterest: true, intent: true, createdAt: true, convertedAt: true,
            },
        }),
    ]);
    const conversionRate = totalEnquiries > 0 ? Math.round((convertedLeads / totalEnquiries) * 100) : 0;
    const estimatedRevenue = Number(revenueAgg._sum.estimatedValue ?? 0) || (convertedLeads * defaultFee);
    return {
        periodDays: days,
        totalEnquiries,
        convertedBookings: convertedLeads,
        newAppointments,
        conversionRate,
        estimatedRevenue,
        recent,
    };
}
async function generateDailyBrief(clinicId) {
    const today = (0, date_fns_1.startOfDay)(new Date());
    const todayEnd = (0, date_fns_1.endOfDay)(new Date());
    const yesterday = (0, date_fns_1.subDays)(today, 1);
    const yesterdayEnd = (0, date_fns_1.endOfDay)(yesterday);
    const convertedStatuses = ['BOOKED', 'CONVERTED', 'VISITED'];
    const [appointmentsToday, appointmentsBooked, chatsHandled, newLeads, hotLeads, pendingEnquiries, convertedYesterday, conversionRevenue, lostLeadsRescued, noShows, clinic,] = await Promise.all([
        prisma_1.prisma.appointment.count({
            where: { clinicId, dateTime: { gte: today, lte: todayEnd }, status: { notIn: ['CANCELLED'] } },
        }),
        prisma_1.prisma.appointment.count({
            where: { clinicId, createdAt: { gte: yesterday, lte: yesterdayEnd }, bookedByAI: true },
        }),
        prisma_1.prisma.message.count({
            where: { clinicId, isHandledByAI: true, createdAt: { gte: yesterday, lte: yesterdayEnd } },
        }),
        prisma_1.prisma.lead.count({
            where: { clinicId, createdAt: { gte: yesterday, lte: yesterdayEnd } },
        }),
        prisma_1.prisma.lead.count({
            where: { clinicId, leadScore: 'HOT', status: { notIn: ['CONVERTED', 'LOST'] } },
        }),
        prisma_1.prisma.lead.count({
            where: { clinicId, status: { in: ['NEW', 'CONTACTED', 'FOLLOW_UP'] } },
        }),
        prisma_1.prisma.lead.count({
            where: { clinicId, convertedAt: { gte: yesterday, lte: yesterdayEnd } },
        }),
        prisma_1.prisma.lead.aggregate({
            where: { clinicId, convertedAt: { gte: yesterday, lte: yesterdayEnd } },
            _sum: { estimatedValue: true },
        }),
        prisma_1.prisma.lead.count({
            where: { clinicId, rescuedAt: { gte: yesterday, lte: yesterdayEnd } },
        }),
        prisma_1.prisma.appointment.count({
            where: { clinicId, dateTime: { gte: yesterday, lte: yesterdayEnd }, status: 'NO_SHOW' },
        }),
        prisma_1.prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true, ownerName: true, defaultFee: true } }),
    ]);
    const revenue = Number(conversionRevenue._sum.estimatedValue ?? 0) ||
        (convertedYesterday * Number(clinic?.defaultFee ?? 0));
    const actionItems = [];
    if (hotLeads > 0)
        actionItems.push(`${hotLeads} hot lead(s) need immediate follow-up`);
    if (pendingEnquiries > 0)
        actionItems.push(`${pendingEnquiries} open enquiry(ies) still need follow-up`);
    const summary = `Good morning${clinic?.ownerName ? ` ${clinic.ownerName.split(' ')[0]}` : ''}! ` +
        `Yesterday: ${chatsHandled} AI chats, ${appointmentsBooked} AI bookings, ${newLeads} new enquiries. ` +
        `${convertedYesterday} enquiry(ies) converted to appointments ($${revenue.toFixed(0)} estimated). ` +
        `${hotLeads} hot leads waiting. ${noShows} no-shows.`;
    return prisma_1.prisma.dailyBrief.upsert({
        where: { clinicId_briefDate: { clinicId, briefDate: today } },
        create: {
            clinicId,
            briefDate: today,
            appointmentsToday,
            appointmentsBooked,
            chatsHandled,
            newLeads,
            hotLeads,
            missedCalls: pendingEnquiries,
            recoveredBookings: convertedYesterday,
            recoveredRevenue: revenue,
            lostLeadsRescued,
            noShows,
            summary,
            actionItems: actionItems.length ? JSON.stringify(actionItems) : null,
        },
        update: {
            appointmentsToday,
            appointmentsBooked,
            chatsHandled,
            newLeads,
            hotLeads,
            missedCalls: pendingEnquiries,
            recoveredBookings: convertedYesterday,
            recoveredRevenue: revenue,
            lostLeadsRescued,
            noShows,
            summary,
            actionItems: actionItems.length ? JSON.stringify(actionItems) : null,
        },
    });
}
async function getLatestDailyBrief(clinicId) {
    return prisma_1.prisma.dailyBrief.findFirst({
        where: { clinicId },
        orderBy: { briefDate: 'desc' },
    });
}
async function runLostLeadRescue() {
    const now = new Date();
    const dueLeads = await prisma_1.prisma.lead.findMany({
        where: {
            status: { in: ['NEW', 'CONTACTED', 'FOLLOW_UP'] },
            nextFollowUpAt: { lte: now },
            followUpCount: { lt: 3 },
            clinic: ACTIVE_MESSAGING_CLINIC,
        },
        include: {
            clinic: { select: { name: true } },
            patient: { select: { optedOut: true, fullName: true } },
        },
        take: 50,
    });
    let rescued = 0;
    for (const lead of dueLeads) {
        if (lead.patient?.optedOut)
            continue;
        const name = lead.fullName?.split(' ')[0] || lead.patient?.fullName?.split(' ')[0] || 'there';
        const msg = lead.followUpCount === 0
            ? `Hi ${name}! 👋 You enquired about ${lead.treatmentInterest || 'our services'} at ${lead.clinic.name}. Still interested? Reply to book your appointment — we'd love to help!`
            : `Hi ${name}, just checking in from ${lead.clinic.name}. We have availability this week if you'd like to schedule. Reply anytime!`;
        await (0, twilio_service_1.sendWhatsApp)(lead.phone, msg, lead.clinicId).catch(() => null);
        await prisma_1.prisma.lead.update({
            where: { id: lead.id },
            data: {
                followUpCount: { increment: 1 },
                lastFollowUpAt: now,
                rescuedAt: lead.followUpCount >= 1 ? now : undefined,
                nextFollowUpAt: lead.followUpCount >= 1 ? (0, date_fns_1.addHours)(now, 48) : (0, date_fns_1.addHours)(now, 24),
                status: 'FOLLOW_UP',
            },
        });
        rescued++;
    }
    return rescued;
}
