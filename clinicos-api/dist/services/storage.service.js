"use strict";
/**
 * PHI document storage — metadata in DB, bytes on disk (or Cloudinary later).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageKeyFor = storageKeyFor;
exports.putObject = putObject;
exports.getObjectPath = getObjectPath;

const fs = require("fs");
const path = require("path");

function rootDir() {
  return process.env.DOCUMENT_STORAGE_DIR || path.join(__dirname, "../../storage/documents");
}

function storageKeyFor(clinicId, patientId, docId, filename) {
  const safe = String(filename || "file").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
  return ["clinics", clinicId, "patients", patientId, docId, safe].join("/");
}

function putObject(key, buffer) {
  const full = path.join(rootDir(), key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buffer);
  return { key, bytes: buffer.length };
}

function getObjectPath(key) {
  if (!key || key.indexOf("..") >= 0) return null;
  const full = path.join(rootDir(), key);
  if (!fs.existsSync(full)) return null;
  return full;
}
