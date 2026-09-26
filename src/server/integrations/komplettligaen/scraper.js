import https from 'node:https'

const COMPETITION_SLUG = "komplettligaen-counter-strike-hosten-2026";
const COMPETITION_ID = "13908";
const DIVISION_ID = "18878";
const BASE_URL = `https://www.ggarena.no/competitions/${COMPETITION_SLUG}/${COMPETITION_ID}`;

function decodeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function get(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "table-stream-overlay/1.0",
            Accept: "text/html,application/xhtml+xml",
          },
        },
        (response) => {
          // GG Arena 301/302s any stale competition slug/id to the canonical
          // season path for the requested resource. Following the redirect
          // makes match lookups season-independent - the constants above are
          // only fallbacks, never a correctness requirement.
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            response.resume();
            if (redirects >= 5) {
              reject(new Error("GG Arena redirect loop"));
              return;
            }
            resolve(get(new URL(response.headers.location, url).toString(), redirects + 1));
            return;
          }
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`GG Arena returned HTTP ${response.statusCode}`));
            response.resume();
            return;
          }

          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => resolve(body));
        },
      )
      .on("error", reject);
  });
}

async function getJson(url) {
  const body = await get(url);
  return JSON.parse(body);
}

function extractPage(html) {
  const match = html.match(/<div id="app" data-page="([\s\S]*?)"/);
  if (!match) {
    throw new Error("Could not find GG Arena page data");
  }

  return JSON.parse(decodeHtml(match[1]));
}

async function fetchPage(url) {
  return extractPage(await get(url));
}

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function displayTeamName(value) {
  return text(value).replace(/\s*\(CS2\)\s*$/i, "");
}

function teamName(team) {
  return displayTeamName(team?.name || team?.display_name || team?.title || team?.club?.name);
}

function logoUrl(team) {
  return team?.logo?.url || team?.team?.logo?.url || "";
}

function signupTeamId(signup) {
  return (
    signup?.team?.id ||
    signup?.team_id ||
    signup?.signup?.team?.id ||
    signup?.signup?.team_id ||
    (signup?.logo || signup?.club_id || signup?.game_id ? signup.id : null)
  );
}

function signupId(signup) {
  return signup?.signup_id || signup?.signup?.id || (signup?.team_id || signup?.team ? signup.id : null);
}

// 'CT' | 'T' | null from a side object ({remote_id, name}) or a bare string
function startSide(value) {
  const raw = String(value?.remote_id || value?.name || value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "ct" || raw.startsWith("counter")) return "CT";
  if (raw === "t" || raw.startsWith("terror")) return "T";
  return null;
}

function mapWinner(map) {
  if (!map.finished || map.homeScore === null || map.awayScore === null) {
    return null;
  }

  if (map.homeScore > map.awayScore) return "home";
  if (map.awayScore > map.homeScore) return "away";
  return null;
}

