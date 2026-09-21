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
| `/dashboard/` | A | Y | Y | Y | Y | Y | migrated | Rates hidden when n=0; second H1 removed |
| `/dashboard/appointments/` | B/G | Y | Y | Y | Y | Y | migrated | Status select uses registry |
| `/dashboard/calendar/` | G | ws | Y | — | — | — | migrated | |
| `/dashboard/waiting/` | G | Y | Y | Y | — | — | migrated | |
| `/dashboard/patients/` | B | Y | Y | Y | Y | Y | migrated | Drawer, not docked preview |
| `/dashboard/patients/detail/` | C | Y | Y | Y | Y | Y | migrated | |
| `/dashboard/messages/` | B | Y | Y | — | Y | — | migrated | |
| `/dashboard/whatsapp/` | D/A | Y | N | N | N | N | migrated | |
| `/dashboard/broadcasts/` | E | Y | N | N | N | N | migrated | Inline CSS hex |
| `/dashboard/communication/` | D/B | ws | | | | | migrated | |
| `/dashboard/ai/` | D | Y | N | N | N | N | migrated | |
| `/dashboard/leads/` | B | URL | | | | | migrated | Orphaned from nav (keep) |
| `/dashboard/clinical/` | C/E | Y | HTML | Y | N | N | migrated | Receptionist HTML loads; save 403 |
| `/dashboard/consult/` | C | Y | | Y | | | migrated | Alias of clinical |
| `/dashboard/vitals/` | B/C | URL | | Y | | | migrated | |
| `/dashboard/prescriptions/` | B | Y | N | N | N | N | migrated | |
| `/dashboard/laboratory/` | B | Y | N | N | N | N | migrated | |
| `/dashboard/documents/` | B | ws | | | | | migrated | |
| `/dashboard/staff/` | B | Y | N | N | N | nav | migrated | Manager API 403 |
| `/dashboard/doctors/` | B | ws | | | | Y | migrated | |
| `/dashboard/rooms/` | B/G | Y | N | N | N | | migrated | |
| `/dashboard/operations/` | A/D | | | | | Y | migrated | |
| `/dashboard/inventory/` | B | Y | N | N | N | | migrated | |
| `/dashboard/leave/` | G | Y | | | | | migrated | |
| `/dashboard/telemedicine/` | B/G | Y | N | N | N | | migrated | |
| `/dashboard/locations/` | D | Y | | | | | migrated | |
| `/dashboard/payments/` | B/F | | Y | N | N | Y | migrated | |
| `/dashboard/tasks/` | B | | | | Y | | migrated | |
| `/dashboard/analytics/` | A | Y | N | N | N | | migrated | |
| `/dashboard/reports/` | A | | | | | Y | migrated | |
| `/dashboard/reviews/` | B | Y | N | N | N | | migrated | |
| `/dashboard/billing/` | F | Y | N | N | N | | migrated | |
| `/dashboard/settings/` | D | Y | N | N | N | | migrated | |
| `/dashboard/notifications/` | B | Y | Y | Y | Y | Y | migrated | |

### Superadmin

| Route | Archetype | Status | Issues |
|---|---|---|---|
| `/superadmin/` | A | migrated | Health = process `ok`, not SLA |
| `/superadmin/clinics/` | B | migrated | Row → detail URL, no docked preview |
| `/superadmin/clinics/detail/` | C | migrated | No impersonate |
| `/superadmin/users/` | B | migrated | |
| `/superadmin/subscriptions/` | F | migrated | |
| `/superadmin/stripe/` | D/F | migrated | |
| `/superadmin/revenue/` | A | migrated | |
| `/superadmin/whatsapp/` | B | migrated | |
| `/superadmin/announcements/` | E | migrated | No archive API |
| `/superadmin/support/` | D | migrated | |
| `/superadmin/settings/` | D | migrated | |
| `/superadmin/security/` | D | migrated | |
| `/superadmin/health/` | A | migrated | Must not show fake uptime % |
| `/superadmin/audit/` | B | migrated | |
| `/superadmin/integrations/` | D | migrated | |
| `/superadmin/api/` | D | migrated | |

### Auth / patient

| Route | Archetype | Status | Issues |
|---|---|---|---|
| `/doctor-login/` | H | migrated | |
| `/staff-login/` | H | migrated | |
| `/admin-login/` | H | migrated | |
| `/register/` (+ clinic/hours/plan) | E/H | migrated | |
| `/forgot-password/`, `/reset-password/` | H | migrated | |
| `/verify-email/`, `/accept-invite/` | H | migrated | |
| `/book/` | E | migrated | |
| `/patients/` | B | migrated | Marketplace |
| `/verify/`, `/my-appointments/` | H/B | migrated | |

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

## Phase 2 — App shell

- Clinic top bar: page search (Ctrl+K), theme toggle, existing WhatsApp / Updates / Book / user.
- Superadmin: same teal rail, sticky top bar with page search + theme.
- Command palette is pages-only (no patient API search). Catalog includes billing, broadcasts, reviews, payments, tasks, telemedicine, reports. Leads stay off nav.

## Phase 3 — Primitives

- Toast 4s. `DmaUI.noResults` vs `emptyState`. Error helper. AA primary fills already in token lock.

## Phase 4 — Archetypes

- Templates A–H documented on `/dev/ui/`. Runtime pages use existing `pageHead` / `ds-section` / tables rather than a second markup kit.

## Phase 5 — Page groups

- Home: `todayRates` returns `null` (not `0%`) when the day has no visits. In-page title is not a second H1.
- Appointment status `<select>` uses registry labels.
- Superadmin health still uses `/api/health` `ok` — no fake uptime %.
- Remaining clinic/admin routes consume the same tokens/shell; internals stay on `DmaPages` / `DmaInner` / page scripts.

## Phase 6 — Landing

- Same Jakarta + Montserrat bundle. Skip-link fill is AA teal. Footer string unchanged. Concept not rewritten.

## Phase 7 — Hardening

- `docs/ui-redesign/design-system.md` recorded.
- Dead CSS (`dma-theme.css`, Next `_next/`, `iqpigeon/`) listed — not deleted (ask before delete).
- Harness: no DATABASE_URL; static HTML + axe. Authenticated journeys unverified without `UI_E2E_*` creds.


