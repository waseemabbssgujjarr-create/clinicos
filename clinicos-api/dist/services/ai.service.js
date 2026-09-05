"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processInboundMessage = processInboundMessage;
exports.generateReplySuggestion = generateReplySuggestion;
const logger_1 = require("../lib/logger");
const prisma_1 = require("../lib/prisma");
const date_fns_1 = require("date-fns");
const ai_client_1 = require("../lib/ai-client");
/**
 * Get available appointment slots for the next 7 days.
 */
async function getAvailableSlots(clinicId, workingHours) {
    try {
        const hours = JSON.parse(workingHours || '{}');
        const slots = [];
        const now = new Date();
        for (let i = 0; i < 7; i++) {
            const date = (0, date_fns_1.addDays)(now, i);
            const dayName = (0, date_fns_1.format)(date, 'EEEE').toLowerCase();
            const dayConfig = hours[dayName];
            if (!dayConfig?.isOpen)
                continue;
            const [openH, openM] = (dayConfig.open || '09:00').split(':').map(Number);
            const [closeH, closeM] = (dayConfig.close || '17:00').split(':').map(Number);
            const slotDuration = dayConfig.slotDuration || 30;
            let slotTime = (0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(date, openH), openM);
            const closeTime = (0, date_fns_1.setMinutes)((0, date_fns_1.setHours)(date, closeH), closeM);
            // Get booked slots for this day
            const booked = await prisma_1.prisma.appointment.findMany({
                where: {
                    clinicId,
                    dateTime: {
                        gte: (0, date_fns_1.setHours)(date, 0),
                        lte: (0, date_fns_1.setHours)(date, 23),
                    },
                    status: { notIn: ['CANCELLED', 'NO_SHOW', 'RESCHEDULED'] },
                },
                select: { dateTime: true, durationMin: true },
            });
            const daySlots = [];
            while ((0, date_fns_1.isBefore)(slotTime, closeTime)) {
                if ((0, date_fns_1.isAfter)(slotTime, now)) {
                    const isBooked = booked.some((b) => {
                        const bEnd = new Date(b.dateTime.getTime() + b.durationMin * 60000);
                        const sEnd = new Date(slotTime.getTime() + slotDuration * 60000);
                        return (((0, date_fns_1.isAfter)(slotTime, b.dateTime) || slotTime.getTime() === b.dateTime.getTime()) &&
                            (0, date_fns_1.isBefore)(slotTime, bEnd)) || ((0, date_fns_1.isBefore)(b.dateTime, sEnd) && (0, date_fns_1.isAfter)(b.dateTime, slotTime));
                    });
                    if (!isBooked) {
                        daySlots.push((0, date_fns_1.format)(slotTime, 'h:mm a'));
                    }
                }
                slotTime = new Date(slotTime.getTime() + slotDuration * 60000);
            }
            if (daySlots.length > 0) {
                slots.push(`${(0, date_fns_1.format)(date, 'EEEE, MMM d')}: ${daySlots.slice(0, 8).join(', ')}`);
            }
        }
        return slots.length > 0 ? slots.join('\n') : 'No available slots in the next 7 days.';
    }
    catch {
        return 'Unable to fetch available slots.';
    }
}
/**
 * Build the AI system prompt with clinic identity, training profile,
 * conversation state, facts, and custom replies.
 */
