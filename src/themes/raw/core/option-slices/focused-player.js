export const FOCUSED_PLAYER_OPTION_DEFINITIONS = [
	{canonical: 'layout.focusedPlayer.bottom',
		aliases: ['css.lan66-focused-player-bottom'],
		cssVars: ['--lan66-focused-player-bottom', '--layout-focused-player-bottom'],
		fallback: 'var(--viewport-margin-bottom)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-focused-player-bottom': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.focusedPlayer.visible',
		aliases: ['css.lan66-focused-player-display'],
		cssVars: ['--lan66-focused-player-display', '--layout-focused-player-display'],
		fallback: 'flex',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-focused-player-display': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	}
]
