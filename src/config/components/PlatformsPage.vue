<template>
	<div class="platforms-page">
		<!-- Hub Header Card -->
		<section class="panel header-panel">
			<div class="header-copy">
				<div class="header-title-row">
					<h2>{{ $t("Match Platforms Hub") }}</h2>
					<Chip tone="acc" :dot="false">{{ $t("Integrations") }}</Chip>
				</div>
				<p>
					{{ $t("Select external tournament or matchmaking providers to sync rosters, match metadata, and bracket statistics.") }}
				</p>
			</div>

			<!-- Platform Switcher Tabs -->
			<div class="segmented">
				<button
					:class="{ '--active': activePlatform === 'fastcup' }"
					@click="activePlatform = 'fastcup'"
				>
					Fastcup (CS2)
				</button>
				<button
					:class="{ '--active': activePlatform === 'komplettligaen' }"
					@click="activePlatform = 'komplettligaen'"
				>
					Komplettligaen
				</button>
				<button
					:class="{ '--active': activePlatform === 'manual' }"
					@click="activePlatform = 'manual'"
				>
					{{ $t("Manual / Standalone") }}
				</button>
			</div>
		</section>

		<!-- FASTCUP SECTION -->
		<section v-if="activePlatform === 'fastcup'" class="panel">
			<header class="panel-header">
				<div>
					<div class="section-title-row">
						<h2>Fastcup Match Sync</h2>
						<Chip tone="blu" :dot="false">{{ $t("Planned") }}</Chip>
					</div>
					<p>{{ $t("Connect to fastcup.net matches to pull team rosters, player avatars, and veto stages directly into HUD.") }}</p>
				</div>
			</header>

			<div class="platform-form">
				<div class="field-group">
					<label class="field-label">
						<span>Fastcup Match ID / URL</span>
						<input
							type="text"
							class="text-input"
							placeholder="e.g. 1048294 or https://fastcup.net/match/..."
							disabled
						>
					</label>
					<span class="field-hint">{{ $t("Fastcup integration is coming soon in an upcoming update.") }}</span>
				</div>

				<div class="actions">
					<button class="btn-primary" disabled>{{ $t("Save Match") }}</button>
					<button class="btn-secondary" disabled>{{ $t("Refresh Data") }}</button>
				</div>
			</div>
		</section>

		<!-- KOMPLETTLIGAEN SECTION -->
		<section v-if="activePlatform === 'komplettligaen'" class="panel">
			<header class="panel-header">
				<div>
					<div class="section-title-row">
						<h2>Komplettligaen / GG Arena</h2>
						<Chip tone="grn" :pulse="true">{{ $t("Active Provider") }}</Chip>
					</div>
					<p>{{ $t("Direct integration with Norwegian esports league match engine via GG Arena scrapers.") }}</p>
				</div>
			</header>

			<div class="platform-form">
				<div class="field-group">
					<label class="field-label">
						<span>{{ $t("GG Arena Match ID") }}</span>
						<input
							v-model="komplettligaen.matchId"
							type="text"
							class="text-input"
							placeholder="256437"
							:disabled="komplettligaenLoading"
						>
					</label>
					<span class="field-hint">{{ $t("Match ID from the GG Arena tournament page URL.") }}</span>
				</div>

				<div class="actions">
					<button
						class="btn-primary"
						:disabled="komplettligaenLoading"
						@click="saveKomplettligaen"
					>
						{{ komplettligaenLoading ? $t("Saving...") : $t("Save Match") }}
					</button>
					<button
						class="btn-secondary"
						:disabled="komplettligaenLoading"
						@click="refreshKomplettligaen"
					>
						{{ $t("Refresh Data") }}
					</button>
					<button
						class="btn-secondary"
						:disabled="komplettligaenLoading || !komplettligaen.matchId"
						@click="testKomplettligaen"
					>
						{{ $t("Test Connection") }}
					</button>
				</div>

				<div
					v-if="komplettligaenStatus"
					:class="['status-callout', { '--error': komplettligaenError }]"
				>
					<span class="status-indicator"></span>
					<span class="status-text">{{ $text(komplettligaenStatus) }}</span>
				</div>
			</div>

			<!-- Cache Diagnostics Card -->
			<div v-if="cacheStatus" class="cache-diagnostics-box">
				<div class="cache-header">
					<div class="cache-title-row">
						<h4>{{ $t("Cache Health") }}</h4>
						<Chip :tone="cacheStatus.exists ? 'grn' : 'red'">
							{{ $text(cacheStatus.exists ? 'Available' : 'Missing') }}
						</Chip>
					</div>
					<button
						class="btn-ghost"
						:disabled="komplettligaenLoading"
						@click="resetCache"
					>
						{{ $t("Reset Cache") }}
					</button>
				</div>

				<div class="cache-grid">
					<div class="cache-stat">
						<span class="stat-label">{{ $t("Local Cache:") }}</span>
						<strong class="stat-value" :class="cacheStatus.exists ? 'text-grn' : 'text-red'">
							{{ $text(cacheStatus.exists ? 'Available' : 'Missing') }}
						</strong>
					</div>

					<div v-if="cacheStatus.exists" class="cache-stat">
						<span class="stat-label">{{ $t("Last Updated:") }}</span>
						<strong class="stat-value text-mono">{{ formatTime(cacheStatus.savedAt) }}</strong>
					</div>

					<div v-if="cacheStatus.exists" class="cache-stat">
						<span class="stat-label">{{ $t("Source Endpoint:") }}</span>
						<strong class="stat-value text-mono">{{ cacheStatus.source }}</strong>
					</div>

					<div v-if="cacheStatus.exists" class="cache-stat">
						<span class="stat-label">{{ $t("Stale Status:") }}</span>
						<strong class="stat-value" :class="cacheStatus.stale ? 'text-amb' : 'text-grn'">
							{{ $text(cacheStatus.stale ? 'Stale (' + cacheStatus.ageMinutes + ' min)' : 'Fresh') }}
						</strong>
					</div>
				</div>

				<div v-if="cacheStatus.fetchFailureReason" class="failure-callout">
					<div class="failure-header">{{ $t("Last Failure Reason:") }}</div>
					<div class="failure-code">{{ $text(cacheStatus.fetchFailureReason) }}</div>
				</div>
			</div>
		</section>

		<!-- MANUAL / STANDALONE SECTION -->
		<section v-if="activePlatform === 'manual'" class="panel">
			<header class="panel-header">
				<div>
					<div class="section-title-row">
						<h2>{{ $t("Standalone Tournament Operation") }}</h2>
						<Chip tone="neutral" :dot="false">{{ $t("Manual Mode") }}</Chip>
					</div>
					<p>
						{{ $t("No external platform sync active. Team names, logos, rosters, and match format are configured manually in Setup > Teams & Players and Series & Maps.") }}
					</p>
				</div>
			</header>

			<div class="manual-features-grid">
				<div class="feature-card">
					<h4>{{ $t("Teams & Rosters") }}</h4>
					<p>{{ $t("Add custom team names, load custom SVG/PNG crests, and specify player SteamIDs directly.") }}</p>
				</div>
				<div class="feature-card">
					<h4>{{ $t("Series Formats") }}</h4>
					<p>{{ $t("Pick Best-of-1, Best-of-3, or Best-of-5 with full support for decider and veto maps.") }}</p>
				</div>
				<div class="feature-card">
					<h4>{{ $t("Zero Cloud Dependency") }}</h4>
					<p>{{ $t("Operates completely offline with 100% reliability for local LANs or custom studio setups.") }}</p>
				</div>
			</div>
		</section>
	</div>