function simplifyMatch(page, matchMaps = []) {
  const props = page.props || {};
  const matchup = props.match || props.matchup || props.matchupResource || {};
  const home =
    matchup.home_signup?.team ||
    matchup.home_signup ||
    matchup.home_team ||
    matchup.homeTeam ||
    matchup.home ||
    props.signups?.find?.((signup) => signup.side === "home")?.signup?.team ||
    {};
  const away =
    matchup.away_signup?.team ||
    matchup.away_signup ||
    matchup.away_team ||
    matchup.awayTeam ||
    matchup.away ||
    props.signups?.find?.((signup) => signup.side === "away")?.signup?.team ||
    {};
  const maps = matchMaps.length
    ? matchMaps
    : matchup.maps || matchup.match_maps || props.maps || props.match_maps || [];
  const homeSignup = props.signups?.find?.((signup) => signup.side === "home");
  const awaySignup = props.signups?.find?.((signup) => signup.side === "away");
  const parsedMaps = Array.isArray(maps)
    ? maps.slice(0, 3).map((map, index) => ({
        number: map.number || map.map_number || index + 1,
        name: text(map.resource?.name || map.map?.name || map.name || map.map_name),
        image: text(map.resource?.image?.url || map.map?.image?.url || map.image?.url),
        status: text(map.status || map.state),
        homeScore: map.home_score ?? map.score_home ?? map.home?.score ?? null,
        awayScore: map.away_score ?? map.score_away ?? map.away?.score ?? null,
        finished: Boolean(map.finished_at),
        winner: null,
        pickedBy: text(teamName(map.picked_by) || map.picked_by || map.pick_team || map.picks_side),
        // starting sides per map, as shown on the match page. The maps API
        // carries them as homeside/awayside {remote_id:'ct'|'t', name}; the HUD
        // uses them (with the round number) when the game feed's team names
        // don't identify the teams.
        homeStartSide: startSide(map.homeside ?? map.home_side ?? map.homeSide),
        awayStartSide: startSide(map.awayside ?? map.away_side ?? map.awaySide),
      }))
    : [];
  parsedMaps.forEach((map) => {
    map.winner = mapWinner(map);
  });
  const series = parsedMaps.reduce(
    (score, map) => {
      const winner = mapWinner(map);
      if (winner) score[winner] += 1;
      return score;
    },
    { home: 0, away: 0 },
  );
  const bestOf = matchup.best_of || props.settings?.best_of || 3;
  const mapsToWin = Math.ceil(bestOf / 2);
  const matchWinner = series.home >= mapsToWin ? "home" : series.away >= mapsToWin ? "away" : null;
  const visibleMaps = matchWinner
    ? parsedMaps.filter((map) => map.finished || map.homeScore !== null || map.awayScore !== null)
    : parsedMaps;
  const currentMap = matchWinner
    ? visibleMaps.at(-1) || null
    : parsedMaps.find((map) => !map.finished && (map.homeScore !== null || map.awayScore !== null)) ||
      parsedMaps.find((map) => !map.finished) ||
      parsedMaps.at(-1) ||
      null;

  return {
    id: matchup.id || null,
    component: page.component,
    competition: text(props.competition?.name || matchup.competition?.name),
    divisionId: props.division?.id || matchup.matchupable_id || null,
    division: text(props.division?.name),
    round: text(matchup.round_identifier_text || matchup.round_name || props.round?.name || props.description),
    title: text(props.title || matchup.title || `${teamName(home)} vs ${teamName(away)}`),
    bestOf,
    startsAt: matchup.start_time || matchup.starts_at || matchup.start_at || matchup.scheduled_at || null,
    vetoOpensAt: props.settings?.veto_opens_at || matchup.veto_opens_at || null,
    status: text(matchup.status || matchup.state || props.status),
    spectateInfo: text(matchup.spectate_info),
    spectateUrl: text(matchup.spectate_url),
    home: {
      id: signupTeamId(home),
      signupId: signupId(homeSignup) || signupId(matchup.home_signup),
      name: teamName(home),
      logo: logoUrl(home),
      score: series.home || 0,
    },
    away: {
      id: signupTeamId(away),
      signupId: signupId(awaySignup) || signupId(matchup.away_signup),
      name: teamName(away),
      logo: logoUrl(away),
      score: series.away || 0,
    },
    series,
    matchWinner,
    currentMap,
    maps: visibleMaps,
    rawKeys: Object.keys(props),
  };
}

function sideSignup(matchup, side) {
  const signup = matchup.signups?.find?.((item) => item.pivot?.side === side);
  if (signup) return signup;

  const direct = side === "home" ? matchup.home_signup : matchup.away_signup;
  if (!direct) return {};

  return {
    ...direct,
    pivot: {
      side,
      score: side === "home" ? matchup.home_score : matchup.away_score,
    },
  };
}

