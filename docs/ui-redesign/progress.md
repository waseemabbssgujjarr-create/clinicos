# UI redesign progress

Branch: `ui-redesign` (do not merge to main).

## Decisions locked (post Phase 0)

| Topic | Choice |
|---|---|
| Shell | One visual language for clinic + superadmin. Nav + permissions differ only. |
| Rail | Clinicos teal `#0B6456` for both shells. Not IQPigeon green, not navy-vs-teal split. |
| Header / sidebar | Header **64px**, sidebar **240px** (from 56/220). One shell; more room for 44px controls. Reversible via tokens. |
| Body font | **Plus Jakarta Sans** (dominant in `dma-design-system.css`). Inter **removed** from the Google Fonts bundle. |
| Headings | Montserrat 600/700/800. KPI/money numbers use body font (`font-variant-numeric: tabular-nums`). |
| Teal AA | Filled primary uses `#0E7A68` (`--ds-primary-hover`) + white (`~5.3:1`). Brand `#14967F` is not a filled-button bg. Text links use `#0B6456`. |
| Theme | Light and dark first-class. `prefers-color-scheme` + `localStorage.dma-theme` + no-flash. Auth stays light. Landing stays dark OS until Phase 6. |
| Leads nav | **Do not** add `/dashboard/leads/` to `navFor`. Restyle in place. |
| Command palette | Pages-only. No new search API. Existing patient fetch in palette removed in Phase 2. |
| Footer | Exact string `© Clinicos · Doctors My Agency · 2026`. Dynamic year listed as additive, not implemented. |
| Additive backends | Listed only. Not implemented (search API, tenantGuard, impersonation, uptime, HIPAA, shop). |

## Harness

- `e2e-ui/` Playwright-core + axe-core + static server (no DB).
- Baselines: `docs/ui-redesign/baselines/`.
- Login roles run only when `UI_E2E_*` env vars exist. This checkout has no seed users and no `.env` database.

## Route × role

Status: `not started` · `migrated` · `verified`.

### Clinic (O owner / R receptionist / N nurse / A assistant / M manager)

| Route | Archetype | O | R | N | A | M | Status | Issues |
|---|---|---|---|---|---|---|---|---|
| `/dashboard/` | A | Y | Y | Y | Y | Y | not started | Home `todayRates` 0% honesty |
| `/dashboard/appointments/` | B/G | Y | Y | Y | Y | Y | not started | Raw PENDING in select |
| `/dashboard/calendar/` | G | ws | Y | — | — | — | not started | |
| `/dashboard/waiting/` | G | Y | Y | Y | — | — | not started | |
| `/dashboard/patients/` | B | Y | Y | Y | Y | Y | not started | Drawer, not docked preview |
| `/dashboard/patients/detail/` | C | Y | Y | Y | Y | Y | not started | |
| `/dashboard/messages/` | B | Y | Y | — | Y | — | not started | |
| `/dashboard/whatsapp/` | D/A | Y | N | N | N | N | not started | |
| `/dashboard/broadcasts/` | E | Y | N | N | N | N | not started | Inline CSS hex |
| `/dashboard/communication/` | D/B | ws | | | | | not started | |
| `/dashboard/ai/` | D | Y | N | N | N | N | not started | |
| `/dashboard/leads/` | B | URL | | | | | not started | Orphaned from nav (keep) |
| `/dashboard/clinical/` | C/E | Y | HTML | Y | N | N | not started | Receptionist HTML loads; save 403 |
| `/dashboard/consult/` | C | Y | | Y | | | not started | Alias of clinical |
| `/dashboard/vitals/` | B/C | URL | | Y | | | not started | |
| `/dashboard/prescriptions/` | B | Y | N | N | N | N | not started | |
| `/dashboard/laboratory/` | B | Y | N | N | N | N | not started | |
| `/dashboard/documents/` | B | ws | | | | | not started | |
| `/dashboard/staff/` | B | Y | N | N | N | nav | not started | Manager API 403 |
| `/dashboard/doctors/` | B | ws | | | | Y | not started | |
| `/dashboard/rooms/` | B/G | Y | N | N | N | | not started | |
| `/dashboard/operations/` | A/D | | | | | Y | not started | |
| `/dashboard/inventory/` | B | Y | N | N | N | | not started | |
| `/dashboard/leave/` | G | Y | | | | | not started | |
| `/dashboard/telemedicine/` | B/G | Y | N | N | N | | not started | |
| `/dashboard/locations/` | D | Y | | | | | not started | |
| `/dashboard/payments/` | B/F | | Y | N | N | Y | not started | |
| `/dashboard/tasks/` | B | | | | Y | | not started | |
| `/dashboard/analytics/` | A | Y | N | N | N | | not started | |
| `/dashboard/reports/` | A | | | | | Y | not started | |
| `/dashboard/reviews/` | B | Y | N | N | N | | not started | |
| `/dashboard/billing/` | F | Y | N | N | N | | not started | |
| `/dashboard/settings/` | D | Y | N | N | N | | not started | |
| `/dashboard/notifications/` | B | Y | Y | Y | Y | Y | not started | |

