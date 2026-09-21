# 05 — Glossary and naming drift

One term per concept is the target. **Do not rename routes** to fix drift. Prefer UI copy alignment in Phase 5.

## Canonical terms (recommended)

| Use in UI | Meaning |
|---|---|
| Clinicos | Product name |
| Doctors My Agency | Company / legal / footer |
| Clinic | Tenant organization |
| Owner | Clinic account (JWT `DOCTOR`) |
| Staff | Invited user with a staff role |
| Patient | Clinic patient record |
| Appointment | Booked visit |
| Waiting room | Today’s arrived/called queue |
| Consultation | Encounter / chart |
| Inbox | `/dashboard/messages/` |
| WhatsApp | Connection + hub |
| AI receptionist | Training + runtime bot |
| Lead | Pipeline record |
| Team | Staff members |
| Doctors / practitioners | `Practitioner` roster |
| Billing | Stripe SaaS subscription |
| Payments | Patient AR |
| Updates | In-app notifications |
| Superadmin / Control Center | Platform admin |

Footer (do not change in Phase 0–5): `© Clinicos · Doctors My Agency · 2026`.

## Drift found in code

| Concept | Names in UI / code | Notes |
|---|---|---|
| Product | Clinicos, Doctors My Agency, DMA, ClinicOS, MediCore, ClinicOS AI | Superadmin shell still *replaces* ClinicOS/MediCore strings at runtime |
| Owner | Owner, Doctor, `DOCTOR`, “Your clinic” | Shell titles “Doctors My Agency” |
| Staff roles | RECEPTIONIST vs “reception” home fn | `clinicRole` alias of `staffRole` |
| Nav Schedule | label **Schedule**, href appointments, title Appointments | Calendar is sibling |
| Inbox | Messages (title), Inbox (nav) | Command palette “Inbox” vs page “Messages” |
| Team | Team vs Staff vs `data-page="staff"` | |
| Operations | nav Operations → `/dashboard/rooms/`; also `/dashboard/operations/` | Rooms vs Operations overlap |
| Consultations | Consultations, Clinical, Consult, Care | `consult` mounts clinical |
| Updates | Updates, Notifications, `data-page="updates"` | |
| Organizations | Superadmin h1 Organizations vs nav Clinics | Same list |
| Billing | Billing vs Subscriptions vs Stripe vs Plans vs Revenue | Workspace tabs |
| Plan | TRIAL/STARTER/PRO/ENTERPRISE vs “Trial Plan” | |
| WhatsApp | Connected chip vs `active`/`disconnected` vs UI `connected` | Shell treats `connected`/`CONNECTED`/`s.connected` |
| Queue | ARRIVED vs WAITING vs Called | `visitState` vs prisma |
| Chart | Medical chart vs analytics chart | `canChart` is clinical |
| Payments | Payments page vs Stripe vs cash `PatientPayment` | |
| Home | Dashboard nav label vs `data-title="Home"` vs `/dashboard/` | |

## Copy bugs to fix when those pages migrate (not now)

- Appointment status `<select>` shows raw `PENDING` with underscore replace only (one space).
- Superadmin announcements empty states already honest (“no history archive”) — keep honesty.
- Do not print `Live & Active` style badges unless wired to real connection (bootstrap still has `dma-ai-status-live` helpers for old Next pages).

## i18n

No i18n layer. English only. Master prompt’s ICU helper is **additive later**.
