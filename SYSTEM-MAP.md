# ClinicOS / Doctors My Agency — system map

Inventory of architecture, every live surface, tabs, action buttons, and design tokens.

**Source:** local working tree (Phases 1–5).  
**Not committed. Not pushed. Not on production.**

---

## Snapshot

| | |
|---|---|
| Login identities | 3 (clinic owner, staff, superadmin) |
| Clinic nav destinations | 28 |
| Visual systems | 2 (marketing vs clinic) |
| Pages with APIs but UI still “unavailable” | Rooms, Laboratory, Inventory, several patient-chart tabs |

**Largest remaining gap:** not missing screens. Phase 5 APIs exist (rooms, lab, inventory, documents, patient AR, leave, insurance). The clinic UI still shows “Module unavailable” on those pages.

Do not invent occupancy, stock, labs, or video. Wire the existing APIs into the existing shells.

---

## Architecture

Vanilla HTML/JS at the site root. Express API in `clinicos-api/dist`. MySQL via Prisma. Production is **Middlehost / cPanel** (`https://doctorsmyagency.com`): Apache serves HTML/CSS/JS; Node listens on port **3002**; `/api` is proxied by `api-proxy.php`.

| Layer | What it is | Canonical files |
|---|---|---|
| Marketing / portals | Landing, register, three logins, demo, pricing | `index.html`, `landing.css`, `portal.css` — Inter + Montserrat, blue dark theme |
| Clinic app | Owner + staff dashboard | `dma-design-system.css` + `dma-ui.js`. Shell: `dashboard-doctor-shell.js`. Pages: `dma-doctor-pages.js` + `dma-clinicos-inner.js`. Clinical contract: `dma-clinicos-clinical.js` |
| Platform admin | SUPERADMIN only | `superadmin-admin-shell.js`, `superadmin-clinics.js`, `dma-design-system.css` |
| API | Express compiled JS (no `src/` TypeScript tree) | `clinicos-api/dist/*`. Schema-ensure SQL on boot. `OWNER_ONLY` stays `doctorOnly`. |
| Clinical domain | Encounter graph + DmaClinical DTO | `{ patient, appointment, vitals, diagnoses, clinicalNote, prescriptions, followUp }` |
| Billing split | Never mix | Stripe `Invoice` = SaaS. `Appointment.fee` = visit fee. `PatientInvoice` = AR (API only). |

### Production paths

| Piece | Server path |
|---|---|
| Site root (HTML/JS/CSS) | `/home/digitals/doctorsmyagency.com/` |
| API | `/home/digitals/doctorsmyagency.com/clinicos-api/` |
| Startup file | `clinicos-api/dist/bootstrap.js` |
| Schema updates | Applied on API boot from SQL files (not Prisma Migrate) |

Deploy **both** trees. Uploading only the API leaves stale UI. Uploading only the site root leaves old appointment/clinical APIs.

---

## Identities (do not invent new ones)

| Login | Role stored | Workspace | Staff-callable |
|---|---|---|---|
| `/doctor-login/` | `DOCTOR` (clinic owner) | `/dashboard/` | Full nav including OWNER_ONLY |
| `/staff-login/` | `STAFF` + `RECEPTIONIST` \| `NURSE` \| `ASSISTANT` \| `MANAGER` | `/dashboard/` (filtered nav) | Appointments, patients, messages, leads |
| `/admin-login/` or `/superadmin/login/` | `SUPERADMIN` | `/superadmin/` | Platform only — no clinic impersonation |

**OWNER_ONLY** (API + UI gate): WhatsApp, broadcasts, Train AI, analytics, reviews, SaaS billing, settings, rooms, inventory, telemedicine, laboratory, prescriptions. Staff invite is owner-only.

Staff cannot reach owner pages by URL; the shell redirects them.

### Owner nav groups

Overview · Care · Team · Operations · Insights · Configuration · **More** (13 overflow items).

### Staff nav (by `staffRole`)

| Role | Visible |
|---|---|
| Receptionist (default) | Home, Appointments, Calendar, Patients, Waiting, Payments, Messages |
| Nurse | Home, Patients, Waiting, Vitals, Clinical, Appointments |
| Manager | Home, Appointments, Patients, Doctors, Staff, Operations, Reports |
| Assistant | Home, Appointments, Patients, Tasks, Messages |

---

## Design tokens

### Clinic + superadmin (canonical)

Do not add `*-fix.css` / `*-polish.css`. One source: `dma-design-system.css` + `dma-ui.js`.

**Fonts:** Plus Jakarta Sans, Inter fallback (Google Fonts).

