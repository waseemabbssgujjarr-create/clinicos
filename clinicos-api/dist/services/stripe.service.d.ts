import Stripe from 'stripe';
declare const stripe: Stripe;
export { stripe };
/**
 * Create or retrieve a Stripe Customer for a clinic.
 */
export declare function getOrCreateCustomer(clinicId: string, email: string, name: string): Promise<string>;
/**
 * Create a Stripe Checkout session for a new subscription.
 */
export declare function createCheckoutSession(customerId: string, plan: 'STARTER' | 'PRO' | 'ENTERPRISE', successUrl: string, cancelUrl: string, clinicId: string): Promise<string>;
/**
 * Create a Stripe Customer Portal session (to manage payment method / cancel).
 */
export declare function createPortalSession(customerId: string, returnUrl: string): Promise<string>;
/**
 * Retrieve upcoming invoice for a customer.
 */
export declare function getUpcomingInvoice(customerId: string): Promise<Stripe.UpcomingInvoice | null>;
/**
 * Validate and construct a Stripe webhook event.
 */
export declare function constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event;
/**
 * Get invoices for a customer.
 */
export declare function getCustomerInvoices(customerId: string): Promise<Stripe.Invoice[]>;
/**
 * Get subscription details.
 */
export declare function getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null>;
