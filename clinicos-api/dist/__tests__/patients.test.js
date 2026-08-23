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
    await prisma_1.prisma.clinic.deleteMany({ where: { email: 'jest-patients@test.clinicos.ai' } });
    const reg = await (0, supertest_1.default)(app_1.app).post('/api/auth/register').send({
        ownerName: 'Dr. Pat Test', email: 'jest-patients@test.clinicos.ai',
        password: 'TestPass123!', phone: '+971509992001', clinicName: 'Patient Test Clinic',
    });
    token = reg.body.token;
    clinicId = reg.body.clinic.id;
});
afterAll(async () => {
    await prisma_1.prisma.patient.deleteMany({ where: { clinicId } });
    await prisma_1.prisma.clinic.deleteMany({ where: { email: 'jest-patients@test.clinicos.ai' } });
    await prisma_1.prisma.clinic.deleteMany({ where: { email: 'jest-other@test.clinicos.ai' } });
    await prisma_1.prisma.$disconnect();
});
describe('POST /api/patients', () => {
    it('creates a patient', async () => {
        const res = await (0, supertest_1.default)(app_1.app).post('/api/patients')
            .set('Authorization', `Bearer ${token}`)
            .send({ fullName: 'Ahmed Test', phone: '+971509992002', gender: 'male' });
        expect(res.status).toBe(201);
        expect(res.body.fullName).toBe('Ahmed Test');
        patientId = res.body.id;
    });
    it('rejects duplicate phone in same clinic', async () => {
        const res = await (0, supertest_1.default)(app_1.app).post('/api/patients')
            .set('Authorization', `Bearer ${token}`)
            .send({ fullName: 'Dup Patient', phone: '+971509992002' });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('DUPLICATE_PATIENT');
    });
    it('allows same phone in different clinic', async () => {
        await prisma_1.prisma.clinic.deleteMany({ where: { email: 'jest-other@test.clinicos.ai' } });
        const reg2 = await (0, supertest_1.default)(app_1.app).post('/api/auth/register').send({
            ownerName: 'Dr. Other', email: 'jest-other@test.clinicos.ai',
            password: 'TestPass123!', phone: '+971509993001', clinicName: 'Other Clinic',
        });
        const res = await (0, supertest_1.default)(app_1.app).post('/api/patients')
            .set('Authorization', `Bearer ${reg2.body.token}`)
            .send({ fullName: 'Same Phone', phone: '+971509992002' });
        expect(res.status).toBe(201);
    });
});
describe('GET /api/patients', () => {
    it('lists patients', async () => {
        const res = await (0, supertest_1.default)(app_1.app).get('/api/patients').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.total).toBeGreaterThan(0);
    });
    it('searches by name', async () => {
        const res = await (0, supertest_1.default)(app_1.app).get('/api/patients?search=Ahmed').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.some((p) => p.fullName === 'Ahmed Test')).toBe(true);
    });
});
describe('PATCH /api/patients/:id', () => {
    it('updates medical notes', async () => {
        const res = await (0, supertest_1.default)(app_1.app).patch(`/api/patients/${patientId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ medicalNotes: 'Allergic to penicillin' });
        expect(res.status).toBe(200);
        expect(res.body.medicalNotes).toBe('Allergic to penicillin');
    });
});
//# sourceMappingURL=patients.test.js.map