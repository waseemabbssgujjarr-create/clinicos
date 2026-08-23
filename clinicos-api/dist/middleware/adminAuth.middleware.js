"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuth = adminAuth;
const jwt_1 = require("../lib/jwt");
/**
 * Super Admin only middleware.
 * Only allows requests with role === SUPERADMIN.
 */
function adminAuth(req, res, next) {
    try {
        let token;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
        else if (req.cookies?.adminToken) {
            token = req.cookies.adminToken;
        }
        if (!token) {
            res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
            return;
        }
        const payload = (0, jwt_1.verifyToken)(token);
        if (payload.role !== 'SUPERADMIN') {
            res.status(403).json({ error: 'Super admin access required', code: 'FORBIDDEN' });
            return;
        }
        req.user = payload;
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
    }
}
//# sourceMappingURL=adminAuth.middleware.js.map