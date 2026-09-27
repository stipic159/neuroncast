const makeWeapons = ({ primary, secondary = 'weapon_glock', grenades = [], bomb = false, active = primary }) => {
	const weapons = {
		weapon_0: {
			name: primary,
			paintkit: 'default',
			state: active === primary ? 'active' : 'holstered',
			type: primary === 'weapon_awp' ? 'SniperRifle' : 'Rifle',
			ammo_clip: primary === 'weapon_awp' ? 7 : 24,
			ammo_clip_max: primary === 'weapon_awp' ? 10 : 30,
			ammo_reserve: primary === 'weapon_awp' ? 23 : 90,
		},
		weapon_1: {
			name: secondary,
			paintkit: 'default',
			state: active === secondary ? 'active' : 'holstered',
			type: 'Pistol',
			ammo_clip: 12,
			ammo_clip_max: 12,
			ammo_reserve: 24,
		},
		weapon_2: {
			name: 'weapon_knife',
			paintkit: 'default',
			state: active === 'weapon_knife' ? 'active' : 'holstered',
			type: 'Knife',
		},
	}

	grenades.forEach((grenade, index) => {
		weapons[`weapon_${index + 3}`] = {
			name: grenade,
			paintkit: 'default',
			state: active === grenade ? 'active' : 'holstered',
			type: 'Grenade',
			ammo_reserve: grenade === 'weapon_flashbang' ? 2 : 1,
		}
	})

	if (bomb) {
		weapons.weapon_bomb = {
			name: 'weapon_c4',
			paintkit: 'default',
			state: 'holstered',
			type: 'C4',
		}
	}

	return weapons
}

const makePlayer = ({
	steamid,
	name,
	team,
	observerSlot,
	position,
	forward = '0, 1, 0',
	health = 100,
	armor = 100,
	money = 2400,
	kills = 10,
	assists = 2,
	deaths = 8,
	primary,
	secondary,
	grenades,
	bomb,
	defusekit = false,
	roundKills = 0,
	roundDamage = 0,
}) => ({
	steamid,
	name,
	team,
	observer_slot: observerSlot,
	position,
	forward,
	state: {
		health,
		armor,
		helmet: armor > 0,
		defusekit,
		flashed: 0,
		burning: 0,
		money,
		equip_value: primary === 'weapon_awp' ? 6450 : 4300,
		round_kills: roundKills,
		round_killhs: Math.min(roundKills, 1),
		round_totaldmg: roundDamage,
	},
	match_stats: {
		kills,
		assists,
		deaths,
		mvps: Math.floor(kills / 5),
		score: kills * 2 + assists,
	},
	weapons: makeWeapons({ primary, secondary, grenades, bomb }),
})

const compactHudStressNames = [
	'ultra_long_steam_override_entry_alpha_999',
	'CounterSide Anchor With Extremely Long Name',
	'ADR-300 Rating-2.49 Stat Stress Name',
	'LAN66 Broadcast Layout Regression Sentinel',
	'Name So Long It Must Ellipsize Cleanly',
	'right_side_steam_override_entry_very_long',
	'Counter-Strike Player With Sponsor Prefix',
	'Three Digit ADR And Two Digit KDA Tester',
	'Compact HUD Numeric Collision Detector',
	'Final Long Player Name For Sidebar Stress',
]

const applyCompactHudStressFixture = (state, additionalState = null) => {
	const players = Object.values(state.allplayers || {})
	players.forEach((player, index) => {
		player.name = compactHudStressNames[index] || player.name
		player.match_stats.kills = 20 + index
		player.match_stats.assists = 10 + (index % 9)
		player.match_stats.deaths = 18 + (index % 8)
		player.match_stats.rating = (2.49 - index * 0.08).toFixed(2)
		player.match_stats.score = player.match_stats.kills * 2 + player.match_stats.assists
		player.state.round_totaldmg = 120 + index * 11
		player.state.money = 16000 - index * 700
	})

	if (additionalState?.roundDamages) {
		const roundNumber = state.map?.round ?? 17
		for (const player of players) {
			additionalState.roundDamages[player.steamid] = {
				...(additionalState.roundDamages[player.steamid] || {}),
				[roundNumber]: 100 + (Number(player.observer_slot) || 0) * 17,
			}
		}
	}

	state.round.phase = 'freezetime'
	state.phase_countdowns.phase = 'freezetime'
	state.phase_countdowns.phase_ends_in = '12.0'
	state.map.team_t.name = 'Terrorists'
	state.map.team_ct.name = 'Counter-Terrorists'
}

