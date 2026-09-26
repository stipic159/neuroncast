# NeuronCast Checkpoint Log — Phase 14A: Broadcast-Safe Startup Command

**Date**: 2026-05-24  
**Status**: Phase 14A Completed & Hardened  
**Focus Area**: Pre-Broadcast Preflight Diagnostics & Safe Orchestration  

---

## 1. Summary of Accomplishments

Phase 14A implements a robust, operator-first pre-broadcast safe startup workflow for NeuronCast. It wraps server initialization inside strict preflight validation assertions (directory audits, schema checking, config bootstrapping), preventing corrupted option overrides or missing folders from failing live overlays mid-broadcast.

### Deliverables Created / Upgraded:
* **`scripts/broadcast-start.js`**: Core pre-broadcast safety supervisor. Checks required folders, creates safe bootstrap configs, verifies raw/default theme modules, triggers theme options schema checks, and forks standard server processes.
* **`package.json`**: Integrated `npm run broadcast:start` to invoke the preflight supervisor cleanly.
* **`docs/deployment/production.md`**: Fully updated with startup commands, optional arguments, operator checklist workflows, and a comparative guide on when to use `broadcast:start` versus supervised background engines like PM2.

---

## 2. Command Flags & Behaviors

The startup supervisor parses standard arguments dynamically:

| Option Argument | System Behavior | Broadcast Target Use Case |
| :--- | :--- | :--- |
| **`npm run broadcast:start`** | Standard startup. Runs the preflight pre-validator, checks folders, resolves active ports, prints operator URLs, and boots production Koa server. | **Standard Production Flow** (live GSI feeds). |
| **`--no-validate`** | Skips the theme preflight validator phase. Bootstraps folders and launches server directly. | **Emergency Recovery** (bypasses validator during live stream troubleshooting). |
| **`--ui-dev`** | Runs the production server with the `--ui-dev-mode` flag enabled. | **Simulated Graphics Work** (serves pre-recorded static match states, ignores GSI client posts). |
| **`--port <number>`** | Inject the custom port number into the `process.env.PORT` override context. | **Dynamic Port Re-allocation** (resolves conflicts if port `31982` is bound). |

---

## 3. Preflight Assertion Checks Matrix

The supervisor ensures that the host machine satisfies strict dependencies before launching NeuronCast:

| Preflight Metric | Checked Asset / Target | Resolution / Safe Fallback Action |
| :--- | :--- | :--- |
| **Theme Integrity** | Programmatic fork of `node scripts/theme-validate.js`. | **Fail-Fast**: If errors exist, aborts startup cleanly with exit code 1. |
| **Userspace Directory** | Audits `src/themes/userspace/` folder existence. | **Auto-bootstrap**: Creates the folder automatically if missing. |
| **Userspace Config** | Audits `userspace/theme.json` presence. | **Bootstraps Defaults**: Writes a safe `{ parent: "default", options: {} }` template. |
| **Integrity Paths** | Audits `src/themes/raw`, `src/themes/default`, `logs` paths. | **Assertion**: Halts execution with explicit warnings if core themes are missing. |
| **Entry Point** | Resolves `src/server/index.js` resolution pathway. | **Assertion**: Fails fast if the production entry file is not found. |

---

## 4. Verification & Output Log Snapshot

Manual smoke tests and background process validation successfully completed with exit codes.

### Pre-Broadcast CLI Preflight Execution Log:
```
==================================================
   NeuronCast Counter-Strike 2 Broadcast Operations Stack
==================================================
[Preflight] Running theme validation...
========================================
   NeuronCast Theme Preflight Validator
========================================

✔ Theme chain resolved successfully: userspace -> default -> raw

Validation Summary:
- Files checked: 370
- Option slices checked: 13
- Canonical keys validated: 57
- Registered aliases verified: 59

✔ PASS: All theme configurations are structurally valid and production-ready!
========================================

[Preflight Pass] Theme validation completed successfully.

==================================================
   NeuronCast Server is starting...
==================================================
   * HUD Overlay:      http://localhost:31982/hud
   * Config Dashboard: http://localhost:31982/config
   * Operator Status:  http://localhost:31982/operator/status
   * API Status:       http://localhost:31982/api/status
==================================================

[Mode] Starting NeuronCast in Production Broadcast mode (Live GSI).
cs-hud active at http://0.0.0.0:31982. Press Ctrl+C to quit.
```

---

## 5. Remaining Limitations

* **Command Line Scoping**: Standard arguments (e.g. `--port`, `--ui-dev`) must be separated by the npm script double dash placeholder, i.e., `npm run broadcast:start -- --ui-dev --port 32000`, which is standard for npm-driven Node script execution.
* **PM2 Background Silencing**: When running under PM2 background process supervision, PM2 starts the target file directly without printing the interactive banner or console prompts. In PM2 environments, it is recommended to run `npm run broadcast:start` interactively first to confirm all validations pass cleanly.
