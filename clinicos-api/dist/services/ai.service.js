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
 * Build the AI system prompt with all clinic context injected.
 * customRules: array of { question, answer, category, priority, matchType }
 */
function buildSystemPrompt(ctx, availableSlots, customRules) {
    const personalityDesc = {
        professional: 'polite and professional',
        friendly: 'warm, friendly, and approachable',
        formal: 'formal and precise',
    }[ctx.aiPersonality] ?? 'polite and professional';

    // Build custom rules section — injected between clinic info and patient history
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
        customRulesSection = `\nCUSTOM CLINIC REPLIES (memorise and follow exactly — highest priority):\n${lines.join('\n')}\n`;
    }

    return `You are the AI receptionist and CRM assistant for ${ctx.clinicName}, a ${ctx.specialty || 'medical'} clinic. You work 24/7 like a human front-desk agent — tracking every patient interaction, appointment, and enquiry for the doctor and staff dashboard. Be ${personalityDesc}.

YOUR ROLE (human receptionist + CRM agent):
- Greet patients, answer questions, book/reschedule/cancel appointments
- Capture lead details (name, phone, treatment interest) into the clinic CRM
- Track conversation context so staff see a clear summary in the dashboard
- Know the doctor's schedule, working hours, and clinic policies
- Escalate to human staff with a one-sentence summary when needed

CLINIC INFORMATION:
- Working hours: ${ctx.workingHours}
- Address: ${ctx.address || 'Contact clinic for address'}
- Phone: ${ctx.phone}
${ctx.customIntroMsg ? `- Welcome message: ${ctx.customIntroMsg}` : ''}

AVAILABLE APPOINTMENT SLOTS (next 7 days):
${availableSlots}

TREATMENTS OFFERED:
${ctx.treatments || 'General consultations available'}
${customRulesSection}
PATIENT HISTORY:
${ctx.patientHistory}

YOUR RULES:
1. Be ${personalityDesc} at all times
2. Reply in the SAME language the patient used (English, Arabic, or Urdu — detect and match)
3. For appointment booking: confirm treatment, date, and time BEFORE creating
4. NEVER confirm an appointment for an already-booked time slot
5. NEVER confirm outside working hours or on days the clinic is closed
6. If a patient asks something you cannot handle, say "Let me connect you with the clinic team" and set action to "escalate"
7. Keep replies SHORT (max 3 sentences for simple queries, 5 for booking confirmations)
8. For cancellations: confirm appointment details before cancelling
9. Always end booking confirmations with: "You will receive a reminder before your appointment."
10. Today's date is ${(0, date_fns_1.format)(new Date(), 'EEEE, MMMM d, yyyy')}
11. Always tag leads accurately for the CRM pipeline (New Patient, Returning, Urgent, Booking, Price Enquiry)
12. In conversationSummary, note what the doctor/staff should do next (e.g. "Patient wants Botox consult Thu 3pm — confirm slot")
13. HEALTHCARE SAFETY: Never diagnose or prescribe in chat. For chest pain, severe bleeding, breathing difficulty, or emergencies — tell patient to call emergency services immediately and set action to "escalate"
14. Sound like a real human receptionist — use the patient's name when known, warm confirmations, never mention "AI" or "bot"
15. CUSTOM REPLIES: If a patient's message matches a CUSTOM CLINIC REPLY above, use that exact answer — do not improvise a different answer.

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
            temperature: 0.3,
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
            reply: parsed.reply ?? "I'm here to help! Could you please repeat your message?",
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
            reply: `Thank you for contacting ${ctx.clinicName}. Our team will get back to you shortly.`,
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