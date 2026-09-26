export const SPONSOR_OPTION_DEFINITIONS = [
	{canonical: 'layout.sponsorLeft.top',
		aliases: ['css.lan66-sponsor-left-top'],
		cssVars: ['--lan66-sponsor-left-top', '--layout-sponsor-left-top'],
		fallback: 'var(--viewport-margin-top)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-sponsor-left-top': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.sponsorLeft.left',
		aliases: ['css.lan66-sponsor-left-left'],
		cssVars: ['--lan66-sponsor-left-left', '--layout-sponsor-left-left'],
		fallback: 'var(--viewport-margin-left)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-sponsor-left-left': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.sponsorLeft.visible',
		aliases: ['css.lan66-sponsor-left-display'],
		cssVars: ['--lan66-sponsor-left-display', '--layout-sponsor-left-display'],
		fallback: 'flex',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-sponsor-left-display': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.sponsorRight.top',
		aliases: ['css.lan66-sponsor-right-top'],
		cssVars: ['--lan66-sponsor-right-top', '--layout-sponsor-right-top'],
		fallback: 'var(--viewport-margin-top)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-sponsor-right-top': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.sponsorRight.right',
		aliases: ['css.lan66-sponsor-right-right'],
		cssVars: ['--lan66-sponsor-right-right', '--layout-sponsor-right-right'],
		fallback: 'var(--viewport-margin-right)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-sponsor-right-right': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.sponsorRight.visible',
		aliases: ['css.lan66-sponsor-right-display'],
		cssVars: ['--lan66-sponsor-right-display', '--layout-sponsor-right-display'],
		fallback: 'flex',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-sponsor-right-display': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'style.sponsors.width',
		aliases: ['css.lan66-sponsor-width', 'css.sponsor-panel-width'],
		cssVars: ['--lan66-sponsor-width', '--style-sponsors-width'],
		fallback: '13rem',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-sponsor-width': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				},
				'css.sponsor-panel-width': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'style.sponsors.height',
		aliases: ['css.lan66-sponsor-height', 'css.sponsor-panel-height'],
		cssVars: ['--lan66-sponsor-height', '--style-sponsors-height'],
		fallback: '4.8rem',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-sponsor-height': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				},
				'css.sponsor-panel-height': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	}
]
