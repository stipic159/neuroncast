<template>
	<AppShell />
</template>

<script>
import { state, actions } from '/config/store.js'
import AppShell from '/config/components/shell/AppShell.vue'

export default {
	components: { AppShell },
	setup() {
		return { state, actions }
	},
	mounted() {
		this.actions.init()
	},
}
</script>
