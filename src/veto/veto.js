/**
 * NeuronCast Veto Screen Controller
 * Handles WebSocket communication, zero-transition hydration, and real-time state rendering.
 */

const MAP_NAMES = {
	de_mirage: 'Mirage',
	de_inferno: 'Inferno',
	de_nuke: 'Nuke',
	de_ancient: 'Ancient',
	de_anubis: 'Anubis',
	de_dust2: 'Dust II',
	de_vertigo: 'Vertigo',
	de_train: 'Train',
	de_overpass: 'Overpass',
}

let activeMatch = null
let activeVetoState = null
let isHydrated = false

// DOM Elements
const team1LogoEl = document.getElementById('team1-logo')
const team1NameEl = document.getElementById('team1-name')
const team1TagEl = document.getElementById('team1-tag')

const team2LogoEl = document.getElementById('team2-logo')
const team2NameEl = document.getElementById('team2-name')
const team2TagEl = document.getElementById('team2-tag')

const phaseIndicatorEl = document.getElementById('veto-phase-indicator')
const timerValEl = document.getElementById('veto-timer-val')
const cardsContainerEl = document.getElementById('veto-cards-container')
const stepLabelEl = document.getElementById('current-step-label')
const instructionEl = document.getElementById('current-instruction')
const historyTickerEl = document.getElementById('recent-action-ticker')

function getMapImageSrc(mapId) {
	return `/assets/maps/${mapId}.png`
}

function getTeamDisplayName(teamKey) {
	if (!activeMatch) return teamKey === 'team1' ? 'TEAM 1' : 'TEAM 2'
	return (teamKey === 'team1' ? activeMatch.team1?.name : activeMatch.team2?.name) || teamKey.toUpperCase()
}

/**
 * Renders header match telemetry (teams, logos, names).
 */
function updateHeader() {
	if (!activeMatch) return

	if (activeMatch.team1) {
		team1NameEl.textContent = activeMatch.team1.name || 'TEAM 1'
		team1TagEl.textContent = activeMatch.team1.tag || 'T1'
		if (activeMatch.team1.logoUrlLocal) {
			team1LogoEl.src = activeMatch.team1.logoUrlLocal
		}
	}

	if (activeMatch.team2) {
		team2NameEl.textContent = activeMatch.team2.name || 'TEAM 2'
		team2TagEl.textContent = activeMatch.team2.tag || 'T2'
		if (activeMatch.team2.logoUrlLocal) {
			team2LogoEl.src = activeMatch.team2.logoUrlLocal
		}
	}
}

/**
 * Builds or updates the cards DOM grid based on state.
 */
