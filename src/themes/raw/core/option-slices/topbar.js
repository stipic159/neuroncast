export const TOPBAR_OPTION_DEFINITIONS = [
	{canonical: 'layout.topbar.top',
		aliases: ['css.lan66-top-bar-top'],
		cssVars: ['--lan66-top-bar-top', '--layout-topbar-top'],
		fallback: 'var(--viewport-margin-top)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-top-bar-top': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.topbar.visible',
		aliases: ['css.lan66-top-bar-display'],
		cssVars: ['--lan66-top-bar-display', '--layout-topbar-display'],
		fallback: 'flex',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-top-bar-display': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	}
]
