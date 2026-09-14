"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.doctorOnly = doctorOnly;
exports.doctorOrStaff = doctorOrStaff;
exports.staffRoleOf = staffRoleOf;
exports.canChart = canChart;
exports.canPrescribe = canPrescribe;
exports.requireChart = requireChart;
exports.requirePrescribe = requirePrescribe;
exports.requireStaffRoles = requireStaffRoles;
const jwt_1 = require("../lib/jwt");
function authMiddleware(req, res, next) {
    try {
        let token;
        const auth = req.headers.authorization;
        if (auth?.startsWith('Bearer ')) {
            token = auth.split(' ')[1];
        }
        else if (req.cookies?.token) {
            token = req.cookies.token;
        }
        if (!token) {
            res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
            return;
        }
        const payload = (0, jwt_1.verifyToken)(token);
        req.user = payload;
        req.clinicId = payload.clinicId || undefined;
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
    }
}
function doctorOnly(req, res, next) {
    if (req.user?.role !== 'DOCTOR') {
        res.status(403).json({ error: 'Doctor access required', code: 'FORBIDDEN' });
        return;
    }
    next();
}
function doctorOrStaff(req, res, next) {
    if (req.user?.role !== 'DOCTOR' && req.user?.role !== 'STAFF') {
        res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
        return;
    }
    next();
}

function staffRoleOf(req) {
    if (req.user?.role === 'DOCTOR') return 'OWNER';
    return String(req.user?.staffRole || '').toUpperCase();
}

function canChart(req) {
    const role = staffRoleOf(req);
    return role === 'OWNER' || role === 'NURSE';
}

function canPrescribe(req) {
    return staffRoleOf(req) === 'OWNER';
}

function requireChart(req, res, next) {
    if (!canChart(req)) {
        res.status(403).json({ error: "You don't have permission to perform this action.", code: 'FORBIDDEN' });
        return;
    }
    next();
}

function requirePrescribe(req, res, next) {
    if (!canPrescribe(req)) {
        res.status(403).json({ error: "You don't have permission to perform this action.", code: 'FORBIDDEN' });
        return;
    }
    next();
}

function requireStaffRoles(roles) {
    const allowed = (roles || []).map((r) => String(r).toUpperCase());
    return function (req, res, next) {
        if (req.user?.role === 'DOCTOR') {
            next();
            return;
        }
        const sr = staffRoleOf(req);
        if (req.user?.role === 'STAFF' && allowed.indexOf(sr) >= 0) {
            next();
            return;
        }
        res.status(403).json({ error: "You don't have permission to perform this action.", code: 'FORBIDDEN' });
    };
}
//# sourceMappingURL=auth.middleware.js.map