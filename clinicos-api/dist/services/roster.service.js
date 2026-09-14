"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureClinicRoster = ensureClinicRoster;
exports.listPractitioners = listPractitioners;
exports.listLocations = listLocations;
exports.primaryPractitioner = primaryPractitioner;
exports.primaryLocation = primaryLocation;

const crypto = require("crypto");
const prisma_1 = require("../lib/prisma");

function nid(prefix) {
  return prefix + crypto.randomBytes(10).toString("hex");
}

async function ensureClinicRoster(clinicId) {
  const clinic = await prisma_1.prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { id: true, name: true, ownerName: true, specialty: true, address: true },
  });
  if (!clinic) return { practitioners: [], locations: [] };
  let practitioners = await prisma_1.prisma.practitioner.findMany({ where: { clinicId } }).catch(() => []);
  if (!practitioners.length) {
    const created = await prisma_1.prisma.practitioner.create({
      data: {
        id: nid("pr_"),
        clinicId,
        name: clinic.ownerName || "Practitioner",
        specialty: clinic.specialty || null,
        isPrimary: true,
        isActive: true,
      },
    });
    practitioners = [created];
  }
  let locations = await prisma_1.prisma.location.findMany({ where: { clinicId } }).catch(() => []);
  if (!locations.length) {
    const created = await prisma_1.prisma.location.create({
      data: {
        id: nid("loc_"),
        clinicId,
        name: clinic.name || "Clinic",
        address: clinic.address || null,
        isPrimary: true,
        isActive: true,
      },
    });
    locations = [created];
  }
  const primaryPr = practitioners.find((p) => p.isPrimary) || practitioners[0];
  const primaryLoc = locations.find((l) => l.isPrimary) || locations[0];
  if (primaryPr) {
    await prisma_1.prisma.appointment.updateMany({
      where: { clinicId, practitionerId: null },
      data: { practitionerId: primaryPr.id },
    }).catch(() => null);
  }
  if (primaryLoc) {
    await prisma_1.prisma.appointment.updateMany({
      where: { clinicId, locationId: null },
      data: { locationId: primaryLoc.id },
    }).catch(() => null);
  }
  return { practitioners, locations, primaryPractitioner: primaryPr, primaryLocation: primaryLoc };
}

async function listPractitioners(clinicId) {
  const roster = await ensureClinicRoster(clinicId);
  return roster.practitioners.filter((p) => p.isActive !== false);
}

async function listLocations(clinicId) {
  const roster = await ensureClinicRoster(clinicId);
  return roster.locations.filter((l) => l.isActive !== false);
}

async function primaryPractitioner(clinicId) {
  const roster = await ensureClinicRoster(clinicId);
  return roster.primaryPractitioner || null;
}

async function primaryLocation(clinicId) {
  const roster = await ensureClinicRoster(clinicId);
  return roster.primaryLocation || null;
}
