# Phase 17A Verification Checkpoint (Event Theme Backend API)

This checklist details the steps to verify that the static theme presets, custom theme CRUD operations, RGB/Font validation rules, and NeuronCast settings merge/apply pipeline are functioning correctly and securely.

---

## 1. Preflight Code Integrity
- [ ] Run `npm run theme:validate` to ensure no configuration or theme regressions exist in the workspace.
- [ ] Verify that NeuronCast imports the `theme-presets.js` and `theme-designer-helper.js` modules cleanly with zero runtime compile errors.

---

## 2. API Endpoint Testing

### GET /config/event-themes (List Themes)
- [ ] Call the list themes API:
  ```bash
  curl http://localhost:31982/config/event-themes
  ```
- [ ] Verify that the response returns an array containing NeuronCast's **7 built-in presets** (Dark Broadcast, Nordic Blue, LAN Orange, Finals Gold, Minimal Clean, Cyber Neon, and Local Club).
- [ ] Confirm that each preset has `"isCustom": false` attached.

### POST /config/event-themes (Create Theme)
- [ ] Post a custom theme configuration with visual tokens:
  ```json
  {
    "id": "my-custom-lan",
    "name": "My Custom LAN",
    "tokens": {
      "theme.colors.ctFill": "100, 150, 200",
      "theme.colors.tFill": "200, 150, 100",
      "theme.shapes.radius": "4px",
      "theme.typography.customFontUrl": "/hud/uploads/fonts/cool-font.woff2"
    }
  }
  ```
- [ ] Verify that a `201 Created` status is returned and the file `src/themes/userspace/event-themes/my-custom-lan.json` is created.
- [ ] Confirm that the file was written atomically and does not contain legacy key mutations.

### PUT /config/event-themes/:id (Update Theme)
- [ ] Update an existing custom theme's properties.
- [ ] Verify that updating a built-in preset ID (e.g. `PUT /config/event-themes/nordic-blue`) is blocked with an explicit `400 Validation Error` (Permission Denied).

### DELETE /config/event-themes/:id (Delete Theme)
- [ ] Delete a custom theme slug. Verify that the file is deleted from disk.
- [ ] Attempt to delete a built-in preset ID (e.g., `DELETE /config/event-themes/finals-gold`). Verify that it is blocked with a `403 Forbidden` status code.

---

## 3. Validation Security Hardening

### 1. External Font Rejection
- [ ] Attempt to create a theme containing an external web font URL:
  ```json
  "theme.typography.customFontUrl": "https://fonts.googleapis.com/css2?family=Outfit"
  ```
- [ ] Verify that the request is rejected with a validation error: `"Font path rejected: ... is not an offline-safe local URL. Custom fonts must reside under NeuronCast's local path..."`

### 2. Layout Overrides Rejection
- [ ] Attempt to save a theme containing layout modifications:
  ```json
  "layout.radar.top": "2rem"
  ```
- [ ] Verify that the mutation is rejected because layout prefixes are forbidden.

### 3. Path Traversal Rejection
- [ ] Attempt to create or update a theme with an ID of `../hack`.
- [ ] Verify that the path traversal is blocked with a clear security warning.

---

## 4. Theme Application Live Swaps
- [ ] Load the active overlay in a browser at `http://localhost:31982/hud`.
- [ ] Apply a custom or built-in theme via the REST API:
  ```bash
  curl -X POST http://localhost:31982/config/event-themes/nordic-blue/apply
  ```
- [ ] Confirm that:
  - [ ] `userspace/theme.json` options are merged with Nordic Blue visual tokens.
  - [ ] HUD branding is replaced (`series.logoUrl`, `series.name.center`, etc.).
  - [ ] Overlays reload instantly with the new styles.
