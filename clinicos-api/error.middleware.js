"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = errorMiddleware;
exports.createError = createError;
const zod_1 = require("zod");
const logger_1 = require("../lib/logger");
/**
 * Global error handler — must be registered LAST in Express middleware chain.
 * Returns consistent JSON error responses to the frontend.
 */
function errorMiddleware(err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) {
    // Validation error from Zod
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: err.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            })),
        });
        return;
    }
    // Known application error
    const statusCode = err.statusCode ?? 500;
    let code = err.code ?? 'SERVER_ERROR';
    let message = err.message ?? 'An unexpected error occurred';
    // Hide raw Prisma connection strings from end users
    // Maps: P1001 (unreachable), P1000 (auth), "Access denied", generic prisma engine text
    if (/Can't reach database server|P1001|P1000|P1017|Access denied for user|Server has gone away|prisma\./i.test(message)) {
        code = 'DB_UNAVAILABLE';
        if (/Unknown column|emailVerify/i.test(message)) {
            message = 'Email verification columns missing on Clinic table. Run: php clinicos-api/add-email-verification.php then retry resend.';
            code = 'SCHEMA_MISSING';
        }
        else {
            message = 'Database is temporarily unavailable. Admin: confirm clinicos-api/.env DATABASE_URL uses digitals_clinicuser @127.0.0.1 (not cognitom/aderalabs), add ?connection_limit=1&connect_timeout=10, run node prisma-db-check.js, then bash force-start-api.sh — do not use cPanel Restart.';
        }
    }
    // Only log 5xx errors — 4xx are expected (bad input etc.)
    if (statusCode >= 500) {
        logger_1.logger.error({
            message: err.message,
            code,
            stack: err.stack,
            url: req.url,
            method: req.method,
            clinicId: req.clinicId,
        });
    }
    res.status(statusCode >= 400 ? statusCode : 503).json({
        error: message,
        code,
        statusCode: statusCode >= 400 ? statusCode : 503,
    });
}
/** Helper to create typed AppErrors with status codes */
function createError(message, statusCode, code) {
    const err = new Error(message);
    err.statusCode = statusCode;
    err.code = code;
    return err;
}
//# sourceMappingURL=error.middleware.js.map