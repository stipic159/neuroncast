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
						<h2>{{ $t("Fastcup Match Sync") }}</h2>
						<Chip :tone="fastcup.config.providerActive ? 'grn' : 'blu'" :pulse="fastcup.config.providerActive">
							{{ fastcup.config.providerActive ? $t("Active Provider") : $t("Ready") }}
						</Chip>
					</div>
					<p>{{ $t("Connect to fastcup.net matches to pull team rosters, player avatars, and veto stages directly into HUD.") }}</p>
				</div>
			</header>

			<div class="platform-form">
				<!-- Match ID or Page URL -->
				<div class="field-group">
					<label class="field-label">
						<span>Fastcup Match ID / URL</span>
						<input
							v-model="fastcup.config.matchId"
							type="text"
							class="text-input"
							placeholder="1048294 or https://cs.fastcup.net/match/1048294"
							:disabled="fastcupLoading"
						>
					</label>
					<span class="field-hint">Match ID or direct match page URL from cs.fastcup.net.</span>
				</div>

				<!-- Options Toggles -->
				<div class="field-row">
					<label class="checkbox-container">
						<input v-model="fastcup.config.providerActive" type="checkbox" :disabled="fastcupLoading">
						<span>Enable FastCup Sync for HUD</span>
					</label>

					<label class="checkbox-container">
						<input v-model="fastcup.config.autoRefresh" type="checkbox" :disabled="fastcupLoading">
						<span>Auto-Refresh Polling</span>
					</label>
				</div>

				<!-- Advanced Bypass Spoiler -->
				<div class="advanced-section">
					<button class="btn-ghost" @click="showAdvanced = !showAdvanced">
						{{ showAdvanced ? '▼' : '►' }} Advanced Bypass Settings (Session Cookie)
					</button>

					<div v-if="showAdvanced" class="advanced-box">
						<div class="field-group">
							<label class="field-label">
								<span>Session Cookie (Optional)</span>
								<input
									v-model="fastcup.config.sessionCookie"
									type="password"
									class="text-input"
									placeholder="fastcup_session=..."
									:disabled="fastcupLoading"
								>
							</label>
							<span class="field-hint">Optional cookie string used to bypass 403 / Cloudflare security on protected Fastcup matches.</span>
						</div>
					</div>
				</div>

				<!-- Primary Action Buttons -->
				<div class="actions">
					<button
						class="btn-primary"
						:disabled="fastcupLoading"
						@click="saveFastcup"
					>
						{{ fastcupLoading ? $t("Saving...") : $t("Save Match") }}
					</button>
					<button
						class="btn-secondary"
						:disabled="fastcupLoading || !fastcup.config.matchId"
						@click="refreshFastcup"
					>
						{{ $t("Refresh Data") }}
					</button>
					<button
						class="btn-secondary"
						:disabled="fastcupLoading || !fastcup.config.matchId"
						@click="previewFastcup"
					>
						Preview Match Data
					</button>
				</div>

				<!-- Status / Error Callout -->
				<div
					v-if="fastcupStatus"
					:class="['status-callout', { '--error': fastcupError }]"
				>
					<span class="status-indicator"></span>
					<span class="status-text">{{ fastcupStatus }}</span>
				</div>
			</div>

			<!-- Live Match Preview Card -->
			<div v-if="fastcup.match && fastcup.match.teams" class="match-preview-container">
				<div class="preview-header">
					<div class="preview-title">
						<h4>Match Preview: {{ fastcup.match.teams.team1.name }} vs {{ fastcup.match.teams.team2.name }}</h4>
					</div>
					<div class="preview-meta">
						<span class="badge-bo">BO{{ fastcup.match.format || 1 }}</span>
						<span class="badge-status" :class="{ '--live': fastcup.match.status === 'live' }">
							{{ (fastcup.match.status || 'unknown').toUpperCase() }}
						</span>
						<span v-if="fastcup.match.mapName" class="meta-map">MAP: {{ fastcup.match.mapName }}</span>
					</div>
				</div>

				<div class="teams-preview-grid">
					<!-- TEAM 1 -->
					<div class="team-card">
						<div class="team-card-header">
							<img :src="fastcup.match.teams.team1.logoUrl || '/hud/img/icons/radar-dead-player.svg'" class="team-logo-img" alt="">
							<div class="team-info">
								<div class="team-name-row">
									<h3>{{ fastcup.match.teams.team1.name }}</h3>
									<button
										class="btn-icon-lock"
										:class="{ '--locked': isFieldLocked('teams.team1.name') }"
										title="Toggle Override Lock"
										@click="toggleLockField('teams.team1.name', fastcup.match.teams.team1.name)"
									>
										{{ isFieldLocked('teams.team1.name') ? '🔒' : '🔓' }}
									</button>
								</div>
								<span class="team-tag">TAG: {{ fastcup.match.teams.team1.tag }}</span>
							</div>
						</div>

						<div class="players-table">
							<div v-for="(p, i) in fastcup.match.teams.team1.players" :key="p.steamId64" class="player-row">
								<img :src="p.avatarUrl" class="player-avatar" alt="">
								<div class="player-details">
									<div class="player-nick">
										<span>{{ p.nickname }}</span>
										<button
											class="btn-icon-lock-sm"
											:class="{ '--locked': isFieldLocked(`teams.team1.players.${i}.nickname`) }"
											@click="toggleLockField(`teams.team1.players.${i}.nickname`, p.nickname)"
										>
											{{ isFieldLocked(`teams.team1.players.${i}.nickname`) ? '🔒' : '🔓' }}
										</button>
									</div>
									<span class="player-steam text-mono">{{ p.steamId64 }}</span>
								</div>
								<div class="player-elo">
									<span class="elo-val">{{ p.rating }}</span>
									<span class="elo-lbl">ELO</span>
								</div>
							</div>
						</div>
					</div>

					<!-- TEAM 2 -->
					<div class="team-card">
						<div class="team-card-header">
							<img :src="fastcup.match.teams.team2.logoUrl || '/hud/img/icons/radar-dead-player.svg'" class="team-logo-img" alt="">
							<div class="team-info">
								<div class="team-name-row">
									<h3>{{ fastcup.match.teams.team2.name }}</h3>
									<button
										class="btn-icon-lock"
										:class="{ '--locked': isFieldLocked('teams.team2.name') }"
										title="Toggle Override Lock"
										@click="toggleLockField('teams.team2.name', fastcup.match.teams.team2.name)"
									>
										{{ isFieldLocked('teams.team2.name') ? '🔒' : '🔓' }}
									</button>
								</div>
								<span class="team-tag">TAG: {{ fastcup.match.teams.team2.tag }}</span>
							</div>
						</div>

						<div class="players-table">
							<div v-for="(p, i) in fastcup.match.teams.team2.players" :key="p.steamId64" class="player-row">
								<img :src="p.avatarUrl" class="player-avatar" alt="">
								<div class="player-details">
									<div class="player-nick">
										<span>{{ p.nickname }}</span>
										<button
											class="btn-icon-lock-sm"
											:class="{ '--locked': isFieldLocked(`teams.team2.players.${i}.nickname`) }"
											@click="toggleLockField(`teams.team2.players.${i}.nickname`, p.nickname)"
										>
											{{ isFieldLocked(`teams.team2.players.${i}.nickname`) ? '🔒' : '🔓' }}
										</button>
									</div>
									<span class="player-steam text-mono">{{ p.steamId64 }}</span>
								</div>
								<div class="player-elo">
									<span class="elo-val">{{ p.rating }}</span>
									<span class="elo-lbl">ELO</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- MAP VETO STAGE -->
				<div v-if="fastcup.match.veto && fastcup.match.veto.steps.length" class="veto-stage-box">
					<h4>Pick / Ban Map Veto</h4>
					<div class="veto-steps-row">
						<div
							v-for="s in fastcup.match.veto.steps"
							:key="s.order"
							:class="['veto-chip', `--${s.action}`]"
						>
							<span class="veto-num">#{{ s.order }}</span>
							<span class="veto-team">{{ s.team === 'team1' ? fastcup.match.teams.team1.name : fastcup.match.teams.team2.name }}</span>
							<span class="veto-act">{{ s.action.toUpperCase() }}</span>
							<span class="veto-map">{{ s.mapName }}</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Cache Diagnostics Card -->
			<div class="cache-diagnostics-box">
				<div class="cache-header">
					<div class="cache-title-row">
						<h4>{{ $t("Cache Health") }}</h4>
						<Chip :tone="fastcup.match ? 'grn' : 'red'">
							{{ fastcup.match ? 'Cached' : 'Empty' }}
						</Chip>
					</div>
					<button
						class="btn-ghost"
						:disabled="fastcupLoading"
						@click="resetFastcupCache"
					>
						{{ $t("Reset Cache") }}
					</button>
				</div>

				<div class="cache-grid">
					<div class="cache-stat">
						<span class="stat-label">Active Match ID:</span>
						<strong class="stat-value text-mono">{{ fastcup.config.matchId || 'None' }}</strong>
					</div>
					<div class="cache-stat">
						<span class="stat-label">Last Polled:</span>
						<strong class="stat-value text-mono">{{ formatTime(fastcup.fetchedAt) }}</strong>
					</div>
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
			showAdvanced: false,
			fastcup: {
				config: { matchId: '', sessionCookie: '', providerActive: false, autoRefresh: true },
				match: null,
				fetchedAt: 0,
			},
			fastcupLoading: false,
			fastcupStatus: '',
			fastcupError: false,

			komplettligaen: { matchId: '', activeView: 'match' },
			komplettligaenLoading: false,
			komplettligaenStatus: '',
			komplettligaenError: false,
			cacheStatus: null,
		}
	},
	async mounted() {
		await this.loadFastcup()
		await this.loadKomplettligaen()
		await this.loadCacheStatus()
	},
	methods: {
		formatTime(isoOrTs) {
			if (!isoOrTs) return translateText('Never')
			try {
				const d = new Date(isoOrTs)
				return isNaN(d.getTime()) ? translateText('Never') : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
			} catch (_) {
				return translateText('Never')
			}
		},
		isFieldLocked(fieldPath) {
			const locked = this.fastcup.match?.overrides?.lockedFields || []
			return locked.includes(fieldPath)
		},
		async parseJsonResponse(res) {
			const contentType = res.headers.get('content-type') || ''
			if (contentType.includes('application/json')) {
				return await res.json()
			}
			const text = await res.text()
			if (!res.ok) {
				throw new Error(`Server returned HTTP ${res.status}: ${text || 'Not Found'}`)
			}
			throw new Error('Server returned non-JSON response')
		},

		// FASTCUP METHODS
		async loadFastcup() {
			try {
				const res = await fetch('/api/fastcup/config')
				if (!res.ok) return
				const data = await this.parseJsonResponse(res)
				if (data.config) this.fastcup.config = { ...this.fastcup.config, ...data.config }
				if (data.match) this.fastcup.match = data.match
				if (data.fetchedAt) this.fastcup.fetchedAt = data.fetchedAt
			} catch (err) {
				// Silence load error
			}
		},
		async saveFastcup() {
			this.fastcupLoading = true
			this.fastcupStatus = 'Saving FastCup configuration...'
			this.fastcupError = false
			try {
				const res = await fetch('/api/fastcup/config', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(this.fastcup.config),
				})
				const data = await this.parseJsonResponse(res)
				if (res.ok && data.success) {
					this.fastcup.config = data.config
					this.fastcup.match = data.match
					this.fastcupStatus = 'FastCup match configuration saved successfully!'
				} else {
					this.fastcupError = true
					this.fastcupStatus = data.error || 'Failed to save FastCup match.'
				}
			} catch (err) {
				this.fastcupError = true
				this.fastcupStatus = err.message
			} finally {
				this.fastcupLoading = false
			}
		},
		async refreshFastcup() {
			this.fastcupLoading = true
			this.fastcupStatus = 'Refreshing FastCup match data...'
			this.fastcupError = false
			try {
				const res = await fetch('/api/fastcup/refresh', { method: 'POST' })
				const data = await this.parseJsonResponse(res)
				if (res.ok && data.success) {
					this.fastcup.match = data.match
					this.fastcupStatus = 'FastCup match data refreshed successfully!'
				} else {
					this.fastcupError = true
					this.fastcupStatus = data.error || 'Failed to refresh FastCup match.'
				}
			} catch (err) {
				this.fastcupError = true
				this.fastcupStatus = err.message
			} finally {
				this.fastcupLoading = false
			}
		},
		async previewFastcup() {
			if (!this.fastcup.config.matchId) return
			this.fastcupLoading = true
			this.fastcupStatus = 'Fetching preview from FastCup...'
			this.fastcupError = false
			try {
				const res = await fetch(`/api/fastcup/preview?matchId=${encodeURIComponent(this.fastcup.config.matchId)}&cookie=${encodeURIComponent(this.fastcup.config.sessionCookie || '')}`)
				const data = await this.parseJsonResponse(res)
				if (res.ok && data.match) {
					this.fastcup.match = data.match
					this.fastcupStatus = 'Preview loaded successfully!'
				} else {
					this.fastcupError = true
					this.fastcupStatus = data.error || 'Preview failed.'
				}
			} catch (err) {
				this.fastcupError = true
				this.fastcupStatus = err.message
			} finally {
				this.fastcupLoading = false
			}
		},
		async toggleLockField(fieldPath, value) {
			const isLocked = !this.isFieldLocked(fieldPath)
			try {
				const res = await fetch('/api/fastcup/override', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ fieldPath, value, isLocked }),
				})
				const data = await this.parseJsonResponse(res)
				if (res.ok && data.match) {
					this.fastcup.match = data.match
				}
			} catch (err) {
				// Lock toggle error
			}
		},
		async resetFastcupCache() {
			this.fastcupLoading = true
			try {
				const res = await fetch('/api/fastcup/cache-reset', { method: 'POST' })
				await this.parseJsonResponse(res)
				this.fastcup.match = null
				this.fastcupStatus = 'FastCup cache and asset storage cleared.'
			} catch (err) {
				// Cache reset error
			} finally {
				this.fastcupLoading = false
			}
		},

		// KOMPLETTLIGAEN METHODS
		async loadKomplettligaen() {
			try {
				const res = await fetch('/config/komplettligaen')
				if (!res.ok) return
				const data = await res.json()
				if (data.config) this.komplettligaen = { ...this.komplettligaen, ...data.config }
			} catch (_) {}
		},
		async saveKomplettligaen() {
			this.komplettligaenLoading = true
			this.komplettligaenStatus = translateText('Saving...')
			this.komplettligaenError = false
			try {
				const res = await fetch('/config/komplettligaen', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(this.komplettligaen),
				})
				if (res.ok) {
					this.komplettligaenStatus = translateText('Komplettligaen match saved.')
					await this.loadCacheStatus()
				} else {
					this.komplettligaenError = true
					this.komplettligaenStatus = translateText('Failed to save Komplettligaen match.')
				}
			} catch (err) {
				this.komplettligaenError = true
				this.komplettligaenStatus = err.message
			} finally {
				this.komplettligaenLoading = false
			}
		},
		async refreshKomplettligaen() {
			this.komplettligaenLoading = true
			this.komplettligaenStatus = translateText('Refreshing...')
			this.komplettligaenError = false
			try {
				const res = await fetch('/config/komplettligaen/refresh', { method: 'POST' })
				if (res.ok) {
					this.komplettligaenStatus = translateText('Komplettligaen data refreshed.')
					await this.loadCacheStatus()
				} else {
					this.komplettligaenError = true
					this.komplettligaenStatus = translateText('Failed to refresh data.')
				}
			} catch (err) {
				this.komplettligaenError = true
				this.komplettligaenStatus = err.message
			} finally {
				this.komplettligaenLoading = false
			}
		},
		async testKomplettligaen() {
			if (!this.komplettligaen.matchId) return
			this.komplettligaenLoading = true
			this.komplettligaenStatus = translateText('Testing connection...')
			this.komplettligaenError = false
			try {
				const res = await fetch(`/api/komplettligaen/match/${encodeURIComponent(this.komplettligaen.matchId)}`)
				const data = await res.json()
				if (res.ok && data.match) {
					this.komplettligaenStatus = `Match found: ${data.match.home?.name || 'Home'} vs ${data.match.away?.name || 'Away'}`
				} else {
					this.komplettligaenError = true
					this.komplettligaenStatus = data.error || translateText('Failed to fetch match.')
				}
			} catch (err) {
				this.komplettligaenError = true
				this.komplettligaenStatus = err.message
			} finally {
				this.komplettligaenLoading = false
			}
		},
		async loadCacheStatus() {
			try {
				const res = await fetch('/config/komplettligaen/cache-status')
				if (res.ok) this.cacheStatus = await res.json()
			} catch (_) {}
		},
		async resetCache() {
			this.komplettligaenLoading = true
			try {
				await fetch('/config/komplettligaen/cache-reset', { method: 'POST' })
				await this.loadCacheStatus()
			} catch (_) {} finally {
				this.komplettligaenLoading = false
			}
		}
	}
}
</script>

