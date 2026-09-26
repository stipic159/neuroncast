<template>
	<div class="platforms-page">
		<div class="card">
			<div class="card-header">
				<h2>{{ $t("Match Platforms Hub") }}</h2>
			</div>
			<p style="color: #8b949e; font-size: 0.85rem; margin-top: 4px; margin-bottom: 16px;">
				{{ $t("Select external tournament or matchmaking providers to sync rosters, match metadata, and bracket statistics.") }}
			</p>

			<div class="platform-tabs" style="display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid #30363d; padding-bottom: 12px;">
				<button 
					:class="['btn-win', { '--active': activePlatform === 'fastcup' }]" 
					@click="activePlatform = 'fastcup'"
				>
					Fastcup (CS2)
				</button>
				<button 
					:class="['btn-win', { '--active': activePlatform === 'komplettligaen' }]" 
					@click="activePlatform = 'komplettligaen'"
				>
					Komplettligaen
				</button>
				<button 
					:class="['btn-win', '--clear', { '--active': activePlatform === 'manual' }]" 
					@click="activePlatform = 'manual'"
				>
					{{ $t("Manual / Standalone") }}
				</button>
			</div>

			<!-- FASTCUP SECTION -->
			<div v-if="activePlatform === 'fastcup'" class="platform-body">
				<div class="card-header" style="margin-bottom: 12px;">
					<h3 style="margin: 0; font-size: 1rem; color: #fff;">Fastcup Match Sync</h3>
					<span style="font-size: 0.75rem; background: #1f6feb; color: #fff; padding: 2px 8px; border-radius: 12px;">Planned</span>
				</div>
				<p style="color: #8b949e; font-size: 0.8rem; margin-bottom: 16px;">
					{{ $t("Connect to fastcup.net matches to pull team rosters, player avatars, and veto stages directly into HUD.") }}
				</p>
				<div class="override-group">
					<label>Fastcup Match ID / URL</label>
					<input class="text-input" placeholder="e.g. 1048294" disabled>
				</div>
				<div class="button-row" style="margin-top: 12px;">
					<button class="btn-promo" disabled>{{ $t("Save Match") }}</button>
					<button class="btn-win --clear" disabled>{{ $t("Refresh Data") }}</button>
				</div>
			</div>

			<!-- KOMPLETTLIGAEN SECTION -->
			<div v-if="activePlatform === 'komplettligaen'" class="platform-body">
				<div class="card-header" style="margin-bottom: 12px;">
					<h3 style="margin: 0; font-size: 1rem; color: #fff;">Komplettligaen / GG Arena</h3>
				</div>
				<div class="override-group">
					<label>{{ $t("GG Arena Match ID") }}</label>
					<input v-model="komplettligaen.matchId" class="text-input" placeholder="256437">
				</div>
				<div class="button-row" style="margin-top: 12px;">
					<button class="btn-promo" @click="saveKomplettligaen" :disabled="komplettligaenLoading">{{ $t("Save Match") }}</button>
					<button class="btn-win --clear" @click="refreshKomplettligaen" :disabled="komplettligaenLoading">{{ $t("Refresh Data") }}</button>
					<button class="btn-win --clear" @click="testKomplettligaen" :disabled="komplettligaenLoading || !komplettligaen.matchId">{{ $t("Test") }}</button>
				</div>
				<div class="kl-status" :class="{ '--error': komplettligaenError }">{{ $text(komplettligaenStatus) }}</div>

				<!-- Cache Diagnostics -->
				<div v-if="cacheStatus" class="cache-diagnostics" style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed #2d333b; font-size: 0.8rem; color: #8b949e; line-height: 1.4;">
					<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
						<h4 style="font-size: 0.85rem; font-weight: 600; color: #adbac7; margin: 0; text-transform: uppercase;">{{ $t("Cache Health") }}</h4>
						<button class="btn-ghost" style="padding: 2px 8px; font-size: 0.75rem;" @click="resetCache" :disabled="komplettligaenLoading">{{ $t("Reset Cache") }}</button>
					</div>
					<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
						<span>{{ $t("Local Cache:") }}</span>
						<strong :style="{ color: cacheStatus.exists ? '#2ecc71' : '#e74c3c' }">{{ $text(cacheStatus.exists ? 'Available' : 'Missing') }}</strong>
					</div>
					<div v-if="cacheStatus.exists">
						<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
							<span>{{ $t("Last Updated:") }}</span>
							<strong>{{ formatTime(cacheStatus.savedAt) }}</strong>
						</div>
						<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
							<span>{{ $t("Source Endpoint:") }}</span>
							<strong style="font-family: monospace;">{{ cacheStatus.source }}</strong>
						</div>
						<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
							<span>{{ $t("Stale Status:") }}</span>
							<strong :style="{ color: cacheStatus.stale ? '#e67e22' : '#2ecc71' }">{{ $text(cacheStatus.stale ? 'Stale (' + cacheStatus.ageMinutes + ' min)' : 'Fresh') }}</strong>
						</div>
					</div>
					<div v-if="cacheStatus.fetchFailureReason" style="margin-top: 8px; color: #e74c3c;">
						<span>{{ $t("Last Failure Reason:") }}</span>
						<div style="background: rgba(231, 76, 60, 0.1); border: 1px solid rgba(231, 76, 60, 0.2); padding: 6px; border-radius: 4px; margin-top: 4px; font-family: monospace; white-space: pre-wrap; font-size: 0.75rem;">{{ $text(cacheStatus.fetchFailureReason) }}</div>
					</div>
				</div>
			</div>

			<!-- MANUAL SECTION -->
			<div v-if="activePlatform === 'manual'" class="platform-body">
				<div class="card-header" style="margin-bottom: 12px;">
					<h3 style="margin: 0; font-size: 1rem; color: #fff;">{{ $t("Standalone Tournament Operation") }}</h3>
				</div>
				<p style="color: #8b949e; font-size: 0.85rem;">
					{{ $t("No external platform sync active. Team names, logos, rosters, and match format are configured manually in Setup > Teams & Players and Series & Maps.") }}
				</p>
			</div>
		</div>
	</div>
</template>

<script>
import { text as translateText } from '/config/i18n.js'
import { state, actions } from '/config/store.js'

export default {
	name: 'PlatformsPage',
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
			if (!confirm(translateText('Are you sure you want to completely clear NeuronCast\'s offline tournament cache?'))) return;
			
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
