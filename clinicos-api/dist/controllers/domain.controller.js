"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roster = exports.createPractitioner = exports.createLocation = exports.listLeave = exports.createLeave = exports.deleteLeave = exports.listBlocks = exports.createBlock = exports.deleteBlock = exports.listRooms = exports.createRoom = exports.patchRoom = exports.listInvoices = exports.createInvoice = exports.recordPayment = exports.voidInvoice = exports.listDocuments = exports.createDocumentMeta = exports.getDocumentFile = exports.listLabOrders = exports.createLabOrder = exports.patchLabOrder = exports.addLabResult = exports.listSkus = exports.createSku = exports.moveStock = exports.stockBalance = exports.listTele = exports.createTele = exports.patchTele = exports.listCoverages = exports.createCoverage = exports.listClaims = exports.createClaim = void 0;

const crypto = require("crypto");
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../lib/asyncHandler");
const error_middleware_1 = require("../middleware/error.middleware");
const roster_1 = require("../services/roster.service");
const audit_1 = require("../services/audit.service");
const storage_1 = require("../services/storage.service");

function nid(prefix) {
  return prefix + crypto.randomBytes(10).toString("hex");
}

async function scopedPatient(req, patientId) {
  const row = await prisma_1.prisma.patient.findFirst({ where: { id: patientId, clinicId: req.clinicId } });
  if (!row) throw (0, error_middleware_1.createError)("Patient not found", 404, "NOT_FOUND");
  return row;
}

exports.roster = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const data = await (0, roster_1.ensureClinicRoster)(req.clinicId);
  res.json({
    practitioners: data.practitioners,
    locations: data.locations,
  });
});

exports.createPractitioner = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) throw (0, error_middleware_1.createError)("Name is required", 400, "VALIDATION_ERROR");
  const row = await prisma_1.prisma.practitioner.create({
    data: {
      id: nid("pr_"),
      clinicId: req.clinicId,
      name,
      specialty: req.body.specialty || null,
      isPrimary: false,
      isActive: true,
    },
  });
  await (0, audit_1.writeAudit)({ ...(0, audit_1.actorOf)(req), clinicId: req.clinicId, action: "practitioner.created", entityType: "Practitioner", entityId: row.id, success: true });
  res.status(201).json(row);
});

exports.createLocation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) throw (0, error_middleware_1.createError)("Name is required", 400, "VALIDATION_ERROR");
  const row = await prisma_1.prisma.location.create({
    data: {
      id: nid("loc_"),
      clinicId: req.clinicId,
      name,
      address: req.body.address || null,
      isPrimary: false,
      isActive: true,
    },
  });
  await (0, audit_1.writeAudit)({ ...(0, audit_1.actorOf)(req), clinicId: req.clinicId, action: "location.created", entityType: "Location", entityId: row.id, success: true });
  res.status(201).json(row);
});

exports.listLeave = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const rows = await prisma_1.prisma.leave.findMany({
    where: { clinicId: req.clinicId, ...(req.query.practitionerId ? { practitionerId: String(req.query.practitionerId) } : {}) },
    orderBy: { startsAt: "desc" },
  });
  res.json({ data: rows });
});

exports.createLeave = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  if (!req.body.practitionerId || !req.body.startsAt || !req.body.endsAt) {
    throw (0, error_middleware_1.createError)("practitionerId, startsAt and endsAt are required", 400, "VALIDATION_ERROR");
  }
  const pr = await prisma_1.prisma.practitioner.findFirst({ where: { id: req.body.practitionerId, clinicId: req.clinicId } });
  if (!pr) throw (0, error_middleware_1.createError)("Practitioner not found", 404, "NOT_FOUND");
  const row = await prisma_1.prisma.leave.create({
    data: {
      id: nid("lv_"),
      clinicId: req.clinicId,
      practitionerId: pr.id,
      startsAt: new Date(req.body.startsAt),
      endsAt: new Date(req.body.endsAt),
      reason: req.body.reason || null,
    },
  });
  await (0, audit_1.writeAudit)({ ...(0, audit_1.actorOf)(req), clinicId: req.clinicId, action: "leave.created", entityType: "Leave", entityId: row.id, success: true });
  res.status(201).json(row);
});