function simplifyFixture(matchup, teamId) {
  const homeSignup = sideSignup(matchup, "home");
  const awaySignup = sideSignup(matchup, "away");
  const homeTeam = homeSignup.team || {};
  const awayTeam = awaySignup.team || {};
  const homeScore = matchup.home_score ?? homeSignup.pivot?.score ?? null;
  const awayScore = matchup.away_score ?? awaySignup.pivot?.score ?? null;
  const homeTeamId = signupTeamId(homeSignup);
  const awayTeamId = signupTeamId(awaySignup);
  const side = String(homeTeamId) === String(teamId) ? "home" : "away";
  const opponentSignup = side === "home" ? awaySignup : homeSignup;
  const opponentTeam = side === "home" ? awayTeam : homeTeam;
  const finished = Boolean(matchup.finished_at || matchup.winning_side);
  const won = finished && matchup.winning_side === side;

  return {
    id: matchup.id,
    round: text(matchup.round_identifier_text || `Runde ${matchup.round_number || ""}`),
    startsAt: matchup.start_time || null,
    bestOf: matchup.best_of || 3,
    finished,
    cancelled: Boolean(matchup.cancelled),
    postponed: Boolean(matchup.postponed),
    walkover: Boolean(matchup.walkover),
    side,
    opponent: {
      id: signupTeamId(opponentSignup),
      name: teamName(opponentSignup) || teamName(opponentTeam),
      logo: logoUrl(opponentTeam),
    },
    home: {
      id: homeTeamId,
      name: teamName(homeSignup) || teamName(homeTeam),
      logo: logoUrl(homeTeam),
      score: homeScore,
    },
    away: {
      id: awayTeamId,
      name: teamName(awaySignup) || teamName(awayTeam),
      logo: logoUrl(awayTeam),
      score: awayScore,
    },
    score: `${homeScore ?? "-"}-${awayScore ?? "-"}`,
    result: finished ? (won ? "W" : "L") : "",
    url: matchup.url || "",
  };
}

function teamSchedule(team, matchups, now = new Date()) {
  const fixtures = matchups
    .filter((matchup) => {
      const homeTeamId = signupTeamId(sideSignup(matchup, "home"));
      const awayTeamId = signupTeamId(sideSignup(matchup, "away"));
      return String(homeTeamId) === String(team.id) || String(awayTeamId) === String(team.id);
    })
    .map((matchup) => simplifyFixture(matchup, team.id));

  return {
    team,
    upcoming: fixtures
      .filter((fixture) => !fixture.finished && !fixture.cancelled && (!fixture.startsAt || new Date(fixture.startsAt) >= now))
      .sort((a, b) => new Date(a.startsAt || 0) - new Date(b.startsAt || 0))
      .slice(0, 5),
    last: fixtures
      .filter((fixture) => fixture.finished)
      .sort((a, b) => new Date(b.startsAt || 0) - new Date(a.startsAt || 0))
      .slice(0, 5),
  };
}

function findTeamInMatchups(matchups, teamId) {
  for (const matchup of matchups) {
    for (const signup of matchup.signups || []) {
      if (String(signupTeamId(signup)) === String(teamId)) {
        const team = signup.team || signup;
        return {
          id: signupTeamId(signup),
          signupId: signupId(signup),
          name: teamName(signup) || teamName(team),
          logo: logoUrl(team),
          score: 0,
        };
      }
    }
  }

  return null;
}

function selectedOpponent(match) {
  const homeIsUs = (match.home.name || "").toLowerCase().includes("6614gamers");
  const awayIsUs = (match.away.name || "").toLowerCase().includes("6614gamers");

  if (homeIsUs && !awayIsUs) return { team: match.away, side: "away" };
  if (awayIsUs && !homeIsUs) return { team: match.home, side: "home" };
  return { team: match.away, side: "away" };
}

function emptyMapStats(name, image = "") {
  return {
    name,
    image,
    played: 0,
    wins: 0,
    losses: 0,
    roundsFor: 0,
    roundsAgainst: 0,
    diff: 0,
    avgFor: 0,
    avgAgainst: 0,
    winRate: 0,
    startingSides: {
      t: { played: 0, wins: 0, losses: 0 },
      ct: { played: 0, wins: 0, losses: 0 },
      unknown: { played: 0, wins: 0, losses: 0 },
    },
  };
}

