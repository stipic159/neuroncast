import * as Vue from '/dependencies/vue.js'

const { createApp } = Vue

const PRESET_TICKERS = [
	{ label: '💜 Follow Twitch', text: '💜 ЖМИ FOLLOW НА КАНАЛ! СПАСИБО ЗА ПОДДЕРЖКУ!' },
	{ label: '💬 Команды чата', text: '💬 КОМАНДЫ В ЧАТЕ: !score !bracket !rules' },
	{ label: '📣 Telegram & Discord', text: '📣 СЕТКА И АНОНСЫ В НАШЕМ TELEGRAM & DISCORD' },
	{ label: '🎙️ Кастер на связи', text: '🎙️ НА МИКРОФОНЕ ВАШ КОММЕНТАТОР · ПРИЯТНОГО ПРОСМОТРА!' },
	{ label: '🎁 Розыгрыш в чате', text: '🎁 РОЗЫГРЫШ СКИНОВ СРЕДИ ЗРИТЕЛЕЙ В ЧАТЕ TWITCH!' },
	{ label: '⚔️ Формат BO3', text: '⚔️ МАТЧ СЕРИИ BEST OF 3 · ИГРА НА ВЫЛЕТ' },
	{ label: '☕ Перерыв 5 мин', text: '☕ ПЕРЕРЫВ МЕЖДУ КАРТАМИ · СКОРО ПРОДОЛЖИМ!' },
	{ label: '🚨 Тех. пауза', text: '🚨 ТЕХНИЧЕСКАЯ ЗАДЕРЖКА НА СЕРВЕРЕ · СКОРО ВЕРНЁМСЯ!' },
]

