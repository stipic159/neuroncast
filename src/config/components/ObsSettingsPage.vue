<template>
	<div class="panel">
		<div class="panel-header">
			<div>
				<h2>{{ $t("OBS Studio Integration") }}</h2>
				<p class="panel-desc">
					{{ $t("Connect to OBS Studio via WebSocket v5 to control stream scenes, mute observer mics, and trigger replay buffers.") }}
				</p>
			</div>
			<div style="display: flex; gap: 8px; align-items: center;">
				<Chip
					:tone="obsState.connected ? 'grn' : (obsState.connecting ? 'amb' : 'neutral')"
					:dot="true"
					:pulse="obsState.connecting"
				>
					{{ obsState.connected ? $t("Connected") : (obsState.connecting ? $t("Connecting...") : $t("Disconnected")) }}
				</Chip>
				<button
					v-if="!obsState.connected"
					class="btn-primary"
					:disabled="loading || obsState.connecting"
					@click="connectObs"
				>
					{{ $t("Connect") }}
				</button>
				<button
					v-else
					class="btn-ghost"
					:disabled="loading"
					@click="disconnectObs"
				>
					{{ $t("Disconnect") }}
				</button>
			</div>
		</div>

		<!-- Mobile Remote Launch Callout -->
		<div class="remote-banner">
			<div class="remote-banner-info">
				<span class="remote-badge">📱 {{ $t("Mobile Operator Remote") }}</span>
				<h4>{{ $t("Single-Monitor Stream Control") }}</h4>
				<p>{{ $t("Open the touch-optimized remote on your phone to switch OBS scenes, toggle mic mute, and trigger replays blind.") }}</p>
				<div class="remote-links">
					<a :href="remoteUrl" target="_blank" class="remote-link-btn">
						🔗 {{ $t("Open Local Remote") }}
					</a>
					<span class="remote-url-tag">{{ remoteUrl }}</span>
				</div>
			</div>
		</div>

		<!-- Error banner -->
		<div v-if="obsState.lastError" class="obs-error-callout">
			<strong>{{ $t("Connection Warning:") }}</strong> {{ obsState.lastError }}
		</div>

		<!-- How HUD Automation Works Info Callout -->
		<div class="hud-auto-info">
			<strong>💡 {{ $t("HUD Automation Info:") }}</strong>
			<span>{{ $t("NeuronCast renders all match overlays, scoreboards, radar, overtime screens and match results inside a single Browser Source layer. You only need to assign your Main Broadcast Scene.") }}</span>
		</div>

		<!-- Connection Settings Form -->
		<div class="obs-section">
			<h3>{{ $t("WebSocket Settings") }}</h3>
			<div class="form-grid">
				<div class="field-group">
					<label class="field-label">{{ $t("Enable OBS Integration") }}</label>
					<label class="checkbox-container">
						<input type="checkbox" v-model="form.enabled" />
						<span>{{ $t("Auto-connect to OBS Studio on startup") }}</span>
					</label>
				</div>

				<div class="field-group">
					<label class="field-label">{{ $t("Host / IP Address") }}</label>
					<input
						type="text"
						class="text-input"
						v-model="form.host"
						placeholder="127.0.0.1"
					/>
					<div class="field-hint">{{ $t("Use 127.0.0.1 for local OBS or your streaming PC LAN IP.") }}</div>
				</div>

				<div class="field-group">
					<label class="field-label">{{ $t("Port") }}</label>
					<input
						type="number"
						class="text-input"
						v-model.number="form.port"
						placeholder="4455"
					/>
					<div class="field-hint">{{ $t("Default OBS WebSocket v5 port is 4455.") }}</div>
				</div>

				<div class="field-group">
					<label class="field-label">{{ $t("Server Password") }}</label>
					<input
						type="password"
						class="text-input"
						v-model="form.password"
						placeholder="••••••••"
					/>
					<div class="field-hint">{{ $t("Optional. Found in OBS Tools > WebSocket Server Settings.") }}</div>
				</div>

				<div class="field-group">
					<label class="field-label">{{ $t("Microphone Source Name") }}</label>
					<input
						type="text"
						class="text-input"
						v-model="form.micSourceName"
						placeholder="Mic/Aux"
					/>
					<div class="field-hint">{{ $t("Exact audio input name in OBS for caster cough/mute toggle.") }}</div>
				</div>
			</div>
		</div>

		<!-- OBS Scene Setup Section -->
		<div class="obs-section">
			<h3>{{ $t("OBS Broadcast Scenes") }}</h3>
			
			<div class="scene-mapping-grid">
				<div class="field-group">
					<label class="field-label">🎮 {{ $t("Main Broadcast Scene (CS2 + HUD)") }}</label>
					<select v-if="obsState.scenes && obsState.scenes.length > 0" class="text-input" v-model="form.mainSceneName">
						<option value="">{{ $t("— Select OBS Scene —") }}</option>
						<option v-for="s in obsState.scenes" :key="s" :value="s">{{ s }}</option>
					</select>
					<input
						v-else
						type="text"
						class="text-input"
						v-model="form.mainSceneName"
						placeholder="e.g. CS2 Game"
					/>
					<div class="field-hint">{{ $t("The primary OBS scene where CS2 capture and NeuronCast HUD Browser Source live.") }}</div>
				</div>

				<div class="field-group">
					<label class="field-label">🎙️ {{ $t("Intermission / Caster Scene (Optional)") }}</label>
					<select v-if="obsState.scenes && obsState.scenes.length > 0" class="text-input" v-model="form.intermissionSceneName">
						<option value="">{{ $t("— None / Optional —") }}</option>
						<option v-for="s in obsState.scenes" :key="s" :value="s">{{ s }}</option>
					</select>
					<input
						v-else
						type="text"
						class="text-input"
						v-model="form.intermissionSceneName"
						placeholder="e.g. Facecam / Talk"
					/>
					<div class="field-hint">{{ $t("Optional camera or break scene to switch to during commercial or analyst breaks.") }}</div>
				</div>
			</div>
		</div>

		<!-- Action Footer -->
		<div class="actions">
			<button class="btn-primary" :disabled="saving" @click="saveSettings">
				{{ saving ? $t("Saving...") : $t("Save OBS Configuration") }}
			</button>
		</div>
	</div>
