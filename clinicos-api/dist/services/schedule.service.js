"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.overlaps = overlaps;
exports.slotIsBlocked = slotIsBlocked;
exports.listBlocksForDay = listBlocksForDay;
exports.findSlotConflict = findSlotConflict;
exports.buildDaySlots = buildDaySlots;
exports.parseWorkingHours = parseWorkingHours;
exports.parseTimeToMinutes = parseTimeToMinutes;
exports.formatMinutesAsHHMM = formatMinutesAsHHMM;
exports.computeSlotStartMinutes = computeSlotStartMinutes;
exports.isDayOpen = isDayOpen;
exports.parseCalendarDate = parseCalendarDate;
exports.dayNameForDate = dayNameForDate;
exports.resolveWorkingHours = resolveWorkingHours;

const date_fns_1 = require("date-fns");
const prisma_1 = require("../lib/prisma");

const INACTIVE = ["CANCELLED", "NO_SHOW", "RESCHEDULED"];
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_ALIASES = {
  mon: "monday",
  tue: "tuesday",
  tues: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  thur: "thursday",
  thurs: "thursday",
  fri: "friday",
  sat: "saturday",
  sun: "sunday",
};
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

function canonicalDayKey(key) {
  if (!key) return null;
  const k = String(key).toLowerCase();
  return DAY_ALIASES[k] || (WEEKDAY_KEYS.includes(k) ? k : null);
}

function normalizeDayConfig(dayConfig) {
  if (!dayConfig || typeof dayConfig !== "object") return dayConfig;
  if (dayConfig.start && !dayConfig.open) dayConfig.open = dayConfig.start;
  if (dayConfig.end && !dayConfig.close) dayConfig.close = dayConfig.end;
  if (dayConfig.from && !dayConfig.open) dayConfig.open = dayConfig.from;
  if (dayConfig.to && !dayConfig.close) dayConfig.close = dayConfig.to;
  if (dayConfig.open) dayConfig.open = formatMinutesAsHHMM(parseTimeToMinutes(dayConfig.open)) || String(dayConfig.open).trim();
  if (dayConfig.close) dayConfig.close = formatMinutesAsHHMM(parseTimeToMinutes(dayConfig.close)) || String(dayConfig.close).trim();
  if (dayConfig.isOpen === true) {
    dayConfig.closed = false;
  } else if (dayConfig.isOpen === false || dayConfig.closed === true) {
    dayConfig.isOpen = false;
    dayConfig.closed = true;
  } else if (dayConfig.closed === false && dayConfig.open && dayConfig.close) {
    dayConfig.isOpen = true;
  }
  return dayConfig;
}

/** Minutes from local midnight (0–1439). Supports HH:mm, HH:mm:ss, 9:00 AM, 10:00 PM, 21:00, 24:00 (midnight end). */
function parseTimeToMinutes(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.floor(raw);
    if (n >= 0 && n < 1440) return n;
    return null;
  }
  let s = String(raw).trim();
  if (!s) return null;
  const upper = s.toUpperCase();
  const ampm = upper.match(/\s*(A\.?M\.?|P\.?M\.?)\s*$/);
  let isPm = false;
  let isAm = false;
  if (ampm) {
    isPm = ampm[1].replace(/\./g, "").startsWith("P");
    isAm = !isPm;
    s = s.slice(0, ampm.index).trim();
  }
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  let min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || min < 0 || min > 59) return null;
  if (ampm) {
    if (h < 1 || h > 12) return null;
    if (isAm) {
      if (h === 12) h = 0;
    } else if (h !== 12) {
      h += 12;
    }
  } else if (h === 24 && min === 0) {
    return 1440;
  } else if (h < 0 || h > 23) {
    return null;
  }
  return h * 60 + min;
}

function formatMinutesAsHHMM(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  if (minutes === 1440) return "24:00";
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
}

