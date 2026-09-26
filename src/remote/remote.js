const { createApp } = window.Vue

const RemoteApp = {
	template: `
		<div class="remote-app">
			<!-- Header -->
			<header class="remote-header">
				<div class="remote-logo">
					⚡ NeuronCast
				</div>
				<div class="status-pills">
					<span :class="['pill', connected ? '--green' : '--red']">
						<span class="pill-dot"></span>
						{{ connected ? 'SERVER' : 'OFFLINE' }}
					</span>
					<span :class="['pill', obs.connected ? '--green' : '--red']">
						<span class="pill-dot"></span>
						OBS
					</span>
				</div>
			</header>

			<!-- Hero Controls: Cough / Mute & Replay Buffer -->
			<section class="hero-controls">
				<button 
					:class="['btn-hero', obs.micMuted ? '--mic-muted' : '--mic-live']"
					@click="toggleCasterMic"
				>
					<span class="icon">{{ obs.micMuted ? '🔇' : '🎙️' }}</span>
					<span>{{ obs.micMuted ? 'MIC MUTED (COUGH)' : 'MIC LIVE' }}</span>
				</button>

				<button 
					class="btn-hero --replay"
					@click="saveReplay"
				>
					<span class="icon">📼</span>
					<span>{{ replaySaved ? 'REPLAY SAVED!' : 'SAVE REPLAY' }}</span>
				</button>
			</section>

			<!-- Quick OBS Switcher (if Intermission/Caster scene is configured) -->
			<section v-if="obs.intermissionSceneName" class="remote-section">
				<div class="section-title">
					<span>OBS Scene Switch</span>
					<span style="font-size: 0.7rem; color: #58a6ff;">{{ obs.currentScene || 'Active' }}</span>
				</div>
				<div class="button-grid-2">
					<button 
						:class="['btn-tap', { '--active': obs.currentScene === obs.mainSceneName }]"
						@click="switchObsScene('main')"
					>
						🎮 Main Game
					</button>
					<button 
						:class="['btn-tap', { '--active': obs.currentScene === obs.intermissionSceneName }]"
						@click="switchObsScene('intermission')"
					>
						🎙️ Caster Cam
					</button>
				</div>
			</section>

			<!-- HUD Overlay Scenes (Code-automated) -->
			<section class="remote-section">
				<div class="section-title">
					<span>HUD Overlay Display</span>
					<span style="font-size: 0.7rem; color: #58a6ff;">{{ currentHudScene }}</span>
				</div>
				<div class="button-grid-2">
					<button 
						:class="['btn-tap', { '--active': currentHudScene === 'default' }]"
						@click="setHudScene('default')"
					>
						📊 Live HUD
					</button>
					<button 
						:class="['btn-tap', { '--active': currentHudScene === 'radar' }]"
						@click="setHudScene('radar')"
					>
						🗺️ Full Radar
					</button>
					<button 
						:class="['btn-tap', { '--active': currentHudScene === 'intro' }]"
						@click="setHudScene('intro')"
					>
						📋 Match Info
					</button>
					<button 
						:class="['btn-tap', { '--active': currentHudScene === 'fulltime' }]"
						@click="setHudScene('fulltime')"
					>
						🏆 Post Match
					</button>
				</div>
			</section>

			<!-- Quick Win Celebration & Overrides -->
			<section class="remote-section">
				<div class="section-title">
					<span>Round Overrides</span>
				</div>
				<div class="button-grid-2">
					<button 
						:class="['btn-tap --team-ct', { '--active': celebrationWinner === 'team2' }]"
						@click="setWinner('team2')"
					>
						🛡️ CT Round Won
					</button>
					<button 
						:class="['btn-tap --team-t', { '--active': celebrationWinner === 'team1' }]"
						@click="setWinner('team1')"
					>
						💣 T Round Won
					</button>
					<button 
						:class="['btn-tap', { '--active': celebrationWinner === 'none' }]"
						@click="setWinner('none')"
					>
						⚙️ Auto Win
					</button>
					<button 
						:class="['btn-tap', { '--active': promotionActive }]"
						@click="togglePromotion"
					>
						📣 {{ promotionActive ? 'Hide Promo' : 'Show Promo' }}
					</button>
				</div>
			</section>

			<!-- Lower Third Ticker -->
			<section class="remote-section">
				<div class="section-title">
					<span>Lower Third Ticker</span>
				</div>
				<div class="ticker-box">
					<input 
						type="text" 
						class="ticker-input" 
						v-model="tickerText" 
						placeholder="e.g. s1mple 14-2 on de_mirage..."
						@keyup.enter="sendTicker"
					/>
					<button class="btn-send" @click="sendTicker">SEND</button>
				</div>
			</section>
		</div>
	`,
	data() {
		return {
			connected: false,
			socket: null,
			wakeLock: null,
			replaySaved: false,
			tickerText: '',
			obs: {
				connected: false,
				currentScene: '',
				micMuted: false,
				mainSceneName: '',
				intermissionSceneName: '',
			},
			options: {},
		}
	},
	computed: {
		currentHudScene() {
			return this.options['match.activeScene'] || 'default'
		},
		celebrationWinner() {
			return this.options['preferences.celebration.forceWinner'] || 'none'
		},
		promotionActive() {
			return !!this.options['promotion.visible']
		},
	},
	mounted() {
		this.initWakeLock()
		this.connectWebSocket()
		this.fetchObsStatus()
		setInterval(() => this.fetchObsStatus(), 3000)
	},
	methods: {
		// Haptic vibration feedback
		vibrate(ms = 40) {
			if (navigator.vibrate) {
				navigator.vibrate(ms)
			}
		},

		// Screen Wake Lock API to prevent phone screen from sleeping
		async initWakeLock() {
			if ('wakeLock' in navigator) {
				try {
					this.wakeLock = await navigator.wakeLock.request('screen')
					document.addEventListener('visibilitychange', async () => {
						if (this.wakeLock !== null && document.visibilityState === 'visible') {
							this.wakeLock = await navigator.wakeLock.request('screen')
						}
					})
				} catch (err) {
					console.warn('[WakeLock] Could not acquire screen wake lock:', err)
				}
			}
		},

		connectWebSocket() {
			const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
			const params = new URLSearchParams(window.location.search)
			const token = params.get('token') || ''
			const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : ''
			const wsUrl = `${proto}//${location.host}/${tokenQuery}`

			this.socket = new WebSocket(wsUrl)

			this.socket.onopen = () => {
				this.connected = true
			}

			this.socket.onclose = () => {
				this.connected = false
				setTimeout(() => this.connectWebSocket(), 3000)
			}

			this.socket.onmessage = (msg) => {
				try {
					const data = JSON.parse(msg.data)
					if (data.event === 'static_data' && data.body?.options) {
						this.options = { ...this.options, ...data.body.options }
					} else if (data.options) {
						this.options = { ...this.options, ...data.options }
					} else if (data.event === 'obs:status' && data.body) {
						this.obs = { ...this.obs, ...data.body }
					}
				} catch (_) {}
			}
		},

		async fetchObsStatus() {
			try {
				const res = await fetch('/api/obs/status')
				if (res.ok) {
					this.obs = await res.json()
				}
			} catch (_) {}
		},

		async sendControlRequest(url, body = {}) {
			this.vibrate(35)
			const params = new URLSearchParams(window.location.search)
			const token = params.get('token') || ''
			const headers = { 'Content-Type': 'application/json' }
			if (token) headers['x-neuron-token'] = token

			return fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
			})
		},

		async toggleCasterMic() {
			this.vibrate(60)
			try {
				const res = await this.sendControlRequest('/api/obs/mic/toggle')
				if (res.ok) {
					const data = await res.json()
					this.obs.micMuted = data.muted
				}
			} catch (err) {
				console.error('[Remote] Failed to toggle mic:', err)
			}
		},

		async saveReplay() {
			this.vibrate([40, 60, 40])
			this.replaySaved = true
			setTimeout(() => (this.replaySaved = false), 2500)
			await this.sendControlRequest('/api/obs/replay-buffer/save')
		},

		async switchObsScene(role) {
			this.vibrate(35)
			await this.sendControlRequest('/api/obs/scene', { role })
			await this.fetchObsStatus()
		},

		setHudScene(id) {
			this.vibrate(35)
			this.options['match.activeScene'] = id
			if (this.socket && this.socket.readyState === WebSocket.OPEN) {
				this.socket.send(JSON.stringify({ event: 'config:update', body: { key: 'match.activeScene', value: id } }))
			}
		},

		setWinner(val) {
			this.vibrate(35)
			this.options['preferences.celebration.forceWinner'] = val
			if (this.socket && this.socket.readyState === WebSocket.OPEN) {
				this.socket.send(JSON.stringify({ event: 'config:update', body: { key: 'preferences.celebration.forceWinner', value: val } }))
			}
		},

		togglePromotion() {
			this.vibrate(35)
			const next = !this.options['promotion.visible']
			this.options['promotion.visible'] = next
			if (this.socket && this.socket.readyState === WebSocket.OPEN) {
				this.socket.send(JSON.stringify({ event: 'config:update', body: { key: 'promotion.visible', value: next } }))
			}
		},

		sendTicker() {
			if (!this.tickerText) return
			this.vibrate(40)
			if (this.socket && this.socket.readyState === WebSocket.OPEN) {
				this.socket.send(JSON.stringify({ event: 'config:update', body: { key: 'branding.ticker', value: this.tickerText } }))
			}
			this.tickerText = ''
		},
	},
}

createApp(RemoteApp).mount('#app')