</template>

<script>
import Chip from '/config/components/atoms/Chip.vue'

export default {
	name: 'ObsSettingsPage',
	components: { Chip },
	data() {
		return {
			loading: false,
			saving: false,
			remoteUrl: `${window.location.origin}/remote/`,
			obsState: {
				enabled: false,
				connected: false,
				connecting: false,
				lastError: null,
				currentScene: '',
				scenes: [],
				micMuted: false,
				replayBufferActive: false,
				mainSceneName: '',
				intermissionSceneName: '',
			},
			form: {
				enabled: false,
				host: '127.0.0.1',
				port: 4455,
				password: '',
				micSourceName: '',
				mainSceneName: '',
				intermissionSceneName: '',
			},
		}
	},
	mounted() {
		this.fetchStatus()
	},
	methods: {
		async fetchStatus() {
			try {
				const res = await fetch('/api/obs/status')
				if (res.ok) {
					const data = await res.json()
					this.obsState = data
					this.form.enabled = !!data.enabled
					this.form.host = data.host || '127.0.0.1'
					this.form.port = data.port || 4455
					this.form.micSourceName = data.micSourceName || ''
					this.form.mainSceneName = data.mainSceneName || ''
					this.form.intermissionSceneName = data.intermissionSceneName || ''
				}
			} catch (err) {
				console.error('[OBS Settings] Failed to fetch status:', err)
			}
		},
		async saveSettings() {
			this.saving = true
			try {
				const res = await fetch('/api/obs/config', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(this.form),
				})
				if (res.ok) {
					const data = await res.json()
					this.obsState = data.status || this.obsState
				}
			} catch (err) {
				console.error('[OBS Settings] Failed to save config:', err)
			} finally {
				this.saving = false
			}
		},
		async connectObs() {
			this.loading = true
			try {
				await this.saveSettings()
				const res = await fetch('/api/obs/connect', { method: 'POST' })
				const data = await res.json()
				this.obsState = data.status || this.obsState
			} catch (err) {
				console.error('[OBS Settings] Failed to connect:', err)
			} finally {
				this.loading = false
			}
		},
		async disconnectObs() {
			this.loading = true
			try {
				const res = await fetch('/api/obs/disconnect', { method: 'POST' })
				const data = await res.json()
				this.obsState = data.status || this.obsState
			} catch (err) {
				console.error('[OBS Settings] Failed to disconnect:', err)
			} finally {
				this.loading = false
			}
		},
	},
}
</script>

