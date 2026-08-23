"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTopTreatments = exports.getMessagesByChannel = exports.getMonthlyRevenue = exports.getWeeklyAppointments = exports.getOverview = void 0;
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const date_fns_1 = require("date-fns");
// GET /api/analytics/overview
exports.getOverview = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const now = new Date();
    const thisMonthStart = (0, date_fns_1.startOfMonth)(now);
    const lastMonthStart = (0, date_fns_1.startOfMonth)((0, date_fns_1.subMonths)(now, 1));
    const lastMonthEnd = (0, date_fns_1.endOfMonth)((0, date_fns_1.subMonths)(now, 1));
    const [thisMonthAppts, lastMonthAppts, totalPatients, noShowsThisMonth, totalCompleted, returningPatients,] = await Promise.all([
        prisma_1.prisma.appointment.count({ where: { clinicId, dateTime: { gte: thisMonthStart }, status: { notIn: ['CANCELLED'] } } }),
        prisma_1.prisma.appointment.count({ where: { clinicId, dateTime: { gte: lastMonthStart, lte: lastMonthEnd }, status: { notIn: ['CANCELLED'] } } }),
        prisma_1.prisma.patient.count({ where: { clinicId, isActive: true } }),
        prisma_1.prisma.appointment.count({ where: { clinicId, dateTime: { gte: thisMonthStart }, status: 'NO_SHOW' } }),
        prisma_1.prisma.appointment.count({ where: { clinicId, status: 'COMPLETED' } }),
        prisma_1.prisma.appointment.groupBy({
            by: ['patientId'],
            where: { clinicId, status: 'COMPLETED' },
            having: { patientId: { _count: { gt: 1 } } },
        }),
    ]);
    const apptChange = lastMonthAppts > 0
        ? Math.round(((thisMonthAppts - lastMonthAppts) / lastMonthAppts) * 100)
        : 0;
    const noShowRate = thisMonthAppts > 0
        ? Math.round((noShowsThisMonth / thisMonthAppts) * 100)
        : 0;
    const returnRate = totalPatients > 0
        ? Math.round((returningPatients.length / totalPatients) * 100)
        : 0;
    const revenueResult = await prisma_1.prisma.appointment.aggregate({
        where: { clinicId, status: 'COMPLETED', dateTime: { gte: thisMonthStart } },
        _sum: { fee: true },
    });
    const lastMonthRevenue = await prisma_1.prisma.appointment.aggregate({
        where: { clinicId, status: 'COMPLETED', dateTime: { gte: lastMonthStart, lte: lastMonthEnd } },
        _sum: { fee: true },
    });
    const revenue = Number(revenueResult._sum.fee ?? 0);
    const prevRevenue = Number(lastMonthRevenue._sum.fee ?? 0);
    const revenueChange = prevRevenue > 0
        ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100)
        : 0;
    res.json({
        revenue: { value: revenue, change: revenueChange },
        appointments: { value: thisMonthAppts, change: apptChange },
        returnRate: { value: returnRate, change: 0 },
        noShowRate: { value: noShowRate, change: 0 },
        totalPatients,
        totalCompleted,
    });
});
// GET /api/analytics/weekly-appointments
exports.getWeeklyAppointments = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const result = [];
    for (let i = 6; i >= 0; i--) {
        const day = (0, date_fns_1.subDays)(new Date(), i);
        const count = await prisma_1.prisma.appointment.count({
            where: {
                clinicId,
                dateTime: { gte: (0, date_fns_1.startOfDay)(day), lte: (0, date_fns_1.endOfDay)(day) },
                status: { notIn: ['CANCELLED'] },
            },
        });
        result.push({ date: (0, date_fns_1.format)(day, 'EEE'), count });
    }
    res.json(result);
});
// GET /api/analytics/monthly-revenue
exports.getMonthlyRevenue = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const result = [];
    for (let i = 5; i >= 0; i--) {
        const month = (0, date_fns_1.subMonths)(new Date(), i);
        const rev = await prisma_1.prisma.appointment.aggregate({
            where: {
                clinicId,
                status: 'COMPLETED',
                dateTime: { gte: (0, date_fns_1.startOfMonth)(month), lte: (0, date_fns_1.endOfMonth)(month) },
            },
            _sum: { fee: true },
        });
        result.push({
            month: (0, date_fns_1.format)(month, 'MMM yyyy'),
            revenue: Number(rev._sum.fee ?? 0),
        });
    }
    res.json(result);
});
// GET /api/analytics/messages-by-channel
exports.getMessagesByChannel = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const grouped = await prisma_1.prisma.message.groupBy({
        by: ['channel'],
        where: { clinicId },
        _count: { channel: true },
    });
    const data = grouped.map((g) => ({
        channel: g.channel,
        count: g._count.channel,
    }));
    res.json(data);
});
// GET /api/analytics/top-treatments
exports.getTopTreatments = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinicId = req.clinicId;
    const grouped = await prisma_1.prisma.appointment.groupBy({
        by: ['treatment'],
        where: { clinicId, status: { notIn: ['CANCELLED'] } },
        _count: { treatment: true },
        orderBy: { _count: { treatment: 'desc' } },
        take: 10,
    });
    res.json(grouped.map((g) => ({ treatment: g.treatment, count: g._count.treatment })));
});
//# sourceMappingURL=analytics.controller.js.map