function dateAtLocalMinutes(calendarDay, minutesFromMidnight) {
  const y = calendarDay.getFullYear();
  const mo = calendarDay.getMonth();
  const d = calendarDay.getDate();
  if (minutesFromMidnight >= 1440) {
    return new Date(y, mo, d + 1, 0, 0, 0, 0);
  }
  const h = Math.floor(minutesFromMidnight / 60);
  const min = minutesFromMidnight % 60;
  return new Date(y, mo, d, h, min, 0, 0);
}

function computeSlotStartMinutes(dayConfig, durationMin) {
  const slotStep = Number(dayConfig.slotDuration || durationMin || 30) || 30;
  const useDuration = Number(durationMin || slotStep) || 30;
  const openMin = parseTimeToMinutes(dayConfig.open || DEFAULT_DAY.open);
  let closeMin = parseTimeToMinutes(dayConfig.close || DEFAULT_DAY.close);
  if (openMin == null || closeMin == null) return { starts: [], slotStep, useDuration, openMin, closeMin };
  if (closeMin <= openMin && closeMin !== 1440) return { starts: [], slotStep, useDuration, openMin, closeMin };
  const effectiveClose = closeMin === 1440 ? 1440 : closeMin;
  const starts = [];
  for (let m = openMin; m + useDuration <= effectiveClose; m += slotStep) {
    starts.push(m);
  }
  return { starts, slotStep, useDuration, openMin, closeMin: effectiveClose };
}

function resolveWorkingHours(raw) {
  const parsed = parseWorkingHours(raw);
  const merged = {};
  for (const key of WEEKDAY_KEYS) {
    const base = DEFAULT_WORKING_HOURS[key] ? { ...DEFAULT_WORKING_HOURS[key] } : { ...DEFAULT_DAY };
    const row = parsed[key];
    if (row && typeof row === "object") Object.assign(base, row);
    merged[key] = normalizeDayConfig(base);
  }
  return merged;
}

function parseWorkingHours(raw) {
  if (!raw) return {};
  let obj = raw;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    try {
      let parsed = JSON.parse(raw);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      obj = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    const canon = canonicalDayKey(key);
    if (!canon) continue;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      out[canon] = out[canon] ? Object.assign(out[canon], val) : { ...val };
    }
  }
  return out;
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
  const cfg = normalizeDayConfig({ ...dayConfig });
  if (cfg.closed === true || cfg.isOpen === false) return false;
  if (cfg.isOpen === true) {
    const open = cfg.open || DEFAULT_DAY.open;
    const close = cfg.close || DEFAULT_DAY.close;
    return open !== close;
  }
  if (cfg.closed === false && cfg.open && cfg.close) return true;
  return false;
}

function dayLabel(dayName) {
  return dayName.charAt(0).toUpperCase() + dayName.slice(1);
}

function closedDayMessage(dayName) {
  const label = dayLabel(dayName);
  return "Clinic closed on " + label + "s — open this day under Settings → Hours";
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
  if (!isDayOpen(dayConfig)) {
    return {
      slots: [],
      closed: true,
      day: dayName,
      message: closedDayMessage(dayName),
    };
  }
  const { starts, useDuration, openMin, closeMin } = computeSlotStartMinutes(dayConfig, durationMin);
  if (!starts.length && openMin != null && closeMin != null && openMin < closeMin) {
    return {
      slots: [],
      day: dayName,
      message: "No open slots on " + dayLabel(dayName) + ". Visits may be fully booked or blocked.",
    };
  }
  if (!starts.length && (openMin == null || closeMin == null || openMin >= closeMin)) {
    return {
      slots: [],
      closed: true,
      day: dayName,
      message: closedDayMessage(dayName),
    };
  }
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
  let openSlotCount = 0;
  for (const startMin of starts) {
    const slotTime = dateAtLocalMinutes(targetDate, startMin);
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
  }
  if (slots.length) return { slots, day: dayName };
  const label = dayLabel(dayName);
  const dayEnd = dateAtLocalMinutes(targetDate, closeMin === 1440 ? 1439 : closeMin);
  if (sameCalendarDay(targetDate, now) && (0, date_fns_1.isAfter)(now, dayEnd)) {
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
