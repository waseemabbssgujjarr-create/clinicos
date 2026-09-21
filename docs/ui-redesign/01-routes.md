# 01 — Route inventory

Canonical HTML is the **repo-root** tree. `clinicos-api/dist/public/**` is a deploy copy (plus leftover Next.js `dashboard/dashboard/` and `_next/` — do not treat as source).

Archetypes: **A** Overview · **B** List+preview · **C** Detail · **D** Settings · **E** Form/wizard · **F** Billing/plans · **G** Time/queue · **H** Auth · **I** Landing/marketing.

Roles: **O** owner (JWT `DOCTOR`) · **R** receptionist · **N** nurse · **A** assistant · **M** manager · **SA** superadmin · **P** patient · **Pub** public.

Layout **Clinic** = `doc-static` + `DmaDoctorShell`. **Admin** = `sa-static` + `DmaAdminShell`. **Public** = `dma-public.js` header/footer. **Auth** = `dma-world-auth`.

---

## Public marketing (Phase 6 only — inventory, no restyle)

| Route | Layout | Roles | Data | Archetype |
|---|---|---|---|---|
| `/` | Public dark OS | Pub | Static; no live KPIs (`—` in hero mock) | I |
| `/platform/` | Public | Pub | Static | I |
| `/ai-receptionist/` | Public | Pub | Static | I |
| `/clinic-crm/` | Public | Pub | Static | I |
| `/clinical/` | Public | Pub | Static (marketing, not clinic chart) | I |
| `/patient-experience/` | Public | Pub | Static | I |
| `/solutions/` | Public | Pub | Static | I |
| `/pricing/` | Public | Pub | Static plan copy | I / F-adjacent |
| `/faqs/` | Public | Pub | Static | I |
| `/contact/` | Public | Pub | Static / form | I |
| `/about/` | Public | Pub | Static | I |
| `/privacy/`, `/terms/`, `/security/`, `/data-deletion/`, `/data-processing/` | Legal | Pub | Static | I |
| `/demo/`, `/start/` | Public | Pub | Static; confirm live links before Phase 6 | I |

`dma-public.js` NAV is the marketing IA. Footer: `© Clinicos · Doctors My Agency · 2026` (hard-coded year).

---

## Auth, register, patient-facing

| Route | Layout | Roles | Data loaded | Archetype |
|---|---|---|---|---|
| `/doctor-login/` | Auth split | Pub | `POST /api/auth/login` | H |
| `/staff-login/` | Auth | Pub | `POST /api/auth/staff/login` | H |
| `/admin-login/` | Auth | Pub | `POST /api/auth/superadmin/login` | H |
| `/login/` | Redirect | — | `.htaccess` → `/doctor-login/` | — |
| `/register/`, `/register/clinic/`, `/register/hours/`, `/register/plan/` | Auth wizard | Pub | `POST /api/auth/register` | E / H |
| `/forgot-password/`, `/reset-password/` | Auth | Pub | forgot/reset APIs | H |
| `/verify-email/` | Auth | Pub | `POST /api/auth/verify-email` | H |
| `/accept-invite/` | Auth | Staff invitee | `POST /api/auth/accept-invite` | H |
| `/book/` | Public booking | Pub | `/api/public/slots/:slug`, `POST /api/public/book/:slug` | E |
| `/patients/`, `/patients/clinic/{slug}` | Marketplace | Pub | `/api/public/clinics`, `/api/public/clinics/:slug` | B / C |
| `/verify/` | Patient | P | OTP | H |
| `/my-appointments/` | Patient | P | `GET /api/patient/appointments` | B |
| `/widget.html` | Embed | Pub | public AI chat | — |

`.htaccess` maps `/dashboard/patients/{id}` → `dashboard/patients/detail/index.html` and `/superadmin/clinics/{id}` → detail HTML.

---

## Clinic dashboard (`html.doc-static`)

Shell injects nav/header. Most pages: empty `#doc-page[data-page]` + `DmaPages.mount()` or `DmaInner.mountPage()`.