exports.deleteLeave = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const existing = await prisma_1.prisma.leave.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) throw (0, error_middleware_1.createError)("Leave not found", 404, "NOT_FOUND");
  await prisma_1.prisma.leave.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

exports.listBlocks = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const rows = await prisma_1.prisma.scheduleBlock.findMany({ where: { clinicId: req.clinicId }, orderBy: { startsAt: "desc" } });
  res.json({ data: rows });
});

exports.createBlock = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  if (!req.body.startsAt || !req.body.endsAt) throw (0, error_middleware_1.createError)("startsAt and endsAt are required", 400, "VALIDATION_ERROR");
  const row = await prisma_1.prisma.scheduleBlock.create({
    data: {
      id: nid("blk_"),
      clinicId: req.clinicId,
      practitionerId: req.body.practitionerId || null,
      locationId: req.body.locationId || null,
      roomId: req.body.roomId || null,
      startsAt: new Date(req.body.startsAt),
      endsAt: new Date(req.body.endsAt),
      kind: req.body.kind || "BLOCK",
      reason: req.body.reason || null,
    },
  });
  await (0, audit_1.writeAudit)({ ...(0, audit_1.actorOf)(req), clinicId: req.clinicId, action: "schedule_block.created", entityType: "ScheduleBlock", entityId: row.id, success: true });
  res.status(201).json(row);
});

exports.deleteBlock = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const existing = await prisma_1.prisma.scheduleBlock.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) throw (0, error_middleware_1.createError)("Block not found", 404, "NOT_FOUND");
  await prisma_1.prisma.scheduleBlock.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

exports.listRooms = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const rows = await prisma_1.prisma.room.findMany({ where: { clinicId: req.clinicId }, orderBy: { name: "asc" } });
  res.json({ data: rows });
});

exports.createRoom = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) throw (0, error_middleware_1.createError)("Name is required", 400, "VALIDATION_ERROR");
  const row = await prisma_1.prisma.room.create({
    data: {
      id: nid("rm_"),
      clinicId: req.clinicId,
      locationId: req.body.locationId || null,
      name,
      status: req.body.status || "AVAILABLE",
    },
  });
  res.status(201).json(row);
});

exports.patchRoom = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const existing = await prisma_1.prisma.room.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) throw (0, error_middleware_1.createError)("Room not found", 404, "NOT_FOUND");
  const allowed = ["AVAILABLE", "RESERVED", "OCCUPIED", "BLOCKED"];
  const status = req.body.status && allowed.indexOf(req.body.status) >= 0 ? req.body.status : existing.status;
  const row = await prisma_1.prisma.room.update({
    where: { id: existing.id },
    data: { status, name: req.body.name || existing.name },
  });
  res.json(row);
});

exports.listInvoices = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const where = { clinicId: req.clinicId };
  if (req.query.patientId) where.patientId = String(req.query.patientId);
  const rows = await prisma_1.prisma.patientInvoice.findMany({ where, orderBy: { createdAt: "desc" }, include: { payments: true } });
  res.json({ data: rows });
});

exports.createInvoice = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  await scopedPatient(req, req.body.patientId);
  const amount = Number(req.body.amount);
  if (!(amount > 0)) throw (0, error_middleware_1.createError)("Amount must be greater than zero", 400, "VALIDATION_ERROR");
  const row = await prisma_1.prisma.patientInvoice.create({
    data: {
      id: nid("pinv_"),
      clinicId: req.clinicId,
      patientId: req.body.patientId,
      appointmentId: req.body.appointmentId || null,
      amount,
      balance: amount,
      status: "OPEN",
      note: req.body.note || null,
    },
  });
  await prisma_1.prisma.patientLedgerEntry.create({
    data: { id: nid("led_"), clinicId: req.clinicId, patientId: req.body.patientId, invoiceId: row.id, type: "CHARGE", amount },
  });
  await (0, audit_1.writeAudit)({ ...(0, audit_1.actorOf)(req), clinicId: req.clinicId, action: "patient_invoice.created", entityType: "PatientInvoice", entityId: row.id, success: true });
  res.status(201).json(row);
});

