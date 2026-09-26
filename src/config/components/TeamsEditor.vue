<template>
	<div class="teams-editor">
		<section class="panel">
			<header class="panel-header">
				<h2>{{ $t("Roster Names") }}</h2>
				<p>{{ $t("Use these only when the team names from CS2 need to be forced for the broadcast overlay.") }}</p>
			</header>

			<div class="force-grid">
				<label>
					<span>{{ $t("Left roster team name") }}</span>
					<input v-model="state.options['teams.leftTeamName']" type="text" :placeholder="$t('Use GSI team name')">
				</label>
				<label>
					<span>{{ $t("Right roster team name") }}</span>
					<input v-model="state.options['teams.rightTeamName']" type="text" :placeholder="$t('Use GSI team name')">
				</label>
				<button class="btn-primary" @click="saveForcedNames">{{ $t("Save team names") }}</button>
			</div>
		</section>

		<OverridePanel
			:title="$t('Team Name Overrides')"
			:description="$t('Replace a team name when at least one listed SteamID64 is on that roster.')"
			value-key="teams.teamNameOverrides"
			type="team"
			:rows="rows['teams.teamNameOverrides']"
			:draft="drafts['teams.teamNameOverrides']"
			@add="addRow('teams.teamNameOverrides')"
			@remove="removeRow('teams.teamNameOverrides', $event)"
			@save="saveRows('teams.teamNameOverrides')"
		/>

		<OverridePanel
			:title="$t('Player Name Overrides')"
			:description="$t('Replace the name shown for an individual player.')"
			value-key="teams.playerNameOverrides"
			type="player"
			:value-placeholder="$t('Display name')"
			:rows="rows['teams.playerNameOverrides']"
			:draft="drafts['teams.playerNameOverrides']"
			@add="addRow('teams.playerNameOverrides')"
			@remove="removeRow('teams.playerNameOverrides', $event)"
			@save="saveRows('teams.playerNameOverrides')"
		/>

		<OverridePanel
			:title="$t('Player Subtitles')"
			:description="$t('Show a short line under a player name, such as a real name or role.')"
			value-key="teams.playerSubtitleOverrides"
			type="player"
			:value-placeholder="$t('Subtitle, real name, or role')"
			:rows="rows['teams.playerSubtitleOverrides']"
			:draft="drafts['teams.playerSubtitleOverrides']"
			@add="addRow('teams.playerSubtitleOverrides')"
			@remove="removeRow('teams.playerSubtitleOverrides', $event)"
			@save="saveRows('teams.playerSubtitleOverrides')"
		/>

		<OverridePanel
			:title="$t('Hidden Players')"
			:description="$t('Hide coaches, observers, or unwanted entries by exact player name or SteamID64.')"
			value-key="teams.hiddenPlayers"
			type="hidden"
			:rows="rows['teams.hiddenPlayers']"
			:draft="drafts['teams.hiddenPlayers']"
			@add="addRow('teams.hiddenPlayers')"
			@remove="removeRow('teams.hiddenPlayers', $event)"
			@save="saveRows('teams.hiddenPlayers')"
		/>
	</div>
</template>

<script>
import { state, actions } from '/config/store.js'

const keys = [
	'teams.teamNameOverrides',
	'teams.playerNameOverrides',
	'teams.playerSubtitleOverrides',
	'teams.hiddenPlayers',
]

const splitSteamIds = (value) => String(value || '')
	.split(/[\s,]+/)
	.map((steamId) => steamId.trim())
	.filter(Boolean)

const isSteamId64 = (value) => /^7656\d+$/.test(String(value || '').trim())

