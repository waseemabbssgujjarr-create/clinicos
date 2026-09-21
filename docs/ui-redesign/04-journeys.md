# 04 — Journeys (by role)

Primary flows as implemented. Handoffs note where another role must act.

## Public / owner onboarding

1. Landing `/` → **Start Free Trial** `/register/` (clinic → hours → plan).
2. Email verify `/verify-email/`.
3. `/doctor-login/` → `/dashboard/`.
4. Setup (incomplete `onboardingDone`): Settings (hours, treatments, logo) → WhatsApp connect (Embedded Signup) → AI Receptionist publish → Book test appointment.

Shell plan card (owner): current plan → `/dashboard/billing/`.

## Owner — front desk day

1. Home greeting + today’s appointments (`/api/appointments?filter=today`).
2. Book (`?action=book` or header Book) → patient lookup/create → slot → `POST /api/appointments` (channel `MANUAL`).
3. Waiting room: check-in `ARRIVED` → Call `CALLED` → consult `IN_PROGRESS`.
4. Consultations: chart (`requireChart`) → complete visit.
5. Inbox / WhatsApp: human reply `POST /api/messages/send`; AI may have already replied inbound.
6. Optional: broadcast, reviews request, analytics.

Handoff: nurse sees waiting/vitals; receptionist payments.

## Owner — WhatsApp + AI

1. `/dashboard/whatsapp/` status/hub.
2. Connect (embedded). Manual HTML exists for recovery, not in nav.
3. `/dashboard/ai/` tabs: identity, knowledge, services, booking, replies, handling, human-like, test, widget.
4. Save draft `PUT /api/ai/training-profile` → Publish `POST .../publish`.
5. Inbound: Meta webhook → clinic by `phoneNumberId` → patient/lead → conversation engine → outbound WhatsApp → inbox.

Handoff: staff with Inbox nav can send human replies on `/dashboard/messages/` (`doctorOrStaff`) even though they cannot open WhatsApp settings.

## Receptionist

Login `/staff-login/` → Home (reception layout) → Schedule/Calendar → Patients → Waiting → Payments → Inbox.

Cannot open owner-only URLs (redirect home). Cannot chart/prescribe. Can write invoices/payments.

## Nurse

Home (nurse) → Patients, Waiting, Vitals, Consultations, Schedule. Can save encounters and labs. Cannot prescribe, WhatsApp, billing, settings.

## Assistant

Home → Appointments, Patients, Tasks, Inbox. No waiting in nav. No chart.

## Manager

Home → Appointments, Patients, Doctors, Team, Operations, Reports. **Team API is owner-only** — manager may see a 403; treat as a known product gap, not a UI invention to “fix” with a new endpoint in this redesign.

## Superadmin

1. `/admin-login/` → `/superadmin/` stats + health chips + attention + recent clinics.
2. Clinics list → filter/search → open `/superadmin/clinics/{id}` (rewrite to detail HTML).
3. Detail: inspect profile, subscription, WhatsApp, AI, patients, appointments, messages, activity; patch status/plan; **no impersonate**.
4. Users list.
5. Billing / Stripe / Revenue.
6. WhatsApp connections: list/revoke.
7. Announcements: send email now (no archive).
8. Settings / integrations (email test) / audit / health.

## Patient

Book `/book/` with clinic slug, or marketplace `/patients/`. Portal OTP → appointments list → cancel if >2 hours.

## Cross-role handoffs

| Created by | Needs action from | Shared status |
|---|---|---|
| AI/WhatsApp booking | Desk confirm/check-in | Appointment status |
| Receptionist check-in | Nurse/owner consult | ARRIVED → IN_PROGRESS |
| Owner prescription | (dispense/inventory if used) | ISSUED |
| Lead from inbound chat | Owner (lead patch is doctorOnly) | LeadStatus |
| Superadmin suspend | Owner/staff login blocked | Clinic.isActive |

## Not journeys to invent

IQPigeon shop/orders, impersonate, platform uptime SLA, HIPAA attestation, testimonials, extra CRM stages beyond `LeadStatus`.
