<template>
	<div class="director-page">
		<!-- master arm: the one switch that makes the AI director real -->
		<section class="panel arm-panel" :class="{ '--armed': isOn('director.armed', false) }">
			<div class="arm-copy">
				<h2>{{ $t("AI Director") }}</h2>
				<p>
					{{ $t("Automatic camera direction, spotlight cards and scoreboard takeovers, driven by the eon-director engine. While disarmed the engine runs in shadow mode: it decides, logs, but never touches the broadcast.") }}
				</p>
			</div>
			<label class="arm-switch">
				<span class="arm-state">{{ $text(isOn('director.armed', false) ? 'ARMED' : 'DISARMED') }}</span>
				<span class="switch --big">
					<input type="checkbox" :checked="isOn('director.armed', false)" @change="setOption('director.armed', $event.target.checked)">
					<span class="slider"></span>
				</span>
			</label>
		</section>

		<!-- feature modules: each can be sold/gated as a unit later -->
		<section class="panel">
			<header class="panel-header">
				<div>
					<h2>{{ $t("Spotlight Cards") }}</h2>
					<p>{{ $t("Cinematic player cards on big moments: ACE, clutch, multi-kill, big damage — each with its own look. Plus the end-of-match showcase.") }}</p>
				</div>
				<label class="switch">
					<input type="checkbox" :checked="isOn('director.cards.enabled', true)" @change="setOption('director.cards.enabled', $event.target.checked)">
					<span class="slider"></span>
				</label>
			</header>

			<div class="settings-grid" :class="{ '--dimmed': !isOn('director.cards.enabled', true) }">
				<label class="setting-card --switch">
					<span>
						<strong>{{ $t("End-of-match showcase") }}</strong>
						<small>{{ $t("Chains the match's best moments into a finale, ending on the MVP card.") }}</small>
					</span>
					<span class="switch">
						<input type="checkbox" :checked="isOn('director.cards.endgame', true)" @change="setOption('director.cards.endgame', $event.target.checked)">
						<span class="slider"></span>
					</span>
				</label>

				<label class="setting-card">
					<span>
						<strong>{{ $t("Multi-kill threshold") }}</strong>
						<small>{{ $t("Minimum kills in a round before a spotlight fires.") }}</small>
					</span>
					<div class="input-with-unit">
						<input type="number" min="2" max="5" step="1" :value="numOption('director.cards.minKills', 3)" @change="setOption('director.cards.minKills', Number($event.target.value))">
						<span>{{ $t("kills") }}</span>
					</div>
				</label>

				<label class="setting-card">
					<span>
						<strong>{{ $t("Big-damage threshold") }}</strong>
						<small>{{ $t("Round damage that earns a spotlight even without the kills.") }}</small>
					</span>
					<div class="input-with-unit">
						<input type="number" min="100" max="500" step="10" :value="numOption('director.cards.damageThreshold', 200)" @change="setOption('director.cards.damageThreshold', Number($event.target.value))">
						<span>{{ $t("dmg") }}</span>
					</div>
				</label>
			</div>
		</section>

		<section class="panel">
			<header class="panel-header">
				<div>
					<h2>{{ $t("Scoreboard Takeover") }}</h2>
					<p>{{ $t("During freezetime the sidebars fade and a lower-third scoreboard takes the stage — a stats break without leaving the action.") }}</p>
				</div>
				<label class="switch">
					<input type="checkbox" :checked="isOn('director.scoreboard.enabled', true)" @change="setOption('director.scoreboard.enabled', $event.target.checked)">
					<span class="slider"></span>
				</label>
			</header>

			<div class="settings-grid" :class="{ '--dimmed': !isOn('director.scoreboard.enabled', true) }">
				<label class="setting-card">
					<span>
						<strong>{{ $t("Cadence") }}</strong>
						<small>{{ $t("Show the takeover every Nth round's freezetime, not every round.") }}</small>
					</span>
					<div class="input-with-unit">
						<input type="number" min="1" max="10" step="1" :value="numOption('director.scoreboard.everyRounds', 3)" @change="setOption('director.scoreboard.everyRounds', Number($event.target.value))">
						<span>{{ $t("rounds") }}</span>
					</div>
				</label>
			</div>
		</section>

		<section class="panel">
			<header class="panel-header">
				<div>
					<h2>{{ $t("Cinematic Cameras") }}</h2>
					<p>{{ $t("Establishing shots authored per map: flybys over the spawns and overview pockets during dead air.") }}</p>
				</div>
			</header>

			<div class="settings-grid">
				<label class="setting-card --switch">
					<span>
						<strong>{{ $t("Auto scenes") }}</strong>
						<small>{{ $t("Follows the match: KL Waiting during warmup and halftime, Live HUD when play starts, KL Result when the map is over. Picking a scene by hand still works until the next phase change.") }}</small>
					</span>
					<span class="switch">
						<input type="checkbox" :checked="isOn('director.scenes.auto', true)" @change="setOption('director.scenes.auto', $event.target.checked)">
						<span class="slider"></span>
					</span>
				</label>

				<label class="setting-card --switch">
					<span>
						<strong>{{ $t("Auto reconnect") }}</strong>
						<small>{{ $t("GOTV goes down between maps and CS2 drops to the main menu. When on, the director opens the console, types the connect string below, and retries until it is back in.") }}</small>
					</span>
					<span class="switch">
						<input type="checkbox" :checked="isOn('director.reconnect.enabled', false)" @change="setOption('director.reconnect.enabled', $event.target.checked)">
						<span class="slider"></span>
					</span>
				</label>

				<label class="setting-card">
					<span>
						<strong>{{ $t("GOTV connect string") }}</strong>
						<small>{{ $t("Exactly what you would type into the console, e.g.") }} <code>connect 10.0.0.5:27020; password abc</code></small>
					</span>
					<input type="text" class="text-input" :value="strOption('director.reconnect.connect', '')" @change="setOption('director.reconnect.connect', $event.target.value.trim())" placeholder="connect host:port; password ...">
				</label>

				<label class="setting-card">
					<span>
						<strong>{{ $t("Console key / retry") }}</strong>
						<small>{{ $t("The key bound to the CS2 console on this PC, and how often to retry while still in the menu.") }}</small>
					</span>
					<div class="input-with-unit">
						<input type="text" class="text-input --short" :value="strOption('director.reconnect.consoleKey', 'F10')" @change="setOption('director.reconnect.consoleKey', $event.target.value.trim() || 'F10')">
						<input type="number" min="10" max="300" step="5" :value="numOption('director.reconnect.retrySeconds', 30)" @change="setOption('director.reconnect.retrySeconds', Number($event.target.value))">
						<span>{{ $t("sec") }}</span>
					</div>
				</label>

				<label class="setting-card --switch">
					<span>
						<strong>{{ $t("Freezetime flyby") }}</strong>
						<small>{{ $t("A slow cinematic move over the spawns while teams buy (x-ray off).") }}</small>
					</span>
					<span class="switch">
						<input type="checkbox" :checked="isOn('director.cameras.flyby', true)" @change="setOption('director.cameras.flyby', $event.target.checked)">
						<span class="slider"></span>
					</span>
				</label>

				<label class="setting-card --switch">
					<span>
						<strong>{{ $t("Dead-air establishing shots") }}</strong>
						<small>{{ $t("When nothing is happening mid-round, cut to an overview instead of a static player.") }}</small>
					</span>
					<span class="switch">
						<input type="checkbox" :checked="isOn('director.cameras.idleShots', false)" @change="setOption('director.cameras.idleShots', $event.target.checked)">
						<span class="slider"></span>
					</span>
				</label>
			</div>
		</section>

		<p class="footnote">
			{{ $t("Settings apply live: the HUD honours them instantly and the director engine picks them up over the same channel — no restarts. The engine binary runs alongside eon (eon-director).") }}
		</p>
	</div>
