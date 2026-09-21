# Clinicos design system

Vanilla HTML/JS. Canonical CSS: `dma-design-system.css`. Helpers: `js/ds-*.js`. Style guide: `/dev/ui/` (noindex).

## Brand

- Product: **Clinicos** (doctorsmyagency.com)
- Teal `#14967F` — links, icons, charts (not filled buttons)
- Primary fill `#0E7A68` — AA vs white ~5.3:1
- Deep teal / rail `#0B6456` — sidebar both clinic and superadmin
- Ink `#191919`
- Do not use IQPigeon green `#22C55E` as brand fill (success semantic / WhatsApp channel only)

## Type

- Headings: **Montserrat** 600/700/800 (`--ds-font-display`)
- Body/UI: **Plus Jakarta Sans** (`--ds-font`). Inter is not in the font bundle.
- KPI and money: body font + `font-variant-numeric: tabular-nums`
- Body ≥ 14px, helper ≥ 12px. One H1 per page (shell top bar). Sentence case.

## Theme

- Light is default `:root`
- Dark: `html[data-theme="dark"]` remaps **all** `--ds-*`
- Boot: `prefers-color-scheme` unless `localStorage.dma-theme`; inline no-flash in `<head>`
- Auth (`html.dma-world-auth`) stays light
- Landing (`html.dma-world-public`) stays dark OS (Phase 6 harmonize)

## Contrast (AA)

| Pair | Rule |
|---|---|
| White on `#14967F` | Fail for body (~3.7:1). Do not use. |
| White on `#0E7A68` | Pass (~5.3:1). Filled primary. |
| White on `#0B6456` | Pass (~6.5:1). Sidebar, hover fill. |
| `#0B6456` on `#F7F8FA` | Pass. Text links (`--ds-link`). |
| `--ds-faint` | Decorative only. |

## Space / radius / chrome

- 4px grid. Controls 10px radius, cards 16px, pills 9999.
- Header **64px**, sidebar **240px**, content max 1440px.
- Control height 40–44px; min touch 44×44.
- Dark elevation = surface + 1px border. Light = token shadow + border.
- Motion 150–180ms; `prefers-reduced-motion` disables animation.

## Status

`js/ds-status.js` maps domain enums → `{ label, semantic, description }`. Never show raw `PENDING`. Meaning is never color-alone.

## Command palette

Pages-only until an additive search API exists. Placeholder: “Search pages…”.

## Footer

`© Clinicos · Doctors My Agency · 2026` — exact string. Dynamic year is additive, not implemented.

## Shells

Clinic: `dashboard-doctor-shell.js`. Superadmin: `superadmin-admin-shell.js`. Same tokens, teal rail, search, theme toggle. Nav content and permissions differ.

## Do not

Invent metrics, HIPAA claims, uptime %, impersonation, shop/orders, or IQPigeon product features.
