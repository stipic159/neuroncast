#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Helper to check if a file/folder exists
async function fileExists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

// Banner
function printBanner() {
	console.log(`\x1b[1m\x1b[36m==================================================`);
	console.log(`   NeuronCast Counter-Strike 2 Broadcast Operations Stack`);
	console.log(`==================================================\x1b[0m`);
}

async function main() {
	printBanner();

	const args = process.argv.slice(2);
	const noValidate = args.includes('--no-validate');
	const uiDev = args.includes('--ui-dev');
	
	// Port override lookup
	let portOverride = null;
	const portIndex = args.indexOf('--port');
	if (portIndex !== -1 && portIndex + 1 < args.length) {
		const parsedPort = parseInt(args[portIndex + 1], 10);
		if (!isNaN(parsedPort)) {
			portOverride = parsedPort;
			process.env.PORT = String(portOverride);
		} else {
			console.error(`\x1b[31m[Error] Invalid port number provided after --port\x1b[0m`);
			process.exit(1);
		}
	}

	// 1. Run Preflight Theme Validation unless skipped
	if (!noValidate) {
		console.log(`\x1b[34m[Preflight] Running theme validation...\x1b[0m`);
		const validatorPath = path.join(projectRoot, 'scripts/theme-validate.js');
		
		const valResult = spawnSync('node', [validatorPath], {
			stdio: 'inherit',
			cwd: projectRoot
		});

		if (valResult.status !== 0) {
			console.error(`\x1b[31m\x1b[1m[Preflight Fail] Theme validation failed. Aborting startup.\x1b[0m`);
			process.exit(1);
		}
		console.log(`\x1b[32m[Preflight Pass] Theme validation completed successfully.\x1b[0m\n`);
	} else {
		console.log(`\x1b[33m[Preflight] Theme validation skipped via --no-validate.\x1b[0m\n`);
	}

	// 2. Verify and create safe default theme.json if missing
	const userspaceDir = path.join(projectRoot, 'src/themes/userspace');
	const userspaceThemePath = path.join(userspaceDir, 'theme.json');

	await fs.mkdir(userspaceDir, { recursive: true });
	if (!await fileExists(userspaceThemePath)) {
		console.log(`\x1b[33m[Setup] src/themes/userspace/theme.json not found. Creating a safe default...\x1b[0m`);
		const defaultTheme = {
			parent: 'default',
			options: {}
		};
		await fs.writeFile(userspaceThemePath, JSON.stringify(defaultTheme, null, 2), 'utf8');
	}

	// Ensure required cache & logs directories exist
	const cacheDir = path.join(userspaceDir, 'cache');
	await fs.mkdir(cacheDir, { recursive: true });

	const logsDir = path.join(projectRoot, 'logs');
	await fs.mkdir(logsDir, { recursive: true });

	// Ensure raw & default themes exist
	const rawThemeDir = path.join(projectRoot, 'src/themes/raw');
	const defaultThemeDir = path.join(projectRoot, 'src/themes/default');

	if (!await fileExists(rawThemeDir) || !await fileExists(defaultThemeDir)) {
		console.error(`\x1b[31m[Error] Core themes "raw" or "default" directories are missing! Cannot start.\x1b[0m`);
		process.exit(1);
	}

	// 3. Verify server entry point resolves
	const serverEntryPath = path.join(projectRoot, 'src/server/index.js');
	if (!await fileExists(serverEntryPath)) {
		console.error(`\x1b[31m[Error] Production server entry point "${serverEntryPath}" does not exist!\x1b[0m`);
		process.exit(1);
	}

	// 4. Resolve Active Port for Operator URLs
	let port = portOverride;
	if (!port) {
		if (process.env.PORT) {
			port = parseInt(process.env.PORT, 10);
		} else {
			// Read from userspace/theme.json or default/theme.json
			try {
				const userspaceContent = await fs.readFile(userspaceThemePath, 'utf8');
				const userspaceJson = JSON.parse(userspaceContent);
				port = userspaceJson.port;
			} catch {}

			if (!port) {
				try {
					const defaultContent = await fs.readFile(path.join(defaultThemeDir, 'theme.json'), 'utf8');
					const defaultJson = JSON.parse(defaultContent);
					port = defaultJson.port;
				} catch {}
			}

			if (!port) {
				port = 31982; // Canonical fallback port
			}
		}
	}

	// 5. Print Operator URLs
	console.log(`\x1b[1m\x1b[32m==================================================`);
	console.log(`   NeuronCast Server is starting...`);
	console.log(`==================================================`);
	console.log(`   * HUD Overlay:      http://localhost:${port}/hud`);
	console.log(`   * Config Dashboard: http://localhost:${port}/config`);
	console.log(`   * Operator Status:  http://localhost:${port}/operator/status`);
	console.log(`   * API Status:       http://localhost:${port}/api/status`);
	console.log(`==================================================\x1b[0m\n`);

	// 6. Spawn the production server using "node ."
	const serverArgs = [];
	if (uiDev) {
		serverArgs.push('--ui-dev-mode');
		console.log(`\x1b[33m[Mode] Starting NeuronCast in UI Development mode (Simulated GSI).\x1b[0m\n`);
	} else {
		console.log(`\x1b[32m[Mode] Starting NeuronCast in Production Broadcast mode (Live GSI).\x1b[0m\n`);
	}

	const serverProc = spawn('node', ['.', ...serverArgs], {
		stdio: 'inherit',
		cwd: projectRoot,
		env: process.env
	});

	// Handle SIGINT/SIGTERM cleanly
	const cleanup = () => {
		console.log(`\n\x1b[34m[Shutdown] Gracefully terminating NeuronCast server...\x1b[0m`);
		serverProc.kill('SIGINT');
	};

	process.on('SIGINT', cleanup);
	process.on('SIGTERM', cleanup);

	serverProc.on('exit', (code, signal) => {
		process.exit(code !== null ? code : 0);
	});
}

main().catch((err) => {
	console.error(`\x1b[31mFatal error during startup:\x1b[0m`, err);
	process.exit(1);
});