</template>

<script>
import { state, actions } from '/config/store.js'

export default {
	setup() {
		return { state }
	},
	async mounted() {
		// seed any keys the websocket state push didn't carry yet (fresh installs)
		try {
			const res = await fetch('/config/options')
			const json = await res.json()
			for (const opt of json) {
				if (!opt.key.startsWith('director.')) continue
				if (state.options[opt.key] === undefined || state.options[opt.key] === null) {
					state.options[opt.key] = opt.value ?? opt.fallback ?? null
				}
			}
		} catch (err) {
			console.error(err)
			actions.addAlert('Failed to load director settings', 'error')
		}
	},
	methods: {
		isOn(key, fallback) {
			const v = state.options[key]
			if (v === undefined || v === null || v === '') return fallback
			return v === true || v === 'true' || v === 1 || v === '1'
		},
		numOption(key, fallback) {
			const v = Number(state.options[key])
			return Number.isFinite(v) && v > 0 ? v : fallback
		},
		strOption(key, fallback) {
			const v = state.options[key]
			return v === undefined || v === null ? fallback : String(v)
		},
		setOption(key, value) {
			state.options[key] = value
			actions.broadcast(key, value) // live to HUD + director over WS
			actions.save({ [key]: value }) // persisted to userspace theme.json
		},
	},
}
</script>