function summarizeMapStats(stats) {
  Object.values(stats).forEach((map) => {
    map.diff = map.roundsFor - map.roundsAgainst;
    map.avgFor = map.played ? Number((map.roundsFor / map.played).toFixed(1)) : 0;
    map.avgAgainst = map.played ? Number((map.roundsAgainst / map.played).toFixed(1)) : 0;
    map.winRate = map.played ? Math.round((map.wins / map.played) * 100) : 0;
  });

  return Object.values(stats).sort((a, b) => b.played - a.played || b.winRate - a.winRate || a.name.localeCompare(b.name));
}

function teamMapFromRaw(rawMap, fixture, teamId) {
  const teamSide = fixture.side;
  const teamScore = teamSide === "home" ? rawMap.home_score : rawMap.away_score;
  const opponentScore = teamSide === "home" ? rawMap.away_score : rawMap.home_score;
  const startingSide = teamSide === "home" ? rawMap.homeside?.remote_id : rawMap.awayside?.remote_id;
  const won = teamScore !== null && opponentScore !== null && teamScore > opponentScore;

  return {
    id: rawMap.id,
    number: rawMap.map_number,
    name: text(rawMap.resource?.name || rawMap.map?.name || rawMap.name || "Unknown"),
    image: text(rawMap.resource?.image?.url || rawMap.map?.image?.url || rawMap.image?.url),
    scoreFor: teamScore ?? null,
    scoreAgainst: opponentScore ?? null,
    won,
    finished: Boolean(rawMap.finished_at),
    startingSide: text(startingSide || "unknown").toLowerCase() || "unknown",
    pickedSide: rawMap.picks_side === teamSide,
    opponent: fixture.opponent,
    matchId: fixture.id,
    startsAt: fixture.startsAt,
    round: fixture.round,
  };
}

async function getMatchMaps(matchId) {
  try {
    const response = await getJson(`https://www.ggarena.no/api/paradise/matchup/${matchId}/maps`);
    return Array.isArray(response.data) ? response.data : [];
  } catch {
    return [];
  }
}

async function getTeamMembers(teamId) {
  try {
    const response = await getJson(`https://www.ggarena.no/api/paradise/team/${teamId}/members`);
    const members = Array.isArray(response.data) ? response.data : [];
    return members.map((member) => ({
      id: member.user?.id || member.id,
      name: text(member.user?.user_name || member.user?.common_name || member.user?.name),
      role: text(member.role),
      localizedRole: text(member.localized_role),
      avatar: text(member.user?.image?.url),
      createdAt: member.user?.created_at || null,
      updatedAt: member.user?.updated_at || null,
      profileUrl: text(member.user?.url),
      steam: (member.user?.thirdparty_accounts || [])
        .filter((account) => account.provider?.acronym === "STEAM")
        .map((account) => ({
          id: text(account.account_id),
          nickname: text(account.nickname),
          url: text(account.url),
        }))[0] || null,
    }));
  } catch {
    return [];
  }
}

async function getUserMatches(userId) {
  try {
    const response = await getJson(`https://www.ggarena.no/api/paradise/user/${userId}/matches`);
    return Array.isArray(response.data) ? response.data : [];
  } catch {
    return [];
  }
}

function summarizePlayerMaps(matches) {
  const stats = {};
  matches.flatMap((match) => match.maps || []).forEach((map) => {
    stats[map.name] ||= emptyMapStats(map.name, map.image);
    const item = stats[map.name];
    item.image ||= map.image;
    item.played += 1;
    item.roundsFor += map.scoreFor || 0;
    item.roundsAgainst += map.scoreAgainst || 0;
    if (map.won) item.wins += 1;
    else item.losses += 1;
  });

  return summarizeMapStats(stats).slice(0, 4);
}

