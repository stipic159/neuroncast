import { teamColorClass } from '/hud/helpers/team-color-class.js'
import { getTeamLogoPath } from '/hud/helpers/player-resolver.js'
import { buildHudTeamIdentityContext, resolveTeamIdentities } from '/hud/helpers/team-identity-resolver.js'
import { resolveOption } from '/hud/core/resolve-option.js'

export default {
	data() {
		return {
			overlayBottomImageUrl: null,
			logoFailed: false,
		}
	},

	mounted() {
		this.setOverlayBottomImageUrl()
	},

	beforeUnmount() {
		if (this.overlayBottomImageUrl && this.overlayBottomImageUrl.startsWith('blob:')) {
			try {
				URL.revokeObjectURL(this.overlayBottomImageUrl)
			} catch (_) {}
		}
	},

	computed: {
		player() {
			return this.$players?.focused || null
		},

		isActive() {
			if (!this.player) return false
			const visible = resolveOption('layout.focusedPlayer.visible', 'flex')
			if (visible === false || visible === 'none') return false
			return true
		},

		colorClass() {
			return teamColorClass(this.player?.team)
		},

		resolvedTeamIdentity() {
			if (!this.player?.team) return null
			try {
				const context = buildHudTeamIdentityContext({
					teams: this.$teams,
					map: this.$map,
					options: this.$opts,
					match: this.$root?.komplettligaenMatch,
				})
				const resolved = resolveTeamIdentities(context)
				return this.player.team.side === 3 ? resolved.teams.CT : resolved.teams.T
			} catch (_) {
				return null
			}
		},

		teamLogoSrc() {
			return this.resolvedTeamIdentity?.final?.logo || getTeamLogoPath(this.resolvedTeamIdentity?.final?.name || this.player?.team?.name)
		},

		isLowHealth() {
			if (! this.player) return false

			const maxHp = Number(this.$opts?.['preferences.focusedPlayer.maximumRedHealthPoints'] || 0)
			return !! maxHp && (this.player.health || 0) <= maxHp
		},

		armorIcon() {
			if (! this.player?.hasArmor && ! this.player?.hasHelmet) return null
			return this.player.hasHelmet ? '/hud/img/icons/armor-helmet.svg' : '/hud/img/icons/armor.svg'
		},

		weapon() {
			const activeWeapon = this.player?.weapons?.find((weapon) => weapon?.isActive && ! weapon?.isGrenade && ! weapon?.isKnife && ! weapon?.isBomb)
			if (activeWeapon) return activeWeapon
			if (this.player?.primary?.isActive) return this.player.primary
			if (this.player?.secondary?.isActive) return this.player.secondary
			return this.player?.primary || this.player?.secondary || null
		},

		weaponIconUrl() {
			return this.weapon?.unprefixedName ? `/hud/img/weapons/${this.weapon.unprefixedName}.svg` : null
		},

		metrics() {
			return [
				{ key: 'kills', label: 'K', value: this.player?.kills ?? 0 },
				{ key: 'assists', label: 'A', value: this.player?.assists ?? 0 },
				{ key: 'deaths', label: 'D', value: this.player?.deaths ?? 0 },
				{ key: 'adr', label: 'ADR', value: this.player?.adr ?? 0 },
			]
		},

		grenades() {
			const foundPerType = {}

			return (this.player?.grenades || []).map((grenade) => {
				if (!grenade) return null
				foundPerType[grenade.name] = (foundPerType[grenade.name] || 0) + 1

				return {
					iconUrl: grenade.unprefixedName ? `/hud/img/weapons/${grenade.unprefixedName}.svg` : null,
					isActive: Boolean(grenade.isActive),
					key: `${grenade.name || 'grenade'}${foundPerType[grenade.name]}`,
				}
			}).filter(Boolean)
		},
	},

	watch: {
		'player.team.name': {
			handler() {
				this.logoFailed = false
			}
		},
		teamLogoSrc() {
			this.logoFailed = false
		}
	},

	methods: {
		getTeamLogoPath,

		async setOverlayBottomImageUrl() {
			try {
				let fetchResponse = await fetch('/hud/overlay-images/focused-player-bottom.webp').catch(() => null)

				if (! fetchResponse?.ok) {
					fetchResponse = await fetch('/hud/overlay-images/focused-player-bottom.png').catch(() => null)
				}

				if (! fetchResponse?.ok) {
					fetchResponse = await fetch('/hud/overlay-images/focused-player-bottom.gif').catch(() => null)
				}

				if (! fetchResponse?.ok) return

				const blob = await fetchResponse.blob()
				if (this.overlayBottomImageUrl && this.overlayBottomImageUrl.startsWith('blob:')) {
					URL.revokeObjectURL(this.overlayBottomImageUrl)
				}
				this.overlayBottomImageUrl = URL.createObjectURL(blob)
			} catch (_) {}
		},
	},
}
