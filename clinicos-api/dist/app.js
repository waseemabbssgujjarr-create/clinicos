"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.httpServer = exports.app = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("./lib/logger");
const error_middleware_1 = require("./middleware/error.middleware");
const notification_service_1 = require("./services/notification.service");
const scheduler_1 = require("./jobs/scheduler");
// Routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const appointments_routes_1 = __importDefault(require("./routes/appointments.routes"));
const patients_routes_1 = __importDefault(require("./routes/patients.routes"));
const messages_routes_1 = __importDefault(require("./routes/messages.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const staff_routes_1 = __importDefault(require("./routes/staff.routes"));
const billing_routes_1 = __importDefault(require("./routes/billing.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const notifications_routes_1 = __importDefault(require("./routes/notifications.routes"));
const superadmin_routes_1 = __importDefault(require("./routes/superadmin.routes"));
const public_routes_1 = __importDefault(require("./routes/public.routes"));
const patient_routes_1 = __importDefault(require("./routes/patient.routes"));
const reviews_routes_1 = __importDefault(require("./routes/reviews.routes"));
const leads_routes_1 = __importDefault(require("./routes/leads.routes"));
const whatsapp_routes_1 = __importDefault(require("./routes/whatsapp.routes"));
// Webhooks
const twilio_webhook_1 = __importDefault(require("./webhooks/twilio.webhook"));
const meta_webhook_1 = __importDefault(require("./webhooks/meta.webhook"));
const internal_routes_1 = __importDefault(require("./routes/internal.routes"));
const stripe_webhook_1 = __importDefault(require("./webhooks/stripe.webhook"));
const app = (0, express_1.default)();
exports.app = app;
const httpServer = (0, http_1.createServer)(app);
exports.httpServer = httpServer;
// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});
exports.io = io;
(0, notification_service_1.setSocketServer)(io);
io.on('connection', (socket) => {
    socket.on('join:clinic', (clinicId) => {
        socket.join(clinicId);
        logger_1.logger.debug(`Socket joined clinic room: ${clinicId}`);
    });
    socket.on('disconnect', () => {
        logger_1.logger.debug(`Socket disconnected: ${socket.id}`);
    });
});
// ── Security ──────────────────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use((0, helmet_1.default)({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// ── Rate Limiting ─────────────────────────────────────────────────────────────
app.use((0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.', code: 'RATE_LIMIT' },
}));
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many login attempts. Try again in 15 minutes.', code: 'AUTH_RATE_LIMIT' },
});
// ── Stripe webhook MUST receive raw body — register BEFORE express.json() ────
app.use('/api/webhooks/stripe', express_1.default.raw({ type: 'application/json' }), stripe_webhook_1.default);
// ── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
// ── HSTS in production ────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
    app.use((_req, res, next) => {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        next();
    });
}
// ── IQ Pigeon SalesBot proxy (same-origin — avoids CORS on widget config) ─────
const IQPIGEON_CHAT = 'https://iqpigeon.com/api/chat-widget.php';
const BRAND_WIDGET_COLOR = '#F97316';
async function proxyIqPigeonChat(req, res) {
    try {
        const url = new URL(IQPIGEON_CHAT);
        for (const [k, v] of Object.entries(req.query)) {
            if (v != null && v !== '')
                url.searchParams.set(k, String(v));
        }
        const opts = {
            method: req.method,
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        };
        if (req.method === 'POST')
            opts.body = JSON.stringify(req.body ?? {});
        const upstream = await fetch(url.toString(), opts);
        const text = await upstream.text();
        let payload = text;
        try {
            const data = JSON.parse(text);
            if (data && data.success) {
                data.widget_color = BRAND_WIDGET_COLOR;
                data.widgetColor = BRAND_WIDGET_COLOR;
                payload = JSON.stringify(data);
            }
        }
        catch (_) { /* pass through raw */ }
        res.status(upstream.status).type('application/json').send(payload);
    }
    catch (err) {
        res.status(502).json({ success: false, error: 'Chat proxy unavailable' });
    }
}
app.get('/api/chat-widget.php', proxyIqPigeonChat);
app.post('/api/chat-widget.php', proxyIqPigeonChat);
// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        app: 'Doctors My Agency AI',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
    });
});
// Lightweight Prisma probe (proves DB; /api/leads/features is static and does NOT)
app.get('/api/health/db', async (_req, res) => {
    const url = process.env.DATABASE_URL || '';
    const userMatch = url.match(/^mysql:\/\/([^:/]+):/);
    const hostMatch = url.match(/@([^:/]+):\d+/);
    const dbMatch = url.match(/:(\d+)\/([^?]+)/);
    const masked = {
        user: userMatch ? userMatch[1] : null,
        host: hostMatch ? hostMatch[1] : null,
        db: dbMatch ? dbMatch[2] : null,
    };
    if (masked.user && /cognitom/i.test(masked.user)) {
        res.status(503).json({
            ok: false,
            code: 'WRONG_SITE_DB',
            error: 'DATABASE_URL points at old cognitom user — use digitals_clinicuser / digitals_clinicdb on workee',
            ...masked,
        });
        return;
    }
    try {
        const { prisma } = require('./lib/prisma');
        await prisma.$queryRaw `SELECT 1 AS ok`;
        let clinicCount = null;
        try {
            clinicCount = await prisma.clinic.count();
        }
        catch (_) { /* table may be missing during migrate */ }
        res.json({
            ok: true,
            select1: 'ok',
            clinic_count: clinicCount,
            ...masked,
            note: 'Prisma reachable — unlike /api/leads/features which is static JSON',
        });
    }
    catch (err) {
        res.status(503).json({
            ok: false,
            code: 'DB_UNAVAILABLE',
            error: err instanceof Error ? err.message : String(err),
            ...masked,
        });
    }
});
// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, auth_routes_1.default);
app.use('/api/appointments', appointments_routes_1.default);
app.use('/api/patients', patients_routes_1.default);
app.use('/api/messages', messages_routes_1.default);
app.use('/api/ai', ai_routes_1.default);
app.use('/api/analytics', analytics_routes_1.default);
app.use('/api/staff', staff_routes_1.default);
app.use('/api/billing', billing_routes_1.default);
app.use('/api/settings', settings_routes_1.default);
app.use('/api/notifications', notifications_routes_1.default);
app.use('/api/superadmin', superadmin_routes_1.default);
app.use('/api/public', public_routes_1.default);
app.use('/api/patient', patient_routes_1.default);
app.use('/api/reviews', reviews_routes_1.default);
app.use('/api/leads', leads_routes_1.default);
app.use('/api/whatsapp', whatsapp_routes_1.default);
app.use('/api/internal', internal_routes_1.default);
app.use('/api/webhooks/twilio', twilio_webhook_1.default);
app.use('/api/webhooks/meta', meta_webhook_1.default);
// ── Static frontend (production only) ────────────────────────────────────────
// On cPanel, Phusion Passenger routes ALL traffic through this Node.js process.
// The compiled Next.js static export (out/) is copied to dist/public/ at deploy time.
// API routes above take priority; everything else serves the React SPA.
if (process.env.NODE_ENV === 'production') {
    const frontendPath = path_1.default.join(__dirname, 'public');
    app.use(express_1.default.static(frontendPath));
    // Unmatched /api/* must return JSON — never SPA index.html (fixes DELETE parse errors)
    app.use('/api', (_req, res) => {
        res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
    });
    // SPA fallback — non-API GET routes only
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api/')) {
            res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
            return;
        }
        res.sendFile(path_1.default.join(frontendPath, 'index.html'));
    });
}
else {
    // ── 404 for local dev (frontend runs separately on port 3000) ──────────────
    app.use((_req, res) => {
        res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
    });
}
// ── Global error handler (must be last) ──────────────────────────────────────
app.use(error_middleware_1.errorMiddleware);
// ── Start Server ──────────────────────────────────────────────────────────────
// cPanel Phusion Passenger passes a Unix socket path via process.env.PORT
// (looks like "/path/to/passenger.socket"). Fall back to numeric port for local dev.
const PORT_OR_SOCKET = process.env.PORT ?? 3001;
const isSocket = typeof PORT_OR_SOCKET === 'string' && PORT_OR_SOCKET.startsWith('/');
const listenTarget = isSocket ? PORT_OR_SOCKET : Number(PORT_OR_SOCKET);
const listenHost = isSocket ? undefined : '127.0.0.1';
httpServer.listen(listenTarget, listenHost, () => {
    logger_1.logger.info(`🚀 Doctors My Agency AI listening on ${listenTarget} [${process.env.NODE_ENV ?? 'development'}]`);
    if (process.env.NODE_ENV !== 'test') {
        try {
            (0, scheduler_1.startScheduler)();
        } catch (err) {
            logger_1.logger.error('Scheduler failed to start (non-fatal)', { err });
        }
    }
});
//# sourceMappingURL=app.js.map