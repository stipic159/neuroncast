import RoundResultBanner from '/hud/round-result-banner/round-result-banner.vue'
import Corners from '/hud/corners/corners.vue'
import FocusedPlayer from '/hud/focused-player/focused-player.vue'
import MvpCard from '/hud/mvp-card/mvp-card.vue'
import MapWinner from '/hud/map-winner/map-winner.vue'
import PlayersAlive from '/hud/players-alive/players-alive.vue'
import Scoreboard from '/hud/scoreboard/scoreboard.vue'
import PlayerHighlight from '/hud/player-highlight/player-highlight.vue'
import Radar from '/hud/radar/radar.vue'
import SeriesGraph from '/hud/series-graph/series-graph.vue'
import Sidebars from '/hud/sidebars/sidebars.vue'
import Sponsors from '/hud/sponsors/sponsors.vue'
import SvgFilters from '/hud/svg-filters/svg-filters.vue'
import Telestrator from '/hud/telestrator/telestrator.vue'
import PromotionPanel from '/hud/promotion-panel/promotion-panel.vue'
import TopBar from '/hud/top-bar/top-bar.vue'
import WinProbGraph from '/hud/win-prob-graph/win-prob-graph.vue'
import Maps from '/hud/maps/maps.vue'
import MapsSleek from '/hud/maps-sleek/maps-sleek.vue'
import KlSeries from '/hud/kl-series/kl-series.vue'
import BombCallout from '/hud/bomb-callout/bomb-callout.vue'
import WaitingIdle from '/hud/waiting-idle/waiting-idle.vue'
import ClutchBanner from '/hud/clutch-banner/clutch-banner.vue'
import { getPlayerDisplayName, getTeamLogoPath } from '/hud/helpers/player-resolver.js'
import { buildHudTeamIdentityContext, resolveTeamIdentities } from '/hud/helpers/team-identity-resolver.js'
import { applyResolvedCssVariables, getMigratedOptionKeys, resolveOption, RADAR_OPTION_DEFINITIONS, TOPBAR_OPTION_DEFINITIONS, SIDEBAR_POSITION_OPTION_DEFINITIONS, SIDEBAR_VISIBILITY_OPTION_DEFINITIONS, PLAYERS_ALIVE_OPTION_DEFINITIONS, FOCUSED_PLAYER_OPTION_DEFINITIONS, CURRENT_MAP_OPTION_DEFINITIONS, EVENT_BADGE_OPTION_DEFINITIONS, SERIES_OPTION_DEFINITIONS, SPONSOR_OPTION_DEFINITIONS, MAPS_OPTION_DEFINITIONS, THEME_MATERIALS_OPTION_DEFINITIONS, THEME_COLORS_OPTION_DEFINITIONS, THEME_SHAPES_OPTION_DEFINITIONS, THEME_TYPOGRAPHY_OPTION_DEFINITIONS, PROMOTION_OPTION_DEFINITIONS } from '/hud/core/resolve-option.js'
import { options } from '/hud/core/state.js'

