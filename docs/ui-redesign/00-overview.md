# 00 — Stack and architecture

Phase 0 inventory of **Clinicos** (doctorsmyagency.com). Read from the repo on 21 Sep 2026. No restyle.

## Product

Clinic operating system: appointments, patients, waiting room, clinical charting, WhatsApp + AI receptionist, billing, staff. Public site and two authenticated shells (clinic, superadmin).

Not IQPigeon. The `iqpigeon/` folder in this workspace is a reference snapshot only.

## Rendering model

**Vanilla HTML + JavaScript**, served as static files from the repo root (Apache `.htaccess` on Hostinger). There is **no React app, no Tailwind, no Next.js runtime** in the live clinic/superadmin shells.

A historical Next.js static export still exists under `clinicos-api/dist/public/_next/` and duplicated `dashboard/dashboard/` paths. Canonical sources are the **root** HTML/JS/CSS files (`/dashboard/**`, `/superadmin/**`, `/index.html`). `dashboard-bootstrap.js` still rewrites stale Railway API URLs and force-navigates dashboard/superadmin links for that old export.

Local API: Express (`clinicos-api/dist/app.js`), started via root `server.js` → `require("./clinicos-api/dist/app.js")`. Production API is reverse-proxied by `api-proxy.php` for `/api/*` and `/socket.io/*`.

There is **no TypeScript app source** in this checkout (`clinicos-api/src` is absent). Backend truth is compiled JS in `clinicos-api/dist/` plus `clinicos-api/prisma/schema.prisma`.

## Styling

| Layer | File | Role |
|---|---|---|
| Canonical tokens + components | `dma-design-system.css` (`?v=57`) | `:root` light `--ds-*` tokens, dark overlay, buttons, cards, tables, landing, auth |
| Clinic shell | `dashboard-doctor-shell.css` | `.doc-layout`, sidebar, topbar, bottom nav. Re-declares some `--doc-*` hex |
| Superadmin shell | `superadmin-theme.css` | `.sa-layout`, navy sidebar |
| Page extras | `dma-doctor-app.css`, `dma-doctor-pages.css` | Clinic page chrome |
| Feature CSS | `dashboard-whatsapp-hub.css`, others | WhatsApp hub, etc. |
| Legacy / competing | `dma-theme.css`, `dma-dashboard.css`, `dma-clinic-ui.css`, `dma-admin-ui.css`, `dashboard-layout.css`, `dashboard-unified.css`, `dashboard-professional.css`, `dashboard-fixes.css`, `clinicos-saas.css`, `platform-polish.css`, `superadmin-polish.css`, `landing.css`, … | Not the source of truth; still on disk |

`:root` is **light** (`--ds-bg: #F7F8FA`, `--ds-primary: #14967F`). `html[data-theme="dark"]` remaps **legacy** aliases (`--bg`, `--text-1`, `--doc-*`) but **does not remap `--ds-*`**, which most new classes use. Clinic/superadmin static pages do **not** load `dashboard-bootstrap.js`, so they have no theme toggle.

Landing (`html.dma-world-public`) is a dark DMA OS marketing surface inside the same CSS file. Auth (`html.dma-world-auth`) is a light split layout with teal panel.

## Type (conflict with master prompt)

Master prompt asked for one UI sans. **Keep current pairing unless later approved:**

- Headings: Montserrat 600/700/800 (`--ds-font-display`)
- Body/UI: Plus Jakarta Sans, Inter fallback (`--ds-font`)

Google Fonts loaded from HTML heads and from `@import` in `dma-design-system.css` (duplicated).

## Shells

**Clinic** — `dashboard-doctor-shell.js`

- Token check: injects `dma-design-system.css` if missing
- `ALL_ITEMS` catalog + `navFor(user)` grouped nav
- `WORKSPACES` pill tabs for related routes
- `OWNER_ONLY` path gate (staff redirected to `/dashboard/`)
- Header: WhatsApp chip (owner), readonly search opening command palette, Updates badge, Book, user + logout
- Mobile: off-canvas sidebar + bottom nav (4 items + More)
- Auth: `localStorage.token`; login path doctor vs staff

