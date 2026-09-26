# Config language

Choose **English** or **Русский** in the operator header. The change is instant:
the current page, unsaved form values, and existing notifications stay in place.
It does not save broadcast settings, send a WebSocket control command, reload the
HUD, or translate team/player names, custom preset names, and other user data.

On first visit, NeuronCast uses the first supported entry in `navigator.languages`, with
English as the fallback. An explicit choice is stored under
`eon-config-locale` in localStorage for that browser profile and origin. Tabs on
the same origin synchronize this preference. Electron and another browser can
choose their own language. If storage is unavailable, selection still works for
the current page. Clear this storage key to use browser preferences again.

## Maintaining translations

- `src/config/i18n-core.js` contains the browser-independent selection and
  translation helpers. `src/config/i18n.js` owns the shared reactive locale and
  installs `$t`, `$text`, `$number`, `$date`, `$locale`, and `$setLocale` for Config.
- `src/config/locales/en.js` and `ru.js` are local ES modules loaded before mount.
  English source strings serve as keys, compatible with existing operator copy.
  Keep both catalogs complete and preserve named `{parameters}` in translations.
- Use `$t('Known UI copy', { name: value })` for new copy, and `$text(label)` for
  existing metadata labels or upstream status messages. `$text` translates only
  registered messages/patterns and leaves unknown text intact. Never apply it to
  editable values, user names, URLs, IDs, or CSS/config option values.
- Store persistent notifications as source text (or a key and parameters), not a
  pretranslated string. Translate during rendering so visible notifications also
  change language. Native confirm/prompt dialogs translate when opened.
- Render text with Vue interpolation, not `v-html`. Interpolation values are not
  translated or evaluated as markup. Missing keys fall back to English; unknown
  keys return the key. Add `?i18n-debug` to Config to log missing keys once each.
- Config's SFC loader caches the native locale and store modules. Keep these
  instances shared to preserve reactivity. The common HUD loader is unchanged.

## Verification

`npm run test:unit` checks locale precedence, denied storage, catalog parity,
interpolation, fallback, alerts, and compilation of Config templates.

`npx playwright test tests/playwright/config-i18n.spec.js tests/playwright/config-smoke.spec.js`
checks switching, draft preservation, absence of HTTP/WebSocket writes, persistence,
tab sync, auto-detection, all navigation pages, and keyboard use at 1024px.
On an offline workstation with Edge installed, set `EON_TEST_BROWSER=msedge` before
running; the default remains Playwright Chromium. The compact-layout test saves
a Russian screenshot in its test output directory.
