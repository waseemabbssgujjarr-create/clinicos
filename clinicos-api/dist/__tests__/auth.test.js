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
describe('POST /api/auth/accept-invite', () => {
    const INVITE_EMAIL = 'jest-invite-staff@test.clinicos.ai';
    let clinicId;
    let inviteToken;
    beforeAll(async () => {
        await prisma_1.prisma.staffMember.deleteMany({ where: { email: INVITE_EMAIL } });
        const reg = await (0, supertest_1.default)(app_1.app).post('/api/auth/register').send({
            ownerName: 'Dr. Invite Host',
            email: 'jest-invite-host@test.clinicos.ai',
            password: 'TestPass123!',
            phone: '+971500000088',
            clinicName: 'Invite Test Clinic',
        });
        clinicId = reg.body.clinic?.id || reg.body.user?.clinicId;
        inviteToken = 'jest-invite-token-' + Date.now();
        await prisma_1.prisma.staffMember.create({
            data: {
                clinicId,
                name: 'Invite Staff',
                email: INVITE_EMAIL,
                role: 'ASSISTANT',
                passwordHash: 'temp',
                inviteToken,
                inviteExpiry: new Date(Date.now() + 48 * 3600 * 1000),
                isActive: false,
            },
        });
    });
    afterAll(async () => {
        await prisma_1.prisma.staffMember.deleteMany({ where: { email: INVITE_EMAIL } });
        await prisma_1.prisma.clinic.deleteMany({ where: { email: 'jest-invite-host@test.clinicos.ai' } });
    });
    it('rejects missing token on preview', async () => {
        const res = await (0, supertest_1.default)(app_1.app).get('/api/auth/invite-preview');
        expect(res.status).toBe(400);
    });
    it('returns invite preview for valid token', async () => {
        const res = await (0, supertest_1.default)(app_1.app).get('/api/auth/invite-preview').query({ token: inviteToken });
        expect(res.status).toBe(200);
        expect(res.body.clinicName).toBe('Invite Test Clinic');
        expect(res.body.role).toBe('ASSISTANT');
    });
    it('activates staff with password and clears invite token', async () => {
        const res = await (0, supertest_1.default)(app_1.app).post('/api/auth/accept-invite').send({
            token: inviteToken,
            password: 'StaffPass123!',
            name: 'Danish Khan',
        });
        expect(res.status).toBe(200);
        const login = await (0, supertest_1.default)(app_1.app).post('/api/auth/staff/login').send({
            email: INVITE_EMAIL,
            password: 'StaffPass123!',
        });
        expect(login.status).toBe(200);
        expect(login.body.user.role).toBe('STAFF');
    });
    it('returns field errors for short password', async () => {
        const res = await (0, supertest_1.default)(app_1.app).post('/api/auth/accept-invite').send({
            token: 'not-used',
            password: 'short',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.details?.[0]?.message).toMatch(/8 characters/i);
    });
});
//# sourceMappingURL=auth.test.js.map