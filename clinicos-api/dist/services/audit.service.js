"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAudit = writeAudit;
exports.actorOf = actorOf;

const crypto = require("crypto");
const prisma_1 = require("../lib/prisma");

function actorOf(req) {
  return {
    actorId: req.user && req.user.id ? String(req.user.id) : null,
    actorRole: req.user && req.user.role ? String(req.user.role) : null,
  };
}

async function writeAudit(entry) {
  const success = entry.success === false ? 0 : 1;
  if (!entry.action) return { ok: false };
  try {
    await prisma_1.prisma.$executeRawUnsafe(
      "INSERT INTO `AuditLog` (`id`,`clinicId`,`actorId`,`actorRole`,`action`,`entityType`,`entityId`,`details`,`success`,`createdAt`) VALUES (?,?,?,?,?,?,?,?,?,?)",
      "aud_" + crypto.randomBytes(10).toString("hex"),
      entry.clinicId || null,
      entry.actorId || null,
      entry.actorRole || null,
      entry.action,
      entry.entityType || null,
      entry.entityId || null,
      entry.details ? String(entry.details).slice(0, 4000) : null,
      success,
      new Date()
    );
    return { ok: true };
  } catch (_) {
    return { ok: false };
  }
}