async function buildPlayerResearch(members, report) {
  const reportMatchesById = new Map(report.matches.map((match) => [match.id, match]));

  return Promise.all(
    members.map(async (member) => {
      const userMatches = await getUserMatches(member.id);
      const linkedIds = new Set(userMatches.map((match) => match.id));
      const matches = [...linkedIds]
        .map((id) => reportMatchesById.get(id))
        .filter(Boolean)
        .sort((a, b) => new Date(b.startsAt || 0) - new Date(a.startsAt || 0));
      const completed = matches.filter((match) => match.finished);
      const wins = completed.filter((match) => match.result === "W").length;
      const losses = completed.filter((match) => match.result === "L").length;
      const maps = completed.flatMap((match) => match.maps || []);
      const mapWins = maps.filter((map) => map.won).length;
      const mapLosses = maps.length - mapWins;

      return {
        ...member,
        source: "GG Arena user matches",
        matches: matches.length,
        completedMatches: completed.length,
        wins,
        losses,
        winRate: completed.length ? Math.round((wins / completed.length) * 100) : 0,
        maps: maps.length,
        mapWins,
        mapLosses,
        mapWinRate: maps.length ? Math.round((mapWins / maps.length) * 100) : 0,
        topMaps: summarizePlayerMaps(completed),
        recentMatches: completed.slice(0, 5).map((match) => ({
          id: match.id,
          opponent: match.opponent,
          startsAt: match.startsAt,
          result: match.result,
          score: match.score,
        })),
      };
    }),
  );
}

async function mergedTeamMatchups(match, team) {
  const response = await getJson(`https://www.ggarena.no/api/paradise/team/${team.id}/matchups`);
  const teamMatchups = Array.isArray(response) ? response : response.data || [];
  let divisionMatchups = [];

  if (match.divisionId) {
    const divisionResponse = await getJson(`https://www.ggarena.no/api/paradise/division/${match.divisionId}/matchups`);
    divisionMatchups = Array.isArray(divisionResponse) ? divisionResponse : divisionResponse.data || [];
  }

  const matchups = [...divisionMatchups, ...teamMatchups].reduce((items, item) => {
    if (!items.some((existing) => existing.id === item.id)) items.push(item);
    return items;
  }, []);

  return { matchups, teamMatchups };
}

