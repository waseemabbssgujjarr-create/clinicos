"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.overlaps = overlaps;
exports.slotIsBlocked = slotIsBlocked;
exports.listBlocksForDay = listBlocksForDay;
exports.findSlotConflict = findSlotConflict;
exports.buildDaySlots = buildDaySlots;

const date_fns_1 = require("date-fns");
const prisma_1 = require("../lib/prisma");

const INACTIVE = ["CANCELLED", "NO_SHOW", "RESCHEDULED"];

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

async function listBlocksForDay(clinicId, day, opts) {
  opts = opts || {};
  const start = (0, date_fns_1.startOfDay)(day);
  const end = (0, date_fns_1.endOfDay)(day);
  const [leaves, blocks] = await Promise.all([
    prisma_1.prisma.leave.findMany({
      where: {
        clinicId,
        startsAt: { lte: end },
        endsAt: { gte: start },
        ...(opts.practitionerId ? { practitionerId: opts.practitionerId } : {}),
      },
    }).catch(() => []),
    prisma_1.prisma.scheduleBlock.findMany({
      where: {
        clinicId,
        startsAt: { lte: end },
        endsAt: { gte: start },
      },
    }).catch(() => []),
  ]);
  return { leaves, blocks };
}

function slotIsBlocked(slotStart, slotEnd, { leaves, blocks }, opts) {
  opts = opts || {};
  for (const leave of leaves || []) {
    if (opts.practitionerId && leave.practitionerId && leave.practitionerId !== opts.practitionerId) continue;
    if (!opts.practitionerId || leave.practitionerId === opts.practitionerId) {
      if (overlaps(slotStart, slotEnd, leave.startsAt, leave.endsAt)) return true;
    }
  }
  for (const block of blocks || []) {
    if (block.practitionerId && opts.practitionerId && block.practitionerId !== opts.practitionerId) continue;
    if (block.locationId && opts.locationId && block.locationId !== opts.locationId) continue;
    if (block.roomId && opts.roomId && block.roomId !== opts.roomId) continue;
    if (overlaps(slotStart, slotEnd, block.startsAt, block.endsAt)) return true;
  }
  return false;
}

async function findSlotConflict(clinicId, start, durationMin, opts) {
  opts = opts || {};
  const end = (0, date_fns_1.addMinutes)(start, durationMin);
  const booked = await prisma_1.prisma.appointment.findMany({
    where: {
      clinicId,
      status: { notIn: INACTIVE },
      dateTime: { gte: (0, date_fns_1.addMinutes)(start, -240), lt: (0, date_fns_1.addMinutes)(end, 240) },
    },
    select: { id: true, dateTime: true, durationMin: true, practitionerId: true, roomId: true, locationId: true },
  });
  const practitionerCount = await prisma_1.prisma.practitioner.count({ where: { clinicId, isActive: true } }).catch(() => 1);
  const multi = practitionerCount > 1;
  const hit = booked.find((b) => {
    if (opts.ignoreId && b.id === opts.ignoreId) return false;
    const bEnd = (0, date_fns_1.addMinutes)(b.dateTime, b.durationMin);
    if (!overlaps(start, end, b.dateTime, bEnd)) return false;
    if (opts.roomId && b.roomId && b.roomId === opts.roomId) return true;
    if (!multi) return true;
    const aPr = opts.practitionerId || null;
    const bPr = b.practitionerId || null;
    return aPr === bPr;
  });
  if (hit) return { type: "APPOINTMENT", record: hit };
  const dayBlocks = await listBlocksForDay(clinicId, start, { practitionerId: opts.practitionerId });
  if (slotIsBlocked(start, end, dayBlocks, opts)) return { type: "SCHEDULE" };
  return null;
}

async function buildDaySlots(clinic, date, durationMin, opts) {
  opts = opts || {};
  const hours = JSON.parse(clinic.workingHours || "{}");
  const targetDate = date instanceof Date ? date : (0, date_fns_1.parseISO)(date);
  const dayName = targetDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const dayConfig = hours[dayName];
  if (!dayConfig || !dayConfig.isOpen) {
    return { slots: [], message: "Clinic is closed on this day" };
  }
  const [openH, openM] = (dayConfig.open || "09:00").split(":").map(Number);
  const [closeH, closeM] = (dayConfig.close || "17:00").split(":").map(Number);
  const booked = await prisma_1.prisma.appointment.findMany({
    where: {
      clinicId: clinic.id,
      dateTime: { gte: (0, date_fns_1.startOfDay)(targetDate), lte: (0, date_fns_1.endOfDay)(targetDate) },
      status: { notIn: INACTIVE },
    },
    select: { dateTime: true, durationMin: true, practitionerId: true, roomId: true },
  });
  const dayBlocks = await listBlocksForDay(clinic.id, targetDate, { practitionerId: opts.practitionerId });
  const practitionerCount = await prisma_1.prisma.practitioner.count({ where: { clinicId: clinic.id, isActive: true } }).catch(() => 1);
  const multi = practitionerCount > 1;
  const slots = [];
  let slotTime = (0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(targetDate, openH), openM);
  const closeTime = (0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(targetDate, closeH), closeM);
  while ((0, date_fns_1.isBefore)(slotTime, closeTime)) {
    const slotEnd = (0, date_fns_1.addMinutes)(slotTime, durationMin);
    const isBooked = booked.some((b) => {
      const bEnd = (0, date_fns_1.addMinutes)(b.dateTime, b.durationMin);
      if (!overlaps(slotTime, slotEnd, b.dateTime, bEnd)) return false;
      if (opts.roomId && b.roomId && b.roomId === opts.roomId) return true;
      if (!multi) return true;
      return (opts.practitionerId || null) === (b.practitionerId || null);
    });
    const blocked = slotIsBlocked(slotTime, slotEnd, dayBlocks, opts);
    if (!isBooked && !blocked && (0, date_fns_1.isAfter)(slotTime, new Date())) {
      slots.push(slotTime.toISOString());
    }
    slotTime = (0, date_fns_1.addMinutes)(slotTime, durationMin);
  }
  return { slots };
}
