const { app, BrowserWindow, screen } = require('electron')

app.on('ready', () => {
	const primaryDisplay = screen.getPrimaryDisplay()
	const { x, y, width, height } = primaryDisplay.bounds

	const browserWindow = new BrowserWindow({
		title: 'NeuronCast - HUD Overlay',
		alwaysOnTop: true,
		backgroundColor: '#00000000',
		focusable: false,
		transparent: true,
		frame: false,
		fullscreen: false,
		fullscreenable: false,
		hasShadow: false,
		resizable: false,
		show: false,
		skipTaskbar: true,
		x,
		y,
		width,
		height,
		webPreferences: {
			backgroundThrottling: false,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	})

	browserWindow.setIgnoreMouseEvents(true)
	browserWindow.setAlwaysOnTop(true, 'screen-saver')
	browserWindow.once('ready-to-show', () => {
		browserWindow.showInactive()
	})
	browserWindow.loadURL(`http://${process.env.HOST || 'localhost'}:${process.env.PORT || 31982}/hud?transparent&corners`)
	browserWindow.on('closed', () => app.quit() || null)
})

app.on('window-all-closed', () => {
	app.quit()
})