### Superadmin

| Route | Archetype | Status | Issues |
|---|---|---|---|
| `/superadmin/` | A | not started | Health = process `ok`, not SLA |
| `/superadmin/clinics/` | B | not started | Row → detail URL, no docked preview |
| `/superadmin/clinics/detail/` | C | not started | No impersonate |
| `/superadmin/users/` | B | not started | |
| `/superadmin/subscriptions/` | F | not started | |
| `/superadmin/stripe/` | D/F | not started | |
| `/superadmin/revenue/` | A | not started | |
| `/superadmin/whatsapp/` | B | not started | |
| `/superadmin/announcements/` | E | not started | No archive API |
| `/superadmin/support/` | D | not started | |
| `/superadmin/settings/` | D | not started | |
| `/superadmin/security/` | D | not started | |
| `/superadmin/health/` | A | not started | Must not show fake uptime % |
| `/superadmin/audit/` | B | not started | |
| `/superadmin/integrations/` | D | not started | |
| `/superadmin/api/` | D | not started | |

### Auth / patient

| Route | Archetype | Status | Issues |
|---|---|---|---|
| `/doctor-login/` | H | not started | |
| `/staff-login/` | H | not started | |
| `/admin-login/` | H | not started | |
| `/register/` (+ clinic/hours/plan) | E/H | not started | |
| `/forgot-password/`, `/reset-password/` | H | not started | |
| `/verify-email/`, `/accept-invite/` | H | not started | |
| `/book/` | E | not started | |
| `/patients/` | B | not started | Marketplace |
| `/verify/`, `/my-appointments/` | H/B | not started | |

### Landing (Phase 6)

| Route | Status |
|---|---|
| `/` and marketing IA | not started (harmonize only) |

## Needs decision

_None blocking. Phase 0 opens resolved by product owner 21 Sep 2026._

## Proposed additive changes (do not implement)

1. Optional global search API (patients + appointments + pages).
2. Optional announcement history for superadmin empty states.
3. Optional wire `tenantGuard`.
4. Optional appointment status transition map on the server.
5. Optional manager read access to `/api/staff` if Team nav is intentional.
6. Optional unread sync across tabs.
7. Dynamic copyright year.
8. Do **not** add impersonation, uptime %, HIPAA flags, fake charts, shop/orders.

## Known issues (pre-migration)

- Forced dark + IQPigeon blue overlay in `dma-design-system.css` (~L6383+) on `html.doc-static` / `sa-static` / auth. Phase 1 must scope to `[data-theme="dark"]` and restore teal.
- Dark theme does not remap `--ds-*` at `:root` (only legacy `--bg`).
- No seed credentials in repo; harness static-only unless env provided.

## Phase 1 (foundation) — done

- Dark `--ds-*` remaps on `html[data-theme="dark"]`. Forced-dark overlay scoped to `[data-theme="dark"]` for clinic/admin. Auth stays light. Landing stays dark OS.
- Filled buttons `#0E7A68` + white. Inter removed from Google Fonts; body is Plus Jakarta Sans.
- Header 64px, sidebar 240px. No-flash boot in HTML heads.
- Helpers: `js/ds-theme.js`, `ds-status.js`, `ds-format.js`, `ds-permissions.js`, `ds-icons.js`, `ds-nav.js`.
- Style guide: `/dev/ui/` (noindex).
- Page bodies not restyled. Shell chrome not yet unified (Phase 2).