| Token | Value |
|---|---|
| Primary | `#14967F` |
| Primary hover | `#0E7A68` |
| Canvas | `#F4F4F5` |
| Surface | `#FFFFFF` |
| Text | `#191919` |
| Muted | `#A3A3A3` |
| Border | `#E8E8EA` |
| Sidebar | `#191919` / `#111827`, white text |
| Accent | `#FAD069` |
| Danger | `#B91C1C` |
| Warning | `#B45309` |
| Sidebar width | 240px |
| Control height | 40px |
| Card radius | 16px |

### Marketing / portal (legacy)

Used by `/`, `/start/`, logins, register, demo, pricing.

**Fonts:** Inter (body), Montserrat (headings).

| Token | Value |
|---|---|
| Default theme | Dark `#0a0b10` with light toggle |
| Accent | Blue `#2563EB` / `#3B82F6` |
| Teal | `#14B8A6` |
| CTA | Gradient blue buttons, purple/blue glows |
| CSS | `landing.css`, `portal.css`, `dma-theme.css`, `platform-hovers.css` |

After Sign In the user jumps from blue/Montserrat marketing into teal/grey ClinicOS. That is remaining brand work, not a missing page.

---

## What to fix, in order

1. **Wire Phase 5 APIs into existing clinic pages** — rooms, laboratory (orders/results, not instruments), inventory ledger, patient documents, patient AR, leave on Doctors. Keep honest empty if the clinic has no rows. Never invent quantities or occupancy.
2. **Patient chart tabs** — Prescriptions, Lab, Documents, Insurance, Audit still say “not a separate module”. Point them at Encounter / LabOrder / PatientDocument / Coverage / AuditLog APIs.
3. **Collapse nav duplicates** — Owner More dumps 13 items. Analytics and Reports both exist. `/dashboard/communication/` redirects to Messages. Keep one Reports entry.
4. **Align marketing chrome** — Bring `/`, `/start`, logins, register onto `dma-design-system` (or a thin marketing layer using the same teal/grey tokens).
5. **Payments vs AR** — Payments lists `appointment.fee` only. Rename it “Visit fees” or add Patient AR (invoice / partial / refund) using `PatientInvoice` APIs — without touching Stripe SaaS billing.
6. **Doctors leave** — Page still prints “No leave calendar on this platform” while Leave + ScheduleBlock APIs exist. Slot engine already respects blocks.
7. **Telemedicine** — Keep honest until a real video provider is connected. `TeleSession` requires `provider`. Do not build a fake call UI.
8. **Ship** — Commit, push, then dual-upload site root + `clinicos-api` (including `generated/prisma` and `phase5_clinical_domain.sql`). Restart Node.

**Rule:** Keep DmaClinical, role identities, and OWNER_ONLY. Do not redesign the application UI.

---

## Public and account pages

| Page | Route | Tabs / steps | Actions | State |
|---|---|---|---|---|
| Landing | `/` | Features, Signature, Pricing, FAQ (anchors) | Start Free Trial, AI Demo, Sign In, Portal, theme toggle | Live |
| Portal chooser | `/start/` | Doctor / Staff / Patient cards | Register, Doctor Sign In, Staff Sign In, Accept Invite, My Appointments | Live |
| Doctor login | `/doctor-login/` | Doctor \| Staff (link) | Sign In, Forgot password, Start free trial | Live |
| Staff login | `/staff-login/` | Doctor \| Staff | Sign In, Accept invite | Live |
| Superadmin login | `/admin-login/` and `/superadmin/login/` | None | Sign In | Live |
| Register | `/register/` → `/register/clinic/` → `/register/hours/` → `/register/plan/` | 4 steps | Create account, continue, pick plan (14-day trial, no card) | Live |
| Forgot / reset / verify | `/forgot-password/`, `/reset-password/`, `/verify/`, `/verify-email/` | None | Send email, set password, confirm | Live |
| Accept invite | `/accept-invite/` | None | Set staff password from token | Live |
| Patient booking | `/patients/clinic/{slug}`, `/book/` | Slot pick | Book with name/phone — no account | Live |
| My appointments | `/my-appointments/` | None | Lookup by phone, cancel | Live |
| AI demo / pricing / about | `/demo/`, `/pricing/`, `/about/` | Pricing cards | Trial CTAs | Live |

---

## Clinic app — page by page

Legend: **Live** = wired to real APIs. **Honest empty** = page exists and tells the truth. **API only** = Phase 5 backend exists, UI not wired. **Stub** = redirect or duplicate.

