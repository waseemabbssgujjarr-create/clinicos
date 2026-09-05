"use strict";
/**
 * Conversation Engine — IQPigeon-style pipeline for ClinicOS.
 *
 * Global Rules + Business Identity
 *   → Conversation Engine
 *   → Business Facts + Customer Memory + Current Intent
 *   → Response Planner
 *   → business-specific and/or general AI answer
 *   → Human-Like Response (caller applies timing)
 *
 * Custom replies are matched in code (not only prompt-injected).
 * Follow-ups (yes/no/tomorrow) use ConversationState.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.planAndGenerateReply = planAndGenerateReply;
exports.matchCustomReply = matchCustomReply;
exports.loadConversationState = loadConversationState;
exports.saveConversationState = saveConversationState;
exports.hashText = hashText;
exports.isShortFollowUp = isShortFollowUp;
exports.looksLikeGenericFallback = looksLikeGenericFallback;

const crypto = require("crypto");
const { prisma } = require("../lib/prisma");
const ai_service_1 = require("./ai.service");
const logger_1 = require("../lib/logger");

const SHORT_FOLLOW_UPS = new Set([
  "yes", "yeah", "yep", "yup", "ok", "okay", "sure", "please",
  "no", "nope", "nah", "not now",
  "good", "great", "thanks", "thank you", "thx",
  "tomorrow", "today", "tonight", "morning", "evening",
  "hi", "hello", "hey", "salaam", "salam", "assalamualaikum",
]);

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashText(text) {
  return crypto.createHash("sha256").update(String(text || "")).digest("hex").slice(0, 24);
}

function isShortFollowUp(text) {
  const n = normalize(text);
  if (!n) return false;
  if (SHORT_FOLLOW_UPS.has(n)) return true;
  return n.split(" ").length <= 2 && n.length <= 24;
}

function looksLikeGenericFallback(text) {
  const n = normalize(text);
  if (!n) return true;
  return (
    /our team will get back/i.test(text) ||
    /could you please repeat/i.test(text) ||
    /i am here to help/i.test(text) ||
    /thank you for contacting/i.test(text) && /shortly/i.test(text)
  );
}

function matchCustomReply(userMessage, rules) {
  if (!Array.isArray(rules) || !rules.length) return null;
  const msg = normalize(userMessage);
  if (!msg) return null;
  if (isShortFollowUp(userMessage) && msg.split(" ").length <= 2) return null;

  const sorted = rules.slice().sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
  for (const rule of sorted) {
    const q = normalize(rule.question);
    if (!q) continue;
    const type = rule.matchType || "contains";
    if (type === "exact" && msg === q) return rule;
    if (type === "starts_with" && msg.startsWith(q)) return rule;
    if (type !== "exact" && type !== "starts_with") {
      if (msg.includes(q) || q.includes(msg) && msg.length >= 8) return rule;
    }
  }
  return null;
}

function escalateKeywordHit(text, keywordsCsv) {
  const raw = String(keywordsCsv || "speak to doctor, human, manager, receptionist");
  const msg = normalize(text);
  return raw.split(",").map((s) => normalize(s)).filter(Boolean).some((k) => msg.includes(k));
}

async function loadConversationState(clinicId, patientId) {
  if (!patientId) return emptyState();
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT * FROM `ConversationState` WHERE `clinicId` = ? AND `patientId` = ? LIMIT 1",
      clinicId,
      patientId
    );
    if (Array.isArray(rows) && rows[0]) {
      const r = rows[0];
      return {
        id: r.id,
        turnCount: Number(r.turnCount || 0),
        greetingSent: r.greetingSent === 1 || r.greetingSent === true,
        lastIntent: r.lastIntent || null,
        lastAction: r.lastAction || null,
        pendingQuestion: r.pendingQuestion || null,
        pendingSlot: r.pendingSlot || null,
        lastOutboundBody: r.lastOutboundBody || null,
        lastFallbackHash: r.lastFallbackHash || null,
        memoryJson: r.memoryJson || null,
      };
    }
  } catch (_) { /* table may not exist yet */ }
  return emptyState();
}

function emptyState() {
  return {
    id: null,
    turnCount: 0,
    greetingSent: false,
    lastIntent: null,
    lastAction: null,
    pendingQuestion: null,
    pendingSlot: null,
    lastOutboundBody: null,
    lastFallbackHash: null,
    memoryJson: null,
  };
}

