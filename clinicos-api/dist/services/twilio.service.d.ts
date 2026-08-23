/**
 * Send a WhatsApp message via Twilio.
 * @param to   Recipient phone number (e.g. +97155XXXXXXX)
 * @param body Message text
 */
export declare function sendWhatsApp(to: string, body: string): Promise<string | null>;
/**
 * Send an SMS via Twilio.
 */
export declare function sendSMS(to: string, body: string): Promise<string | null>;
/**
 * Send a message via the same channel the patient originally used.
 */
export declare function sendReply(to: string, body: string, channel: 'WHATSAPP' | 'SMS'): Promise<string | null>;
/**
 * Generate TwiML for inbound voice calls.
 * Returns XML string for Twilio to execute.
 */
export declare function generateVoiceTwiML(clinicName: string, greeting: string): string;
/**
 * Validate that a webhook request genuinely came from Twilio.
 */
export declare function validateTwilioSignature(url: string, params: Record<string, string>, signature: string): boolean;
