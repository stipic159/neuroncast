# Event Theme Designer Architecture (Phase 17)

This document describes NeuronCast's local-first **Event Theme Designer** architecture. It provides visual layout editing, event branding management, and token overrides for broadcast overlays.

---

## 1. Design & Core Ideology

The Event Theme Designer is designed strictly under local-first and offline-safe constraints:

- **Static Presets in Code**: Built-in styling presets (Dark Broadcast, Nordic Blue, LAN Orange, Finals Gold, Minimal Clean, Cyber Neon, and Local Club) are stored statically in-memory (`src/server/helpers/theme-presets.js`). They are read-only and never seeded to disk or polluted with customizable folders.
- **Operator Custom Themes**: Custom user-created themes are stored in `userspace/event-themes/<theme-slug>.json`.
- **Local Font Safety**: Custom web fonts (`theme.typography.customFontUrl`) must only allow offline-safe local `/hud/` path URLs to prevent flicker-of-unstyled-text delays and internet dependencies on broadcast machines.
- **Surgical Option Merging**: Applying a theme merges its tokens directly into `userspace/theme.json`'s active options block, bypassing layout structure disruptions.

---

## 2. Dynamic Option Merging Flow

When an operator applies a visual theme:

```
┌─────────────────────────────────┐
│     getEventTheme(themeId)      │
└────────────────┬────────────────┘
                 │ (Fetches Tokens & Event Data)
                 ▼
┌─────────────────────────────────┐
│    Reads userspace/theme.json   │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│  - Merges tokens to options.*   │
│  - Merges event properties      │
└────────────────┬────────────────┘
                 │ (Atomic Save & Websocket Alert)
                 ▼
┌─────────────────────────────────┐
│ - Injects dynamic CSS variables │
│ - Broadcasts refresh to overlays│
└─────────────────────────────────┘
```

### Event Branding Overrides Mappings
Applying a theme translates metadata directly to NeuronCast's canonical game setup slots:
- `event.name` ➔ `series.name.center`
- `event.subtitle` ➔ `series.name.left`
- `event.logo` ➔ `series.logoUrl`
- `event.sponsorFlavor` ➔ `sponsors.left.title` / `sponsors.right.title`

---

## 3. Storage & JSON Spec
Custom theme JSON configuration files are persisted atomically to `userspace/event-themes/`:

```json
{
  "schemaVersion": "1.0.0",
  "id": "lan-orange",
  "name": "LAN Orange",
  "description": "Fluorescent orange local tournament theme.",
  "event": {
    "name": "NeuronCast LAN 2026",
    "subtitle": "Local Area Network Tournament",
    "logo": "/hud/img/branding/logo-ubg.png",
    "sponsorFlavor": "LAN Partner",
    "accentColor": "#ff5a00"
  },
  "tokens": {
    "theme.colors.ctFill": "15, 32, 67",
    "theme.colors.ctBorder": "52, 152, 219",
    "theme.colors.ctText": "173, 216, 230",
    "theme.colors.tFill": "255, 90, 0",
    "theme.colors.tBorder": "255, 165, 0",
    "theme.colors.tText": "255, 222, 173",
    "theme.colors.red": "220, 20, 60",
    "theme.colors.green": "46, 204, 113",
    "theme.materials.panelFill": "rgba(10, 10, 15, 0.95)",
    "theme.materials.panelBorder": "rgba(255, 90, 0, 0.25)",
    "theme.shapes.radius": "0px",
    "theme.shapes.skewAngle": "25deg",
    "theme.shapes.skewComplement": "155deg",
    "theme.typography.primaryFont": "Quantico",
    "theme.typography.customFontUrl": ""
  }
}
```

---

## 4. API Endpoints

The Koa server maps five visual themes endpoints:

- `GET /config/event-themes`: Lists combined static presets and disk-based custom themes.
- `GET /config/event-themes/:id`: Fetches a single preset or custom theme.
- `POST /config/event-themes`: Saves a new custom theme JSON.
- `PUT /config/event-themes/:id`: Updates an existing custom theme.
- `DELETE /config/event-themes/:id`: Deletes custom themes (built-in presets are read-only and return `403 Forbidden`).
- `POST /config/event-themes/:id/apply`: Merges tokens into `userspace/theme.json` and flushes cache.

---

## 5. Security Validation Layers

1. **Slugs & Traversal Safeguards**: Theme IDs are sanitized to include alphanumerics and hyphens only. Paths are resolved using relative checks to reject any directory traversal attempts (e.g. `../`).
2. **Local-Only Font Paths**: Checks that `theme.typography.customFontUrl` does not contain `://` or external schemes and starts strictly with `/hud/`.
3. **RGB Comma Constraints**: Enforces colors match standard comma-separated sequences `R, G, B` between `0` and `255`.
4. **Prefix Locks**: Allows token edits only under the `theme.*`, `series.*`, and `sponsors.*` prefixes, discarding layout mutations to prevent layout regression risks.
