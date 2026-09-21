# 06 — UI debt (ranked by user impact)

Impact: **P0** daily clinical work · **P1** trust/a11y · **P2** consistency · **P3** cleanup.

## P0 — Structure and honesty

1. **Two (actually many) CSS systems.** Canonical `dma-design-system.css` (~8.4k lines) plus shell CSS plus 15+ legacy sheets. Migrated pages must not mix.
2. **Dark theme incomplete.** `:root` light `--ds-*` is what clinic pages use. `html[data-theme="dark"]` remaps `--bg`/`--text-1`/`--doc-*` only. New components on `--ds-surface` stay light in “dark mode”. Toggle skipped on `doc-static` / `sa-static`. Landing is independently dark.
3. **Home rates from empty data.** `todayRates` uses `n ? … : 0` so cancel/no-show show **0%** with no appointments — forbidden by data-honesty rules. Hide when `n===0`.
4. **White text on `#14967F`.** Estimated contrast **~3.7:1** vs white — fails AA for 14px buttons/nav-active-if-filled. Prefer `#0E7A68` / `#0B6456` fills or dark text.
5. **List + preview archetype missing.** Superadmin clinics is a table → new page, not a docked preview (reference methodology). Clinic patients use drawers. Fine to keep drawers until Phase 4; don’t fake a panel with empty data.
6. **Command palette is pages-only**, readonly input, incomplete catalog (no billing/leads/broadcasts). Search does not query patients/appointments APIs (placeholder implies it might).
7. **Leads page orphaned** from `navFor`. Easy to think the product lacks CRM.

## P1 — Access, a11y, permissions UI

8. **Manager Team nav vs `doctorOnly` staff API** — likely 403. Hide or explain; do not add a new API in the redesign unless approved.
9. **Clinical URLs not in `OWNER_ONLY`.** Receptionist can open clinical HTML; save 403s. Should disable/hide.
10. **Focus / keyboard uneven.** Shell has trap on mobile sidebar and `DmaUI` overlays. Tables/rows not consistently Enter-to-open. Many icon-only controls without names (WhatsApp dots).
11. **Theme flash / no-flash script** not on clinic HTML heads. `dashboard-bootstrap.js` defaults `dma-theme` to **dark** when present — would fight light `:root` if wired later.
12. **Duplicate H1** on some pages (topbar `#doc-page-title` + in-page `dma-head` h1).
13. **Inline styles** in shells and pages (`style="display:flex…"`, broadcasts page `<style>` with raw `#fff` / `#64748B`).
14. **Empty/loading/error** exist as classes (`ds-empty`, `ds-empty-panel`, `ds-loading`) but not uniformly; many `.then` paths fail silently (`.catch(function () {})` on WhatsApp badge).

## P2 — Visual inconsistency

15. **Hard-coded hex** in `dashboard-doctor-shell.css` `:root` (`#14967F`, `#0B6456`, `#F4F4F5`, WhatsApp `#4ADE80` — that green is channel brand, OK if labeled WhatsApp, not product primary).
16. **Radius clash.** Tokens: control 10, card 16, modal 20. Landing/auth force 10. Random 24px bubbles on marketing CSS. Master prompt older 5px radius is **superseded**.
17. **Sidebar width 220 vs prompt 264.** Keep 220 unless approved.
18. **Active nav:** clinic uses `.active` class in teal sidebar (white text on `#0B6456` — better contrast than mid-teal). Superadmin navy `#191919`. Not the filled-primary-on-light-rail pattern from the reference. Restyle in Phase 2, keep teal/navy brand.
19. **Fonts loaded twice** (CSS `@import` + `<link>`). Inter vs Plus Jakarta both requested.
20. **Status colors ad hoc.** No registry. Raw enum strings in selects. Notification.color default `"teal"`.
21. **Superadmin vs clinic chrome** already closer than historical Next pages, but buttons mix `.ds-btn` and `.dma-btn`.
22. **Footer year hard-coded 2026** on public site. Additive later.

## P3 — Dead weight

23. `clinicos-api/dist/public/_next/` and nested `dashboard/dashboard/` Next export.
24. Duplicate `superadmin/superadmin/` HTML.
25. Unused `tenantGuard`.
26. `iqpigeon/` reference tree.
27. `dashboard-bootstrap.js` Railway shim / Next click interceptor — still needed until leftover Next pages are gone.
28. Competing icon SVGs inlined per shell (not one icon module).

## Responsive

Clinic: bottom nav + off-canvas. Superadmin: `sa-mobile-bar`. Tables: some `ds-desktop-table` + `ds-clinic-cards`. Not verified at 360 in this audit (no browser pass — Phase 0 read-only).

## What was not verified (no running API / browser)

- Actual contrast in computed styles on a live page
- Whether manager staff page 403s in production
- Socket unread live updates across tabs
- Screen reader on waiting room
- Landing LCP/perf (Phase 6)