<style scoped>
.platforms-page {
	display: flex;
	flex-direction: column;
	gap: 1.25rem;
}

.panel {
	background: #161b22;
	border: 1px solid #30363d;
	border-radius: 8px;
	padding: 24px;
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.panel-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 16px;
	border-bottom: 1px solid #30363d;
	padding-bottom: 16px;
}

.panel-header h2 {
	margin: 0;
	font-size: 1.25rem;
	color: #f0f6fc;
}

.panel-header p {
	color: #8b949e;
	font-size: 0.88rem;
	margin: 6px 0 0 0;
	line-height: 1.4;
}

.header-panel {
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-wrap: wrap;
	gap: 1rem;
}

.header-title-row,
.section-title-row {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	margin-bottom: 0.25rem;
}

/* SEGMENTED TABS */
.segmented {
	display: inline-flex;
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 6px;
	padding: 3px;
	gap: 2px;
}

.segmented button {
	background: transparent;
	border: none;
	color: #8b949e;
	padding: 6px 14px;
	border-radius: 4px;
	font-size: 0.85rem;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.15s ease;
}

.segmented button:hover {
	color: #c9d1d9;
	background: rgba(255, 255, 255, 0.05);
}

.segmented button.--active {
	background: #1f6feb;
	color: #ffffff;
}

