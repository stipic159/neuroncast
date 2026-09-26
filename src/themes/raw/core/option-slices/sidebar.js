export const SIDEBAR_POSITION_OPTION_DEFINITIONS = [
	{canonical: 'layout.sidebar.left',
		aliases: ['css.lan66-sidebar-left'],
		cssVars: ['--lan66-sidebar-left', '--layout-sidebar-left'],
		fallback: 'var(--viewport-margin-left)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-sidebar-left': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.sidebar.right',
		aliases: ['css.lan66-sidebar-right'],
		cssVars: ['--lan66-sidebar-right', '--layout-sidebar-right'],
		fallback: 'var(--viewport-margin-right)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-sidebar-right': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.sidebar.bottom',
		aliases: ['css.lan66-sidebar-bottom'],
		cssVars: ['--lan66-sidebar-bottom', '--layout-sidebar-bottom'],
		fallback: 'var(--viewport-margin-bottom)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-sidebar-bottom': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	}
]

export const SIDEBAR_VISIBILITY_OPTION_DEFINITIONS = [
	{canonical: 'layout.sidebar.leftVisible',
		aliases: ['css.lan66-sidebar-left-display'],
		cssVars: ['--lan66-sidebar-left-display', '--layout-sidebar-left-display'],
		fallback: 'flex',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-sidebar-left-display': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.sidebar.rightVisible',
		aliases: ['css.lan66-sidebar-right-display'],
		cssVars: ['--lan66-sidebar-right-display', '--layout-sidebar-right-display'],
		fallback: 'flex',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-sidebar-right-display': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	}
]
