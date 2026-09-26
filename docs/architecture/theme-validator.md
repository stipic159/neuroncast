# NeuronCast Theme Preflight Validator

The NeuronCast Theme Preflight Validator is a native, offline-safe verification tool that audits NeuronCast themes before broadcast startup. It checks for structural correctness, canonical naming compliance, duplicate key overrides, and inheritance chain integrity.

---

## Usage

The validator is integrated into the core package scripts:

```bash
# Run validation (Human-Readable Colored Output)
npm run theme:validate

# Run validation with JSON output (CI Mode)
npm run theme:validate -- --json
```

---

## Validation Checks

The preflight validator executes **15 distinct checks** divided into critical errors and transitional warnings:

### Critical Errors (Hard Failures)

If any of the following failures are detected, the validator reports `✘ FAIL` and exits with a non-zero exit code (`1`), blocking CI deployments or broadcast boot:

1. **Theme JSON Health**: Validates that all `theme.json` config files parse as standard JSON.
2. **Structural Correctness**: Ensures the `options` object is properly formatted in non-userspace themes.
3. **Duplicate Canonical Keys**: Asserts that no canonical option key is defined multiple times across different option slices.
4. **Duplicate Legacy Aliases**: Asserts that no legacy alias is mapped to multiple canonical keys.
5. **Alias Lifecycle Compliance**: Validates that every declared alias has complete lifecycle metadata (`status`, `sunsetPhase`, `removeAfter`).
6. **Theme Chain Resolution**: Traces the inheritance path (e.g. `userspace -> default -> raw`) to confirm all parent configs exist and that there are no circular inheritance loops.
7. **Core File Existence**: Confirms that vital HUD template files exist (e.g., `app.js`, `state.js`, `shell.js`, `shell.html`).
8. **Syntax Scandals**: Scans `.json`, `.vue`, `.js`, `.css`, and `.html` files in theme directories for readability and major formatting corruptions.

### Warnings (Soft Notices)

These do not fail the exit code, but print actionable notifications to guide operators:

1. **Intentionally Shared CSS Variables**: Flags when the same CSS custom variable is defined in multiple option slices.
2. **Missing Fallbacks**: Notices if a canonical key definition lacks a default fallback option.
3. **Unregistered Canonical Keys**: Warns if a theme `theme.json` declares a `layout.*`, `style.*`, or `theme.*` key that is not officially defined in any option slice.
4. **Legacy Userspace Configs**: Identifies if `userspace/theme.json` is still using deprecated legacy aliases instead of modern canonical keys.
5. **Empty Source Files**: Reports files inside theme folders that are completely empty.

---

## CI / CD Integration

To integrate the NeuronCast theme validator into a CI/CD pipeline, run the validation script in non-interactive JSON mode:

```yaml
- name: Run NeuronCast Preflight Validator
  run: npm run theme:validate -- --json
```