async function buildTeamResearch(match, initialTeam) {
  let team = initialTeam;
  const { matchups, teamMatchups } = await mergedTeamMatchups(match, team);

  if (!team.name) {
    team = findTeamInMatchups(matchups, team.id) || team;
  }

  const teamMatchupIds = new Set(teamMatchups.map((item) => item.id));
  const fixtures = matchups
    .filter((item) => {
      const homeTeamId = signupTeamId(sideSignup(item, "home"));
      const awayTeamId = signupTeamId(sideSignup(item, "away"));
      return teamMatchupIds.has(item.id) || String(homeTeamId) === String(team.id) || String(awayTeamId) === String(team.id);
    })
    .filter((item) => !item.cancelled)
    .map((item) => simplifyFixture(item, team.id))
    .sort((a, b) => new Date(b.startsAt || 0) - new Date(a.startsAt || 0));

  const finished = fixtures.filter((fixture) => fixture.finished && !fixture.walkover);
  const mapsByMatch = await Promise.all(
    finished.map(async (fixture) => ({
      fixture,
      maps: (await getMatchMaps(fixture.id)).filter((map) => map.finished_at && map.home_score !== null && map.away_score !== null),
    })),
  );

  const mapStats = {};
  const mapHistory = [];

  mapsByMatch.forEach(({ fixture, maps }) => {
    maps.forEach((rawMap) => {
      const map = teamMapFromRaw(rawMap, fixture, team.id);
      if (!map.name) return;

      mapHistory.push(map);
      mapStats[map.name] ||= emptyMapStats(map.name, map.image);
      const stats = mapStats[map.name];
      stats.image ||= map.image;
      stats.played += 1;
      stats.roundsFor += map.scoreFor || 0;
      stats.roundsAgainst += map.scoreAgainst || 0;

      if (map.won) stats.wins += 1;
      else stats.losses += 1;

      const side = ["t", "ct"].includes(map.startingSide) ? map.startingSide : "unknown";
      stats.startingSides[side].played += 1;
      if (map.won) stats.startingSides[side].wins += 1;
      else stats.startingSides[side].losses += 1;
    });
  });

  const completedMatches = fixtures.filter((fixture) => fixture.finished);
  const matchWins = completedMatches.filter((fixture) => fixture.result === "W").length;
  const matchLosses = completedMatches.filter((fixture) => fixture.result === "L").length;
  const mapWins = mapHistory.filter((map) => map.won).length;
  const mapLosses = mapHistory.length - mapWins;
  const recentMatches = completedMatches.slice(0, 3);
  const recentWins = recentMatches.filter((fixture) => fixture.result === "W").length;
  const recentLosses = recentMatches.filter((fixture) => fixture.result === "L").length;
  const members = await getTeamMembers(team.id);
  const report = {
    team,
    members,
    summary: {
      matches: completedMatches.length,
      matchWins,
      matchLosses,
      matchWinRate: completedMatches.length ? Math.round((matchWins / completedMatches.length) * 100) : 0,
      recentMatches: recentMatches.length,
      recentWins,
      recentLosses,
      recentWinRate: recentMatches.length ? Math.round((recentWins / recentMatches.length) * 100) : 0,
      maps: mapHistory.length,
      mapWins,
      mapLosses,
      mapWinRate: mapHistory.length ? Math.round((mapWins / mapHistory.length) * 100) : 0,
      roundDiff: mapHistory.reduce((sum, map) => sum + ((map.scoreFor || 0) - (map.scoreAgainst || 0)), 0),
      avgRoundDiff: mapHistory.length
        ? Number((mapHistory.reduce((sum, map) => sum + ((map.scoreFor || 0) - (map.scoreAgainst || 0)), 0) / mapHistory.length).toFixed(1))
        : 0,
    },
    maps: summarizeMapStats(mapStats),
    matches: fixtures.map((fixture) => ({
      ...fixture,
      maps: mapHistory
        .filter((map) => map.matchId === fixture.id)
        .sort((a, b) => (a.number || 0) - (b.number || 0)),
    })),
  };
  report.players = await buildPlayerResearch(members, report);

  return report;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function selectedMapScore(report, selectedMapNames) {
  if (!selectedMapNames.length) return { score: 50, known: 0 };

  const values = selectedMapNames.map((name) => {
    const stats = report.maps.find((map) => map.name.toLowerCase() === name.toLowerCase());
    return stats ? stats.winRate : 50;
  });
  const known = selectedMapNames.filter((name) => report.maps.some((map) => map.name.toLowerCase() === name.toLowerCase())).length;
  const score = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { score, known };
}

function teamStrength(report, selectedMapNames) {
  const selected = selectedMapScore(report, selectedMapNames);
  const weights = selectedMapNames.length
    ? { match: 0.25, map: 0.25, round: 0.2, recent: 0.15, selected: 0.15 }
    : { match: 0.35, map: 0.3, round: 0.2, recent: 0.15, selected: 0 };
  const factors = {
    match: report.summary.matches ? report.summary.matchWinRate : 50,
    map: report.summary.maps ? report.summary.mapWinRate : 50,
    round: report.summary.maps ? clamp(50 + report.summary.avgRoundDiff * 3, 0, 100) : 50,
    recent: report.summary.recentMatches ? report.summary.recentWinRate : report.summary.matches ? report.summary.matchWinRate : 50,
    selected: selected.score,
  };
  const score = Object.entries(weights).reduce((sum, [key, weight]) => sum + factors[key] * weight, 0);
  const confidence = clamp(report.summary.matches / 5, 0, 1) * 0.45 + clamp(report.summary.maps / 10, 0, 1) * 0.45 + clamp(selected.known / 3, 0, 1) * 0.1;

  return {
    score: Number(score.toFixed(1)),
    confidence: Number(confidence.toFixed(2)),
    factors,
    selectedMapsKnown: selected.known,
  };
}

function probabilityReason(label, homeValue, awayValue, home, away) {
  const diff = homeValue - awayValue;
  const leader = diff > 0 ? home.team.name : diff < 0 ? away.team.name : "Even";
  return {
    label,
    home: Number(homeValue.toFixed(1)),
    away: Number(awayValue.toFixed(1)),
    edge: leader,
  };
}

function winProbability(home, away, match) {
  const selectedMapNames = (match.maps || []).filter((map) => map.name).map((map) => map.name);
  const homeStrength = teamStrength(home, selectedMapNames);
  const awayStrength = teamStrength(away, selectedMapNames);
  const rawHome = clamp(50 + (homeStrength.score - awayStrength.score) * 0.75, 10, 90);
  const confidence = Math.min(homeStrength.confidence, awayStrength.confidence);
  const homeProbability = Math.round(50 + (rawHome - 50) * (0.45 + confidence * 0.55));
  const awayProbability = 100 - homeProbability;

  return {
    home: homeProbability,
    away: awayProbability,
    confidence: Math.round(confidence * 100),
    model: "Heuristic: match record, map record, round differential, recent form, and selected-map history when veto maps exist.",
    selectedMaps: selectedMapNames,
    homeStrength,
    awayStrength,
    factors: [
      probabilityReason("Match win rate", home.summary.matchWinRate, away.summary.matchWinRate, home, away),
      probabilityReason("Map win rate", home.summary.mapWinRate, away.summary.mapWinRate, home, away),
      probabilityReason("Average round diff", home.summary.avgRoundDiff, away.summary.avgRoundDiff, home, away),
      probabilityReason("Recent form", home.summary.recentWinRate, away.summary.recentWinRate, home, away),
      probabilityReason("Selected-map score", homeStrength.factors.selected, awayStrength.factors.selected, home, away),
    ],
  };
}

async function scrapeOpponentResearch(matchId, teamId = null) {
  const match = await scrapeMatch(matchId);
  const target = teamId
    ? { team: teamId === String(match.home.id) ? match.home : teamId === String(match.away.id) ? match.away : { id: teamId } }
    : selectedOpponent(match);
  const [homeReport, awayReport] = await Promise.all([buildTeamResearch(match, match.home), buildTeamResearch(match, match.away)]);
  const opponentReport =
    String(target.team.id) === String(homeReport.team.id)
      ? homeReport
      : String(target.team.id) === String(awayReport.team.id)
        ? awayReport
        : await buildTeamResearch(match, target.team);

  return {
    generatedAt: new Date().toISOString(),
    source: "GG Arena team matchups, team members, and matchup maps",
    limitation: "GG Arena exposes team members, user-associated matches, and starting side on maps, but not player performance stats, lineups, or CT/T half round splits. Player records below are associated match history, not kill/death stats.",
    selectedMatch: {
      id: match.id,
      title: match.title,
      startsAt: match.startsAt,
      division: match.division,
      home: match.home,
      away: match.away,
    },
    prediction: winProbability(homeReport, awayReport, match),
    comparedTeams: {
      home: homeReport,
      away: awayReport,
    },
    team: opponentReport.team,
    members: opponentReport.members,
    players: opponentReport.players,
    summary: opponentReport.summary,
    maps: opponentReport.maps,
    matches: opponentReport.matches,
  };
}

function flatten(value, prefix = "", output = [], limit = 800) {
  if (value === null || value === undefined || output.length > limit) return output;

  if (Array.isArray(value)) {
    value.slice(0, 8).forEach((item, index) => flatten(item, `${prefix}[${index}]`, output, limit));
    return output;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      flatten(child, prefix ? `${prefix}.${key}` : key, output, limit);
    });
    return output;
  }

  output.push(`${prefix}: ${text(value).slice(0, 140)}`);
  return output;
}

