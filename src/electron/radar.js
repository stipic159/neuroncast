const { app, BrowserWindow } = require('electron')

app.on('ready', () => {
	const browserWindow = new BrowserWindow({
		title: 'NeuronCast - Radar Overlay',
		autoHideMenuBar: true,
		backgroundColor: '#212121',
		width: 1280,
		height: 720,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	})

	browserWindow.loadURL(`http://${process.env.HOST || 'localhost'}:${process.env.PORT || 31982}/radar`)
	browserWindow.on('closed', () => app.quit())
})

app.on('window-all-closed', () => {
	app.quit()
})
