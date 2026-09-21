# 03 — Entities and state machines

From `clinicos-api/prisma/schema.prisma` and controllers/jobs. Transitions listed only where code enforces or performs them. If the API accepts any enum value without a graph, that is called out.

## Tenancy

`Clinic` is the tenant. Almost every operational entity has `clinicId`. Superadmin is a separate `SuperAdmin` model (not a Clinic).

## Clinic (SaaS subscription)

**Plan** `ClinicPlan`: `TRIAL` → `STARTER` | `PRO` | `ENTERPRISE`.

**PlanStatus**: `ACTIVE`, `PAST_DUE`, `CANCELLED`, `TRIALING`.

**Flags:** `isActive` (platform suspend), `emailVerified`, `onboardingDone`, `aiEnabled`.

UI plan labels in the shell: Trial / Starter / Pro / Enterprise Plan (from `plan` / `subscriptionPlan` / `planStatus` string). Possible contradiction: `plan=TRIAL` with `planStatus=PAST_DUE` — resolve in copy, do not invent a new enum.

Side effects: Stripe customer/sub ids; owner billing portal. Superadmin `PATCH /clinics/:id/status`, `PATCH /clinics/:id/plan`.

## StaffMember

`StaffRole`: `RECEPTIONIST` | `NURSE` | `ASSISTANT` | `MANAGER`.  
`isActive`, invite token/expiry, email verify. Deactivate via `DELETE /api/staff/:id` (owner). No extra status machine.

## Patient

`isActive`, `optedOut` / `optedOutAt`, `portalEnabled`, `leadScore` (`HOT` | `WARM` | `COLD`). Unique `(clinicId, phone)`. Deactivate is owner-only. Magic link owner-only.

## Appointment

**Status enum:** `PENDING`, `CONFIRMED`, `ARRIVED`, `CALLED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`, `RESCHEDULED`.

**Channel:** `MANUAL`, `WHATSAPP`, `SMS`, `CALL`, `EMAIL`, `ONLINE_BOOKING`, `STAFF_PORTAL`.

The update schema **accepts any status** — there is no server-side directed graph. UI flows that actually patch:

| From (typical) | To | Who | Side effects |
|---|---|---|---|
| PENDING/CONFIRMED | ARRIVED | desk | check-in |
| ARRIVED | CALLED | desk/nurse | `calledAt`/`calledBy`; also mirrored in `sessionStorage` `clinicos.queue.called` |
| ARRIVED/CALLED | IN_PROGRESS | chart roles | consult start |
| IN_PROGRESS | COMPLETED | chart | encounter complete; reminders/review flags exist on the row |
| * | CANCELLED | staff/owner; patient if >2h | patient portal cancel |
| * | NO_SHOW | UI select / jobs consume | 18:00 cron WhatsApp follow-up if connected and not opted out |
| * | RESCHEDULED | schema allows | datetime change uses slot conflict check |

`DmaClinical.visitState` maps persist status → queue codes `WAITING` / `CALLED` for the waiting room. Select in `dma-doctor-pages.js` omits `CALLED` and `RESCHEDULED` (only seven options).

Create: slot conflict via `schedule.service`. Reminders: `confirmationSent`, `reminder24hSent`, `reminder2hSent`, `reviewSent`. Scheduler sends reminders for `CONFIRMED`/`PENDING`.

Audit: `appointment.status_changed`.

## Encounter (clinical visit)

`DRAFT` → `IN_PROGRESS` → `COMPLETED`. 1:1 with appointment. Chart save: `requireChart`. Notes, observations (vitals), diagnoses, follow-up.

## Prescription

`DRAFT` → `ISSUED` → `CANCELLED`. Issue/cancel: `requirePrescribe` (owner). Dispense links to inventory.

## LabOrder

`ORDERED` → `COLLECTED` → `PROCESSING` → `COMPLETED` | `CANCELLED`. Items have their own string `status` default `ORDERED`. Results: value + optional `flag`.

## Room

`AVAILABLE` | `RESERVED` | `OCCUPIED` | `BLOCKED`. Owner patch.

## Leave / ScheduleBlock

Time ranges; `ScheduleBlock.kind` default `"BLOCK"`. Owner create/delete.

## PatientInvoice (clinic AR, not Stripe)

`DRAFT` | `OPEN` | `PARTIAL` | `PAID` | `VOID` | `REFUNDED`. Payments `method` default `CASH`, `kind` default `PAYMENT`. Ledger entries. Write: owner + receptionist + manager.

## Stripe Invoice (SaaS)

`Invoice.status` is a **string** (Stripe). Separate from patient AR. Owner: `/api/billing/*`.

## Lead

**Status:** `NEW` → `CONTACTED` → `BOOKED` → `VISITED` → `FOLLOW_UP` → `CONVERTED` | `LOST`.  
**Score:** HOT/WARM/COLD. **Intent:** BOOKING/PRICE/TREATMENT/EMERGENCY/GENERAL.  
**Source:** `MessageChannel`. Unique `(clinicId, phone)`. Patch: `doctorOnly`. Lost-lead rescue cron every 2h.

## Message

`channel` enum, `direction` INBOUND/OUTBOUND.  
**deliveryStatus** (string, not enum): `sending` → `sent` | `failed`; inbound `delivered`; Meta callbacks can set read/failed.  
`senderType`: `HUMAN` | `AI`. Flags: `isRead`, `isHandledByAI`, `needsReview`.

Broadcast: `Broadcast.status` string default `"completed"`; counts sent/failed.

## WhatsApp connection

One row per clinic. `connectionMethod`: `MANUAL` | `EMBEDDED_SIGNUP`.  
`connectionStatus`: `active` | `disconnected` (queries filter `active`).  
`webhookStatus`: `unknown` (default) and whatever verify-waba writes.

Owner-only APIs. Superadmin list + revoke.

## AI

`AITrainingProfile`: draft JSON vs published JSON (`publishedAt`, `publishedBy`).  
`AITrainingRule`: Q&A, `isActive`, `matchType`.  
`ConversationState`: greeting/intent/pending slot/fallback hash.  
`AILog`: success/error/duration. Clinic `aiEnabled`, personality, language.

## Notification

`isRead`; `type`/`color` strings (`color` default `"teal"`). Unread count for shell badge. Socket `join:clinic`.

## TeleSession

`status` string default `SCHEDULED`; `startedAt`/`endedAt`. Owner-only.

## Coverage / Claim

Claim `status` string default `DRAFT`. No rich machine in schema.

## Inventory

`Sku.isActive`. `StockMovement.type` string. Quantities decimal. Owner-only.

## Practitioner / Location

`isActive`, `isPrimary`. Owner creates.

## PlatformSetting / AuditLog / Plan / PasswordReset / DailyBrief / MissedCall

Ops entities. `DailyBrief` is generated metrics + summary for a clinic date. `MissedCall` recovery flags. `AuditLog` platform/clinic actions.

## Illegal / missing transitions (honesty)

- Appointment: any status patchable; UI and waiting-room code disagree on `CALLED`.
- No server guard preventing COMPLETED → PENDING.
- Superadmin announcements: send-now only; UI empty states already say no draft/history API.
- Message `deliveryStatus` is free string.
- Do not invent HIPAA states. Consent is `Patient.optedOut` only.