async function scrapeMatch(matchId) {
  const page = await fetchPage(`${BASE_URL}/match/${matchId}`);
  let maps = [];

  try {
    const response = await getJson(`https://www.ggarena.no/api/paradise/matchup/${matchId}/maps`);
    maps = Array.isArray(response.data) ? response.data : [];
  } catch {
    maps = [];
  }

  const match = simplifyMatch(page, maps);

  let rawStats = [];
  try {
    const response = await getJson(`https://www.ggarena.no/api/paradise/matchup/${matchId}/stats`);
    rawStats = Array.isArray(response.data) ? response.data : [];
  } catch {
    rawStats = [];
  }

  if (rawStats.length > 0) {
    const homeMembers = await getTeamMembers(match.home.id);
    const awayMembers = await getTeamMembers(match.away.id);
    const homeUserIds = new Set(homeMembers.map((m) => String(m.id)));
    const awayUserIds = new Set(awayMembers.map((m) => String(m.id)));
    const membersMap = new Map();
    homeMembers.forEach((m) => membersMap.set(String(m.id), m));
    awayMembers.forEach((m) => membersMap.set(String(m.id), m));

    const parsedStats = rawStats.map((s) => {
      const uId = String(s.user?.id || s.paradise_user_id);
      const member = membersMap.get(uId);
      return {
        userId: uId,
        steamId: member?.steam?.id || null,
        name: text(s.player_name || s.user?.user_name || "Unknown"),
        kills: s.kills || 0,
        assists: s.assists || 0,
        deaths: s.deaths || 0,
        kdRatio: s.kd_ratio || "0",
        rating: s.rating || "0",
        headshotRatio: s.headshot_ratio || "0",
      };
    });

    match.home.stats = parsedStats
      .filter((s) => homeUserIds.has(s.userId))
      .sort((a, b) => Number(b.rating) - Number(a.rating));

    match.away.stats = parsedStats
      .filter((s) => awayUserIds.has(s.userId))
      .sort((a, b) => Number(b.rating) - Number(a.rating));
  } else {
    match.home.stats = [];
    match.away.stats = [];
  }

  return match;
}

