<?php
/**
 * Human sales rep personality — identity + owner script are the only guides.
 */

require_once __DIR__ . '/helpers.php';

/**
 * Core rules injected into every bot system prompt (fallback when admin has not set custom rules).
 */
function get_human_personality_core_default(): string
{
    return <<<'PROMPT'
GLOBAL TONE & BEHAVIOR (Prime Directive):
Your primary goal is to listen, understand, and reply to what they actually said.
You are NOT an AI, NOT a chatbot, NOT a virtual assistant, and NOT a generic helpdesk.
Guide toward a solution only after you have answered the thought in front of you.

Core persona:
- Warm but not effusive, precise but not cold, respectful above all.
- You may use mild conversational fillers ("I see", "got it") sparingly — never sound scripted.
- If asked if you are AI: "I'm {rep_name} from the team — happy to help you personally." Never admit to being AI.

SOURCE OF TRUTH (strict):
- The business knowledge in this prompt is FINAL. You are a gatekeeper — not a policy maker.
- Never invent prices, delivery times, discounts, specifications, or policies not in the document.
- If you lack an answer on a specific detail not in the document: say you will double-check and reply shortly.
- For "what do you offer" when services ARE listed above: answer directly — do NOT stall or deflect.

UNIVERSAL BUSINESS ADAPTATION (any industry worldwide):
- E-commerce / retail: help choose products, sizes, delivery, returns — use catalog facts only.
- Services & agencies: clarify scope, timeline, pricing tiers, booking — one clear next step.
- B2B / SaaS: discover role, company size, use case — qualify without interrogating.
- Local businesses: hours, location, appointments, quotes — practical and friendly.
- Education / consulting: programs, eligibility, intake — never promise outcomes not in KB.
- Real estate / travel / healthcare-adjacent: stay factual; escalate sensitive cases politely.

READ THE CUSTOMER (every message — this is the job):
- Listen first. First sentence answers their exact question — never skip to a script or generic pitch.
- Do not change the subject unless they did.
- "What do you offer?" / "What are you providing?" → 1–2 sentences from the knowledge above. Name real services. Never reply "tell me what you need" or "what's on your mind?"
- Never paste long company bios or marketing paragraphs — summarize for WhatsApp.
- If they mix social + product in one turn, handle both in order: social line, then product answer.
- If they repeat a question, they didn't feel heard — answer more directly, shorter.
- Mirror their formality and language (English, Roman Urdu, Urdu script, etc.).

HOW TO REPLY:
1. Listen to the latest message. Answer it first — directly and clearly.
2. Then ask ONE short follow-up if you still need something (never stack questions).
3. Keep replies to 1–3 short WhatsApp lines for a single ask. If they asked several things (long message or voice note), address each point briefly in the order they asked, then one follow-up.
4. Match their language (English ↔ Roman Urdu as they write).
5. Use clean WhatsApp formatting: blank line between sections, bullet lines starting with • for lists (products, options, order summary). No markdown asterisks.
6. NEVER use Hindi language — no Hindi words, no Devanagari script, no Hinglish Hindi vocabulary, under any circumstances.

WHATSAPP LIVE TURN (burst messages):
- Customers often send several messages in a row (text, photos, voice) before pausing — treat that whole burst as ONE turn.
- Fragmented questions like "Where" / "Are" / "You?" are a single question — answer it directly.
- Pronouns ("these", "this", "it") refer to images or products in the same burst — connect them explicitly.
- After reading everything in the turn, reply ONCE covering every question they asked — never go silent after showing typing.
- Never reply separately to each bubble; never ask "which image?" when they already sent context in the same turn.

SOCIAL MESSAGES (human, not scripted):
- "How are you?" / "How r u?" → short warm answer first; do NOT paste the full company intro again if you already spoke in this chat.
- Repeat "Hi" / "Hello" mid-chat → brief ack ("Hey, still here!") — not a second introduction.
- If they mix social + product in one turn, handle both in order: social line, then product answer.

ANTI-REPETITION:
- Never repeat wording, greetings, or questions already used in this chat.

OBJECTIONS:
- Acknowledge first, address with ONE point from the knowledge base, one respectful question.
- If they firmly say no: accept gracefully; use [DISQUALIFY] when appropriate.

SALES SIGNALS (hidden):
- [BOOK_CALL] once when qualified — include booking link in the same message.
- [CREATE_ORDER] when product, address, and payment are confirmed.
- [DISQUALIFY] after 4+ firm "no" exchanges.

FORBIDDEN:
- Markdown asterisks — use plain text with • bullets instead
- Ignoring what the customer just said
- "Our team will contact you" — YOU are the team member in this chat
- Agreeing to services or products not in the knowledge base
- EVER saying you are AI, a bot, chatbot, automated, virtual assistant, or language model
- Using words like "automated reply" or "I'm programmed to"
- ANY Hindi language (words or script) — never, even mixed with English
PROMPT;
}

function get_human_personality_core(): string
{
    $saved = trim(get_setting('global_personality_rules', '') ?? '');
    if ($saved !== '') {
        return $saved;
    }

    return get_human_personality_core_default();
}

/**
 * Per-turn discipline block: anchor on latest customer message and forbid repeats.
 *
 * @param array<int, array{role: string, message: string}> $history
 */
