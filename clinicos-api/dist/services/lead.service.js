"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertLeadFromMessage = upsertLeadFromMessage;
exports.updateLeadScore = updateLeadScore;
exports.scheduleLostLeadRescue = scheduleLostLeadRescue;
exports.getLeadPipeline = getLeadPipeline;
exports.handleOptOut = handleOptOut;
exports.isOptOutMessage = isOptOutMessage;
const prisma_1 = require("../lib/prisma");
const date_fns_1 = require("date-fns");
const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'opt out', 'opt-out', 'cancel subscription'];
function mapIntent(intent) {
    const map = { booking: 'BOOKING', price: 'PRICE', treatment: 'TREATMENT', emergency: 'EMERGENCY', general: 'GENERAL' };
    return map[intent?.toLowerCase()] ?? 'GENERAL';
}
function mapScore(score) {
    const map = { hot: 'HOT', warm: 'WARM', cold: 'COLD' };
    return map[score?.toLowerCase()] ?? 'COLD';
}
function isOptOutMessage(body) {
    const lower = (body || '').toLowerCase().trim();
    return OPT_OUT_KEYWORDS.some((kw) => lower === kw || lower.startsWith(kw + ' '));
}
async function handleOptOut(clinicId, patientId, phone) {
    if (patientId) {
        await prisma_1.prisma.patient.update({
            where: { id: patientId },
            data: { optedOut: true, optedOutAt: new Date() },
        });
    }
    await prisma_1.prisma.lead.updateMany({
        where: { clinicId, phone },
        data: { status: 'LOST', nextFollowUpAt: null },
    });
}
async function upsertLeadFromMessage({ clinicId, patientId, phone, fullName, email, enquiryReason, treatmentInterest, intent, leadScore, source, tags, }) {
    const existing = await prisma_1.prisma.lead.findUnique({
        where: { clinicId_phone: { clinicId, phone } },
    });
    const tagJson = tags?.length ? JSON.stringify(tags) : undefined;
    const data = {
        patientId,
        fullName,
        email,
        enquiryReason,
        treatmentInterest,
        intent: mapIntent(intent),
        leadScore: mapScore(leadScore),
        source: source ?? 'WHATSAPP',
        tags: tagJson,
        status: existing?.status === 'CONVERTED' ? 'CONVERTED' : (existing?.status ?? 'NEW'),
    };
    if (existing) {
        return prisma_1.prisma.lead.update({
            where: { id: existing.id },
            data: {
                ...data,
                status: existing.status === 'NEW' ? 'CONTACTED' : existing.status,
            },
        });
    }
    return prisma_1.prisma.lead.create({
        data: { clinicId, phone, ...data, nextFollowUpAt: (0, date_fns_1.addHours)(new Date(), 24) },
    });
}
async function updateLeadScore(leadId, score, status) {
    return prisma_1.prisma.lead.update({
        where: { id: leadId },
        data: {
            leadScore: mapScore(score),
            ...(status ? { status } : {}),
        },
    });
}
async function scheduleLostLeadRescue(leadId) {
    const lead = await prisma_1.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.status === 'BOOKED' || lead.status === 'CONVERTED' || lead.status === 'LOST')
        return null;
    const hours = lead.followUpCount === 0 ? 24 : 48;
    return prisma_1.prisma.lead.update({
        where: { id: leadId },
        data: {
            nextFollowUpAt: (0, date_fns_1.addHours)(new Date(), hours),
            status: 'FOLLOW_UP',
        },
    });
}
async function getLeadPipeline(clinicId) {
    const grouped = await prisma_1.prisma.lead.groupBy({
        by: ['status'],
        where: { clinicId },
        _count: { status: true },
    });
    const scores = await prisma_1.prisma.lead.groupBy({
        by: ['leadScore'],
        where: { clinicId, status: { notIn: ['CONVERTED', 'LOST'] } },
        _count: { leadScore: true },
    });
    return {
        pipeline: grouped.map((g) => ({ status: g.status, count: g._count.status })),
        scores: scores.map((s) => ({ score: s.leadScore, count: s._count.leadScore })),
    };
}
exports.isOptOutMessage = isOptOutMessage;
