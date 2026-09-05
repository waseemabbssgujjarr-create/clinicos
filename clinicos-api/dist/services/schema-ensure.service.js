"use strict";
/**
 * Best-effort schema ensure on boot. Uses CREATE TABLE IF NOT EXISTS and
 * ALTER TABLE with duplicate-column ignore so production MySQL stays in sync
 * without requiring prisma generate on the host.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureRuntimeSchema = ensureRuntimeSchema;

const fs = require("fs");
const path = require("path");
const { prisma } = require("../lib/prisma");
const logger_1 = require("../lib/logger");

function isIgnorable(err) {
  const m = err instanceof Error ? err.message : String(err);
  const code = err && err.code;
  return (
    code === "ER_DUP_FIELDNAME" ||
    code === "ER_DUP_KEYNAME" ||
    /Duplicate column|Duplicate key|already exists/i.test(m)
  );
}

async function exec(sql, params) {
  try {
    if (params && params.length) {
      await prisma.$executeRawUnsafe(sql, ...params);
    } else {
      await prisma.$executeRawUnsafe(sql);
    }
  } catch (err) {
    if (!isIgnorable(err)) throw err;
  }
}

async function ensureRuntimeSchema() {
  const sqlPath = path.join(__dirname, "../../prisma/migrations/add_conversation_training.sql");
  try {
    if (fs.existsSync(sqlPath)) {
      const raw = fs.readFileSync(sqlPath, "utf8");
      const statements = raw
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("--"));
      for (const stmt of statements) {
        await exec(stmt);
      }
    }
  } catch (err) {
    logger_1.logger.warn("ensureRuntimeSchema: SQL file apply failed (non-fatal)", {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  const messageAlters = [
    "ALTER TABLE `Message` ADD COLUMN `deliveryStatus` VARCHAR(32) NOT NULL DEFAULT 'sent'",
    "ALTER TABLE `Message` ADD COLUMN `senderType` VARCHAR(32) NOT NULL DEFAULT 'HUMAN'",
  ];
  for (const sql of messageAlters) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (err) {
      if (!isIgnorable(err)) {
        logger_1.logger.debug("ensureRuntimeSchema alter skipped", {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  logger_1.logger.info("Runtime schema ensure complete");
}
