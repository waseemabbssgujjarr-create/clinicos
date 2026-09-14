"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getByAppointment = exports.saveByAppointment = exports.issueRx = exports.cancelRx = void 0;

const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const clinical_1 = require("../services/clinical.service");
const audit_1 = require("../services/audit.service");
const pharmacy_1 = require("../services/pharmacy.adapter");

async function clinicAppointment(req) {
  const appointment = await prisma_1.prisma.appointment.findUnique({
    where: { id: req.params.appointmentId || req.params.id },
    include: { patient: true, practitioner: true, location: true },
  });
  if (!appointment || appointment.clinicId !== req.clinicId) {
    throw (0, error_middleware_1.createError)("Appointment not found", 404, "NOT_FOUND");
  }
  return appointment;
}

exports.getByAppointment = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const appointment = await clinicAppointment(req);
  const enc = await (0, clinical_1.getOrCreateEncounter)(appointment, (0, audit_1.actorOf)(req));
  res.json({
    appointment,
    clinical: (0, clinical_1.toClinicalDto)(enc, appointment),
  });
});

exports.saveByAppointment = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  if (!(0, auth_middleware_1.canChart)(req)) {
    throw (0, error_middleware_1.createError)("You don't have permission to perform this action.", 403, "FORBIDDEN");
  }
  const appointment = await clinicAppointment(req);
  const extra = {
    vitals: req.body.vitals,
    clinicalNote: req.body.clinicalNote,
    diagnoses: req.body.diagnoses,
    prescriptions: req.body.prescriptions,
    labOrders: req.body.labOrders,
    followUp: req.body.followUp,
    draft: req.body.draft,
    freeText: req.body.freeText,
    practitionerId: req.body.practitionerId,
  };
  const complete = !!req.body.complete;
  if (req.body.prescriptions && !(0, auth_middleware_1.canPrescribe)(req)) {
    extra.prescriptions = undefined;
  }
  const enc = await (0, clinical_1.saveClinical)(appointment, extra, {
    complete,
    status: req.body.status,
    canPrescribe: (0, auth_middleware_1.canPrescribe)(req),
    actor: (0, audit_1.actorOf)(req),
  });
  let freshAppt = appointment;
  if (req.body.status || complete) {
    const nextStatus = complete ? (req.body.status || "COMPLETED") : req.body.status;
    if (nextStatus) {
      const data = { status: nextStatus };
      if (nextStatus === "CALLED") {
        data.calledAt = new Date();
        data.calledBy = req.user.id;
      }
      freshAppt = await prisma_1.prisma.appointment.update({
        where: { id: appointment.id },
        data,
        include: { patient: true, practitioner: true, location: true },
      });
      await (0, audit_1.writeAudit)({
        ...(0, audit_1.actorOf)(req),
        clinicId: req.clinicId,
        action: "appointment.status_changed",
        entityType: "Appointment",
        entityId: appointment.id,
        details: JSON.stringify({ from: appointment.status, to: nextStatus }),
        success: true,
      });
    }
  } else {
    freshAppt = await prisma_1.prisma.appointment.findUnique({
      where: { id: appointment.id },
      include: { patient: true, practitioner: true, location: true },
    });
  }
  res.json({
    ok: true,
    appointment: freshAppt,
    clinical: (0, clinical_1.toClinicalDto)(enc, freshAppt),
  });
});

exports.issueRx = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const updated = await (0, clinical_1.issuePrescription)(req.params.id, req.clinicId, (0, audit_1.actorOf)(req));
  if (!updated) throw (0, error_middleware_1.createError)("Prescription not found", 404, "NOT_FOUND");
  const rail = await (0, pharmacy_1.sendToPharmacy)(updated);
  res.json({ prescription: updated, pharmacy: rail });
});

exports.cancelRx = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const updated = await (0, clinical_1.cancelPrescription)(req.params.id, req.clinicId, (0, audit_1.actorOf)(req));
  if (!updated) throw (0, error_middleware_1.createError)("Prescription not found", 404, "NOT_FOUND");
  res.json({ prescription: updated });
});
