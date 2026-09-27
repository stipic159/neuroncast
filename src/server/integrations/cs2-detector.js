import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync } from 'node:child_process'
import { getOrGenerateGsiToken } from '../gsi.js'

const GSI_CFG_NAME = 'gamestate_integration_neuroncast.cfg'

/**
 * Parses Steam libraryfolders.vdf to find all Steam library directories
 */
function parseLibraryFolders(vdfPath) {
	const paths = []
	try {
		if (!fs.existsSync(vdfPath)) return paths
		const content = fs.readFileSync(vdfPath, 'utf8')
		// Match "path" "\s*([^"]+)"
		const regex = /"path"\s+"([^"]+)"/g
		let match
		while ((match = regex.exec(content)) !== null) {
			const p = match[1].replace(/\\\\/g, '\\')
			if (p && !paths.includes(p)) paths.push(p)
		}
	} catch (_) {}
	return paths
}

/**
 * Tries to query Steam path from Windows Registry
 */
function getSteamPathWindows() {
	try {
		const out = execSync('reg query HKCU\\Software\\Valve\\Steam /v SteamPath', {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			windowsHide: true
		})
		const match = out.match(/SteamPath\s+REG_SZ\s+(.+)/i)
		if (match && match[1]) {
			return match[1].trim()
		}
	} catch (_) {}

	try {
		const out = execSync('reg query HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam /v InstallPath', {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			windowsHide: true
		})
		const match = out.match(/InstallPath\s+REG_SZ\s+(.+)/i)
		if (match && match[1]) {
			return match[1].trim()
		}
	} catch (_) {}

	return null
}

/**
 * Resolves CS2 config directory
 */
export function detectCs2Path() {
	const candidates = []
	const platform = os.platform()

	if (platform === 'win32') {
		const steamReg = getSteamPathWindows()
		if (steamReg) {
			candidates.push(steamReg)
			const vdf = path.join(steamReg, 'steamapps', 'libraryfolders.vdf')
			candidates.push(...parseLibraryFolders(vdf))
		}

		// Common Windows drive letters
		const drives = ['C', 'D', 'E', 'F', 'G']
		for (const d of drives) {
			candidates.push(`${d}:\\Program Files (x86)\\Steam`)
			candidates.push(`${d}:\\SteamLibrary`)
			candidates.push(`${d}:\\Steam`)
			candidates.push(`${d}:\\Games\\Steam`)
		}
	} else {
		// Linux / macOS
		const home = os.homedir()
		candidates.push(path.join(home, '.local/share/Steam'))
		candidates.push(path.join(home, '.steam/steam'))
		candidates.push(path.join(home, '.steam/root'))
		const vdf = path.join(home, '.local/share/Steam/steamapps/libraryfolders.vdf')
		candidates.push(...parseLibraryFolders(vdf))
	}

	const seen = new Set()
	for (const basePath of candidates) {
		if (!basePath || seen.has(basePath)) continue
		seen.add(basePath)

		const cfgDir = path.join(
			basePath,
			'steamapps',
			'common',
			'Counter-Strike Global Offensive',
			'game',
			'csgo',
			'cfg'
		)

		try {
			if (fs.existsSync(cfgDir)) {
				const cfgFile = path.join(cfgDir, GSI_CFG_NAME)
				return {
					detected: true,
					cfgDir,
					cfgFile,
					cfgInstalled: fs.existsSync(cfgFile)
				}
			}
		} catch (_) {}
	}

	return {
		detected: false,
		cfgDir: null,
		cfgFile: null,
		cfgInstalled: false
	}
}

/**
 * Installs the GSI cfg file into detected CS2 directory
 */
export function installCs2GsiConfig() {
	const detection = detectCs2Path()
	if (!detection.detected || !detection.cfgDir) {
		return {
			success: false,
			error: 'CS2 cfg directory not detected on this system. Please copy the cfg manually.'
		}
	}

	const token = getOrGenerateGsiToken()
	const cfgContent = `"NeuronCast CS2 Game State Integration"
{
 "uri" "http://127.0.0.1:31982/gsi"
 "timeout" "5.0"
 "buffer"  "0.0"
 "throttle" "0.0"
 "heartbeat" "30.0"
 "auth"
 {
   "token" "${token}"
 }
 "data"
 {
   "provider"            "1"
   "map"                 "1"
   "round"               "1"
   "player_id"           "1"
   "player_state"        "1"
   "player_weapons"      "1"
   "player_match_stats"  "1"
   "allplayers_id"        "1"
   "allplayers_state"     "1"
   "allplayers_match_stats" "1"
   "allplayers_weapons"   "1"
   "allplayers_position"  "1"
   "phase_countdowns"    "1"
   "allgrenades"         "1"
 }
}
`
	try {
		fs.writeFileSync(detection.cfgFile, cfgContent.trim() + '\n', 'utf8')
		return {
			success: true,
			cfgFile: detection.cfgFile
		}
	} catch (err) {
		return {
			success: false,
			error: err.message
		}
	}
}
