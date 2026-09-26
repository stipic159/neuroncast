export const EVENT_BADGE_OPTION_DEFINITIONS = [
	{canonical: 'layout.eventBadge.top',
		aliases: ['css.lan66-event-badge-top'],
		cssVars: ['--lan66-event-badge-top', '--layout-event-badge-top'],
		fallback: 'calc(var(--radar-width) + 0.9rem)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-event-badge-top': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.eventBadge.left',
		aliases: ['css.lan66-event-badge-left'],
		cssVars: ['--lan66-event-badge-left', '--layout-event-badge-left'],
		fallback: '1rem',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-event-badge-left': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'style.eventBadge.width',
		aliases: ['css.lan66-event-badge-width'],
		cssVars: ['--lan66-event-badge-width', '--style-event-badge-width'],
		fallback: 'clamp(14rem, calc(var(--radar-width) - 2rem), 22rem)',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-event-badge-width': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'style.eventBadge.logoHeight',
		aliases: ['css.lan66-event-badge-logo-height'],
		cssVars: ['--lan66-event-badge-logo-height', '--style-event-badge-logo-height'],
		fallback: '2.1rem',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-event-badge-logo-height': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'style.eventBadge.titleSize',
		aliases: ['css.lan66-event-badge-title-size'],
		cssVars: ['--lan66-event-badge-title-size', '--style-event-badge-title-size'],
		fallback: '0.98rem',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-event-badge-title-size': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'style.eventBadge.metaSize',
		aliases: ['css.lan66-event-badge-meta-size'],
		cssVars: ['--lan66-event-badge-meta-size', '--style-event-badge-meta-size'],
		fallback: '0.72rem',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-event-badge-meta-size': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	},
	{canonical: 'layout.eventBadge.visible',
		aliases: ['css.lan66-event-badge-display'],
		cssVars: ['--lan66-event-badge-display', '--layout-event-badge-display'],
		fallback: 'flex',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0',
			aliases: {
				'css.lan66-event-badge-display': {
					status: 'transitional',
					sunsetPhase: 'Phase 3B',
					removeAfter: 'v2.0.0'
				}
			}
		}
	}
]