| Route | `data-page` | Roles (nav) | Data loaded (from page JS) | Archetype |
|---|---|---|---|---|
| `/dashboard/` | `home` | O R N A M | `/api/appointments?filter=today`, role-specific home | **A** |
| `/dashboard/appointments/` | `appointments` | O R N A M | `/api/appointments`, roster; book wizard | **B** / G |
| `/dashboard/calendar/` | `calendar` | R (nav); O via workspace | appointments + hours | **G** |
| `/dashboard/waiting/` | `waiting` | O R N | today appointments; queue via `DmaClinical.visitState` | **G** |
| `/dashboard/patients/` | `patients` | O R N A M | `/api/patients` | **B** |
| `/dashboard/patients/detail/` (`/dashboard/patients/{id}`) | `patient` | same | `/api/patients/:id`, appts, messages | **C** |
| `/dashboard/messages/` | `messages` | O R A (asst) | `/api/messages`, threads | **B** (inbox, not table) |
| `/dashboard/whatsapp/` | *(none)* | O | `/api/whatsapp/connections/status`, hub, message-log | **D** / A hybrid |
| `/dashboard/whatsapp/manual-connect.html` | — | O (recovery HTML) | manual connect API — **not linked** from hub | D |
| `/dashboard/broadcasts/` | inline | O (workspace) | `/api/messages/broadcast` history | **E** |
| `/dashboard/communication/` | `communication` | via workspace | messages/broadcasts alias | D / B |
| `/dashboard/ai/` | `ai` | O | `/api/ai/training-profile`, rules, test-chat | **D** |
| `/dashboard/leads/` | inline | **no nav** | `/api/leads`, analytics | **B** |
| `/dashboard/clinical/` | `clinical` | O N | encounters by appointment | **C** / E |
| `/dashboard/consult/` | `consult` → clinical | O N | same | C |
| `/dashboard/vitals/` | `vitals` | N (nav); O URL | observations | B / C |
| `/dashboard/prescriptions/` | `prescriptions` | O | `/api` prescriptions issue/cancel | B |
| `/dashboard/laboratory/` | `laboratory` | O (+ chart) | `/api/lab-orders` | B |
| `/dashboard/documents/` | `documents` | Care workspace | `/api/documents` | B |
| `/dashboard/staff/` | `staff` | O M | `/api/staff` (403 for M) | B |
| `/dashboard/doctors/` | `doctors` | M; O workspace | `/api/roster` practitioners | B |
| `/dashboard/rooms/` | `rooms` | O | `/api/rooms` | B / G |
| `/dashboard/operations/` | `operations` | M | rooms/inventory/leave composite | A / D |
| `/dashboard/inventory/` | `inventory` | O | `/api/inventory/*` | B |
| `/dashboard/leave/` | `leave` | O | `/api/leave` | G |
| `/dashboard/telemedicine/` | `telemedicine` | O | `/api/tele-sessions` | B / G |
| `/dashboard/locations/` | `locations` | O (setup tabs) | `/api/roster` locations | D |
| `/dashboard/payments/` | `payments` | R | `/api/patient-invoices`, payments | B / F |
| `/dashboard/tasks/` | `tasks` | A | local/ops tasks (verify API in Phase 5) | B |
| `/dashboard/analytics/` | `analytics` | O | `/api/analytics/*` | A |
| `/dashboard/reports/` | `reports` | M | analytics/reports | A |
| `/dashboard/reviews/` | `reviews` | O | `/api/reviews` | B |
| `/dashboard/billing/` | `billing` | O | `/api/billing/subscription`, invoices | **F** |
| `/dashboard/settings/` | `settings` | O | `/api/settings`, `/api/auth/me` | **D** |
| `/dashboard/notifications/` | `updates` | all (header) | `/api/notifications` | B |

Command palette page list in `dma-ui.js` is a **subset** (missing billing, leads, broadcasts, reviews, payments, tasks, telemedicine, reports).

---

## Superadmin

| Route | Nav | Data | Archetype |
|---|---|---|---|
| `/superadmin/` | Overview | `/api/superadmin/stats`, `/api/health`, WhatsApp clinics, audit, clinics | **A** |
| `/superadmin/clinics/` | Clinics | `/api/superadmin/clinics` (+ filters) | **B** (preview panel not built; row → detail URL) |
| `/superadmin/clinics/detail/` (`/superadmin/clinics/{id}`) | — | clinic detail, patients, appts, messages, activity, AI, patch status/plan | **C** |
| `/superadmin/users/` | Users | `/api/superadmin/users` | **B** |
| `/superadmin/subscriptions/` | Billing | clinics/plans | **F** |
| `/superadmin/stripe/` | workspace | plan/Stripe config | D / F |
| `/superadmin/revenue/` | workspace | `/api/superadmin/revenue` | A |
| `/superadmin/whatsapp/` | WhatsApp | `/api/superadmin/whatsapp/clinics` | B |
| `/superadmin/announcements/` | workspace | `POST /api/superadmin/announce` (no history API) | E |
| `/superadmin/support/` | workspace | mostly static / tickets? (verify) | D |
| `/superadmin/settings/` | Settings | platform settings | D |
| `/superadmin/security/` | workspace | security copy/settings | D |
| `/superadmin/health/` | workspace | `/api/superadmin/health`, `/api/health` | A — **must not show fake uptime %** |
| `/superadmin/audit/` | workspace | `/api/superadmin/audit` | B |
| `/superadmin/integrations/` | workspace | GET/PUT `/api/superadmin/integrations` | D |
| `/superadmin/api/` | workspace | API/docs copy | D |
| `/superadmin/login/` | — | redirect target leftover; live login is `/admin-login/` | H |

Health chips on overview use `/api/health` `ok` boolean (process up), not measured SLA. Do not add “99.9% uptime”.

---

## API mounts (do not change)

Prefix `/api`: `auth`, `appointments`, `patients`, `messages`, `ai`, `analytics`, `staff`, `billing`, `settings`, `notifications`, `superadmin`, `public`, `patient`, `reviews`, `leads`, `whatsapp`, clinical + domain (encounters, roster, rooms, invoices, documents, lab, inventory, tele, coverages, claims), `internal`, webhooks `stripe` / `meta` / `twilio`.

Health: `/`, `/health`, `/api/health`, `/api/health/db`.

---

## Layout notes vs archetypes

- Clinic **B** pages usually lack a persistent right preview; they use `DmaUI.drawer` instead. Target pattern (list + docked preview) is Phase 4–5, not a new feature.
- WhatsApp hub is a custom command-center, closest to **D** + inbox.
- Home already has greeting + today stats — **A**. Confirm deltas are not `0%` from empty (`todayRates` currently returns `0` rates when `n===0` — honesty bug, restyle must hide).