export default {
	components: {
		RoundResultBanner,
		Corners,
		FocusedPlayer,
		MvpCard,
		MapWinner,
		PlayersAlive,
		Scoreboard,
		PlayerHighlight,
		Radar,
		SeriesGraph,
		Sidebars,
		Sponsors,
		SvgFilters,
		Telestrator,
		PromotionPanel,
		TopBar,
		WinProbGraph,
		Maps,
		MapsSleek,
		KlSeries,
		BombCallout,
		WaitingIdle,
		ClutchBanner,
	},

	computed: {
		isEventBadgeVisible() {
			const val = resolveOption('layout.eventBadge.visible', 'flex')
			return val !== 'none' && val !== false && val !== 'false'
		},

		eventBadgeLogo() {
			return resolveOption('series.logoUrl', '/hud/img/branding/logo-ubg.png') || '/hud/img/branding/logo-ubg.png'
		},

		eventBadgeTitle() {
			return resolveOption('series.name.center', 'NeuronCast') || 'NeuronCast'
		},

		eventBadgeSubtitle() {
			return resolveOption('series.name.left', '') || ''
		},

		eventBadgeRight() {
			return resolveOption('series.name.right', '') || ''
		},
		// the KL waiting / result panel is on screen (it has its own series row)
		klPanelVisible() {
			return !!this.komplettligaenMatch && ['waiting', 'result'].includes(this.komplettligaenView)
		},

		komplettligaenView() {
			const scene = this.$opts?.['match.activeScene']
			if (scene === 'intro') return 'match'
			if (scene === 'halftime') return 'waiting'
			if (scene === 'fulltime' || scene === 'over') return 'result'
			if (scene === 'analytics') return 'table'
			return this.komplettligaen?.config?.activeView || 'match'
		},

		winningTeamName() {
			if (!this.$round?.winningSide) return null
			return this.resolvedTeamIdentities?.[this.$round.winningSide]?.final.name || this.$round.winningSide
		},

		winningTeamLogo() {
			if (!this.$round?.winningSide) return null
			return this.resolvedTeamIdentities?.[this.$round.winningSide]?.final.logo || getTeamLogoPath(this.winningTeamName)
		},

		resolvedTeamIdentities() {
			const context = buildHudTeamIdentityContext({
				teams: this.$teams,
				map: this.$map,
				options: this.$opts,
				match: this.komplettligaenMatch,
			})
			return resolveTeamIdentities(context).teams
		},

		komplettligaenMatch() {
			const m = this.komplettligaen?.data?.match
			if (!m || m.id === 'fallback-match' || !this.komplettligaen?.config?.matchId) {
				return null
			}
			return m
		},

		gsiSeriesMatch() {
			if (this.komplettligaenMatch) return this.komplettligaenMatch
			const bestOf = this.matchBestOf || 1
			if (bestOf <= 1 && !this.$opts?.['series.maps.0.name']) return null

			const maps = []
			for (let i = 0; i < bestOf; i++) {
				const name = this.$opts?.[`series.maps.${i}.name`] || (i === 0 ? this.$map?.name : null)
				const winner = this.$opts?.[`series.maps.${i}.winner`]
				const homeScore = this.$opts?.[`series.maps.${i}.score.home`]
				const awayScore = this.$opts?.[`series.maps.${i}.score.away`]
				const finished = this.$opts?.[`series.maps.${i}.finished`]

				if (name || i === 0) {
					maps.push({
						number: i + 1,
						name: name || `Map ${i + 1}`,
						winner,
						homeScore: homeScore != null ? Number(homeScore) : null,
						awayScore: awayScore != null ? Number(awayScore) : null,
						finished: Boolean(finished),
					})
				}
			}

			return {
				bestOf,
				home: this.gsiCtTeam,
				away: this.gsiTTeam,
				currentMap: this.$map,
				maps,
			}
		},

		matchBestOf() {
			if (this.$opts?.['match.bestOf']) return Number(this.$opts['match.bestOf'])
			if (this.komplettligaenMatch?.bestOf) return Number(this.komplettligaenMatch.bestOf)
			if (this.$opts?.['branding.seriesBestOf']) return Number(this.$opts['branding.seriesBestOf'])
			if (this.$opts?.['series.maps.2.name']) return 3
			return 1
		},

		matchFormatLabel() {
			return `BEST OF ${this.matchBestOf}`
		},

		breakStatusText() {
			const phase = this.$round?.phase || this.$gsiState?.round?.phase
			const bomb = this.$round?.bomb || this.$gsiState?.round?.bomb
			if (phase === 'over' || phase === 'intermission') return 'HALFTIME BREAK'
			if (bomb === 'defused' || bomb === 'exploded') return 'ROUND BREAK'
			const roundNum = (this.$map?.round ?? 0) + 1
			if (roundNum <= 12) return `FIRST HALF · ROUND ${roundNum}`
			if (roundNum <= 24) return `SECOND HALF · ROUND ${roundNum}`
			return `OVERTIME · ROUND ${roundNum}`
		},

		komplettligaenTableRows() {
			return this.komplettligaen?.data?.table?.rows || []
		},

		komplettligaenTeamGames() {
			return this.komplettligaen?.data?.teamGames?.teams || []
		},

		komplettligaenMatchDetail() {
			const match = this.komplettligaenMatch
			if (!match) return { label: '', homeScore: '', awayScore: '', hasScore: false }

			if (match.currentMap) {
				const name = match.currentMap.name || `Map ${match.currentMap.number || ''}`.trim()
				const hasScore = match.currentMap.homeScore != null || match.currentMap.awayScore != null
				// before the map starts there is no score - say what is next instead of "- - -"
				return {
					label: hasScore ? name : `Next up · ${name}`,
					homeScore: hasScore ? match.currentMap.homeScore ?? 0 : '',
					awayScore: hasScore ? match.currentMap.awayScore ?? 0 : '',
					hasScore,
				}
			}

			if (match.matchWinner) {
				return { label: `${match[match.matchWinner].name} wins`, homeScore: '', awayScore: '', hasScore: false }
			}

			const startsAt = match.startsAt ? new Date(match.startsAt) : null
			if (startsAt && !Number.isNaN(startsAt.getTime()) && new Date() < startsAt) {
				return { label: this.formatKomplettligaenDate(match.startsAt), homeScore: '', awayScore: '', hasScore: false }
			}

			return { label: '', homeScore: '', awayScore: '', hasScore: false }
		},

		komplettligaenMatchState() {
			const match = this.komplettligaenMatch
			if (!match) return ''
			if (match.matchWinner) return `${match[match.matchWinner].name} wins`
			if (match.currentMap) {
				const name = match.currentMap.name || `Map ${match.currentMap.number || ''}`.trim()
				const hasScore = match.currentMap.homeScore != null || match.currentMap.awayScore != null
				if (!hasScore) return `Next up · ${name}` // no "DUST II ---" before the map starts
				return `${name} · ${match.currentMap.homeScore ?? 0} – ${match.currentMap.awayScore ?? 0}`
			}
			const startsAt = match.startsAt ? new Date(match.startsAt) : null
			if (startsAt && !Number.isNaN(startsAt.getTime()) && new Date() < startsAt) return this.formatKomplettligaenDate(match.startsAt)
			return `BO${match.bestOf || 3}`
		},

		gsiCtTeam() {
			return {
				name: this.resolvedTeamIdentities?.CT?.final?.name || this.$map?.team_ct?.name || 'Counter-Terrorists',
				score: this.$map?.team_ct?.score ?? 0,
				logo: this.resolvedTeamIdentities?.CT?.final?.logo || getTeamLogoPath(this.$map?.team_ct?.name),
			}
		},

		gsiTTeam() {
			return {
				name: this.resolvedTeamIdentities?.T?.final?.name || this.$map?.team_t?.name || 'Terrorists',
				score: this.$map?.team_t?.score ?? 0,
				logo: this.resolvedTeamIdentities?.T?.final?.logo || getTeamLogoPath(this.$map?.team_t?.name),
			}
		},

		gsiCtPlayers() {
			const source = (this.$players && this.$players.length) 
				? this.$players 
				: Object.entries(this.$gsiState?.allplayers || {}).map(([steamId, p]) => ({
					steam64Id: steamId,
					steamId,
					name: p.name || 'Player',
					team: (p.team || '').toUpperCase(),
					side: (p.team || '').toUpperCase() === 'CT' ? 3 : 2,
					kills: p.match_stats?.kills ?? 0,
					assists: p.match_stats?.assists ?? 0,
					deaths: p.match_stats?.deaths ?? 0,
					mvps: p.match_stats?.mvps ?? 0,
					score: p.match_stats?.score ?? 0,
					adr: 0,
				}))

			return source
				.filter((p) => p.side === 3 || String(p.team || '').toUpperCase() === 'CT')
				.map((p) => ({
					...p,
					displayName: this.getPlayerName(p),
					kd: this.calculateKD(p.kills, p.deaths),
				}))
				.sort((a, b) => (b.kills - a.kills) || (a.deaths - b.deaths))
		},

		gsiTPlayers() {
			const source = (this.$players && this.$players.length) 
				? this.$players 
				: Object.entries(this.$gsiState?.allplayers || {}).map(([steamId, p]) => ({
					steam64Id: steamId,
					steamId,
					name: p.name || 'Player',
					team: (p.team || '').toUpperCase(),
					side: (p.team || '').toUpperCase() === 'CT' ? 3 : 2,
					kills: p.match_stats?.kills ?? 0,
					assists: p.match_stats?.assists ?? 0,
					deaths: p.match_stats?.deaths ?? 0,
					mvps: p.match_stats?.mvps ?? 0,
					score: p.match_stats?.score ?? 0,
					adr: 0,
				}))

			return source
				.filter((p) => p.side === 2 || String(p.team || '').toUpperCase() === 'T')
				.map((p) => ({
					...p,
					displayName: this.getPlayerName(p),
					kd: this.calculateKD(p.kills, p.deaths),
				}))
				.sort((a, b) => (b.kills - a.kills) || (a.deaths - b.deaths))
		},

		gsiMatchMvp() {
			const all = [...this.gsiCtPlayers, ...this.gsiTPlayers]
			if (!all.length) return null
			return all.slice().sort((a, b) => {
				const aScore = (a.kills * 2) + (a.assists * 1) - (a.deaths * 0.5) + ((a.adr || 0) * 0.1) + ((a.mvps || 0) * 3)
				const bScore = (b.kills * 2) + (b.assists * 1) - (b.deaths * 0.5) + ((b.adr || 0) * 0.1) + ((b.mvps || 0) * 3)
				return bScore - aScore
			})[0]
		},

		gsiMatchWinner() {
			const forced = this.$opts?.['preferences.celebration.forceWinner']
			if (forced === 'team2') return 'CT'
			if (forced === 'team1') return 'T'
			const ct = this.gsiCtTeam.score
			const t = this.gsiTTeam.score
			if (ct >= 13 && (ct - t) >= 2) return 'CT'
			if (t >= 13 && (t - ct) >= 2) return 'T'
			if (this.$round?.winningSide) return this.$round.winningSide
			return ct > t ? 'CT' : (t > ct ? 'T' : null)
		},

		gsiWinnerName() {
			if (this.gsiMatchWinner === 'CT') return this.gsiCtTeam.name
			if (this.gsiMatchWinner === 'T') return this.gsiTTeam.name
			return ''
		},

		hasObserverData() {
			return this.$players?.length > 0
		},

		showObserverDataWarning() {
			const scene = this.$opts?.['match.activeScene']
			if (['intro', 'halftime', 'fulltime', 'over', 'analytics', 'radar'].includes(scene)) return false
			return !!(
				this.$map?.name
				&& this.$gsiState?.player
				&& ! this.hasObserverData
			)
		},

		_vantaEffectKey() {
			return this.$opts['css.vanta-effect'] || 'net'
		},
	},

	data() {
		return {
			komplettligaen: null,
			isLoadingKomplettligaen: true,
			posterLogoFailed: false,
		}
	},

	mounted() {
		// Set up dynamic robust deep watch on NeuronCast's reactive global options
		this.$watch(
			() => options,
			() => {
				console.log('[HUD Shell Watcher] Options mutated:', JSON.stringify(options))
				this.applyCssVariableOverrides()
				this.applyCustomFontFace()
			},
			{ deep: true, immediate: true }
		)

		// Set up active scene intermission watch
		this.$watch(
			() => options['match.activeScene'],
			(scene) => {
				const isIntermission = ['intro', 'halftime', 'fulltime', 'over', 'analytics', 'radar'].includes(scene)
				if (isIntermission && !this._vantaEffect) this.initVanta()
				else if (!isIntermission && this._vantaEffect) this.destroyVanta()
			},
			{ immediate: true }
		)

		this.setScaleFactor()
		this.setMapImageUrl()

		window.addEventListener('resize', this.setScaleFactor)
		this.loadKomplettligaen()
		this._komplettligaenInterval = setInterval(() => this.loadKomplettligaen(), 60000)
		this.initVanta()
	},

	watch: {
		'$round.winningSide': {
			handler() {
				this.posterLogoFailed = false
			}
		},
		'$map.sanitizedName': {
			handler() {
				this.setMapImageUrl()
			},
			immediate: true,
		},
		_vantaEffectKey() {
			this.initVanta()
		},
	},

	beforeUnmount() {
		window.removeEventListener('resize', this.setScaleFactor)
		if (this._komplettligaenInterval) clearInterval(this._komplettligaenInterval)
		this.destroyVanta()
	},

	methods: {
		resolveOption(key, fallback = null) {
			return resolveOption(key, fallback)
		},
		async loadKomplettligaen() {
			this.isLoadingKomplettligaen = true
			try {
				const response = await fetch('/api/komplettligaen')
				this.komplettligaen = await response.json()
				this.setMapImageUrl()
			} catch (err) {
				console.error('Error loading Komplettligaen data:', err)
			} finally {
				this.isLoadingKomplettligaen = false
			}
		},

		calculateKD(kills, deaths) {
			const k = Number(kills) || 0
			const d = Number(deaths) || 0
			if (d === 0) return k.toFixed(2)
			return (k / d).toFixed(2)
		},

		getTeamLogoPath,

		getPlayerName(p) {
			if (!p) return ''
			return getPlayerDisplayName(p.steamId, p.name, this.$opts?.['teams.playerNameOverrides'])
		},

		formatKomplettligaenDate(value) {
			if (!value) return 'TBD'
			const date = new Date(value)
			if (Number.isNaN(date.getTime())) return 'TBD'

			return new Intl.DateTimeFormat('en-GB', {
				day: '2-digit',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit',
				hourCycle: 'h23',
				timeZone: 'Europe/Oslo',
			}).format(date)
		},

		isFeaturedKomplettligaenTeam(team) {
			return team?.name === '6614Gamers'
		},

		isFeaturedTableRow(row) {
			const names = [this.komplettligaenMatch?.home?.name, this.komplettligaenMatch?.away?.name].filter(Boolean)
			return names.includes(row.team) || String(row.team || '').includes('6614Gamers')
		},

		mapBackgroundStyle(map) {
			if (!map?.image) return {}
			return {
				backgroundImage: `linear-gradient(90deg, rgba(7, 13, 23, 0.82), rgba(7, 13, 23, 0.55)), url("${map.image}")`,
			}
		},

		applyCssVariableOverrides() {
			if (!this.$opts) return
			const target = this.$el || (typeof document !== 'undefined' ? document.documentElement : null)

			// 1. Resolve and apply the decoupled slices cleanly to target element and root
			applyResolvedCssVariables(RADAR_OPTION_DEFINITIONS, target)
			applyResolvedCssVariables(TOPBAR_OPTION_DEFINITIONS, target)
			applyResolvedCssVariables(SIDEBAR_POSITION_OPTION_DEFINITIONS, target)
			applyResolvedCssVariables(SIDEBAR_VISIBILITY_OPTION_DEFINITIONS, target)
			applyResolvedCssVariables(PLAYERS_ALIVE_OPTION_DEFINITIONS, target)
			applyResolvedCssVariables(FOCUSED_PLAYER_OPTION_DEFINITIONS, target)
			applyResolvedCssVariables(CURRENT_MAP_OPTION_DEFINITIONS, target)
			applyResolvedCssVariables(EVENT_BADGE_OPTION_DEFINITIONS, target)
			applyResolvedCssVariables(SERIES_OPTION_DEFINITIONS, target)
			applyResolvedCssVariables(SPONSOR_OPTION_DEFINITIONS, target)
			applyResolvedCssVariables(MAPS_OPTION_DEFINITIONS, target)
			applyResolvedCssVariables(THEME_MATERIALS_OPTION_DEFINITIONS, target)
			applyResolvedCssVariables(THEME_COLORS_OPTION_DEFINITIONS, target)
			applyResolvedCssVariables(THEME_SHAPES_OPTION_DEFINITIONS, target)
			applyResolvedCssVariables(THEME_TYPOGRAPHY_OPTION_DEFINITIONS, target)
			applyResolvedCssVariables(PROMOTION_OPTION_DEFINITIONS, target)

			// Dynamically retrieve the keys and legacy aliases to bypass in the loop
			const migratedKeys = [\
				...getMigratedOptionKeys(RADAR_OPTION_DEFINITIONS),\
				...getMigratedOptionKeys(TOPBAR_OPTION_DEFINITIONS),\
				...getMigratedOptionKeys(SIDEBAR_POSITION_OPTION_DEFINITIONS),\
				...getMigratedOptionKeys(SIDEBAR_VISIBILITY_OPTION_DEFINITIONS),\
				...getMigratedOptionKeys(PLAYERS_ALIVE_OPTION_DEFINITIONS),\
				...getMigratedOptionKeys(FOCUSED_PLAYER_OPTION_DEFINITIONS),\
				...getMigratedOptionKeys(CURRENT_MAP_OPTION_DEFINITIONS),\
				...getMigratedOptionKeys(EVENT_BADGE_OPTION_DEFINITIONS),\
				...getMigratedOptionKeys(SERIES_OPTION_DEFINITIONS),\
				...getMigratedOptionKeys(SPONSOR_OPTION_DEFINITIONS),\
				...getMigratedOptionKeys(MAPS_OPTION_DEFINITIONS),\
				...getMigratedOptionKeys(THEME_MATERIALS_OPTION_DEFINITIONS),\
				...getMigratedOptionKeys(THEME_COLORS_OPTION_DEFINITIONS),\
				...getMigratedOptionKeys(THEME_SHAPES_OPTION_DEFINITIONS),\
				...getMigratedOptionKeys(THEME_TYPOGRAPHY_OPTION_DEFINITIONS),\
				...getMigratedOptionKeys(PROMOTION_OPTION_DEFINITIONS)\
			]

			// 2. Generic loop for all other options
			Object.entries(this.$opts).forEach(([key, value]) => {
				// Visibility Management via Helper Class (Preserves Design Integrity)
				if (key.endsWith('-display')) {
					const id = key.substring(4).replace('-display', '').replace('lan66-', '')
					let selector = `.${id}`
					if (id === 'sidebar-left') selector = '.sidebar.--left'
					else if (id === 'sidebar-right') selector = '.sidebar.--right'
					else if (id === 'sponsor-left') selector = '.sponsor-slot.--left'
					else if (id === 'sponsor-right') selector = '.sponsor-slot.--right'

					const el = document.querySelector(selector)
					if (el) {
						if (value === 'none') el.classList.add('--layout-hidden')
						else el.classList.remove('--layout-hidden')
					}

					// Skip standard CSS variable assignment for already migrated keys
					if (migratedKeys.includes(key)) return

					const prop = `--${key.substring(4)}`
					document.documentElement.style.setProperty(prop, value)
					return
				}

				// Skip standard CSS variable assignment for already migrated keys
				if (migratedKeys.includes(key)) return
				if (!key.startsWith('css.')) return
				const prop = `--${key.substring(4)}`

				if (value === '') {
					document.documentElement.style.removeProperty(prop)
				} else {
					document.documentElement.style.setProperty(
						prop,
						key.endsWith('-rgb') ? this.getRgbValueFromHex(value) : value,
					)
				}
			})
			this.setScaleFactor()
		},

		applyCustomFontFace() {
			const styleId = 'eon-custom-hud-font'
			const existing = document.getElementById(styleId)
			const fontUrl = resolveOption('theme.typography.customFontUrl', '')
			const fontFamily = resolveOption('theme.typography.primaryFont', 'Quantico')

			if (!fontUrl || !fontFamily || !String(fontUrl).startsWith('/hud/')) {
				existing?.remove()
				return
			}

			const safeFamily = String(fontFamily).replace(/[^a-z0-9 _-]/gi, '').trim()
			const safeUrl = String(fontUrl).replace(/[\"'\\\\()]/g, '')
			if (!safeFamily || !safeUrl) {
				existing?.remove()
				return
			}

			const style = existing || document.createElement('style')
			style.id = styleId
			style.textContent = `@font-face { font-family: "${safeFamily}"; src: url("${safeUrl}"); font-weight: 100 900; font-style: normal; font-display: swap; }`
			if (!existing) document.head.appendChild(style)
		},

		getRgbValueFromHex(hex) {
			if (! hex.startsWith('#')) return hex

			hex = hex.substring(1)
			if (hex.length === 3) hex = `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`

			const r = parseInt(hex.substring(0, 2), 16)
			const g = parseInt(hex.substring(2, 4), 16)
			const b = parseInt(hex.substring(4, 6), 16)

			return `${r}, ${g}, ${b}`
		},

		setScaleFactor() {
			const calculatedScaleFactor = this.calculateScaleFactor()
			document.documentElement.style.setProperty('--scale-factor', calculatedScaleFactor)
		},

		calculateScaleFactor() {
			const raw = getComputedStyle(document.documentElement).getPropertyValue('--base-scale-factor').trim() || '0.9259vh'
			const baseValue = parseFloat(raw)
			const unitMatch = raw.match(/\\D+$/)
			const baseUnit = unitMatch ? unitMatch[0] : 'px'

			switch (baseUnit) {
				case 'vh': return `${Math.round(window.innerHeight / 100 * baseValue)}px`
				case 'vw': return `${Math.round(window.innerWidth / 100 * baseValue)}px`
				default: return isNaN(baseValue) ? '10px' : `${baseValue}px`
			}
		},

		setMapImageUrl() {
			const komplettligaenMapImage = this.komplettligaenMatch?.currentMap?.image
				|| this.komplettligaenMatch?.maps?.find?.((map) => map.image)?.image
			if (komplettligaenMapImage && !this.$map?.sanitizedName) {
				document.documentElement.style.setProperty('--map-image-url', `url("${komplettligaenMapImage}")`)
				return
			}

			if (!this.$map?.sanitizedName) return
			document.documentElement.style.setProperty(
				'--map-image-url',
				`url("/hud/img/maps/${this.$map.sanitizedName}.png")`
			)
		},

		// ── Vanta.js Background ──
		initVanta() {
			if (!window.VANTA) return
			this.destroyVanta()

			const el = this.$refs.vantaContainer
			if (!el) return

			const effect = (this.$opts?.['css.vanta-effect'] || 'net').toUpperCase()
			const factory = window.VANTA[effect]
			if (!factory) return

			const base = {
				el,
				THREE: window.THREE,
				mouseControls: false,
				touchControls: false,
				gyroControls: false,
				minHeight: 200,
				minWidth: 200,
				scale: 1.0,
				scaleMobile: 1.0,
				backgroundColor: 0x020305,
				forceAnimate: true,
			}

			const presets = {
				NET: { color: 0x3498db, points: 12, maxDistance: 22, spacing: 18, showDots: true },
				CELLS: { color1: 0x0a2540, color2: 0x134e7a, size: 2.0, speed: 0.8 },
				WAVES: { color: 0x0a1628, shininess: 35, waveHeight: 15, waveSpeed: 0.8 },
				BIRDS: { color1: 0x3498db, color2: 0x0a2540, colorMode: 'lerpGradient', quantity: 3, birdSize: 1.2, speedLimit: 4, separation: 30 },
				CLOUDS: { skyColor: 0x080f1a, cloudColor: 0x243b5e, cloudShadowColor: 0x040912, sunColor: 0x3a92c9, sunGlareColor: 0x1a4670, sunlightColor: 0x2a6891, speed: 1.0 },
				TOPOLOGY: { color: 0x3498db, backgroundColor: 0x020305 },
				DOTS: { color: 0x3498db, color2: 0x0a2540, backgroundColor: 0x020305, size: 2.5, spacing: 30, showLines: true },
				HALO: { color: 0x3498db, backgroundColor: 0x020305, size: 1.5 },
			}

			this._vantaEffect = factory({ ...base, ...(presets[effect] || {}) } )
		},

		destroyVanta() {
			if (this._vantaEffect) {
				this._vantaEffect.destroy()
				this._vantaEffect = null
			}
		},
	},
}
