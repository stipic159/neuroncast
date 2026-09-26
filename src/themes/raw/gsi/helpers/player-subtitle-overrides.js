import { options } from '/hud/core/state.js'

export const getPlayerSubtitleOverrides = () => {
	const playerSubtitleOverrides = new Map()

	const opt = options['teams.playerSubtitleOverrides']
	if (! opt?.trim()?.length) return playerSubtitleOverrides

	const lines = opt.trim().split('\n')

	for (const line of lines) {
		const segments = line.trim().split(/\s+/)
		if (
			segments.length < 2
			|| ! /^\d+$/.test(segments[0])
			|| ! segments[0].startsWith('7656')
			|| ! segments[1]
		) continue

		playerSubtitleOverrides.set(segments[0], segments.slice(1).join(' '))
	}

	return playerSubtitleOverrides
}