/* FORM STYLING */
.platform-form {
	display: flex;
	flex-direction: column;
	gap: 1.2rem;
}

.field-group {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
}

.field-label {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
	font-weight: 600;
	font-size: 0.88rem;
	color: #c9d1d9;
}

.field-hint {
	font-size: 0.8rem;
	color: #8b949e;
}

.field-row {
	display: flex;
	gap: 1.5rem;
	align-items: center;
}

.text-input {
	background: #0d1117;
	border: 1px solid #30363d;
	color: #c9d1d9;
	padding: 8px 12px;
	border-radius: 6px;
	font-size: 0.9rem;
	outline: none;
	width: 100%;
	box-sizing: border-box;
	transition: border-color 0.15s ease;
}

.text-input:focus {
	border-color: #58a6ff;
	box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15);
}

.checkbox-container {
	display: flex;
	align-items: center;
	gap: 8px;
	color: #c9d1d9;
	font-size: 0.88rem;
	cursor: pointer;
	user-select: none;
}

.checkbox-container input[type="checkbox"] {
	cursor: pointer;
	width: 16px;
	height: 16px;
	accent-color: #1f6feb;
}

/* ADVANCED SETTINGS */
.advanced-section {
	margin-top: 0.25rem;
}

.advanced-box {
	margin-top: 0.5rem;
	padding: 1rem;
	background: rgba(13, 17, 23, 0.7);
	border: 1px solid #30363d;
	border-radius: 6px;
}

