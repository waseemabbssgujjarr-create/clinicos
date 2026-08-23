"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripe = void 0;
exports.getOrCreateCustomer = getOrCreateCustomer;
exports.createCheckoutSession = createCheckoutSession;
exports.createPortalSession = createPortalSession;
exports.getUpcomingInvoice = getUpcomingInvoice;
exports.constructWebhookEvent = constructWebhookEvent;
exports.getCustomerInvoices = getCustomerInvoices;
exports.getSubscription = getSubscription;
const stripe_1 = __importDefault(require("stripe"));
const logger_1 = require("../lib/logger");
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
});
exports.stripe = stripe;
const planPriceMap = {
    STARTER: process.env.STRIPE_STARTER_PRICE_ID ?? '',
    PRO: process.env.STRIPE_PRO_PRICE_ID ?? '',
    ENTERPRISE: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? '',
};
/**
 * Create or retrieve a Stripe Customer for a clinic.
 */
async function getOrCreateCustomer(clinicId, email, name) {
    const customer = await stripe.customers.create({
        email,
        name,
        metadata: { clinicId },
    });
    return customer.id;
}
/**
 * Create a Stripe Checkout session for a new subscription.
 */
async function createCheckoutSession(customerId, plan, successUrl, cancelUrl, clinicId) {
    const priceId = planPriceMap[plan];
    if (!priceId)
        throw new Error(`No price ID configured for plan: ${plan}`);
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { clinicId, plan },
        subscription_data: {
            metadata: { clinicId, plan },
        },
    });
    return session.url;
}
/**
 * Create a Stripe Customer Portal session (to manage payment method / cancel).
 */
async function createPortalSession(customerId, returnUrl) {
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
    });
    return session.url;
}
/**
 * Retrieve upcoming invoice for a customer.
 */
async function getUpcomingInvoice(customerId) {
    try {
        return await stripe.invoices.retrieveUpcoming({ customer: customerId });
    }
    catch {
        return null;
    }
}
/**
 * Validate and construct a Stripe webhook event.
 */
function constructWebhookEvent(payload, signature) {
    return stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
}
/**
 * Get invoices for a customer.
 */
async function getCustomerInvoices(customerId) {
    const invoices = await stripe.invoices.list({
        customer: customerId,
        limit: 20,
    });
    return invoices.data;
}
/**
 * Get subscription details.
 */
async function getSubscription(subscriptionId) {
    try {
        return await stripe.subscriptions.retrieve(subscriptionId);
    }
    catch (err) {
        logger_1.logger.error('Failed to retrieve Stripe subscription', { subscriptionId, err });
        return null;
    }
}
//# sourceMappingURL=stripe.service.js.map