exports.recordPayment = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const invoice = await prisma_1.prisma.patientInvoice.findFirst({ where: { id: req.body.invoiceId, clinicId: req.clinicId } });
  if (!invoice) throw (0, error_middleware_1.createError)("Invoice not found", 404, "NOT_FOUND");
  if (invoice.status === "VOID") throw (0, error_middleware_1.createError)("Cannot pay a void invoice", 409, "INVALID_STATE");
  const amount = Number(req.body.amount);
  if (!(amount > 0)) throw (0, error_middleware_1.createError)("Amount must be greater than zero", 400, "VALIDATION_ERROR");
  const kind = req.body.kind === "REFUND" ? "REFUND" : "PAYMENT";
  const pay = await prisma_1.prisma.patientPayment.create({
    data: {
      id: nid("ppay_"),
      clinicId: req.clinicId,
      patientId: invoice.patientId,
      invoiceId: invoice.id,
      amount,
      method: req.body.method || "CASH",
      kind,
      note: req.body.note || null,
    },
  });
  const signed = kind === "REFUND" ? Number(invoice.balance) + amount : Number(invoice.balance) - amount;
  const balance = Math.max(0, Number(signed.toFixed(2)));
  let status = invoice.status;
  if (kind === "REFUND") status = balance >= Number(invoice.amount) ? "REFUNDED" : "PARTIAL";
  else status = balance <= 0 ? "PAID" : "PARTIAL";
  const updated = await prisma_1.prisma.patientInvoice.update({
    where: { id: invoice.id },
    data: { balance, status },
  });
  await prisma_1.prisma.patientLedgerEntry.create({
    data: { id: nid("led_"), clinicId: req.clinicId, patientId: invoice.patientId, invoiceId: invoice.id, type: kind, amount: kind === "REFUND" ? amount : -amount },
  });
  await (0, audit_1.writeAudit)({ ...(0, audit_1.actorOf)(req), clinicId: req.clinicId, action: kind === "REFUND" ? "patient_payment.refunded" : "patient_payment.recorded", entityType: "PatientPayment", entityId: pay.id, success: true });
  res.status(201).json({ payment: pay, invoice: updated });
});

exports.voidInvoice = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const invoice = await prisma_1.prisma.patientInvoice.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!invoice) throw (0, error_middleware_1.createError)("Invoice not found", 404, "NOT_FOUND");
  const updated = await prisma_1.prisma.patientInvoice.update({ where: { id: invoice.id }, data: { status: "VOID", balance: 0 } });
  await prisma_1.prisma.patientLedgerEntry.create({
    data: { id: nid("led_"), clinicId: req.clinicId, patientId: invoice.patientId, invoiceId: invoice.id, type: "VOID", amount: 0 },
  });
  await (0, audit_1.writeAudit)({ ...(0, audit_1.actorOf)(req), clinicId: req.clinicId, action: "patient_invoice.voided", entityType: "PatientInvoice", entityId: invoice.id, success: true });
  res.json(updated);
});

exports.listDocuments = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const where = { clinicId: req.clinicId };
  if (req.query.patientId) where.patientId = String(req.query.patientId);
  const rows = await prisma_1.prisma.patientDocument.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json({ data: rows });
});

exports.createDocumentMeta = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  await scopedPatient(req, req.body.patientId);
  const filename = String(req.body.filename || "").trim();
  const mimeType = String(req.body.mimeType || "application/octet-stream");
  const size = Number(req.body.size || 0);
  if (!filename) throw (0, error_middleware_1.createError)("filename is required", 400, "VALIDATION_ERROR");
  const id = nid("doc_");
  const key = req.body.storageKey || (0, storage_1.storageKeyFor)(req.clinicId, req.body.patientId, id, filename);
  if (req.body.contentBase64) {
    const buf = Buffer.from(String(req.body.contentBase64), "base64");
    (0, storage_1.putObject)(key, buf);
  }
  const row = await prisma_1.prisma.patientDocument.create({
    data: {
      id,
      clinicId: req.clinicId,
      patientId: req.body.patientId,
      type: req.body.type || "OTHER",
      filename,
      mimeType,
      size: size || 0,
      storageKey: key,
      uploadedBy: req.user.id,
    },
  });
  await (0, audit_1.writeAudit)({ ...(0, audit_1.actorOf)(req), clinicId: req.clinicId, action: "document.uploaded", entityType: "PatientDocument", entityId: row.id, success: true });
  res.status(201).json(row);
});

