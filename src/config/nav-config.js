/*
 * NeuronCast operator SPA navigation — Phase 24A
 *
 * Single source of truth for the grouped sidebar (LIVE / SETUP / DESIGN / SYSTEM)
 * and the legacy → new id migration map used on first load.
 *
 * Existing page components are imported dynamically by App.vue so this module
 * stays import-light and reusable from the sidebar and the header.
 */

export const NAV_GROUPS = [
	{
		id: 'live',
		labelKey: 'Live',
		items: [
			{ id: 'live-control', labelKey: 'Live Control', icon: 'live', componentKey: 'Dashboard' },
			{ id: 'director',     labelKey: 'AI Director',  icon: 'director', componentKey: 'DirectorPage' },
			{ id: 'telestrator',  labelKey: 'Telestrator',  icon: 'telestrator', componentKey: 'TelestratorPage' },
			{ id: 'layout-editor', labelKey: 'Layout Editor', icon: 'layout', componentKey: 'LayoutEditor' },
		],
	},
	{
		id: 'setup',
		labelKey: 'Setup',
		items: [
			{ id: 'platforms',     labelKey: 'Match Platforms', icon: 'platforms', componentKey: 'PlatformsPage' },
			{ id: 'obs',           labelKey: 'OBS Studio',      icon: 'obs',       componentKey: 'ObsSettingsPage' },
			{ id: 'series-maps',   labelKey: 'Series & Maps',   icon: 'series',   componentKey: 'SeriesEditor' },
			{ id: 'match-rules',   labelKey: 'Match Rules',     icon: 'rules',    componentKey: 'MatchRulesEditor' },
			{ id: 'teams-players', labelKey: 'Teams & Players', icon: 'teams',    componentKey: 'TeamsEditor' },
			{ id: 'sponsors',      labelKey: 'Sponsors',        icon: 'sponsors', componentKey: 'SponsorsEditor' },
		],
	},
	{
		id: 'design',
		labelKey: 'Design',
		items: [
			{ id: 'theme-designer', labelKey: 'Theme Designer', icon: 'theme',    componentKey: 'ThemeDesigner' },
			{ id: 'packages',       labelKey: 'Packages',       icon: 'packages', componentKey: 'PackagesEditor' },
		],
	},
	{
		id: 'system',
		labelKey: 'System',
		items: [
			{ id: 'broadcast-behavior', labelKey: 'Broadcast Behavior', icon: 'options',     componentKey: 'OptionsEditor' },
			{ id: 'diagnostics',        labelKey: 'Diagnostics',        icon: 'diagnostics', componentKey: 'TeamDiagnostics' },
			{ id: 'portability',        labelKey: 'Import / Export',    icon: 'portability', componentKey: 'PortabilityEditor' },
		],
	},
]

/* Flat list of all items for convenience. */
export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)

/* O(1) lookups. */
export const NAV_ITEM_BY_ID = Object.fromEntries(NAV_ITEMS.map((item) => [item.id, item]))
export const NAV_GROUP_BY_ITEM_ID = Object.fromEntries(
	NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.id, group.id])),
)

/* Legacy localStorage activeCategory → new id. Run once on store init. */
export const LEGACY_CATEGORY_MAP = {
	dashboard: 'live-control',
	layout: 'layout-editor',
	series: 'series-maps',
	rules: 'match-rules',
	teams: 'teams-players',
	sponsors: 'sponsors',
	'theme-designer': 'theme-designer',
	packages: 'packages',
	'team-diagnostics': 'diagnostics',
	options: 'broadcast-behavior',
	portability: 'portability',
}

export const DEFAULT_CATEGORY = 'live-control'

export const migrateLegacyCategory = (raw) => {
	if (!raw) return DEFAULT_CATEGORY
	if (NAV_ITEM_BY_ID[raw]) return raw
	return LEGACY_CATEGORY_MAP[raw] || DEFAULT_CATEGORY
}

/*
 * SVG path data per icon name. Stroke-based; renders inside the standard
 * 24x24 viewBox at 2px stroke. Existing icon vocabulary preserved; new
 * icons added for the new pages (telestrator, theme, diagnostics, platforms, obs).
 */
export const ICON_PATHS = {
	live:        ['M6 12h12', 'M12 6v12', 'M8.5 8.5h7v7h-7z'],
	director:    ['M4 8h12v10H4z', 'M16 11l5-3v8l-5-3', 'M4 5l3 3', 'M9 4l3 4'],
	telestrator: ['M4 4h16v12H4z', 'M4 20h16', 'M9 9l4 4', 'M13 9l-4 4'],
	layout:      ['M4 5h16v14H4z', 'M4 10h16', 'M10 10v9'],
	platforms:   ['M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M9 12h6', 'M12 9v6'],
	obs:         ['M12 3a9 9 0 1 0 9 9A9 9 0 0 0 12 3zm0 4a5 5 0 0 1 5 5c0 1.5-.7 2.8-1.8 3.7l-1.4-1.4a3 3 0 0 0 1.2-2.3 3 3 0 0 0-3-3V7z'],
	series:      ['M7 5h10', 'M7 12h10', 'M7 19h10', 'M4 5h.01', 'M4 12h.01', 'M4 19h.01'],
	rules:       ['M7 4h10l3 3v13H7z', 'M17 4v4h4', 'M10 12h7', 'M10 16h5'],
	teams:       ['M8 11a4 4 0 1 1 8 0', 'M3 20a7 7 0 0 1 14 0', 'M18 14a5 5 0 0 1 3 5'],
	sponsors:    ['M5 7h14v10H5z', 'M8 10h8', 'M8 14h5'],
	theme:       ['M12 3a9 9 0 1 0 9 9', 'M12 3a4 4 0 0 1 4 4', 'M16 7a3 3 0 0 1-3 3', 'M9 13a2 2 0 1 0 0 4', 'M14 16a2 2 0 1 0 0 4'],
	packages:    ['M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.27 6.96L12 12.01l8.73-5.05', 'M12 22.08V12'],
	options:     ['M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8', 'M12 2v3', 'M12 19v3', 'M4.93 4.93l2.12 2.12', 'M16.95 16.95l2.12 2.12', 'M2 12h3', 'M19 12h3', 'M4.93 19.07l2.12-2.12', 'M16.95 7.05l2.12-2.12'],
	diagnostics: ['M12 22s8-4 8-10V5l-8-3l-8 3v7c0 6 8 10 8 10', 'M12 8v4', 'M12 16h.01'],
	portability: ['M16 3l4 4l-4 4', 'M20 7h-9', 'M8 21l-4 -4l4 -4', 'M4 17h9'],
}
