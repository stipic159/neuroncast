export const SERIES_OPTION_DEFINITIONS = [
	{
		canonical: 'series.name.center',
		fallback: 'NeuronCast',
		type: 'string',
		category: 'event',
		label: 'Event Title',
		description: 'Main tournament or series title'
	},
	{
		canonical: 'series.name.left',
		fallback: '',
		type: 'string',
		category: 'event',
		label: 'Event Subtitle',
		description: 'Left subtitle (e.g. stage, group, qualifier)'
	},
	{
		canonical: 'series.name.right',
		fallback: '',
		type: 'string',
		category: 'event',
		label: 'Event Tag / Stage',
		description: 'Right subtitle or tag'
	},
	{
		canonical: 'series.logoUrl',
		fallback: '/hud/img/branding/logo-ubg.png',
		type: 'string',
		category: 'event',
		label: 'Event Logo',
		description: 'Tournament or event branding logo'
	}
]
