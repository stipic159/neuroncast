<template>
	<section class="team-diagnostics">
		<div class="toolbar">
			<div>
				<h2>{{ $t("Team Identity Diagnostics") }}</h2>
				<p>{{ $t("Resolved CT/T names and logos from overrides, GG Arena, match session, GSI, local logos, and fallback.") }}</p>
			</div>
			<button class="btn-secondary" @click="load" :disabled="loading">{{ $text(loading ? 'Refreshing...' : 'Refresh') }}</button>
		</div>

		<div v-if="error" class="notice --error">{{ $text(error) }}</div>

		<div v-if="diagnostics?.warnings?.length" class="notice --warning">
			<strong>{{ $t("Warnings") }}</strong>
			<ul>
				<li v-for="warning in diagnostics.warnings" :key="warning">{{ $text(warning) }}</li>
			</ul>
		</div>

		<div class="team-grid" v-if="diagnostics">
			<article v-for="side in sides" :key="side" class="team-card">
				<header>
					<span class="side">{{ side }}</span>
					<div>
						<h3>{{ team(side).final.name }}</h3>
						<p>{{ team(side).final.nameSource }} {{ $t("name /") }} {{ team(side).final.logoSource || $t('no') }} {{ $t("logo /") }} {{ $text(team(side).final.confidence) }} {{ $t("confidence") }}</p>
					</div>
					<img v-if="team(side).final.logo" :src="team(side).final.logo" alt="" class="logo">
				</header>

				<div v-if="team(side).final.warnings.length" class="team-warnings">
					<div v-for="warning in team(side).final.warnings" :key="warning">{{ $text(warning) }}</div>
				</div>

				<section class="candidate-section">
					<h4>{{ $t("Name Candidates") }}</h4>
					<div v-for="candidate in team(side).candidates.name" :key="`name-${candidate.source}`" class="candidate" :class="{ '--chosen': candidate.source === team(side).final.nameSource, '--invalid': !candidate.valid }">
						<span class="source">{{ candidate.source }}</span>
						<span class="value">{{ candidate.value || $t('none') }}</span>
						<span class="reason">{{ $text(candidate.reason) }}</span>
					</div>
				</section>

				<section class="candidate-section">
					<h4>{{ $t("Logo Candidates") }}</h4>
					<div v-for="candidate in team(side).candidates.logo" :key="`logo-${candidate.source}`" class="candidate" :class="{ '--chosen': candidate.source === team(side).final.logoSource, '--invalid': !candidate.valid }">
						<span class="source">{{ candidate.source }}</span>
						<span class="value">{{ candidate.value || $t('none') }}</span>
						<span class="reason">{{ $text(candidate.reason) }}</span>
					</div>
				</section>
			</article>
		</div>
	</section>
</template>

<script>
export default {
	data() {
		return {
			diagnostics: null,
			loading: false,
			error: '',
			sides: ['CT', 'T'],
		}
	},
	mounted() {
		this.load()
	},
	methods: {
		team(side) {
			return this.diagnostics?.teams?.[side]
		},
		async load() {
			this.loading = true
			this.error = ''
			try {
				const res = await fetch('/api/diagnostics/team-identity')
				if (!res.ok) throw new Error(`HTTP ${res.status}`)
				this.diagnostics = await res.json()
			} catch (err) {
				this.error = `Failed to load team identity diagnostics: ${err.message}`
			} finally {
				this.loading = false
			}
		},
	},
}
</script>

<style scoped>
.team-diagnostics {
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
}

h2, h3, h4, p {
	margin: 0;
}

.toolbar p,
header p,
.reason {
	color: #8b949e;
}

.notice {
	padding: 14px 16px;
	border-radius: 6px;
	border: 1px solid #30363d;
	background: #161b22;
}

.notice.--warning {
	border-color: #8a6d1f;
	color: #f1c40f;
}

.notice.--error {
	border-color: #7f2a2a;
	color: #ff8a8a;
}

.notice ul {
	margin: 8px 0 0;
	padding-left: 18px;
}

.team-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 20px;
}

.team-card {
	background: #1a1d23;
	border: 1px solid #2d333b;
	border-radius: 8px;
	padding: 18px;
	display: flex;
	flex-direction: column;
	gap: 16px;
}

header {
	display: grid;
	grid-template-columns: auto minmax(0, 1fr) auto;
	align-items: center;
	gap: 12px;
}

.side {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 42px;
	height: 42px;
	border-radius: 6px;
	background: #21262d;
	font-weight: 800;
}

.logo {
	width: 42px;
	height: 42px;
	object-fit: contain;
}

.team-warnings {
	display: flex;
	flex-direction: column;
	gap: 6px;
	color: #f1c40f;
	font-size: 0.9rem;
}

.candidate-section {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.candidate {
	display: grid;
	grid-template-columns: 132px minmax(0, 1fr);
	gap: 4px 12px;
	padding: 10px;
	border: 1px solid #30363d;
	border-radius: 6px;
	background: #121418;
}

.candidate.--chosen {
	border-color: #2ecc71;
}

.candidate.--invalid {
	opacity: 0.68;
}

.source {
	color: #c9d1d9;
	font-weight: 700;
}

.value {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.reason {
	grid-column: 1 / -1;
	font-size: 0.86rem;
}

.btn-secondary {
	background: #21262d;
	border: 1px solid #30363d;
	color: #c9d1d9;
	padding: 8px 16px;
	border-radius: 6px;
	font-weight: 600;
	cursor: pointer;
}

.btn-secondary:disabled {
	opacity: 0.6;
	cursor: wait;
}

@media (max-width: 1100px) {
	.team-grid {
		grid-template-columns: 1fr;
	}
}
</style>
