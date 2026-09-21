# 02 — Roles and permissions

From JWT auth, Express middleware, Prisma `StaffRole`, and shell `navFor` / `NAV_GROUPS`. UI checks are convenience; server is authoritative.

## Identity model

| UI label | JWT `role` | Extra claims | Login |
|---|---|---|---|
| Clinic owner / “Doctor” | `DOCTOR` | `clinicId`, email | `/doctor-login/` |
| Staff | `STAFF` | `clinicId`, `staffRole` | `/staff-login/` |
| Superadmin | `SUPERADMIN` | `clinicId: ''` | `/admin-login/` |
| Patient | `PATIENT` | `clinicId`, patient id | OTP `/api/patient/*` |

Prisma `StaffRole`: `RECEPTIONIST` (default), `NURSE`, `ASSISTANT`, `MANAGER`.

Shell `staffRoleOf()`: if `role === 'STAFF'`, use `user.staffRole || user.clinicRole` or JWT payload; default `RECEPTIONIST`. `isOwner()` = `role !== 'STAFF'` (so any non-staff JWT is treated as owner, including theoretically SUPERADMIN if they opened `/dashboard/` — they should not).

Naming drift: UI “Owner” vs API `DOCTOR` vs page titles “Doctor”. See glossary.

## Server middleware (`clinicos-api/dist/middleware/auth.middleware.js`)

| Helper | Rule |
|---|---|
| `authMiddleware` | Bearer or `cookie.token`; sets `req.user`, `req.clinicId` |
| `doctorOnly` | `role === 'DOCTOR'` else 403 |
| `doctorOrStaff` | `DOCTOR` or `STAFF` |
| `staffRoleOf` | `DOCTOR` → `'OWNER'`; else `staffRole` |
| `canChart` | OWNER or NURSE |
| `canPrescribe` | OWNER only |
| `requireChart` / `requirePrescribe` | 403 with generic message |
| `requireStaffRoles([...])` | DOCTOR always; STAFF if `staffRole` in list |
| `adminAuth` | `role === 'SUPERADMIN'` only |

`tenantGuard` is **defined and unused**. Clinic scoping is done inside controllers via `req.clinicId`.

Suspended clinic: staff login 403 `CLINIC_SUSPENDED`. Inactive staff: `ACCOUNT_INACTIVE`. Unverified staff email: `EMAIL_NOT_VERIFIED`.

## API surface by gate

**`doctorOnly` (owner)** — staff, settings, billing, WhatsApp, AI, analytics, reviews, rooms write, inventory, tele-sessions, practitioners/locations create, leave/blocks write.

**`doctorOrStaff`** — appointments, patients (delete/magic-link still `doctorOnly`), messages, leads list, notifications (auth only), clinical reads, roster, documents, coverages/claims reads.

**`requireChart` (owner + nurse)** — save encounter, lab orders/results.

**`requirePrescribe` (owner)** — issue/cancel prescription.

**`requireStaffRoles(['RECEPTIONIST','MANAGER'])` named `arWrite`** — create/void patient invoices, record payment, create coverage/claim. **Owner (DOCTOR) is allowed** by `requireStaffRoles` (doctor short-circuit). Nurses/assistants cannot write AR.

**Public / unauthenticated** — `/api/public/*`, auth register/login/forgot/reset/invite/verify, Meta/Twilio/Stripe webhooks, `/api/leads/features` + `platform-status` + `deploy-check` (no auth — ops diagnostics, not clinic data).

**Patient JWT** — list/cancel own appointments (cancel blocked if < 2 hours).

**Superadmin** — `/api/superadmin/*` after `adminAuth`.

**Internal bridge** — `/api/internal/*` header key, not a user role.

WhatsApp comment in routes: “all routes require an authenticated doctor” — matches `doctorOnly`. Staff cannot hit WhatsApp APIs even if they guessed the URL. Shell also blocks `OWNER_ONLY` paths.

## Clinic nav — how it is filtered

Single catalog `ALL_ITEMS` in `dashboard-doctor-shell.js`. `navFor(user)` returns **groups**, not a flat permission matrix.

### Owner (`!staffRole`, i.e. not STAFF)

| Group | Items |
|---|---|
| Clinic | Dashboard, Patients |
| Front desk | Schedule, Waiting Room, Inbox, WhatsApp |
| Care | Consultations |
| Practice | Team, Operations (`/dashboard/rooms/`) |
| Grow | AI Receptionist, Analytics |
| Setup | Settings |

