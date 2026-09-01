"use strict";
/**
 * AI Training Rules Controller — Doctors My Agency
 *
 * CRUD for clinic-specific custom Q&A pairs that override AI inference.
 * All queries use $queryRawUnsafe / $executeRawUnsafe because AITrainingRule
 * was added after the Prisma client was generated — same pattern as
 * whatsapp-connection.service.js.
 *
 * Routes:
 *   GET    /api/ai/training-rules            list all rules for clinic
 *   POST   /api/ai/training-rules            create rule
 *   PATCH  /api/ai/training-rules/:id        update rule
 *   DELETE /api/ai/training-rules/:id        delete rule
 *   PATCH  /api/ai/training-rules/:id/toggle toggle isActive
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTrainingRules  = listTrainingRules;
exports.createTrainingRule = createTrainingRule;
exports.updateTrainingRule = updateTrainingRule;
exports.deleteTrainingRule = deleteTrainingRule;
exports.toggleTrainingRule = toggleTrainingRule;
// getTrainingRulesForAI is used by ai.service — exported for internal use
exports.getTrainingRulesForAI = getTrainingRulesForAI;

const { prisma }   = require("../lib/prisma");
const logger_1     = require("../lib/logger");
const asyncHandler = require("../lib/asyncHandler");
// asyncHandler may be a default export or named export
const wrap = (asyncHandler.asyncHandler || asyncHandler.default || asyncHandler);
const crypto       = require("crypto");

const VALID_CATEGORIES  = ['general','pricing','hours','treatments','booking','policies'];
const VALID_MATCH_TYPES = ['contains','exact','starts_with'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitiseRule(row) {
    return {
        id:         row.id,
        clinicId:   row.clinicId,
        question:   row.question,
        answer:     row.answer,
        category:   row.category   || 'general',
        isActive:   row.isActive === 1 || row.isActive === true,
        priority:   Number(row.priority  || 0),
        matchType:  row.matchType  || 'contains',
        createdAt:  row.createdAt,
        updatedAt:  row.updatedAt,
    };
}

function isTableMissing(err) {
    const m = err instanceof Error ? err.message : String(err);
    return m.includes('AITrainingRule') || m.includes("doesn't exist") ||
           m.includes('Unknown table') || m.includes('no such table') ||
           (err && (err.code === 'P2021' || err.code === 'P2025'));
}

// ── GET /api/ai/training-rules ─────────────────────────────────────────────

async function listTrainingRules(req, res) {
    const clinicId = req.clinicId;
    try {
        const rows = await prisma.$queryRawUnsafe(
            "SELECT * FROM `AITrainingRule` WHERE `clinicId` = ? ORDER BY `priority` DESC, `createdAt` ASC",
            clinicId
        );
        res.json({ rules: (Array.isArray(rows) ? rows : []).map(sanitiseRule) });
    } catch (err) {
        if (isTableMissing(err)) {
            // Table not yet created — return empty, tell client to run migration
            return res.json({ rules: [], migrationRequired: true });
        }
        logger_1.logger.error('listTrainingRules', { clinicId, err });
        res.status(500).json({ error: 'Could not load training rules' });
    }
}

// ── POST /api/ai/training-rules ────────────────────────────────────────────

async function createTrainingRule(req, res) {
    const clinicId = req.clinicId;
    const {
        question,
        answer,
        category   = 'general',
        isActive   = true,
        priority   = 0,
        matchType  = 'contains',
    } = req.body || {};

    if (!question || !String(question).trim()) {
        return res.status(400).json({ error: 'Question is required' });
    }
    if (!answer || !String(answer).trim()) {
        return res.status(400).json({ error: 'Answer is required' });
    }
    const cat  = VALID_CATEGORIES.includes(category)  ? category  : 'general';
    const mtyp = VALID_MATCH_TYPES.includes(matchType) ? matchType : 'contains';
    const id   = 'atr_' + crypto.randomBytes(10).toString('hex');
    const now  = new Date().toISOString().slice(0, 19).replace('T', ' ');

    try {
        await prisma.$executeRawUnsafe(
            "INSERT INTO `AITrainingRule` " +
            "  (`id`,`clinicId`,`question`,`answer`,`category`,`isActive`,`priority`,`matchType`,`createdAt`,`updatedAt`) " +
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            id,
            clinicId,
            String(question).trim().slice(0, 1000),
            String(answer).trim().slice(0, 4000),
            cat,
            isActive ? 1 : 0,
            Number(priority) || 0,
            mtyp,
            now,
            now
        );
        const rows = await prisma.$queryRawUnsafe(
            "SELECT * FROM `AITrainingRule` WHERE `id` = ? LIMIT 1", id
        );
        const rule = Array.isArray(rows) && rows[0] ? sanitiseRule(rows[0]) : null;
        res.status(201).json({ rule });
    } catch (err) {
        if (isTableMissing(err)) {
            return res.status(503).json({
                error: 'AITrainingRule table not yet created. Run: mysql -u digitals_doctoruser -p digitals_doctordb < clinicos-api/prisma/migrations/add_ai_training_rules.sql',
                migrationRequired: true,
            });
        }
        logger_1.logger.error('createTrainingRule', { clinicId, err });
        res.status(500).json({ error: 'Could not create training rule' });
    }
}

// ── PATCH /api/ai/training-rules/:id ──────────────────────────────────────

async function updateTrainingRule(req, res) {
    const clinicId = req.clinicId;
    const { id }   = req.params;
    const {
        question,
        answer,
        category,
        isActive,
        priority,
        matchType,
    } = req.body || {};

    // Verify ownership
    const existing = await getOwnedRule(clinicId, id);
    if (!existing) return res.status(404).json({ error: 'Rule not found' });

    const fields  = [];
    const values  = [];
    const now     = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (question  !== undefined) { fields.push('`question` = ?');  values.push(String(question).trim().slice(0, 1000)); }
    if (answer    !== undefined) { fields.push('`answer` = ?');    values.push(String(answer).trim().slice(0, 4000)); }
    if (category  !== undefined) { fields.push('`category` = ?');  values.push(VALID_CATEGORIES.includes(category) ? category : 'general'); }
    if (isActive  !== undefined) { fields.push('`isActive` = ?');  values.push(isActive ? 1 : 0); }
    if (priority  !== undefined) { fields.push('`priority` = ?');  values.push(Number(priority) || 0); }
    if (matchType !== undefined) { fields.push('`matchType` = ?'); values.push(VALID_MATCH_TYPES.includes(matchType) ? matchType : 'contains'); }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

    fields.push('`updatedAt` = ?');
    values.push(now);
    values.push(id, clinicId);

    try {
        await prisma.$executeRawUnsafe(
            `UPDATE \`AITrainingRule\` SET ${fields.join(', ')} WHERE \`id\` = ? AND \`clinicId\` = ?`,
            ...values
        );
        const rows = await prisma.$queryRawUnsafe(
            "SELECT * FROM `AITrainingRule` WHERE `id` = ? LIMIT 1", id
        );
        res.json({ rule: Array.isArray(rows) && rows[0] ? sanitiseRule(rows[0]) : null });
    } catch (err) {
        logger_1.logger.error('updateTrainingRule', { clinicId, id, err });
        res.status(500).json({ error: 'Could not update training rule' });
    }
}

// ── DELETE /api/ai/training-rules/:id ─────────────────────────────────────

async function deleteTrainingRule(req, res) {
    const clinicId = req.clinicId;
    const { id }   = req.params;

    const existing = await getOwnedRule(clinicId, id);
    if (!existing) return res.status(404).json({ error: 'Rule not found' });

    try {
        await prisma.$executeRawUnsafe(
            "DELETE FROM `AITrainingRule` WHERE `id` = ? AND `clinicId` = ?",
            id, clinicId
        );
        res.json({ success: true });
    } catch (err) {
        logger_1.logger.error('deleteTrainingRule', { clinicId, id, err });
        res.status(500).json({ error: 'Could not delete training rule' });
    }
}

// ── PATCH /api/ai/training-rules/:id/toggle ───────────────────────────────

async function toggleTrainingRule(req, res) {
    const clinicId = req.clinicId;
    const { id }   = req.params;

    const existing = await getOwnedRule(clinicId, id);
    if (!existing) return res.status(404).json({ error: 'Rule not found' });

    const nowActive = existing.isActive ? 0 : 1;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    try {
        await prisma.$executeRawUnsafe(
            "UPDATE `AITrainingRule` SET `isActive` = ?, `updatedAt` = ? WHERE `id` = ? AND `clinicId` = ?",
            nowActive, now, id, clinicId
        );
        res.json({ rule: { ...existing, isActive: nowActive === 1 } });
    } catch (err) {
        logger_1.logger.error('toggleTrainingRule', { clinicId, id, err });
        res.status(500).json({ error: 'Could not toggle training rule' });
    }
}

// ── Internal: used by ai.service to inject custom rules into AI prompt ────

/**
 * Returns all active rules for a clinic, sorted by priority DESC.
 * Called from processInboundMessage to inject custom Q&A into the LLM prompt.
 * Returns [] silently if table doesn't exist yet.
 */
async function getTrainingRulesForAI(clinicId) {
    try {
        const rows = await prisma.$queryRawUnsafe(
            "SELECT `question`, `answer`, `category`, `priority`, `matchType` " +
            "FROM `AITrainingRule` " +
            "WHERE `clinicId` = ? AND `isActive` = 1 " +
            "ORDER BY `priority` DESC, `createdAt` ASC " +
            "LIMIT 50",
            clinicId
        );
        return Array.isArray(rows) ? rows : [];
    } catch (_) {
        return []; // table not created yet — non-fatal
    }
}

// ── Private helper ─────────────────────────────────────────────────────────

async function getOwnedRule(clinicId, id) {
    try {
        const rows = await prisma.$queryRawUnsafe(
            "SELECT * FROM `AITrainingRule` WHERE `id` = ? AND `clinicId` = ? LIMIT 1",
            id, clinicId
        );
        return Array.isArray(rows) && rows[0] ? sanitiseRule(rows[0]) : null;
    } catch (_) {
        return null;
    }
}
