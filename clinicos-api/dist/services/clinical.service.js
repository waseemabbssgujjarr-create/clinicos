"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VITAL_CODES = void 0;
exports.toClinicalDto = toClinicalDto;
exports.loadEncounter = loadEncounter;
exports.getOrCreateEncounter = getOrCreateEncounter;
exports.migrateLegacyChart = migrateLegacyChart;
exports.saveClinical = saveClinical;
exports.issuePrescription = issuePrescription;
exports.cancelPrescription = cancelPrescription;

const crypto = require("crypto");
const prisma_1 = require("../lib/prisma");
const chart_1 = require("../lib/clinicos-chart");
const roster_1 = require("./roster.service");
const audit_1 = require("./audit.service");

exports.VITAL_CODES = {
  bp: "Blood pressure",
  hr: "Heart rate",
  temp: "Temperature",
  rr: "Respiratory rate",
  spo2: "SpO2",
  weight: "Weight",
  height: "Height",
  bmi: "BMI",
  pain: "Pain score",
};

const INCLUDE = {
  note: true,
  observations: true,
  diagnoses: { orderBy: { recordedAt: "asc" } },
  prescriptions: { include: { items: { orderBy: { sortOrder: "asc" } } } },
  followUp: true,
  labOrders: { include: { items: true, results: true } },
  practitioner: { select: { id: true, name: true, specialty: true } },
  appointment: {
    include: {
      patient: true,
      practitioner: { select: { id: true, name: true, specialty: true } },
      location: { select: { id: true, name: true } },
    },
  },
};

function nid(prefix) {
  return prefix + crypto.randomBytes(10).toString("hex");
}

function vitalsFromObservations(rows) {
  const out = {};
  (rows || []).forEach((o) => {
    if (o && o.code && o.value != null && String(o.value).trim() !== "") out[o.code] = o.value;
  });
  return out;
}

function rxFromPrescriptions(list) {
  const out = [];
  (list || []).forEach((rx) => {
    (rx.items || []).forEach((item) => {
      out.push({
        id: item.id,
        prescriptionId: rx.id,
        status: rx.status,
        medication: item.drug,
        drug: item.drug,
        strength: item.strength || "",
        route: item.route || "",
        dosage: item.dose || "",
        dose: item.dose || "",
        frequency: item.frequency || "",
        duration: item.duration || "",
        quantity: item.quantity || "",
        instructions: item.instructions || "",
        refills: item.refills || 0,
      });
    });
  });
  return out;
}

function toClinicalDto(encounter, appointment) {
  const a = appointment || encounter.appointment || {};
  const patient = a.patient || {};
  const note = encounter.note || {};
  const diagnoses = (encounter.diagnoses || []).map((d) => ({
    id: d.id,
    text: d.display || d.condition,
    condition: d.condition,
    code: d.code || "",
    display: d.display || d.condition,
    primary: !!d.isPrimary,
    recordedAt: d.recordedAt,
  }));
  const practitioner = encounter.practitioner || a.practitioner || null;
  const location = a.location || null;
  return {
    id: a.id || encounter.appointmentId,
    encounterId: encounter.id,
    migrated: !!encounter.migratedFromNotesAt || !!a.chartMigratedAt,
    patient: {
      id: encounter.patientId || patient.id || "",
      name: patient.fullName || patient.name || "Patient",
      phone: patient.phone || "",
      age: patient.dateOfBirth,
      allergies: patient.allergies || "",
      gender: patient.gender || "",
    },
    appointment: a,
    practitioner: practitioner
      ? { id: practitioner.id, name: practitioner.name, role: "PRACTITIONER", source: "roster" }
      : null,
    location: location ? { id: location.id, name: location.name } : null,
    vitals: vitalsFromObservations(encounter.observations),
    diagnoses,
    clinicalNote: {
      complaint: note.complaint || "",
      history: note.history || "",
      exam: note.exam || "",
      assessment: note.assessment || "",
      treatment: note.treatment || "",
      freeText: note.freeText || "",
      diagnosis: diagnoses[0] ? diagnoses[0].text : "",
      followup: encounter.followUp ? encounter.followUp.note : "",
    },
    prescriptions: rxFromPrescriptions(encounter.prescriptions),
    labOrders: (encounter.labOrders || []).flatMap((o) => (o.items || []).map((i) => i.testName)).filter(Boolean),
    followUp: encounter.followUp ? { note: encounter.followUp.note, dueDate: encounter.followUp.dueDate } : null,
    draft: note.draft !== false && encounter.status !== "COMPLETED",
  };
}

