"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.overlaps = overlaps;
exports.slotIsBlocked = slotIsBlocked;
exports.listBlocksForDay = listBlocksForDay;
exports.findSlotConflict = findSlotConflict;
exports.buildDaySlots = buildDaySlots;
exports.parseWorkingHours = parseWorkingHours;
exports.isDayOpen = isDayOpen;
exports.parseCalendarDate = parseCalendarDate;
exports.dayNameForDate = dayNameForDate;
exports.resolveWorkingHours = resolveWorkingHours;

const date_fns_1 = require("date-fns");
const prisma_1 = require("../lib/prisma");

const INACTIVE = ["CANCELLED", "NO_SHOW", "RESCHEDULED"];
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DEFAULT_DAY = { isOpen: true, open: "09:00", close: "17:00", slotDuration: 30 };
const DEFAULT_WORKING_HOURS = {
  monday: { ...DEFAULT_DAY },
  tuesday: { ...DEFAULT_DAY },
  wednesday: { ...DEFAULT_DAY },
  thursday: { ...DEFAULT_DAY },
  friday: { ...DEFAULT_DAY },
  saturday: { isOpen: false, closed: true, open: "09:00", close: "17:00", slotDuration: 30 },
  sunday: { isOpen: false, closed: true, open: "09:00", close: "17:00", slotDuration: 30 },
};

function resolveWorkingHours(raw) {
  const parsed = parseWorkingHours(raw);
  const merged = {};
  for (const key of WEEKDAY_KEYS) {
    const base = DEFAULT_WORKING_HOURS[key] ? { ...DEFAULT_WORKING_HOURS[key] } : { ...DEFAULT_DAY };
    const row = parsed[key];
    if (row && typeof row === "object") Object.assign(base, row);
    merged[key] = base;
  }
  return merged;
}

function parseWorkingHours(raw) {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  try {
    let parsed = JSON.parse(raw);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseCalendarDate(date) {
  if (date instanceof Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date));
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  }
  const d = (0, date_fns_1.parseISO)(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

function dayNameForDate(d) {
  return DAY_NAMES[d.getDay()];
}

function isDayOpen(dayConfig) {
  if (!dayConfig || typeof dayConfig !== "object") return false;
  if (dayConfig.closed === true) return false;
  if (dayConfig.isOpen === false) return false;
  if (dayConfig.isOpen === true || dayConfig.closed === false) return true;
  return !!(dayConfig.open && dayConfig.close);
}

function dayLabel(dayName) {
  return dayName.charAt(0).toUpperCase() + dayName.slice(1);
}

function sameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

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
  const hours = resolveWorkingHours(clinic.workingHours);
  const targetDate = parseCalendarDate(date);
  const dayName = dayNameForDate(targetDate);
  const dayConfig = hours[dayName];
  const slotStep = Number(dayConfig.slotDuration || durationMin || 30) || 30;
  const useDuration = Number(durationMin || slotStep) || 30;
  if (!isDayOpen(dayConfig)) {
    return {
      slots: [],
      closed: true,
      day: dayName,
      message: "Clinic closed this day. Update hours in Settings or pick another date.",
    };
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
  const now = new Date();
  let slotTime = (0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(targetDate, openH), openM);
  const closeTime = (0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(targetDate, closeH), closeM);
  let openSlotCount = 0;
  while ((0, date_fns_1.isBefore)(slotTime, closeTime)) {
    const slotEnd = (0, date_fns_1.addMinutes)(slotTime, useDuration);
    const isBooked = booked.some((b) => {
      const bEnd = (0, date_fns_1.addMinutes)(b.dateTime, b.durationMin);
      if (!overlaps(slotTime, slotEnd, b.dateTime, bEnd)) return false;
      if (opts.roomId && b.roomId && b.roomId === opts.roomId) return true;
      if (!multi) return true;
      return (opts.practitionerId || null) === (b.practitionerId || null);
    });
    const blocked = slotIsBlocked(slotTime, slotEnd, dayBlocks, opts);
    if (!isBooked && !blocked) {
      openSlotCount += 1;
      if (opts.includePast || (0, date_fns_1.isAfter)(slotTime, now)) {
        slots.push(slotTime.toISOString());
      }
    }
    slotTime = (0, date_fns_1.addMinutes)(slotTime, slotStep);
  }
  if (slots.length) return { slots, day: dayName };
  const label = dayLabel(dayName);
  if (sameCalendarDay(targetDate, now) && (0, date_fns_1.isAfter)(now, closeTime)) {
    return {
      slots: [],
      day: dayName,
      message: "Clinic hours ended for " + label + ". Pick another date.",
    };
  }
  if (sameCalendarDay(targetDate, now) && openSlotCount > 0) {
    return {
      slots: [],
      day: dayName,
      message: "No remaining open slots today. Try another date or adjust hours in Settings.",
    };
  }
  return {
    slots: [],
    day: dayName,
    message: "No open slots on " + label + ". Visits may be fully booked or blocked.",
  };
}
