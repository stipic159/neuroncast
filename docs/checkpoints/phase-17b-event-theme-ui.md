# Phase 17B Verification Checkpoint (Event Theme UI Panel)

This checklist details the steps to verify NeuronCast's visual **Theme Designer** interface.

---

## 1. Tab Navigation & Workspace Layout
- [ ] Log into the NeuronCast Config SPA (`http://localhost:31982/config`).
- [ ] Verify that a new link **Theme Designer** appears in the left navigation sidebar.
- [ ] Click the tab and verify that NeuronCast renders a beautiful **Two-Column workspace**:
  - **Left Column**: Visual theme catalog listing built-in presets (Nordic Blue, LAN Orange, Finals Gold, Minimal Clean, Cyber Neon, Local Club) and custom themes.
  - **Right Column**: Tabs editor sections and the premium Live CSS Mockup Preview Card.

---

## 2. Instant Live CSS Mockup Previews
- [ ] Navigate to the **Shapes** section.
- [ ] Move the **Radius** slider to `12px`. Confirm that the mockup preview's corners round immediately in the browser.
- [ ] Move the **Slant / Skew Angle** slider to `25deg`. Confirm that the mockup slants aggressively in real-time.
- [ ] Navigate to the **Colors** section and select a CT color using the color picker. Verify that the mockup's CT panel reflects the new hue instantly.
- [ ] Verify that the live HUD overlay (`http://localhost:31982/hud`) remains **unaffected** by these preview edits until "Apply Theme to Overlays" is pressed.

---

## 3. Client-Side Safe Validations
- [ ] Navigate to the **Typography** section.
- [ ] Type an external URL in the **customFontUrl** text box (e.g. `https://fonts.googleapis.com/...`).
- [ ] Click **Save Theme**.
- [ ] Verify that the browser rejects the save with an error alert: `"Font validation failed: Only local offline-safe font URLs starting with "/hud/" are allowed."`
- [ ] Change the font URL to `/hud/fonts/local-font.woff2` and confirm that it saves successfully.

---

## 4. Theme Application Live Swap
- [ ] Open NeuronCast HUD overlay in a separate browser window (`http://localhost:31982/hud`).
- [ ] In the Config SPA, select the **Nordic Blue** preset card.
- [ ] Click **Apply Theme to Overlays**.
- [ ] Verify that NeuronCast displays a success notification and the HUD window reloads automatically with the steel blue theme, arctic slants, and custom branding logo.

---

## 5. Persistence across Restarts
- [ ] In the Config SPA, click **Create Custom Theme**.
- [ ] Configure it with a name of "LAN Championship" and a slant of `-15deg`. Click **Save Theme**.
- [ ] Reload the browser config page.
- [ ] Verify that "LAN Championship" appears in the custom theme catalog list.
