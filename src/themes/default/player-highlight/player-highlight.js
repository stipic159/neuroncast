// player-highlight.js - the spotlight card + a real CS2 agent model rendered in
// a frame above it, doing a procedural celebration keyed to the player's side.
// Triggered by eon-director's draw:highlight (re-dispatched as the DOM event
// socket:draw:highlight). Model + rig are the real exported CS2 agents (GLB,
// via Blender); the celebration is authored here on the rig's bones because
// CS2 ships no taunt animations.

const MODELS = {
	t: '/hud/player-highlight/models/t.glb',
	ct: '/hud/player-highlight/models/ct.glb',
}

// Rendered agent roster per side (files in renders/<key>.png/.webm). Each player
// hashes to a stable agent so the same player always gets "their" operator.
// Extended as the render farm finishes agents.
const AGENTS = {
	ct: ['ct-fbi', 'ct-sas', 'ct-swat', 'ct-st6', 'ct-heavy', 'ct-gendarmerie', 'ct-diver'],
	t: ['t-phoenix', 't-professional', 't-leet', 't-balkan', 't-jumpsuit', 't-jungleraider', 't-phoenixheavy'],
}

// exit choreography duration per FX kind (ms) - CSS animations match these
const EXIT_MS = { ace: 850, clutch: 950, multi: 500, damage: 650, mvp: 900, knife: 500, plain: 700 }
// weapons attach to the rig's weapon_hand_r bone (the in-game convention) and
// ride the baked idle animation. Local offset/rotation tuned in the preview rig
// (?phW=px,py,pz,rxDeg,ryDeg,rzDeg overrides live).
const WEAPONS = {
	t: '/hud/player-highlight/models/ak.glb',
	ct: '/hud/player-highlight/models/m4.glb',
}
const WEAPON_ATTACH = {
	t: { pos: [0, 0, 0], rot: [90, 35, 0] },
	ct: { pos: [0, 0, 0], rot: [90, 35, 0] },
}

// FACE_Y is the root yaw (radians) that turns each agent's FRONT to the camera.
// The two agents don't share a rest facing, so it's per-side and tuned by eye. A
// small positive bias gives a broadcast 3/4 hero angle rather than a flat mugshot.
// (Override live for tuning with ?phYaw=<deg> on the HUD URL.)
const D2R = Math.PI / 180
// front-to-camera is 270° per agent (measured); +16° gives a broadcast 3/4 hero angle
const FACE_Y = { t: 286 * D2R, ct: 286 * D2R }
// TARGET_H is the normalised world height the model is scaled to; framing is a
// waist-up portrait crop computed in frameActive().
const TARGET_H = 1.7
const BONE_H = 0.82 // bone-span ÷ full silhouette height (bones stop short of helmet/soles)
// Hero-stance poses as per-bone LOCAL euler deltas (radians) from the rest pose.
// Both agents share the Kutuza rig, so one set fits both. Optional sx/sy/sz add a
// subtle idle oscillation at frequency f (breathing/settle). Tuned by eye; probe
// live with ?phProbe=bone:axis:val,... and pick one with ?phPose=<name>.
const POSES = {
	// confident standing "operator" stance: arms held off the torso, a soft elbow
	// bend so they're not ramrod-straight, chest up, with a slow breathing idle.
	// The rig rests in an A-pose (upper arms ~25° abducted). A natural standing hang
	// needs ADDUCTION (negative z on the left, positive on the right) to bring the arms
	// down against the body, plus a soft elbow so forearms fall just in front of the
	// thighs - the "operator at ease" line from the reference cards.
	hero: [
		{ bone: 'arm_upper_l', z: -0.56, sz: 0.009, f: 1.0 }, { bone: 'arm_upper_r', z: 0.56, sz: -0.009, f: 1.0 },
		{ bone: 'arm_lower_l', x: 0.10 }, { bone: 'arm_lower_r', x: 0.10 },
		{ bone: 'spine_1', x: -0.02, sx: 0.008, f: 1.0 },
	],
}
const DEFAULT_POSE = { ct: 'hero', t: 'hero' }

