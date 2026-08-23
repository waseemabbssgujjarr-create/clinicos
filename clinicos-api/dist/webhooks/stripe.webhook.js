"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stripe_service_1 = require("../services/stripe.service");
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../lib/logger");
const email_service_1 = require("../services/email.service");
const router = (0, express_1.Router)();
const planFromPriceId = (priceId) => {
    if (priceId === process.env.STRIPE_STARTER_PRICE_ID)
        return 'STARTER';
    if (priceId === process.env.STRIPE_PRO_PRICE_ID)
        return 'PRO';
    if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID)
        return 'ENTERPRISE';
    return null;
};
/**
 * POST /api/webhooks/stripe
 * Handles all Stripe billing events.
 * NOTE: This route needs raw body — configured in app.ts
 */
router.post('/', async (req, res) => {
    const signature = req.headers['stripe-signature'];
    let event;
    try {
        event = (0, stripe_service_1.constructWebhookEvent)(req.body, signature);
    }
    catch (err) {
        logger_1.logger.warn('Invalid Stripe webhook signature', { err });
        res.status(400).send('Webhook signature verification failed');
        return;
    }
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const clinicId = session.metadata?.clinicId;
                const plan = session.metadata?.plan;
                if (!clinicId || !plan)
                    break;
                const subscriptionId = session.subscription;
                const subscription = await (await Promise.resolve().then(() => __importStar(require('../services/stripe.service')))).getSubscription(subscriptionId);
                await prisma_1.prisma.clinic.update({
                    where: { id: clinicId },
                    data: {
                        plan,
                        planStatus: 'ACTIVE',
                        stripeSubId: subscriptionId,
                        stripeCustomerId: session.customer,
                        currentPeriodEnd: subscription?.current_period_end
                            ? new Date(subscription.current_period_end * 1000)
                            : null,
                        trialEndsAt: null,
                    },
                });
                const clinic = await prisma_1.prisma.clinic.findUnique({
                    where: { id: clinicId },
                    select: { email: true, ownerName: true, name: true },
                });
                if (clinic) {
                    await (0, email_service_1.sendWelcomeEmail)(clinic.email, clinic.ownerName, clinic.name).catch(() => null);
                }
                logger_1.logger.info(`Subscription activated for clinic ${clinicId}, plan: ${plan}`);
                break;
            }
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
                const customer = invoice.customer;
                const clinic = await prisma_1.prisma.clinic.findFirst({
                    where: { stripeCustomerId: customer },
                });
                if (!clinic)
                    break;
                // Get updated subscription period
                if (invoice.subscription) {
                    const sub = await (await Promise.resolve().then(() => __importStar(require('../services/stripe.service')))).getSubscription(invoice.subscription);
                    await prisma_1.prisma.clinic.update({
                        where: { id: clinic.id },
                        data: {
                            planStatus: 'ACTIVE',
                            currentPeriodEnd: sub?.current_period_end ? new Date(sub.current_period_end * 1000) : null,
                        },
                    });
                }
                // Log invoice
                await prisma_1.prisma.invoice.upsert({
                    where: { stripeInvoiceId: invoice.id },
                    create: {
                        clinicId: clinic.id,
                        stripeInvoiceId: invoice.id,
                        amount: invoice.amount_paid / 100,
                        currency: invoice.currency,
                        status: 'paid',
                        period: new Date((invoice.period_start ?? 0) * 1000).toISOString().slice(0, 7),
                        pdfUrl: invoice.invoice_pdf ?? null,
                        paidAt: new Date(),
                    },
                    update: { status: 'paid', paidAt: new Date() },
                });
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const customer = invoice.customer;
                const clinic = await prisma_1.prisma.clinic.findFirst({
                    where: { stripeCustomerId: customer },
                    select: { id: true, email: true, ownerName: true },
                });
                if (!clinic)
                    break;
                await prisma_1.prisma.clinic.update({
                    where: { id: clinic.id },
                    data: { planStatus: 'PAST_DUE' },
                });
                await (0, email_service_1.sendPaymentFailedEmail)(clinic.email, clinic.ownerName).catch(() => null);
                logger_1.logger.info(`Payment failed for clinic ${clinic.id}`);
                break;
            }
            case 'customer.subscription.deleted': {
                const sub = event.data.object;
                const clinicId = sub.metadata?.clinicId;
                if (clinicId) {
                    await prisma_1.prisma.clinic.update({
                        where: { id: clinicId },
                        data: { planStatus: 'CANCELLED', plan: 'TRIAL' },
                    });
                }
                break;
            }
            case 'customer.subscription.updated': {
                const sub = event.data.object;
                const clinicId = sub.metadata?.clinicId;
                if (!clinicId)
                    break;
                const priceId = sub.items.data[0]?.price.id;
                const plan = planFromPriceId(priceId ?? '');
                await prisma_1.prisma.clinic.update({
                    where: { id: clinicId },
                    data: {
                        ...(plan && { plan }),
                        planStatus: sub.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
                        currentPeriodEnd: new Date(sub.current_period_end * 1000),
                    },
                });
                break;
            }
            default:
                logger_1.logger.debug(`Unhandled Stripe event: ${event.type}`);
        }
        // Always return 200 to Stripe to prevent retries
        res.json({ received: true });
    }
    catch (err) {
        logger_1.logger.error('Stripe webhook handler error', { eventType: event.type, err });
        // Still return 200 to prevent Stripe from retrying
        res.json({ received: true });
    }
});
exports.default = router;
//# sourceMappingURL=stripe.webhook.js.map