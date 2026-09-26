<template>
	<span :class="['eon-chip', `--${tone}`]">
		<span v-if="showDot" :class="['eon-chip-dot', { '--pulse': pulse }]"></span>
		<slot />
	</span>
</template>

<script>
export default {
	props: {
		tone: {
			type: String,
			default: 'neutral',
			validator: (v) => ['acc', 'red', 'amb', 'grn', 'blu', 'neutral'].includes(v),
		},
		pulse: { type: Boolean, default: false },
		dot:   { type: Boolean, default: true },
	},
	computed: {
		showDot() { return this.dot },
	},
}
</script>

<style scoped>
.eon-chip {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	padding: 2px 8px;
	border-radius: var(--eon-rad-chip);
	font-family: var(--eon-font-primary);
	font-size: var(--eon-fs-micro);
	font-weight: 700;
	letter-spacing: 0.4px;
	text-transform: uppercase;
	line-height: 1.3;
	white-space: nowrap;
}

.eon-chip.--acc     { background: var(--eon-accd);  color: var(--eon-accl); }
.eon-chip.--red     { background: var(--eon-redd);  color: var(--eon-red); }
.eon-chip.--amb     { background: var(--eon-ambd);  color: var(--eon-amb); }
.eon-chip.--grn     { background: var(--eon-grnd);  color: var(--eon-grn); }
.eon-chip.--blu     { background: var(--eon-blud);  color: var(--eon-blu); }
.eon-chip.--neutral { background: rgba(255, 255, 255, 0.04); color: var(--eon-tx2); }

.eon-chip-dot {
	display: inline-block;
	width: 5px;
	height: 5px;
	border-radius: 50%;
	background: currentColor;
	flex-shrink: 0;
}
.eon-chip-dot.--pulse {
	animation: eon-chip-pulse 2s infinite;
}

@keyframes eon-chip-pulse {
	0%, 100% { opacity: 1; }
	50%      { opacity: 0.3; }
}
</style>
