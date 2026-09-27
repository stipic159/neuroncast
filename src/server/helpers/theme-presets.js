/**
 * Static read-only Event Visual Presets for NeuronCast
 * Optimized for local fonts (Rajdhani, Chakra Petch) & OBS hardware-accelerated rendering
 */
export const EVENT_THEME_PRESETS = [
	{
		id: 'major-clean',
		name: 'Major Clean',
		description: 'ESL & BLAST Major standard: deep carbon gradients, balanced 12° geometry, and Rajdhani typography.',
		event: {
			name: 'NeuronCast Major 2026',
			subtitle: 'Grand Championship Broadcast',
			logo: '/hud/img/branding/logo-ubg.png',
			accentColor: '#388bfd'
		},
		tokens: {
			'theme.colors.ctFill': '25, 106, 232',
			'theme.colors.ctBorder': '91, 166, 255',
			'theme.colors.ctText': '156, 204, 255',
			'theme.colors.tFill': '232, 137, 22',
			'theme.colors.tBorder': '255, 181, 71',
			'theme.colors.tText': '255, 214, 138',
			'theme.colors.red': '240, 49, 37',
			'theme.colors.green': '56, 148, 107',
			'theme.materials.panelFill': 'rgba(8, 12, 18, 0.95)',
			'theme.materials.panelBorder': 'rgba(255, 255, 255, 0.16)',
			'theme.shapes.radius': '2px',
			'theme.shapes.skewAngle': '12deg',
			'theme.shapes.skewComplement': '168deg',
			'theme.typography.primaryFont': 'Rajdhani',
			'theme.typography.customFontUrl': ''
		}
	},
	{
		id: 'aggressive-lan',
		name: 'Aggressive LAN',
		description: 'High-octane arena visual identity: saturated CT sapphire & T magma amber, sharp borders, bold slants.',
		event: {
			name: 'NeuronCast Arena LAN',
			subtitle: 'Stage 1 Masters',
			logo: '/hud/img/branding/logo-ubg.png',
			accentColor: '#ff5a00'
		},
		tokens: {
			'theme.colors.ctFill': '16, 88, 220',
			'theme.colors.ctBorder': '52, 152, 255',
			'theme.colors.ctText': '190, 225, 255',
			'theme.colors.tFill': '255, 80, 0',
			'theme.colors.tBorder': '255, 155, 0',
			'theme.colors.tText': '255, 220, 180',
			'theme.colors.red': '245, 34, 45',
			'theme.colors.green': '46, 204, 113',
			'theme.materials.panelFill': 'rgba(10, 12, 16, 0.96)',
			'theme.materials.panelBorder': 'rgba(255, 90, 0, 0.35)',
			'theme.shapes.radius': '0px',
			'theme.shapes.skewAngle': '14deg',
			'theme.shapes.skewComplement': '166deg',
			'theme.typography.primaryFont': 'Rajdhani',
			'theme.typography.customFontUrl': ''
		}
	},
	{
		id: 'minimal',
		name: 'Minimal Clean',
		description: 'Frosted subtle borders, zero slash distortion, maximum in-game viewing area for pure tactical focus.',
		event: {
			name: 'NeuronCast Studio',
			subtitle: 'Pro League Stream',
			logo: '/hud/img/branding/logo-ubg.png',
			accentColor: '#8b949e'
		},
		tokens: {
			'theme.colors.ctFill': '45, 110, 195',
			'theme.colors.ctBorder': '70, 140, 230',
			'theme.colors.ctText': '230, 240, 255',
			'theme.colors.tFill': '210, 120, 25',
			'theme.colors.tBorder': '240, 150, 45',
			'theme.colors.tText': '255, 240, 225',
			'theme.colors.red': '235, 60, 60',
			'theme.colors.green': '50, 180, 110',
			'theme.materials.panelFill': 'rgba(12, 16, 22, 0.92)',
			'theme.materials.panelBorder': 'rgba(255, 255, 255, 0.1)',
			'theme.shapes.radius': '4px',
			'theme.shapes.skewAngle': '0deg',
			'theme.shapes.skewComplement': '180deg',
			'theme.typography.primaryFont': 'Rajdhani',
			'theme.typography.customFontUrl': ''
		}
	},
	{
		id: 'dark-broadcast',
		name: 'Dark Broadcast',
		description: 'High-contrast dark mode slate theme with sharp edges and standard tournament color configurations.',
		event: {
			name: 'NeuronCast Championship 2026',
			subtitle: 'LIVE Broadcast HUD',
			logo: '/hud/img/branding/logo-ubg.png',
			accentColor: '#58a6ff'
		},
		tokens: {
			'theme.colors.ctFill': '25, 106, 232',
			'theme.colors.ctBorder': '91, 166, 255',
			'theme.colors.ctText': '156, 204, 255',
			'theme.colors.tFill': '232, 137, 22',
			'theme.colors.tBorder': '255, 181, 71',
			'theme.colors.tText': '255, 214, 138',
			'theme.colors.red': '240, 49, 37',
			'theme.colors.green': '56, 148, 107',
			'theme.materials.panelFill': 'rgba(8, 12, 18, 0.95)',
			'theme.materials.panelBorder': 'rgba(255, 255, 255, 0.14)',
			'theme.shapes.radius': '0px',
			'theme.shapes.skewAngle': '12deg',
			'theme.shapes.skewComplement': '168deg',
			'theme.typography.primaryFont': 'Rajdhani',
			'theme.typography.customFontUrl': ''
		}
	},
	{
		id: 'finals-gold',
		name: 'Finals Gold',
		description: 'Championship obsidian-black frames, sharp right-angles, and gold border highlights.',
		event: {
			name: 'NeuronCast Championship Finals',
			subtitle: 'The Grand Finale 2026',
			logo: '/hud/img/branding/logo-ubg.png',
			accentColor: '#d4af37'
		},
		tokens: {
			'theme.colors.ctFill': '32, 38, 46',
			'theme.colors.ctBorder': '70, 80, 95',
			'theme.colors.ctText': '200, 210, 225',
			'theme.colors.tFill': '46, 38, 32',
			'theme.colors.tBorder': '95, 80, 70',
			'theme.colors.tText': '225, 210, 200',
			'theme.colors.red': '194, 24, 71',
			'theme.colors.green': '30, 130, 76',
			'theme.materials.panelFill': 'rgba(12, 14, 18, 0.98)',
			'theme.materials.panelBorder': 'rgba(212, 175, 55, 0.45)',
			'theme.shapes.radius': '2px',
			'theme.shapes.skewAngle': '0deg',
			'theme.shapes.skewComplement': '180deg',
			'theme.typography.primaryFont': 'Rajdhani',
			'theme.typography.customFontUrl': ''
		}
	},
	{
		id: 'cyber-neon',
		name: 'Cyber Neon',
		description: 'Synthwave hot magenta and radiant cyan backing overlays with reverse slants.',
		event: {
			name: 'NeuronCast Cyber Arena',
			subtitle: 'Synthwave Night Division',
			logo: '/hud/img/branding/logo-ubg.png',
			accentColor: '#ff007f'
		},
		tokens: {
			'theme.colors.ctFill': '255, 0, 127',
			'theme.colors.ctBorder': '255, 100, 180',
			'theme.colors.ctText': '255, 230, 240',
			'theme.colors.tFill': '0, 243, 255',
			'theme.colors.tBorder': '100, 250, 255',
			'theme.colors.tText': '230, 255, 255',
			'theme.colors.red': '255, 75, 75',
			'theme.colors.green': '50, 255, 150',
			'theme.materials.panelFill': 'rgba(14, 8, 22, 0.96)',
			'theme.materials.panelBorder': 'rgba(255, 0, 127, 0.35)',
			'theme.shapes.radius': '3px',
			'theme.shapes.skewAngle': '-12deg',
			'theme.shapes.skewComplement': '192deg',
			'theme.typography.primaryFont': 'Chakra Petch',
			'theme.typography.customFontUrl': ''
		}
	}
]