<style scoped>
.panel {
	background: #161b22;
	border: 1px solid #30363d;
	border-radius: 8px;
	padding: 24px;
	max-width: 900px;
	display: flex;
	flex-direction: column;
	gap: 24px;
}

.panel-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 16px;
	border-bottom: 1px solid #30363d;
	padding-bottom: 16px;
}

.panel-desc {
	color: #8b949e;
	font-size: 0.9rem;
	margin: 6px 0 0 0;
	line-height: 1.4;
}

.remote-banner {
	background: linear-gradient(135deg, rgba(31, 111, 235, 0.15) 0%, rgba(22, 27, 34, 0.8) 100%);
	border: 1px solid rgba(88, 166, 255, 0.3);
	border-radius: 8px;
	padding: 16px 20px;
}

.remote-banner-info h4 {
	color: #fff;
	font-size: 1rem;
	font-weight: 700;
	margin: 8px 0 4px 0;
}

.remote-banner-info p {
	color: #8b949e;
	font-size: 0.85rem;
	margin: 0 0 12px 0;
	line-height: 1.4;
}

.remote-badge {
	font-size: 0.75rem;
	font-weight: 700;
	color: #58a6ff;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.remote-links {
	display: flex;
	align-items: center;
	gap: 12px;
}

.remote-link-btn {
	background: #1f6feb;
	color: #fff;
	text-decoration: none;
	padding: 6px 14px;
	border-radius: 6px;
	font-size: 0.8rem;
	font-weight: 600;
	transition: background 0.15s;
}

.remote-link-btn:hover {
	background: #388bfd;
}

.remote-url-tag {
	font-family: monospace;
	font-size: 0.8rem;
	color: #8b949e;
	background: #0d1117;
	padding: 4px 8px;
	border-radius: 4px;
	border: 1px solid #30363d;
}

.obs-error-callout {
	background: rgba(248, 81, 73, 0.15);
	border: 1px solid rgba(248, 81, 73, 0.4);
	color: #f85149;
	padding: 12px 16px;
	border-radius: 6px;
	font-size: 0.85rem;
}

.hud-auto-info {
	background: rgba(88, 166, 255, 0.08);
	border: 1px solid rgba(88, 166, 255, 0.2);
	border-radius: 6px;
	padding: 12px 16px;
	font-size: 0.85rem;
	color: #adbac7;
	display: flex;
	align-items: flex-start;
	gap: 8px;
	line-height: 1.4;
}

.hud-auto-info strong {
	color: #58a6ff;
	flex-shrink: 0;
}

.obs-section {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.obs-section h3 {
	font-size: 1rem;
	font-weight: 600;
	color: #adbac7;
	margin: 0;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.form-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	gap: 16px;
}

.scene-mapping-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
	gap: 16px;
}

.field-group {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.field-label {
	font-size: 0.85rem;
	font-weight: 600;
	color: #c9d1d9;
}

.field-hint {
	font-size: 0.75rem;
	color: #8b949e;
	line-height: 1.3;
}

.text-input {
	background: #0d1117;
	border: 1px solid #30363d;
	color: #c9d1d9;
	padding: 8px 12px;
	border-radius: 6px;
	font-size: 0.9rem;
	outline: none;
	transition: border-color 0.15s ease;
}

.text-input:focus {
	border-color: #58a6ff;
}

.checkbox-container {
	display: flex;
	align-items: center;
	gap: 8px;
	color: #c9d1d9;
	font-size: 0.85rem;
	cursor: pointer;
	padding: 8px 0;
}

.checkbox-container input[type="checkbox"] {
	cursor: pointer;
	width: 16px;
	height: 16px;
}

.actions {
	display: flex;
	justify-content: flex-end;
	padding-top: 16px;
	border-top: 1px solid #30363d;
}

.btn-primary {
	background: #1f6feb;
	color: #fff;
	border: none;
	padding: 8px 16px;
	border-radius: 6px;
	font-size: 0.85rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.15s;
}

.btn-primary:hover:not(:disabled) {
	background: #388bfd;
}

.btn-primary:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.btn-ghost {
	background: transparent;
	color: #8b949e;
	border: 1px solid #30363d;
	padding: 8px 16px;
	border-radius: 6px;
	font-size: 0.85rem;
	font-weight: 500;
	cursor: pointer;
	transition: all 0.15s;
}

.btn-ghost:hover:not(:disabled) {
	background: rgba(248, 81, 73, 0.1);
	color: #f85149;
	border-color: #f85149;
}
</style>