const OverridePanel = {
	props: ['title', 'description', 'valueKey', 'type', 'rows', 'draft', 'valuePlaceholder'],
	emits: ['add', 'remove', 'save'],
	setup() {
		return { state }
	},
	template: `
		<section class="panel">
			<header class="panel-header">
				<h2>{{ title }}</h2>
				<p>{{ description }}</p>
			</header>

			<div v-if="rows.length" class="override-list">
				<div v-for="(row, index) in rows" :key="index" class="override-row">
					<template v-if="type === 'team'">
						<input v-model="row.steamIds" type="text" :placeholder="$t('SteamID64 values, separated by spaces or commas')">
						<input v-model="row.name" type="text" :placeholder="$t('Team name')">
					</template>
					<template v-else-if="type === 'hidden'">
						<input class="wide" v-model="row.value" type="text" :placeholder="$t('Exact player name or SteamID64')">
					</template>
					<template v-else>
						<input v-model="row.steamId" type="text" placeholder="SteamID64">
						<input v-model="row.value" type="text" :placeholder="valuePlaceholder">
					</template>
					<button class="btn-remove" @click="$emit('remove', index)">{{ $t("Remove") }}</button>
				</div>
			</div>

			<div v-else class="empty-state">{{ $t("No entries configured.") }}</div>

			<div class="override-row --draft">
				<template v-if="type === 'team'">
					<input v-model="draft.steamIds" type="text" :placeholder="$t('SteamID64 values')">
					<input v-model="draft.name" type="text" :placeholder="$t('Team name')">
				</template>
				<template v-else-if="type === 'hidden'">
					<input class="wide" v-model="draft.value" type="text" :placeholder="$t('Exact player name or SteamID64')">
				</template>
				<template v-else>
					<input v-model="draft.steamId" type="text" placeholder="SteamID64">
					<input v-model="draft.value" type="text" :placeholder="valuePlaceholder">
				</template>
				<button class="btn-add" @click="$emit('add')">{{ $t("Add") }}</button>
			</div>

			<div class="panel-actions">
				<button class="btn-secondary" @click="$emit('save')">{{ $t("Apply list changes") }}</button>
				<details>
					<summary>{{ $t("Saved text format") }}</summary>
					<pre>{{ state.options[valueKey] || $t('(empty)') }}</pre>
				</details>
			</div>
		</section>
	`,
}

export default {
	components: { OverridePanel },
	setup() {
		return { state, actions }
	},
	data() {
		return {
			rows: Object.fromEntries(keys.map((key) => [key, []])),
			drafts: Object.fromEntries(keys.map((key) => [key, this.emptyDraft(key)])),
		}
	},
	mounted() {
		this.loadRows()
	},
	methods: {
		emptyDraft(key) {
			if (key === 'teams.teamNameOverrides') return { steamIds: '', name: '' }
			if (key === 'teams.hiddenPlayers') return { value: '' }
			return { steamId: '', value: '' }
		},
		loadRows() {
			for (const key of keys) {
				this.rows[key] = this.parseRows(key, state.options[key])
			}
		},
		parseRows(key, value) {
			const lines = String(value || '').split('\n').map((line) => line.trim()).filter(Boolean)

			if (key === 'teams.teamNameOverrides') {
				return lines.map((line) => {
					const segments = line.split(/\s+/)
					const steamIds = []
					const nameParts = []
					for (const segment of segments) {
						if (isSteamId64(segment)) steamIds.push(segment)
						else nameParts.push(segment)
					}
					return { steamIds: steamIds.join(', '), name: nameParts.join(' ') }
				}).filter((row) => row.steamIds || row.name)
			}

			if (key === 'teams.hiddenPlayers') {
				return lines.map((line) => ({ value: line }))
			}

			return lines.map((line) => {
				const [steamId, ...valueParts] = line.split(/\s+/)
				return { steamId: steamId || '', value: valueParts.join(' ') }
			}).filter((row) => row.steamId || row.value)
		},
		serializeRows(key) {
			if (key === 'teams.teamNameOverrides') {
				return this.rows[key].map((row) => {
					const steamIds = splitSteamIds(row.steamIds).filter(isSteamId64)
					const name = String(row.name || '').trim()
					if (!steamIds.length || !name) return ''
					return [...steamIds, name].join(' ')
				}).filter(Boolean).join('\n')
			}

			if (key === 'teams.hiddenPlayers') {
				return this.rows[key].map((row) => String(row.value || '').trim()).filter(Boolean).join('\n')
			}

			return this.rows[key].map((row) => {
				const steamId = String(row.steamId || '').trim()
				const value = String(row.value || '').trim()
				if (!isSteamId64(steamId) || !value) return ''
				return `${steamId} ${value}`
			}).filter(Boolean).join('\n')
		},
		addRow(key) {
			const draft = this.drafts[key]

			if (key === 'teams.teamNameOverrides') {
				const steamIds = splitSteamIds(draft.steamIds)
				if (!steamIds.length || steamIds.some((steamId) => !isSteamId64(steamId)) || !draft.name.trim()) {
					actions.addAlert('Add at least one valid SteamID64 and a team name.', 'warning')
					return
				}
				this.rows[key].push({ steamIds: steamIds.join(', '), name: draft.name.trim() })
			} else if (key === 'teams.hiddenPlayers') {
				if (!draft.value.trim()) {
					actions.addAlert('Enter a player name or SteamID64 to hide.', 'warning')
					return
				}
				this.rows[key].push({ value: draft.value.trim() })
			} else {
				if (!isSteamId64(draft.steamId) || !draft.value.trim()) {
					actions.addAlert('Add a valid SteamID64 and value.', 'warning')
					return
				}
				this.rows[key].push({ steamId: draft.steamId.trim(), value: draft.value.trim() })
			}

			this.drafts[key] = this.emptyDraft(key)
			this.saveRows(key)
		},
		removeRow(key, index) {
			this.rows[key].splice(index, 1)
			this.saveRows(key)
		},
		saveRows(key) {
			const value = this.serializeRows(key)
			state.options[key] = value
			actions.broadcast(key, value)
			actions.save({ [key]: value })
		},
		saveForcedNames() {
			const partial = {
				'teams.leftTeamName': state.options['teams.leftTeamName'] || null,
				'teams.rightTeamName': state.options['teams.rightTeamName'] || null,
			}
			actions.broadcast('teams.leftTeamName', partial['teams.leftTeamName'])
			actions.broadcast('teams.rightTeamName', partial['teams.rightTeamName'])
			actions.save(partial)
		},
	},
}
</script>

