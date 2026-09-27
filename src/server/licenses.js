import { readFile } from 'fs/promises'
import { builtinRootDirectory } from './helpers/paths.js'

export const registerLicensesRoutes = (router) => {
	router.get('/licenses', async (context) => {
		context.type = 'text/plain'

		try {
			const [licenseTxt, assetsLicenseTxt] = await Promise.all([
				readFile(`${builtinRootDirectory}/license.txt`, 'utf-8').catch(() => 'License information not found.'),
				readFile(`${builtinRootDirectory}/assets/licenses.txt`, 'utf-8').catch(() => 'Assets license information not found.'),
			])

			context.body = [
				'The source code of this software is available at https://github.com/drweissbrot/cs-hud.\n',
				'This software is licensed under:',
				licenseTxt,
				'-----\n',
				assetsLicenseTxt,
			].join('\n')
		} catch (err) {
			context.status = 500
			context.body = 'Failed to load licenses.'
		}
	})
}
