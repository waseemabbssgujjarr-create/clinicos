"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../app");
const prisma_1 = require("../lib/prisma");
const chart_1 = require("../lib/clinicos-chart");

let token;
let clinicId;
let patientId;
let appointmentId;

beforeAll(async () => {
    await prisma_1.prisma.clinic.deleteMany({ where: { email: "jest-phase5@test.clinicos.ai" } });
    const reg = await (0, supertest_1.default)(app_1.app).post("/api/auth/register").send({
        ownerName: "Dr. Phase5",
        email: "jest-phase5@test.clinicos.ai",
        password: "TestPass123!",
        phone: "+971509991101",
        clinicName: "Phase5 Clinic",
    });
    token = reg.body.token;
    clinicId = reg.body.clinic && reg.body.clinic.id;
    if (clinicId) {
        await prisma_1.prisma.clinic.update({
            where: { id: clinicId },
            data: {
                workingHours: JSON.stringify({
                    monday: { isOpen: true, open: "09:00", close: "17:00", slotDuration: 30 },
                    tuesday: { isOpen: true, open: "09:00", close: "17:00", slotDuration: 30 },
                    wednesday: { isOpen: true, open: "09:00", close: "17:00", slotDuration: 30 },
                    thursday: { isOpen: true, open: "09:00", close: "17:00", slotDuration: 30 },
                    friday: { isOpen: true, open: "09:00", close: "17:00", slotDuration: 30 },
                    saturday: { isOpen: false },
                    sunday: { isOpen: false },
                }),
            },
        });
    }
    const pat = await (0, supertest_1.default)(app_1.app).post("/api/patients")
        .set("Authorization", "Bearer " + token)
        .send({ fullName: "Phase Five Patient", phone: "+971509991102" });
    patientId = pat.body.id;
});

afterAll(async () => {
    if (clinicId) {
        await prisma_1.prisma.labResult.deleteMany({ where: { order: { clinicId } } }).catch(() => null);
        await prisma_1.prisma.labOrderItem.deleteMany({ where: { order: { clinicId } } }).catch(() => null);
        await prisma_1.prisma.labOrder.deleteMany({ where: { clinicId } }).catch(() => null);
        await prisma_1.prisma.prescriptionItem.deleteMany({ where: { prescription: { clinicId } } }).catch(() => null);
        await prisma_1.prisma.prescription.deleteMany({ where: { clinicId } }).catch(() => null);
        await prisma_1.prisma.observation.deleteMany({ where: { encounter: { clinicId } } }).catch(() => null);
        await prisma_1.prisma.diagnosis.deleteMany({ where: { encounter: { clinicId } } }).catch(() => null);
        await prisma_1.prisma.clinicalNote.deleteMany({ where: { encounter: { clinicId } } }).catch(() => null);
        await prisma_1.prisma.followUp.deleteMany({ where: { encounter: { clinicId } } }).catch(() => null);
        await prisma_1.prisma.encounter.deleteMany({ where: { clinicId } }).catch(() => null);
        await prisma_1.prisma.appointment.deleteMany({ where: { clinicId } }).catch(() => null);
        await prisma_1.prisma.patient.deleteMany({ where: { clinicId } }).catch(() => null);
        await prisma_1.prisma.leave.deleteMany({ where: { clinicId } }).catch(() => null);
        await prisma_1.prisma.practitioner.deleteMany({ where: { clinicId } }).catch(() => null);
        await prisma_1.prisma.location.deleteMany({ where: { clinicId } }).catch(() => null);
        await prisma_1.prisma.clinic.deleteMany({ where: { email: "jest-phase5@test.clinicos.ai" } }).catch(() => null);
    }
    await prisma_1.prisma.$disconnect();
});

const nextMonday = () => {
    const d = new Date();
    d.setHours(10, 0, 0, 0);
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    return d;
};

