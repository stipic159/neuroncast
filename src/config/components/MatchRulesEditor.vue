<template>
	<div class="setup-page">
		<section class="panel">
			<header class="panel-header">
				<h2>{{ $t("Match Rules") }}</h2>
				<p>{{ $t("Use presets for normal broadcasts. Switch to custom only when the server rules differ.") }}</p>
			</header>

			<div class="segmented">
				<button v-for="preset in presets" :key="preset.id" :class="{ '--active': selectedPreset === preset.id }" @click="applyPreset(preset.id)">
					{{ $text(preset.label) }}
				</button>
			</div>
		</section>

		<section class="panel">
			<header class="panel-header">
				<h2>{{ $t("Round Timing and Economy") }}</h2>
				<p>{{ $t("These values affect clocks, round graphs, timeout panels, and team equipment estimates.") }}</p>
			</header>

			<div class="rules-grid">
				<label v-for="field in fields" :key="field.key">
					<span>{{ $text(field.label) }}</span>
					<input v-model.number="state.options[field.key]" type="number" :step="field.step || 1" min="0">
				</label>
			</div>

			<div class="actions">
				<button class="btn-primary" @click="saveRules">{{ $t("Save match rules") }}</button>
			</div>
		</section>
	</div>
</template>

<script>
import { state, actions } from '/config/store.js'

const presetValues = {
	standard: {
		'cvars.mp_maxrounds': 24,
		'cvars.mp_roundtime': 1.92,
		'cvars.mp_overtime_maxrounds': 6,
		'cvars.mp_freezetime': 20,
	},
	wingman: {
		'cvars.mp_maxrounds': 16,
		'cvars.mp_roundtime': 1.5,
		'cvars.mp_overtime_maxrounds': 2,
		'cvars.mp_freezetime': 15,
	},
}

export default {
	setup() { return { state } },
	data() {
		return {
			selectedPreset: state.options['match.mode'] || 'standard',
			presets: [
				{ id: 'standard', label: 'Standard CS2' },
				{ id: 'wingman', label: 'Wingman' },
				{ id: 'custom', label: 'Custom' },
			],
			fields: [
				{ key: 'cvars.mp_maxrounds', label: 'Regulation rounds' },
				{ key: 'cvars.mp_overtime_maxrounds', label: 'Overtime rounds' },
				{ key: 'cvars.mp_roundtime', label: 'Round time in minutes', step: 0.01 },
				{ key: 'cvars.mp_freezetime', label: 'Freezetime seconds' },
				{ key: 'cvars.mp_c4timer', label: 'Bomb timer seconds' },
				{ key: 'cvars.mp_team_timeout_max', label: 'Timeouts per team' },
				{ key: 'cvars.mp_team_timeout_time', label: 'Timeout seconds' },
				{ key: 'cvars.cash_team_loser_bonus', label: 'Initial loss bonus' },
				{ key: 'cvars.cash_team_loser_bonus_consecutive_rounds', label: 'Loss bonus step' },
			],
		}
	},
	methods: {
		applyPreset(id) {
			this.selectedPreset = id
			state.options['match.mode'] = id
			if (presetValues[id]) {
				Object.assign(state.options, presetValues[id])
			}
			this.saveRules()
		},
		saveRules() {
			const partial = { 'match.mode': this.selectedPreset }
			for (const field of this.fields) {
				partial[field.key] = state.options[field.key]
				actions.broadcast(field.key, partial[field.key])
			}
			actions.broadcast('match.mode', this.selectedPreset)
			actions.save(partial)
		},
	},
}
</script>

<style scoped>
.setup-page { display: flex; flex-direction: column; gap: 20px; max-width: 1180px; }
.panel { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; }
.panel-header { margin-bottom: 16px; }
.panel-header h2 { margin: 0 0 6px; font-size: 1.1rem; color: #fff; }
.panel-header p { margin: 0; color: #8b949e; line-height: 1.4; }
.segmented { display: flex; gap: 8px; }
.segmented button, .btn-primary { border: 1px solid #30363d; border-radius: 6px; padding: 8px 12px; color: #fff; background: #21262d; cursor: pointer; font: inherit; }
.segmented button.--active, .btn-primary { background: #1f6feb; border-color: #1f6feb; }
.rules-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
label span { display: block; margin-bottom: 6px; color: #adbac7; font-size: 0.85rem; font-weight: 600; }
input { width: 100%; box-sizing: border-box; padding: 8px 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #c9d1d9; font: inherit; }
.actions { margin-top: 18px; }
</style>
