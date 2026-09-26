export const THEME_MATERIALS_OPTION_DEFINITIONS = [
	{canonical: 'theme.materials.panelFill',
		aliases: ['css.lan66-panel-fill'],
		cssVars: ['--theme-materials-panel-fill', '--lan66-panel-fill'],
		fallback: 'rgba(10, 12, 18, 0.88)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-panel-fill': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'theme.materials.panelBorder',
		aliases: ['css.lan66-panel-border'],
		cssVars: ['--theme-materials-panel-border', '--lan66-panel-border'],
		fallback: 'rgba(255, 255, 255, 0.18)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-panel-border': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	}
]
