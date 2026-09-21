# 09 — Migration plan (vanilla token/component layer)

Fits **this** repo. Not a fake React design system.

## Target folder structure (additive)

Keep serving from site root (Apache). New files are siblings of today’s CSS/JS, optionally grouped:

```
/css/
  ds-tokens.css          # Phase 1: primitives + semantic light/dark (or first section of dma-design-system.css)
  ds-base.css            # reset, type, focus, reduced-motion
  ds-primitives.css      # btn, field, card, table, tabs, pill, overlay  (extract from dma-design-system)
/js/
  ds-status.js           # status registry
  ds-format.js           # date, money, plural, tabular
  ds-theme.js            # no-flash + toggle + persist
/dev/ui/index.html       # style guide (noindex)
```

**Recommended path for Phase 1 if we want fewer moving parts:** keep a single `dma-design-system.css` and add a clearly marked tokens block + dark `--ds-*` remaps; add `js/ds-status.js` and `js/ds-theme.js` only. Split files in Phase 7 once pages no longer depend on the monolith.

Do **not** create `src/components/**/*.tsx`.

Shells stay:

- `dashboard-doctor-shell.js` / `.css`
- `superadmin-admin-shell.js` / `superadmin-theme.css`
- `dma-ui.js`, `dma-doctor-app.js`

Deprecate (do not delete until Phase 7): legacy CSS listed in `00-overview.md`, `dashboard-bootstrap.js` Next/Railway shims after leftover Next HTML is unused.

## Page → archetype (migration groups)

| Group | Archetype | Pages |
|---|---|---|
| G0 Shell | — | All clinic + superadmin routes (chrome only) |
| G1 Home | A | `/dashboard/`, `/superadmin/` |
| G2 Queue/time | G | appointments, calendar, waiting |
| G3 People | B/C | patients, patient detail, staff, doctors, users, clinics list/detail |
| G4 Comms | B/D | messages, whatsapp, broadcasts, notifications |
| G5 Care | C/E | clinical, vitals, prescriptions, laboratory, documents |
| G6 Ops | B/D | rooms, operations, inventory, leave, locations, telemedicine, payments, tasks |
| G7 Grow | A/B | analytics, reports, reviews, leads |
| G8 Setup | D/F | settings, billing, AI training |
| G9 Admin ops | D/F/A | subscriptions, stripe, revenue, whatsapp admin, announcements, integrations, security, health, audit, api |
| G10 Auth | H | doctor/staff/admin login, register, passwords, invite |
| G11 Landing | I | Phase 6 only |

## Order by criticality (Phase 5)

Traffic/business, not alphabetical:

1. Clinic shell + Home (A) — daily open
2. Appointments + Waiting (G) — revenue + floor ops
3. Patients list/detail (B/C)
4. Inbox + WhatsApp (trust + AI)
5. Clinical consult (care)
6. AI training (D)
7. Settings + Billing (D/F)
8. Superadmin clinics list/detail (B/C) — platform ops
9. Superadmin overview (A) — honest health only
10. Remaining clinic pages (analytics, staff, inventory, …)
11. Remaining superadmin
12. Auth (H) — already relatively consistent
13. Phase 6 landing

**Rule:** a page is fully migrated or untouched.

## Risks

| Risk | Mitigation |
|---|---|
| Touching APIs while restyling | Forbidden. UI-only. |
| Dark `--ds-*` remap breaks landing | Scope dark clinic/SA with `html.doc-static[data-theme="dark"]` / `html.sa-static` |
| Duplicate H1 / layout shift | Phase 2 header contract |
| Manager 403 on staff | Hide nav or show empty+reason; no new API unless approved |
| Command palette implying search | Keep page search until an additive search endpoint exists |
| Contrast regression on teal buttons | Use `--primary-hover` fills |
| `dist/public` drift | Edit root assets; deploy copy is a pipeline concern |
| Accidental IQPigeon clone | Teal rail, Montserrat headings, clinic vocabulary |
| Honesty on health/MRR | Superadmin stats use hard-coded planPrices in controller (`STARTER: 29` etc.) — **display only what API returns**; flag backend pricing source as additive if wrong |

## Proposed additive backend needs (list only — do not implement)

1. **Optional** global search endpoint (patients + appointments + pages) if command palette should search records. Today: client-side page list only.
2. **Optional** announcement history if admin empty states should show a real archive (today honest “no archive”).
3. **Optional** wire `tenantGuard` (security, not UI).
4. **Optional** appointment status transition map on the server (today any enum).
5. **Optional** manager access to roster/staff read if the Team nav is intentional.
6. **Optional** unread sync across tabs (socket already exists).
7. Dynamic copyright year — copy change, not really backend.
8. Do **not** add: impersonation, uptime %, HIPAA flags, fake series for charts, new CRM stages, shop/orders.

## Phase 1–2 boundaries (reminder)

Phase 1: tokens, type, registry, format, `/dev/ui` skeleton, theme no-flash. **No page restyle.**  
Phase 2: shells only; page bodies unchanged.  
Stop after each phase for approval.

## Verification plan (later phases)

- Existing API tests in `clinicos-api/dist/__tests__/`
- Manual journeys in `04-journeys.md` per role
- Contrast check on `/dev/ui` both themes
- Browser: this audit did not start a server or click through the app