| Page | Route | Tabs | Primary actions | State |
|---|---|---|---|---|
| Dashboard | `/dashboard/` | None | New appointment, Add patient, Start consultation, Record payment, Check in (today’s list) | Live |
| Appointments | `/dashboard/appointments/` | Day, Week, Month, Agenda, List | + New appointment (4-step wizard), Export, Print, Filters. Per visit: Open, Confirm, Check in, Call, Start, Complete, Reschedule, No show, Cancel, Chart, Consult | Live |
| Calendar | `/dashboard/calendar/` | Day strip | Same visit actions as appointments | Live |
| Waiting Room | `/dashboard/waiting/` | None | Call patient → Start. Flow ARRIVED → WAITING → CALLED → IN_PROGRESS | Live |
| Patients | `/dashboard/patients/` | Search | Add patient, Message, Book. Row opens drawer | Live |
| Patient drawer | overlay | Overview, Appointments, Messages, Notes, Activity | Open full chart, Message, Book | Live |
| Patient chart | `/dashboard/patients/detail/` | Overview, Clinical, Visits, Appointments, Prescriptions, Medications, Lab, Documents, Billing, Payments, Insurance, Communication, Notes, Audit | Appointment, Consult, Message, Prescription. Notes: Save notes | Mixed — see below |
| Clinical / Consult | `/dashboard/clinical/`, `/dashboard/consult/` | Encounter form (complaint, history, exam, assessment, Rx lines, labs, follow-up) | Save draft, Complete visit (owner/nurse) | Live via Encounter API |
| Vitals | `/dashboard/vitals/` | Same form, vitals mode | Save vitals (does not invent empty fields) | Live |
| Prescriptions | `/dashboard/prescriptions/` | Rx mode of consult | Issue into chart (not pharmacy). Owner only | Live; no e-prescribe rail |
| Doctors | `/dashboard/doctors/` | None | Working hours link. Lists roster from `/api/roster` | Partial — leave KPI still “not on this platform” |
| Staff | `/dashboard/staff/` | None | Invite staff, change role (RECEPTIONIST / NURSE / ASSISTANT / MANAGER) | Live, owner API |
| Messages | `/dashboard/messages/` | Thread list | Send WhatsApp reply, Chart, Book, Broadcast (owner) | Live |
| Communication | `/dashboard/communication/` | — | Redirects to Messages | Stub |
| WhatsApp | `/dashboard/whatsapp/` | Hub (connect / status) | Connect Meta, Inbox, Train AI | Live, owner |
| Broadcasts | `/dashboard/broadcasts/` | None | Send broadcast to patients | Live, owner |
| Train AI | `/dashboard/ai/` | Personality, Clinic knowledge, Services, Business rules, Booking rules, Custom replies, Customer handling, Human-like, Test chat, Publish, Activity | Save draft per tab, Publish, Test chat | Live, owner |
| Leads | `/dashboard/leads/` | None | Open lead, update status (owner patch) | Live |
| Reviews | `/dashboard/reviews/` | None | Needs Google Place ID in Settings | Live if Place ID set; otherwise honest empty |
| Analytics | `/dashboard/analytics/` | Clinical, Operational, Financial | Read-only KPIs (visit fees, not SaaS MRR) | Live, owner |
| Reports | `/dashboard/reports/` | None | Derived from appointments | Duplicate of analytics-lite |
| Billing (SaaS) | `/dashboard/billing/` | None | Upgrade (Stripe checkout), Customer portal | Live, owner — Stripe only |
| Payments | `/dashboard/payments/` | None | Lists `appointment.fee`. Link to SaaS billing | Visit fees only — not Patient AR |
| Tasks | `/dashboard/tasks/` | None | Links to overdue visits / waiting / new leads — no task DB | Live (derived) |
| Operations | `/dashboard/operations/` | None | Today board + waiting cards | Live |
| Updates | `/dashboard/notifications/` | None | Mark all read | Live |
| Settings | `/dashboard/settings/` | Organization, Working hours, Treatments, Appointments, Notifications, Templates, Integrations, Roles, Security, Data & privacy, Profile | Save clinic, hours, treatments, slug, reminders, intro template, profile | Live, owner; some tabs copy-only |
| Rooms | `/dashboard/rooms/` | None | None — unavailable copy | API only — `Room` model exists |
| Laboratory | `/dashboard/laboratory/` | None | None — points to consult | API only — `LabOrder` exists; no instrument feed (correct) |
| Inventory | `/dashboard/inventory/` | None | None | API only — `Sku` / `StockMovement` exist |
| Telemedicine | `/dashboard/telemedicine/` | None | None — requires a real video provider | Honest empty — `TeleSession` API, no fake video |

