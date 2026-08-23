"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../app");
const prisma_1 = require("../lib/prisma");
let token;
let clinicId;
let patientId;
beforeAll(async () => {
    await prisma_1.prisma.clinic.deleteMany({ where: { email: 'jest-appts@test.clinicos.ai' } });
    const reg = await (0, supertest_1.default)(app_1.app).post('/api/auth/register').send({
        ownerName: 'Dr. Appt Test', email: 'jest-appts@test.clinicos.ai',
        password: 'TestPass123!', phone: '+971509991001', clinicName: 'Appt Test Clinic',
    });
    token = reg.body.token;
    clinicId = reg.body.clinic.id;
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
    const pat = await (0, supertest_1.default)(app_1.app).post('/api/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: 'Test Patient Appt', phone: '+971509991002' });
    patientId = pat.body.id;
});
afterAll(async () => {
    await prisma_1.prisma.appointment.deleteMany({ where: { clinicId } });
    await prisma_1.prisma.patient.deleteMany({ where: { clinicId } });
    await prisma_1.prisma.clinic.deleteMany({ where: { email: 'jest-appts@test.clinicos.ai' } });
    await prisma_1.prisma.$disconnect();
});
const nextMonday = () => {
    const d = new Date();
    d.setHours(10, 0, 0, 0);
    while (d.getDay() !== 1)
        d.setDate(d.getDate() + 1);
    return d;
};
describe('POST /api/appointments', () => {
    it('creates an appointment', async () => {
        const res = await (0, supertest_1.default)(app_1.app).post('/api/appointments')
            .set('Authorization', `Bearer ${token}`)
            .send({ patientId, treatment: 'Consultation', dateTime: nextMonday().toISOString(), durationMin: 30, channel: 'MANUAL', sendConfirmation: false });
        expect(res.status).toBe(201);
        expect(res.body.patientId).toBe(patientId);
    });
    it('prevents double-booking same slot', async () => {
        const res = await (0, supertest_1.default)(app_1.app).post('/api/appointments')
            .set('Authorization', `Bearer ${token}`)
            .send({ patientId, treatment: 'X-Ray', dateTime: nextMonday().toISOString(), durationMin: 30, channel: 'MANUAL', sendConfirmation: false });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('SLOT_CONFLICT');
    });
    it('requires auth', async () => {
        const res = await (0, supertest_1.default)(app_1.app).post('/api/appointments').send({ patientId, treatment: 'Test', dateTime: new Date().toISOString() });
        expect(res.status).toBe(401);
    });
});
describe('GET /api/appointments/slots', () => {
    it('returns slots for open day', async () => {
        const d = nextMonday();
        const res = await (0, supertest_1.default)(app_1.app)
            .get(`/api/appointments/slots?date=${d.toISOString().slice(0, 10)}&duration=30`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.slots)).toBe(true);
    });
    it('returns empty for closed day (Friday)', async () => {
        const d = new Date();
        while (d.getDay() !== 5)
            d.setDate(d.getDate() + 1);
        const res = await (0, supertest_1.default)(app_1.app)
            .get(`/api/appointments/slots?date=${d.toISOString().slice(0, 10)}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.slots).toHaveLength(0);
    });
});
//# sourceMappingURL=appointments.test.js.map