/* BUTTONS */
.actions {
	display: flex;
	gap: 0.75rem;
	margin-top: 0.5rem;
}

.btn-primary {
	background: #1f6feb;
	color: #ffffff;
	border: 1px solid #388bfd;
	padding: 8px 16px;
	border-radius: 6px;
	font-size: 0.85rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.15s;
}

.btn-primary:hover {
	background: #388bfd;
}

.btn-primary:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.btn-secondary {
	background: #21262d;
	color: #c9d1d9;
	border: 1px solid #30363d;
	padding: 8px 16px;
	border-radius: 6px;
	font-size: 0.85rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.15s, border-color 0.15s;
}

.btn-secondary:hover {
	background: #30363d;
	border-color: #8b949e;
}

.btn-secondary:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.btn-ghost {
	background: transparent;
	color: #8b949e;
	border: 1px solid #30363d;
	padding: 6px 12px;
	border-radius: 6px;
	font-size: 0.8rem;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.15s;
}

.btn-ghost:hover {
	background: #21262d;
	color: #58a6ff;
	border-color: #58a6ff;
}

/* STATUS CALLOUT */
.status-callout {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 14px;
	background: rgba(46, 160, 67, 0.15);
	border: 1px solid rgba(46, 160, 67, 0.4);
	border-radius: 6px;
	color: #3fb950;
	font-size: 0.88rem;
}

