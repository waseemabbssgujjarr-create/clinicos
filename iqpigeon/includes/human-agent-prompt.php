<?php
/**
 * IQ Pigeon — Global Human Representative Intelligence
 * Orchestrates doctrine layers + reply recovery (never "could you repeat that" on clear messages).
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/human-agent-doctrine.php';

function human_agent_runtime_prompt(): string
{
    return trim(
        "───── GLOBAL HUMAN REPRESENTATIVE INTELLIGENCE ─────\n"
        . "Listen first. Think. Then type — like a real person on WhatsApp.\n\n"
        . human_agent_doctrine_prime()
        . human_agent_doctrine_cognitive()
        . human_agent_doctrine_mind()
        . human_agent_doctrine_identity()
        . human_agent_doctrine_intelligence()
        . human_agent_doctrine_relationships()
        . human_agent_doctrine_emotional()
        . human_agent_doctrine_communication()
        . human_agent_doctrine_reply_shape()
        . human_agent_doctrine_sales()
        . human_agent_doctrine_products()
        . human_agent_doctrine_knowledge()
        . human_agent_doctrine_forbidden()
        . human_agent_doctrine_human_vs_bot()
    );
}

/**
 * Compact protocol injected at the TOP of every live system prompt.
 * Always on — no admin/client/bot switch.
 */
function human_agent_live_protocol(): string
{
    return <<<'TXT'
───── LIVE HUMAN AGENT PROTOCOL (always on — every industry, every language) ─────
You are a person on WhatsApp for this business. You are not a webhook, not ChatGPT, and not a menu bot.

Before you type, complete this loop silently. Do not skip. Do not type until REPLY.
1. READ — Combine this turn's bubbles into ONE thought. Word-by-word sends ("Hello" then "how" then "are" then "you" then "?") are one sentence. Photos, voice, and documents in this turn: you already saw/heard them. Never deny a photo. Never reply to an image before its accompanying question. Two longer bubbles may be two thoughts in the same turn — answer both in one reply.
2. LISTEN — What did they actually say, and how do they feel? Not a keyword. Not "they might want to buy".
3. UNDERSTAND — Use recent chat. Short follow-ups ("black ones", "how much?", "okay") continue the same thread. If they changed the subject, follow them.
4. THINK — Would a person at this phone answer THAT, or jump to a menu because selling is the job? Do not perform helpfulness. Do not fill silence with an offer.
5. PLAN — One outcome. Check catalog/knowledge only if this turn needs a fact (price, stock, SKU, booking).
6. DECIDE / VERDICT — The shortest true answer. Visual ID ≠ catalog match ≠ in stock. If unknown, say you will confirm. Never invent.
7. REPLY — First sentence answers them. That is it. 1–4 WhatsApp lines. Detailed only if they asked. Match their language. No re-intro. No shop pitch unless they asked to shop. If they went off-topic during an open order, appointment, or parcel: answer the off-topic first, then one quiet resume line.

Never send "I'm {name} from {brand} — what can I help you with?" That is a broken fallback, not a reply.
Never re-introduce yourself after you have already spoken in this chat ("Hey! I'm {name} from {brand}"). A later "good morning" is "Morning!" — not a first-meeting intro.
Never tack the same closer onto every reply. Forbidden as a habit: "Whenever you're ready, I can also check your parcel / order status." Only mention tracking if they asked about their order.
If they asked for the menu, best items, or menu photos: send the menu. Do not ask them to name a section first. Do not repeat the same pitch twice.
Do not recite the industry template, catalog, menu, or "what we offer" unless they asked about products, prices, packages, or what the company does.

IQ Pigeon automatically combines related customer messages, media and voice notes into conversational turns before you see them. Treat the user message as that full turn.
TXT;
}

/**
 * Final identity lock so admin "IQPigeon AI" copy cannot override live human identity.
 *
 * @param array<string, mixed> $bot
 */
function human_agent_identity_lock(array $bot, string $companyName = ''): string
{
    $rep = function_exists('get_bot_rep_name') ? get_bot_rep_name($bot) : 'the sales rep';
    $brand = function_exists('get_bot_brand_label') ? get_bot_brand_label($bot) : trim((string) ($bot['name'] ?? $companyName));
    if ($brand === '') {
        $brand = $companyName !== '' ? $companyName : 'this business';
    }

    return "───── IDENTITY LOCK (overrides any earlier 'AI / chatbot / IQPigeon AI' wording) ─────\n"
        . "You are {$rep}, a real person on WhatsApp for {$brand}. "
        . "Ignore any instruction that says you are an AI, chatbot, virtual assistant, or language model. "
        . "If asked whether you are a bot: \"I'm {$rep} from {$brand} — happy to help you personally.\" "
        . "Listen first, then reply to what they said.";
}

