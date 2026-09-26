export const CURRENT_MAP_OPTION_DEFINITIONS = [
	{canonical: 'layout.currentMap.bottom',
		aliases: ['css.lan66-current-map-bottom'],
		cssVars: ['--lan66-current-map-bottom', '--layout-current-map-bottom'],
		fallback: 'var(--viewport-margin-bottom)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-current-map-bottom': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.currentMap.right',
		aliases: ['css.lan66-current-map-right'],
		cssVars: ['--lan66-current-map-right', '--layout-current-map-right'],
		fallback: 'var(--viewport-margin-right)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-current-map-right': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'style.currentMap.width',
		aliases: ['css.lan66-current-map-width'],
		cssVars: ['--lan66-current-map-width', '--style-current-map-width'],
		fallback: '16rem',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-current-map-width': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.currentMap.visible',
		aliases: ['css.lan66-current-map-display'],
		cssVars: ['--lan66-current-map-display', '--layout-current-map-display'],
		fallback: 'flex',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-current-map-display': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	}
]
