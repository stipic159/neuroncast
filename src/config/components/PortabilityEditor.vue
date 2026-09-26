<template>
	<div class="portability-editor">
		<section class="panel">
			<header class="panel-header">
				<h2>{{ $t("Setup & Portability") }}</h2>
				<p>{{ $t("Export your current configuration to a file, or import a previously saved setup. This includes all theme settings, player overrides, and layout presets.") }}</p>
			</header>

			<div class="action-grid">
				<article class="action-card">
					<h3>{{ $t("Export Configuration") }}</h3>
					<p>{{ $t("Download your entire setup (theme.json + layout-presets.json) as a single file. Useful for backups or moving to a different production PC.") }}</p>
					<button class="btn-primary" @click="exportSetup">{{ $t("Download Setup File") }}</button>
				</article>

				<article class="action-card">
					<h3>{{ $t("Import Configuration") }}</h3>
					<p>{{ $t("Restore settings from a previously exported file. Warning: This will overwrite your current settings and refresh all HUD scenes.") }}</p>
					<button class="btn-secondary" @click="triggerImport">{{ $t("Upload Setup File") }}</button>
					<input type="file" ref="importFile" style="display: none" accept=".json" @change="importSetup">
				</article>
			</div>
		</section>
	</div>
</template>

<script>
import { actions } from '/config/store.js'

export default {
	methods: {
		exportSetup() {
			window.location.href = '/config/export'
		},
		triggerImport() {
			this.$refs.importFile.click()
		},
		async importSetup(e) {
			const file = e.target.files[0]
			if (!file) return
			
			const reader = new FileReader()
			reader.onload = async (event) => {
				try {
					const data = JSON.parse(event.target.result)
					const res = await fetch('/config/import', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(data)
					})
					if (!res.ok) throw new Error('Import failed')
					actions.addAlert('Setup imported successfully! Reloading...', 'success')
					setTimeout(() => window.location.reload(), 1500)
				} catch (err) {
					actions.addAlert('Failed to import setup: ' + err.message, 'error')
				}
			}
			reader.readAsText(file)
		}
	}
}
</script>

<style scoped>
.portability-editor {
	max-width: 1000px;
}

.panel {
	background: #161b22;
	border: 1px solid #30363d;
	border-radius: 8px;
	padding: 24px;
}

.panel-header {
	margin-bottom: 32px;
}

.panel-header h2 {
	margin: 0 0 8px;
	font-size: 1.25rem;
	color: #fff;
}

.panel-header p {
	margin: 0;
	color: #8b949e;
	line-height: 1.5;
}

.action-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 20px;
}

.action-card {
	padding: 20px;
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 8px;
	display: flex;
	flex-direction: column;
}

.action-card h3 {
	margin: 0 0 10px;
	font-size: 1rem;
	color: #adbac7;
}

.action-card p {
	flex: 1;
	margin: 0 0 20px;
	font-size: 0.9rem;
	color: #8b949e;
	line-height: 1.4;
}

.btn-primary, .btn-secondary {
	padding: 12px;
	border-radius: 6px;
	font-weight: 600;
	cursor: pointer;
	border: 1px solid transparent;
	font: inherit;
}

.btn-primary {
	background: #1f6feb;
	color: #fff;
}

.btn-primary:hover { background: #388bfd; }

.btn-secondary {
	background: #21262d;
	border-color: #30363d;
	color: #c9d1d9;
}

.btn-secondary:hover { background: #30363d; }
</style>