async function saveConversationState(clinicId, patientId, patch) {
  if (!patientId) return;
  const id = patch.id || ("cst_" + crypto.randomBytes(10).toString("hex"));
  const now = new Date();
  try {
    if (patch.id) {
      await prisma.$executeRawUnsafe(
        "UPDATE `ConversationState` SET `turnCount`=?, `greetingSent`=?, `lastIntent`=?, `lastAction`=?, `pendingQuestion`=?, `pendingSlot`=?, `lastOutboundBody`=?, `lastFallbackHash`=?, `memoryJson`=?, `updatedAt`=? WHERE `id`=?",
        patch.turnCount || 0,
        patch.greetingSent ? 1 : 0,
        patch.lastIntent,
        patch.lastAction,
        patch.pendingQuestion,
        patch.pendingSlot,
        patch.lastOutboundBody,
        patch.lastFallbackHash,
        patch.memoryJson,
        now,
        patch.id
      );
    } else {
      await prisma.$executeRawUnsafe(
        "INSERT INTO `ConversationState` (`id`,`clinicId`,`patientId`,`turnCount`,`greetingSent`,`lastIntent`,`lastAction`,`pendingQuestion`,`pendingSlot`,`lastOutboundBody`,`lastFallbackHash`,`memoryJson`,`createdAt`,`updatedAt`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id,
        clinicId,
        patientId,
        patch.turnCount || 1,
        patch.greetingSent ? 1 : 0,
        patch.lastIntent || null,
        patch.lastAction || null,
        patch.pendingQuestion || null,
        patch.pendingSlot || null,
        patch.lastOutboundBody || null,
        patch.lastFallbackHash || null,
        patch.memoryJson || null,
        now,
        now
      );
    }
  } catch (err) {
    logger_1.logger.debug("saveConversationState failed (non-fatal)", {
      clinicId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

function rewriteRepeatedFallback(clinicName, lastBody, nextBody, profile) {
  if (!looksLikeGenericFallback(nextBody)) return nextBody;
  if (!lastBody || hashText(lastBody) !== hashText(nextBody) && !looksLikeGenericFallback(lastBody)) {
    if (looksLikeGenericFallback(nextBody) && lastBody && looksLikeGenericFallback(lastBody)) {
      const about = (profile && profile.clinicKnowledge && profile.clinicKnowledge.about) || "";
      const highlight = (profile && profile.services && profile.services.highlight) || "";
      const bits = [about, highlight].filter(Boolean).slice(0, 1);
      if (bits.length) {
        return `I can help with that using ${clinicName}'s information. ${bits[0].slice(0, 220)} What would you like to know — hours, treatments, or booking?`;
      }
      return `I want to make sure I help correctly. Are you looking to book a visit, ask about a treatment, or check hours?`;
    }
    return nextBody;
  }
  return `Could you tell me a bit more — are you asking about treatments, fees, hours, or booking a visit?`;
}

function stripRepeatGreeting(reply, greetingSent, skipRepeat) {
  if (!skipRepeat || !greetingSent || !reply) return reply;
  return reply.replace(/^(hi|hello|hey|good (morning|afternoon|evening)|welcome)[^.!?]*[.!?]\s*/i, "");
}

/**
 * @param ctx  clinic context for ai.service.processInboundMessage
 * @param userMessage
 * @param extras { patientId, profile, customRules, source }
 */
async function planAndGenerateReply(ctx, userMessage, extras) {
  const extrasSafe = extras || {};
  const profile = extrasSafe.profile || {};
  const customRules = extrasSafe.customRules || [];
  const patientId = extrasSafe.patientId || null;
  const handling = profile.customerHandling || {};
  const personality = profile.personality || {};

  const state = await loadConversationState(ctx.clinicId, patientId);
  const matched = matchCustomReply(userMessage, customRules);

  let result;

  if (escalateKeywordHit(userMessage, handling.escalateKeywords)) {
    result = {
      reply: `I'll connect you with the ${ctx.clinicName} team right away.`,
      action: "escalate",
      confidence: 0.99,
      intent: "general",
      leadScore: "warm",
      tags: ["Escalation"],
      treatmentInterest: null,
      conversationSummary: `Patient asked for a human: "${String(userMessage).slice(0, 140)}"`,
      appointmentData: null,
      enginePath: "escalate_keyword",
    };
  } else if (matched) {
    result = {
      reply: matched.answer,
      action: "answer_faq",
      confidence: 0.99,
      intent: matched.category === "booking" ? "booking" : matched.category === "pricing" ? "price" : "general",
      leadScore: "warm",
      tags: ["Custom Reply", matched.category],
      treatmentInterest: null,
      conversationSummary: null,
      appointmentData: null,
      enginePath: "custom_reply",
      matchedRule: { id: matched.id, question: matched.question },
    };
  } else {
    const enriched = {
      ...ctx,
      conversationState: state,
      trainingProfile: profile,
      skipGreeting: !!(handling.skipRepeatGreeting !== false && state.greetingSent),
      isFollowUp: isShortFollowUp(userMessage),
    };
    result = await ai_service_1.processInboundMessage(enriched, userMessage);
    result.enginePath = result.enginePath || "llm";
  }

  const skipGreeting = handling.skipRepeatGreeting !== false;
  let reply = stripRepeatGreeting(result.reply || "", state.greetingSent, skipGreeting);
  if (handling.avoidRepeatFallback !== false || (profile.humanLike && profile.humanLike.avoidRepeatFallback !== false)) {
    reply = rewriteRepeatedFallback(ctx.clinicName, state.lastOutboundBody, reply, profile);
  }
  if (!reply || !String(reply).trim()) {
    reply = personality.introMessage
      ? personality.introMessage
      : `How can ${ctx.clinicName} help you today — booking, treatments, or hours?`;
  }
  result.reply = String(reply).trim();

  const pending = result.action === "none" && /[?؟]/.test(result.reply)
    ? result.reply
    : (result.action === "book_appointment" && !result.appointmentData?.requestedDateTime ? result.reply : null);

  await saveConversationState(ctx.clinicId, patientId, {
    id: state.id,
    turnCount: state.turnCount + 1,
    greetingSent: true,
    lastIntent: result.intent || state.lastIntent,
    lastAction: result.action || "none",
    pendingQuestion: pending,
    pendingSlot: result.appointmentData ? JSON.stringify(result.appointmentData) : state.pendingSlot,
    lastOutboundBody: result.reply,
    lastFallbackHash: looksLikeGenericFallback(result.reply) ? hashText(result.reply) : null,
    memoryJson: state.memoryJson,
  });

  logger_1.logger.info("CONVERSATION_ENGINE_RESULT", {
    clinicId: ctx.clinicId,
    path: result.enginePath,
    intent: result.intent,
    action: result.action,
    followUp: isShortFollowUp(userMessage),
    greetingSkipped: !!(state.greetingSent && skipGreeting),
  });

  return result;
}