export default {
	data() {
		// threeMode=false → the pre-rendered Cycles hero (turntable video loop,
		// still-image fallback). The animated WebGL model stays behind ?phThree.
		// showSeq bumps per spotlight so re-baked renders can never serve stale
		// from the browser cache (a long-lived HUD page never reloads).
		return { visible: false, leaving: false, steamid: null, tag: '', roundKills: 0, cardSide: null, threeMode: false, videoOk: true, perfOk: true, showSeq: 0 }
	},

	computed: {
		player() {
			if (! this.steamid) return null
			return (this.$players || []).find((p) => String(p.steam64Id) === this.steamid) || null
		},
		// prefer the side the director sent (it always knows it); fall back to the
		// $players lookup only when absent. A failed lookup used to default to CT
		// and mislabel T-side spotlights.
		sideKey() {
			if (this.cardSide === 't' || this.cardSide === 'ct') return this.cardSide
			return this.player?.side === 2 ? 't' : 'ct'
		},
		sideClass() {
			if (this.cardSide === 't') return '--t'
			if (this.cardSide === 'ct') return '--ct'
			const side = this.player?.side
			return side === 3 ? '--ct' : side === 2 ? '--t' : ''
		},
		// achievement family drives the FX identity + entrance/exit choreography
		fxKind() {
			const t = this.tag || ''
			if (/^MVP/i.test(t)) return 'mvp'
			if (/^ACE/i.test(t)) return 'ace'
			if (/^CLUTCH/i.test(t)) return 'clutch'
			if (/KNIFE/i.test(t)) return 'knife'
			if (/KILL$/i.test(t)) return 'multi'
			if (/DMG$/i.test(t)) return 'damage'
			return 'plain'
		},
		// stable per-player agent pick from the rendered roster
		agentKey() {
			const list = AGENTS[this.sideKey] || []
			if (!list.length) return this.sideKey
			let h = 0
			const s = this.steamid || ''
			for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
			return list[h % list.length]
		},
		renderSrc() {
			// per-show cache-buster: render files keep the same URL when re-baked,
			// and a long-lived HUD page would otherwise show stale art forever
			return `/hud/player-highlight/renders/${this.agentKey}.png?v=${this._bootTs || 0}-${this.showSeq}`
		},
		videoSrc() {
			return `/hud/player-highlight/renders/${this.agentKey}.webm?v=${this._bootTs || 0}-${this.showSeq}`
		},
		// native CS2 performance keyed to the achievement kind (Valve's own
		// animation on the agent - real hands/fingers, no bolt-on weapon). Plays
		// once and settles on its final stance; the turntable render is the
		// fallback when a pair hasn't been rendered or the option is off.
		perfSrc() {
			return `/hud/player-highlight/performances/${this.agentKey}-${this.fxKind}.webm?v=${this._bootTs || 0}-${this.showSeq}`
		},
		usePerf() {
			return !this.threeMode && this.perfOk
				&& this.$opts['director.cards.performances'] !== false
		},
	},

	watch: {
		visible(v) {
			if (v) this.$nextTick(() => this.startSmoke())
			else this.stopSmoke()
			if (!this.threeMode) return // pre-rendered hero: CSS handles show/hide
			if (v) this.showModel()
			else this.hideModel()
		},
		steamid() {
			this.videoOk = true // new spotlight → give the side's video a fresh chance
		},
	},

	mounted() {
		this._onDraw = (event) => {
			const body = event.detail || {}
			if (this._egQueue && !body._fromQueue) return // endgame sequence owns the card
			if (body.show === false) { this.beginExit(); return }
			if (this.$opts['director.cards.enabled'] === false) return // user turned cards off
			this.showCard(body)
		}
		// end-of-match showcase: a chain of cards played back to back, each with
		// its full entrance + exit choreography (draw:endgame {cards:[...]})
		this._onEndgame = (event) => {
			const cards = (event.detail && event.detail.cards) || []
			if (!cards.length) return
			if (this.$opts['director.cards.enabled'] === false) return
			if (this.$opts['director.cards.endgame'] === false) return
			this._egQueue = cards.slice()
			const next = () => {
				const card = this._egQueue && this._egQueue.shift()
				if (!card) { this._egQueue = null; this.beginExit(); return }
				this.showCard({ ...card, _fromQueue: true })
				this._egTimer = setTimeout(() => {
					this.beginExit(() => setTimeout(next, 350))
				}, card.holdMs || 6000)
			}
			next()
		}
		this._bootTs = Date.now()
		window.addEventListener('socket:draw:highlight', this._onDraw)
		window.addEventListener('socket:draw:endgame', this._onEndgame)
		// ?phYaw=<deg> overrides facing for both sides (live orientation tuning)
		const q = new URLSearchParams(window.location.search)
		this._yawOverride = q.has('phYaw') ? parseFloat(q.get('phYaw')) * D2R : null
		this._restPose = q.has('phRest') // diagnostic: hold the standing pose, no gesture
		this._poseName = q.get('phPose') || null
		this._probe = q.has('phProbe') ? q.get('phProbe').split(',').map((s) => {
			const [bone, axis, val] = s.split(':')
			return { bone, [axis]: parseFloat(val) }
		}) : null
		this._weaponOverride = q.has('phW') ? q.get('phW').split(',').map(parseFloat) : null
		if (q.has('phThree')) this.threeMode = true // dev flag: the animated WebGL model
		if (this.threeMode) this.initThree()
	},

	beforeUnmount() {
		window.removeEventListener('socket:draw:highlight', this._onDraw)
		window.removeEventListener('socket:draw:endgame', this._onEndgame)
		if (this._hideTimer) clearTimeout(this._hideTimer)
		if (this._exitTimer) clearTimeout(this._exitTimer)
		if (this._egTimer) clearTimeout(this._egTimer)
		this.stopSmoke()
		this.disposeThree()
	},

	methods: {
		// show a spotlight card (from a live event or the endgame queue)
		showCard(body) {
			if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null }
			if (this._exitTimer) { clearTimeout(this._exitTimer); this._exitTimer = null }
			this.leaving = false
			this._exitAt = 0
			this.steamid = body.steamid != null ? String(body.steamid) : null
			this.tag = body.tag || 'HIGHLIGHT'
			this.roundKills = body.roundKills || 0
			this.cardSide = body.side === 't' || body.side === 'ct' ? body.side : null
			this.perfOk = true // each show retries: kind/agent pair may exist now
			this.showSeq++
			this.visible = true
			// re-arm the FX engine so back-to-back spotlights get their own identity
			this.stopSmoke()
			this.$nextTick(() => this.startSmoke())
			if (body.durationMs > 0) this._hideTimer = setTimeout(() => this.beginExit(), body.durationMs)
		},

		// per-kind exit choreography: flag `leaving` (CSS plays the exit), tell the
		// FX engine (ember burst / flatline / final bolt), then actually hide
		beginExit(done) {
			if (!this.visible || this.leaving) { if (done) done(); return }
			this.leaving = true
			this._exitAt = performance.now() / 1000
			const ms = EXIT_MS[this.fxKind] || 700
			this._exitTimer = setTimeout(() => {
				this.visible = false
				this.leaving = false
				this._exitAt = 0
				if (done) done()
			}, ms)
		},

		// ── per-achievement FX engine: two canvases (rear = rays/glow behind the
		//    hero, front = smoke/sparks/embers/lightning) with a distinct identity
		//    per kind. ACE is the crown jewel: gold god-rays, shockwave rings,
		//    spark bursts, rising embers. Clutch = crimson heartbeat. Multi-kill =
		//    electric arcs. Damage = heat embers. Plain = side-tinted mystic smoke.
		startSmoke() {
			const front = this.$refs.smoke
			const back = this.$refs.fxback
			if (!front || this._smokeRaf) return
			const fc = front.getContext('2d')
			const bc = back ? back.getContext('2d') : null
			const vh = window.innerHeight || 1080
			const W = Math.round(vh * 0.34), H = Math.round(vh * 0.32)
			front.width = W; front.height = H
			if (back) { back.width = W; back.height = H }

			const THEMES = {
				ace: { tint: '255,200,80', tint2: '255,240,190', smoke: 8, rays: 7, rings: true, sparks: 46, embers: 26 },
				mvp: { tint: '186,140,255', tint2: '240,228,255', smoke: 10, rays: 9, rings: true, sparks: 30, embers: 18 },
				clutch: { tint: '255,72,64', tint2: '255,150,130', smoke: 20, pulse: 1.15, embers: 10 },
				multi: { tint: '120,190,255', tint2: '220,240,255', smoke: 8, bolts: true, sparks: 22 },
				knife: { tint: '210,220,235', tint2: '255,245,248', smoke: 6, slashes: true, sparks: 16 },
				damage: { tint: '255,140,50', tint2: '255,210,150', smoke: 14, embers: 20 },
				plain: { tint: null, tint2: '205,220,245', smoke: 16 },
			}
			const kind = this.fxKind
			const th = THEMES[kind] || THEMES.plain
			const tint = th.tint || (this.sideKey === 't' ? '224,165,59' : '110,165,230')
			const t0 = performance.now() / 1000
			const rnd = Math.random

			const puffs = Array.from({ length: th.smoke }, () => ({
				x: rnd(), y: 0.6 + rnd() * 0.5, r: 0.18 + rnd() * 0.26,
				vx: (rnd() - 0.5) * 0.0006, vy: -(0.0005 + rnd() * 0.001),
				a: 0.10 + rnd() * 0.12, ph: rnd() * Math.PI * 2,
			}))
			const embers = Array.from({ length: th.embers || 0 }, () => ({
				x: rnd(), y: 0.7 + rnd() * 0.4, r: 1.2 + rnd() * 2.2,
				vy: 0.0015 + rnd() * 0.0035, ph: rnd() * Math.PI * 2, sway: 0.0006 + rnd() * 0.001,
			}))
			// spark burst on entry (radial, gravity) - ACE gets a re-burst every 4s
			const mkSparks = () => Array.from({ length: th.sparks || 0 }, () => {
				const ang = rnd() * Math.PI * 2, sp = 0.004 + rnd() * 0.012
				return { x: 0.5, y: 0.42, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.7 - 0.003,
					life: 0.7 + rnd() * 0.9, born: t0, r: 0.8 + rnd() * 1.6 }
			})
			let sparks = mkSparks()
			let lastBurst = t0
			let bolt = null, boltUntil = 0, nextBolt = t0 + 0.3
			let slash = null, slashUntil = 0, nextSlash = t0 + 0.15
			let exitFxDone = false

			const tick = () => {
				this._smokeRaf = requestAnimationFrame(tick)
				const t = performance.now() / 1000
				const el = t - t0
				fc.clearRect(0, 0, W, H)
				if (bc) bc.clearRect(0, 0, W, H)

				// exit choreography hooks: fire once when beginExit() stamps _exitAt
				const exiting = this._exitAt > 0
				if (exiting && !exitFxDone) {
					exitFxDone = true
					if (kind === 'ace' || kind === 'mvp') sparks = sparks.concat(mkSparks(), mkSparks()) // ember explosion
					if (kind === 'multi') { // one last violent bolt
						bolt = [[0.5, -0.02], [0.44, 0.2], [0.55, 0.38], [0.47, 0.6], [0.52, 0.8]]
						boltUntil = t + 0.16
					}
					if (kind === 'knife') { // farewell cross-slash
						slash = [[0.05, 0.1, 0.95, 0.75], [0.92, 0.08, 0.1, 0.8]]
						slashUntil = t + 0.18
					}
				}
				// clutch flatline: heartbeat dies during the exit
				const pulseScale = exiting && th.pulse ? Math.max(0, 1 - (t - this._exitAt) / 0.7) : 1

				// ── rear canvas ──
				if (bc && th.rays) {
					// rotating golden god-rays from behind the head/chest
					const cx = W / 2, cy = H * 0.34
					bc.save()
					bc.translate(cx, cy)
					for (let i = 0; i < th.rays; i++) {
						const a0 = (i / th.rays) * Math.PI * 2 + t * 0.12
						const grad = bc.createLinearGradient(0, 0, Math.cos(a0) * W, Math.sin(a0) * W)
						grad.addColorStop(0, `rgba(${tint},${0.16 * Math.min(1, el / 0.8)})`)
						grad.addColorStop(1, 'rgba(0,0,0,0)')
						bc.fillStyle = grad
						bc.beginPath()
						bc.moveTo(0, 0)
						bc.arc(0, 0, W, a0 - 0.09, a0 + 0.09)
						bc.closePath()
						bc.fill()
					}
					bc.restore()
				}
				if (bc && th.pulse) {
					// clutch heartbeat: double-thump glow behind the hero
					const ph = (t % th.pulse) / th.pulse
					const beat = Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 10)
						+ 0.55 * Math.pow(Math.max(0, Math.sin((ph - 0.14) * Math.PI * 2)), 10)
					const g = bc.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.55)
					g.addColorStop(0, `rgba(${tint},${(0.10 + 0.20 * beat) * pulseScale})`)
					g.addColorStop(1, 'rgba(0,0,0,0)')
					bc.fillStyle = g
					bc.fillRect(0, 0, W, H)
				}
				if (th.rings && el < 1.4) {
					// entry shockwave rings (front canvas so they cross the hero)
					for (const d of [0, 0.18, 0.36]) {
						const p = (el - d) / 0.9
						if (p <= 0 || p >= 1) continue
						fc.strokeStyle = `rgba(${tint},${0.5 * (1 - p)})`
						fc.lineWidth = 2.5 * (1 - p) + 0.5
						fc.beginPath()
						fc.arc(W / 2, H * 0.45, p * W * 0.62, 0, Math.PI * 2)
						fc.stroke()
					}
				}

				// ── front canvas: smoke ──
				for (const p of puffs) {
					p.x += p.vx + Math.sin(t * 0.4 + p.ph) * 0.0004
					p.y += p.vy
					if (p.y < -p.r) { p.y = 1 + p.r * 0.5; p.x = rnd() }
					const g = fc.createRadialGradient(p.x * W, p.y * H, 0, p.x * W, p.y * H, Math.max(8, p.r * W))
					const a = p.a * (0.75 + 0.25 * Math.sin(t * 0.7 + p.ph * 3))
					g.addColorStop(0, `rgba(${tint},${a})`)
					g.addColorStop(0.55, `rgba(${th.tint2},${a * 0.3})`)
					g.addColorStop(1, 'rgba(0,0,0,0)')
					fc.fillStyle = g
					fc.fillRect(0, 0, W, H)
				}
				// embers: bright rising motes
				for (const e of embers) {
					e.y -= e.vy * (0.7 + 0.3 * Math.sin(t + e.ph))
					e.x += Math.sin(t * 1.3 + e.ph) * e.sway
					if (e.y < -0.05) { e.y = 1.05; e.x = rnd() }
					const a = 0.35 + 0.35 * Math.sin(t * 3 + e.ph)
					fc.fillStyle = `rgba(${th.tint2},${Math.max(0, a)})`
					fc.beginPath()
					fc.arc(e.x * W, e.y * H, e.r, 0, Math.PI * 2)
					fc.fill()
				}
				// sparks: entry burst (+ ACE re-burst)
				if (th.sparks) {
					if (kind === 'ace' && t - lastBurst > 4) { sparks = sparks.concat(mkSparks()); lastBurst = t }
					sparks = sparks.filter((s) => t - s.born < s.life)
					for (const s of sparks) {
						const age = t - s.born
						s.vy += 0.00018 // gravity
						s.x += s.vx; s.y += s.vy
						const a = Math.max(0, 1 - age / s.life)
						fc.fillStyle = `rgba(${th.tint2},${0.9 * a})`
						fc.beginPath()
						fc.arc(s.x * W, s.y * H, s.r * a + 0.4, 0, Math.PI * 2)
						fc.fill()
					}
				}
				// lightning: brief jagged arcs for multi-kill
				if (th.bolts) {
					if (t > nextBolt) {
						const x0 = 0.18 + rnd() * 0.64
						const pts = [[x0, -0.02]]
						let x = x0
						for (let y = 0.08; y < 0.55 + rnd() * 0.2; y += 0.07 + rnd() * 0.06) {
							x += (rnd() - 0.5) * 0.14
							pts.push([x, y])
						}
						bolt = pts
						boltUntil = t + 0.1 + rnd() * 0.08
						nextBolt = t + 0.45 + rnd() * 0.9
					}
					if (bolt && t < boltUntil) {
						fc.strokeStyle = `rgba(${th.tint2},0.85)`
						fc.lineWidth = 1.6
						fc.shadowColor = `rgb(${tint})`
						fc.shadowBlur = 10
						fc.beginPath()
						bolt.forEach(([bx, by], i) => (i ? fc.lineTo(bx * W, by * H) : fc.moveTo(bx * W, by * H)))
						fc.stroke()
						fc.shadowBlur = 0
					}
				}
				// knife: razor slash streaks flashing across the stage
				if (th.slashes || (slash && t < slashUntil)) {
					if (th.slashes && t > nextSlash && (!slash || t >= slashUntil)) {
						const fromLeft = rnd() > 0.5
						slash = [[fromLeft ? -0.05 : 1.05, 0.1 + rnd() * 0.3, fromLeft ? 1.05 : -0.05, 0.5 + rnd() * 0.35]]
						slashUntil = t + 0.09
						nextSlash = t + 1.6 + rnd() * 1.8
					}
					if (slash && t < slashUntil) {
						for (const [x1, y1, x2, y2] of slash) {
							const grad = fc.createLinearGradient(x1 * W, y1 * H, x2 * W, y2 * H)
							grad.addColorStop(0, 'rgba(255,255,255,0)')
							grad.addColorStop(0.5, `rgba(${th.tint2},0.95)`)
							grad.addColorStop(1, 'rgba(255,255,255,0)')
							fc.strokeStyle = grad
							fc.lineWidth = 2.2
							fc.shadowColor = 'rgb(255,80,90)'
							fc.shadowBlur = 8
							fc.beginPath()
							fc.moveTo(x1 * W, y1 * H)
							fc.lineTo(x2 * W, y2 * H)
							fc.stroke()
							fc.shadowBlur = 0
						}
					}
				}
			}
			tick()
		},
		stopSmoke() {
			if (this._smokeRaf) cancelAnimationFrame(this._smokeRaf)
			this._smokeRaf = 0
		},

		// a hero render failed to load → fall back to the live WebGL model
		onRenderError() {
			if (this.threeMode) return
			this.threeMode = true
			this.$nextTick(() => {
				if (!this._three) this.initThree()
				if (this.visible) this.showModel()
			})
		},

		// ── three.js fallback: renderer/scene created once, models lazy-loaded ──
		initThree() {
			const THREE = window.THREE
			const canvas = this.$refs.canvas
			if (!THREE || !THREE.GLTFLoader || !canvas) return

			const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
			renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
			if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding
			// filmic tone mapping - the single biggest quality lift: rolls off highlights
			// and adds contrast so the render reads cinematic instead of flat/linear.
			renderer.toneMapping = THREE.ACESFilmicToneMapping
			renderer.toneMappingExposure = 0.88 // keep light palettes out of the ACES white rolloff
			renderer.shadowMap.enabled = true
			renderer.shadowMap.type = THREE.PCFSoftShadowMap

			const scene = new THREE.Scene()
			const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
			camera.position.set(0, 1.0, 3)
			camera.lookAt(0, 1.05, 0)

			// LOW-KEY hero lighting (per cinematography: minimal fill, underexposed base,
			// rim ≈ key for a dramatic outline). The figure sits mostly in shadow; a bright
			// COOL rim carves the silhouette, a warm high-side key models the lit half, and
			// only a whisper of cool fill keeps the shadow side from going black. This is
			// what separates a pro character card from a flat, sun-straight-on render.
			scene.add(new THREE.HemisphereLight(0x9db8dd, 0x11151d, 0.3))
			const key = new THREE.DirectionalLight(0xffedd2, 2.3) // warm, high and to the side
			key.position.set(3.2, 4.4, 1.8)
			key.castShadow = true
			key.shadow.mapSize.set(2048, 2048)
			key.shadow.camera.near = 0.5
			key.shadow.camera.far = 16
			key.shadow.camera.left = -1.8
			key.shadow.camera.right = 1.8
			key.shadow.camera.top = 2.8
			key.shadow.camera.bottom = -0.6
			key.shadow.bias = -0.0005
			key.shadow.radius = 6
			scene.add(key)
			const fill = new THREE.DirectionalLight(0xaec6ff, 0.4) // soft cool fill (realtime has no GI bounce)
			fill.position.set(-2.8, 1.4, 2.5)
			scene.add(fill)
			const rim = new THREE.DirectionalLight(0x9ecbff, 3.6) // bright cool back-rim (tinted per side)
			rim.position.set(-2.7, 2.9, -3.4)
			scene.add(rim)
			const rim2 = new THREE.DirectionalLight(0xdfe8ff, 1.3) // opposite kicker for the other silhouette edge
			rim2.position.set(2.9, 2.3, -3.1)
			scene.add(rim2)
			// dim image-based lighting: subtle gear reflections only, NOT a flat fill that
			// would wash out the low-key contrast (envMapIntensity kept low on materials too)
			scene.environment = this.buildEnv(THREE, renderer)

			// transparent ground that only catches the key's shadow, grounding the agent
			const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.55 }))
			ground.rotation.x = -Math.PI / 2
			ground.position.y = 0.002
			ground.receiveShadow = true
			scene.add(ground)

			this._three = { THREE, renderer, scene, camera, rim, key, models: {}, loading: {}, active: null, clock: new THREE.Clock(), raf: 0 }
			if (typeof window !== 'undefined') window.__phScene = scene // diagnostics hook
			// models load lazily (only the side a highlight needs) so a phone never
			// fetches+parses both agents up front.
			this.resize()
			this._onResize = () => this.resize()
			window.addEventListener('resize', this._onResize)
		},

		// a tiny studio environment (emissive panels) baked to a PMREM cube so
		// the agent picks up soft image-based light instead of reading flat.
		buildEnv(THREE, renderer) {
			const s = new THREE.Scene()
			s.background = new THREE.Color(0x2b323c)
			const panel = (hex, intensity, x, y, z, w, h) => {
				const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial())
				m.material.color.setHex(hex).multiplyScalar(intensity)
				m.position.set(x, y, z)
				m.lookAt(0, 1, 0)
				s.add(m)
			}
			// a proper studio env - the realtime stand-in for GI bounce
			panel(0xffffff, 3.0, 0, 6, 3, 9, 9)     // overhead key
			panel(0x9cc0ff, 2.6, -6, 2, -2, 7, 9)   // cool wall
			panel(0xffc48a, 1.7, 6, 1, 0, 6, 7)     // warm bounce
			panel(0xbfd2ee, 1.2, 0, 2, 7, 8, 8)     // soft front bounce (keeps faces lit)
			panel(0x1a1e26, 1.0, 0, -4, 2, 10, 6)   // dark floor
			const pmrem = new THREE.PMREMGenerator(renderer)
			const tex = pmrem.fromScene(s, 0.02).texture
			pmrem.dispose()
			return tex
		},

		// bounds of the posed body from BONE world positions. This is the reliable
		// signal for these agents: the mesh geometry is authored far from the armature
		// origin (so setFromObject / boneTransform-based bounds are wrong or inflated),
		// but the bones sit on the actual body and move/rotate with it. Falls back to
		// the object box only if the rig somehow has no bones.
		boneBounds(THREE, bones, root) {
			const box = new THREE.Box3()
			const v = new THREE.Vector3()
			let any = false
			for (const b of Object.values(bones)) { b.getWorldPosition(v); box.expandByPoint(v); any = true }
			if (!any) box.setFromObject(root)
			return box
		},

			// load a side's model on demand (only what a highlight needs)
			ensureSide(side) {
				const t = this._three
				if (!t || t.models[side] || t.loading[side]) return
				t.loading[side] = true
				this.loadModel(side, MODELS[side])
			},

		// resolved facing yaw for a side (query override wins, else the per-side tuned value)
		faceYFor(side) {
			return this._yawOverride != null ? this._yawOverride : (FACE_Y[side] || 0)
		},

		loadModel(side, url) {
			const t = this._three
			if (!t) return
			const { THREE, scene } = t
			new THREE.GLTFLoader().load(url, (gltf) => {
				const root = gltf.scene
				root.updateWorldMatrix(true, true)

				// collect bones + rebuild materials (shared fixer - the CS2->glTF
				// export's MeshPhysicalMaterials render invisible in r134).
				const bones = {}
				root.traverse((o) => { if (o.isBone) bones[o.name] = o })
				this.fixMaterials(THREE, root)

				// Measure the true body extent from BONE world positions. These meshes
				// are authored with geometry far from the armature origin, so
				// setFromObject / bind-pose bounds measure a phantom offset, not where
				// the skinned body renders. The bones sit on the real body and rotate
				// with it. Normalise height by MULTIPLYING the baked root scale (T
				// agents ship a tiny CS2-unit scale; setScalar would clobber it).
				root.updateWorldMatrix(true, true)
				let bb = this.boneBounds(THREE, bones, root)
				root.scale.multiplyScalar((TARGET_H * BONE_H) / (bb.getSize(new THREE.Vector3()).y || 1))
				root.updateWorldMatrix(true, true)
				bb = this.boneBounds(THREE, bones, root)
				const center = bb.getCenter(new THREE.Vector3())
				const height = bb.getSize(new THREE.Vector3()).y / BONE_H // ≈ true silhouette height

				// Put the body's vertical centre-axis on the world origin and feet ~ y=0
				// inside a pivot group. Facing then rotates the PIVOT, spinning the agent
				// in place instead of orbiting it off-frame around the distant origin.
				const pivot = new THREE.Group()
				pivot.add(root)
				root.position.x -= center.x
				root.position.z -= center.z
				root.position.y -= bb.min.y
				pivot.rotation.y = this.faceYFor(side)
				root.visible = false
				scene.add(pivot)

				const rest = {}
				for (const [name, b] of Object.entries(bones)) rest[name] = b.rotation.clone()

				// the Blender-baked idle: play it looped - the model breathes, sways
				// and drifts its gaze without any procedural posing here.
				let mixer = null
				if (gltf.animations && gltf.animations.length) {
					mixer = new THREE.AnimationMixer(root)
					mixer.clipAction(gltf.animations[0]).play()
				}

				t.models[side] = { pivot, root, bones, rest, height, side, mixer }
				t.loading[side] = false
				this.loadWeapon(side, t.models[side])
				if (this.visible && this.sideKey === side) this.showModel()
			}, undefined, (err) => {
				t.loading[side] = false
				console.log('[ph] model load failed', side, err && err.message)
			})
		},

		// shared material fixer: replace the export's MeshPhysicalMaterials with
		// clean lit StandardMaterials carrying the base-colour + normal maps.
		fixMaterials(THREE, root) {
			root.traverse((o) => {
				if (o.isMesh && o.material) {
					o.frustumCulled = false
					o.castShadow = true
					o.receiveShadow = true
					const hasAO = !!(o.geometry && o.geometry.attributes && o.geometry.attributes.color)
					const mats = Array.isArray(o.material) ? o.material : [o.material]
					// a mesh may mix mapped + unmapped slots (export drops some node
					// setups); let unmapped slots borrow a mapped sibling's texture so
					// half the cloth doesn't render bleached
					const sibling = mats.find((mt) => mt.map)
					const rebuilt = mats.map((mt) => {
						if (!mt.map && sibling) mt = sibling
						const hasMap = !!mt.map
						// KEEP the original baseColorFactor: the pack tints shared grayscale
						// textures per-variant through it (dropping it bleaches the cloth).
						let col = mt.color ? mt.color.getHex() : 0xffffff
						if (!hasMap && col === 0x000000) col = 0x8a8f96
						const std = new THREE.MeshStandardMaterial({
							map: mt.map || null,
							normalMap: mt.normalMap || null,
							color: col,
							metalness: 0.05,
							roughness: 0.62,
							envMapIntensity: 1.0,
							side: THREE.DoubleSide,
							vertexColors: hasAO, // baked AO rides COLOR_0 → GI-like creases
						})
						if (std.map) std.map.encoding = THREE.sRGBEncoding
						return std
					})
					o.material = Array.isArray(o.material) ? rebuilt : rebuilt[0]
				}
			})
		},

		// attach the side's weapon to the rig's weapon_hand_r bone (in-game
		// convention). It inherits the bone's animated transform, so it rides the
		// idle. Local offset/rot from WEAPON_ATTACH (?phW=px,py,pz,rx,ry,rz tunes).
		loadWeapon(side, m) {
			const t = this._three
			if (!t || !WEAPONS[side]) return
			const bone = m.bones.weapon_hand_r || m.bones.hand_r
			if (!bone) return
			const { THREE } = t
			new THREE.GLTFLoader().load(WEAPONS[side], (gltf) => {
				const wroot = gltf.scene
				this.fixMaterials(THREE, wroot)
				const cfg = WEAPON_ATTACH[side] || { pos: [0, 0, 0], rot: [0, 0, 0] }
				const o = this._weaponOverride
				const pos = o ? o.slice(0, 3) : cfg.pos
				const rot = o ? o.slice(3, 6) : cfg.rot
				wroot.position.set(pos[0] || 0, pos[1] || 0, pos[2] || 0)
				wroot.rotation.set((rot[0] || 0) * D2R, (rot[1] || 0) * D2R, (rot[2] || 0) * D2R)
				bone.add(wroot)
				m.weapon = wroot
			}, undefined, (err) => console.log('[ph] weapon load failed', side, err && err.message))
		},

		bone(m, ...names) {
			for (const n of names) {
				if (m.bones[n]) return m.bones[n]
				const hit = Object.keys(m.bones).find((k) => k.toLowerCase().includes(n))
				if (hit) return m.bones[hit]
			}
			return null
		},

		showModel() {
			const t = this._three
			if (!t) return
			this.ensureSide(this.sideKey) // kicks off the fetch if this side isn't loaded yet
			// keep the rim a COOL kicker for both sides (warm key + cool rim = cinematic
			// separation); the team colour lives in the card backdrop, not a warm wash
			if (t.rim) t.rim.color.set(this.sideKey === 't' ? 0xbcd2ee : 0x8fb6ff)
			for (const s of Object.keys(t.models)) if (t.models[s]) t.models[s].root.visible = false
			t.active = t.models[this.sideKey] || null // may be null until the load callback re-runs showModel
			if (t.active) t.active.root.visible = true
			t.clock.start()
			t.t0 = t.clock.getElapsedTime()
			this.resize() // the stage is laid out now; size the canvas buffer for real
			this.frameActive()
			this.startLoop()
		},

		// Frame like the reference hero cards: a WAIST-UP portrait crop - the operator
		// fills the frame, cropped at the upper thigh, head near the top. A tiny
		// full-body figure floating in a dark box reads like an action figure; the
		// tight crop is what makes the card (and the low-key light) read premium.
		// Recomputed on show and on resize, from the model's true measured height.
		frameActive() {
			const t = this._three
			const m = t && t.active
			if (!m) return
			const vfov = (t.camera.fov * Math.PI) / 180
			const h = m.height || TARGET_H
			if (this._restPose) { // diagnostic: whole body in frame
				const dist = (h / 0.6 / 2) / Math.tan(vfov / 2)
				t.camera.position.set(0, h * 0.5, dist)
				t.camera.lookAt(0, h * 0.5, 0)
				t.camera.updateProjectionMatrix()
				return
			}
			const top = h * 1.07     // slight headroom above the helmet
			const bottom = h * 0.30  // mid-thigh crop - keeps the carried rifle in frame
			const span = top - bottom
			const centerY = (top + bottom) / 2
			const dist = (span / 2) / Math.tan(vfov / 2)
			// camera sits below centre aiming up → the low hero angle from the refs
			t.camera.position.set(0, centerY - h * 0.07, dist)
			t.camera.lookAt(0, centerY + h * 0.01, 0)
			t.camera.updateProjectionMatrix()
		},

		hideModel() {
			const t = this._three
			if (!t) return
			cancelAnimationFrame(t.raf)
			t.raf = 0
			if (t.active) t.active.root.visible = false
		},

		startLoop() {
			const t = this._three
			if (!t || t.raf) return
			const tick = () => {
				t.raf = requestAnimationFrame(tick)
				this.animate()
				t.renderer.render(t.scene, t.camera)
			}
			t.raf = requestAnimationFrame(tick)
		},

		// ── procedural hero pose: ease the rig from rest into a confident standing
		//    stance, with a subtle breathing idle so it reads alive (not a mannequin) ──
		animate() {
			const t = this._three
			const m = t.active
			if (!m) return
			const time = t.clock.getElapsedTime() - (t.t0 || 0)
			const ease = (x) => x * x * (3 - 2 * x) // smoothstep
			const intro = this._restPose ? 0 : ease(Math.min(1, time / 0.7))
			const sway = Math.sin(time * 0.9) * 0.04

			m.pivot.rotation.y = this.faceYFor(m.side) + (this._restPose ? 0 : sway)
			m.pivot.position.y = this._restPose ? 0 : Math.sin(time * 1.8) * 0.008
			if (this._restPose) return // diagnostic: hold the raw rest pose

			// baked Blender idle: the mixer drives everything (stance + breathing +
			// head life); the procedural pose engine below is only a fallback for
			// models without a clip.
			if (m.mixer) {
				const dt = time - (t._lastT || time)
				t._lastT = time
				m.mixer.update(Math.max(0, dt))
				return
			}

			// apply the selected pose as eased LOCAL-euler deltas from rest, plus idle
			const pose = this._probe || POSES[this._poseName] || POSES[DEFAULT_POSE[m.side]] || []
			for (const d of pose) {
				const bone = this.bone(m, d.bone)
				if (!bone) continue
				const r = m.rest[bone.name]
				const idle = (a) => (a ? a * Math.sin(time * (d.f || 1.6)) : 0)
				bone.rotation.set(
					r.x + (d.x || 0) * intro + idle(d.sx),
					r.y + (d.y || 0) * intro + idle(d.sy),
					r.z + (d.z || 0) * intro + idle(d.sz),
				)
			}
		},

		resize() {
			const t = this._three
			const el = this.$refs.stage
			if (!t || !el) return
			// fall back to a vh-derived size if the stage isn't laid out yet
			const vh = window.innerHeight || 1080
			const w = el.clientWidth || Math.round(vh * 0.26)
			const h = el.clientHeight || Math.round(vh * 0.34)
			t.renderer.setSize(w, h, false)
			t.camera.aspect = w / h
			t.camera.updateProjectionMatrix()
			this.frameActive() // re-fit for the new aspect
		},

		disposeThree() {
			const t = this._three
			if (!t) return
			cancelAnimationFrame(t.raf)
			if (this._onResize) window.removeEventListener('resize', this._onResize)
			t.renderer.dispose()
			this._three = null
		},
	},
}
