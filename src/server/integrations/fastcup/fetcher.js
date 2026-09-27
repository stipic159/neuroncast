import { toSteamID64 } from './steam-utils.js'
import { downloadAsset } from './asset-cache.js'

/**
 * Extracts a numeric Match ID from a raw string, URL, or path.
 * Examples: '27240569', 'https://cs2.fastcup.net/matches/27240569', 'cs.fastcup.net/match/27240569'
 * 
 * @param {string} input 
 * @returns {string|null}
 */
export function extractMatchId(input) {
	if (input === null || input === undefined) return null
	const str = String(input).trim()
	if (!str) return null

	// Pure number
	if (/^\d+$/.test(str)) {
		return str
	}

	// URL pattern matching /match/12345 or /matches/12345
	const match = str.match(/(?:match|matches)[/-](\d+)/i)
	if (match) {
		return match[1]
	}

	return null
}

/**
 * Normalizes map names (e.g. 'de_dust2' -> 'de_dust2', 'dust2' -> 'de_dust2')
 */
export function normalizeMapName(mapName) {
	if (!mapName) return 'de_tbd'
	const str = String(mapName).trim().toLowerCase()
	if (str.startsWith('de_') || str.startsWith('cs_')) return str
	return `de_${str}`
}

const FASTCUP_GRAPHQL_QUERY = `
    query __GetMatch($matchId: Int!, $gameId: smallint!) {
      match: matches_by_pk(id: $matchId) {
        id
        type
        state
        status
        shuffle
        premium
        media
        pro
        wingman
        password
        bestOf: best_of
        chatId: chat_id
        gameId: game_id
        devBuild: dev_build
        isPaused: is_paused
        creatorId: creator_id
        gameModeId: game_mode_id
        hasWinner: has_winner
        gameStatus: game_status
        lastUpdate: last_update
        createdAt: created_at
        startedAt: started_at
        finishedAt: finished_at
        scheduledAt: scheduled_at
        eventsDelay: events_delay
        captainMode: captain_mode
        waitroomEnabled: waitroom_enabled
        readinessPassed: readiness_passed
        serverRegionId: server_region_id
        serverInstanceId: server_instance_id
        teamSpeakServerId: teamspeak_server_id
        fakeServerRegionId: fake_server_region_id
        tvAddressHidden: tv_address_hidden
        funModeEnabled: fun_mode_enabled
        anticheatEnabled: anticheat_enabled
        cancellationReason: cancellation_reason
        maxRoundsCount: max_rounds_count
        mapBanpickConfigId: map_banpick_config_id
        refereeCheckRequested: referee_check_requested
        resultConfirmed: result_confirmed
        friendlyFireEnabled: friendly_fire_enabled
        tvDelay: tv_delay
        replayExpirationDate: replay_expiration_date
        tournamentGroupId: tournament_group_id
        currentVoterId: current_voter_id
        votingStartedAt: voting_started_at
        disqualificationReason: disqualification_reason
        sideSelectionEnabled: side_selection_enabled
        mapBanpickConfig {
          id
          targetSize: target_size
          steps(order_by: { number: asc }) {
            id
            step
          }
        }
        mapBans {
          date
          mapId: map_id
          userId: user_id
        }
        mapPicks {
          date
          mapId: map_id
          userId: user_id
        }
        mapsPool {
          mapId: map_id
        }
        maps(order_by: { number: asc }) {
          ...MatchMapPrimaryParts
          ...MatchMapSecondaryParts
          replays {
            ...MatchMapReplayPrimaryParts
          }
          replay2d {
            url
          }
          highlights {
            ...MatchMapHighlightPrimaryParts
            userId: user_id
          }
        }
        teams(order_by: { id: asc }) {
          ...MatchTeamPrimaryParts
          mapStats {
            ...MatchTeamMapStatPrimaryParts
          }
          team {
            id
            name
            logo
            tag
          }
          private {
            cid: teamspeak_cid
            password: voice_room_password
          }
        }
        serverInstance {
          id
          ip
          port
          steamId: steam_id
          tvPort: tv_port
        }
        members(order_by: { private: { party_id: desc_nulls_last } }) {
          ...MatchMemberPrimaryParts
          private {
            ...MatchMemberPrivateParts
          }
        }
        tournament {
          id
          name
          state
          appealTimeout: appeal_timeout
          referees {
            userId: user_id
          }
          organizer {
            name
            logo
          }
        }
        tournamentStage {
          id
          name
          groups {
            id
            name
          }
          outgoings {
            id
            number
            matchLink {
              matchId: match_id
            }
          }
        }
        tournamentRound {
          id
          name
        }
        leagueDivision {
          name
          league {
            id
            name: name_en
          }
        }
        private {
          cid: teamspeak_cid
          password: voice_room_password
          matchPassword: password
        }
        myBan {
          userId: user_id
        }
      }
    }

    fragment MatchMapPrimaryParts on match_maps {
      id
      number
      mapId: map_id
      startedAt: started_at
      finishedAt: finished_at
      gameStatus: game_status
    }

    fragment MatchMapSecondaryParts on match_maps {
      startingSidePicked: starting_side_picked
      startingSidesSwapped: starting_sides_swapped
    }

    fragment MatchMapReplayPrimaryParts on match_replays {
      id
      url
      createdAt: created_at
    }

    fragment MatchMapHighlightPrimaryParts on match_highlights {
      id
      score
      title
      status
      progress
      gameId: game_id
      createdAt: created_at
      uploadedAt: uploaded_at
      likesCount: likes_count
      viewsCount: views_count
      killsCount: kills_count
      clutchSize: clutch_size
      multikillSize: multikill_size
      clutchSuccess: clutch_success
      commentsCount: comments_count
      primaryWeapon {
        ...WeaponPrimaryParts
      }
      secondaryWeapon {
        ...WeaponPrimaryParts
      }
      myViews {
        userId: user_id
      }
    }

    fragment WeaponPrimaryParts on weapons {
      id
      name
      internalName: internal_name
    }

    fragment MatchTeamPrimaryParts on match_teams {
      id
      name
      size
      score
      chatId: chat_id
      isWinner: is_winner
      captainId: captain_id
      isDisqualified: is_disqualified
    }

    fragment MatchTeamMapStatPrimaryParts on match_team_map_stats {
      score
      isWinner: is_winner
      matchMapId: match_map_id
      matchTeamId: match_team_id
      initialSide: initial_side
    }

    fragment MatchMemberPrimaryParts on match_members {
      hash
      role
      ready
      impact
      connected
      isLeaver: is_leaver
      ratingDiff: rating_diff
      matchTeamId: match_team_id
    }

    fragment MatchMemberPrivateParts on match_members_private {
      rating
      partyId: party_id
      user {
        ...UserPrimaryParts
        ...UserMediaParts
        ...UserProParts
        ...BasicUserSubscriptionParts
        ...UserGameStats
      }
    }

    fragment UserPrimaryParts on users {
      id
      link
      avatar
      online
      verified
      isMobile: is_mobile
      nickName: nick_name
      animatedAvatar: animated_avatar
    }

    fragment UserMediaParts on users {
      isMedia: is_media
      displayMediaStatus: display_media_status
    }

    fragment UserProParts on users {
      isPro: is_pro
      displayProStatus: display_pro_status
    }

    fragment BasicUserSubscriptionParts on users {
      privacyOnlineStatusVisibility: privacy_online_status_visibility
      subscription {
        planId: plan_id
      }
      icon {
        ...ProfileIconPrimaryParts
      }
      card {
        ...ProfileCardPrimaryParts
      }
    }

    fragment ProfileIconPrimaryParts on profile_icons {
      id
      url
    }

    fragment ProfileCardPrimaryParts on profile_cards {
      id
      url
      urlAlt: url_alt
    }

    fragment UserGameStats on users {
      stats(where: { game_id: { _eq: $gameId }, map_id: { _is_null: true }, game_mode_id: { _is_null: false } }) {
        ...UserStatsParts
      }
    }

    fragment UserStatsParts on user_stats {
      kills
      deaths
      place
      rating
      winRate: win_rate
      gameModeId: game_mode_id
    }
`