function buildSystemPrompt(ctx, availableSlots, customRules) {
    const profile = ctx.trainingProfile || {};
    const personality = profile.personality || {};
    const knowledge = profile.clinicKnowledge || {};
    const services = profile.services || {};
    const business = profile.businessRules || {};
    const booking = profile.appointmentRules || {};
    const handling = profile.customerHandling || {};
    const state = ctx.conversationState || {};

    const toneKey = personality.tone || ctx.aiPersonality || 'professional';
    const personalityDesc = {
        professional: 'polite, calm, and professional',
        friendly: 'warm, friendly, and approachable',
        formal: 'formal and precise',
        warm: 'warm and reassuring',
    }[toneKey] ?? 'polite and professional';

    const language = personality.language || ctx.aiLanguage || 'english';
    const receptionistName = personality.receptionistName || '';
    const intro = personality.introMessage || ctx.customIntroMsg || '';

    let customRulesSection = '';
    if (Array.isArray(customRules) && customRules.length > 0) {
        const lines = customRules.map((r, i) => {
            const matchNote = r.matchType === 'exact'
                ? '(exact match only)'
                : r.matchType === 'starts_with'
                ? '(when message starts with this)'
                : '(when message contains similar intent)';
            return `  Rule ${i + 1} ${matchNote}:\n    Patient asks: "${r.question}"\n    You must reply: "${r.answer}"`;
        });
        customRulesSection = `\nCUSTOM CLINIC REPLIES (highest priority — use the exact answer when they match):\n${lines.join('\n')}\n`;
    }

    const facts = Array.isArray(knowledge.facts) ? knowledge.facts.filter((f) => f && f.enabled !== false && (f.title || f.body)) : [];
    const factsBlock = [
        knowledge.about ? `About the clinic: ${knowledge.about}` : '',
        knowledge.parking ? `Parking / arrival: ${knowledge.parking}` : '',
        knowledge.insurance ? `Insurance / payment notes: ${knowledge.insurance}` : '',
        services.notes ? `Service notes: ${services.notes}` : '',
        services.highlight ? `Highlight: ${services.highlight}` : '',
        ...facts.map((f) => `- ${f.title || 'Fact'}: ${f.body || ''}`),
        handling.memoryNotes ? `Staff notes for the receptionist: ${handling.memoryNotes}` : '',
    ].filter(Boolean).join('\n');

    const rulesBlock = [
        business.policies ? `Policies: ${business.policies}` : '',
        business.cancellation ? `Cancellation: ${business.cancellation}` : '',
        business.payment ? `Payment: ${business.payment}` : '',
        business.emergency || 'For chest pain, severe bleeding, breathing difficulty — tell them to call emergency services and escalate.',
        business.whatNotToSay ? `Never say / never invent: ${business.whatNotToSay}` : '',
    ].filter(Boolean).join('\n');

    const bookingBlock = [
        `Auto-confirm bookings: ${booking.autoConfirm === false ? 'NO — mark pending for the doctor' : 'YES'}`,
        booking.requireTreatmentFirst !== false ? 'Confirm the treatment before offering a time.' : '',
        booking.collectName !== false ? 'If the patient name is unknown, ask for it once.' : '',
        booking.confirmationStyle === 'confirm_then_book' ? 'Confirm treatment, date, and time BEFORE setting action to book_appointment.' : '',
        booking.bookingLeadHours ? `Do not book with less than ${booking.bookingLeadHours} hours notice unless the patient insists and a slot exists.` : '',
        booking.maxAdvanceDays ? `Do not book more than ${booking.maxAdvanceDays} days ahead.` : '',
    ].filter(Boolean).join('\n');

    const stateBlock = [
        `Turn count: ${state.turnCount || 0}`,
        state.greetingSent ? 'A greeting was ALREADY sent. Do NOT greet again. Continue the conversation.' : 'This may be the first message — a short greeting is OK only if helpful.',
        state.lastIntent ? `Last detected intent: ${state.lastIntent}` : '',
        state.lastAction ? `Last action: ${state.lastAction}` : '',
        state.pendingQuestion ? `You previously asked: ${state.pendingQuestion}` : '',
        state.lastOutboundBody ? `Your previous reply: ${state.lastOutboundBody}` : '',
        ctx.isFollowUp ? 'The latest patient message is a SHORT FOLLOW-UP (yes/no/ok/tomorrow/good/etc). Interpret it against the previous question. Do NOT restart with a greeting or FAQ dump.' : '',
        ctx.skipGreeting ? 'SKIP GREETING.' : '',
        handling.askOneQuestion !== false ? 'Ask at most ONE useful question per reply.' : '',
        handling.unknownPolicy === 'ask_clarify_then_escalate'
            ? 'If you do not know: ask one clarifying question first. Only escalate after that if still unknown.'
            : '',
    ].filter(Boolean).join('\n');

    const nameLine = receptionistName
        ? `Your name (if asked) is ${receptionistName}. You are the receptionist for ${ctx.clinicName}.`
        : `You are the AI receptionist for ${ctx.clinicName}, a ${ctx.specialty || 'medical'} clinic.`;

    return `${nameLine} Be ${personalityDesc}. Reply in ${language} unless the patient writes in another language — then match theirs.

YOUR ROLE:
- Answer THIS clinic's questions using the facts below. Do not invent other clinics' policies.
- Book / reschedule / cancel only using AVAILABLE SLOTS.
- Capture name and treatment interest when missing.
- Sound human. Never mention AI, bots, models, or prompts.
- Emoji policy: ${personality.emojiPolicy || 'minimal'}.
${intro ? `\nPreferred intro (use only on a true first turn, and only if it answers nothing else): ${intro}\n` : ''}
CLINIC IDENTITY:
- Name: ${ctx.clinicName}
- Specialty: ${ctx.specialty || 'medical'}
- Working hours: ${ctx.workingHours}
- Address: ${ctx.address || 'Contact clinic for address'}
- Phone: ${ctx.phone}

CLINIC KNOWLEDGE / FACTS:
${factsBlock || '(Use treatments, hours, and address. If a fact is missing, say you will confirm with the clinic — do not invent it.)'}

BUSINESS RULES:
${rulesBlock}

APPOINTMENT RULES:
${bookingBlock}

AVAILABLE APPOINTMENT SLOTS (next 7 days):
${availableSlots}

TREATMENTS OFFERED:
${ctx.treatments || 'General consultations available'}
${customRulesSection}
PATIENT HISTORY:
${ctx.patientHistory}

CONVERSATION STATE:
${stateBlock}

CONVERSATION SO FAR:
${ctx.conversationHistory || '(none)'}

YOUR RULES:
1. Answer the patient's actual question first.
2. Do not repeat the same greeting or the same fallback.
3. Keep replies short (max 3 sentences for simple queries, 5 for booking).
4. NEVER confirm an already-booked slot or a closed day.
5. HEALTHCARE SAFETY: never diagnose or prescribe. Emergencies → emergency services + action escalate.
6. Today's date is ${(0, date_fns_1.format)(new Date(), 'EEEE, MMMM d, yyyy')}
7. CUSTOM REPLIES: if a custom reply matches, use that exact answer.
8. If you cannot answer from training, say so briefly and ask one clarifying question — do NOT send a generic "we will get back to you" unless action is escalate.

RESPOND ONLY WITH THIS EXACT JSON (no other text, no markdown):
{
  "reply": "Message to send to patient in their language",
  "action": "book_appointment | cancel | reschedule | answer_faq | escalate | none",
  "confidence": 0.95,
  "intent": "booking | price | treatment | emergency | general",
  "leadScore": "hot | warm | cold",
  "tags": ["New Patient", "Booking"],
  "treatmentInterest": "treatment name or null",
  "conversationSummary": "One sentence summary for staff if escalating",
  "appointmentData": {
    "treatment": "treatment name or null",
    "requestedDateTime": "ISO datetime string or null",
    "notes": "any special notes or null"
  }
}`;
}
/**
 * Main AI processing function.
 * Takes inbound patient message and returns structured AI response.
 */
