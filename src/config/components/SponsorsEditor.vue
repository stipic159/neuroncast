<template>
	<div class="setup-page">
		<section class="panel">
			<header class="panel-header">
				<h2>{{ $t("Sponsor Rotation") }}</h2>
				<p>{{ $t("Add one or more images per side. Multiple images rotate using the interval below.") }}</p>
			</header>

			<label class="interval-field">
				<span>{{ $t("Rotation interval in milliseconds") }}</span>
				<input v-model.number="state.options['sponsors.rotationInterval']" type="number" min="1000" step="500">
			</label>
		</section>

		<section class="slot-grid">
			<div v-for="slot in slots" :key="slot" class="panel">
				<header class="panel-header">
					<h2>{{ $text(slot === 'left' ? 'Left Sponsor' : 'Right Sponsor') }}</h2>
				</header>

				<label>
					<span>{{ $t("Label") }}</span>
					<input v-model="state.options[`sponsors.${slot}.title`]" type="text" :placeholder="$t('Sponsor label')">
				</label>

				<div class="image-list">
					<div v-for="(image, index) in images[slot]" :key="index" class="image-row">
						<input v-model="images[slot][index]" type="text" placeholder="/hud/logo.png or https://...">
						<button class="btn-secondary" @click="triggerUpload(slot, index)">{{ $t("Upload") }}</button>
						<button class="btn-remove" @click="removeImage(slot, index)">{{ $t("Remove") }}</button>
						<input :ref="`upload-${slot}-${index}`" type="file" accept="image/*" hidden @change="onFileSelected($event, slot, index)">
					</div>
				</div>

				<button class="btn-secondary" @click="addImage(slot)">{{ $t("Add image") }}</button>
			</div>
		</section>

		<div class="actions">
			<button class="btn-primary" @click="saveSponsors">{{ $t("Save sponsor setup") }}</button>
		</div>
	</div>
</template>

<script>
import { state, actions } from '/config/store.js'

export default {
	setup() { return { state, actions } },
	data() {
		return {
			slots: ['left', 'right'],
			images: { left: [], right: [] },
		}
	},
	mounted() {
		for (const slot of this.slots) {
			this.images[slot] = this.parseImages(state.options[`sponsors.${slot}.imageUrl`])
		}
	},
	methods: {
		parseImages(value) {
			const images = String(value || '').split(',').map((item) => item.trim()).filter(Boolean)
			return images.length ? images : ['']
		},
		addImage(slot) {
			this.images[slot].push('')
		},
		removeImage(slot, index) {
			this.images[slot].splice(index, 1)
			if (!this.images[slot].length) this.images[slot].push('')
		},
		triggerUpload(slot, index) {
			this.$refs[`upload-${slot}-${index}`][0].click()
		},
		async onFileSelected(event, slot, index) {
			const file = event.target.files[0]
			if (!file) return
			const reader = new FileReader()
			reader.onload = async (e) => {
				const res = await fetch('/config/upload-image', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ filename: file.name, base64: e.target.result }),
				})
				const json = await res.json()
				if (json.url) {
					this.images[slot][index] = json.url
					this.saveSponsors()
				}
			}
			reader.readAsDataURL(file)
		},
		saveSponsors() {
			const partial = { 'sponsors.rotationInterval': state.options['sponsors.rotationInterval'] }
			for (const slot of this.slots) {
				const imageKey = `sponsors.${slot}.imageUrl`
				const titleKey = `sponsors.${slot}.title`
				partial[imageKey] = this.images[slot].map((image) => image.trim()).filter(Boolean).join(', ')
				partial[titleKey] = state.options[titleKey] || null
				state.options[imageKey] = partial[imageKey]
				actions.broadcast(imageKey, partial[imageKey])
				actions.broadcast(titleKey, partial[titleKey])
			}
			actions.broadcast('sponsors.rotationInterval', partial['sponsors.rotationInterval'])
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
.slot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
label span { display: block; margin-bottom: 6px; color: #adbac7; font-size: 0.85rem; font-weight: 600; }
input { width: 100%; box-sizing: border-box; padding: 8px 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #c9d1d9; font: inherit; }
.interval-field { max-width: 320px; display: block; }
.image-list { display: flex; flex-direction: column; gap: 8px; margin: 14px 0; }
.image-row { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; }
.btn-primary, .btn-secondary, .btn-remove { border: 1px solid #30363d; border-radius: 6px; padding: 8px 12px; color: #fff; background: #21262d; cursor: pointer; font: inherit; white-space: nowrap; }
.btn-primary { background: #1f6feb; border-color: #1f6feb; }
.btn-remove { background: #2d1f23; border-color: #5a2933; color: #ffb3bd; }
.actions { display: flex; gap: 12px; }
</style>