.status-callout.--error {
	background: rgba(248, 81, 73, 0.15);
	border-color: rgba(248, 81, 73, 0.4);
	color: #f85149;
}

/* MATCH PREVIEW CARD */
.match-preview-container {
	margin-top: 1rem;
	padding: 1rem;
	background: rgba(13, 17, 23, 0.8);
	border: 1px solid #30363d;
	border-radius: 8px;
}

.preview-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 1rem;
	padding-bottom: 0.5rem;
	border-bottom: 1px solid #30363d;
}

.preview-header h4 {
	margin: 0;
	font-size: 1rem;
	color: #f0f6fc;
}

.preview-meta {
	display: flex;
	align-items: center;
	gap: 0.75rem;
}

.badge-bo {
	background: #1f6feb;
	color: #fff;
	padding: 0.2rem 0.5rem;
	border-radius: 4px;
	font-weight: bold;
	font-size: 0.8rem;
}

.badge-status {
	padding: 0.2rem 0.5rem;
	border-radius: 4px;
	font-size: 0.8rem;
	font-weight: 600;
	background: #30363d;
	color: #c9d1d9;
}

.badge-status.--live {
	background: #238636;
	color: #fff;
}

.meta-map {
	font-size: 0.85rem;
	color: #8b949e;
	font-family: monospace;
}

