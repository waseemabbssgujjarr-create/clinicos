/**
 * Send appointment confirmation message to patient.
 */
export declare function sendAppointmentConfirmation(appointmentId: string): Promise<void>;
/**
 * Send 24-hour reminder.
 */
export declare function send24hReminder(appointmentId: string): Promise<void>;
/**
 * Send 2-hour reminder.
 */
export declare function send2hReminder(appointmentId: string): Promise<void>;
/**
 * Send Google Review request.
 */
export declare function sendReviewRequest(appointmentId: string): Promise<void>;
