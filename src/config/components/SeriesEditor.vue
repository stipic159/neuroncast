<template>
	<div class="setup-page">
		<section class="panel">
			<header class="panel-header">
				<h2>{{ $t("Series Format") }}</h2>
				<p>{{ $t("Choose the match length, then fill in only the maps that belong to this series.") }}</p>
			</header>

			<div class="segmented">
				<button v-for="format in formats" :key="format.maps" :class="{ '--active': seriesLength === format.maps }" @click="setSeriesLength(format.maps)">
					{{ $text(format.label) }}
				</button>
			</div>
		</section>

		<section class="map-grid">
			<div v-for="mapNumber in activeMapNumbers" :key="mapNumber" class="panel map-card">
				<header class="map-header">
					<h2>{{ $t("Map") }} {{ mapNumber }}</h2>
					<label class="checkbox-line">
						<input v-model="state.options[`series.maps.${mapNumber}.isDecider`]" type="checkbox">
						<span>{{ $t("Decider") }}</span>
					</label>
				</header>

				<label>
					<span>{{ $t("Map name") }}</span>
					<input v-model="state.options[`series.maps.${mapNumber}.name`]" type="text" placeholder="de_mirage">
				</label>

				<label>
					<span>{{ $t("Picked by") }}</span>
					<input v-model="state.options[`series.maps.${mapNumber}.pickTeam`]" type="text" :placeholder="$t('Team name')">
				</label>

				<div class="score-grid">
					<label>
						<span>{{ $t("Picked team score") }}</span>
						<input v-model.number="state.options[`series.maps.${mapNumber}.pickTeamScore`]" type="number" min="0">
					</label>
					<label>
						<span>{{ $t("Other team score") }}</span>
						<input v-model.number="state.options[`series.maps.${mapNumber}.enemyTeamScore`]" type="number" min="0">
					</label>
				</div>
			</div>
		</section>

		<div class="actions">
			<button class="btn-primary" @click="saveSeries">{{ $t("Save series setup") }}</button>
			<button class="btn-secondary" @click="clearInactiveMaps">{{ $t("Clear inactive map slots") }}</button>
		</div>
	</div>
</template>

<script>
import { state, actions } from '/config/store.js'

const maxMaps = 5

export default {
	setup() {
		return { state }
	},
	data() {
		return {
			formats: [
				{ maps: 1, label: 'Best of 1' },
				{ maps: 3, label: 'Best of 3' },
				{ maps: 5, label: 'Best of 5' },
			],
			seriesLength: 1,
		}
	},
	computed: {
		activeMapNumbers() {
			return Array.from({ length: this.seriesLength }, (_, index) => index + 1)
		},
	},
	mounted() {
		this.seriesLength = this.detectSeriesLength()
		this.applyDefaultDecider()
	},
	methods: {
		detectSeriesLength() {
			let highest = 1
			for (let mapNumber = 1; mapNumber <= maxMaps; mapNumber++) {
				const prefix = `series.maps.${mapNumber}`
				if (
					state.options[`${prefix}.name`]
					|| state.options[`${prefix}.pickTeam`]
					|| state.options[`${prefix}.pickTeamScore`] != null
					|| state.options[`${prefix}.enemyTeamScore`] != null
					|| state.options[`${prefix}.isDecider`]
				) highest = mapNumber
			}
			if (highest <= 1) return 1
			if (highest <= 3) return 3
			return 5
		},
		setSeriesLength(length) {
			this.seriesLength = length
			this.applyDefaultDecider()
		},
		applyDefaultDecider() {
			for (let mapNumber = 1; mapNumber <= this.seriesLength; mapNumber++) {
				state.options[`series.maps.${mapNumber}.isDecider`] = mapNumber === this.seriesLength && this.seriesLength > 1
			}
		},
		saveSeries() {
			const partial = {}
			for (let mapNumber = 1; mapNumber <= maxMaps; mapNumber++) {
				const active = mapNumber <= this.seriesLength
				for (const field of ['name', 'pickTeam', 'isDecider', 'pickTeamScore', 'enemyTeamScore']) {
					const key = `series.maps.${mapNumber}.${field}`
					partial[key] = active ? (state.options[key] ?? null) : null
					actions.broadcast(key, partial[key])
				}
			}
			actions.save(partial)
		},
		clearInactiveMaps() {
			for (let mapNumber = this.seriesLength + 1; mapNumber <= maxMaps; mapNumber++) {
				for (const field of ['name', 'pickTeam', 'isDecider', 'pickTeamScore', 'enemyTeamScore']) {
					state.options[`series.maps.${mapNumber}.${field}`] = null
				}
			}
			this.saveSeries()
		},
	},
}
</script>

<style scoped>
.setup-page { display: flex; flex-direction: column; gap: 20px; max-width: 1180px; }
.panel { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; }
.panel-header { margin-bottom: 16px; }
.panel-header h2, .map-header h2 { margin: 0 0 6px; font-size: 1.1rem; color: #fff; }
.panel-header p { margin: 0; color: #8b949e; line-height: 1.4; }
.segmented { display: flex; gap: 8px; }
.segmented button, .btn-primary, .btn-secondary { border: 1px solid #30363d; border-radius: 6px; padding: 8px 12px; color: #fff; background: #21262d; cursor: pointer; font: inherit; }
.segmented button.--active, .btn-primary { background: #1f6feb; border-color: #1f6feb; }
.map-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
.map-card { display: flex; flex-direction: column; gap: 14px; }
.map-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
label span { display: block; margin-bottom: 6px; color: #adbac7; font-size: 0.85rem; font-weight: 600; }
input[type="text"], input[type="number"] { width: 100%; box-sizing: border-box; padding: 8px 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #c9d1d9; font: inherit; }
.checkbox-line { display: flex; align-items: center; gap: 8px; color: #adbac7; }
.checkbox-line span { margin: 0; }
.score-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.actions { display: flex; gap: 12px; }
</style>