<style scoped>
.text-input {
	width: 100%;
	max-width: 420px;
	padding: 0.45rem 0.6rem;
	border-radius: 6px;
	border: 1px solid rgba(255, 255, 255, 0.16);
	background: rgba(0, 0, 0, 0.25);
	color: inherit;
	font: inherit;
}
.text-input.--short { max-width: 90px; }
.director-page {
	display: flex;
	flex-direction: column;
	gap: 20px;
	max-width: 1280px;
}

.panel {
	background: #161b22;
	border: 1px solid #30363d;
	border-radius: 8px;
	padding: 20px;
}

.panel-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16px;
	margin-bottom: 18px;
}

.panel-header h2 {
	margin: 0 0 6px;
	color: #fff;
	font-size: 1.1rem;
}

.panel-header p {
	margin: 0;
	color: #8b949e;
	line-height: 1.45;
}

/* master arm hero */
.arm-panel {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24px;
	border-color: #30363d;
	transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.arm-panel.--armed {
	border-color: #2ea04366;
	box-shadow: 0 0 24px #2ea04322;
}

.arm-copy h2 {
	margin: 0 0 6px;
	color: #fff;
	font-size: 1.25rem;
}

.arm-copy p {
	margin: 0;
	color: #8b949e;
	line-height: 1.5;
	max-width: 62ch;
}

.arm-switch {
	display: flex;
	align-items: center;
	gap: 14px;
	flex-shrink: 0;
}

.arm-state {
	font-weight: 700;
	letter-spacing: 0.12em;
	font-size: 0.85rem;
	color: #8b949e;
}

.arm-panel.--armed .arm-state {
	color: #3fb950;
}

/* module grids */
.settings-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
	gap: 12px;
	transition: opacity 0.25s ease;
}

.settings-grid.--dimmed {
	opacity: 0.45;
	pointer-events: none;
}

.setting-card {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 10px;
	min-height: 74px;
	padding: 14px;
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 8px;
}

.setting-card.--switch {
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
}

.setting-card strong {
	display: block;
	color: #e6edf3;
	margin-bottom: 4px;
}

.setting-card small {
	color: #8b949e;
	line-height: 1.4;
}

.input-with-unit {
	display: flex;
	align-items: center;
	gap: 8px;
}

.input-with-unit input {
	width: 90px;
	padding: 7px 10px;
	background: #161b22;
	border: 1px solid #30363d;
	border-radius: 6px;
	color: #e6edf3;
}

.input-with-unit span {
	color: #8b949e;
	font-size: 0.85rem;
}

/* switches (mirrors the OptionsEditor look) */
.switch {
	position: relative;
	display: inline-block;
	width: 44px;
	height: 24px;
	flex-shrink: 0;
}

.switch.--big {
	width: 58px;
	height: 30px;
}

.switch input {
	opacity: 0;
	width: 0;
	height: 0;
}

.slider {
	position: absolute;
	inset: 0;
	background: #30363d;
	border-radius: 24px;
	cursor: pointer;
	transition: background 0.2s ease;
}

.slider::before {
	content: '';
	position: absolute;
	left: 3px;
	top: 3px;
	width: 18px;
	height: 18px;
	background: #8b949e;
	border-radius: 50%;
	transition: transform 0.2s ease, background 0.2s ease;
}

.switch.--big .slider::before {
	width: 24px;
	height: 24px;
}

.switch input:checked + .slider {
	background: #1f6feb55;
}

.switch input:checked + .slider::before {
	transform: translateX(20px);
	background: #58a6ff;
}

.switch.--big input:checked + .slider {
	background: #2ea04355;
}

.switch.--big input:checked + .slider::before {
	transform: translateX(28px);
	background: #3fb950;
}

.footnote {
	color: #6e7681;
	font-size: 0.85rem;
	margin: 0;
	padding: 0 4px;
}
</style>
