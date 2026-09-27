import net from 'node:net'

/**
 * CS2 NetCon (Network Console) Integration Service
 * Allows remote control of CS2 spectator camera via local TCP socket.
 * Launch CS2 with launch option: -netconport 2121
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
		const cleanCmd = command.trim()

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
	 * Sends the single best unambiguous command to CS2:
	 * 1. spec_player_by_accountid <accountId> (if steamid present)
	 * 2. spec_player <rawSlot> (0-indexed 0..9)
	 * 3. slot<1..10> (physical key slot)
	 */
	specPlayer(target) {
		let command = null
		let accountId = null

		if (target && typeof target === 'object') {
			const { slot, rawSlot, steamid } = target

			if (steamid) {
				try {
					accountId = (BigInt(steamid) & 0xFFFFFFFFn).toString()
					command = `spec_player_by_accountid ${accountId}`
				} catch (_) {}
			}
			if (!command && rawSlot !== undefined && rawSlot !== null && !isNaN(Number(rawSlot))) {
				command = `spec_player ${Number(rawSlot)}`
			}
			if (!command && slot !== undefined && slot !== null) {
				const slotNum = String(slot).trim() === '0' ? '10' : String(slot).trim()
				command = `slot${slotNum}`
			}
		} else if (target !== undefined && target !== null) {
			const val = String(target).trim()
			if (/^7656\d{13}$/.test(val)) {
				try {
					accountId = (BigInt(val) & 0xFFFFFFFFn).toString()
					command = `spec_player_by_accountid ${accountId}`
				} catch (_) {}
			} else {
				const slotNum = val === '0' ? '10' : val
				if (!isNaN(Number(slotNum)) && Number(slotNum) >= 1 && Number(slotNum) <= 10) {
					command = `spec_player ${Number(slotNum) - 1}`
				} else {
					command = `slot${slotNum}`
				}
			}
		}

		if (!command) return false
		
		// Send primary exact target command
		const sent = this.sendCommand(command)

		// Also send slot command fallback if rawSlot / slot was provided
		if (target && typeof target === 'object' && target.slot) {
			const fallbackSlot = String(target.slot).trim() === '0' ? '10' : String(target.slot).trim()
			this.sendCommand(`slot${fallbackSlot}`)
		}

		return sent
	}

	getStatus() {
		return {
			enabled: true,
			connected: this.connected,
			host: this.host,
			port: this.port
		}
	}
}

export const cs2Netcon = new Cs2Netcon()