/**
 * Normalizes raw FastCup API match data into canonical FastcupMatchPayload structure.
 */
export async function normalizeFastcupPayload(rawData, matchId) {
	const data = rawData.data?.match || rawData.data || rawData.match || rawData

	// Format BO1, BO3, BO5
	let format = 'BO1'
	const rawBo = data.bestOf || data.best_of || data.bo || (data.maps ? data.maps.length : 1)
	if (Number(rawBo) === 3) format = 'BO3'
	if (Number(rawBo) === 5) format = 'BO5'

	// Match Status
	let status = 'upcoming'
	const rawStatus = String(data.status || data.state || '').toLowerCase()
	if (['veto', 'pick_ban', '1', 'draft'].includes(rawStatus)) status = 'veto'
	else if (['live', 'in_progress', '2', 'playing', 'started'].includes(rawStatus)) status = 'live'
	else if (['finished', 'completed', 'ended', '3', 'closed'].includes(rawStatus)) status = 'finished'

	// Parse Teams
	const rawTeams = Array.isArray(data.teams) ? data.teams : []
	const rawTeam1 = rawTeams[0] || data.team1 || data.team_1 || {}
	const rawTeam2 = rawTeams[1] || data.team2 || data.team_2 || {}

	const allMembers = Array.isArray(data.members) ? data.members : []

	const parseTeam = async (rawTeam, teamKey, teamIndex) => {
		const teamId = rawTeam.id
		let membersForTeam = allMembers.filter(m => m.matchTeamId === teamId)
		if (membersForTeam.length === 0 && Array.isArray(rawTeam.players || rawTeam.roster)) {
			membersForTeam = rawTeam.players || rawTeam.roster
		}

		const parsedPlayers = []
		let captainSteamId64 = ''

		for (const m of membersForTeam) {
			const u = m.private?.user || m.user || m
			const fastcupId = String(u.id || m.userId || '')
			const steamId64 = toSteamID64(u.steam_id || u.steamId || fastcupId) || `765611990000000${parsedPlayers.length + 1}`
			const nickname = String(u.nickName || u.nickname || u.name || `Player_${fastcupId.slice(-4)}`).trim()
			
			const avatarFileName = u.avatar || u.avatar_url || null
			let origAvatar = null
			if (avatarFileName) {
				origAvatar = avatarFileName.startsWith('http')
					? avatarFileName
					: `https://cdn.fastcup.net/avatars/users/${avatarFileName}`
			}

			const avatarUrl = origAvatar ? (await downloadAsset(origAvatar, `avatar_${steamId64}`)) : '/hud/img/icons/radar-dead-player.svg'
			const rating = m.private?.rating ?? u.rating ?? 1000
			const rank = String(u.rank || 'Unranked')

			if (m.role === 'captain' || rawTeam.captainId === u.id || !captainSteamId64) {
				captainSteamId64 = steamId64
			}

			parsedPlayers.push({
				steamId64,
				fastcupId,
				nickname,
				avatarUrl,
				rating,
				rank,
			})
		}

		const teamMeta = rawTeam.team || {}
		const rawName = teamMeta.name || rawTeam.name || ''
		const isMixTeam = !rawName || rawName.toLowerCase().startsWith('team_') || rawTeam.is_mix
		const captainPlayer = parsedPlayers.find(p => p.steamId64 === captainSteamId64) || parsedPlayers[0]
		const defaultTeamName = captainPlayer ? `Team ${captainPlayer.nickname}` : (teamKey === 'team1' ? 'Team A' : 'Team B')
		const name = (!isMixTeam && rawName) ? rawName : defaultTeamName
		const tag = teamMeta.tag || rawTeam.tag || name.slice(0, 4).toUpperCase()

		const logoFileName = teamMeta.logo || rawTeam.logo || null
		let origLogo = null
		if (logoFileName) {
			origLogo = logoFileName.startsWith('http')
				? logoFileName
				: `https://cdn.fastcup.net/logos/teams/${logoFileName}`
		}
		const logoUrl = origLogo ? (await downloadAsset(origLogo, `team_${teamKey}`)) : null

		return {
			id: String(rawTeam.id || teamKey),
			name,
			tag,
			logoUrl,
			isMixTeam: !!isMixTeam,
			captainSteamId64: captainSteamId64 || (parsedPlayers[0]?.steamId64 ?? ''),
			players: parsedPlayers,
		}
	}

	const team1 = await parseTeam(rawTeam1, 'team1', 0)
	const team2 = await parseTeam(rawTeam2, 'team2', 1)

	// Parse Pick / Ban Veto
	const rawBans = Array.isArray(data.mapBans) ? data.mapBans : []
	const rawPicks = Array.isArray(data.mapPicks) ? data.mapPicks : []
	const steps = []

	rawBans.forEach((b, idx) => {
		const isTeam1 = team1.players.some(p => p.fastcupId === String(b.userId))
		steps.push({
			team: isTeam1 ? 'team1' : 'team2',
			action: 'ban',
			mapName: normalizeMapName(`map_${b.mapId}`),
			order: idx + 1,
		})
	})

	rawPicks.forEach((p, idx) => {
		const isTeam1 = team1.players.some(player => player.fastcupId === String(p.userId))
		steps.push({
			team: isTeam1 ? 'team1' : 'team2',
			action: 'pick',
			mapName: normalizeMapName(`map_${p.mapId}`),
			order: steps.length + idx + 1,
		})
	})

	let vetoStatus = 'pending'
	if (steps.length > 0) {
		vetoStatus = (status === 'live' || status === 'finished') ? 'completed' : 'in_progress'
	}

	return {
		matchId: String(matchId),
		provider: 'fastcup',
		format,
		status,
		fetchedAt: Date.now(),
		teams: {
			team1,
			team2,
		},
		veto: {
			status: vetoStatus,
			activePicker: 'team1',
			steps,
		},
		overrides: {
			lockedFields: [],
			customData: {},
		}
	}
}

