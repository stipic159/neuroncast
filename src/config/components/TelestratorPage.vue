<template>
	<div class="eon-telestrator">
		<div class="eon-tele-header">
			<h2>{{ $t("Analysis Board") }}</h2>
			<div class="eon-tele-tools">
				<div class="eon-tele-palette">
					<button
						v-for="c in colors"
						:key="c"
						:class="['eon-tele-swatch', { '--active': drawColor === c }]"
						:style="{ background: c }"
						@click="drawColor = c"
						:aria-label="`Use color ${c}`"
					></button>
				</div>
				<select v-model="drawSize" class="eon-select eon-tele-size">
					<option :value="2">{{ $t("Thin") }}</option>
					<option :value="5">{{ $t("Medium") }}</option>
					<option :value="10">{{ $t("Thick") }}</option>
					<option :value="20">{{ $t("Marker") }}</option>
				</select>
				<button class="eon-btn" data-variant="secondary" @click="clearCanvas">{{ $t("Clear") }}</button>
			</div>
		</div>

		<div class="eon-tele-canvas-wrap">
			<iframe
				src="/hud/?transparent"
				class="eon-tele-hud"
				:title="$t('HUD preview')"
				@load="hudLoaded = true"
			></iframe>
			<canvas
				ref="canvas"
				@mousedown="startDraw"
				@mousemove="draw"
				@mouseup="stopDraw"
				@mouseleave="stopDraw"
			></canvas>
			<div v-if="!hudLoaded" class="eon-tele-loading">
				<div class="eon-tele-spinner"></div>
				<div class="eon-tele-loading-text">{{ $t("Loading HUD preview…") }}</div>
				<div class="eon-tele-loading-sub">{{ $t("First load takes a moment — kept warm after that.") }}</div>
			</div>
		</div>

		<p class="eon-tele-note">
			{{ $t("Phase 24A placeholder. The full Telestrator redesign lands in Phase 24B. Drawing here broadcasts to the HUD over the existing draw:line / draw:clear channels.") }}
		</p>
	</div>
</template>

<script>
import { state, actions } from '/config/store.js'

export default {
	name: 'TelestratorPage',
	setup() {
		return { state, actions }
	},
	data() {
		return {
			drawColor: '#ff5a00',
			drawSize: 5,
			isDrawing: false,
			lastX: 0,
			lastY: 0,
			colors: ['#ff5a00', '#3498db', '#2ecc71', '#f1c40f', '#ffffff', '#e74c3c', '#9b59b6', '#000000'],
			hudLoaded: false,
		}
	},
	mounted() {
		this.resizeCanvas()
		window.addEventListener('resize', this.resizeCanvas)
	},
	activated() {
		this.resizeCanvas()
	},
	beforeUnmount() {
		window.removeEventListener('resize', this.resizeCanvas)
	},
	methods: {
		resizeCanvas() {
			const canvas = this.$refs.canvas
			if (!canvas) return
			const rect = canvas.getBoundingClientRect()
			canvas.width = rect.width
			canvas.height = rect.height
		},
		getPos(e) {
			const rect = this.$refs.canvas.getBoundingClientRect()
			return {
				x: (e.clientX - rect.left) / rect.width,
				y: (e.clientY - rect.top) / rect.height,
			}
		},
		startDraw(e) {
			this.isDrawing = true
			const pos = this.getPos(e)
			this.lastX = pos.x
			this.lastY = pos.y
		},
		draw(e) {
			if (!this.isDrawing) return
			const pos = this.getPos(e)
			const ctx = this.$refs.canvas.getContext('2d')
			const rect = this.$refs.canvas.getBoundingClientRect()
			ctx.beginPath()
			ctx.moveTo(this.lastX * rect.width, this.lastY * rect.height)
			ctx.lineTo(pos.x * rect.width, pos.y * rect.height)
			ctx.strokeStyle = this.drawColor
			ctx.lineWidth = this.drawSize
			ctx.lineCap = 'round'
			ctx.stroke()
			actions.broadcast('draw:line', {
				x1: this.lastX, y1: this.lastY,
				x2: pos.x, y2: pos.y,
				color: this.drawColor, size: this.drawSize,
			})
			this.lastX = pos.x
			this.lastY = pos.y
		},
		stopDraw() {
			this.isDrawing = false
		},
		clearCanvas() {
			const ctx = this.$refs.canvas.getContext('2d')
			ctx.clearRect(0, 0, this.$refs.canvas.width, this.$refs.canvas.height)
			actions.broadcast('draw:clear')
		},
	},
}
</script>

<style scoped>
.eon-telestrator {
	display: flex;
	flex-direction: column;
	gap: 12px;
	min-height: calc(100vh - 80px - var(--eon-pg-pad-y) * 2);
}

.eon-tele-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 14px;
	padding: 10px 14px;
	background: var(--eon-s2);
	border: 1px solid var(--eon-bd);
	border-radius: var(--eon-rad-card);
}

.eon-tele-header h2 {
	margin: 0;
	font-family: var(--eon-font-primary);
	font-size: var(--eon-fs-title);
	font-weight: 600;
	color: var(--eon-tx);
	letter-spacing: 0.2px;
}

.eon-tele-tools {
	display: flex;
	align-items: center;
	gap: 10px;
}

.eon-tele-palette {
	display: flex;
	gap: 6px;
}

.eon-tele-swatch {
	width: 18px;
	height: 18px;
	border-radius: var(--eon-rad-chip);
	border: 1px solid var(--eon-bd);
	cursor: pointer;
	padding: 0;
}
.eon-tele-swatch.--active {
	outline: 2px solid var(--eon-acc);
	outline-offset: 1px;
}

.eon-tele-size {
	padding: 4px 8px;
	font-size: var(--eon-fs-notes);
}

.eon-tele-canvas-wrap {
	position: relative;
	flex: 1;
	min-height: 420px;
	background: #000;
	border: 1px solid var(--eon-bd);
	border-radius: var(--eon-rad-card);
	overflow: hidden;
}

.eon-tele-hud {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	border: none;
	pointer-events: none;
}

.eon-tele-canvas-wrap canvas {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	cursor: crosshair;
}

.eon-tele-note {
	font-size: var(--eon-fs-notes);
	color: var(--eon-tx3);
	margin: 0;
}

.eon-tele-loading {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 12px;
	background: rgba(9, 9, 12, 0.78);
	color: var(--eon-tx);
	pointer-events: auto;
	z-index: 2;
}

.eon-tele-loading-text {
	font-family: var(--eon-font-primary);
	font-size: var(--eon-fs-title);
	font-weight: 600;
	color: var(--eon-tx);
}

.eon-tele-loading-sub {
	font-family: var(--eon-font-mono);
	font-size: var(--eon-fs-notes);
	color: var(--eon-tx3);
	max-width: 320px;
	text-align: center;
}

.eon-tele-spinner {
	width: 28px;
	height: 28px;
	border-radius: 50%;
	border: 2px solid var(--eon-bd);
	border-top-color: var(--eon-accl);
	animation: eon-tele-spin 0.8s linear infinite;
}

@keyframes eon-tele-spin {
	to { transform: rotate(360deg); }
}
</style>
