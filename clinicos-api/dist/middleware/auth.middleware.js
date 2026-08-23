"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.doctorOnly = doctorOnly;
exports.doctorOrStaff = doctorOrStaff;
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
//# sourceMappingURL=auth.middleware.js.map