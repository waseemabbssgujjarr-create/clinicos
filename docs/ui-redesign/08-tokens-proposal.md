# 08 — Token proposal (Clinicos teal/navy)

**Not implemented.** Phase 1 only after approval.

Source of truth remains CSS custom properties (no Tailwind theme). Map new semantic names onto existing `--ds-*` where possible so we do not run two palettes.

## Brand (do not use IQPigeon green as primary)

| Primitive | Value | Use |
|---|---|---|
| Teal | `#14967F` | links, icons, focus wash, charts series |
| Teal hover | `#0E7A68` | **preferred filled-button bg** (AA vs white ~5.3:1 est.) |
| Teal deep / nav | `#0B6456` | sidebar, stronger fills (~6.5:1 est. vs white) |
| Ink | `#191919` | text, superadmin rail |
| Accent gold | `#FAD069` | sparingly (existing `--ds-accent`) |
| WhatsApp glyph | `#25D366` / current `#4ADE80` | **channel only**, never app primary |

IQPigeon `#22C55E` as **success status** is acceptable (semantic), not as brand fill.

## Contrast notes (estimated, not lab-measured)

| Foreground | Background | Est. ratio | AA body 4.5 | AA large/UI 3.0 |
|---|---|---|---|---|
| `#FFFFFF` | `#14967F` | ~3.7 | **Fail** | Borderline |
| `#FFFFFF` | `#0E7A68` | ~5.3 | Pass | Pass |
| `#FFFFFF` | `#0B6456` | ~6.5 | Pass | Pass |
| `#191919` | `#F7F8FA` | ~16 | Pass | Pass |
| `#666666` (`--ds-muted`) | `#F7F8FA` | ~5.4 | Pass | Pass |
| `#8A8A8A` (`--ds-faint`) | `#F7F8FA` | ~3.3 | **Fail body** | Pass large |
| `#F1F5F9` | `#0B1220` (proposed dark canvas) | ~15 | Pass | Pass |
| `#94A3B8` muted | `#0B1220` | ~4.6 | Pass (check) | Pass |

**Rule:** `--on-primary` for filled teal buttons = white **only** on `#0E7A68` or darker. Keep `#14967F` for text-on-light links (teal on `#F7F8FA` should be checked; if fail, use `#0B6456` for text links).

`--ds-faint` must not carry essential information.

These numbers are WCAG 2.x contrast *estimates* from sRGB; Phase 1 must re-check in a contrast tool on real computed styles.

## Semantic tokens (light / dark)

Light ≈ current `:root`. Dark is **new `--ds-*` remaps** (today missing).

```css
:root {
  --bg-app:        var(--ds-bg);          /* #F7F8FA */
  --bg-sidebar:    #0B6456;               /* keep teal rail (product, not IQPigeon slate) */
  --bg-surface:    var(--ds-surface);     /* #FFF */
  --bg-surface-2:  var(--ds-surface-2);
  --bg-input:      #FFFFFF;
  --border:        var(--ds-border);
  --border-strong: var(--ds-border-2);
  --text:          var(--ds-text);
  --text-muted:    var(--ds-muted);
  --text-subtle:   var(--ds-faint);
  --primary:       #14967F;
  --primary-hover: #0E7A68;
  --primary-active:#0B6456;
  --primary-soft:  rgba(20,150,127,.12);
  --on-primary:    #FFFFFF; /* only on hover/active fills */
  --success: #15803D; --warning: #B45309; --danger: #DC2626; --info: #2563EB;
}

html[data-theme="dark"] {
  --bg-app:        #0B1220;
  --bg-sidebar:    #0A1F1C; /* deep teal-navy, not IQPigeon #0E1729 clone */
  --bg-surface:    #12202C;
  --bg-surface-2:  #182830;
  --bg-input:      #0A1518; /* darker than card */
  --border:        rgba(148,163,184,.14);
  --border-strong: rgba(148,163,184,.26);
  --text:          #F1F5F9;
  --text-muted:    #94A3B8;
  --text-subtle:   #64748B;
  --primary:       #3DB8A3; /* lighter teal for text/icons on dark */
  --primary-hover: #5CC9B8;
  --primary-active:#14967F;
  --on-primary:    #08201C; /* dark text on light teal chips if needed */
  /* also remap --ds-bg, --ds-surface, --ds-text, --ds-border so existing classes follow */
}
```

Do **not** set `--bg-sidebar` to IQPigeon blue-slate. Clinicos rail is teal/navy.

Superadmin may keep ink `#191919` rail in light and the same dark sidebar as clinic for one language — decide in Phase 2 (flag: today SA sidebar is `#191919`, clinic `#0B6456`).

## Type tokens

Keep `--ds-font` / `--ds-font-display` (Jakarta/Inter + Montserrat). Add:

- `--text-display` 1.75–2rem / 700 / display font
- `--text-title` 1.125–1.25rem
- `--text-body` 0.9375rem (15px) — already `--ds-body`
- `--text-kpi` 1.75rem tabular

## Radius hierarchy (already in product — keep)

| Token | px | Use |
|---|---|---|
| `--ds-r-control` | 10 | inputs, buttons; **landing/auth** |
| `--ds-r-badge` | 8 | small chips |
| `--ds-r-card` | 16 | dashboard cards |
| `--ds-r-modal` | 20 | dialogs |
| `--ds-r-pill` | 9999 | tabs, status |

Do not flatten to 5px (old Sep 5 prompt). Do not use 14px and 16px randomly — cards 16, compact panels 14 if needed (`--ds-r-card-sm: 14px`).

## Space / height / z / motion

Keep `--ds-space-*`, `--ds-h-ctrl: 44px`, `--ds-h-header: 56px` (prompt 64–72 — **flag**, keep 56 unless approved), `--ds-sidebar: 220px` (**flag** vs 264), `--ds-z-*`, `--ds-ease: 150ms`.

## Theme behavior (Phase 1)

- Default: `prefers-color-scheme` unless `localStorage.dma-theme` set.
- Inline no-flash snippet in clinic/superadmin/public heads.
- Toggle in shell utility zone (today missing on static shells).
- Auth pages stay light (`html.dma-world-auth` already forces light).
- Landing stays dark OS until Phase 6; still consume the same `--primary` teal.

## Status registry (new `js/ds-status.js` in Phase 1)

Map domain enums → `{ label, semantic: neutral|info|success|warning|danger, description }`. Examples:

- Appointment PENDING → warning “Pending”
- CONFIRMED → info
- ARRIVED/WAITING → info
- CALLED → info
- IN_PROGRESS → accent/info
- COMPLETED → success
- CANCELLED → neutral
- NO_SHOW → danger
- Plan TRIAL → neutral; PAST_DUE → danger; ACTIVE → success
- WA `active` → success; disconnected → danger