exports.getDocumentFile = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const row = await prisma_1.prisma.patientDocument.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!row) throw (0, error_middleware_1.createError)("Document not found", 404, "NOT_FOUND");
  const full = (0, storage_1.getObjectPath)(row.storageKey);
  if (!full) throw (0, error_middleware_1.createError)("File not found", 404, "NOT_FOUND");
  res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", "attachment; filename=\"" + String(row.filename || "file").replace(/"/g, "") + "\"");
  require("fs").createReadStream(full).pipe(res);
});

exports.listLabOrders = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const where = { clinicId: req.clinicId };
  if (req.query.patientId) where.patientId = String(req.query.patientId);
  const rows = await prisma_1.prisma.labOrder.findMany({ where, include: { items: true, results: true }, orderBy: { createdAt: "desc" } });
  res.json({ data: rows });
});

exports.createLabOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  await scopedPatient(req, req.body.patientId);
  const tests = Array.isArray(req.body.tests) ? req.body.tests.map((t) => String(t).trim()).filter(Boolean) : [];
  if (!tests.length) throw (0, error_middleware_1.createError)("At least one test is required", 400, "VALIDATION_ERROR");
  const order = await prisma_1.prisma.labOrder.create({
    data: {
      id: nid("lab_"),
      clinicId: req.clinicId,
      patientId: req.body.patientId,
      appointmentId: req.body.appointmentId || null,
      encounterId: req.body.encounterId || null,
      status: "ORDERED",
      note: req.body.note || null,
    },
  });
  await prisma_1.prisma.labOrderItem.createMany({
    data: tests.map((testName) => ({ id: nid("labi_"), orderId: order.id, testName })),
  });
  const full = await prisma_1.prisma.labOrder.findUnique({ where: { id: order.id }, include: { items: true } });
  res.status(201).json(full);
});

exports.patchLabOrder = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const existing = await prisma_1.prisma.labOrder.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) throw (0, error_middleware_1.createError)("Lab order not found", 404, "NOT_FOUND");
  const allowed = ["ORDERED", "COLLECTED", "PROCESSING", "COMPLETED", "CANCELLED"];
  if (req.body.status && allowed.indexOf(req.body.status) < 0) throw (0, error_middleware_1.createError)("Invalid status", 400, "VALIDATION_ERROR");
  const row = await prisma_1.prisma.labOrder.update({ where: { id: existing.id }, data: { status: req.body.status || existing.status } });
  res.json(row);
});

exports.addLabResult = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const order = await prisma_1.prisma.labOrder.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!order) throw (0, error_middleware_1.createError)("Lab order not found", 404, "NOT_FOUND");
  if (!req.body.value) throw (0, error_middleware_1.createError)("Result value is required", 400, "VALIDATION_ERROR");
  const row = await prisma_1.prisma.labResult.create({
    data: {
      id: nid("labr_"),
      orderId: order.id,
      itemId: req.body.itemId || null,
      code: req.body.code || null,
      value: String(req.body.value),
      unit: req.body.unit || null,
      flag: req.body.flag || null,
    },
  });
  res.status(201).json(row);
});

exports.listSkus = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const rows = await prisma_1.prisma.sku.findMany({ where: { clinicId: req.clinicId }, orderBy: { name: "asc" } });
  res.json({ data: rows });
});

exports.createSku = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) throw (0, error_middleware_1.createError)("Name is required", 400, "VALIDATION_ERROR");
  const row = await prisma_1.prisma.sku.create({
    data: { id: nid("sku_"), clinicId: req.clinicId, name, unit: req.body.unit || "ea" },
  });
  res.status(201).json(row);
});

exports.moveStock = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const sku = await prisma_1.prisma.sku.findFirst({ where: { id: req.body.skuId, clinicId: req.clinicId } });
  if (!sku) throw (0, error_middleware_1.createError)("SKU not found", 404, "NOT_FOUND");
  const quantity = Number(req.body.quantity);
  if (!quantity) throw (0, error_middleware_1.createError)("quantity is required", 400, "VALIDATION_ERROR");
  const type = String(req.body.type || "ADJUST").toUpperCase();
  const row = await prisma_1.prisma.stockMovement.create({
    data: {
      id: nid("mov_"),
      clinicId: req.clinicId,
      skuId: sku.id,
      lotId: req.body.lotId || null,
      type,
      quantity,
      note: req.body.note || null,
      createdBy: req.user.id,
    },
  });
  res.status(201).json(row);
});