### Settings tab actions

| Tab | What it does |
|---|---|
| Organization | Save clinic name, specialty, phone, email, address, Google Place ID |
| Working hours | Per-day open/close/closed; drives booking slots |
| Treatments | Add/remove name + fee; used by booking, WhatsApp, AI |
| Appointments | Booking slug, public URL, default fee, auto-confirm WhatsApp bookings |
| Notifications | Reminder timing (24h / 2h / both) |
| Templates | Custom WhatsApp intro |
| Integrations | Links to WhatsApp / other connections (not a fake lab/video config) |
| Roles / Security / Data & privacy | Mostly copy / policy |
| Profile | Owner name + clinic email |

### Patient chart tabs — what actually loads

| Tab | Data source today |
|---|---|
| Overview, Appointments, Communication, Notes | Patient + appointments + messages APIs — live |
| Clinical / Visits | `DmaClinical.timelineEntries` from `appointment.clinical` — live after Phase 5 |
| Billing / Payments | `Appointment.fee` only — not `PatientInvoice` |
| Prescriptions, Medications, Lab, Documents, Insurance | Honest unavailable — APIs exist unused |
| Audit | Created date only — `AuditLog` not shown here |

### Visit action matrix

| Status | Desk (owner / reception / manager) | Clinician (owner / nurse) |
|---|---|---|
| PENDING | Confirm, Check in, Reschedule, No show, Cancel | — |
| CONFIRMED | Check in, Reschedule, No show, Cancel | Start |
| ARRIVED / WAITING | Call patient | Start |
| CALLED | — | Start |
| IN_PROGRESS | Reschedule, No show, Cancel | Complete |
| COMPLETED / CANCELLED | — | — |

Book wizard steps: **Patient → Treatment → Slot → Confirm**. Doctor and location filters stay disabled until a second practitioner/site exists (no fake multi-site UI).

Waiting room flow: **ARRIVED → WAITING → CALLED → IN_PROGRESS**. `DmaClinical.canPersistStatus("CALLED")` is true once the API is deployed.

---

## Superadmin

Nav groups: Platform, Operations, Billing, System.

| Page | Route | Actions | State |
|---|---|---|---|
| Overview | `/superadmin/` | Counts / health links | Live |
| Organizations | `/superadmin/clinics/` | Open clinic, edit, plan drawer, Save plan — **no impersonate** | Live |
| Clinic detail | `/superadmin/clinics/:id` | Workspace tabs from `superadmin-clinic-workspace.js` | Live |
| Users | `/superadmin/users/` | Directory | Live |
| WhatsApp | `/superadmin/whatsapp/` | Platform Meta config | Live |
| Announcements | `/superadmin/announcements/` | Create owner email blast | Live |
| Integrations | `/superadmin/integrations/` | Keys / providers | Live |
| Billing | `/superadmin/subscriptions/` | Stripe SaaS | Live |
| Plans | `/superadmin/stripe/` | Plan catalog | Live |
| Analytics | `/superadmin/revenue/` | MRR views | Live |
| API | `/superadmin/api/` | Deploy check | Live |
| System Health | `/superadmin/health/` | Probes | Live |
| Audit Logs | `/superadmin/audit/` | Logs | Live |
| Support | `/superadmin/support/` | Honest: no ticket queue — links to announcements | Honest empty |
| Security | `/superadmin/security/` | Copy / policy surface | Honest empty |
| Settings | `/superadmin/settings/` | Platform settings | Live |

---

## Phase 5 backend (UI not fully using it)

First-class entities exist with migration, API, tenant auth, and audit:

Encounter, ClinicalNote, Observation, Diagnosis, Prescription, PrescriptionItem, FollowUp, Practitioner, Location, Room, Leave, ScheduleBlock, PatientInvoice, PatientPayment, PatientLedgerEntry, PatientDocument, LabOrder, LabOrderItem, LabResult, Sku, StockLot, StockMovement, Dispense, TeleSession, Coverage, Claim.

Legacy `[[clinicos-chart]]` in `appointment.notes` is parsed **once**, then marked migrated. Notes stay for audit.

Pharmacy adapter returns `PHARMACY_RAIL_UNAVAILABLE`. No fake video provider.

---

## Core path that already works

Register or login → new patient → appointment → check-in → waiting → called → consultation → vitals → prescription in chart → complete.

Stripe SaaS and WhatsApp remain owner-only.
