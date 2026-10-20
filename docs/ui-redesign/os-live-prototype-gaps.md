# OS live shell vs prototype (Clinicos_Prototype/clinicos-prototypes)

Updated after prototype-first live mount (`assets/os-live-pages.js`).

## Architecture (live clinic + superadmin)

| Layer | Role |
|-------|------|
| `assets/os.js` | Shell, components, `OS.reg` router |
| `assets/clinic.js` + `clinic2.js` | Prototype page markup (all dashboard routes) |
| `assets/admin.js` | Prototype superadmin pages |
| `assets/os-live-pages.js` | **Live API overrides** for selected routes |
| `assets/os-live.js` | Auth, shell boot, `mountPrototype()`, chrome patches |
| `dashboard-whatsapp-hub.js` | Meta Embedded Signup + command-center KPIs/activity (slot `#os-wa-hub-slot`) |
| `dma-doctor-pages.js` | Fallback for preserve routes + patient detail |

Boot order: prototype scripts register pages → `os-live-pages.js` overrides wired routes → `os-live.js` renders `OS.pages[route]()` into `#pg`.

## Migrated to prototype structure + live data

| Route | Status |
|-------|--------|
| `/dashboard/` (owner) | **Live** — greeting, WA band, KPI icons, schedule slots, waiting queue, recent patients, quick tiles, activity bands |
| `/dashboard/whatsapp/` | **Live** — Communication wtabs, command-center hero + hub KPIs/activity (hub script), connection card, flow chips, AI + recent rail |

## Prototype structure, sample data (next passes)

All other `OS.pages[...]` routes render **prototype DOM** from `clinic.js` / `clinic2.js` / `admin.js` with demo/sample values until each route gets an `os-live-pages.js` override. No fake metrics are injected on the two wired routes above; unavailable API fields show `—` or empty states.

Suggested next wiring order: `dashboard/messages`, `dashboard/waiting`, `dashboard/appointments`, `dashboard/patients`, `dashboard/ai`, then superadmin list pages from real admin APIs.

## Still on DmaPages / preserve HTML

| Route | Reason |
|-------|--------|
| `dashboard/patients/detail` | Dynamic chart tabs; `DmaPages.patientDetail` |
| `superadmin/clinics/detail` | Admin preserve workspace |
| Some legacy preserve shells | Until replaced by `admin.js` + live admin API layer |

## CSS

- `os.css` + `os-live.css?v=6` — light canvas, dark rail, hub scoped under `.os-wa-hub-live`
- Cache-bust after deploy: `os-live.js?v=4`, `os-live-pages.js?v=1`, `os-live.css?v=6`, `dashboard-whatsapp-hub.js?v=8`

## Verification

- Hard refresh; confirm `localStorage` theme not forcing unwanted dark canvas.
- Owner home: KPI row uses API counts; fee KPI only when fees &gt; 0.
- WhatsApp: wtabs + hub stats when connected; connect flow via Meta when `?connect=1`.
