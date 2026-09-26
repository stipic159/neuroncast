<template>
	<aside class="eon-sidebar">
		<nav class="eon-nav">
			<div v-for="group in groups" :key="group.id" class="eon-nav-group">
				<div class="eon-nav-group-label">{{ $t(group.labelKey) }}</div>
				<button
					v-for="item in group.items"
					:key="item.id"
					:class="['eon-nav-item', { '--active': state.activeCategory === item.id }]"
					@click="select(item.id)"
				>
					<span class="eon-nav-icon">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path v-for="(d, i) in iconPath(item.icon)" :key="i" :d="d" />
						</svg>
					</span>
					<span class="eon-nav-label">{{ $t(item.labelKey) }}</span>
				</button>
			</div>
		</nav>

		<div class="eon-sidebar-footer">
			<Chip :tone="sceneTone" :pulse="scenePulse">{{ $text(sceneLabel) }}</Chip>
			<div class="eon-sidebar-footer-sub">{{ themeLabel }}</div>
		</div>
	</aside>
</template>

<script>
import { state } from '/config/store.js'
import { NAV_GROUPS, ICON_PATHS } from '/config/nav-config.js'
import Chip from '/config/components/atoms/Chip.vue'
import { useReadiness } from '/config/composables/useReadiness.js'

const SCENE_META = {
	'default':   { label: 'LIVE HUD',          tone: 'grn', pulse: true  },
	'radar':     { label: 'FULL RADAR',        tone: 'blu', pulse: false },
	'intro':     { label: 'KL MATCH OVERVIEW', tone: 'amb', pulse: false },
	'halftime':  { label: 'KL WAITING',        tone: 'amb', pulse: false },
	'fulltime':  { label: 'KL RESULT',         tone: 'amb', pulse: false },
	'analytics': { label: 'KL TABLE / FORM',   tone: 'amb', pulse: false },
}

export default {
	components: { Chip },
	setup() {
		return { state, readiness: useReadiness() }
	},
	data() {
		return { groups: NAV_GROUPS }
	},
	computed: {
		activeScene() {
			return this.state.options?.['match.activeScene'] || 'default'
		},
		sceneMeta() {
			return SCENE_META[this.activeScene] || { label: String(this.activeScene || 'NO SCENE').toUpperCase(), tone: 'neutral', pulse: false }
		},
		sceneLabel() { return this.sceneMeta.label },
		sceneTone()  { return this.sceneMeta.tone },
		scenePulse() { return this.sceneMeta.pulse },
		themeLabel() {
			const theme = this.state.theme || 'default'
			const preset = this.state.options?.['css.ui-style']
			return preset ? `${theme} · ${preset}` : theme
		},
	},
	methods: {
		select(id) { this.state.activeCategory = id },
		iconPath(name) { return ICON_PATHS[name] || ICON_PATHS.options },
	},
}
</script>

<style scoped>
.eon-sidebar {
	grid-column: 1;
	grid-row: 3;
	background: var(--eon-s1);
	border-right: 1px solid var(--eon-bd);
	display: flex;
	flex-direction: column;
	overflow-y: auto;
	min-width: 0;
}

.eon-sidebar::-webkit-scrollbar { width: 4px; }
.eon-sidebar::-webkit-scrollbar-thumb { background: var(--eon-bd); }

.eon-nav {
	flex: 1;
	padding-bottom: 16px;
}

.eon-nav-group + .eon-nav-group {
	margin-top: 6px;
}

.eon-nav-group-label {
	padding: 13px 14px 4px;
	font-family: var(--eon-font-primary);
	font-size: var(--eon-fs-micro);
	font-weight: 700;
	letter-spacing: 1.6px;
	text-transform: uppercase;
	color: var(--eon-tx3);
}

.eon-nav-item {
	display: flex;
	align-items: center;
	gap: 9px;
	width: 100%;
	padding: 7px 14px;
	border: none;
	background: transparent;
	color: var(--eon-tx2);
	font-family: var(--eon-font-primary);
	font-size: var(--eon-fs-body2);
	font-weight: 500;
	cursor: pointer;
	text-align: left;
	border-left: 2px solid transparent;
	transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.eon-nav-item:hover {
	color: var(--eon-tx);
	background: rgba(255, 255, 255, 0.025);
}
.eon-nav-item.--active {
	color: var(--eon-accl);
	background: var(--eon-accd);
	border-left-color: var(--eon-acc);
	font-weight: 600;
}

.eon-nav-icon {
	width: 16px;
	height: 16px;
	flex-shrink: 0;
	display: inline-flex;
	align-items: center;
	justify-content: center;
}
.eon-nav-icon svg {
	width: 16px;
	height: 16px;
}

.eon-nav-label {
	min-width: 0;
}

.eon-sidebar-footer {
	padding: 10px 14px 12px;
	border-top: 1px solid var(--eon-bd);
	background: #0d0d10;
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.eon-sidebar-footer-sub {
	font-family: var(--eon-font-mono);
	font-size: var(--eon-fs-micro);
	color: var(--eon-tx3);
	letter-spacing: 0.2px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