/**
 * Fetches match details from FastCup GraphQL or REST API given a match ID or match URL.
 * 
 * @param {string} matchIdOrUrl 
 * @param {string} sessionCookie Optional authentication session cookie
 * @returns {Promise<Object>} FastcupMatchPayload
 */
export async function fetchFastcupMatch(matchIdOrUrl, sessionCookie = '') {
	const matchId = extractMatchId(matchIdOrUrl)
	if (!matchId) {
		throw new Error(`Invalid FastCup Match ID or URL: "${matchIdOrUrl}"`)
	}

	const numericId = parseInt(matchId, 10)
	if (Number.isNaN(numericId)) {
		throw new Error(`FastCup Match ID must be a numeric value: "${matchId}"`)
	}

	// 1. Primary: FastCup Hasura GraphQL API
	try {
		const gqlHeaders = {
			'Content-Type': 'application/json',
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			'Origin': 'https://cs2.fastcup.net',
			'Referer': `https://cs2.fastcup.net/matches/${numericId}`,
		}

		if (sessionCookie) {
			gqlHeaders['Cookie'] = sessionCookie.includes('=') ? sessionCookie : `session=${sessionCookie}`
		}

		const gqlRes = await fetch('https://hasura.fastcup.net/v1/graphql', {
			method: 'POST',
			headers: gqlHeaders,
			body: JSON.stringify({
				operationName: '__GetMatch',
				query: FASTCUP_GRAPHQL_QUERY,
				variables: { matchId: numericId, gameId: 1 }
			})
		})

		if (gqlRes.ok) {
			const gqlData = await gqlRes.json()
			if (gqlData?.data?.match) {
				return await normalizeFastcupPayload(gqlData, matchId)
			}
			if (gqlData?.errors?.length) {
				const errMsg = gqlData.errors.map(e => e.message).join('; ')
				throw new Error(`FastCup GraphQL error: ${errMsg}`)
			}
		}
	} catch (err) {
		if (err.message.includes('FastCup GraphQL error')) {
			throw err
		}
		// Otherwise continue to REST fallback
	}

	// 2. Fallback: FastCup legacy endpoints
	const urls = [
		`https://cs2.fastcup.net/api/v3/matches/${matchId}`,
		`https://cs.fastcup.net/api/v3/matches/${matchId}`,
		`https://fastcup.net/api/v3/matches/${matchId}`,
	]

	const headers = {
		'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		'Accept': 'application/json, text/html, */*',
		'Referer': 'https://cs2.fastcup.net/',
	}

	if (sessionCookie) {
		headers['Cookie'] = sessionCookie.includes('=') ? sessionCookie : `session=${sessionCookie}`
	}

	let lastError = null

	for (const url of urls) {
		try {
			const controller = new AbortController()
			const timer = setTimeout(() => controller.abort(), 6000)

			const response = await fetch(url, {
				headers,
				signal: controller.signal,
			})
			clearTimeout(timer)

			if (!response.ok) {
				lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
				continue
			}

			const contentType = response.headers.get('content-type') || ''
			if (contentType.includes('application/json')) {
				const json = await response.json()
				return await normalizeFastcupPayload(json, matchId)
			}
		} catch (e) {
			lastError = e
		}
	}

	throw lastError || new Error(`Could not fetch FastCup match ${matchId}`)
}
