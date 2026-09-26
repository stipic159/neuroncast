export const THEME_SHAPES_OPTION_DEFINITIONS = [
	{canonical: 'theme.shapes.radius',
		aliases: ['css.ui-radius'],
		cssVars: ['--theme-shapes-radius', '--ui-radius'],
		fallback: '0',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.ui-radius': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'theme.shapes.skewAngle',
		aliases: ['css.skew-20'],
		cssVars: ['--theme-shapes-skew-angle', '--skew-20'],
		fallback: '20deg',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.skew-20': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'theme.shapes.skewComplement',
		aliases: ['css.skew-160'],
		cssVars: ['--theme-shapes-skew-complement', '--skew-160'],
		fallback: '160deg',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.skew-160': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	}
]