.teams-preview-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 1rem;
}

.team-card {
	background: #161b22;
	border: 1px solid #30363d;
	border-radius: 6px;
	padding: 0.85rem;
}

.team-card-header {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	margin-bottom: 0.75rem;
}

.team-logo-img {
	width: 42px;
	height: 42px;
	object-fit: contain;
	border-radius: 4px;
	background: rgba(0, 0, 0, 0.3);
}

.team-name-row {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.team-name-row h3 {
	margin: 0;
	font-size: 1.1rem;
	color: #f0f6fc;
}

.team-tag {
	font-size: 0.8rem;
	color: #8b949e;
}

.btn-icon-lock,
.btn-icon-lock-sm {
	background: transparent;
	border: none;
	cursor: pointer;
	font-size: 0.85rem;
	opacity: 0.5;
	transition: opacity 0.15s;
}

.btn-icon-lock:hover,
.btn-icon-lock-sm:hover,
.btn-icon-lock.--locked,
.btn-icon-lock-sm.--locked {
	opacity: 1;
}

.players-table {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
}

.player-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.35rem 0.5rem;
	background: #0d1117;
	border: 1px solid #21262d;
	border-radius: 4px;
}

.player-avatar {
	width: 28px;
	height: 28px;
	border-radius: 50%;
	object-fit: cover;
}