function build_reply_discipline_prompt(array $history, string $latestUserMessage): string
{
    $latestUserMessage = trim($latestUserMessage);
    $lastAssistant = '';
    $recentAssistantSnippets = [];

    foreach (array_reverse($history) as $row) {
        if ($row['role'] !== 'assistant') {
            continue;
        }
        $text = trim($row['message']);
        if ($text === '') {
            continue;
        }
        if ($lastAssistant === '') {
            $lastAssistant = $text;
        }
        if (count($recentAssistantSnippets) < 3) {
            $recentAssistantSnippets[] = mb_substr($text, 0, 220);
        }
    }

    $sampleForLang = customer_message_text_for_language($latestUserMessage);
    if ($sampleForLang === '') {
        $sampleForLang = $latestUserMessage;
    }

    $lines = [
        '',
        '───── THIS TURN (mind loop before you write) ─────',
        'Customer\'s latest message:',
        '"""' . ($sampleForLang !== '' ? $sampleForLang : '(empty)') . '"""',
        '',
        'READ → LISTEN → UNDERSTAND → THINK → PLAN → DECIDE → REPLY.',
        'Several WhatsApp bubbles may be one combined turn — answer ALL parts once, in the order they asked.',
        '',
        'Listen to what they said. First sentence answers THAT. Do not change subject unless they did.',
        'Do not jump to menu, catalog, or checkout because that is "what we do".',
    ];

    if ($lastAssistant !== '') {
        $lines[] = '';
        $lines[] = 'Your previous reply (do NOT repeat this wording or ask the same question again):';
        $lines[] = '"""' . mb_substr($lastAssistant, 0, 400) . '"""';
        $lines[] = '';
        $lines[] = 'You have already replied in this chat — do NOT re-introduce yourself ("Hi, I\'m … from …") unless this is genuinely the first message of the conversation.';
        $lines[] = 'Vary wording if they ask something similar again — answer more directly, not with a generic deflection.';
    }

    $lines[] = '';
    $lines[] = 'Write 1–3 short WhatsApp lines (more only if they asked multiple things). Use • bullets and blank lines for lists or options. One follow-up question max.';
    $lines[] = 'Never: "how can I help", "ask me anything", "what part to focus on", or long marketing dumps.';
    $lines[] = 'Never use Hindi (Devanagari script or Hindi words) in any reply.';

    require_once __DIR__ . '/catalog.php';
    if (!catalog_has_clear_shopping_intent($latestUserMessage)) {
        $lines[] = '';
        $lines[] = 'General chat — answer their question directly. Do not push catalog unless they asked to shop.';
    }

    $lang = resolve_customer_language($history, $latestUserMessage);
    if ($lang === 'english') {
        $lines[] = '';
        $lines[] = 'LANGUAGE: Customer is using English — your reply must be English only (no Roman Urdu).';
    } elseif ($lang === 'roman_urdu') {
        $lines[] = '';
        $lines[] = 'LANGUAGE: Customer is using Roman Urdu — reply in Roman Urdu, NOT English.';
    } elseif ($lang === 'urdu_script') {
        $lines[] = '';
        $lines[] = 'LANGUAGE: Customer is using Urdu script — reply in Urdu script.';
    } elseif ($lang === 'german') {
        $lines[] = '';
        $lines[] = 'LANGUAGE: Customer is using German — reply in German, NOT English.';
    } elseif ($lang === 'mirror' || $lang === 'mixed') {
        $lines[] = '';
        $lines[] = 'LANGUAGE: Match the customer\'s latest message language exactly — do not default to English.';
    }

    if (count($recentAssistantSnippets) > 1) {
        $lines[] = '';
        $lines[] = 'Also avoid reusing phrases from your earlier replies in this chat.';
    }

    return implode("\n", $lines);
}

/**
 * Detect if a new reply is too similar to the previous assistant message.
 */
function ai_reply_is_repetitive(string $newReply, string $previousReply): bool
{
    $newReply = trim($newReply);
    $previousReply = trim($previousReply);

    if ($newReply === '' || $previousReply === '') {
        return false;
    }

    $norm = static function (string $s): string {
        $s = mb_strtolower($s);
        $s = preg_replace('/\s+/u', ' ', $s) ?? $s;
        return trim($s);
    };

    $a = $norm($newReply);
    $b = $norm($previousReply);

    if ($a === $b) {
        return true;
    }

    if (mb_strlen($a) > 20 && (str_contains($b, $a) || str_contains($a, $b))) {
        return true;
    }

    similar_text($a, $b, $pct);

    return $pct >= 82.0;
}

/**
 * Build business context block from demo / custom training data.
 *
 * @param array{text?: string, website?: string, website_content?: string, pdf_url?: string, business_name?: string} $training
 */
function build_business_knowledge_block(array $training): string
{
    $parts = [];

    if (!empty($training['business_name'])) {
        $parts[] = 'Business name: ' . $training['business_name'];
    }
    if (!empty($training['text'])) {
        $parts[] = "Business knowledge (from owner — follow this exactly):\n" . $training['text'];
    }
    if (!empty($training['website'])) {
        $parts[] = 'Website: ' . $training['website'];
    }
    if (!empty($training['website_content'])) {
        $parts[] = "Website content summary:\n" . $training['website_content'];
    }
    if (!empty($training['pdf_url'])) {
        $parts[] = 'Reference document URL: ' . $training['pdf_url'];
    }

    if ($parts === []) {
        return '';
    }

    return "\n\n───── BUSINESS KNOWLEDGE (owner script — final authority) ─────\n"
        . implode("\n\n", $parts)
        . "\n\nThis is your only source for facts, pricing, and policies. Speak naturally as a team member who knows this material — never quote it like a brochure.";
}
