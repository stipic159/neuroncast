import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// CLI options
const args = process.argv.slice(2);

function getArgValue(name, fallback) {
	const idx = args.indexOf(name);
	if (idx !== -1 && idx + 1 < args.length) {
		return args[idx + 1];
	}
	return fallback;
}

const fixtureArg = getArgValue('--fixture', 'tests/fixtures/gsi/live.json');
const intervalArg = getArgValue('--interval', null);
const sessionArg = getArgValue('--session', null); // tmp/gsi-*.jsonl replay
const speedArg = parseFloat(getArgValue('--speed', '1'));
const tokenArg = getArgValue('--token', '7ATvXUzTfBYyMLrA');
const portArg = getArgValue('--port', '31982');
const hostArg = getArgValue('--host', 'localhost');

const endpoint = `http://${hostArg}:${portArg}/api/gsi`;

async function loadAndPostFixture(fixturePath) {
	const absolutePath = path.isAbsolute(fixturePath) 
		? fixturePath 
		: path.resolve(projectRoot, fixturePath);
		
	try {
		const raw = await fs.readFile(absolutePath, 'utf8');
		const payload = JSON.parse(raw);

		// Guarantee auth token is set
		if (!payload.auth) payload.auth = {};
		payload.auth.token = tokenArg;

		console.log(`[Simulator] POSTing fixture "${fixturePath}" to ${endpoint}...`);
		
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': 'CS2 GSI Simulator/v1.0'
			},
			body: JSON.stringify(payload)
		});

		if (response.ok) {
			console.log(`[Simulator] Success! Status: ${response.status} (No Content)`);
		} else {
			console.error(`[Simulator] Failed. Status: ${response.status} ${response.statusText}`);
			const text = await response.text();
			console.error(`            Response: ${text}`);
		}
	} catch (err) {
		console.error(`[Simulator] Error processing fixture "${fixturePath}": ${err.message}`);
	}
}

async function postFrame(frame) {
	frame.auth = { token: tokenArg };
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'User-Agent': 'CS2 GSI Simulator/v1.0' },
		body: JSON.stringify(frame)
	});
	return response.ok;
}

// Replay a recorded session (tmp/gsi-*.jsonl from the server's raw recorder)
// with the ORIGINAL inter-frame pacing, so the entire stack - HUD, director,
// cards, scenes - re-lives the game exactly as it happened. --speed N to
// fast-forward; delays are capped at 5s so halftime doesn't take 15 minutes.
async function replaySession(sessionPath) {
	const absolutePath = path.isAbsolute(sessionPath)
		? sessionPath
		: path.resolve(projectRoot, sessionPath);
	const lines = (await fs.readFile(absolutePath, 'utf8')).split('\n').filter(Boolean);
	console.log(`[Simulator] Replaying ${lines.length} frames from ${sessionPath} at ${speedArg}x`);

	let posted = 0, failed = 0, prevT = null;
	const startedAt = Date.now();
	for (const line of lines) {
		let record;
		try { record = JSON.parse(line); } catch { continue; }
		if (prevT !== null) {
			const delay = Math.min(5000, Math.max(0, record.t - prevT)) / speedArg;
			if (delay > 0) await new Promise((r) => setTimeout(r, delay));
		}
		prevT = record.t;
		(await postFrame(record.frame)) ? posted++ : failed++;
		if (posted % 500 === 0 && posted > 0) {
			console.log(`[Simulator] ${posted}/${lines.length} frames (${failed} failed, ${Math.round((Date.now() - startedAt) / 1000)}s elapsed)`);
		}
	}
	console.log(`[Simulator] Replay complete: ${posted} posted, ${failed} failed.`);
}

async function run() {
	console.log('=========================================');
	console.log('  NeuronCast CS2 GSI Simulator');
	console.log('=========================================');
	if (sessionArg) {
		await replaySession(sessionArg);
		return;
	}
	console.log(`- Fixture: ${fixtureArg}`);
	console.log(`- Token:   ${tokenArg}`);
	console.log(`- Endpoint: ${endpoint}`);
	
	if (intervalArg) {
		const ms = parseInt(intervalArg, 10);
		console.log(`- Mode:     Continuous Loop (every ${ms}ms)`);
		console.log('Press Ctrl+C to stop simulation.');
		console.log('-----------------------------------------');
		
		// If continuous, we can play back a standard sequence of our 4 fixtures!
		const sequence = [
			'tests/fixtures/gsi/freezetime.json',
			'tests/fixtures/gsi/live.json',
			'tests/fixtures/gsi/bomb-planted.json',
			'tests/fixtures/gsi/round-over.json'
		];
		
		// Check if the user specified a custom fixture path or if we should use the default sequence
		const useSequence = fixtureArg === 'tests/fixtures/gsi/live.json';
		let step = 0;

		const intervalId = setInterval(async () => {
			if (useSequence) {
				const fixture = sequence[step % sequence.length];
				await loadAndPostFixture(fixture);
				step++;
			} else {
				await loadAndPostFixture(fixtureArg);
			}
		}, ms);

		process.on('SIGINT', () => {
			clearInterval(intervalId);
			console.log('\n[Simulator] Simulation stopped.');
			process.exit(0);
		});
	} else {
		console.log('- Mode:     Single Post');
		console.log('-----------------------------------------');
		await loadAndPostFixture(fixtureArg);
	}
}

run().catch(err => {
	console.error('[Simulator] Fatal error:', err);
	process.exit(1);
});