export const getDevGsiState = () => {
	const players = [
		makePlayer({
			steamid: '76561198000000001',
			name: 'Astra',
			team: 'T',
			observerSlot: 0,
			position: '-680, -760, -108',
			forward: '0.56, 0.83, 0',
			kills: 18,
			assists: 3,
			deaths: 11,
			money: 1850,
			primary: 'weapon_ak47',
			grenades: ['weapon_flashbang', 'weapon_smokegrenade'],
			roundKills: 1,
			roundDamage: 116,
		}),
		makePlayer({
			steamid: '76561198000000002',
			name: 'Bolt',
			team: 'T',
			observerSlot: 1,
			position: '-330, -1100, -104',
			forward: '0.15, 0.98, 0',
			kills: 13,
			assists: 5,
			deaths: 12,
			health: 82,
			money: 3200,
			primary: 'weapon_ak47',
			grenades: ['weapon_molotov', 'weapon_hegrenade'],
			bomb: true,
		}),
		makePlayer({
			steamid: '76561198000000003',
			name: 'Cipher',
			team: 'T',
			observerSlot: 2,
			position: '-1180, -430, -167',
			forward: '0.72, 0.69, 0',
			kills: 9,
			assists: 4,
			deaths: 14,
			health: 100,
			money: 950,
			primary: 'weapon_galilar',
			grenades: ['weapon_flashbang'],
		}),
		makePlayer({
			steamid: '76561198000000004',
			name: 'Drift',
			team: 'T',
			observerSlot: 3,
			position: '-910, -1450, -103',
			forward: '0.9, 0.18, 0',
			kills: 15,
			assists: 1,
			deaths: 13,
			health: 48,
			armor: 74,
			money: 600,
			primary: 'weapon_ak47',
			grenades: ['weapon_smokegrenade'],
		}),
		makePlayer({
			steamid: '76561198000000005',
			name: 'Echo',
			team: 'T',
			observerSlot: 4,
			position: '-1560, -900, -167',
			forward: '0.42, 0.9, 0',
			kills: 6,
			assists: 6,
			deaths: 15,
			health: 0,
			armor: 0,
			money: 150,
			primary: 'weapon_ak47',
		}),
		makePlayer({
			steamid: '76561198000000006',
			name: 'Frost',
			team: 'CT',
			observerSlot: 5,
			position: '-2020, -460, -167',
			forward: '-0.9, -0.21, 0',
			kills: 16,
			assists: 2,
			deaths: 10,
			health: 100,
			money: 900,
			primary: 'weapon_m4a1_silencer',
			secondary: 'weapon_usp_silencer',
			grenades: ['weapon_flashbang', 'weapon_incgrenade'],
			defusekit: true,
		}),
		makePlayer({
			steamid: '76561198000000007',
			name: 'Ghost',
			team: 'CT',
			observerSlot: 6,
			position: '-1730, -110, -167',
			forward: '-0.85, -0.45, 0',
			kills: 12,
			assists: 7,
			deaths: 13,
			health: 64,
			money: 2200,
			primary: 'weapon_m4a1',
			secondary: 'weapon_usp_silencer',
			grenades: ['weapon_smokegrenade'],
			defusekit: true,
		}),
		makePlayer({
			steamid: '76561198000000008',
			name: 'Haze',
			team: 'CT',
			observerSlot: 7,
			position: '-1320, 180, -167',
			forward: '-0.72, -0.69, 0',
			kills: 20,
			assists: 1,
			deaths: 9,
			health: 38,
			money: 4750,
			primary: 'weapon_awp',
			secondary: 'weapon_usp_silencer',
			grenades: ['weapon_flashbang'],
		}),
		makePlayer({
			steamid: '76561198000000009',
			name: 'Ion',
			team: 'CT',
			observerSlot: 8,
			position: '-2340, -820, -108',
			forward: '-0.4, -0.9, 0',
			kills: 8,
			assists: 4,
			deaths: 16,
			health: 0,
			armor: 0,
			money: 300,
			primary: 'weapon_m4a1',
			secondary: 'weapon_usp_silencer',
		}),
		makePlayer({
			steamid: '76561198000000010',
			name: 'Juno',
			team: 'CT',
			observerSlot: 9,
			position: '-1980, -1260, -108',
			forward: '-0.25, -0.96, 0',
			kills: 11,
			assists: 3,
			deaths: 12,
			health: 92,
			money: 1250,
			primary: 'weapon_famas',
			secondary: 'weapon_usp_silencer',
			grenades: ['weapon_hegrenade'],
		}),
	]

	const state = {
		provider: {
			name: 'NeuronCast UI Dev Mode',
			appid: 730,
			version: 1,
			steamid: '76561198000000001',
			timestamp: Math.floor(Date.now() / 1000),
		},
		map: {
			mode: 'competitive',
			name: 'de_mirage',
			phase: 'live',
			round: 17,
			team_t: {
				name: 'Ember',
				score: 8,
				consecutive_round_losses: 1,
				timeouts_remaining: 2,
				matches_won_this_series: 0,
			},
			team_ct: {
				name: 'Nord',
				score: 9,
				consecutive_round_losses: 0,
				timeouts_remaining: 3,
				matches_won_this_series: 1,
			},
			round_wins: {
				1: 'ct_win_elimination',
				2: 'ct_win_time',
				3: 't_win_bomb',
				4: 'ct_win_defuse',
				5: 't_win_elimination',
				6: 't_win_bomb',
				7: 'ct_win_elimination',
				8: 'ct_win_time',
				9: 't_win_elimination',
				10: 'ct_win_defuse',
				11: 't_win_bomb',
				12: 'ct_win_elimination',
				13: 't_win_elimination',
				14: 'ct_win_elimination',
				15: 'ct_win_time',
				16: 't_win_bomb',
				17: 'ct_win_elimination',
			},
		},
		round: {
			phase: 'freezetime',
		},
		phase_countdowns: {
			phase: 'freezetime',
			phase_ends_in: '15.0',
		},
		player: {
			steamid: '76561198000000008',
			name: 'Haze',
			activity: 'playing',
			observer_slot: 7,
		},
		allplayers: Object.fromEntries(players.map((player) => [player.steamid, player])),
		bomb: {
			state: 'carried',
			player: '76561198000000002',
		},
		grenades: {
			'321': {
				type: 'smoke',
				owner: '76561198000000007',
				position: '-1490, -620, -168',
				velocity: '0, 0, 0',
				lifetime: '9.4',
				effecttime: '6.8',
			},
			'322': {
				type: 'flashbang',
				owner: '76561198000000001',
				position: '-930, -540, -116',
				velocity: '280, 120, 180',
				lifetime: '0.6',
			},
		},
	}

	if ((process.env.NEURON_UI_STRESS_FIXTURE || process.env.EON_UI_STRESS_FIXTURE) === 'compact-hud') {
		applyCompactHudStressFixture(state)
	}

	return state
}

