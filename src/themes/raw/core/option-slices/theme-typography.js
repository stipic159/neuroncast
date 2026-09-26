export const THEME_TYPOGRAPHY_OPTION_DEFINITIONS = [
	{canonical: 'theme.typography.primaryFont',
		aliases: ['css.primary-font-family'],
		cssVars: ['--theme-typography-primary-font', '--primary-font-family'],
		fallback: 'Quantico',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.primary-font-family': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'theme.typography.customFontUrl',
		aliases: ['css.custom-font-url'],
		cssVars: ['--theme-typography-custom-font-url', '--custom-font-url'],
		fallback: '',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.custom-font-url': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	}
]
