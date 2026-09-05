"use strict";
/**
 * Structured AI training profile — draft / publish.
 * Consumed by the Conversation Engine. Clinic.treatments / workingHours remain
 * the operational booking source; this profile adds identity, rules, and behaviour.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrainingProfile = getTrainingProfile;
exports.saveTrainingProfile = saveTrainingProfile;
exports.publishTrainingProfile = publishTrainingProfile;
exports.getProfileForEngine = getProfileForEngine;
exports.defaultTrainingProfile = defaultTrainingProfile;
exports.mergeProfile = mergeProfile;

const crypto = require("crypto");
const { prisma } = require("../lib/prisma");
const logger_1 = require("../lib/logger");

function defaultTrainingProfile() {
  return {
    version: 1,
    personality: {
      enabled: true,
      receptionistName: "",
      tone: "professional",
      language: "english",
      introMessage: "",
      emojiPolicy: "minimal",
    },
    clinicKnowledge: {
      about: "",
      parking: "",
      insurance: "",
      facts: [],
    },
    services: {
      notes: "",
      highlight: "",
    },
    businessRules: {
      policies: "",
      cancellation: "",
      payment: "",
      emergency: "For chest pain, severe bleeding, or breathing difficulty, tell the patient to call emergency services immediately and escalate.",
      whatNotToSay: "Never diagnose, prescribe, or invent prices that are not in clinic training.",
    },
    appointmentRules: {
      autoConfirm: true,
      bookingLeadHours: 2,
      maxAdvanceDays: 30,
      requireTreatmentFirst: true,
      collectName: true,
      confirmationStyle: "confirm_then_book",
    },
    customerHandling: {
      greetReturning: true,
      skipRepeatGreeting: true,
      askOneQuestion: true,
      escalateKeywords: "speak to doctor, human, manager, receptionist",
      unknownPolicy: "ask_clarify_then_escalate",
      memoryNotes: "",
    },
    humanLike: {
      typingIndicator: true,
      naturalDelay: true,
      wpm: 280,
      avoidRepeatFallback: true,
      followUpAwareness: true,
    },
  };
}

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function mergeProfile(base, patch) {
  if (!isPlainObject(patch)) return base;
  const out = { ...base };
  for (const key of Object.keys(patch)) {
    if (isPlainObject(base[key]) && isPlainObject(patch[key])) {
      out[key] = { ...base[key], ...patch[key] };
    } else {
      out[key] = patch[key];
    }
  }
  return out;
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return isPlainObject(v) ? v : fallback;
  } catch (_) {
    return fallback;
  }
}

function sanitise(row) {
  if (!row) return null;
  const draft = mergeProfile(defaultTrainingProfile(), parseJson(row.draftJson, {}));
  const published = row.publishedJson
    ? mergeProfile(defaultTrainingProfile(), parseJson(row.publishedJson, {}))
    : null;
  return {
    clinicId: row.clinicId,
    draft,
    published,
    draftUpdatedAt: row.draftUpdatedAt,
    publishedAt: row.publishedAt,
    publishedBy: row.publishedBy,
    isPublished: !!row.publishedAt,
  };
}

async function getRow(clinicId) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT * FROM `AITrainingProfile` WHERE `clinicId` = ? LIMIT 1",
      clinicId
    );
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (_) {
    return null;
  }
}

async function getTrainingProfile(req, res) {
  const clinicId = req.clinicId;
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: {
      aiEnabled: true, aiLanguage: true, aiPersonality: true,
      customIntroMsg: true, autoConfirm: true, reminderTiming: true,
      treatments: true, workingHours: true, name: true, specialty: true,
      address: true, phone: true, updatedAt: true,
    },
  });
  const row = await getRow(clinicId);
  const profile = sanitise(row) || {
    clinicId,
    draft: hydrateFromClinic(defaultTrainingProfile(), clinic),
    published: null,
    draftUpdatedAt: clinic && clinic.updatedAt,
    publishedAt: null,
    publishedBy: null,
    isPublished: false,
  };
  if (!row && clinic) {
    profile.draft = hydrateFromClinic(profile.draft, clinic);
  }
  res.json({
    profile: profile.draft,
    published: profile.published,
    meta: {
      draftUpdatedAt: profile.draftUpdatedAt,
      publishedAt: profile.publishedAt,
      publishedBy: profile.publishedBy,
      isPublished: profile.isPublished,
    },
    clinic: {
      name: clinic && clinic.name,
      specialty: clinic && clinic.specialty,
      treatments: clinic && clinic.treatments,
      workingHours: clinic && clinic.workingHours,
      aiEnabled: clinic && clinic.aiEnabled,
    },
  });
}

function hydrateFromClinic(draft, clinic) {
  if (!clinic) return draft;
  const next = mergeProfile(defaultTrainingProfile(), draft);
  if (!next.personality.language && clinic.aiLanguage) next.personality.language = clinic.aiLanguage;
  if (clinic.aiLanguage) next.personality.language = clinic.aiLanguage;
  if (clinic.aiPersonality) next.personality.tone = clinic.aiPersonality;
  if (clinic.customIntroMsg) next.personality.introMessage = clinic.customIntroMsg;
  next.personality.enabled = clinic.aiEnabled !== false;
  next.appointmentRules.autoConfirm = clinic.autoConfirm !== false;
  return next;
}

async function saveTrainingProfile(req, res) {
  const clinicId = req.clinicId;
  const patch = req.body && req.body.profile ? req.body.profile : (req.body || {});
  const existing = await getRow(clinicId);
  const current = existing
    ? mergeProfile(defaultTrainingProfile(), parseJson(existing.draftJson, {}))
    : hydrateFromClinic(defaultTrainingProfile(), await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { aiEnabled: true, aiLanguage: true, aiPersonality: true, customIntroMsg: true, autoConfirm: true },
      }));
  const merged = mergeProfile(current, patch);
  const now = new Date();
  const json = JSON.stringify(merged);
  try {
    if (existing) {
      await prisma.$executeRawUnsafe(
        "UPDATE `AITrainingProfile` SET `draftJson`=?, `draftUpdatedAt`=?, `updatedAt`=? WHERE `clinicId`=?",
        json, now, now, clinicId
      );
    } else {
      await prisma.$executeRawUnsafe(
        "INSERT INTO `AITrainingProfile` (`id`,`clinicId`,`draftJson`,`draftUpdatedAt`,`createdAt`,`updatedAt`) VALUES (?,?,?,?,?,?)",
        "atp_" + crypto.randomBytes(10).toString("hex"),
        clinicId,
        json,
        now,
        now,
        now
      );
    }
  } catch (err) {
    logger_1.logger.error("saveTrainingProfile", { clinicId, err: err instanceof Error ? err.message : String(err) });
    return res.status(503).json({ error: "Training profile table is not ready. Restart the API so schema ensure can run." });
  }

  // Keep Clinic columns in sync for operational fields the rest of the app already reads.
  const p = merged.personality || {};
  const ar = merged.appointmentRules || {};
  await prisma.clinic.update({
    where: { id: clinicId },
    data: {
      aiEnabled: p.enabled !== false,
      aiLanguage: p.language || "english",
      aiPersonality: p.tone || "professional",
      customIntroMsg: p.introMessage || null,
      autoConfirm: ar.autoConfirm !== false,
    },
  }).catch(() => null);

  res.json({ ok: true, profile: merged, draftUpdatedAt: now });
}

async function publishTrainingProfile(req, res) {
  const clinicId = req.clinicId;
  let row = await getRow(clinicId);
  if (!row) return res.status(400).json({ error: "Save a draft before publishing." });
  const now = new Date();
  const actor = (req.user && (req.user.email || req.user.id)) || null;
  await prisma.$executeRawUnsafe(
    "UPDATE `AITrainingProfile` SET `publishedJson`=`draftJson`, `publishedAt`=?, `publishedBy`=?, `updatedAt`=? WHERE `clinicId`=?",
    now, actor, now, clinicId
  );
  const updated = await getRow(clinicId);
  res.json({ ok: true, publishedAt: now, publishedBy: actor, profile: sanitise(updated) });
}

/**
 * Live WhatsApp uses published profile if present, otherwise draft.
 * Test chat uses draft.
 */
async function getProfileForEngine(clinicId, { live } = { live: true }) {
  const row = await getRow(clinicId);
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { aiEnabled: true, aiLanguage: true, aiPersonality: true, customIntroMsg: true, autoConfirm: true },
  });
  if (!row) return hydrateFromClinic(defaultTrainingProfile(), clinic);
  const src = live && row.publishedJson ? row.publishedJson : row.draftJson;
  return hydrateFromClinic(mergeProfile(defaultTrainingProfile(), parseJson(src, {})), clinic);
}
