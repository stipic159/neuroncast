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
			return this.activeItem ? this.$t(this.activeItem.labelKey) : 'NeuronCast'
		},
	},
}
</script>

<style scoped>
.eon-main {
	grid-column: 2;
	grid-row: 3;
	overflow-y: auto;
	overflow-x: hidden;
	background: var(--eon-bg);
}

.eon-main::-webkit-scrollbar { width: 6px; }
.eon-main::-webkit-scrollbar-thumb {
	background: var(--eon-bd);
	border-radius: 3px;
}

.eon-main-inner {
	min-height: 100%;
	padding: var(--eon-pg-pad-y) var(--eon-pg-pad-x);
}

.eon-missing {
	color: var(--eon-tx2);
	font-size: var(--eon-fs-body2);
	padding: 32px;
	text-align: center;
}

.eon-caster-alerts {
	position: fixed;
	bottom: 32px;
	right: 32px;
	display: flex;
	flex-direction: column;
	gap: 12px;
	z-index: 9999;
}

.eon-alert {
	padding: 14px 22px;
	border-radius: var(--eon-rad-card);
	background: var(--eon-s2);
	color: var(--eon-tx);
	font-weight: 600;
	font-size: var(--eon-fs-body2);
	border: 1px solid var(--eon-bd);
	border-left: 3px solid var(--eon-acc);
	box-shadow: var(--eon-shadow-dropdown);
	animation: eon-alert-in 0.3s ease-out;
	max-width: 360px;
}

.eon-alert.--success { border-left-color: var(--eon-grn); }
.eon-alert.--warning { border-left-color: var(--eon-amb); }
.eon-alert.--error   { border-left-color: var(--eon-red); }
.eon-alert.--info    { border-left-color: var(--eon-blu); }

@keyframes eon-alert-in {
	from { transform: translateX(20px); opacity: 0; }
	to   { transform: translateX(0);    opacity: 1; }
}
</style>
