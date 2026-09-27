import net from 'node:net'
import cp from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { userspaceDirectory } from '../helpers/paths.js'

const VBS_SCRIPT_PATH = path.join(userspaceDirectory, 'cs2-sendkey.vbs')

function ensureVbsScript() {
	if (os.platform() !== 'win32') return
	try {
		if (fs.existsSync(VBS_SCRIPT_PATH)) return
		fs.mkdirSync(userspaceDirectory, { recursive: true })
		fs.writeFileSync(VBS_SCRIPT_PATH, `
Set WshShell = CreateObject("WScript.Shell")
WshShell.AppActivate "Counter-Strike"
WshShell.SendKeys WScript.Arguments(0)
`, 'utf8')
	} catch (err) {
		console.warn('[CS2 KeyPress] Failed to create sendkey script:', err.message)
	}
}

function sendWindowsKey(slot) {
	if (os.platform() !== 'win32') return false
	ensureVbsScript()
	const slotStr = String(slot ?? '').trim()
	const keyToSend = slotStr === '0' || slotStr === '10' ? '0' : slotStr

	// Strict sanitization: only allow single digit 0-9 to prevent command/argument injection
	if (!/^[0-9]$/.test(keyToSend)) {
		console.warn('[CS2 KeyPress] Rejected invalid slot key:', slot)
		return false
	}

	try {
		// Use execFile instead of exec with shell string interpolation to prevent command injection
		cp.execFile('cscript.exe', ['//Nologo', VBS_SCRIPT_PATH, keyToSend], (err) => {
			if (err) {
				console.warn('[CS2 KeyPress] SendKeys error:', err.message)
			}
		})
		return true
	} catch (err) {
		console.warn('[CS2 KeyPress] Failed to trigger SendKeys:', err.message)
		return false
	}
}

/**
 * CS2 NetCon (Network Console) Integration Service
 * Allows remote control of CS2 spectator camera via local TCP socket or Windows keypress simulation.
 */
class Cs2Netcon {
	constructor() {
		this.host = process.env.CS2_NETCON_HOST || '127.0.0.1'
		this.port = Number(process.env.CS2_NETCON_PORT || 2121)
		this.password = process.env.CS2_NETCON_PASSWORD || ''
		this.socket = null
		this.connected = false
		this.reconnectTimer = null
		this.autoReconnect = true
		this.pendingCommands = []
	}

	connect() {
		if (this.socket || this.connected) return

		const socket = new net.Socket()
		this.socket = socket

		socket.connect(this.port, this.host, () => {
			this.connected = true
			socket.setKeepAlive(true, 5000)
			console.log(`[CS2 NetCon] Connected to CS2 console at ${this.host}:${this.port}`)
			
			if (this.password) {
				socket.write(`${this.password}\n`)
			}

			// Flush any pending commands queued while connecting
			if (this.pendingCommands.length > 0) {
				const queue = [...this.pendingCommands]
				this.pendingCommands = []
				for (const cmd of queue) {
					try {
						socket.write(`${cmd}\n`)
					} catch (_) {}
				}
			}
		})

		socket.on('data', (_data) => {
			// Console output received from CS2
		})

		socket.on('error', (_err) => {
			this.connected = false
		})

		socket.on('close', () => {
			this.connected = false
			this.socket = null
			if (this.autoReconnect) {
				if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
				this.reconnectTimer = setTimeout(() => this.connect(), 3000)
				if (this.reconnectTimer?.unref) this.reconnectTimer.unref()
			}
		})
	}

	disconnect() {
		this.autoReconnect = false
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		if (this.socket) {
			try {
				this.socket.destroy()
			} catch (_) {}
			this.socket = null
		}
		this.connected = false
	}

	sendCommand(command) {
		if (!command || typeof command !== 'string') return false
		const cleanCmd = command.replace(/[\r\n]+/g, ' ').trim()
		if (!cleanCmd) return false

		if (this.connected && this.socket) {
			try {
				this.socket.write(`${cleanCmd}\n`)
				return true
			} catch (err) {
				console.warn('[CS2 NetCon] Failed to send command:', err.message)
				this.connected = false
				return false
			}
		} else {
			// Queue command and attempt connection
			if (this.pendingCommands.length < 10) {
				this.pendingCommands.push(cleanCmd)
			}
			this.connect()
			return false
		}
	}

	/**
	 * Spectates a player by SteamID64, raw slot index (0..9), or physical slot key (1..10).
	 * Strategy:
	 * 1. If CS2 NetCon TCP socket is connected, send exact console command.
	 * 2. If NetCon TCP is not connected on Windows, fallback to Windows SendKeys to CS2 window.
	 */
	specPlayer(target) {
		let command = null
		let slotKey = null

		if (target && typeof target === 'object') {
			const { slot, rawSlot, steamid } = target

			if (slot !== undefined && slot !== null) {
				slotKey = String(slot).trim()
			} else if (rawSlot !== undefined && rawSlot !== null && !isNaN(Number(rawSlot))) {
				slotKey = String((Number(rawSlot) + 1) % 10)
			}

			if (steamid && /^[0-9]{15,20}$/.test(String(steamid).trim())) {
				try {
					const accountId = (BigInt(String(steamid).trim()) & 0xFFFFFFFFn).toString()
					command = `spec_player_by_accountid ${accountId}`
				} catch (_) {}
			}
			if (!command && rawSlot !== undefined && rawSlot !== null && !isNaN(Number(rawSlot))) {
				const slotNum = Math.floor(Number(rawSlot))
				if (slotNum >= 0 && slotNum <= 9) {
					command = `spec_player ${slotNum}`
				}
			}
			if (!command && slotKey) {
				const slotNum = slotKey === '0' ? '10' : slotKey
				if (/^(?:[1-9]|10)$/.test(slotNum)) {
					command = `slot${slotNum}`
				}
			}
		} else if (target !== undefined && target !== null) {
			const val = String(target).trim()
			slotKey = val
			if (/^7656\d{13}$/.test(val)) {
				try {
					const accountId = (BigInt(val) & 0xFFFFFFFFn).toString()
					command = `spec_player_by_accountid ${accountId}`
				} catch (_) {}
			} else if (/^[0-9]$/.test(val)) {
				command = `spec_player ${val}`
			} else if (/^(?:10|[1-9])$/.test(val)) {
				command = `slot${val}`
			}
		}

		if (command && this.sendCommand(command)) {
			return true
		}

		// Fallback to Windows SendKeys if NetCon is offline and we have a valid slot
		if (slotKey) {
			return sendWindowsKey(slotKey)
		}

		return false
	}

	getStatus() {
		return {
			connected: this.connected,
			host: this.host,
			port: this.port,
			pendingCommands: this.pendingCommands.length,
			autoReconnect: this.autoReconnect
		}
	}
}

export const cs2Netcon = new Cs2Netcon()
