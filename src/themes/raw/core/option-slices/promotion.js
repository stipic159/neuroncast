export const PROMOTION_OPTION_DEFINITIONS = [
	{
		canonical: 'layout.promotion.left',
		aliases: ['css.promotion-panel-left'],
		cssVars: ['--layout-promotion-left', '--promotion-panel-left'],
		fallback: '1.5rem',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0'
		}
	},
	{
		canonical: 'layout.promotion.bottom',
		aliases: ['css.promotion-panel-bottom'],
		cssVars: ['--layout-promotion-bottom', '--promotion-panel-bottom'],
		fallback: '1.5rem',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0'
		}
	},
	{
		canonical: 'layout.promotion.width',
		aliases: ['css.promotion-panel-width'],
		cssVars: ['--layout-promotion-width', '--promotion-panel-width'],
		fallback: '26rem',
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0'
		}
	},
	{
		canonical: 'promotion.visible',
		aliases: ['layout.promotion.visible'],
		cssVars: ['--layout-promotion-visible'],
		fallback: null,
		lifecycle: {
			introducedIn: 'v1.5.0',
			canonicalSince: 'v1.5.0'
		}
	}
]
