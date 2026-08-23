"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../app");
const prisma_1 = require("../lib/prisma");
let clinicId;
let bookingSlug;
beforeAll(async () => {
    await prisma_1.prisma.clinic.deleteMany({ where: { email: 'jest-webhook@test.clinicos.ai' } });
    const reg = await (0, supertest_1.default)(app_1.app).post('/api/auth/register').send({
        ownerName: 'Dr. Webhook', email: 'jest-webhook@test.clinicos.ai',
        password: 'TestPass123!', phone: '+971509994001', clinicName: 'Webhook Test Clinic',
    });
    clinicId = reg.body.clinic.id;
    bookingSlug = reg.body.clinic.bookingSlug;
    await prisma_1.prisma.clinic.update({
        where: { id: clinicId },
        data: {
            workingHours: JSON.stringify({
                monday: { isOpen: true, open: '09:00', close: '17:00', slotDuration: 30 },
                tuesday: { isOpen: true, open: '09:00', close: '17:00', slotDuration: 30 },
                wednesday: { isOpen: true, open: '09:00', close: '17:00', slotDuration: 30 },
                thursday: { isOpen: true, open: '09:00', close: '17:00', slotDuration: 30 },
                friday: { isOpen: false },
                saturday: { isOpen: true, open: '10:00', close: '14:00', slotDuration: 30 },
                sunday: { isOpen: false },
            }),
        },
    });
});
afterAll(async () => {
    await prisma_1.prisma.appointment.deleteMany({ where: { clinicId } });
    await prisma_1.prisma.message.deleteMany({ where: { clinicId } });
    await prisma_1.prisma.patient.deleteMany({ where: { clinicId } });
    await prisma_1.prisma.clinic.deleteMany({ where: { email: 'jest-webhook@test.clinicos.ai' } });
    await prisma_1.prisma.$disconnect();
});
describe('GET /api/public/clinic/:slug', () => {
    it('returns clinic info', async () => {
        const res = await (0, supertest_1.default)(app_1.app).get(`/api/public/clinic/${bookingSlug}`);
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Webhook Test Clinic');
    });
    it('returns 404 for unknown slug', async () => {
        const res = await (0, supertest_1.default)(app_1.app).get('/api/public/clinic/nonexistent-slug-xyz');
        expect(res.status).toBe(404);
    });
});
describe('POST /api/public/book/:slug', () => {
    it('creates online booking', async () => {
        const d = new Date();
        while (d.getDay() !== 1)
            d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        const res = await (0, supertest_1.default)(app_1.app).post(`/api/public/book/${bookingSlug}`).send({
            fullName: 'Online Patient', phone: '+971509994002',
            treatment: 'General Consultation', dateTime: d.toISOString(),
        });
        expect(res.status).toBe(201);
        expect(res.body.appointmentId).toBeDefined();
    });
});
describe('POST /api/webhooks/twilio', () => {
    it('returns 200 (always acks Twilio)', async () => {
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/webhooks/twilio')
            .type('form')
            .send({ From: '+971509994003', Body: 'Hello', To: '+971509994001', MessageSid: 'SM_test' });
        expect(res.status).toBe(200);
    });
});
describe('GET /health', () => {
    it('returns ok', async () => {
        const res = await (0, supertest_1.default)(app_1.app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});
//# sourceMappingURL=webhooks.test.js.map