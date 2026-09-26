# NeuronCast Design Tokens & Utility Catalog

Phase 24 introduces a parallel `--eon-*` design-token vocabulary and a tokenized utility stylesheet for the new operator shell. Legacy `:root` variables (`--accent`, `--panel-background`, `--text-*`) and per-page scoped styles continue to render unchanged in any page that has not yet been redesigned.

The tokens, utility classes, and the `Chip` atom land together with the new shell in Phase 24A. Subsequent phases consume them; nothing here is "foundation" — every token shipped in 24A is consumed by AppShell, AppHeader, AppSidebar, BroadcastStatusBar, or Chip.

---

## Files

| File | Purpose |
|---|---|
| `src/config/styles/fonts.css` | Six `@import` lines pulling self-hosted `@fontsource` CSS. No external runtime requests. |
| `src/config/styles/tokens.css` | `:root` variables prefixed `--eon-*`. |
| `src/config/styles/components.css` | Tokenized `.eon-*` utility classes. |
| `src/config/components/atoms/Chip.vue` | Pulsing status chip. The only SFC atom in 24A; others use the utility classes. Imported directly (`import Chip from '/config/components/atoms/Chip.vue'`) — no barrel until a second atom justifies one. |

These three stylesheets are loaded once via `src/config/index.css` `@import` declarations, in the order `fonts → tokens → components`.

---

## Token contract

### Surfaces
| Token | Value | Purpose |
|---|---|---|
| `--eon-bg` | `#09090c` | Page background |
| `--eon-s1` | `#101013` | Sidebar, header |
| `--eon-s2` | `#17171b` | Cards |
| `--eon-s3` | `#1e1e24` | Card inner sections, inputs |
| `--eon-s4` | `#252530` | Toggle off, select background |

### Borders
| Token | Value | Purpose |
|---|---|---|
| `--eon-bd` | `#28282f` | Default border |
| `--eon-bd2` | `#373744` | Stronger separator |

### Text
| Token | Value | Purpose |
|---|---|---|
| `--eon-tx` | `#dddde8` | Primary |
| `--eon-tx2` | `#888898` | Secondary |
| `--eon-tx3` | `#484858` | Tertiary / labels |
| `--eon-tx4` | `#303040` | Disabled dot |

### Accent (indigo)
| Token | Value | Purpose |
|---|---|---|
| `--eon-acc` | `#6366f1` | Primary accent |
| `--eon-accl` | `#818cf8` | Lighter accent |
| `--eon-accd` | `rgba(99,102,241,.14)` | Tinted background |

### Semantic pairs (color + tinted background)
- `--eon-red` `#f87171` / `--eon-redd`
- `--eon-amb` `#f59e0b` / `--eon-ambd`
- `--eon-grn` `#4ade80` / `--eon-grnd`
- `--eon-blu` `#60a5fa` / `--eon-blud`

### Typography
| Token | Value |
|---|---|
| `--eon-font-primary` | `'Space Grotesk', system-ui, sans-serif` |
| `--eon-font-mono` | `'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace` |

Self-hosted via the existing `serveFontsourceFont` route. **No `fonts.googleapis.com` / `fonts.gstatic.com` requests.**

### Type scale
`--eon-fs-micro 9px`, `--eon-fs-status 10px`, `--eon-fs-notes 11px`, `--eon-fs-body 12px`, `--eon-fs-body2 12.5px`, `--eon-fs-title 13px`, `--eon-fs-base 14px`, `--eon-fs-h1 20px`.

### Spacing
`--eon-pg-pad-y 24px`, `--eon-pg-pad-x 28px`, `--eon-card-pad-y 16px`, `--eon-card-pad-x 18px`, `--eon-card-gap 16px`, `--eon-row-gap 10px`, `--eon-label-mb 10px`.

### Radii
`--eon-rad-card 6px`, `--eon-rad-input 3px`, `--eon-rad-btn-sm 3px`, `--eon-rad-btn 4px`, `--eon-rad-chip 2px`, `--eon-rad-toggle 8px`.

### Shadows
`--eon-shadow-dropdown 0 8px 24px rgba(0,0,0,.4)`
`--eon-shadow-selected 0 0 0 2px rgba(99,102,241,.4)`

---

## Utility classes

All `.eon-*` classes live in `src/config/styles/components.css` and reference only `--eon-*` tokens.

| Class | Replaces (legacy) | Notes |
|---|---|---|
| `.eon-app-grid` | (none) | 3-row shell grid — host element |
| `.eon-page` | (none) | Page body wrapper with padding |
| `.eon-card` + `[data-accent="acc\|red\|amb\|grn\|blu"]` | `.panel`, `.card` | Scoped legacy `.panel` continues to win in untouched pages |
| `.eon-card-header` | `.panel-header`, `.card-header` | |
| `.eon-btn` + `[data-variant="primary\|ghost\|secondary\|danger\|success"]` + `[data-size="sm\|md"]` | `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger` | |
| `.eon-input`, `.eon-select`, `.eon-input[data-mono="true"]` | `.field-input`, `.text-input` | |
| `.eon-toggle` + `[data-on="true"]` | `.switch` + `.slider` | |
| `.eon-label`, `.eon-label-note` | `.field-label` + small text | |
| `.eon-sep` | (none) | Vertical separator (status bar) |

### Why the `.eon-` prefix

Existing scoped class definitions (`<style scoped>`) win specificity in every legacy page. Prefixing utility classes makes the boundary between legacy and Phase 24+ surfaces visible in markup and prevents accidental overrides. When a page is redesigned in a later phase, its scoped styles are dropped wholesale in favor of `.eon-*` utility classes.

---

## SFC atoms

### `Chip.vue` (only atom in 24A)

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `tone` | `'acc' \| 'red' \| 'amb' \| 'grn' \| 'blu' \| 'neutral'` | `'neutral'` | Color family |
| `pulse` | bool | `false` | Animate the leading dot |
| `dot` | bool | `true` | Whether to render the leading dot |

Renders a span with optional pulsing dot + slotted label. Used by the broadcast status bar and the sidebar footer.

Other atoms (`SaveBar`, `Tab`, `PropertyInspector`, etc.) are deferred until the phase that first consumes them. **Do not create new atoms speculatively.**

---

## Golden rules

1. **Phase 24+ surfaces consume `--eon-*` tokens exclusively.** No hex literals in new component styles.
2. **Reuse `.eon-*` utility classes first.** Do not re-implement them in scoped CSS.
3. **Create a new atom only when a utility class cannot express the behavior**, and only after confirming the legacy SPA has no equivalent.
4. **Legacy `:root` variables are untouched.** `--accent`, `--panel-background`, `--text-*` remain because untouched pages still depend on them.
5. **Save model during rollout:** Save All is retained in the header. The status bar shows `Saved Xs ago` driven by `state.lastSavedAt`, set by `actions.save()` on success. Autosave is not introduced until a later phase explicitly adopts it.
6. **No external runtime font requests.** Fonts are served via `serveFontsourceFont` from `node_modules/@fontsource/<name>/`.

---

## Phase contract

- The `--eon-*` token contract is **frozen** for Phase 24. Only a deliberate Phase 25 visual refresh may revisit token values.
- New utility classes may be added to `components.css` in later phases. Existing utility classes must not be redefined or have their semantics changed mid-phase.
- Legacy pages keep their scoped styles until their dedicated redesign phase. A redesigned page drops `<style scoped>` for sections that consume utility classes; it may retain scoped CSS for page-specific layout that has no utility equivalent.
