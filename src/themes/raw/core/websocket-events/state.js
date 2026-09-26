import { additionalState, bombsites, gsiState, options, radars } from '/hud/core/state.js'
import { parseGsiState } from '/hud/core/parse-gsi-state.js'

let lastUpdateTs = 0

export const handleState = (body) => {
	// 1. Update timestamp and static data only if provided
	if (body.unixTimestamp) {
		additionalState.unixTimestamp = body.unixTimestamp
	}

	if (body.uiDevMode !== undefined) {
		additionalState.uiDevMode = body.uiDevMode
	}

	if (body.bombsites) Object.assign(bombsites, body.bombsites)
	if (body.radars) Object.assign(radars, body.radars)

	// 2. Handle GSI state update
	let hasGsiChanged = false
	if (body.gsiState) {
		Object.assign(gsiState, body.gsiState)
		hasGsiChanged = true
	}
	
	if (body.additionalState) {
		Object.assign(additionalState, body.additionalState)
		// Usually if additionalState comes in (win probability, etc), we want a re-parse
		hasGsiChanged = true
	}

	// 3. Merge options reactively
	if (body.options) {
		for (const [key, value] of Object.entries(body.options)) {
			options[key] = value
		}
		
		// Only perform a full destructive sync if this is a full 'state' event
		// or if static_data is specifically trying to rebuild the options.
		if (body.isFullState) {
			for (const key of Object.keys(options)) {
				if (!(key in body.options)) delete options[key]
			}
		}
	}

	// 4. Optimization: Only re-parse if core GSI data has actually updated
	if (hasGsiChanged && body.unixTimestamp !== lastUpdateTs) {
		lastUpdateTs = body.unixTimestamp
		parseGsiState()
	}
}
