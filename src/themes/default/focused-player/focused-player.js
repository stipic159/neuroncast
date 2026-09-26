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

	computed: {
		player() {
			return this.$players.focused
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
			const context = buildHudTeamIdentityContext({
				teams: this.$teams,
				map: this.$map,
				options: this.$opts,
				match: this.$root?.komplettligaenMatch,
			})
			const resolved = resolveTeamIdentities(context)
			return this.player.team.side === 3 ? resolved.teams.CT : resolved.teams.T
		},

		teamLogoSrc() {
			return this.resolvedTeamIdentity?.final.logo || getTeamLogoPath(this.resolvedTeamIdentity?.final.name || this.player?.team?.name)
		},

		isLowHealth() {
			if (! this.player) return false

			const maxHp = Number(this.$opts['preferences.focusedPlayer.maximumRedHealthPoints'] || 0)
			return !! maxHp && this.player.health <= maxHp
		},

		armorIcon() {
			if (! this.player?.hasArmor && ! this.player?.hasHelmet) return null
			return this.player.hasHelmet ? '/hud/img/icons/armor-helmet.svg' : '/hud/img/icons/armor.svg'
		},

		weapon() {
			const activeWeapon = this.player?.weapons?.find((weapon) => weapon.isActive && ! weapon.isGrenade && ! weapon.isKnife && ! weapon.isBomb)
			if (activeWeapon) return activeWeapon
			if (this.player?.primary?.isActive) return this.player.primary
			if (this.player?.secondary?.isActive) return this.player.secondary
			return this.player?.primary || this.player?.secondary
		},

		weaponIconUrl() {
			return this.weapon ? `/hud/img/weapons/${this.weapon.unprefixedName}.svg` : null
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
				foundPerType[grenade.name] = (foundPerType[grenade.name] || 0) + 1

				return {
					iconUrl: `/hud/img/weapons/${grenade.unprefixedName}.svg`,
					isActive: grenade.isActive,
					key: `${grenade.name}${foundPerType[grenade.name]}`,
				}
			})
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
			let fetchResponse = await fetch('/hud/overlay-images/focused-player-bottom.webp').catch(() => null)

			if (! fetchResponse?.ok) {
				fetchResponse = await fetch('/hud/overlay-images/focused-player-bottom.png').catch(() => null)
			}

			if (! fetchResponse?.ok) {
				fetchResponse = await fetch('/hud/overlay-images/focused-player-bottom.gif').catch(() => null)
			}

			if (! fetchResponse?.ok) return

			const blob = await fetchResponse.blob()
			this.overlayBottomImageUrl = URL.createObjectURL(blob)
		},
	},
}


