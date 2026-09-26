		} catch (err) {
			// Silent 404
		}
	})

	server.listen(port, host)
	
	const interfaces = os.networkInterfaces()
	const addresses = []
	for (const k in interfaces) {
		for (const k2 in interfaces[k]) {
			const address = interfaces[k][k2]
			if (address.family === 'IPv4' && !address.internal) {
				addresses.push(address.address)
			}
		}
	}

	const exposedToNetwork = host !== '127.0.0.1' && host !== 'localhost' && host !== '::1'

	console.info(`\n[NeuronCast] CS2 Broadcast Server active at:`)
	console.info(` > Local Config:  http://localhost:${port}/config/`)
	console.info(` > Local Remote:  http://localhost:${port}/remote/`)
	console.info(` > Local HUD:     http://localhost:${port}/hud/`)

	if (exposedToNetwork) {
		const token = getControlToken()
		addresses.forEach(addr => {
			console.info(` > Mobile Remote: http://${addr}:${port}/remote/?token=${token}`)
		})
		console.info(`\n[Server] Bound to ${host} — control surface reachable from the network.`)
		console.info(`[Server] Remote control actions require token (?token=${token}).`)
	} else {
		console.info(`\n[Server] Bound to loopback (${host}). Set HOST=0.0.0.0 in .env to expose for phone over Wi-Fi.`)
	}
	if (isUiDevMode) {
		console.info('UI dev mode enabled: serving static match state and ignoring live GSI posts.')
	}
