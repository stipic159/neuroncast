export const PLAYERS_ALIVE_OPTION_DEFINITIONS = [
	{canonical: 'layout.playersAlive.top',
		aliases: ['css.lan66-players-alive-top'],
		cssVars: ['--lan66-players-alive-top', '--layout-players-alive-top'],
		fallback: 'var(--viewport-margin-top)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-players-alive-top': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.playersAlive.right',
		aliases: ['css.lan66-players-alive-right'],
		cssVars: ['--lan66-players-alive-right', '--layout-players-alive-right'],
		fallback: 'var(--viewport-margin-right)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-players-alive-right': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.playersAlive.visible',
		aliases: ['css.lan66-players-alive-display'],
		cssVars: ['--lan66-players-alive-display', '--layout-players-alive-display'],
		fallback: 'flex',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-players-alive-display': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	}
]