</template>

<script>
import { text as translateText } from '/config/i18n.js'
import { state, actions } from '/config/store.js'
import Chip from '/config/components/atoms/Chip.vue'

export default {
	name: 'PlatformsPage',
	components: { Chip },
	setup() {
		return { state, actions }
	},
	data() {
		return {
			activePlatform: 'fastcup',
			komplettligaen: { matchId: '', activeView: 'match' },
			komplettligaenLoading: false,
			komplettligaenStatus: '',
			komplettligaenError: false,
			cacheStatus: null,
		}
	},
	async mounted() {
		await this.loadKomplettligaen()
		await this.loadCacheStatus()
	},
	methods: {
		formatTime(iso) {
			if (!iso) return translateText('Never')
			try {
				const d = new Date(iso)
				return isNaN(d.getTime()) ? translateText('Never') : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
			} catch (_) {
				return translateText('Never')
			}
		},
		async loadKomplettligaen() {
			try {
				const res = await fetch('/config/komplettligaen')
				this.komplettligaen = await res.json()
			} catch (err) {
				this.komplettligaenStatus = 'Could not load Komplettligaen config'
				this.komplettligaenError = true
			}
		},
		async saveKomplettligaen() {
			this.komplettligaenLoading = true
			this.komplettligaenError = false
			this.komplettligaenStatus = 'Saving...'
			try {
				const res = await fetch('/config/komplettligaen', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(this.komplettligaen),
				})
				this.komplettligaen = await res.json()
				this.komplettligaenStatus = 'Saved. HUD scenes will refresh.'
				await this.loadCacheStatus()
			} catch (err) {
				this.komplettligaenStatus = 'Save failed'
				this.komplettligaenError = true
			} finally {
				this.komplettligaenLoading = false
			}
		},
		async refreshKomplettligaen() {
			this.komplettligaenLoading = true
			this.komplettligaenError = false
			this.komplettligaenStatus = 'Refreshing cache...'
			try {
				await fetch('/config/komplettligaen/refresh', { method: 'POST' })
				this.komplettligaenStatus = 'Cache cleared. Re-fetching data...'
				await this.testKomplettligaen()
			} catch (err) {
				this.komplettligaenStatus = 'Refresh failed'
				this.komplettligaenError = true
			} finally {
				this.komplettligaenLoading = false
			}
		},
		async testKomplettligaen() {
			this.komplettligaenLoading = true
			this.komplettligaenError = false
			this.komplettligaenStatus = 'Fetching...'
			try {
				const res = await fetch(`/api/komplettligaen/preview?matchId=${encodeURIComponent(this.komplettligaen.matchId)}`)
				const data = await res.json()
				if (!res.ok || data.error) throw new Error(data.error || 'Fetch failed')
				this.komplettligaenStatus = `${data.match.home.name} vs ${data.match.away.name}`
				await this.loadCacheStatus()
			} catch (err) {
				this.komplettligaenStatus = err.message || 'Fetch failed'
				this.komplettligaenError = true
				await this.loadCacheStatus()
			} finally {
				this.komplettligaenLoading = false
			}
		},
		async loadCacheStatus() {
			try {
				const res = await fetch('/api/komplettligaen/cache-status')
				if (res.ok) {
					this.cacheStatus = await res.json()
				}
			} catch (err) {
				console.warn('Failed to load cache status:', err)
			}
		},
		async resetCache() {
			if (!confirm(translateText("Are you sure you want to completely clear NeuronCast's offline tournament cache?"))) return

			this.komplettligaenLoading = true
			this.komplettligaenStatus = 'Resetting cache...'
			try {
				const res = await fetch('/config/komplettligaen/cache-reset', { method: 'POST' })
				if (res.ok) {
					this.komplettligaenStatus = 'Offline cache reset successfully.'
					await this.loadCacheStatus()
				} else {
					this.komplettligaenStatus = 'Failed to reset cache'
				}
			} catch (err) {
				this.komplettligaenStatus = 'Reset failed'
				this.komplettligaenError = true
			} finally {
				this.komplettligaenLoading = false
			}
		},
	},
}
</script>

