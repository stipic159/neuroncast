# NeuronCast CS2 HUD - UI Bug Fix QA Checklist (2026-05-21)

This document provides a structured checklist for manually verifying the 9 UI/runtime bug fixes in the NeuronCast HUD. 

To run these checks, start the UI dev server locally:
```bash
npm run start:ui-dev
```
Open your browser to:
* HUD Overlay: `http://localhost:31982/hud`
* Operator Config SPA: `http://localhost:31982/config`

---

## 1. Layout Editor Visibility Toggles
* **Setup/Action**:
  1. Open the **Operator Config SPA** and navigate to the **Layout Editor** tab.
  2. Toggle the **Show Players Alive** checkbox on and off.
  3. Observe both the live layout preview in the editor and the active HUD overlay (`/hud`).
* **Expected Result**:
  * In the editor preview, the "Players Alive" element should hide and show instantly.
  * In the HUD overlay, the "Players Alive" element should instantly mount/unmount from the DOM.
* **Failure Mode**:
  * The element remains visible on the screen or in the preview after disabling it.
  * Browser console outputs errors about failing to select or query hidden DOM nodes.

---

## 2. Classic HUD: 0–4 Grenades Layout
* **Setup/Action**:
  1. In the **Operator Config SPA**, select the **Classic** style preset.
  2. Simulate or observe gameplay where a player has 0, 1, 2, 3, or 4 grenades (e.g. Flash, Smoke, HE, Molotov).
* **Expected Result**:
  * With 0 grenades, the container has `0` width and does not leave empty space.
  * With 4 grenades, all 4 icons align side-by-side with small margins, fitting perfectly in the classic sidebar slot. Grenade icons should never wrap or clip.
* **Failure Mode**:
  * Grenades wrap to a second line or overlap adjacent weapon columns (e.g., secondary weapons or taser).

---

## 3. Komplettligaen: Results Table & Name Overrides
* **Setup/Action**:
  1. Configure a player name override in the **Teams Setup** (e.g., matching a player's 17-digit SteamID64 to a custom name like `"Override Name"`).
  2. Navigate to a Komplettligaen intermission scene displaying team statistics (e.g., waiting or halftime view).
* **Expected Result**:
  * The table header shows **Rating** instead of "Rtg".
  * A new **K/D** column exists, calculating accurate values to 2 decimal places.
  * Overridden player names appear in the table with their configured display name instead of the raw Steam name.
* **Failure Mode**:
  * Header displays "Rtg" or K/D column is missing.
  * Division by zero crashes the renderer for players with 0 deaths.
  * Override names are ignored, showing raw Steam names instead.

---

## 4. Komplettligaen: Background Async Refresh
* **Setup/Action**:
  1. View a Komplettligaen intermission screen with active match statistics loaded.
  2. Force a data reload/refresh from the operator dashboard or wait for the automatic background fetch cycle.
  3. Simulate a network error (e.g. briefly disconnect internet or trigger an invalid match ID).
* **Expected Result**:
  * While refreshing, existing data stays fully visible on the screen (no blank screen/whiteout).
  * A subtle "Refreshing..." loading spinner appears elegantly in the top-right corner.
  * If a fetch error occurs, the loading spinner disappears, and the last-known good data remains completely intact without blanking out.
* **Failure Mode**:
  * The screen blanks out or shows a full-screen loading spinner while refreshing, or displays "No match loaded" on temporary network errors.

---

## 5. Fullscreen Round Won Poster
* **Setup/Action**:
  1. Simulate a round ending (GSI state transitions to `round.phase = "over"` with a `winningSide` of `'CT'` or `'T'`).
  2. Wait for the round to transition to freezetime (GSI state transitions to `'freeze'` or `'live'`).
* **Expected Result**:
  * A premium glassmorphic fullscreen banner pops up, displaying the winning team's name and logo on a styled CT (Blue) or T (Orange/Gold) gradient background.
  * The banner unmounts instantly when the next round's freezetime begins.
* **Failure Mode**:
  * The poster persists into gameplay, fails to scale, or appears during active play.

---

## 6. Bomb Planted Timer Lifecycle
* **Setup/Action**:
  1. Simulate a bomb plant (GSI transitions to `bomb.isPlanted = true`).
  2. Allow the timer to count down, then simulate a defuse, explosion, or round reset.
* **Expected Result**:
  * The center-bar round clock changes to a ticking red numerical countdown next to the planted bomb icon.
  * The countdown text pulses smoothly.
  * On defusal or explosion, the timer and plant container instantly reset/unmount from the screen.
* **Failure Mode**:
  * Numerical seconds do not tick, the clock shows `0` or NaN, or the timer hangs on the screen after the bomb has exploded or been defused.

---

## 7. Spectated Player: Team Logo
* **Setup/Action**:
  1. Spectate a player on CT.
  2. Swap to spectate a player on T.
  3. Stop spectating (focused player becomes null).
* **Expected Result**:
  * The spectated player card displays the correct team logo next to the name.
  * Logo updates instantly when swapping spectator targets.
  * The HUD does not crash or throw errors when no player is spectated.
* **Failure Mode**:
  * Logo remains unchanged on spectator swap, stays on the screen after spectating ends, or displays a broken image icon.

---

## 8. Maps View: Score Polish & Dimensions
* **Setup/Action**:
  1. Navigate to the Komplettligaen maps view.
  2. Populate scores of 13+ or overtime (e.g. `16 : 14` or `19 : 22`) on maps with long titles (e.g., `"de_inferno"`).
* **Expected Result**:
  * The map card does not clip or crop the score.
  * Map titles truncate elegantly with an ellipsis if they push against the score block.
  * The winning score is styled with a premium Gold glow.
* **Failure Mode**:
  * Scores are pushed off the card boundaries, are cropped, or wrap onto multiple lines.

---

## 9. Missing Logo Fallback Behavior
* **Setup/Action**:
  1. Configure a team with a name that has no matching logo image file in the `public/hud/team-logos/` folder (e.g., `"Team Unicorn"`).
  2. Spectate a player on this team, or trigger a round win for this team.
* **Expected Result**:
  * The HUD continues to render and does not throw any uncaught image load exceptions.
  * The broken image icon is hidden from view completely, and only the team text name appears styled in the layouts.
* **Failure Mode**:
  * A broken image icon is shown next to the name, or the entire player card/poster fails to render due to image loading errors.
