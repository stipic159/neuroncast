<template>
	<div class="eon-app-grid">
		<AppHeader :page-title="pageTitle" />
		<BroadcastStatusBar />
		<AppSidebar />
		<main class="eon-main">
			<div class="eon-main-inner">
				<keep-alive :include="['TelestratorPage']">
					<component :is="activeComponent" v-if="activeComponent" />
				</keep-alive>
				<div v-if="!activeComponent" class="eon-missing">{{ $t("Unknown page:") }} {{ state.activeCategory }}</div>
			</div>
		</main>
		<div class="eon-caster-alerts">
			<div
				v-for="alert in state.alerts"
				:key="alert.id"
				:class="['eon-alert', `--${alert.type}`]"
			>
				{{ $text(alert.message) }}
			</div>
		</div>
	</div>
</template>

<script>
import { state } from '/config/store.js'
import { NAV_ITEM_BY_ID } from '/config/nav-config.js'
import AppHeader from '/config/components/shell/AppHeader.vue'
import AppSidebar from '/config/components/shell/AppSidebar.vue'
import BroadcastStatusBar from '/config/components/shell/BroadcastStatusBar.vue'

import Dashboard from '/config/components/Dashboard.vue'
import PlatformsPage from '/config/components/PlatformsPage.vue'
import LayoutEditor from '/config/components/LayoutEditor.vue'
import SeriesEditor from '/config/components/SeriesEditor.vue'
import MatchRulesEditor from '/config/components/MatchRulesEditor.vue'
import TeamsEditor from '/config/components/TeamsEditor.vue'
import SponsorsEditor from '/config/components/SponsorsEditor.vue'
import ThemeDesigner from '/config/components/ThemeDesigner.vue'
import PackagesEditor from '/config/components/PackagesEditor.vue'
import OptionsEditor from '/config/components/OptionsEditor.vue'
import TeamDiagnostics from '/config/components/TeamDiagnostics.vue'
import PortabilityEditor from '/config/components/PortabilityEditor.vue'
import TelestratorPage from '/config/components/TelestratorPage.vue'
import DirectorPage from '/config/components/DirectorPage.vue'

const COMPONENT_MAP = {
	Dashboard,
	PlatformsPage,
	DirectorPage,
	LayoutEditor,
	SeriesEditor,
	MatchRulesEditor,
	TeamsEditor,
	SponsorsEditor,
	ThemeDesigner,
	PackagesEditor,
	OptionsEditor,
	TeamDiagnostics,
	PortabilityEditor,
	TelestratorPage,
}

export default {
	components: { AppHeader, AppSidebar, BroadcastStatusBar },
	setup() {
		return { state }
	},
	computed: {
		activeItem() {
			return NAV_ITEM_BY_ID[this.state.activeCategory] || null
		},
		activeComponent() {
			const item = this.activeItem
			return item ? (COMPONENT_MAP[item.componentKey] || null) : null
		},
		pageTitle() {
			const item = this.activeItem
			return item?.labelKey ? this.$t(item.labelKey) : 'NeuronCast'
		},
	},
}
</script>

<style scoped>
.eon-main {
	grid-column: 2;
	grid-row: 3;
	min-width: 0;
	min-height: 0;
	overflow-y: auto;
	overflow-x: hidden;
	background: var(--eon-bg);
}

.eon-main::-webkit-scrollbar {
	width: 6px;
	height: 6px;
}

.eon-main::-webkit-scrollbar-track {
	background: transparent;
}

.eon-main::-webkit-scrollbar-thumb {
	background: var(--eon-bd);
	border-radius: 3px;
}

.eon-main::-webkit-scrollbar-thumb:hover {
	background: var(--eon-bd2);
}

.eon-main-inner {
	min-height: 100%;
	padding: var(--eon-pg-pad-y) var(--eon-pg-pad-x);
	box-sizing: border-box;
}

.eon-missing {
	padding: 32px;
	text-align: center;
	color: var(--eon-tx3);
	font-family: var(--eon-font-mono);
}

.eon-caster-alerts {
	position: fixed;
	bottom: 24px;
	right: 24px;
	display: flex;
	flex-direction: column;
	gap: 8px;
	z-index: 1000;
	pointer-events: none;
}

.eon-alert {
	padding: 10px 16px;
	border-radius: var(--eon-rad-btn);
	font-size: var(--eon-fs-body);
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
	pointer-events: auto;
}

.eon-alert.--info {
	background: var(--eon-s3);
	border: 1px solid var(--eon-bd);
	color: var(--eon-tx);
}

.eon-alert.--warn {
	background: var(--eon-ambd);
	border: 1px solid var(--eon-amb);
	color: var(--eon-amb);
}

.eon-alert.--error {
	background: var(--eon-redd);
	border: 1px solid var(--eon-red);
	color: var(--eon-red);
}
</style>