exports.stockBalance = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const skuId = String(req.query.skuId || "");
  const sku = await prisma_1.prisma.sku.findFirst({ where: { id: skuId, clinicId: req.clinicId } });
  if (!sku) throw (0, error_middleware_1.createError)("SKU not found", 404, "NOT_FOUND");
  const agg = await prisma_1.prisma.stockMovement.aggregate({
    where: { clinicId: req.clinicId, skuId },
    _sum: { quantity: true },
  });
  res.json({ skuId, quantity: Number(agg._sum.quantity || 0) });
});

exports.listTele = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const rows = await prisma_1.prisma.teleSession.findMany({ where: { clinicId: req.clinicId }, orderBy: { createdAt: "desc" } });
  res.json({ data: rows });
});

exports.createTele = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const appt = await prisma_1.prisma.appointment.findFirst({ where: { id: req.body.appointmentId, clinicId: req.clinicId } });
  if (!appt) throw (0, error_middleware_1.createError)("Appointment not found", 404, "NOT_FOUND");
  const provider = String(req.body.provider || "").trim();
  if (!provider) throw (0, error_middleware_1.createError)("A real video provider identifier is required", 400, "VALIDATION_ERROR");
  const row = await prisma_1.prisma.teleSession.create({
    data: {
      id: nid("tele_"),
      clinicId: req.clinicId,
      appointmentId: appt.id,
      provider,
      providerSessionId: req.body.providerSessionId || null,
      status: "SCHEDULED",
    },
  });
  res.status(201).json(row);
});

exports.patchTele = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const existing = await prisma_1.prisma.teleSession.findFirst({ where: { id: req.params.id, clinicId: req.clinicId } });
  if (!existing) throw (0, error_middleware_1.createError)("Session not found", 404, "NOT_FOUND");
  const data = {};
  if (req.body.status) data.status = req.body.status;
  if (req.body.startedAt) data.startedAt = new Date(req.body.startedAt);
  if (req.body.endedAt) data.endedAt = new Date(req.body.endedAt);
  const row = await prisma_1.prisma.teleSession.update({ where: { id: existing.id }, data });
  res.json(row);
});

exports.listCoverages = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const where = { clinicId: req.clinicId };
  if (req.query.patientId) where.patientId = String(req.query.patientId);
  const rows = await prisma_1.prisma.coverage.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json({ data: rows });
});

exports.createCoverage = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  await scopedPatient(req, req.body.patientId);
  if (!req.body.payer) throw (0, error_middleware_1.createError)("payer is required", 400, "VALIDATION_ERROR");
  const row = await prisma_1.prisma.coverage.create({
    data: {
      id: nid("cov_"),
      clinicId: req.clinicId,
      patientId: req.body.patientId,
      payer: req.body.payer,
      memberId: req.body.memberId || null,
      isPrimary: req.body.isPrimary !== false,
    },
  });
  res.status(201).json(row);
});

exports.listClaims = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const rows = await prisma_1.prisma.claim.findMany({ where: { clinicId: req.clinicId }, orderBy: { createdAt: "desc" } });
  res.json({ data: rows });
});

exports.createClaim = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
  const coverage = await prisma_1.prisma.coverage.findFirst({ where: { id: req.body.coverageId, clinicId: req.clinicId } });
  if (!coverage) throw (0, error_middleware_1.createError)("Coverage not found", 404, "NOT_FOUND");
  const amount = Number(req.body.amount);
  if (!(amount > 0)) throw (0, error_middleware_1.createError)("Amount must be greater than zero", 400, "VALIDATION_ERROR");
  const row = await prisma_1.prisma.claim.create({
    data: {
      id: nid("clm_"),
      clinicId: req.clinicId,
      coverageId: coverage.id,
      amount,
      status: "DRAFT",
      note: req.body.note || null,
    },
  });
  res.status(201).json(row);
});
