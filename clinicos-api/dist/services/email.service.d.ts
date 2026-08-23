interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
export declare function sendEmail(options: SendEmailOptions): Promise<void>;
export declare function sendWelcomeEmail(to: string, doctorName: string, clinicName: string): Promise<void>;
export declare function sendStaffInviteEmail(to: string, staffName: string, clinicName: string, inviteLink: string): Promise<void>;
export declare function sendPasswordResetEmail(to: string, resetLink: string): Promise<void>;
export declare function sendPaymentFailedEmail(to: string, doctorName: string): Promise<void>;
export declare function sendDailySummaryEmail(to: string, doctorName: string, data: {
    todayCount: number;
    yesterdayMessages: number;
    aiHandled: number;
}): Promise<void>;
export declare function sendTrialExpiryEmail(to: string, doctorName: string, daysLeft: number): Promise<void>;
export {};