.player-details {
	display: flex;
	flex-direction: column;
	flex-grow: 1;
	margin: 0 0.75rem;
}

.player-nick {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	font-size: 0.88rem;
	font-weight: 600;
	color: #c9d1d9;
}

.player-steam {
	font-size: 0.72rem;
	color: #8b949e;
}

.player-elo {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
}

.elo-val {
	font-weight: bold;
	font-size: 0.88rem;
	color: #58a6ff;
}

.elo-lbl {
	font-size: 0.65rem;
	color: #8b949e;
}

/* VETO BOX */
.veto-stage-box {
	margin-top: 1rem;
	padding-top: 0.75rem;
	border-top: 1px solid #30363d;
}

.veto-stage-box h4 {
	margin: 0 0 0.5rem 0;
	font-size: 0.9rem;
	color: #8b949e;
}

.veto-steps-row {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.veto-chip {
	display: inline-flex;
	align-items: center;
	gap: 0.4rem;
	padding: 0.3rem 0.6rem;
	border-radius: 4px;
	font-size: 0.78rem;
	background: #21262d;
	border: 1px solid #30363d;
}

.veto-chip.--ban {
	border-color: rgba(248, 81, 73, 0.5);
	background: rgba(248, 81, 73, 0.1);
}

.veto-chip.--pick {
	border-color: rgba(46, 160, 67, 0.5);
	background: rgba(46, 160, 67, 0.1);
}

.veto-num {
	color: #8b949e;
	font-weight: bold;
}

.veto-team {
	color: #c9d1d9;
}

.veto-act {
	font-weight: bold;
}

.veto-chip.--ban .veto-act {
	color: #f85149;
}

.veto-chip.--pick .veto-act {
	color: #3fb950;
}

.veto-map {
	color: #fff;
	font-weight: 600;
}

/* CACHE DIAGNOSTICS CARD */
.cache-diagnostics-box {
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 6px;
	padding: 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.cache-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.cache-title-row {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.cache-title-row h4 {
	margin: 0;
	font-size: 0.95rem;
	color: #f0f6fc;
}

.cache-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 0.75rem;
}

.cache-stat {
	display: flex;
	flex-direction: column;
	gap: 0.2rem;
}

.stat-label {
	font-size: 0.75rem;
	color: #8b949e;
}

.stat-value {
	font-size: 0.88rem;
	color: #c9d1d9;
}

.failure-callout {
	background: rgba(248, 81, 73, 0.1);
	border: 1px solid rgba(248, 81, 73, 0.3);
	padding: 0.5rem 0.75rem;
	border-radius: 4px;
}

.failure-header {
	font-size: 0.75rem;
	font-weight: bold;
	color: #f85149;
}

.failure-code {
	font-size: 0.8rem;
	color: #c9d1d9;
	font-family: monospace;
}

.manual-features-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: 1rem;
}

.feature-card {
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 6px;
	padding: 1rem;
}

.feature-card h4 {
	margin: 0 0 0.5rem 0;
	color: #58a6ff;
	font-size: 0.95rem;
}

.feature-card p {
	margin: 0;
	font-size: 0.82rem;
	color: #8b949e;
	line-height: 1.4;
}

.text-mono {
	font-family: monospace;
}

.text-grn {
	color: #3fb950;
}

.text-red {
	color: #f85149;
}

.text-amb {
	color: #d29922;
}
</style>