const WEAPON_MAP = {
	weapon_ak47: 'AK-47',
	weapon_m4a1: 'M4A4',
	weapon_m4a1_silencer: 'M4A1-S',
	weapon_awp: 'AWP',
	weapon_deagle: 'Deagle',
	weapon_usp_silencer: 'USP-S',
	weapon_glock: 'Glock',
	weapon_mp9: 'MP9',
	weapon_mac10: 'MAC-10',
	weapon_galilar: 'Galil AR',
	weapon_famas: 'FAMAS',
	weapon_ssg08: 'Scout',
	weapon_sg556: 'SG 553',
	weapon_aug: 'AUG',
	weapon_knife: 'Нож',
	weapon_c4: '💣 C4 Bomb',
	weapon_taser: 'Zeus x27',
}

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
					<span :class="['pill', cs2.connected ? '--green' : '--red']" title="Управление камерой CS2 активно">
						<span class="pill-dot"></span>
						{{ cs2.connected ? 'CS2' : 'CS2 OFF' }}
					</span>
				</div>
			</header>

			<!-- Live Match Telemetry Widget (Real-time synced) -->
			<section class="match-widget">
				<div class="match-widget-header">
					<span>{{ matchMapName }} · {{ matchRoundText }}</span>
					<span :class="['match-badge-phase', { '--bomb': isBombActive }]">
						{{ phaseBadgeText }}
					</span>
				</div>
				<div class="match-scoreboard">
					<div class="team-box --ct">
						<span class="team-name">{{ ctTeamName }}</span>
						<span class="team-score">{{ ctScore }}</span>
					</div>
					<span class="score-divider">VS</span>
					<div class="team-box --t">
						<span class="team-name">{{ tTeamName }}</span>
						<span class="team-score">{{ tScore }}</span>
					</div>
				</div>
			</section>

			<!-- Mobile Tabs Navigation -->
			<nav class="remote-tabs">
				<button 
					:class="['tab-nav-btn', { '--active': activeTab === 'broadcast' }]"
					@click="switchTab('broadcast')"
				>
					📺 ЭФИР & СЦЕНЫ
				</button>
				<button 
					:class="['tab-nav-btn', { '--active': activeTab === 'observer' }]"
					@click="switchTab('observer')"
				>
					👥 ОБСЕРВЕР + РАДАР
					<span v-if="aliveCountText" class="tab-badge-alive">{{ aliveCountText }}</span>
				</button>
				<button 
					:class="['tab-nav-btn', { '--active': activeTab === 'radar' }]"
					@click="switchTab('radar')"
				>
					🗺️ РАДАР
				</button>
			</nav>

			<!-- TAB 1: BROADCAST & SCENES -->
			<div v-show="activeTab === 'broadcast'" class="tab-content">
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
						:class="['btn-hero', replaySaved ? '--replay-saved' : '--replay']"
						@click="saveReplay"
					>
						<span class="icon">{{ replaySaved ? '✅' : '📼' }}</span>
						<span>{{ replaySaved ? 'REPLAY SAVED!' : 'SAVE REPLAY' }}</span>
					</button>
				</section>

				<!-- Replay Buffer Status Notice -->
				<div v-if="obs.connected && !obs.replayBufferActive" class="replay-warning-card">
					💡 <b>Replay Buffer в OBS не запущен.</b> Включите буфер повтора в OBS («Настройки -> Вывод -> Буфер повтора»), чтобы сохранять клипы.
				</div>

				<!-- Quick OBS Switcher -->
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

				<!-- HUD Overlay Scenes (Automated engine) -->
				<section class="remote-section">
					<div class="section-title">
						<span>HUD Overlay Display</span>
						<div class="format-toggle-group">
							<span style="font-size: 0.65rem; color: #8b949e; margin-right: 2px;">FORMAT:</span>
							<button 
								:class="['btn-format-toggle', { '--active': (options['match.bestOf'] || 1) == 1 }]"
								@click="setMatchFormat(1)"
							>
								BO1
							</button>
							<button 
								:class="['btn-format-toggle', { '--active': (options['match.bestOf'] || 1) == 3 }]"
								@click="setMatchFormat(3)"
							>
								BO3
							</button>
						</div>
					</div>
					<div class="button-grid-3">
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
							🗺️ Radar
						</button>
						<button 
							:class="['btn-tap', { '--active': currentHudScene === 'intro' }]"
							@click="setHudScene('intro')"
						>
							📋 Match Info
						</button>
					</div>
					<div class="button-grid-2">
						<button 
							:class="['btn-tap', { '--active': currentHudScene === 'halftime' }]"
							@click="setHudScene('halftime')"
						>
							⏸️ Break / Half
						</button>
						<button 
							:class="['btn-tap', { '--active': currentHudScene === 'fulltime' }]"
							@click="setHudScene('fulltime')"
						>
							🏆 Post-Match
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
							📢 {{ promotionActive ? 'Hide Promo' : 'Show Promo' }}
						</button>
					</div>
				</section>

				<!-- Lower Third Ticker & Twitch Presets -->
				<section class="remote-section">
					<div class="section-title">
						<span>💬 Текст на экран (Twitch / Lower Third)</span>
						<span v-if="activeTicker" class="badge-live-ticker">● В ЭФИРЕ</span>
					</div>
					
					<!-- Live on-air active display & 1-tap clear button -->
					<div v-if="activeTicker" class="ticker-live-status">
						<div class="status-top">
							<span class="live-dot"></span>
							<span class="live-label">СЕЙЧАС В ЭФИРЕ:</span>
						</div>
						<div class="live-text">{{ activeTicker }}</div>
						<button class="btn-clear-large" @click="clearTicker">
							🗑️ Снять с эфира / Очистить
						</button>
					</div>

					<!-- Quick Twitch Preset Chips Grid -->
					<div class="presets-grid">
						<button 
							v-for="(p, i) in presets" 
							:key="i" 
							class="chip-btn"
							@click="applyPreset(p)"
						>
							{{ p.label }}
						</button>
					</div>

					<!-- Custom input row -->
					<div class="ticker-box">
						<input 
							type="text" 
							class="ticker-input" 
							v-model="tickerText" 
							placeholder="Свой текст на экран стрима..." 
							@keyup.enter="sendTicker"
						/>
						<button class="btn-send" @click="sendTicker">🚀 В ЭФИР</button>
						<button v-if="activeTicker || tickerText" class="btn-clear-ticker" @click="clearTicker">🗑️</button>
					</div>
				</section>
			</div>

			<!-- TAB 2: OBSERVER & PLAYERS VIEW (1-0 SLOTS + INTEGRATED RADAR) -->
			<div v-show="activeTab === 'observer'" class="tab-content observer-tab">
				<div class="observer-controls-bar">
					<div class="observer-hint-text">
						💡 Нажмите на игрока для переключения камеры в CS2
					</div>
					<div class="observer-actions-group">
						<button 
							:class="['btn-obs-toggle', { '--active': observerShowRadar }]"
							@click="observerShowRadar = !observerShowRadar"
						>
							🗺️ {{ observerShowRadar ? 'Радар' : 'Без радара' }}
						</button>
						<button 
							:class="['btn-obs-toggle', { '--active': observerLayout === '2col' }]"
							@click="observerLayout = observerLayout === '2col' ? '1col' : '2col'"
						>
							{{ observerLayout === '2col' ? '📱 2 Колонки' : '📜 1 Колонка' }}
						</button>
					</div>
				</div>

				<!-- Integrated Centered Mini Radar Card -->
				<div v-if="observerShowRadar" class="observer-radar-box">
					<iframe src="/radar/?embedded=1" class="observer-radar-frame"></iframe>
				</div>

				<div :class="['teams-container', { '--grid-2col': observerLayout === '2col' }]">
					<!-- CT Team Column -->
					<div class="observer-team-column --ct">
						<div class="team-header-bar --ct">
							<span class="team-title-text">{{ ctTeamName }} (CT)</span>
							<span class="team-score-badge">{{ ctScore }}</span>
						</div>

						<div v-if="observerPlayers.ct.length === 0" class="no-players">
							Ожидание игроков за CT...
						</div>

						<div 
							v-for="p in observerPlayers.ct" 
							:key="p.steamid"
							:class="['player-card', { '--dead': p.isDead, '--spectated': p.isSpectated }]"
							@click="specPlayer(p)"
						>
							<div class="slot-badge --ct">
								{{ p.slot }}
							</div>
							<div class="player-info-col">
								<div class="player-top-row">
									<div class="player-identity-col">
										<span class="player-name-text">{{ p.name }}</span>
										<span v-if="p.isSpectated" class="spectated-pill">🎥</span>
									</div>
									<div class="player-status-col">
										<button class="btn-spotlight" @click.stop="triggerSpotlight(p)" title="Вывести игрока в эфир">⭐</button>
										<span v-if="p.isDead" class="dead-pill">💀 DEAD</span>
										<span v-else class="hp-text" :class="getHpClass(p.health)">{{ p.health }}</span>
									</div>
								</div>
								<!-- HP bar -->
								<div class="hp-bar-track">
									<div 
										class="hp-bar-fill" 
										:class="getHpClass(p.health)"
										:style="{ width: p.isDead ? '0%' : p.health + '%' }"
									></div>
								</div>
								<div class="player-bottom-row">
									<div class="player-weapon-col">
										<span class="weapon-text">{{ p.activeWeapon || '—' }} <span v-if="p.ammoClip !== null" class="ammo">({{ p.ammoClip }})</span></span>
										<span v-if="p.defusekit" class="kit-icon" title="Defuse Kit">🛡️</span>
									</div>
									<span class="kda-text">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</span>
								</div>
							</div>
						</div>
					</div>

					<!-- T Team Column -->
					<div class="observer-team-column --t">
						<div class="team-header-bar --t">
							<span class="team-title-text">{{ tTeamName }} (T)</span>
							<span class="team-score-badge">{{ tScore }}</span>
						</div>

						<div v-if="observerPlayers.t.length === 0" class="no-players">
							Ожидание игроков за T...
						</div>

						<div 
							v-for="p in observerPlayers.t" 
							:key="p.steamid"
							:class="['player-card', { '--dead': p.isDead, '--spectated': p.isSpectated }]"
							@click="specPlayer(p)"
						>
							<div class="slot-badge --t">
								{{ p.slot }}
							</div>
							<div class="player-info-col">
								<div class="player-top-row">
									<div class="player-identity-col">
										<span class="player-name-text">{{ p.name }}</span>
										<span v-if="p.isSpectated" class="spectated-pill">🎥</span>
									</div>
									<div class="player-status-col">
										<button class="btn-spotlight" @click.stop="triggerSpotlight(p)" title="Вывести игрока в эфир">⭐</button>
										<span v-if="p.isDead" class="dead-pill">💀 DEAD</span>
										<span v-else class="hp-text" :class="getHpClass(p.health)">{{ p.health }}</span>
									</div>
								</div>
								<!-- HP bar -->
								<div class="hp-bar-track">
									<div 
										class="hp-bar-fill" 
										:class="getHpClass(p.health)"
										:style="{ width: p.isDead ? '0%' : p.health + '%' }"
									></div>
								</div>
								<div class="player-bottom-row">
									<div class="player-weapon-col">
										<span class="weapon-text">{{ p.activeWeapon || '—' }} <span v-if="p.ammoClip !== null" class="ammo">({{ p.ammoClip }})</span></span>
										<span v-if="p.hasBomb" class="bomb-icon" title="C4 Bomb">💣</span>
									</div>
									<span class="kda-text">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- TAB 3: RADAR -->
			<div v-show="activeTab === 'radar'" class="tab-content radar-tab">
				<div class="radar-card">
					<iframe src="/radar/" class="radar-iframe"></iframe>
				</div>
			</div>
		</div>
	`,
	data() {
		return {
			activeTab: 'broadcast',
			observerLayout: '2col',
			observerShowRadar: true,
			connected: false,
			socket: null,
			wakeLock: null,
			replaySaved: false,
			tickerText: '',
			presets: PRESET_TICKERS,
			obs: {
				connected: false,
				currentScene: '',
				micMuted: false,
				mainSceneName: '',
				intermissionSceneName: '',
				replayBufferActive: false,
			},
			cs2: {
				connected: false,
			},
			options: {},
			gsi: {},
			additionalState: {},
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
		activeTicker() {
			return this.options['branding.ticker'] || ''
		},
		matchMapName() {
			const raw = this.gsi?.map?.name || 'CS2 Match'
			return raw.replace('de_', '').toUpperCase()
		},
		matchRoundText() {
			const r = this.gsi?.map?.round ?? 0
			return `Round ${r + 1}`
		},
		ctTeamName() {
			return this.gsi?.map?.team_ct?.name || 'COUNTER-TERRORISTS'
		},
		tTeamName() {
			return this.gsi?.map?.team_t?.name || 'TERRORISTS'
		},
		ctScore() {
			return this.gsi?.map?.team_ct?.score ?? 0
		},
		tScore() {
			return this.gsi?.map?.team_t?.score ?? 0
		},
		isBombActive() {
			const phase = this.gsi?.round?.bomb
			return phase === 'planted' || phase === 'defusing'
		},
		phaseBadgeText() {
			const phase = this.gsi?.round?.phase
			const bomb = this.gsi?.round?.bomb
			if (bomb === 'defusing') return 'DEFUSING'
			if (bomb === 'planted') return 'BOMB PLANTED'
			if (phase === 'freezetime') return 'FREEZETIME'
			if (phase === 'live') return 'LIVE'
			if (phase === 'over') return 'ROUND OVER'
			return 'MATCH READY'
		},
		observerPlayers() {
			const all = this.gsi?.allplayers || {}
			const spectatedSteamId = this.gsi?.player?.steamid || ''
			const lastSlots = this.additionalState?.lastKnownPlayerObserverSlot || {}

			const parsed = Object.entries(all).map(([steamid, p], idx) => {
				let rawSlot = p.observer_slot
				if (rawSlot === null || rawSlot === undefined) {
					rawSlot = lastSlots[steamid]
				}
				if (rawSlot === undefined || rawSlot === null) {
					rawSlot = idx
				}
				rawSlot = Number(rawSlot)
				// CS2 physical spectator keys: 1..5 for CT, 6..9,0 for T
				// slot 0 -> key '1', slot 1 -> key '2', ..., slot 8 -> key '9', slot 9 -> key '0'
				const slot = String((rawSlot + 1) % 10)

				// Active weapon resolving
				let activeWeapon = ''
				let ammoClip = null
				let hasBomb = false

				for (const w of Object.values(p.weapons || {})) {
					if (w.name === 'weapon_c4') hasBomb = true
					if (w.state === 'active') {
						activeWeapon = this.formatWeaponName(w.name)
						ammoClip = w.ammo_clip !== undefined ? w.ammo_clip : null
					}
				}

				if (!activeWeapon) {
					const nonKnife = Object.values(p.weapons || {}).find(w => w.name !== 'weapon_knife' && w.name !== 'weapon_c4')
					if (nonKnife) {
						activeWeapon = this.formatWeaponName(nonKnife.name)
						ammoClip = nonKnife.ammo_clip !== undefined ? nonKnife.ammo_clip : null
					}
				}

				return {
					steamid,
					name: p.name || 'Player',
					team: (p.team || 'CT').toUpperCase(),
					rawSlot,
					slot,
					health: p.state?.health ?? 0,
					isDead: (p.state?.health ?? 0) === 0,
					armor: p.state?.armor ?? 0,
					helmet: !!p.state?.helmet,
					defusekit: !!p.state?.defusekit,
					hasBomb,
					activeWeapon,
					ammoClip,
					kills: p.match_stats?.kills ?? 0,
					deaths: p.match_stats?.deaths ?? 0,
					assists: p.match_stats?.assists ?? 0,
					isSpectated: spectatedSteamId === steamid,
				}
			})

			const ct = parsed
				.filter(p => p.team === 'CT')
				.sort((a, b) => a.rawSlot - b.rawSlot)

			const t = parsed
				.filter(p => p.team === 'T')
				.sort((a, b) => a.rawSlot - b.rawSlot)

			return { ct, t, all: parsed }
		},
		aliveCountText() {
			const ctAlive = this.observerPlayers.ct.filter(p => !p.isDead).length
			const tAlive = this.observerPlayers.t.filter(p => !p.isDead).length
			if (ctAlive === 0 && tAlive === 0) return ''
			return `${ctAlive}v${tAlive}`
		},
	},
	mounted() {
		this.initWakeLock()
		this.connectWebSocket()
		this.fetchObsStatus()
		this.fetchCs2Status()
		setInterval(() => {
			this.fetchObsStatus()
			this.fetchCs2Status()
		}, 3000)

		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/remote/sw.js').catch(() => {})
		}
	},
	methods: {
		getToken() {
			const params = new URLSearchParams(window.location.search)
			let token = params.get('token')
			if (token) {
				try { localStorage.setItem('neuron_token', token) } catch (_) {}
			} else {
				try { token = localStorage.getItem('neuron_token') || '' } catch (_) {}
			}
			return token
		},
		switchTab(tab) {
			this.vibrate(25)
			this.activeTab = tab
		},
		formatWeaponName(name) {
			if (!name) return ''
			return WEAPON_MAP[name] || name.replace('weapon_', '').toUpperCase()
		},
		async specPlayer(player) {
			this.vibrate(35)
			try {
				const payload = (typeof player === 'object' && player) ? {
					slot: player.slot,
					rawSlot: player.rawSlot,
					steamid: player.steamid
				} : { slot: player }

				const res = await this.sendControlRequest('/api/cs2/spec', payload)
				if (res.ok) {
					const data = await res.json()
					if (!data.success && !data.connected && !data.windowsFallback) {
						alert('⚠️ Не удалось переключить камеру в CS2.\n\nУбедитесь, что CS2 запущена.')
					}
				}
			} catch (_) {}
		},
		triggerSpotlight(player) {
			this.vibrate(50)
			if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
			this.socket.send(JSON.stringify({
				event: 'draw:highlight',
				body: {
					steamid: player.steamid,
					tag: 'PLAYER SPOTLIGHT',
					side: player.team.toLowerCase(),
					durationMs: 8000
				}
			}))
		},
		getHpClass(hp) {
			if (hp > 50) return '--hp-high'
			if (hp > 20) return '--hp-mid'
			return '--hp-low'
		},
		// Haptic vibration feedback
		vibrate(pattern = 40) {
			if (navigator.vibrate) {
				try {
					navigator.vibrate(pattern)
				} catch (_) {}
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
			const token = this.getToken()
			const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : ''
			const wsUrl = `${proto}//${location.host}/${tokenQuery}`

			this.socket = new WebSocket(wsUrl)

			this.socket.onopen = () => {
				this.connected = true
				this.fetchObsStatus()
				this.fetchCs2Status()
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
					} else if (data.event === 'state' && data.body) {
						if (data.body.options) this.options = { ...this.options, ...data.body.options }
						if (data.body.gsiState) this.gsi = data.body.gsiState
						if (data.body.additionalState) this.additionalState = data.body.additionalState
					} else if (data.event === 'gsi_update' && data.body) {
						// Real-time 20Hz update without needing page reload
						if (data.body.gsiState) this.gsi = data.body.gsiState
						if (data.body.additionalState) this.additionalState = data.body.additionalState
					} else if (data.options) {
						this.options = { ...this.options, ...data.options }
					} else if (data.gsiState) {
						this.gsi = data.gsiState
					} else if (data.event === 'obs:status' && data.body) {
						this.obs = { ...this.obs, ...data.body }
					}
				} catch (_) {}
			}
		},

		async fetchObsStatus() {
			try {
				const token = this.getToken()
				const headers = token ? { 'x-neuron-token': token } : {}
				const res = await fetch('/api/obs/status', { headers })
				if (res.ok) {
					this.obs = await res.json()
				}
			} catch (_) {}
		},

		async fetchCs2Status() {
			try {
				const res = await fetch('/api/cs2/status')
				if (res.ok) {
					const data = await res.json()
					if (data.active !== undefined) {
						this.cs2 = { connected: !!data.active }
					} else if (data.netcon) {
						this.cs2 = { connected: !!data.netcon.connected }
					}
				}
			} catch (_) {}
		},

		async sendControlRequest(url, body = {}) {
			this.vibrate(35)
			let token = this.getToken()
			const headers = { 'Content-Type': 'application/json' }
			if (token) headers['x-neuron-token'] = token

			let res = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
			})

			if (res.status === 401) {
				const input = prompt('🔑 Требуется X-Neuron-Token для управления:')
				if (input && input.trim()) {
					token = input.trim()
					try { localStorage.setItem('neuron_token', token) } catch (_) {}
					headers['x-neuron-token'] = token
					res = await fetch(url, {
						method: 'POST',
						headers,
						body: JSON.stringify(body),
					})
				}
			}

			return res
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
			const next = this.currentHudScene === id ? 'default' : id
			this.options['match.activeScene'] = next
			if (this.socket && this.socket.readyState === WebSocket.OPEN) {
				this.socket.send(JSON.stringify({ event: 'config:update', body: { key: 'match.activeScene', value: next } }))
			}
		},

		setMatchFormat(bo) {
			this.vibrate(35)
			this.options['match.bestOf'] = bo
			if (this.socket && this.socket.readyState === WebSocket.OPEN) {
				this.socket.send(JSON.stringify({ event: 'config:update', body: { key: 'match.bestOf', value: bo } }))
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

		applyPreset(preset) {
			this.vibrate(35)
			this.tickerText = preset.text
			this.sendTicker()
		},

		sendTicker() {
			if (!this.tickerText) return
			this.vibrate(45)
			this.options['branding.ticker'] = this.tickerText
			if (this.socket && this.socket.readyState === WebSocket.OPEN) {
				this.socket.send(JSON.stringify({ event: 'config:update', body: { key: 'branding.ticker', value: this.tickerText } }))
			}
		},

		clearTicker() {
			this.vibrate([30, 40])
			this.tickerText = ''
			this.options['branding.ticker'] = ''
			this.options['promotion.visible'] = false
			if (this.socket && this.socket.readyState === WebSocket.OPEN) {
				this.socket.send(JSON.stringify({ event: 'config:update', body: { key: 'branding.ticker', value: '' } }))
				this.socket.send(JSON.stringify({ event: 'config:update', body: { key: 'promotion.visible', value: false } }))
			}
		},
	},
}

createApp(RemoteApp).mount('#app')
