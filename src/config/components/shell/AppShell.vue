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
