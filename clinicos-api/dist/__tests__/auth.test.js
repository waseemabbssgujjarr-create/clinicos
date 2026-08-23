"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../app");
const prisma_1 = require("../lib/prisma");
const TEST_EMAIL = 'jest-auth@test.clinicos.ai';
const TEST_EMAIL_A = 'jest-tenant-a@test.clinicos.ai';
const TEST_EMAIL_B = 'jest-tenant-b@test.clinicos.ai';
beforeAll(async () => {
    await prisma_1.prisma.clinic.deleteMany({ where: { email: { in: [TEST_EMAIL, TEST_EMAIL_A, TEST_EMAIL_B] } } });
});
afterAll(async () => {
    await prisma_1.prisma.clinic.deleteMany({ where: { email: { in: [TEST_EMAIL, TEST_EMAIL_A, TEST_EMAIL_B] } } });
    await prisma_1.prisma.$disconnect();
});
describe('POST /api/auth/register', () => {
    it('creates a clinic and returns token', async () => {
        const res = await (0, supertest_1.default)(app_1.app).post('/api/auth/register').send({
            ownerName: 'Dr. Jest Test', email: TEST_EMAIL,
            password: 'TestPass123!', phone: '+971500000099',
            clinicName: 'Jest Test Clinic', specialty: 'general',
        });
        expect(res.status).toBe(201);
        expect(res.body.token).toBeDefined();
        expect(res.body.clinic.plan).toBe('TRIAL');
    });
    it('rejects duplicate email', async () => {
        const res = await (0, supertest_1.default)(app_1.app).post('/api/auth/register').send({
            ownerName: 'Dr. Dup', email: TEST_EMAIL,
            password: 'TestPass123!', phone: '+971500000098', clinicName: 'Dup Clinic',
        });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('DUPLICATE_CLINIC');
    });
    it('rejects invalid email', async () => {
        const res = await (0, supertest_1.default)(app_1.app).post('/api/auth/register').send({
            ownerName: 'Dr. Bad', email: 'not-an-email',
            password: 'TestPass123!', phone: '+971500000097', clinicName: 'Bad Clinic',
        });
        expect(res.status).toBe(400);
    });
});
describe('POST /api/auth/login', () => {
    it('returns JWT on valid credentials', async () => {
        const res = await (0, supertest_1.default)(app_1.app).post('/api/auth/login').send({ email: TEST_EMAIL, password: 'TestPass123!' });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.role).toBe('DOCTOR');
    });
    it('rejects wrong password', async () => {
        const res = await (0, supertest_1.default)(app_1.app).post('/api/auth/login').send({ email: TEST_EMAIL, password: 'WrongPass!' });
        expect(res.status).toBe(401);
    });
});
describe('Multi-tenancy isolation', () => {
    let tokenA;
    let tokenB;
    let patientIdA;
    beforeAll(async () => {
        const rA = await (0, supertest_1.default)(app_1.app).post('/api/auth/register').send({ ownerName: 'Dr. A', email: TEST_EMAIL_A, password: 'TestPass123!', phone: '+971500000090', clinicName: 'Clinic A' });
        const rB = await (0, supertest_1.default)(app_1.app).post('/api/auth/register').send({ ownerName: 'Dr. B', email: TEST_EMAIL_B, password: 'TestPass123!', phone: '+971500000091', clinicName: 'Clinic B' });
        tokenA = rA.body.token;
        tokenB = rB.body.token;
        const pRes = await (0, supertest_1.default)(app_1.app).post('/api/patients').set('Authorization', `Bearer ${tokenA}`).send({ fullName: 'Patient A Only', phone: '+971500000080' });
        patientIdA = pRes.body.id;
    });
    it('clinic B cannot see clinic A patient', async () => {
        const res = await (0, supertest_1.default)(app_1.app).get(`/api/patients/${patientIdA}`).set('Authorization', `Bearer ${tokenB}`);
        expect(res.status).toBe(404);
    });
    it('clinic A can see its own patient', async () => {
        const res = await (0, supertest_1.default)(app_1.app).get(`/api/patients/${patientIdA}`).set('Authorization', `Bearer ${tokenA}`);
        expect(res.status).toBe(200);
        expect(res.body.fullName).toBe('Patient A Only');
    });
    it('unauthenticated request gets 401', async () => {
        const res = await (0, supertest_1.default)(app_1.app).get('/api/patients');
        expect(res.status).toBe(401);
    });
});
//# sourceMappingURL=auth.test.js.map