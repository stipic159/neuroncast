export const RADAR_OPTION_DEFINITIONS = [
	{canonical: 'layout.radar.top',
		aliases: ['css.lan66-radar-top'],
		cssVars: ['--lan66-radar-top', '--layout-radar-top'],
		fallback: '1.5rem',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-radar-top': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.radar.left',
		aliases: ['css.lan66-radar-left'],
		cssVars: ['--lan66-radar-left', '--layout-radar-left'],
		fallback: '2.5rem',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-radar-left': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.radar.width',
		aliases: ['css.radar-width'],
		// Only set --layout-radar-width. The per-preset CSS sets --radar-width
		// at .hud-viewport.--style-X which beats inline :root in the cascade,
		// so any inline override of --radar-width is dead on arrival. radar.css
		// reads var(--layout-radar-width, var(--radar-width)) instead — the
		// user-set override wins, otherwise the preset default applies.
		cssVars: ['--layout-radar-width'],
		// No fallback so applyResolvedCssVariables skips when the user hasn't
		// customized — keeping the preset default active. Set to a string
		// only when the user explicitly configures a value.
		fallback: null,
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.radar-width': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.radar.visible',
		aliases: ['css.lan66-radar-display'],
		cssVars: ['--lan66-radar-display', '--layout-radar-display'],
		fallback: 'flex',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-radar-display': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	}
]
