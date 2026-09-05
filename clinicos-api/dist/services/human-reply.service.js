"use strict";
/**
 * Human-like WhatsApp delivery — typing indicator + natural delay.
 * Does not send filler messages. Delay is computed from word counts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.wordCount = wordCount;
exports.humanDelayMs = humanDelayMs;
exports.sleep = sleep;
exports.deliverHumanLike = deliverHumanLike;

const whatsapp_provider_1 = require("./meta/whatsapp-provider.service");
const logger_1 = require("../lib/logger");

function wordCount(text) {
  const t = String(text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function humanDelayMs(replyText, incomingText, wpm) {
  const typeWpm = Math.max(80, Math.min(600, Number(wpm) || 280));
  const replyWords = wordCount(replyText);
  const incomingWords = wordCount(incomingText);
  const typeMs = Math.round(replyWords * (60000 / typeWpm));
  const readMs = Math.min(1200, Math.max(250, incomingWords * 80));
  const jitter = Math.round((typeMs + readMs) * ((Math.random() * 8 - 4) / 100));
  return Math.max(400, Math.min(7000, readMs + typeMs + jitter));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Show typing (via Meta read+typing_indicator), wait a natural interval,
 * then invoke sendFn. sendFn should perform the actual outbound send.
 */
async function deliverHumanLike(opts) {
  const {
    clinicId,
    inboundMetaId,
    reply,
    incomingText,
    humanLike,
    generateStartedAt,
    sendFn,
  } = opts;

  const enabled = humanLike && humanLike.naturalDelay !== false;
  const typingOn = !humanLike || humanLike.typingIndicator !== false;

  if (typingOn && inboundMetaId) {
    try {
      await whatsapp_provider_1.markAsRead(clinicId, inboundMetaId, true);
    } catch (err) {
      logger_1.logger.debug("typing indicator failed (non-fatal)", {
        clinicId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (enabled) {
    const target = humanDelayMs(reply, incomingText, humanLike && humanLike.wpm);
    const already = Date.now() - (generateStartedAt || Date.now());
    const wait = Math.max(0, target - already);
    if (wait > 0) await sleep(wait);
  }

  return sendFn();
}
