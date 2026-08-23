<?php
/**
 * Strip accidental plain-text secrets from HTML output (broken config paste).
 */
declare(strict_types=1);

if (!function_exists('security_sanitize_html_output')) {

/**
 * Temporarily replace form field bodies so secret-stripping regexes cannot erase user data.
 */
function security_protect_form_field_values(string $html): array
{
    $placeholders = [];

    $html = preg_replace_callback(
        '/<textarea\b[^>]*>.*?<\/textarea>/is',
        static function (array $m) use (&$placeholders): string {
            $key = '___FORMFIELD_' . count($placeholders) . '___';
            $placeholders[$key] = $m[0];
            return $key;
        },
        $html
    ) ?? $html;

    $html = preg_replace_callback(
        '/<input\b[^>]*\bvalue=(["\']).*?\1[^>]*>/is',
        static function (array $m) use (&$placeholders): string {
            $key = '___FORMFIELD_' . count($placeholders) . '___';
            $placeholders[$key] = $m[0];
            return $key;
        },
        $html
    ) ?? $html;

    return [$html, $placeholders];
}

function security_restore_form_field_values(string $html, array $placeholders): string
{
    foreach ($placeholders as $key => $original) {
        $html = str_replace($key, $original, $html);
    }

    return $html;
}

function security_sanitize_html_output(string $html): string
{
    if ($html === '') {
        return $html;
    }

    $html = str_replace('eanpGgeqevhhCpcieDEvAoeaEGPAhaXhHNvioejtCIXjGXJLBfOOdCmEFoDijMLX', '', $html);

    [$html, $protected] = security_protect_form_field_values($html);

    // Only scan the start of the document (where paste leaks appear)
    $scanLen = min(strlen($html), 8192);
    $head = substr($html, 0, $scanLen);
    $tail = substr($html, $scanLen);

    $head = preg_replace('/\A[ \t\r\n]*[A-Za-z0-9]{32,}[ \t\r\n]*/i', '', $head) ?? $head;

    $head = preg_replace(
        '/(<body\b[^>]*>)[ \t\r\n]*[A-Za-z0-9]{32,}/i',
        '$1',
        $head,
        1
    ) ?? $head;

    $head = preg_replace(
        '/(?<=>)[ \t\r\n]*[A-Za-z0-9]{32,}[ \t\r\n]*(?=<)/',
        '',
        $head
    ) ?? $head;

    $head = preg_replace('/^[ \t]*[A-Za-z0-9]{32,}[ \t]*(?:\r?\n|$)/im', '', $head) ?? $head;

    $html = security_restore_form_field_values($head . $tail, $protected);

    return $html;
}

function security_start_output_sanitize(): void
{
    if (PHP_SAPI === 'cli') {
        return;
    }

    if (!empty($GLOBALS['_security_output_filter_started'])) {
        return;
    }
    $GLOBALS['_security_output_filter_started'] = true;

    ob_start(static function (string $html): string {
        return security_sanitize_html_output($html);
    });
}

}