<style scoped>
.platforms-page {
	display: flex;
	flex-direction: column;
	gap: 20px;
	max-width: 1180px;
}

/* Panel Containers */
.panel {
	background: #161b22;
	border: 1px solid #30363d;
	border-radius: 8px;
	padding: 24px;
}

.header-panel {
	display: flex;
	flex-direction: column;
	gap: 18px;
}

.header-title-row,
.section-title-row {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 6px;
}

.header-title-row h2,
.section-title-row h2 {
	margin: 0;
	font-size: 1.25rem;
	color: #fff;
	font-weight: 600;
}

.header-copy p,
.panel-header p {
	margin: 0;
	color: #8b949e;
	line-height: 1.45;
	font-size: 0.9rem;
}

.panel-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 16px;
	margin-bottom: 20px;
	padding-bottom: 16px;
	border-bottom: 1px solid #21262d;
}

/* Segmented Control Tabs */
.segmented {
	display: inline-flex;
	gap: 8px;
	background: #0d1117;
	padding: 4px;
	border-radius: 8px;
	border: 1px solid #30363d;
	width: fit-content;
}

.segmented button {
	border: 1px solid transparent;
	border-radius: 6px;
	padding: 8px 16px;
	color: #8b949e;
	background: transparent;
	cursor: pointer;
	font: inherit;
	font-size: 0.85rem;
	font-weight: 600;
	transition: all 0.15s ease;
}

.segmented button:hover {
	color: #fff;
	background: rgba(255, 255, 255, 0.04);
}

