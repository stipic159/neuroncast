<template>
	<div class="packages-editor">

		<!-- Capture modal overlay -->
		<div v-if="captureMode" class="modal-backdrop" @click.self="closeCapture">
			<div class="modal-panel">
				<div class="modal-header">
					<h3>{{ $t("Capture Current Setup") }}</h3>
					<button class="modal-close" @click="closeCapture">✕</button>
				</div>
				<p class="section-desc">{{ $t("Snapshot the active broadcast configuration into a reusable package. Theme tokens and layout positions are stored as references, not copied.") }}</p>

				<div class="field-group">
					<label class="field-label">{{ $t("Package Name") }} <span class="required">*</span></label>
					<input v-model="captureData.name" type="text" class="field-input" :placeholder="$t(&quot;e.g. Komplettligaen Spring 2027&quot;)" autofocus>
				</div>

				<div class="field-group">
					<label class="field-label">{{ $t("Description") }}</label>
					<input v-model="captureData.description" type="text" class="field-input" :placeholder="$t(&quot;Optional operator note&quot;)">
				</div>

				<div class="section-divider">{{ $t("References") }}</div>
				<p class="field-hint" style="margin-bottom: 12px;">{{ $t("Select which saved preset this snapshot should reference. Leave blank to create a package without visual or layout refs.") }}</p>

				<div class="field-row-2">
					<div class="field-group">
						<label class="field-label">{{ $t("Theme") }}</label>
						<select v-model="captureData.themeId" class="field-select">
							<option value="">{{ $t("— none —") }}</option>
							<option v-for="t in themes" :key="t.id" :value="t.id">{{ t.name }}</option>
						</select>
					</div>
					<div class="field-group">
						<label class="field-label">{{ $t("Layout Preset") }}</label>
						<select v-model="captureData.layoutPresetId" class="field-select">
							<option value="">{{ $t("— none —") }}</option>
							<option v-for="l in layouts" :key="l.id" :value="l.id">{{ l.name }}</option>
						</select>
					</div>
				</div>

				<div class="section-divider">{{ $t("Include in Capture") }}</div>

				<div class="checkbox-group">
					<label class="checkbox-row">
						<input type="checkbox" v-model="captureData.includeSeries">
						<span class="checkbox-label">
							<strong>{{ $t("Series / Event Branding") }}</strong>
							<span class="checkbox-desc">{{ $t("Event name, subtitle, logo URL, map names") }}</span>
						</span>
					</label>
					<label class="checkbox-row">
						<input type="checkbox" v-model="captureData.includeSponsors">
						<span class="checkbox-label">
							<strong>{{ $t("Sponsors") }}</strong>
							<span class="checkbox-desc">{{ $t("Rotation interval, sponsor images, panel titles") }}</span>
						</span>
					</label>
					<label class="checkbox-row">
						<input type="checkbox" v-model="captureData.includePreferences">
						<span class="checkbox-label">
							<strong>{{ $t("Preferences") }}</strong>
							<span class="checkbox-desc">{{ $t("Highlight modes, graph settings, operator UX options") }}</span>
						</span>
					</label>
					<label class="checkbox-row">
						<input type="checkbox" v-model="captureData.includeCvars">
						<span class="checkbox-label">
							<strong>{{ $t("Game Format (cvars)") }}</strong>
							<span class="checkbox-desc">{{ $t("Max rounds, round time, overtime rules") }}</span>
						</span>
					</label>
				</div>

				<div v-if="captureError" class="error-banner">{{ $text(captureError) }}</div>

				<div class="form-actions">
					<button class="btn-secondary" @click="closeCapture">{{ $t("Cancel") }}</button>
					<button class="btn-primary" @click="submitCapture" :disabled="isCapturing || !captureData.name.trim()">
						{{ $text(isCapturing ? 'Capturing…' : 'Capture Package') }}
					</button>
				</div>
			</div>
		</div>

		<!-- Active Package Status -->
		<div class="card active-status-card" v-if="activeStatus !== null">
			<div class="card-header">
				<h3>{{ $t("Active Package") }}</h3>
				<button
					v-if="activeStatus.active"
					class="btn-sm --secondary"
					@click="clearActiveMarker"
					:disabled="isClearingActive"
				>{{ $text(isClearingActive ? 'Clearing…' : 'Clear active marker') }}</button>
			</div>

			<div v-if="!activeStatus.active" class="empty-state">{{ $t("No package is currently active.") }}</div>

			<div v-else class="active-status-body">
				<dl class="detail-grid">
					<div class="detail-row">
						<dt>{{ $t("Name") }}</dt>
						<dd>{{ activeStatus.state.activePackageName }}</dd>
					</div>
					<div class="detail-row">
						<dt>ID</dt>
						<dd class="mono">{{ activeStatus.state.activePackageId }}</dd>
					</div>
					<div class="detail-row" v-if="activeStatus.state.themeId">
						<dt>{{ $t("Theme") }}</dt>
						<dd><span class="ref-badge">{{ activeStatus.state.themeId }}</span></dd>
					</div>
					<div class="detail-row" v-if="activeStatus.state.layoutPresetId">
						<dt>{{ $t("Layout") }}</dt>
						<dd><span class="ref-badge">{{ activeStatus.state.layoutPresetId }}</span></dd>
					</div>
					<div class="detail-row">
						<dt>{{ $t("Applied") }}</dt>
						<dd class="muted">{{ formatDateTime(activeStatus.state.appliedAt) }}</dd>
					</div>
				</dl>

				<div v-if="activeStatus.warnings.length > 0" class="warnings-block">
					<div v-for="(w, i) in activeStatus.warnings" :key="w.code || i" class="warning-item">⚠ {{ $text(w.message || w) }}</div>
				</div>
			</div>
		</div>

		<div class="editor-grid">

			<!-- LEFT: package list -->
			<div class="left-column">
				<div class="card">
					<div class="card-header">
						<h3>{{ $t("Event Packages") }}</h3>
						<div class="header-btns">
							<button class="btn-sm --secondary" @click="openCapture" :title="$t(&quot;Snapshot current broadcast setup&quot;)">{{ $t("Capture") }}</button>
							<button class="btn-sm" @click="startCreate">{{ $t("+ New") }}</button>
						</div>
					</div>
					<p class="section-desc">{{ $t("Bundle a theme, layout preset, and branding into a single loadable event identity.") }}</p>

					<div v-if="packages.length === 0 && !loadingPackages" class="empty-state">
						{{ $t("No packages yet. Click") }} <strong>{{ $t("+ New") }}</strong> {{ $t("to create one.") }}
					</div>

					<div v-if="loadingPackages" class="empty-state">{{ $t("Loading…") }}</div>

					<div
						v-for="pkg in packages"
						:key="pkg.id"
						:class="['pkg-item', { '--active': selectedPackage?.id === pkg.id }]"
						@click="selectPackage(pkg)"
					>
						<div class="pkg-item-name">
							<span v-if="isActivePackage(pkg.id)" class="active-dot" :title="$t(&quot;Currently active&quot;)"></span>
							{{ pkg.name }}
						</div>
						<div class="pkg-item-meta">
							<span v-if="pkg.themeId" class="meta-ref">{{ pkg.themeId }}</span>
							<span v-if="pkg.themeId && pkg.layoutPresetId" class="meta-sep">·</span>
							<span v-if="pkg.layoutPresetId" class="meta-ref">{{ pkg.layoutPresetId }}</span>
							<span v-if="!pkg.themeId && !pkg.layoutPresetId" class="muted">{{ $t("No refs") }}</span>
						</div>
					</div>
				</div>

				<!-- Import -->
				<div class="card import-card" v-if="!editMode">
					<div class="card-header">
						<h3>{{ $t("Import") }}</h3>
					</div>
					<p class="section-desc">{{ $t("Load a") }} <code>.json</code> {{ $t("package file exported from NeuronCast.") }}</p>
					<button class="btn-secondary btn-block" @click="triggerImport">{{ $t("Choose file…") }}</button>
					<input ref="importInput" type="file" accept=".json" style="display:none" @change="onImportFile">
					<div v-if="importError" class="error-banner">{{ $text(importError) }}</div>
				</div>
			</div>

			<!-- RIGHT: detail or editor -->
			<div class="right-column">

				<!-- No selection -->
				<div v-if="!selectedPackage && !editMode" class="empty-panel">
					<div class="empty-panel-inner">
						<p>{{ $t("Select a package, or use") }} <strong>{{ $t("Capture") }}</strong> {{ $t("to snapshot the current broadcast setup.") }}</p>
					</div>
				</div>

				<!-- Editor form -->
				<div v-else-if="editMode" class="card">
					<div class="card-header">
						<h3>{{ $text(isCreating ? 'New Package' : 'Edit Package') }}</h3>
					</div>

					<div class="field-group">
						<label class="field-label">{{ $t("Name") }} <span class="required">*</span></label>
						<input v-model="editData.name" type="text" class="field-input" :placeholder="$t(&quot;e.g. Komplettligaen Spring 2027&quot;)" autofocus>
					</div>

					<div class="field-group">
						<label class="field-label">{{ $t("Description") }}</label>
						<input v-model="editData.description" type="text" class="field-input" :placeholder="$t(&quot;Optional operator note&quot;)">
					</div>

					<div class="section-divider">{{ $t("Branding") }}</div>

					<div class="field-group">
						<label class="field-label">{{ $t("Title") }}</label>
						<input v-model="editData.branding.title" type="text" class="field-input" :placeholder="$t(&quot;Event name shown in HUD badge&quot;)">
					</div>

					<div class="field-group">
						<label class="field-label">{{ $t("Subtitle") }}</label>
						<input v-model="editData.branding.subtitle" type="text" class="field-input" :placeholder="$t(&quot;Season, date, or stage&quot;)">
					</div>

					<div class="field-group">
						<label class="field-label">{{ $t("Logo URL") }}</label>
						<input v-model="editData.branding.logoUrl" type="text" class="field-input" placeholder="/hud/upload-xxx.png">
						<p class="field-hint">{{ $t("Must start with") }} <code>/hud/</code></p>
					</div>

					<div class="section-divider">{{ $t("References") }}</div>

					<div class="field-row-2">
						<div class="field-group">
							<label class="field-label">{{ $t("Theme") }}</label>
							<select v-model="editData.themeId" class="field-select">
								<option value="">{{ $t("— none —") }}</option>
								<option v-for="t in themes" :key="t.id" :value="t.id">{{ t.name }}</option>
							</select>
						</div>
						<div class="field-group">
							<label class="field-label">{{ $t("Layout Preset") }}</label>
							<select v-model="editData.layoutPresetId" class="field-select">
								<option value="">{{ $t("— none —") }}</option>
								<option v-for="l in layouts" :key="l.id" :value="l.id">{{ l.name }}</option>
							</select>
						</div>
					</div>

					<div class="section-divider">{{ $t("Sponsors") }}</div>

					<div class="field-row-2">
						<div class="field-group">
							<label class="field-label">{{ $t("Rotation interval (ms)") }}</label>
							<input v-model.number="editData.sponsors.rotationInterval" type="number" min="500" step="500" class="field-input" :placeholder="$t(&quot;e.g. 8000&quot;)">
						</div>
						<div class="field-group">
							<label class="field-label">{{ $t("Panel title") }}</label>
							<input v-model="editData.sponsors.title" type="text" class="field-input" :placeholder="$t(&quot;Official Partners&quot;)">
						</div>
					</div>

					<div v-if="formError" class="error-banner">{{ $text(formError) }}</div>

					<div class="form-actions">
						<button class="btn-secondary" @click="cancelEdit">{{ $t("Cancel") }}</button>
						<button class="btn-primary" @click="saveForm" :disabled="isSaving">
							{{ $text(isSaving ? 'Saving…' : 'Save Package') }}
						</button>
					</div>
				</div>

				<!-- Detail view -->
				<div v-else-if="selectedPackage" class="card">
					<div class="card-header">
						<h3>{{ selectedPackage.name }}</h3>
						<button class="btn-sm --secondary" @click="startEdit">{{ $t("Edit") }}</button>
					</div>

					<p v-if="selectedPackage.description" class="detail-description">{{ selectedPackage.description }}</p>

					<dl class="detail-grid">
						<div class="detail-row">
							<dt>{{ $t("Theme") }}</dt>
							<dd>
								<span v-if="selectedPackage.themeId" class="ref-badge">{{ selectedPackage.themeId }}</span>
								<span v-else class="muted">—</span>
							</dd>
						</div>
						<div class="detail-row">
							<dt>{{ $t("Layout") }}</dt>
							<dd>
								<span v-if="selectedPackage.layoutPresetId" class="ref-badge">{{ selectedPackage.layoutPresetId }}</span>
								<span v-else class="muted">—</span>
							</dd>
						</div>
						<div class="detail-row" v-if="selectedPackage.branding?.title || selectedPackage.branding?.subtitle">
							<dt>{{ $t("Branding") }}</dt>
							<dd>
								{{ selectedPackage.branding.title }}
								<span v-if="selectedPackage.branding.title && selectedPackage.branding.subtitle" class="muted"> · </span>
								{{ selectedPackage.branding.subtitle }}
							</dd>
						</div>
						<div class="detail-row" v-if="selectedPackage.branding?.logoUrl">
							<dt>{{ $t("Logo") }}</dt>
							<dd class="mono">{{ selectedPackage.branding.logoUrl }}</dd>
						</div>
						<div class="detail-row" v-if="selectedPackage.sponsors?.rotationInterval">
							<dt>{{ $t("Rotation") }}</dt>
							<dd>{{ selectedPackage.sponsors.rotationInterval }} {{ $t("ms") }}</dd>
						</div>
						<div class="detail-row" v-if="selectedPackage.sponsors?.title">
							<dt>{{ $t("Sponsor title") }}</dt>
							<dd>{{ selectedPackage.sponsors.title }}</dd>
						</div>
						<div class="detail-row">
							<dt>{{ $t("Updated") }}</dt>
							<dd class="muted">{{ formatDate(selectedPackage.updatedAt) }}</dd>
						</div>
					</dl>

					<div v-if="applyWarnings.length > 0" class="warnings-block">
						<div v-for="w in applyWarnings" :key="w" class="warning-item">⚠ {{ $text(w) }}</div>
					</div>

					<div v-if="statusMessage" :class="['status-banner', `--${statusType}`]">
						{{ $text(statusMessage) }}
					</div>

					<div class="detail-actions">
						<button class="btn-primary" @click="applySelectedPackage" :disabled="isApplying">
							{{ $text(isApplying ? 'Applying…' : 'Apply') }}
						</button>
						<button class="btn-secondary" @click="duplicateSelectedPackage">{{ $t("Duplicate") }}</button>
						<button class="btn-secondary" @click="exportSelectedPackage">{{ $t("Export JSON") }}</button>
						<button class="btn-danger" @click="deleteSelectedPackage">{{ $t("Delete") }}</button>
					</div>
				</div>

			</div>
		</div>
		<!-- /editor-grid -->
	</div>