function renderVetoCards(state) {
	if (!state || !state.activeMapPool) return

	cardsContainerEl.innerHTML = ''

	state.activeMapPool.forEach((mapId) => {
		const statusObj = state.mapsStatus?.[mapId] || { status: 'AVAILABLE' }
		const cardEl = document.createElement('div')
		cardEl.className = `map-card --${statusObj.status.toLowerCase()}`
		cardEl.id = `card-${mapId}`

		const mapPrettyName = MAP_NAMES[mapId] || mapId.toUpperCase()
		const imageSrc = getMapImageSrc(mapId)

		let statusBadgeText = ''
		let teamSubtext = ''
		let sideBadgeHtml = ''

		if (statusObj.status === 'BANNED') {
			statusBadgeText = 'BANNED'
			teamSubtext = statusObj.actionTeam ? `BY ${getTeamDisplayName(statusObj.actionTeam)}` : ''
		} else if (statusObj.status === 'PICKED') {
			statusBadgeText = 'PICKED'
			teamSubtext = statusObj.actionTeam ? `BY ${getTeamDisplayName(statusObj.actionTeam)}` : ''
			if (statusObj.pickedSide) {
				const picker = statusObj.sidePickingTeam ? `${getTeamDisplayName(statusObj.sidePickingTeam)}: ` : ''
				sideBadgeHtml = `<div class="side-pick-badge">${picker}${statusObj.pickedSide}</div>`
			}
		} else if (statusObj.status === 'DECIDER') {
			statusBadgeText = 'DECIDER'
			teamSubtext = 'MAP 3'
			if (statusObj.pickedSide) {
				sideBadgeHtml = `<div class="side-pick-badge">${statusObj.pickedSide}</div>`
			}
		}

		cardEl.innerHTML = `
			<img class="map-bg-image" src="${imageSrc}" onerror="this.src='/assets/maps/random.webp'" alt="${mapPrettyName}">
			<div class="map-card-overlay"></div>
			<div class="map-card-header">
				${statusObj.orderIndex ? `<span class="order-badge">#${statusObj.orderIndex}</span>` : '<span></span>'}
			</div>
			<div class="map-card-body">
				${statusBadgeText ? `<div class="action-status-badge">${statusBadgeText}</div>` : ''}
				${teamSubtext ? `<div class="action-team-label">${teamSubtext}</div>` : ''}
				${sideBadgeHtml}
			</div>
			<div class="map-card-footer">
				<h3 class="map-title">${mapPrettyName}</h3>
			</div>
		`

		cardsContainerEl.appendChild(cardEl)
	})
}

/**
 * Updates status text, step counter, timer and recent history.
 */
function updateVetoFooter(state) {
	if (!state) return

	if (state.phase === 'COMPLETED') {
		phaseIndicatorEl.textContent = 'VETO COMPLETED'
		stepLabelEl.textContent = 'DONE'
		instructionEl.textContent = 'All maps and sides have been decided'
		timerValEl.textContent = '00'
	} else if (state.phase === 'IN_PROGRESS') {
		const stepNum = (state.currentStepIndex || 0) + 1
		const total = state.totalSteps || state.schedule?.length || 7
		stepLabelEl.textContent = `STEP ${stepNum}/${total}`

		const currentTeamName = state.currentActorTeam ? getTeamDisplayName(state.currentActorTeam) : 'TEAM'
		if (state.currentActionType === 'BAN') {
			phaseIndicatorEl.textContent = `${currentTeamName} BANNING`
			instructionEl.textContent = `${currentTeamName} is selecting a map to ban`
		} else if (state.currentActionType === 'PICK') {
			phaseIndicatorEl.textContent = `${currentTeamName} PICKING`
			instructionEl.textContent = `${currentTeamName} is selecting a map to play`
		} else if (state.currentActionType === 'SIDE_PICK') {
			const targetName = state.targetMapId ? MAP_NAMES[state.targetMapId] || state.targetMapId : 'the map'
			phaseIndicatorEl.textContent = `${currentTeamName} SIDE SELECTION`
			instructionEl.textContent = `${currentTeamName} is choosing starting side (CT/T) on ${targetName}`
		}

		if (state.timer?.secondsLeft !== undefined) {
			timerValEl.textContent = String(state.timer.secondsLeft).padStart(2, '0')
		}
	} else {
		phaseIndicatorEl.textContent = 'WAITING TO START'
		stepLabelEl.textContent = 'STANDBY'
		instructionEl.textContent = 'Waiting for operator to begin veto session'
		timerValEl.textContent = '--'
	}

	// Update action history ticker
	if (Array.isArray(state.actionHistory) && state.actionHistory.length > 0) {
		const recent = state.actionHistory.slice(-4)
		historyTickerEl.innerHTML = recent.map(act => {
			const teamName = getTeamDisplayName(act.team)
			const mapName = MAP_NAMES[act.mapId] || act.mapId
			return `<span class="history-chip"><strong>${teamName}</strong> ${act.type} ${mapName}</span>`
		}).join('')
	} else {
		historyTickerEl.innerHTML = ''
	}
}

/**
 * Hydrates state with safeguard against CSS animation explosion.
 */
function hydrateState(state) {
	activeVetoState = state
	renderVetoCards(state)
	updateVetoFooter(state)

	if (!isHydrated) {
		// Double requestAnimationFrame ensures the browser paints initial layout before removing transition block
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				document.body.classList.remove('no-transitions')
				isHydrated = true
			})
		})
	}
}

// ================= WebSocket & Bootstrap =================

async function init() {
	// 1. Fetch initial match config and veto state via REST
	try {
		const matchRes = await fetch('/api/match/config')
		if (matchRes.ok) {
			const matchData = await matchRes.json()
			if (matchData.config) {
				activeMatch = matchData.config
				updateHeader()
			}
		}

		const vetoRes = await fetch('/api/veto/state')
		if (vetoRes.ok) {
			const vetoData = await vetoRes.json()
			if (vetoData.state) {
				hydrateState(vetoData.state)
			}
		}
	} catch (err) {
		console.warn('[Veto Screen] Initial fetch warning:', err.message)
	}

	// 2. Establish live WebSocket connection
	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
	const wsUrl = `${protocol}//${window.location.host}`
	const socket = new WebSocket(wsUrl)

	socket.onmessage = (event) => {
		try {
			const parsed = JSON.parse(event.data)
			if (parsed.event === 'veto:sync') {
				hydrateState(parsed.body)
			} else if (parsed.event === 'match:config_updated') {
				activeMatch = parsed.body
				updateHeader()
			}
		} catch (err) {
			console.error('[Veto Screen] WebSocket parse error:', err)
		}
	}

	socket.onclose = () => {
		console.warn('[Veto Screen] Socket closed, reconnecting in 2s...')
		setTimeout(init, 2000)
	}
}

window.addEventListener('DOMContentLoaded', init)