.segmented button.--active {
	color: #fff;
	background: #1f6feb;
	border-color: #1f6feb;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* Form Layout */
.platform-form {
	display: flex;
	flex-direction: column;
	gap: 18px;
	max-width: 600px;
}

.field-group {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.field-label span {
	display: block;
	margin-bottom: 6px;
	color: #adbac7;
	font-size: 0.85rem;
	font-weight: 600;
}

.field-hint {
	color: #768390;
	font-size: 0.78rem;
}

.text-input {
	width: 100%;
	box-sizing: border-box;
	padding: 9px 12px;
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 6px;
	color: #c9d1d9;
	font: inherit;
	font-size: 0.9rem;
	transition: border-color 0.15s ease;
}

.text-input:focus {
	outline: none;
	border-color: #1f6feb;
	box-shadow: 0 0 0 1px #1f6feb;
}

.text-input:disabled {
	opacity: 0.55;
	cursor: not-allowed;
	background: #090d12;
}

/* Actions & Buttons */
.actions {
	display: flex;
	align-items: center;
	gap: 10px;
	margin-top: 4px;
}

.btn-primary {
	border: 1px solid #1f6feb;
	border-radius: 6px;
	padding: 8px 16px;
	color: #fff;
	background: #1f6feb;
	cursor: pointer;
	font: inherit;
	font-size: 0.85rem;
	font-weight: 600;
	transition: background 0.15s ease;
}

.btn-primary:hover:not(:disabled) {
	background: #388bfd;
}

.btn-primary:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.btn-secondary {
	border: 1px solid #30363d;
	border-radius: 6px;
	padding: 8px 16px;
	color: #c9d1d9;
	background: #21262d;
	cursor: pointer;
	font: inherit;
	font-size: 0.85rem;
	font-weight: 500;
	transition: all 0.15s ease;
}

.btn-secondary:hover:not(:disabled) {
	color: #fff;
	background: #30363d;
	border-color: #8b949e;
}

.btn-secondary:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.btn-ghost {
	background: transparent;
	border: 1px solid #30363d;
	color: #8b949e;
	padding: 4px 10px;
	border-radius: 6px;
	font: inherit;
	font-size: 0.8rem;
	cursor: pointer;
	transition: all 0.15s ease;
}

.btn-ghost:hover:not(:disabled) {
	color: #fff;
	border-color: #8b949e;
	background: rgba(255, 255, 255, 0.05);
}

/* Status Callout */
.status-callout {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 14px;
	background: rgba(74, 222, 128, 0.08);
	border: 1px solid rgba(74, 222, 128, 0.25);
	border-radius: 6px;
	color: #4ade80;
	font-size: 0.85rem;
	font-weight: 500;
}

.status-callout.--error {
	background: rgba(248, 113, 113, 0.08);
	border-color: rgba(248, 113, 113, 0.25);
	color: #f87171;
}

.status-indicator {
	width: 7px;
	height: 7px;
	border-radius: 50%;
	background: currentColor;
	flex-shrink: 0;
}

/* Cache Diagnostics Box */
.cache-diagnostics-box {
	margin-top: 24px;
	padding: 18px;
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 8px;
}

.cache-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 14px;
	padding-bottom: 12px;
	border-bottom: 1px solid #21262d;
}

.cache-title-row {
	display: flex;
	align-items: center;
	gap: 10px;
}

.cache-title-row h4 {
	margin: 0;
	font-size: 0.88rem;
	font-weight: 600;
	color: #c9d1d9;
	text-transform: uppercase;
	letter-spacing: 0.5px;
}

.cache-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: 14px;
}

.cache-stat {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 10px 12px;
	background: #161b22;
	border: 1px solid #21262d;
	border-radius: 6px;
}

.stat-label {
	color: #768390;
	font-size: 0.78rem;
}

.stat-value {
	font-size: 0.88rem;
	color: #e6edf3;
}

.text-mono {
	font-family: var(--eon-font-mono, ui-monospace, Consolas, monospace);
}

.text-grn { color: #4ade80 !important; }
.text-red { color: #f87171 !important; }
.text-amb { color: #f59e0b !important; }

.failure-callout {
	margin-top: 14px;
	padding: 12px;
	background: rgba(248, 113, 113, 0.06);
	border: 1px solid rgba(248, 113, 113, 0.2);
	border-radius: 6px;
}

.failure-header {
	color: #f87171;
	font-size: 0.8rem;
	font-weight: 600;
	margin-bottom: 6px;
}

.failure-code {
	font-family: var(--eon-font-mono, ui-monospace, Consolas, monospace);
	font-size: 0.76rem;
	color: #e6edf3;
	white-space: pre-wrap;
	word-break: break-all;
}

/* Manual Features Grid */
.manual-features-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
	gap: 16px;
	margin-top: 8px;
}

.feature-card {
	padding: 18px;
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 8px;
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.feature-card h4 {
	margin: 0;
	font-size: 0.95rem;
	color: #e6edf3;
	font-weight: 600;
}

.feature-card p {
	margin: 0;
	color: #8b949e;
	font-size: 0.82rem;
	line-height: 1.45;
}
</style>
