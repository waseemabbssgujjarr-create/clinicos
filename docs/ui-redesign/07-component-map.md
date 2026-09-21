# 07 — Component map (existing → target primitives)

Vanilla mapping only. Target = CSS class + `DmaUI` / small helper, **not** React.

| Existing | Where | Target primitive | Notes |
|---|---|---|---|
| `.dma-btn` / `.ds-btn` + primary/ghost/sm | design system, pages | Button | Merge to one prefix in Phase 3; keep both as aliases during migrate |
| `.sa-btn-primary` | superadmin CSS | Button | Alias to primary |
| `.doc-logout`, `.sa-logout` | shells | Button ghost/danger | |
| `input` / `.ds-input` / `.cos-input` | forms, AI training | Text field | One height/border/focus |
| `.dma-status-sel` | appointments | Select + **status pill** | Stop showing raw enums |
| `.dma-switch` | AI training | Toggle + description | |
| `.ds-kpis` / `.dma-kpi` | home, superadmin | Stat card | Hide delta when no baseline |
| `.ds-section` / `.dma-section` / `.sa-content-card` | most pages | Card | |
| `.ds-table` / `.ds-table-wrap` | clinics, patients | Table + toolbar + pager | |
| `.ds-clinic-cards` | clinics mobile | Table stacked variant | |
| `.ds-toolbar` | clinics filters | Table toolbar | |
| `.ds-pager` | clinics | Pagination | URL-sync in Phase 5 |
| `.dma-tabs` / `.ds-tabs` / `.ds-workspace-tabs` | AI, shells | Pill tabs | URL `?tab=` already on AI |
| `.ds-badge` / `.sa-badge-ok/warn` / `.ds-pill` | mixed | Status pill + registry | |
| `.doc-nav-badge` | unread | Badge count | cap 9+ already |
| `DmaUI.drawer` `.ds-drawer` | patients, appts | Drawer | Mobile full-screen already intended |
| `DmaUI.modal` / confirm | app | Modal / confirm | |
| `DmaUI.toast` `.ds-toast` | app | Toast | Duration 2.6s — spec wanted 4–6s; flag, don’t change until Phase 3 |
| `DmaUI.emptyState` `.ds-empty` / `.ds-empty-panel` | mixed | Empty state | Two copies (nothing-yet vs no-results) |
| `.ds-loading` / `.ds-skel` | mixed | Skeleton | |
| `.ds-cmd` | `openCommand` | Command palette | Wire entity search later (additive API or existing list endpoints) |
| `.doc-layout` / `.doc-sidebar` / `.doc-topbar` | clinic | App shell | Phase 2 |
| `.sa-layout` / `.sa-sidebar` | superadmin | Same shell language | Different nav config |
| `.dma-bottom-nav` | clinic mobile | Shell | |
| `.doc-user-chip` / `.doc-user-avatar` | header | Avatar + user menu | Menu is only logout today |
| `.doc-chip-wa` / `.doc-wa-status` | header | Status chip | Real `waStatus()` |
| `.dma-head` / `.ds-page-header` / `.ds-work-header` | pages | Page header | Kill duplicate H1 |
| `.ds-kv` / `.sa-info-list` | detail | Key-value | |
| WhatsApp hub markup | `dashboard-whatsapp-hub.js` | Hub = settings+inbox hybrid | Do not clone IQPigeon orders |
| Broadcast preview `.bc-preview` | broadcasts HTML | Form + preview | Move inline CSS to tokens |
| AI tab sections | `dma-ai-training.js` | Settings sections | Already closest to archetype D |
| Landing `.dma-btn`, `.dma-os-frame` | `index.html` | Phase 6 token sync only | |
| Auth `.dma-auth` | login/register | Archetype H | 10px radius keep |

## Do not build

- React Storybook
- New icon npm package unless Lucide is approved (current: inline SVG). Prefer extracting `js/ds-icons.js` from existing paths.
- IQPigeon “Add business”, shop, kanban orders, impersonate, bulk CSV as new product features.

## Style guide

`/dev/ui/index.html` (Phase 1 skeleton): tokens, type, buttons, fields, cards, table, tabs, pills, overlays, empty/loading/error, both themes. Not linked from production nav.
