const STEAM64_BASE = 76561197960265728n

/**
 * Validates if a string is a valid 17-digit SteamID64
 * @param {string} id 
 * @returns {boolean}
 */
export function isValidSteamID64(id) {
	return typeof id === 'string' && /^7656119\d{10}$/.test(id)
}

/**
 * Converts various Steam ID formats (Steam2, Steam3, AccountID, FastCup Profile ID)
 * into a canonical 64-bit SteamID64 string.
 * 
 * @param {string|number} input 
 * @returns {string|null} Canonical SteamID64 string or null if invalid
 */
export function toSteamID64(input) {
	if (input === null || input === undefined) return null

	const str = String(input).trim()
	if (!str) return null

	// Already SteamID64
	if (isValidSteamID64(str)) {
		return str
	}

	try {
		// 1. Steam2 format: STEAM_0:0:12345 or STEAM_1:1:67890
		const steam2Match = str.match(/^STEAM_[0-5]:([0-1]):(\d+)$/i)
		if (steam2Match) {
			const authServer = BigInt(steam2Match[1])
			const accountNumber = BigInt(steam2Match[2])
			const steam64 = STEAM64_BASE + (accountNumber * 2n) + authServer
			return steam64.toString()
		}

		// 2. Steam3 format: [U:1:12345678] or U:1:12345678
		const steam3Match = str.match(/^\[?U:1:(\d+)\]?$/i)
		if (steam3Match) {
			const accountId = BigInt(steam3Match[1])
			const steam64 = STEAM64_BASE + accountId
			return steam64.toString()
		}

		// 3. FastCup or Steam member profile URL: .../member/123456 or .../profiles/7656119...
		const profileUrlMatch = str.match(/(?:member|profiles|id)\/(\d+|[a-zA-Z0-9_-]+)/i)
		if (profileUrlMatch) {
			const segment = profileUrlMatch[1]
			if (isValidSteamID64(segment)) return segment
			if (/^\d+$/.test(segment)) {
				const num = BigInt(segment)
				if (num >= STEAM64_BASE) return num.toString()
				return (STEAM64_BASE + num).toString()
			}
		}

		// 4. Pure numeric Account ID (e.g. 12345678 or 24690)
		if (/^\d+$/.test(str)) {
			const num = BigInt(str)
			if (num >= STEAM64_BASE && isValidSteamID64(num.toString())) {
				return num.toString()
			}
			if (num > 0n && num < STEAM64_BASE) {
				return (STEAM64_BASE + num).toString()
			}
		}
	} catch (err) {
		return null
	}

	return null
}
