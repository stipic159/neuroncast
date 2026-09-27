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
	}

	connect() {
		if (this.socket || this.connected) return

		const socket = new net.Socket()
		this.socket = socket

		socket.setTimeout(3000)

		socket.connect(this.port, this.host, () => {
			this.connected = true
			console.log(`[CS2 NetCon] Connected to CS2 console at ${this.host}:${this.port}`)
			if (this.password) {
				socket.write(`${this.password}\n`)
			}
		})

		socket.on('data', (_data) => {
			// Console output received from CS2
		})

		socket.on('timeout', () => {
			socket.destroy()
		})

		socket.on('error', (err) => {
			// Suppress spam when CS2 is simply not running or netcon is disabled
			this.connected = false
		})

		socket.on('close', () => {
			this.connected = false
			this.socket = null
			if (this.autoReconnect) {
				if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
				this.reconnectTimer = setTimeout(() => this.connect(), 4000)
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
		if (!this.connected || !this.socket) {
			// Attempt on-demand connection
			this.connect()
			return false
		}
		try {
			this.socket.write(`${command.trim()}\n`)
			return true
		} catch (err) {
			console.warn('[CS2 NetCon] Failed to send command:', err.message)
			return false
		}
	}

	specPlayer(slot) {
		// slot: 1..10 (or 0)
		const slotNum = String(slot).trim()
		// CS2 uses slot1..slot10 (or slot0) or spec_player
		return this.sendCommand(`slot${slotNum}`)
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