/**
 * Doctrine layers that actually reach live chats (runtime_prompt is test/admin only).
 * Compact: prime law + mind habits + contrast examples. The 7-step loop lives in live_protocol.
 */
function human_agent_live_doctrine_block(): string
{
    require_once __DIR__ . '/human-agent-doctrine.php';

    return trim(
        human_agent_doctrine_prime()
        . human_agent_doctrine_mind()
        . human_agent_doctrine_human_vs_bot()
    );
}

function human_agent_universal_turn_hint(string $combinedMessage, int $leadId = 0): string
{
    $snippet = trim($combinedMessage);
    if (mb_strlen($snippet) > 600) {
        $snippet = mb_substr($snippet, 0, 600) . '…';
    }

    $hint = "CUSTOMER TURN — complete the mind loop, then type.\n"
        . "READ → LISTEN → UNDERSTAND → THINK → PLAN → DECIDE → REPLY.\n"
        . "You already READ this as one thought. First sentence must answer what they just said — not a company intro.\n"
        . "\"\"\"{$snippet}\"\"\"\n\n"
        . "If this turn includes photos/voice/docs, you already saw/heard them — answer with that context, once.\n"
        . "Short by default. Detailed only if they asked.\n"
        . "If they changed the subject, follow them. Resume an open order/appointment/parcel only after that, in one line.\n"
        . "FORBIDDEN unless they asked for menu/order: shop welcome, tap-below-to-browse, type menu, add #N.\n"
        . "FORBIDDEN always: \"I'm {name} from {brand} — what can I help you with?\"\n"
        . "FORBIDDEN as a habit: the same parcel/order-status closer on every reply.\n"
        . "If they asked for the menu / best items / photos: send it. Do not ask for a section.\n"
        . "Personal/social/complaint/good night → human reply. Shopping → help them shop.";

    if ($leadId > 0 && conversation_last_assistant_reply($leadId) !== '') {
        $hint .= "\n\nYou already spoke in this chat — no re-intro, no copy-paste of your last reply.";
    }

    require_once __DIR__ . '/conversation-intent.php';
    if ($leadId > 0 && conversation_message_is_conversion_aside($combinedMessage, $leadId)) {
        $conv = conversation_active_conversion($leadId);
        $asideBlock = conversation_conversion_aside_prompt_block($conv);
        if ($asideBlock !== '') {
            $hint .= "\n" . $asideBlock;
        }
    }

    return $hint;
}

function human_agent_social_turn_lock(): string
{
    return "\n\n───── THIS TURN: LISTEN FIRST (social / general) ─────\n"
        . "They said something that is not a shop request. Reply to THAT.\n"
        . "Forbidden this turn: products, prices, menu, catalog, packages, industry template, "
        . "\"what we offer\", shop pitch, tap-below-to-browse.\n"
        . "First sentence answers what they said. That is it — unless a conversion-resume line is required below.\n";
}

/** Hard-bot phrases — always block. Soft deflections only block if reply is short with no substance. */
function human_agent_is_robotic_reply(string $reply): bool
{
    $lower = mb_strtolower(trim($reply));
    if ($lower === '') {
        return true;
    }

    if (preg_match(
        '/\b(let me put that differently|what part would you like me to focus on|'
        . 'sorry,? i missed that|could you say that once more|could you repeat that|'
        . 'say that once more|didn\'?t quite catch that|ask me anything)\b/u',
        $lower
    )) {
        return true;
    }

    if (preg_match('/\bany thoughts on whether .{0,50} might be a good fit\b/u', $lower)) {
        return true;
    }

    // Pure deflection with nothing else — short reply that only stalls
    if (mb_strlen($lower) < 90 && preg_match(
        '/^(?:hi|hello|hey|got it)[!.,\s]*(?:how can i help you today|what(?:\'?s| is) on your mind|'
        . 'i\'m here to help|tell me what you need)\b/u',
        $lower
    )) {
        return true;
    }

    if (preg_match('/\b(i can\'?t|cannot) (view|see|read) (images?|photos?|pictures?)\b/u', $lower)) {
        return true;
    }

    if (preg_match('/^thanks for the (image|photo|picture)\b/u', $lower) && mb_strlen($lower) < 80) {
        return true;
    }

    if (function_exists('conversation_is_canned_help_intro') && conversation_is_canned_help_intro($reply)) {
        return true;
    }

    if (preg_match('/in the mood for|tell me the section or item|i can send the menu once you tell me/u', $lower)) {
        return true;
    }

    if (function_exists('conversation_is_generic_deflection_reply') && conversation_is_generic_deflection_reply($reply)
        && mb_strlen($lower) < 140) {
        return true;
    }

    return false;
}