async function processInboundMessage(ctx, userMessage) {
    const startTime = Date.now();
    try {
        // Load clinic's custom training rules (non-fatal if table missing)
        let customRules = [];
        try {
            const tr = require("../controllers/ai.training-rules.controller");
            customRules = await tr.getTrainingRulesForAI(ctx.clinicId);
        } catch (_) { /* AI training rules not yet available */ }

        if (!ctx.trainingProfile) {
            try {
                const tp = require("../controllers/ai.training-profile.controller");
                ctx.trainingProfile = await tp.getProfileForEngine(ctx.clinicId, { live: ctx.live !== false });
            } catch (_) { /* profile optional */ }
        }

        const availableSlots = await getAvailableSlots(ctx.clinicId, ctx.workingHours);
        const systemPrompt = buildSystemPrompt(ctx, availableSlots, customRules);
        const messages = [
            { role: 'system', content: systemPrompt },
        ];
        // Add conversation history (last 10 messages)
        if (ctx.conversationHistory) {
            const history = ctx.conversationHistory.split('\n').slice(-10);
            history.forEach((line) => {
                if (line.startsWith('Patient: ')) {
                    messages.push({ role: 'user', content: line.replace('Patient: ', '') });
                }
                else if (line.startsWith('AI: ')) {
                    messages.push({ role: 'assistant', content: line.replace('AI: ', '') });
                }
            });
        }
        messages.push({ role: 'user', content: userMessage });
        const modelName = (0, ai_client_1.getAIModel)();
        logger_1.logger.info('AI_REQUEST_START', {
            clinicId: ctx.clinicId,
            model: modelName,
            messageCount: messages.length,
        });
        const completion = await (0, ai_client_1.getAIClient)().chat.completions.create({
            model: modelName,
            messages,
            temperature: 0.45,
            response_format: { type: 'json_object' },
        });
        const raw = completion.choices[0]?.message?.content ?? '{}';
        const parsed = JSON.parse(raw);
        const durationMs = Date.now() - startTime;
        logger_1.logger.info('AI_REPLY_FROM_AI', {
            clinicId: ctx.clinicId,
            model: modelName,
            durationMs,
            action: parsed.action ?? 'none',
            intent: parsed.intent ?? null,
            replyLength: parsed.reply ? parsed.reply.length : 0,
        });
        return {
            reply: parsed.reply ?? `How can ${ctx.clinicName} help — booking, a treatment, or hours?`,
            action: parsed.action ?? 'none',
            confidence: parsed.confidence ?? 0.5,
            appointmentData: parsed.appointmentData,
            intent: parsed.intent ?? 'general',
            leadScore: parsed.leadScore ?? 'cold',
            tags: parsed.tags ?? [],
            treatmentInterest: parsed.treatmentInterest ?? null,
            conversationSummary: parsed.conversationSummary ?? null,
        };
    }
    catch (err) {
        const durationMs = Date.now() - startTime;
        // Expose the full error — the OpenAI SDK surfaces DeepSeek API errors under err.error
        // e.g. { status: 400, error: { type: 'invalid_request_error', message: '...' } }
        logger_1.logger.error('AI_REPLY_FALLBACK', {
            clinicId: ctx.clinicId,
            durationMs,
            errMessage:  err instanceof Error ? err.message : String(err),
            errStatus:   err?.status ?? null,
            errType:     err?.error?.type ?? null,
            errParam:    err?.error?.param ?? null,
            errCode:     err?.error?.code ?? null,
            // Full error for completeness — never includes API key
            errDetail:   err?.error ?? null,
        });
        // Graceful fallback — do NOT leave patient without a response
        return {
            reply: `I could not complete that just now. A ${ctx.clinicName} team member will follow up — or tell me if you want hours, treatments, or to book.`,
            action: 'escalate',
            confidence: 0,
        };
    }
}
/**
 * Generate AI-suggested reply for a given message thread (used in dashboard).
 */
async function generateReplySuggestion(patientName, lastMessages, clinicName) {
    try {
        const completion = await (0, ai_client_1.getAIClient)().chat.completions.create({
            model: (0, ai_client_1.getAIModel)(),
            messages: [
                {
                    role: 'system',
                    content: `You are a medical receptionist for ${clinicName}. Suggest a short, professional reply to the patient's last message. Return only the reply text, nothing else.`,
                },
                { role: 'user', content: `Patient: ${patientName}\n\nConversation:\n${lastMessages}\n\nSuggest a reply:` },
            ],
            max_tokens: 150,
            temperature: 0.4,
        });
        return completion.choices[0]?.message?.content?.trim() ?? '';
    }
    catch {
        return '';
    }
}
//# sourceMappingURL=ai.service.js.map