<template>
	<div class="eon-status">
		<Chip :tone="sceneTone" :pulse="scenePulse">{{ $text(sceneLabel) }}</Chip>
		<span class="eon-sep"></span>

		<div class="eon-status-item">
			<span class="eon-status-dot" :style="{ background: `var(--eon-${gsiTone})` }"></span>
			<span class="eon-status-lbl">GSI</span>
			<span :class="['eon-status-val', `--${gsiTone}`]">{{ gsiText }}</span>
		</div>
		<span class="eon-sep"></span>

		<div class="eon-status-item">
			<span class="eon-status-lbl">{{ $t("PKG") }}</span>
			<span class="eon-status-val">{{ packageText }}</span>
		</div>
		<span class="eon-sep"></span>

		<div class="eon-status-item">
			<span class="eon-status-lbl">{{ $t("THEME") }}</span>
			<span class="eon-status-val">{{ themeText }}</span>
		</div>

		<div class="eon-status-right">
			<span v-if="saveState === 'saving'" class="eon-status-save --saving">{{ $t("Saving…") }}</span>
			<span v-else-if="saveState === 'error'" class="eon-status-save --error">{{ $t("Save failed") }}</span>
			<span v-else-if="lastSavedText" class="eon-status-save --saved">{{ $text(lastSavedText) }}</span>
		</div>
	</div>
</template>

<script>
import { state } from '/config/store.js'
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
		return { tick: 0 }
	},
	created() {
		this.tickTimer = setInterval(() => { this.tick++ }, 1000)
	},
	beforeUnmount() {
		clearInterval(this.tickTimer)
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

		summary() { return this.readiness?.summary || null },

		gsi() { return this.summary?.gsi || null },
		gsiConnected() { return !!this.gsi?.connected },
		cacheStale() { return !!this.summary?.cache?.stale },
		gsiTone() {
			if (!this.gsi) return 'tx3'
			if (!this.gsiConnected) return 'red'
			if (this.cacheStale) return 'amb'
			return 'grn'
		},
		gsiText() {
			if (!this.gsi) return this.$t('Loading…')
			if (!this.gsiConnected) return this.$t('Disconnected')
			const parts = [this.$t('Connected')]
			if (this.gsi.mapName) parts.push(this.gsi.mapName)
			if (this.gsi.phase) parts.push(this.$text(this.gsi.phase))
			return parts.join(' · ')
		},

		packageText() {
			const name = this.summary?.package?.name
			return name || this.$t('None active')
		},

		themeText() {
			const theme = this.state.theme || 'default'
			const preset = this.state.options?.['css.ui-style']
			return preset ? `${theme} · ${preset}` : theme
		},

		saveState() { return this.state.saveState },
		lastSavedText() {
			void this.tick
			const ts = this.state.lastSavedAt
			if (!ts) return ''
			const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000))
			if (secs < 5) return 'Saved just now'
			if (secs < 60) return `Saved ${secs}s ago`
			const mins = Math.floor(secs / 60)
			return `Saved ${mins}m ago`
		},
	},
}
</script>

<style scoped>
.eon-status {
	grid-column: 1 / -1;
	grid-row: 2;
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 0 18px;
	background: #0c0c10;
	border-bottom: 1px solid var(--eon-bd);
	height: 32px;
	font-family: var(--eon-font-mono);
	font-size: var(--eon-fs-notes);
	color: var(--eon-tx2);
	overflow: hidden;
}

.eon-status-item {
	display: flex;
	align-items: center;
	gap: 5px;
	white-space: nowrap;
}

.eon-status-dot {
	display: inline-block;
	width: 5px;
	height: 5px;
	border-radius: 50%;
	flex-shrink: 0;
}

.eon-status-lbl {
	font-size: var(--eon-fs-micro);
	text-transform: uppercase;
	letter-spacing: 0.8px;
	color: var(--eon-tx3);
}

.eon-status-val {
	color: var(--eon-tx2);
	margin-left: 2px;
}
.eon-status-val.--amb { color: var(--eon-amb); }
.eon-status-val.--red { color: var(--eon-red); }
.eon-status-val.--grn { color: var(--eon-tx2); }

.eon-status-right {
	margin-left: auto;
	display: flex;
	align-items: center;
	gap: 8px;
	white-space: nowrap;
}

.eon-status-save {
	font-size: var(--eon-fs-status);
}
.eon-status-save.--saved   { color: var(--eon-tx3); }
.eon-status-save.--saving  { color: var(--eon-amb); }
.eon-status-save.--error   { color: var(--eon-red); }
</style>