**Superadmin** — `superadmin-admin-shell.js`

- `NAV_GROUPS` (Platform / Business / Operations / System)
- `SA_WORKSPACES` tabs for routes not in the primary nav
- `DmaAdminShell.api()` with retries on 5xx/DB errors
- Auth: `localStorage.token`; login `/admin-login/`
- Clinics copy states impersonation is **not available** — do not add it

**Shared UI** — `dma-ui.js` (`DmaUI`): toast, copy, badge, kv, skeleton, drawer, modal, confirm, focus trap, tablist, emptyState, command palette.

**App runtime** — `dma-doctor-app.js` (`DmaApp`): token/user from `localStorage` (`token` + Zustand-shaped `clinicos-store`), `fetch` wrappers, 401 → login, formatters.

**Page mount**

- `dma-doctor-pages.js` (`DmaPages.mount`): home, appointments, patients, patient detail, messages, ai, analytics, reviews, staff, billing, settings, notifications
- `dma-clinicos-inner.js` (`DmaInner.mountPage`): calendar, waiting, doctors, rooms, clinical, vitals, prescriptions, laboratory, telemedicine, payments, tasks, inventory, documents, leave, locations, reports, operations, communication, consult
- `dma-clinicos-clinical.js` (`DmaClinical`): visit/queue state, chart parse, `canChart` / `canPrescribe`
- `dma-ai-training.js`: AI receptionist tabbed training
- `dashboard-whatsapp-hub.js`: WhatsApp command center (no `data-page`; own root `#dma-wa-command-center`)
- Broadcasts and leads: page-local scripts in their `index.html`

## Data fetching

No React Query / SWR. Pages call `DmaApp.get/post/patch/del` or `DmaAdminShell.api` against same-origin `/api/*`. Socket.io exists on the API (`join:clinic` gated by JWT `clinicId` or SUPERADMIN). Clinic shell unread badge: `GET /api/notifications/unread-count`. WhatsApp status: `DmaApp.waStatus()`.

Forms: mostly imperative DOM. Server validation via Zod in `clinicos-api/dist/schemas/*.js`. **No shared client/server schema.**

Charts: **no Chart.js / Recharts**. Analytics pages render numbers and lists. Clinical “chart” means medical record JSON, not a graph.

i18n: **none**. Copy is hard-coded English in HTML/JS.

## Auth

| Actor | Login | JWT `role` | Cookie |
|---|---|---|---|
| Clinic owner | `/doctor-login/` → `POST /api/auth/login` | `DOCTOR` | `token` |
| Staff | `/staff-login/` → `POST /api/auth/staff/login` | `STAFF` + `staffRole` | `token` |
| Superadmin | `/admin-login/` → `POST /api/auth/superadmin/login` | `SUPERADMIN` | `token` (API also accepts `adminToken`) |
| Patient portal | OTP `/api/patient/*` | `PATIENT` | Bearer |

UI often labels the clinic owner **Owner**. API middleware `doctorOnly` checks `role === 'DOCTOR'`. Shell `isOwner()` is `role !== 'STAFF'`.

Tenant isolation: controllers filter by `req.clinicId`. `tenantGuard.middleware.js` exists but is **not wired** to any route file.

## Tests / tooling

- Root `package.json`: `start` → `node server.js`. No lint/test scripts.
- API tests (compiled): `clinicos-api/dist/__tests__/` — auth, patients, appointments, webhooks, clinical-domain unit.
- No frontend test runner, no axe CI, no visual regression.
- Prisma 5.14, Express 4.19, Socket.io, Stripe, Twilio, OpenAI, Zod, Winston, Helmet, rate-limit.

## What this means for later phases

Phase 1 must be a **token/CSS/JS layer on this vanilla stack**, not a component library that assumes React or Tailwind. Style guide = static `/dev/ui/`. Do not touch API contracts.
