"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openPortal = exports.createCheckout = exports.getInvoices = exports.getSubscriptionInfo = void 0;
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const stripe_service_1 = require("../services/stripe.service");
// GET /api/billing/subscription
exports.getSubscriptionInfo = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: {
            plan: true, planStatus: true, stripeCustomerId: true, stripeSubId: true,
            currentPeriodEnd: true, trialEndsAt: true,
        },
    });
    if (!clinic)
        throw (0, error_middleware_1.createError)('Clinic not found', 404, 'NOT_FOUND');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stripeSubscription = null;
    if (clinic.stripeSubId) {
        stripeSubscription = await (0, stripe_service_1.getSubscription)(clinic.stripeSubId);
    }
    const planDetails = {
        TRIAL: { name: 'Free Trial', price: 0, staff: 0, patients: 50, aiMessages: 100 },
        STARTER: { name: 'Starter', price: 29, staff: 1, patients: 500, aiMessages: 1000 },
        PRO: { name: 'Pro', price: 59, staff: 3, patients: 2000, aiMessages: 5000 },
        ENTERPRISE: { name: 'Enterprise', price: 99, staff: 10, patients: -1, aiMessages: -1 },
    };
    res.json({
        plan: clinic.plan,
        planStatus: clinic.planStatus,
        planDetails: planDetails[clinic.plan],
        currentPeriodEnd: clinic.currentPeriodEnd,
        trialEndsAt: clinic.trialEndsAt,
        paymentMethod: stripeSubscription?.default_payment_method ?? null,
    });
});
// GET /api/billing/invoices
exports.getInvoices = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: { stripeCustomerId: true },
    });
    if (!clinic?.stripeCustomerId) {
        res.json([]);
        return;
    }
    const stripeInvoices = await (0, stripe_service_1.getCustomerInvoices)(clinic.stripeCustomerId);
    res.json(stripeInvoices.map((inv) => ({
        id: inv.id,
        amount: (inv.amount_paid ?? inv.amount_due) / 100,
        currency: inv.currency,
        status: inv.status,
        pdfUrl: inv.invoice_pdf,
        date: new Date((inv.created ?? 0) * 1000),
        period: inv.period_start
            ? new Date(inv.period_start * 1000).toISOString().slice(0, 7)
            : '',
    })));
});
// POST /api/billing/checkout
exports.createCheckout = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { plan } = req.body;
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: { id: true, email: true, ownerName: true, stripeCustomerId: true },
    });
    if (!clinic)
        throw (0, error_middleware_1.createError)('Clinic not found', 404, 'NOT_FOUND');
    let customerId = clinic.stripeCustomerId;
    if (!customerId) {
        customerId = await (0, stripe_service_1.getOrCreateCustomer)(clinic.id, clinic.email, clinic.ownerName);
        await prisma_1.prisma.clinic.update({
            where: { id: clinic.id },
            data: { stripeCustomerId: customerId },
        });
    }
    const successUrl = `${process.env.APP_URL}/dashboard/billing?success=true`;
    const cancelUrl = `${process.env.APP_URL}/dashboard/billing?cancelled=true`;
    const url = await (0, stripe_service_1.createCheckoutSession)(customerId, plan, successUrl, cancelUrl, clinic.id);
    res.json({ url });
});
// POST /api/billing/portal
exports.openPortal = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const clinic = await prisma_1.prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: { id: true, email: true, ownerName: true, stripeCustomerId: true },
    });
    if (!clinic)
        throw (0, error_middleware_1.createError)('Clinic not found', 404, 'NOT_FOUND');
    let customerId = clinic.stripeCustomerId;
    if (!customerId) {
        customerId = await (0, stripe_service_1.getOrCreateCustomer)(clinic.id, clinic.email, clinic.ownerName);
        await prisma_1.prisma.clinic.update({
            where: { id: clinic.id },
            data: { stripeCustomerId: customerId },
        });
    }
    const returnUrl = `${process.env.APP_URL}/dashboard/billing`;
    const url = await (0, stripe_service_1.createPortalSession)(customerId, returnUrl);
    res.json({ url });
});
//# sourceMappingURL=billing.controller.js.map