async function scrapeTeamGames(matchId, teamId = null) {
  const page = await fetchPage(`${BASE_URL}/match/${matchId}`);
  const match = simplifyMatch(page, []);
  const divisionId = match.divisionId || DIVISION_ID;
  const response = await getJson(`https://www.ggarena.no/api/paradise/division/${divisionId}/matchups`);
  const matchups = Array.isArray(response) ? response : response.data || [];
  let teams = [match.home, match.away];

  if (teamId) {
    const selectedTeam =
      [match.home, match.away].find((team) => String(team.id) === String(teamId)) ||
      findTeamInMatchups(matchups, teamId);
    const opponent =
      selectedTeam && String(match.home.id) === String(selectedTeam.id)
        ? match.away
        : selectedTeam && String(match.away.id) === String(selectedTeam.id)
          ? match.home
          : null;

    teams = [selectedTeam, opponent].filter(Boolean);
  }

  return {
    matchId: match.id,
    division: match.division,
    selectedTeamId: teamId || null,
    teams: teams.map((team) => teamSchedule(team, matchups)),
  };
}

async function scrapeDivision() {
  const page = await fetchPage(`${BASE_URL}/division/${DIVISION_ID}`);
  return page;
}

async function scrapeTable(divisionId = DIVISION_ID, division = "") {
  const response = await getJson(`https://www.ggarena.no/api/paradise/division/${divisionId}/tables`);
  const rows = Array.isArray(response.data) ? response.data : [];

  return {
    divisionId,
    division,
    headers: ["#", "Lag", "K", "V", "U", "T", "+/-", "Straff", "P"],
    rows: rows.map((row) => {
      const diff = (row.score_for || 0) - (row.score_against || 0);
      return {
        placement: row.placement || "",
        team: displayTeamName(row.team?.name || row.display_name),
        played: row.played || 0,
        wins: row.wins || 0,
        draws: row.draws || 0,
        losses: row.losses || 0,
        diff: diff > 0 ? `+${diff}` : String(diff),
        penalty: row.penalty ? `-${row.penalty}` : "0",
        points: row.points || 0,
        status: text(row.status),
        logo: text(row.team?.logo?.url),
      };
    }),
  };
}

export { BASE_URL, DIVISION_ID, fetchPage, flatten, scrapeDivision, scrapeMatch, scrapeOpponentResearch, scrapeTeamGames, scrapeTable, simplifyMatch }