Not in owner sidebar but still routed (workspace tabs or direct URL): Calendar, Broadcasts, Vitals, Prescriptions, Laboratory, Documents, Telemedicine, Inventory, Leave, Locations, Billing, Reviews, Reports, Doctors, Payments, Tasks, Updates, Leads.

`OWNER_ONLY` path prefixes (staff hitting these → `/dashboard/`):  
`whatsapp`, `broadcasts`, `ai`, `analytics`, `reviews`, `billing`, `settings`, `rooms`, `inventory`, `telemedicine`, `laboratory`, `prescriptions`.

Workspace tabs (`WORKSPACES`) further hide `OWNER_ONLY` hrefs for staff.

### Nurse

One group **Care**: Dashboard, Patients, Waiting Room, Vitals, Consultations, Schedule.

### Manager

Care: Dashboard, Schedule, Patients. Team: Doctors, Team. Operations: Operations. Insights: Reports.

### Assistant

Care: Dashboard, Schedule, Patients. Operations: Tasks, Inbox.

### Receptionist (any other `staffRole`, including default)

Care: Dashboard, Schedule, Calendar, Patients. Operations: Waiting Room, Payments, Inbox.

Bottom nav prefers: owner Home/Appts/WhatsApp/Patients; nurse Home/Waiting/Patients/Vitals; else Home/Appts/Patients/Inbox.

**Gap:** `leads` is in `ALL_ITEMS` (`/dashboard/leads/`) but **not in any `navFor` group**. Page exists; discovery is poor. Do not add it to nav in Phase 0–2 without approval (that would be a nav change, not a restyle).

**Gap:** UI can show Consultations to receptionists via owner workspace “Care” only when owner; receptionist nav has no clinical. Nurses get clinical. Matches `canChart` approximately (nurse + owner). Receptionist opening `/dashboard/clinical/` is **not** in `OWNER_ONLY`, so the HTML loads; save is 403 via `requireChart`. Phase 2 should hide or disable, not change the API.

Staff list/invite API is `doctorOnly`. Manager nav shows Team/Doctors but `GET /api/staff` will 403 for managers. Roster `GET /api/roster` is `doctorOrStaff`. Flag: manager “Team” may be a dead/partial screen — verify with API in Phase 5, do not invent a new staff-admin API now.

## Superadmin nav

`NAV_GROUPS` in `superadmin-admin-shell.js` — **not** role-filtered (only SUPERADMIN reaches the shell).

| Group | Items |
|---|---|
| Platform | Overview `/superadmin/`, Clinics, Users |
| Business | Billing `/superadmin/subscriptions/` |
| Operations | WhatsApp |
| System | Settings |

Workspace tabs (not primary nav): Stripe/Plans, Revenue/Analytics, Announcements, Support, Security, Health, Audit, Integrations, API.

No impersonation endpoint in `superadmin.routes.js`. Clinics UI: “impersonation is not available.”

## Permission-aware UI today

- Nav generation is the main hide mechanism.
- `DmaClinical.canChart` / `canPrescribe` hide some consult/lab/rx actions in inner pages.
- No shared permission helper used by both nav and buttons (master prompt §8.3). Phase 1 may add a **client** helper that **mirrors** server rules; must not replace middleware.
- Elevated/acting-as-user mode: **does not exist**. Do not add.

## Matrix (capability, not every route)

| Capability | Owner | Recept. | Nurse | Assistant | Manager | Superadmin | Patient |
|---|---|---|---|---|---|---|---|
| Clinic dashboard | Y | Y (subset) | Y (subset) | Y (subset) | Y (subset) | N (own shell) | N |
| Appointments CRUD | Y | Y | Y | Y | Y | inspect via clinic detail APIs | own cancel |
| Waiting room | Y | Y | Y | N nav | N nav | — | — |
| Patients | Y | Y | Y | Y | Y | inspect | — |
| Delete patient / magic link | Y | N | N | N | N | — | — |
| Chart / vitals / labs | Y | read? 403 write | Y | N | N | inspect AI/activity | — |
| Prescribe | Y | N | N | N | N | — | — |
| WhatsApp connect / hub | Y | N | N | N | N | list/revoke connections | — |
| AI train / publish | Y | N | N | N | N | inspect clinic AI | — |
| Analytics / reviews / billing / settings | Y | N | N | N | reports nav only | platform billing | — |
| Invoices / payments write | Y | Y | N | N | Y | — | — |
| Staff invite | Y | N | N | N | nav only; API 403 | users list | — |
| Suspend clinic / override plan | N | N | N | N | N | Y | — |