<style scoped>
.teams-editor {
	display: flex;
	flex-direction: column;
	gap: 20px;
	max-width: 1180px;
}

.panel {
	background: #161b22;
	border: 1px solid #30363d;
	border-radius: 8px;
	padding: 20px;
}

.panel-header {
	margin-bottom: 18px;
}

.panel-header h2 {
	margin: 0 0 6px;
	font-size: 1.1rem;
	color: #fff;
}

.panel-header p {
	margin: 0;
	color: #8b949e;
	line-height: 1.4;
}

.force-grid {
	display: grid;
	grid-template-columns: 1fr 1fr auto;
	gap: 12px;
	align-items: end;
}

label span {
	display: block;
	margin-bottom: 6px;
	color: #adbac7;
	font-size: 0.85rem;
	font-weight: 600;
}

:deep(input) {
	width: 100%;
	box-sizing: border-box;
	padding: 8px 12px;
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 6px;
	color: #c9d1d9;
	font: inherit;
	line-height: normal;
}

:deep(.override-list) {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-bottom: 12px;
}

:deep(.override-row) {
	display: grid;
	grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr) auto;
	gap: 8px;
	align-items: center;
}

:deep(.override-row .wide) {
	grid-column: span 2;
}

:deep(.override-row.--draft) {
	padding-top: 12px;
	border-top: 1px solid #30363d;
}

:deep(.empty-state) {
	padding: 14px;
	margin-bottom: 12px;
	border: 1px dashed #30363d;
	border-radius: 6px;
	color: #8b949e;
	background: #0d1117;
}

.panel-actions {
	display: flex;
	align-items: center;
	gap: 16px;
	margin-top: 14px;
}

.btn-primary,
:deep(.btn-secondary),
:deep(.btn-add),
:deep(.btn-remove) {
	border: 1px solid #30363d;
	border-radius: 6px;
	padding: 8px 12px;
	color: #fff;
	font: inherit;
	cursor: pointer;
	white-space: nowrap;
}

.btn-primary,
:deep(.btn-add) {
	background: #1f6feb;
	border-color: #1f6feb;
}

:deep(.btn-secondary) {
	background: #21262d;
}

:deep(.btn-remove) {
	background: #2d1f23;
	border-color: #5a2933;
	color: #ffb3bd;
}

:deep(details) {
	color: #8b949e;
	font-size: 0.85rem;
}

:deep(summary) {
	cursor: pointer;
}

:deep(pre) {
	white-space: pre-wrap;
	margin: 8px 0 0;
	padding: 12px;
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 6px;
	color: #adbac7;
}
</style>
