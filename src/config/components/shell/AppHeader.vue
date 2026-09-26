<template>
	<header class="eon-header">
		<div class="eon-header-brand">
			<svg class="eon-header-logo" viewBox="0 0 16 16" fill="none" aria-hidden="true">
				<path d="M4 2.5L12 2.5L14 8L8 14L2 8L4 2.5Z" fill="currentColor" opacity=".25"/>
				<path d="M6 4L10 4L12 8L8 12.5L4 8L6 4Z" fill="currentColor"/>
			</svg>
			<span class="eon-header-wordmark">NeuronCast</span>
		</div>
		<div class="eon-header-divider"></div>
		<h1 class="eon-header-title">{{ pageTitle }}</h1>

		<div class="eon-header-actions">
			<select class="eon-language" data-testid="language-select" :aria-label="$t('Language')" :value="$locale" @change="$setLocale($event.target.value)">
				<option value="en" lang="en">English</option>
				<option value="ru" lang="ru">Русский</option>
			</select>
			<span :class="['eon-header-save', `--${state.saveState}`]">{{ $text(saveMessage) }}</span>
			<button class="eon-btn" data-variant="secondary" @click="actions.forceRefresh()">
				{{ $t("Force HUD Refresh") }}
			</button>
			<button class="eon-btn" data-variant="primary" @click="actions.save()">
				{{ $t("Save All Changes") }}
			</button>
		</div>
	</header>
</template>

<script>
import { state, actions } from '/config/store.js'

export default {
	props: {
		pageTitle: { type: String, required: true },
	},
	setup() {
		return { state, actions }
	},
	computed: {
		saveMessage() {
			switch (this.state.saveState) {
				case 'saving': return 'Saving…'
				case 'saved':  return 'Saved'
				case 'error':  return 'Save failed'
				default:       return ''
			}
		},
	},
}
</script>

<style scoped>
.eon-header {
	grid-column: 1 / -1;
	grid-row: 1;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 0 18px;
	background: var(--eon-s1);
	border-bottom: 1px solid var(--eon-bd);
	height: 48px;
	z-index: 10;
}

.eon-header-brand {
	display: flex;
	align-items: center;
	gap: 8px;
}

.eon-header-logo {
	width: 18px;
	height: 18px;
	color: var(--eon-accl);
}

.eon-header-wordmark {
	font-family: var(--eon-font-primary);
	font-weight: 700;
	font-size: var(--eon-fs-body2);
	letter-spacing: 0.4px;
	color: var(--eon-tx);
}

.eon-header-divider {
	width: 1px;
	height: 18px;
	background: var(--eon-bd);
}

.eon-header-title {
	min-width: 0;
	font-family: var(--eon-font-primary);
	font-size: var(--eon-fs-h1);
	font-weight: 700;
	color: var(--eon-tx);
	margin: 0;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	line-height: 1.2;
}

.eon-header-actions {
	flex-shrink: 0;
	margin-left: auto;
	display: flex;
	align-items: center;
	gap: 10px;
}

.eon-header-save {
	font-family: var(--eon-font-mono);
	font-size: var(--eon-fs-status);
	color: var(--eon-tx3);
	min-width: 0;
	white-space: nowrap;
	opacity: 0;
	transition: opacity 0.2s, color 0.2s;
}
.eon-header-save.--saving { color: var(--eon-amb); opacity: 1; }
.eon-header-save.--saved  { color: var(--eon-grn); opacity: 1; }
.eon-header-save.--error  { color: var(--eon-red); opacity: 1; }
.eon-language {
	color: var(--eon-tx);
	background: var(--eon-s2);
	border: 1px solid var(--eon-bd);
	border-radius: 6px;
	font: inherit;
	padding: 5px 8px;
	max-width: 110px;
}
.eon-language:focus-visible { outline: 2px solid var(--eon-accl); outline-offset: 2px; }
@media (max-width: 1050px) {
	.eon-header { gap: 6px; padding: 0 10px; }
	.eon-header-actions { gap: 6px; }
	.eon-header-brand, .eon-header-divider, .eon-header-save { display: none; }
}
</style>