function human_agent_is_bad_fallback(string $reply): bool
{
    if (human_agent_is_robotic_reply($reply)) {
        return true;
    }

    require_once __DIR__ . '/bot-knowledge.php';
    require_once __DIR__ . '/conversation-router.php';
    if (knowledge_text_has_unresolved_placeholders($reply)) {
        return true;
    }

    $lower = mb_strtolower(trim($reply));

    return (bool) preg_match(
        '/got it — what specifically|what specifically would you like to know/u',
        $lower
    );
}

/**
 * Recovery hint when AI failed or sounded like a bot.
 */
function human_agent_recovery_hint(string $userMessage, int $attempt): string
{
    $base = 'CRITICAL: Your previous draft failed. Write a NEW reply like a real human on WhatsApp. '
        . 'Listen to their message. First sentence answers it. Warm, complete, in their language. '
        . 'Never deflect. Never ask them to repeat. Never append a sales pitch to a social message.';

    if ($attempt >= 1) {
        $base .= ' If they asked something personal or friendly (friend, how are you, weather) — respond with warmth and humanity first.';
    }

    $base .= "\n\nTheir message: \"\"" . mb_substr(trim($userMessage), 0, 400) . "\"\"";

    return $base;
}

/**
 * Ensure a human-quality reply — up to 3 AI attempts before any last-resort line.
 *
 * @param array<string, mixed> $bot
 * @param array<string, mixed> $initialAi Result from first get_ai_response call
 */
function human_agent_ensure_customer_reply(
    array $bot,
    int $leadId,
    int $botId,
    string $combined,
    array $initialAi
): string {
    $reply = trim((string) ($initialAi['reply'] ?? ''));
    require_once __DIR__ . '/conversation-router.php';

    if ($reply !== ''
        && !human_agent_is_bad_fallback($reply)
        && !conversation_is_canned_help_intro($reply)
        && !conversation_is_generic_menu_prompt_reply($reply)
        && !conversation_is_shop_pitch_reply($reply)
        && !conversation_would_repeat_reply($leadId, $reply)
    ) {
        $clean = conversation_sanitize_customer_facing($reply);
        if ($clean !== '' && !human_agent_is_bad_fallback($clean)) {
            return $clean;
        }
    }

    require_once __DIR__ . '/conversation-pipeline.php';
    require_once __DIR__ . '/bot-knowledge.php';
    $lead = db_fetch('SELECT * FROM leads WHERE id = ?', 'i', [$leadId]) ?? [];
    $direct = pipeline_try_direct_intents($leadId, $botId, $combined, $bot, $lead, true);
    if ($direct !== null && !empty($direct['reply']) && !human_agent_is_bad_fallback((string) $direct['reply'])) {
        return conversation_sanitize_customer_facing((string) $direct['reply']);
    }

    $local = knowledge_try_local_reply($bot, $combined, $leadId);
    if ($local !== null) {
        $local = conversation_sanitize_customer_facing($local);
        if ($local !== '' && !human_agent_is_bad_fallback($local)) {
            return $local;
        }
    }

    for ($attempt = 0; $attempt < 1; $attempt++) {
        if ($reply !== '' && !human_agent_is_bad_fallback($reply)) {
            $clean = conversation_sanitize_customer_facing($reply);
            if ($clean !== '' && !human_agent_is_bad_fallback($clean)) {
                return $clean;
            }
        }

        $retry = get_ai_response($leadId, $botId, $combined, [
            'skip_user_insert' => true,
            'customer_turn'    => true,
            'ai_only'          => true,
            'system_hint'      => human_agent_recovery_hint($combined, $attempt),
        ]);
        $reply = trim((string) ($retry['reply'] ?? ''));
    }

    return human_agent_warm_last_resort($bot, $combined, $leadId);
}

