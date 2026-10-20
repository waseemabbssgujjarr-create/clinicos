# OS live shell vs prototype (Clinicos_Prototype/clinicos-prototypes)

Comparison for `data-live="1"` clinic + superadmin pages (DmaPages / DmaAdminShell preserve) versus mock prototype shells (`clinic.js`, `admin.js`).

## Visual structure

| Area | Prototype (`dashboard/index.html`) | Live (`data-live="1"`) |
|------|-----------------------------------|-------------------------|
| Shell | `OS.clinicShell` + mock HTML from `clinic.js` | Same `OS.clinicShell` from `assets/os.js` |
| Main canvas | Light `#F2F6F5` (`os.css --bg`) | Same when `html.os-live` + default light theme |
| Sidebar | Dark OS rail (`os.css .rail`) | Same (legacy `.doc-sidebar` hidden) |
| Page body | Hand-built cards, bento grids, mock KPIs | `dma-doctor-pages.js` / preserve HTML (real API data) |
| Top bar | Prototype title + mock user names | Live user from `DmaApp.user()` (shell labels still prototype placeholders until wired) |

## What CSS can fix (done / ongoing)

- Force light main canvas and remap `--doc-*` / `--ds-*` to `os.css` tokens inside `.pg.os-live-mount`.
- KPI row grid, section cards, empty states, ghost quick-action buttons.
- Hide duplicate legacy shell (`.doc-layout`, `.sa-sidebar` inside mount).
- WhatsApp hub (preserve): panel grid, quick links, ghost buttons scoped under `.os-live`.
- Superadmin: `.sa-main-inner` canvas + panel cards on light background.

## What cannot match without replacing DmaPages content

- **Home bento layout**: prototype uses fixed bento slots and mock “attention” stories; live home is `DmaPages` sections (KPIs, grids, API-driven lists) — different DOM, not 1:1 with mock.
- **Mock names / counts**: prototype shows demo doctors, fake notification count (`4`), demo plan chip — live must use API values only (no inventing metrics).
- **In-page navigation patterns**: some prototype pages use `OS.pages` tab panels; live pages use URL params, `ds-workspace-tabs`, or full-page tables from DMA renderers.
- **Palette / dock items**: prototype registry may list routes not enabled for a role; live nav comes from `DmaDoctorShell` permissions + OS nav config — item set can differ.
- **Patient / detail rails**: prototype mock preview columns vs live chart tabs and clinical modules — structure follows backend, not mock HTML.

## Theme behavior (live)

- Default **light** main for `html.os-live` unless `dma-theme` or `cl_theme` is set (head boot + `ds-theme.js` + `os-live.js`).
- OS top-bar theme toggle syncs `cl_theme` and `dma-theme`.
- User dark mode still applies OS dark tokens to main (prototype supports dark canvas); legacy dma full-app dark navy canvas is overridden inside `.os-live-mount` only.

## Verification

- Hard refresh after deploy; clear stale CSS (`os-live.css?v=4`).
- If main still dark: check `localStorage.dma-theme === 'dark'` from old sessions; toggle theme or set to `light`.