describe("Phase 5 clinical domain", () => {
    it("creates an appointment and persists CALLED", async () => {
        const created = await (0, supertest_1.default)(app_1.app).post("/api/appointments")
            .set("Authorization", "Bearer " + token)
            .send({
                patientId,
                treatment: "Consultation",
                dateTime: nextMonday().toISOString(),
                durationMin: 30,
                channel: "MANUAL",
                sendConfirmation: false,
            });
        expect(created.status).toBe(201);
        appointmentId = created.body.id;
        const arrived = await (0, supertest_1.default)(app_1.app).patch("/api/appointments/" + appointmentId)
            .set("Authorization", "Bearer " + token)
            .send({ status: "ARRIVED" });
        expect(arrived.status).toBe(200);
        const called = await (0, supertest_1.default)(app_1.app).patch("/api/appointments/" + appointmentId)
            .set("Authorization", "Bearer " + token)
            .send({ status: "CALLED" });
        expect(called.status).toBe(200);
        expect(called.body.status).toBe("CALLED");
        expect(called.body.calledAt).toBeTruthy();
    });

    it("migrates legacy chart notes once into encounter entities", async () => {
        const notes = "Visit text\n" + chart_1.CHART_MARK + "\n" + JSON.stringify({
            vitals: { hr: "80", bp: "118/76" },
            complaint: "Cough",
            diagnosis: "URI",
            rx: [{ medication: "Azithromycin", strength: "500mg" }],
            followup: "1 week",
            draft: true,
        });
        await prisma_1.prisma.appointment.update({
            where: { id: appointmentId },
            data: { notes, chartMigratedAt: null },
        });
        const res = await (0, supertest_1.default)(app_1.app).get("/api/encounters/by-appointment/" + appointmentId)
            .set("Authorization", "Bearer " + token);
        expect(res.status).toBe(200);
        expect(res.body.clinical.vitals.hr).toBe("80");
        expect(res.body.clinical.clinicalNote.complaint).toBe("Cough");
        expect(res.body.clinical.migrated).toBe(true);
        const again = await (0, supertest_1.default)(app_1.app).get("/api/encounters/by-appointment/" + appointmentId)
            .set("Authorization", "Bearer " + token);
        expect(again.body.clinical.vitals.hr).toBe("80");
    });

    it("saves vitals without inventing values", async () => {
        const res = await (0, supertest_1.default)(app_1.app).put("/api/encounters/by-appointment/" + appointmentId)
            .set("Authorization", "Bearer " + token)
            .send({ vitals: { temp: "37.1" }, clinicalNote: { complaint: "Cough" }, draft: true, status: "IN_PROGRESS" });
        expect(res.status).toBe(200);
        expect(res.body.clinical.vitals.temp).toBe("37.1");
        expect(res.body.clinical.vitals.spo2).toBeFalsy();
        expect(res.body.appointment.status).toBe("IN_PROGRESS");
    });

    it("runs book → check-in → called → consult → vitals → prescription → complete", async () => {
        const day = nextMonday();
        day.setDate(day.getDate() + 1);
        while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() + 1);
        const created = await (0, supertest_1.default)(app_1.app).post("/api/appointments")
            .set("Authorization", "Bearer " + token)
            .send({
                patientId,
                treatment: "Consultation",
                dateTime: day.toISOString(),
                durationMin: 30,
                channel: "MANUAL",
                sendConfirmation: false,
            });
        expect(created.status).toBe(201);
        const id = created.body.id;
        const arrived = await (0, supertest_1.default)(app_1.app).patch("/api/appointments/" + id)
            .set("Authorization", "Bearer " + token)
            .send({ status: "ARRIVED" });
        expect(arrived.body.status).toBe("ARRIVED");
        const called = await (0, supertest_1.default)(app_1.app).patch("/api/appointments/" + id)
            .set("Authorization", "Bearer " + token)
            .send({ status: "CALLED" });
        expect(called.body.status).toBe("CALLED");
        const saved = await (0, supertest_1.default)(app_1.app).put("/api/encounters/by-appointment/" + id)
            .set("Authorization", "Bearer " + token)
            .send({
                vitals: { hr: "70", bp: "120/80" },
                clinicalNote: { complaint: "Follow-up", diagnosis: "Well" },
                prescriptions: [{ medication: "Ibuprofen", strength: "200mg", dose: "1", frequency: "TID", duration: "5 days" }],
                draft: false,
                complete: true,
                status: "COMPLETED",
            });
        expect(saved.status).toBe(200);
        expect(saved.body.appointment.status).toBe("COMPLETED");
        expect(saved.body.clinical.vitals.hr).toBe("70");
        expect(saved.body.clinical.prescriptions[0].medication).toBe("Ibuprofen");
        expect(saved.body.clinical.vitals.spo2).toBeFalsy();
    });

    it("rejects leave overlap in slot generation", async () => {
        const roster = await (0, supertest_1.default)(app_1.app).get("/api/roster").set("Authorization", "Bearer " + token);
        expect(roster.status).toBe(200);
        const pr = roster.body.practitioners[0];
        const day = nextMonday();
        await (0, supertest_1.default)(app_1.app).post("/api/leave")
            .set("Authorization", "Bearer " + token)
            .send({
                practitionerId: pr.id,
                startsAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0).toISOString(),
                endsAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59).toISOString(),
                reason: "Leave",
            });
        const slots = await (0, supertest_1.default)(app_1.app)
            .get("/api/appointments/slots?date=" + day.toISOString().slice(0, 10) + "&duration=30")
            .set("Authorization", "Bearer " + token);
        expect(slots.status).toBe(200);
        expect(slots.body.slots).toHaveLength(0);
    });
});