async function loadEncounter(appointmentId, clinicId) {
  return prisma_1.prisma.encounter.findFirst({
    where: { appointmentId, clinicId },
    include: INCLUDE,
  });
}

async function getOrCreateEncounter(appointment, actor) {
  const clinicId = appointment.clinicId;
  let enc = await loadEncounter(appointment.id, clinicId);
  if (!enc) {
    const roster = await (0, roster_1.ensureClinicRoster)(clinicId);
    const practitionerId = appointment.practitionerId || (roster.primaryPractitioner && roster.primaryPractitioner.id) || null;
    enc = await prisma_1.prisma.encounter.create({
      data: {
        id: nid("enc_"),
        clinicId,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        practitionerId,
        status: appointment.status === "COMPLETED" ? "COMPLETED" : appointment.status === "IN_PROGRESS" ? "IN_PROGRESS" : "DRAFT",
      },
      include: INCLUDE,
    });
  }
  if (!appointment.chartMigratedAt && !enc.migratedFromNotesAt) {
    enc = await migrateLegacyChart(appointment, enc, actor);
  }
  return loadEncounter(appointment.id, clinicId);
}

async function migrateLegacyChart(appointment, encounter, actor) {
  if (appointment.chartMigratedAt || (encounter && encounter.migratedFromNotesAt)) {
    return encounter;
  }
  const parsed = (0, chart_1.parseChart)(appointment.notes);
  const chart = parsed.chart || (0, chart_1.emptyChart)();
  const now = new Date();
  await prisma_1.prisma.$transaction(async (tx) => {
    await tx.clinicalNote.upsert({
      where: { encounterId: encounter.id },
      create: {
        id: nid("note_"),
        encounterId: encounter.id,
        complaint: chart.complaint || null,
        history: chart.history || null,
        exam: chart.exam || null,
        assessment: chart.assessment || null,
        treatment: chart.treatment || null,
        freeText: parsed.text || null,
        draft: chart.draft !== false,
      },
      update: {},
    });
    const existingObs = await tx.observation.count({ where: { encounterId: encounter.id } });
    if (!existingObs && chart.vitals && typeof chart.vitals === "object") {
      const codes = Object.keys(chart.vitals).filter((k) => chart.vitals[k] != null && String(chart.vitals[k]).trim() !== "");
      if (codes.length) {
        await tx.observation.createMany({
          data: codes.map((code) => ({
            id: nid("obs_"),
            encounterId: encounter.id,
            code,
            display: exports.VITAL_CODES[code] || code,
            value: String(chart.vitals[code]),
          })),
        });
      }
    }
    const existingDx = await tx.diagnosis.count({ where: { encounterId: encounter.id } });
    if (!existingDx && chart.diagnosis && String(chart.diagnosis).trim()) {
      await tx.diagnosis.create({
        data: {
          id: nid("dx_"),
          encounterId: encounter.id,
          condition: String(chart.diagnosis).trim(),
          display: String(chart.diagnosis).trim(),
          isPrimary: true,
        },
      });
    }
    const existingRx = await tx.prescription.count({ where: { encounterId: encounter.id } });
    const rxItems = Array.isArray(chart.rx) ? chart.rx.filter((x) => x && (x.medication || x.drug)) : [];
    if (!existingRx && rxItems.length) {
      const rx = await tx.prescription.create({
        data: {
          id: nid("rx_"),
          encounterId: encounter.id,
          clinicId: appointment.clinicId,
          status: chart.draft === false ? "ISSUED" : "DRAFT",
          issuedAt: chart.draft === false ? now : null,
        },
      });
      await tx.prescriptionItem.createMany({
        data: rxItems.map((item, i) => ({
          id: nid("rxi_"),
          prescriptionId: rx.id,
          drug: item.medication || item.drug,
          strength: item.strength || null,
          route: item.route || null,
          dose: item.dose || item.dosage || null,
          frequency: item.frequency || null,
          duration: item.duration || null,
          quantity: item.quantity != null ? String(item.quantity) : null,
          instructions: item.instructions || null,
          refills: Number(item.refills || 0) || 0,
          sortOrder: i,
        })),
      });
    }
    if (chart.followup && String(chart.followup).trim()) {
      await tx.followUp.upsert({
        where: { encounterId: encounter.id },
        create: { id: nid("fu_"), encounterId: encounter.id, note: String(chart.followup).trim() },
        update: {},
      });
    }
    const labs = Array.isArray(chart.labs) ? chart.labs.map((x) => String(x).trim()).filter(Boolean) : [];
    const existingLab = await tx.labOrder.count({ where: { encounterId: encounter.id } });
    if (!existingLab && labs.length) {
      const order = await tx.labOrder.create({
        data: {
          id: nid("lab_"),
          clinicId: appointment.clinicId,
          patientId: appointment.patientId,
          appointmentId: appointment.id,
          encounterId: encounter.id,
          status: "ORDERED",
        },
      });
      await tx.labOrderItem.createMany({
        data: labs.map((testName) => ({
          id: nid("labi_"),
          orderId: order.id,
          testName,
        })),
      });
    }
    await tx.encounter.update({
      where: { id: encounter.id },
      data: { migratedFromNotesAt: now },
    });
    await tx.appointment.update({
      where: { id: appointment.id },
      data: { chartMigratedAt: now },
    });
  });
  await (0, audit_1.writeAudit)({
    clinicId: appointment.clinicId,
    actorId: actor && actor.actorId,
    actorRole: actor && actor.actorRole,
    action: "clinical.migrated",
    entityType: "Encounter",
    entityId: encounter.id,
    details: JSON.stringify({ appointmentId: appointment.id }),
    success: true,
  });
  return loadEncounter(appointment.id, appointment.clinicId);
}