export const getDevAdditionalState = () => {
	const roundDamages = {}
	const moneyAtStartOfRound = {}
	const lastKnownPlayerObserverSlot = {}

	for (let index = 1; index <= 10; index++) {
		const steamid = `765611980000000${String(index).padStart(2, '0')}`
		lastKnownPlayerObserverSlot[steamid] = index - 1
		moneyAtStartOfRound[steamid] = index <= 5 ? 4200 : 5000
		roundDamages[steamid] = {
			14: 64 + index,
			15: 83 + index,
			16: 42 + index,
			17: index % 3 === 0 ? 121 : 38 + index,
		}
	}

	const additionalState = {
		lastKnownBombPlantedCountdown: {},
		lastKnownMapName: 'de_mirage',
		lastKnownPlayerObserverSlot,
		moneyAtStartOfRound,
		roundDamages,
		currentRoundProb: 0.42,
		probHistory: [0.5, 0.47, 0.44, 0.42],
		maxProbSwing: 0.18,
		roundKillStats: {},
		mvpDisplay: null,
	}

	if ((process.env.NEURON_UI_STRESS_FIXTURE || process.env.EON_UI_STRESS_FIXTURE) === 'compact-hud') {
		for (let index = 1; index <= 10; index++) {
			const steamid = `765611980000000${String(index).padStart(2, '0')}`
			additionalState.roundDamages[steamid] = {
				...(additionalState.roundDamages[steamid] || {}),
				17: 100 + (index - 1) * 17,
			}
		}
	}

	return additionalState
}
