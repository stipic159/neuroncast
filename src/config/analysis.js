import * as Vue from '/dependencies/vue.js'
import { bomb, grenades, map, options, players, radars } from '/hud/core/state.js'
import { connectToWebsocket, ws } from '/hud/core/websocket.js'
import { loadModule } from '/dependencies/vue3-sfc-loader.js'
import { sfcLoaderOptions } from '/dependencies/vue3-sfc-loader-options.js'

connectToWebsocket()

const app = Vue.createApp({
    template: `
        <div class="analysis-container">
            <div class="radar-container">
                <Radar />
                <SvgFilters />
            </div>
            <div class="drawing-layer">
                <canvas 
                    ref="drawingCanvas"
                    @mousedown="startDrawing"
                    @mousemove="draw"
                    @mouseup="stopDrawing"
                    @mouseleave="stopDrawing"
                    @touchstart="startDrawing"
                    @touchmove="draw"
                    @touchend="stopDrawing"
                ></canvas>
            </div>
            
            <div class="controls">
                <div class="drawing-palette">
                    <div 
                        v-for="color in colors" 
                        :key="color" 
                        class="color-dot" 
                        :class="{ '--active': drawingColor === color }"
                        :style="{ background: color }"
                        @click="drawingColor = color"
                    ></div>
                </div>
                <div class="drawing-sizes">
                    <button 
                        v-for="sz in sizes" 
                        :key="sz.value"
                        class="btn-size"
                        :class="{ '--active': drawingSize === sz.value }"
                        @click="drawingSize = sz.value"
                    >
                        {{ sz.label }}
                    </button>
                </div>
                <button class="btn-clear" @click="clearDrawing">Clear</button>
            </div>
        </div>
    `,
    data() {
        return {
            isDrawing: false,
            lastX: 0,
            lastY: 0,
            drawingColor: '#ff5a00',
            drawingSize: 5,
            colors: [
                '#ff5a00', '#3498db', '#2ecc71', '#f1c40f', '#ffffff', '#e74c3c',
                '#9b59b6', '#ff79c6', '#aaff00', '#00ffff', '#2c3e50', '#000000'
            ],
            sizes: [
                { label: 'Thin', value: 2 },
                { label: 'Medium', value: 5 },
                { label: 'Thick', value: 10 },
                { label: 'Marker', value: 20 }
            ]
        }
    },
    mounted() {
        window.addEventListener('resize', this.resizeCanvas)
        this.resizeCanvas()
        
        // Listen for drawing events from others via the global event bus
        window.addEventListener('socket:draw:line', this.handleSocketDrawLine)
        window.addEventListener('socket:draw:clear', this.handleSocketClear)
    },
    beforeUnmount() {
        window.removeEventListener('resize', this.resizeCanvas)
        window.removeEventListener('socket:draw:line', this.handleSocketDrawLine)
        window.removeEventListener('socket:draw:clear', this.handleSocketClear)
    },
    methods: {
        resizeCanvas() {
            const canvas = this.$refs.drawingCanvas
            if (!canvas) return
            const rect = canvas.parentElement.getBoundingClientRect()
            canvas.width = rect.width
            canvas.height = rect.height
        },
        
        handleSocketDrawLine(e) {
            const { x1, y1, x2, y2, color, size } = e.detail
            this.drawLineOnCanvas(x1, y1, x2, y2, color, size)
        },

        handleSocketClear() {
            const canvas = this.$refs.drawingCanvas
            if (!canvas) return
            const ctx = canvas.getContext('2d')
            ctx.clearRect(0, 0, canvas.width, canvas.height)
        },

        drawLineOnCanvas(x1, y1, x2, y2, color, size) {
            const canvas = this.$refs.drawingCanvas
            if (!canvas) return
            const ctx = canvas.getContext('2d')
            
            ctx.beginPath()
            ctx.moveTo(x1 * canvas.width, y1 * canvas.height)
            ctx.lineTo(x2 * canvas.width, y2 * canvas.height)
            
            ctx.strokeStyle = color
            ctx.lineWidth = size
            ctx.lineCap = 'round'
            ctx.stroke()
        },

        startDrawing(e) {
            this.isDrawing = true
            const pos = this.getCanvasPos(e)
            this.lastX = pos.x
            this.lastY = pos.y
        },

        draw(e) {
            if (!this.isDrawing) return
            const pos = this.getCanvasPos(e)
            
            const eventData = {
                x1: this.lastX,
                y1: this.lastY,
                x2: pos.x,
                y2: pos.y,
                color: this.drawingColor,
                size: this.drawingSize
            }

            // Sync with server
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ event: 'draw:line', body: eventData }))
            }

            // Local echo
            this.drawLineOnCanvas(this.lastX, this.lastY, pos.x, pos.y, this.drawingColor, this.drawingSize)

            this.lastX = pos.x
            this.lastY = pos.y
        },

        stopDrawing() {
            this.isDrawing = false
        },

        clearDrawing() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ event: 'draw:clear' }))
            }
            this.handleSocketClear()
        },

        getCanvasPos(e) {
            const canvas = this.$refs.drawingCanvas
            const rect = canvas.getBoundingClientRect()
            const clientX = e.touches ? e.touches[0].clientX : e.clientX
            const clientY = e.touches ? e.touches[0].clientY : e.clientY

            return {
                x: (clientX - rect.left) / rect.width,
                y: (clientY - rect.top) / rect.height
            }
        }
    }
})

app.component('Radar', Vue.defineAsyncComponent(() => loadModule('/hud/radar/radar.vue', sfcLoaderOptions)))
app.component('SvgFilters', Vue.defineAsyncComponent(() => loadModule('/hud/svg-filters/svg-filters.vue', sfcLoaderOptions)))

app.config.globalProperties.$bomb = bomb
app.config.globalProperties.$grenades = grenades
app.config.globalProperties.$map = map
app.config.globalProperties.$opts = options
app.config.globalProperties.$players = players
app.config.globalProperties.$radars = radars

app.mount('#app')