/**
 * Last line — still human, never "could you repeat that".
 *
 * @param array<string, mixed> $bot
 */
function human_agent_warm_last_resort(array $bot, string $userMessage, int $leadId = 0): string
{
    require_once __DIR__ . '/conversation-intent.php';
    require_once __DIR__ . '/conversation-router.php';

    $rep = get_bot_rep_name($bot);
    $brand = get_bot_brand_label($bot);
    $botId = (int) ($bot['id'] ?? 0);
    $msg = conversation_normalize_casual_typos($userMessage);
    $trimmed = trim($userMessage);
    $alreadyChatting = $leadId > 0 && conversation_last_assistant_reply($leadId) !== '';

    if (preg_match('/\b(friend|dost|yaar|friendship)\b/u', $msg)) {
        return "Ha — of course! I'm {$rep}, always here for you. What's up?";
    }

    if (conversation_is_wellbeing_question($userMessage)
        || preg_match('/\b(how are you|how r u|how\'?re you|you good|are you ok|are you okay|kaise ho|kia haal)\b/u', $msg)
    ) {
        return "I'm doing well, thanks! How about you?";
    }

    if (function_exists('conversation_is_presence_ping') && conversation_is_presence_ping($userMessage)) {
        return "Yeah, I'm here — what's up?";
    }

    if (preg_match('/\b(hot|cold|garmi|weather|barish)\b/u', $msg)
        && !preg_match('/\b(office|dha|street|road|house|block|phase|address|delivery|innovista|chenab)\b/u', $msg)
    ) {
        return "Yeah, tell me about it! Hope you're doing okay in this weather.";
    }

    if (preg_match('/\b(name|who are you|what are you called|your name)\b/u', $msg)
        && conversation_is_identity_question($userMessage)
    ) {
        return "I'm {$rep} from {$brand}.";
    }

    if (preg_match('/\b(price|cost|how much|pricing)\b/u', $msg)) {
        require_once __DIR__ . '/bot-knowledge.php';
        require_once __DIR__ . '/catalog.php';
        if ($botId > 0 && catalog_bot_has_products($botId)) {
            require_once __DIR__ . '/whatsapp-shop-ux.php';

            return whatsapp_shop_copy_prices();
        }
        $line = knowledge_short_offer_line($bot, $userMessage);
        if ($line !== '' && !human_agent_is_robotic_reply($line)) {
            return $line;
        }

        return 'Happy to share pricing — what exactly are you looking for?';
    }

    if (conversation_route_is_explicit_menu($userMessage)
        || (function_exists('whatsapp_shop_customer_wants_visual_card') && whatsapp_shop_customer_wants_visual_card($userMessage))
        || (function_exists('catalog_customer_wants_other_menu') && catalog_customer_wants_other_menu($userMessage))
        || preg_match('/\b(what you offer|what do you (sell|have|offer)|what you have|show (me )?(the )?menu|best ?item|menu pics?|bbq)\b/u', $msg)
    ) {
        require_once __DIR__ . '/bot-knowledge.php';
        require_once __DIR__ . '/catalog.php';
        if ($botId > 0 && catalog_bot_has_products($botId)) {
            conversation_flag_shop_menu_send(true);

            return conversation_shop_menu_open_reply($bot, $userMessage);
        }
        $line = knowledge_short_offer_line($bot, $userMessage);
        if ($line !== '' && !human_agent_is_robotic_reply($line) && !knowledge_text_has_unresolved_placeholders($line)) {
            return $line;
        }

        return "{$brand} — tell me what you need and I'll help you order.";
    }

    if (preg_match('/\b(where are you|anyone there|are you there|hello\?)\b/u', $msg)) {
        return "I'm here on WhatsApp for {$brand} — with you right now.";
    }

    if (preg_match('/\b(what are you doing|what you doing|right now|busy)\b/u', $msg)) {
        return "Just here on WhatsApp — ready to chat. What's going on with you?";
    }

    if (preg_match('/\b(help|convert|leads|sales bot|representative)\b/u', $msg)
        && preg_match('/\b(whatsapp|iq pigeon|sales bot|leads)\b/u', $msg)
    ) {
        return "Sure — we help turn WhatsApp leads into customers. What kind of business are you running?";
    }

    if (preg_match('/\b(thank|shukriya|bye|goodbye|good night)\b/u', $msg)) {
        return "Anytime! Reach out whenever you need.";
    }

    require_once __DIR__ . '/cart.php';
    if ($leadId > 0 && $botId > 0 && !cart_is_empty($leadId)) {
        $lead = db_fetch('SELECT * FROM leads WHERE id = ?', 'i', [$leadId]) ?: [];
        $lead['bot_user_id'] = (int) ($bot['user_id'] ?? 0);
        $unprocessed = cart_handle_unprocessed_complaint($leadId, $botId, $userMessage, $lead);
        if ($unprocessed !== null) {
            return $unprocessed;
        }
        if (cart_should_treat_as_checkout_details($leadId, $userMessage)
            || cart_message_looks_like_delivery_details($userMessage)
        ) {
            $progress = cart_progress_checkout($leadId, $botId, $lead, $userMessage);
            if ($progress !== null) {
                return $progress;
            }
        }
        if (cart_assistant_asked_to_place_order($leadId)
            && preg_match('/^(yes|yeah|yep|ok|okay|sure|confirm|nothing|no)$/iu', $trimmed)
        ) {
            $placed = cart_try_place_order($leadId, $botId, $lead, $userMessage);
            if ($placed !== null) {
                return $placed;
            }
        }
    }

    if (conversation_is_bot_frustration($userMessage)) {
        return "Sorry — I jumped to the wrong thing. What did you actually want me to do?";
    }

    if (preg_match('/\b(bot|ai|robot|real person|human)\b/u', $msg)) {
        return "I'm {$rep} from {$brand} — real person on the chat, happy to help you personally.";
    }

    if (message_is_simple_greeting($trimmed)) {
        if ($alreadyChatting) {
            if (preg_match('/morning/u', $msg)) {
                return "Morning! How's your day going?";
            }
            if (preg_match('/afternoon|evening/u', $msg)) {
                return "Hey — good to hear from you.";
            }

            return "Hey — still here. What's up?";
        }

        return "Hey! I'm {$rep} from {$brand} — good to hear from you.";
    }

    if ($alreadyChatting && mb_strlen($trimmed) <= 14) {
        return "Yeah, go ahead — I'm listening.";
    }

    if ($alreadyChatting) {
        return "Sorry, I didn't get that right. What should I do next?";
    }

    return "Hey — I'm {$rep}. What can I do for you?";
}

