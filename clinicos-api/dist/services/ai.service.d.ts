export interface AIResponse {
    reply: string;
    action: 'book_appointment' | 'cancel' | 'reschedule' | 'answer_faq' | 'escalate' | 'none';
    confidence: number;
    appointmentData?: {
        treatment: string | null;
        requestedDateTime: string | null;
        notes: string | null;
    };
}
interface ClinicContext {
    clinicId: string;
    clinicName: string;
    specialty: string;
    workingHours: string;
    address: string;
    phone: string;
    treatments: string;
    patientPhone: string;
    patientHistory: string;
    conversationHistory: string;
    aiLanguage: string;
    aiPersonality: string;
    customIntroMsg?: string;
}
/**
 * Main AI processing function.
 * Takes inbound patient message and returns structured AI response.
 */
export declare function processInboundMessage(ctx: ClinicContext, userMessage: string): Promise<AIResponse>;
/**
 * Generate AI-suggested reply for a given message thread (used in dashboard).
 */
export declare function generateReplySuggestion(patientName: string, lastMessages: string, clinicName: string): Promise<string>;
export {};