</template>

<script>
import { text as translateText, state as languageState } from '/config/i18n.js'

export default {
	data() {
		return {
			packages: [],
			themes: [],
			layouts: [],
			loadingPackages: true,
			selectedPackage: null,
			editMode: false,
			isCreating: false,
			editData: this.emptyEditData(),
			isSaving: false,
			isApplying: false,
			formError: null,
			statusMessage: null,
			statusType: 'success',
			applyWarnings: [],
			importError: null,
			captureMode: false,
			captureData: this.emptyCaptureData(),
			captureError: null,
			isCapturing: false,
			activeStatus: null,
			isClearingActive: false,
		}
	},
	mounted() {
		this.fetchAll()
	},
	methods: {
		emptyCaptureData() {
			return {
				name: '',
				description: '',
				themeId: '',
				layoutPresetId: '',
				includeSeries: true,
				includeSponsors: true,
				includePreferences: false,
				includeCvars: false,
			}
		},

		emptyEditData() {
			return {
				name: '',
				description: '',
				branding: { title: '', subtitle: '', logoUrl: '' },
				themeId: '',
				layoutPresetId: '',
				sponsors: { rotationInterval: null, title: '' },
				options: {},
			}
		},

		async fetchAll() {
			this.loadingPackages = true
			await Promise.all([this.fetchPackages(), this.fetchThemes(), this.fetchLayouts(), this.fetchActiveStatus()])
			this.loadingPackages = false
		},

		async fetchPackages() {
			try {
				const res = await fetch('/config/event-packages')
				this.packages = await res.json()
			} catch (err) {
				console.error('[PackagesEditor] Failed to load packages:', err)
			}
		},

		async fetchThemes() {
			try {
				const res = await fetch('/config/event-themes')
				this.themes = await res.json()
			} catch (err) {
				console.error('[PackagesEditor] Failed to load themes:', err)
			}
		},

		async fetchLayouts() {
			try {
				const res = await fetch('/config/layout-presets')
				this.layouts = await res.json()
			} catch (err) {
				console.error('[PackagesEditor] Failed to load layout presets:', err)
			}
		},

		async fetchActiveStatus() {
			try {
				const res = await fetch('/config/event-packages/active')
				this.activeStatus = await res.json()
			} catch (err) {
				console.error('[PackagesEditor] Failed to load active status:', err)
			}
		},

		async clearActiveMarker() {
			this.isClearingActive = true
			try {
				await fetch('/config/event-packages/active', { method: 'DELETE' })
				this.activeStatus = { active: false, state: null, package: null, warnings: [] }
			} catch (err) {
				console.error('[PackagesEditor] Failed to clear active marker:', err)
			} finally {
				this.isClearingActive = false
			}
		},

		isActivePackage(id) {
			return this.activeStatus?.active && this.activeStatus?.state?.activePackageId === id
		},

		selectPackage(pkg) {
			this.selectedPackage = pkg
			this.editMode = false
			this.statusMessage = null
			this.applyWarnings = []
			this.formError = null
		},

		startCreate() {
			this.selectedPackage = null
			this.editData = this.emptyEditData()
			this.editMode = true
			this.isCreating = true
			this.formError = null
			this.statusMessage = null
		},

		startEdit() {
			const p = this.selectedPackage
			this.editData = {
				name: p.name || '',
				description: p.description || '',
				branding: {
					title: p.branding?.title || '',
					subtitle: p.branding?.subtitle || '',
					logoUrl: p.branding?.logoUrl || '',
				},
				themeId: p.themeId || '',
				layoutPresetId: p.layoutPresetId || '',
				sponsors: {
					rotationInterval: p.sponsors?.rotationInterval ?? null,
					title: p.sponsors?.title || '',
				},
				options: p.options ? { ...p.options } : {},
			}
			this.editMode = true
			this.isCreating = false
			this.formError = null
		},

		cancelEdit() {
			this.editMode = false
			this.formError = null
			if (this.isCreating) this.selectedPackage = null
		},

		async saveForm() {
			this.isSaving = true
			this.formError = null
			try {
				const body = {
					name: this.editData.name,
					description: this.editData.description,
					branding: { ...this.editData.branding },
					themeId: this.editData.themeId,
					layoutPresetId: this.editData.layoutPresetId,
					sponsors: {
						...(this.editData.sponsors.rotationInterval ? { rotationInterval: this.editData.sponsors.rotationInterval } : {}),
						...(this.editData.sponsors.title ? { title: this.editData.sponsors.title } : {}),
					},
					options: this.editData.options,
				}

				let res, data
				if (this.isCreating) {
					res = await fetch('/config/event-packages', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(body),
					})
				} else {
					res = await fetch(`/config/event-packages/${this.selectedPackage.id}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(body),
					})
				}

				data = await res.json()

				if (!res.ok) {
					this.formError = data.message || 'Save failed.'
					return
				}

				await this.fetchPackages()
				this.selectedPackage = data
				this.editMode = false
				this.statusMessage = 'Package saved.'
				this.statusType = 'success'
			} catch (err) {
				this.formError = err.message
			} finally {
				this.isSaving = false
			}
		},

		async applySelectedPackage() {
			this.isApplying = true
			this.statusMessage = null
			this.applyWarnings = []
			try {
				const res = await fetch(`/config/event-packages/${this.selectedPackage.id}/apply`, { method: 'POST' })
				const data = await res.json()
				if (!res.ok) {
					this.statusMessage = data.message || 'Apply failed.'
					this.statusType = 'error'
					return
				}
				this.applyWarnings = data.warnings || []
				this.statusMessage = 'Package applied.'
				this.statusType = 'success'
				await this.fetchActiveStatus()
			} catch (err) {
				this.statusMessage = err.message
				this.statusType = 'error'
			} finally {
				this.isApplying = false
			}
		},

		async duplicateSelectedPackage() {
			const p = this.selectedPackage
			const body = {
				name: p.name + ' (copy)',
				description: p.description || '',
				branding: { ...p.branding },
				themeId: p.themeId || '',
				layoutPresetId: p.layoutPresetId || '',
				sponsors: { ...p.sponsors },
				options: { ...p.options },
				// No id — server generates a fresh slug
			}
			try {
				const res = await fetch('/config/event-packages', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				})
				const data = await res.json()
				if (!res.ok) {
					this.statusMessage = data.message || 'Duplicate failed.'
					this.statusType = 'error'
					return
				}
				await this.fetchPackages()
				this.selectedPackage = data
				this.statusMessage = `Duplicated as "${data.name}".`
				this.statusType = 'success'
			} catch (err) {
				this.statusMessage = err.message
				this.statusType = 'error'
			}
		},

		exportSelectedPackage() {
			const blob = new Blob([JSON.stringify(this.selectedPackage, null, 2)], { type: 'application/json' })
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `${this.selectedPackage.id}.json`
			a.click()
			URL.revokeObjectURL(url)
		},

		async deleteSelectedPackage() {
			if (!confirm(translateText(`Delete "${this.selectedPackage.name}"?\n\nThis cannot be undone.`))) return
			try {
				const res = await fetch(`/config/event-packages/${this.selectedPackage.id}`, { method: 'DELETE' })
				if (!res.ok && res.status !== 404) {
					const data = await res.json()
					this.statusMessage = data.message || 'Delete failed.'
					this.statusType = 'error'
					return
				}
				this.selectedPackage = null
				await this.fetchPackages()
			} catch (err) {
				this.statusMessage = err.message
				this.statusType = 'error'
			}
		},

		triggerImport() {
			this.importError = null
			this.$refs.importInput.click()
		},

		async onImportFile(e) {
			const file = e.target.files[0]
			if (!file) return
			this.importError = null
			try {
				const text = await file.text()
				const body = JSON.parse(text)
				const res = await fetch('/config/event-packages', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				})
				const data = await res.json()
				if (!res.ok) {
					if (res.status === 409) {
						this.importError = `ID collision: a package with id "${data.id}" already exists. Delete it first, or edit the JSON to use a different id.`
					} else {
						this.importError = data.message || 'Import failed.'
					}
					return
				}
				await this.fetchPackages()
				this.selectedPackage = data
				this.statusMessage = 'Package imported.'
				this.statusType = 'success'
			} catch (err) {
				this.importError = 'Failed to parse or import package: ' + err.message
			} finally {
				e.target.value = ''
			}
		},

		openCapture() {
			this.captureData = this.emptyCaptureData()
			this.captureError = null
			this.captureMode = true
		},

		closeCapture() {
			this.captureMode = false
			this.captureError = null
		},

		async submitCapture() {
			this.isCapturing = true
			this.captureError = null
			try {
				const res = await fetch('/config/event-packages/capture-current', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(this.captureData),
				})
				const data = await res.json()
				if (!res.ok) {
					if (res.status === 409) {
						this.captureError = `A package named "${this.captureData.name}" already exists. Choose a different name.`
					} else {
						this.captureError = data.message || 'Capture failed.'
					}
					return
				}
				this.captureMode = false
				await this.fetchPackages()
				this.selectedPackage = data.package
				this.editMode = false
				this.applyWarnings = data.warnings || []
				this.statusMessage = 'Package captured.'
				this.statusType = 'success'
			} catch (err) {
				this.captureError = err.message
			} finally {
				this.isCapturing = false
			}
		},

		formatDate(iso) {
			if (!iso) return '—'
			try {
				return new Date(iso).toLocaleDateString(languageState.locale, { year: 'numeric', month: 'short', day: 'numeric' })
			} catch {
				return iso
			}
		},

		formatDateTime(iso) {
			if (!iso) return '—'
			try {
				return new Date(iso).toLocaleString(languageState.locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
			} catch {
				return iso
			}
		},
	},
}
</script>

<style scoped>
.packages-editor {
	max-width: 1200px;
	position: relative;
}

/* ── Modal overlay ── */
.modal-backdrop {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.7);
	backdrop-filter: blur(2px);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1000;
}

.modal-panel {
	background: #1a1d23;
	border: 1px solid #3d444d;
	border-radius: 14px;
	padding: 28px;
	width: 560px;
	max-width: calc(100vw - 48px);
	max-height: calc(100vh - 80px);
	overflow-y: auto;
	box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}

.modal-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12px;
	border-bottom: 1px solid #2d333b;
	padding-bottom: 12px;
}

.modal-header h3 {
	font-size: 1.05rem;
	font-weight: 600;
	color: #fff;
	margin: 0;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.modal-close {
	background: none;
	border: none;
	color: #8b949e;
	font-size: 1rem;
	cursor: pointer;
	padding: 4px 8px;
	border-radius: 4px;
	line-height: 1;
	transition: color 0.15s;
}

.modal-close:hover { color: #fff; background: #2d333b; }

/* ── Checkboxes ── */
.checkbox-group {
	display: flex;
	flex-direction: column;
	gap: 10px;
	margin-bottom: 4px;
}

.checkbox-row {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	cursor: pointer;
	padding: 8px 10px;
	border-radius: 6px;
	border: 1px solid #2d333b;
	background: #0d1117;
	transition: border-color 0.15s;
}

.checkbox-row:hover { border-color: #58a6ff; }

.checkbox-row input[type="checkbox"] {
	width: 15px;
	height: 15px;
	margin-top: 2px;
	flex-shrink: 0;
	accent-color: #1f6feb;
	cursor: pointer;
}

.checkbox-label {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.checkbox-label strong {
	font-size: 0.875rem;
	color: #e6edf3;
	font-weight: 600;
}

.checkbox-desc {
	font-size: 0.75rem;
	color: #8b949e;
	line-height: 1.3;
}

/* ── Header button group ── */
.header-btns {
	display: flex;
	gap: 6px;
	align-items: center;
}

.editor-grid {
	display: grid;
	grid-template-columns: 300px 1fr;
	gap: 20px;
	align-items: start;
}

/* ── Cards ── */
.card {
	background: #1a1d23;
	border: 1px solid #2d333b;
	border-radius: 12px;
	padding: 24px;
	margin-bottom: 16px;
}

.card-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16px;
	border-bottom: 1px solid #2d333b;
	padding-bottom: 12px;
}

.card-header h3 {
	font-size: 1.05rem;
	font-weight: 600;
	color: #fff;
	margin: 0;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.section-desc {
	font-size: 0.8rem;
	color: #8b949e;
	margin: 0 0 16px 0;
	line-height: 1.4;
}

/* ── Package list items ── */
.pkg-item {
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 6px;
	padding: 10px 12px;
	margin-bottom: 8px;
	cursor: pointer;
	transition: all 0.15s ease;
}

.pkg-item:hover {
	border-color: #58a6ff;
	background: #161b22;
}

.pkg-item.--active {
	border-color: #1f6feb;
	background: rgba(31, 111, 235, 0.1);
}

.pkg-item-name {
	font-size: 0.9rem;
	font-weight: 600;
	color: #e6edf3;
	margin-bottom: 4px;
}

.pkg-item-meta {
	font-size: 0.75rem;
	color: #8b949e;
	display: flex;
	align-items: center;
	gap: 4px;
	flex-wrap: wrap;
}

.meta-ref {
	background: #2d333b;
	border-radius: 3px;
	padding: 1px 5px;
	font-family: monospace;
	font-size: 0.7rem;
	color: #8b949e;
}

.meta-sep { color: #444; }

/* ── Empty states ── */
.empty-state {
	font-size: 0.85rem;
	color: #8b949e;
	padding: 12px 0;
}

.empty-panel {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 200px;
}

.empty-panel-inner {
	text-align: center;
	color: #8b949e;
	font-size: 0.9rem;
}

/* ── Form fields ── */
.field-group {
	margin-bottom: 16px;
}

.field-label {
	display: block;
	font-size: 0.8rem;
	font-weight: 600;
	color: #8b949e;
	margin-bottom: 6px;
	text-transform: uppercase;
	letter-spacing: 0.04em;
}

.required {
	color: #f85149;
}

.field-input,
.field-select {
	width: 100%;
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 6px;
	color: #e6edf3;
	font-size: 0.9rem;
	padding: 8px 10px;
	box-sizing: border-box;
	transition: border-color 0.15s;
}

.field-input:focus,
.field-select:focus {
	outline: none;
	border-color: #58a6ff;
}

.field-select {
	cursor: pointer;
}

.field-hint {
	font-size: 0.75rem;
	color: #8b949e;
	margin: 4px 0 0 0;
}

.field-hint code {
	background: #161b22;
	padding: 1px 4px;
	border-radius: 3px;
	font-size: 0.72rem;
}

.field-row-2 {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px;
}

.section-divider {
	font-size: 0.75rem;
	text-transform: uppercase;
	color: #8b949e;
	font-weight: 600;
	letter-spacing: 0.05em;
	border-bottom: 1px solid #2d333b;
	padding-bottom: 8px;
	margin: 20px 0 16px;
}

/* ── Detail view ── */
.detail-description {
	font-size: 0.85rem;
	color: #8b949e;
	margin: 0 0 20px 0;
}

.detail-grid {
	margin: 0 0 20px 0;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.detail-row {
	display: grid;
	grid-template-columns: 110px 1fr;
	gap: 8px;
	align-items: baseline;
	font-size: 0.875rem;
}

.detail-row dt {
	color: #8b949e;
	font-weight: 600;
	font-size: 0.75rem;
	text-transform: uppercase;
	letter-spacing: 0.04em;
}

.detail-row dd {
	color: #e6edf3;
	margin: 0;
}

.ref-badge {
	background: #2d333b;
	border-radius: 4px;
	padding: 2px 8px;
	font-family: monospace;
	font-size: 0.78rem;
	color: #58a6ff;
	border: 1px solid #3d444d;
}

.mono {
	font-family: monospace;
	font-size: 0.8rem;
	color: #8b949e;
}

/* ── Warnings ── */
.warnings-block {
	background: rgba(210, 153, 34, 0.08);
	border: 1px solid rgba(210, 153, 34, 0.3);
	border-radius: 6px;
	padding: 10px 14px;
	margin-bottom: 16px;
}

.warning-item {
	font-size: 0.82rem;
	color: #d29922;
	line-height: 1.5;
}

/* ── Status / Error banners ── */
.status-banner {
	border-radius: 6px;
	padding: 10px 14px;
	font-size: 0.85rem;
	margin-bottom: 16px;
}

.status-banner.--success {
	background: rgba(56, 148, 107, 0.12);
	border: 1px solid rgba(56, 148, 107, 0.3);
	color: #3fb950;
}

.status-banner.--error {
	background: rgba(248, 81, 73, 0.1);
	border: 1px solid rgba(248, 81, 73, 0.3);
	color: #f85149;
}

.error-banner {
	background: rgba(248, 81, 73, 0.1);
	border: 1px solid rgba(248, 81, 73, 0.3);
	border-radius: 6px;
	padding: 10px 14px;
	font-size: 0.82rem;
	color: #f85149;
	margin-top: 12px;
}

/* ── Action buttons ── */
.detail-actions {
	display: flex;
	gap: 10px;
	flex-wrap: wrap;
}

.form-actions {
	display: flex;
	gap: 10px;
	justify-content: flex-end;
	margin-top: 24px;
	border-top: 1px solid #2d333b;
	padding-top: 20px;
}

.btn-primary {
	background: #1f6feb;
	color: #fff;
	border: 1px solid transparent;
	padding: 9px 18px;
	border-radius: 6px;
	font-size: 0.875rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.15s;
}

.btn-primary:hover:not(:disabled) { background: #388bfd; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
	background: #2d333b;
	color: #e6edf3;
	border: 1px solid #3d444d;
	padding: 9px 18px;
	border-radius: 6px;
	font-size: 0.875rem;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.15s;
}

.btn-secondary:hover:not(:disabled) { background: #3e444d; border-color: #58a6ff; }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-danger {
	background: rgba(248, 81, 73, 0.1);
	color: #f85149;
	border: 1px solid rgba(248, 81, 73, 0.3);
	padding: 9px 18px;
	border-radius: 6px;
	font-size: 0.875rem;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.15s;
}

.btn-danger:hover { background: #da3633; color: #fff; border-color: transparent; }

.btn-block {
	width: 100%;
}

.btn-sm {
	background: #1f6feb;
	color: #fff;
	border: none;
	padding: 5px 12px;
	border-radius: 5px;
	font-size: 0.8rem;
	font-weight: 600;
	cursor: pointer;
	transition: background 0.15s;
}

.btn-sm:hover { background: #388bfd; }

.btn-sm.--secondary {
	background: #2d333b;
	color: #e6edf3;
	border: 1px solid #3d444d;
}

.btn-sm.--secondary:hover { background: #3e444d; }

.import-card {
	margin-top: 0;
}

.muted {
	color: #8b949e;
}

code {
	background: #161b22;
	border: 1px solid #2d333b;
	border-radius: 3px;
	padding: 1px 5px;
	font-size: 0.8em;
	color: #58a6ff;
}

/* ── Active Package status card ── */
.active-status-card {
	margin-bottom: 20px;
}

.active-status-body .detail-grid {
	margin-bottom: 0;
}

/* ── Green dot for active package in list ── */
.active-dot {
	display: inline-block;
	width: 8px;
	height: 8px;
	background: #3fb950;
	border-radius: 50%;
	margin-right: 6px;
	vertical-align: middle;
	flex-shrink: 0;
	box-shadow: 0 0 4px rgba(63, 185, 80, 0.5);
}
</style>
