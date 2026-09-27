import { z } from 'zod'

/**
 * Zod schemas for validating GG Arena / Komplettligaen and external tournament payloads.
 * Uses .passthrough() so unexpected upstream fields don't cause validation failures.
 */

export const PlayerStatSchema = z.object({
	userId: z.string().optional(),
	steamId: z.string().nullable().optional(),
	name: z.string().default('Player'),
	kills: z.number().default(0),
	assists: z.number().default(0),
	deaths: z.number().default(0),
	kdRatio: z.union([z.string(), z.number()]).default('0'),
	rating: z.union([z.string(), z.number()]).default('0'),
	headshotRatio: z.union([z.string(), z.number()]).default('0'),
}).passthrough()

export const TeamSchema = z.object({
	id: z.union([z.string(), z.number()]).nullable().optional(),
	signupId: z.union([z.string(), z.number()]).nullable().optional(),
	name: z.string().default('Unknown Team'),
	logo: z.string().default(''),
	score: z.number().default(0),
	stats: z.array(PlayerStatSchema).default([]),
}).passthrough()

export const MapSchema = z.object({
	number: z.number().default(1),
	name: z.string().default('TBD Map'),
	image: z.string().default(''),
	status: z.string().default('scheduled'),
	homeScore: z.number().nullable().default(null),
	awayScore: z.number().nullable().default(null),
	finished: z.boolean().default(false),
	winner: z.string().nullable().default(null),
	pickedBy: z.string().default(''),
	homeStartSide: z.string().nullable().optional(),
	awayStartSide: z.string().nullable().optional(),
}).passthrough()

export const MatchupSchema = z.object({
	id: z.union([z.string(), z.number()]).nullable().optional(),
	component: z.string().optional(),
	competition: z.string().default('Tournament Broadcast'),
	divisionId: z.union([z.string(), z.number()]).nullable().optional(),
	division: z.string().default('Division'),
	round: z.string().default('Round TBD'),
	title: z.string().default('Home Team vs Away Team'),
	bestOf: z.number().default(3),
	startsAt: z.string().nullable().optional(),
	vetoOpensAt: z.string().nullable().optional(),
	status: z.string().default('scheduled'),
	spectateInfo: z.string().default(''),
	spectateUrl: z.string().default(''),
	home: TeamSchema,
	away: TeamSchema,
	series: z.object({
		home: z.number().default(0),
		away: z.number().default(0),
	}).default({ home: 0, away: 0 }),
	matchWinner: z.string().nullable().default(null),
	currentMap: MapSchema.nullable().optional(),
	maps: z.array(MapSchema).default([]),
	rawKeys: z.array(z.string()).default([]),
}).passthrough()

export const StandingsRowSchema = z.object({
	placement: z.union([z.string(), z.number()]).default(''),
	team: z.string().default(''),
	played: z.number().default(0),
	wins: z.number().default(0),
	draws: z.number().default(0),
	losses: z.number().default(0),
	diff: z.union([z.string(), z.number()]).default('0'),
	penalty: z.union([z.string(), z.number()]).default('0'),
	points: z.number().default(0),
	status: z.string().default(''),
	logo: z.string().default(''),
}).passthrough()

export const StandingsTableSchema = z.object({
	divisionId: z.union([z.string(), z.number()]).optional(),
	division: z.string().default(''),
	headers: z.array(z.string()).default(["#", "Lag", "K", "V", "U", "T", "+/-", "Straff", "P"]),
	rows: z.array(StandingsRowSchema).default([]),
}).passthrough()

export const TeamGamesSchema = z.object({
	matchId: z.union([z.string(), z.number()]).nullable().optional(),
	division: z.string().optional(),
	selectedTeamId: z.union([z.string(), z.number()]).nullable().optional(),
	teams: z.array(z.any()).default([]),
}).passthrough()