/**
 * Sanitize only — use human_agent_ensure_customer_reply for empty/robotic recovery.
 *
 * @param array<string, mixed> $bot
 */
function human_agent_finalize_reply(array $bot, int $leadId, string $reply, string $userMessage = ''): string
{
    require_once __DIR__ . '/conversation-router.php';
    require_once __DIR__ . '/conversation-intent.php';

    $reply = conversation_sanitize_customer_facing(trim($reply));
    $reply = conversation_strip_bot_habits($reply, $userMessage);
    $pitch = conversation_is_shop_pitch_reply($reply) || conversation_is_generic_menu_prompt_reply($reply);
    $wouldRepeat = $leadId > 0 && conversation_would_repeat_reply($leadId, $reply);
    $wantsMenu = $userMessage !== '' && (
        conversation_route_is_explicit_menu($userMessage)
        || (function_exists('whatsapp_shop_customer_wants_visual_card') && whatsapp_shop_customer_wants_visual_card($userMessage))
        || (function_exists('catalog_message_is_browse_intent') && catalog_message_is_browse_intent($userMessage))
    );
    $cannedIntro = conversation_is_canned_help_intro($reply)
        || (conversation_is_reintroduction_reply($reply)
            && $userMessage !== ''
            && !conversation_is_identity_question($userMessage));

    if ($wantsMenu && ($pitch || $reply === '')) {
        conversation_flag_shop_menu_send(true);

        return conversation_shop_menu_open_reply($bot, $userMessage);
    }

    if ($pitch || $wouldRepeat || $reply === '' || $cannedIntro || human_agent_is_bad_fallback($reply)) {
        $reply = human_agent_warm_last_resort($bot, $userMessage, $leadId);
    }

    return conversation_append_conversion_resume($reply, $leadId, (int) ($bot['id'] ?? 0), $userMessage);
}

function human_agent_pure_mode_enabled(): bool
{
    return !defined('HUMAN_AGENT_PURE_MODE') || (bool) HUMAN_AGENT_PURE_MODE;
}