async function replaceVitals(tx, encounterId, vitals) {
  if (!vitals || typeof vitals !== "object") return;
  await tx.observation.deleteMany({ where: { encounterId } });
  const rows = Object.keys(exports.VITAL_CODES)
    .map((code) => ({ code, value: vitals[code] }))
    .filter((r) => r.value != null && String(r.value).trim() !== "")
    .map((r) => ({
      id: nid("obs_"),
      encounterId,
      code: r.code,
      display: exports.VITAL_CODES[r.code],
      value: String(r.value).trim(),
    }));
  if (rows.length) await tx.observation.createMany({ data: rows });
}

async function saveClinical(appointment, extra, opts) {
  extra = extra || {};
  opts = opts || {};
  const actor = opts.actor || {};
  const enc = await getOrCreateEncounter(appointment, actor);
  const complete = !!opts.complete;
  const now = new Date();
  await prisma_1.prisma.$transaction(async (tx) => {
    if (extra.vitals) await replaceVitals(tx, enc.id, extra.vitals);
    const notePatch = extra.clinicalNote || {};
    const diagnosisText = notePatch.diagnosis || (extra.diagnoses && extra.diagnoses[0] && (extra.diagnoses[0].text || extra.diagnoses[0].condition)) || "";
    await tx.clinicalNote.upsert({
      where: { encounterId: enc.id },
      create: {
        id: nid("note_"),
        encounterId: enc.id,
        complaint: notePatch.complaint || "",
        history: notePatch.history || "",
        exam: notePatch.exam || "",
        assessment: notePatch.assessment || "",
        treatment: notePatch.treatment || "",
        freeText: extra.freeText != null ? extra.freeText : "",
        draft: extra.draft === false || complete ? false : true,
      },
      update: {
        complaint: notePatch.complaint != null ? notePatch.complaint : undefined,
        history: notePatch.history != null ? notePatch.history : undefined,
        exam: notePatch.exam != null ? notePatch.exam : undefined,
        assessment: notePatch.assessment != null ? notePatch.assessment : undefined,
        treatment: notePatch.treatment != null ? notePatch.treatment : undefined,
        freeText: extra.freeText != null ? extra.freeText : undefined,
        draft: extra.draft === false || complete ? false : extra.draft == null ? undefined : !!extra.draft,
      },
    });
    if (diagnosisText || (extra.diagnoses && extra.diagnoses.length)) {
      await tx.diagnosis.deleteMany({ where: { encounterId: enc.id } });
      const list = extra.diagnoses && extra.diagnoses.length
        ? extra.diagnoses
        : [{ text: diagnosisText, primary: true }];
      const rows = list
        .map((d, i) => ({
          id: nid("dx_"),
          encounterId: enc.id,
          condition: String(d.condition || d.text || d.display || "").trim(),
          code: d.code || null,
          display: d.display || d.text || d.condition || null,
          isPrimary: d.primary !== false && i === 0,
        }))
        .filter((d) => d.condition);
      if (rows.length) await tx.diagnosis.createMany({ data: rows });
    }
    if (notePatch.followup != null || extra.followUp) {
      const fu = (extra.followUp && extra.followUp.note) || notePatch.followup || "";
      if (String(fu).trim()) {
        await tx.followUp.upsert({
          where: { encounterId: enc.id },
          create: { id: nid("fu_"), encounterId: enc.id, note: String(fu).trim() },
          update: { note: String(fu).trim() },
        });
      }
    }
    if (Array.isArray(extra.prescriptions) && opts.canPrescribe) {
      const existing = await tx.prescription.findFirst({
        where: { encounterId: enc.id, status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
      });
      let rxId = existing && existing.status === "DRAFT" ? existing.id : null;
      if (!rxId) {
        const created = await tx.prescription.create({
          data: {
            id: nid("rx_"),
            encounterId: enc.id,
            clinicId: appointment.clinicId,
            status: "DRAFT",
          },
        });
        rxId = created.id;
      }
      await tx.prescriptionItem.deleteMany({ where: { prescriptionId: rxId } });
      const items = extra.prescriptions.filter((x) => x && (x.medication || x.drug));
      if (items.length) {
        await tx.prescriptionItem.createMany({
          data: items.map((item, i) => ({
            id: nid("rxi_"),
            prescriptionId: rxId,
            drug: item.medication || item.drug,
            strength: item.strength || null,
            route: item.route || null,
            dose: item.dose || item.dosage || null,
            frequency: item.frequency || null,
            duration: item.duration || null,
            quantity: item.quantity != null ? String(item.quantity) : null,
            instructions: item.instructions || null,
            refills: Number(item.refills || 0) || 0,
            sortOrder: i,
          })),
        });
      }
      if (complete && items.length) {
        await tx.prescription.update({
          where: { id: rxId },
          data: { status: "ISSUED", issuedAt: now, issuedBy: actor.actorId || null },
        });
      }
    }
    if (Array.isArray(extra.labOrders)) {
      const names = extra.labOrders.map((x) => String(x).trim()).filter(Boolean);
      const existingLab = await tx.labOrder.findFirst({ where: { encounterId: enc.id } });
      if (names.length) {
        const order = existingLab || await tx.labOrder.create({
          data: {
            id: nid("lab_"),
            clinicId: appointment.clinicId,
            patientId: appointment.patientId,
            appointmentId: appointment.id,
            encounterId: enc.id,
            status: "ORDERED",
          },
        });
        await tx.labOrderItem.deleteMany({ where: { orderId: order.id } });
        await tx.labOrderItem.createMany({
          data: names.map((testName) => ({ id: nid("labi_"), orderId: order.id, testName })),
        });
      }
    }
    const encStatus = complete ? "COMPLETED" : (opts.status === "IN_PROGRESS" || appointment.status === "IN_PROGRESS" ? "IN_PROGRESS" : enc.status);
    await tx.encounter.update({
      where: { id: enc.id },
      data: {
        status: encStatus,
        startedAt: enc.startedAt || (encStatus !== "DRAFT" ? now : null),
        completedAt: complete ? now : enc.completedAt,
        practitionerId: extra.practitionerId || enc.practitionerId,
      },
    });
  });
  const fresh = await loadEncounter(appointment.id, appointment.clinicId);
  await (0, audit_1.writeAudit)({
    clinicId: appointment.clinicId,
    actorId: actor.actorId,
    actorRole: actor.actorRole,
    action: complete ? "clinical.completed" : "clinical.amended",
    entityType: "Encounter",
    entityId: fresh.id,
    details: JSON.stringify({ appointmentId: appointment.id, complete }),
    success: true,
  });
  return fresh;
}

async function issuePrescription(prescriptionId, clinicId, actor) {
  const rx = await prisma_1.prisma.prescription.findFirst({
    where: { id: prescriptionId, clinicId },
    include: { items: true, encounter: true },
  });
  if (!rx) return null;
  if (rx.status === "ISSUED") return rx;
  const updated = await prisma_1.prisma.prescription.update({
    where: { id: rx.id },
    data: { status: "ISSUED", issuedAt: new Date(), issuedBy: actor && actor.actorId },
    include: { items: true },
  });
  await (0, audit_1.writeAudit)({
    clinicId,
    actorId: actor && actor.actorId,
    actorRole: actor && actor.actorRole,
    action: "prescription.issued",
    entityType: "Prescription",
    entityId: rx.id,
    success: true,
  });
  return updated;
}

async function cancelPrescription(prescriptionId, clinicId, actor) {
  const rx = await prisma_1.prisma.prescription.findFirst({ where: { id: prescriptionId, clinicId } });
  if (!rx) return null;
  const updated = await prisma_1.prisma.prescription.update({
    where: { id: rx.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  await (0, audit_1.writeAudit)({
    clinicId,
    actorId: actor && actor.actorId,
    actorRole: actor && actor.actorRole,
    action: "prescription.cancelled",
    entityType: "Prescription",
    entityId: rx.id,
    success: true,
  });
  return updated;
}
