<template>
	<div class="layout-editor">
		<div class="editor-header">
			<div class="header-left">
				<h2>{{ $t("Layout Editor") }}</h2>
				<div class="preset-controls" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
					<select v-model="activePreset" @change="selectPreset" style="min-width: 160px; padding: 6px; background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; border-radius: 4px; font-size: 0.75rem;">
						<option value="">{{ $t("-- Active Canvas (Live) --") }}</option>
						<option v-for="p in presets" :key="p.id" :value="p.id">{{ p.name }}</option>
					</select>
					<button class="btn-secondary" :title="$t('Save current layout as a new preset')" @click="saveNewPreset">{{ $t("💾 Save As...") }}</button>
					<button v-if="activePreset && currentPresetIsCustom" class="btn-secondary" :title="$t('Save changes to active preset')" @click="saveActivePresetChanges">{{ $t("💾 Save Changes") }}</button>
					<button v-if="activePreset" class="btn-secondary" :title="$t('Duplicate active preset')" @click="duplicatePreset">{{ $t("👥 Duplicate") }}</button>
					<button v-if="activePreset && currentPresetIsCustom" class="btn-secondary --danger-btn" :title="$t('Delete custom preset')" @click="deletePreset">{{ $t("🗑️ Delete") }}</button>
					<button v-if="activePreset" class="btn-secondary" :title="$t('Apply preset coordinates to live HUD')" @click="applyPreset">{{ $t("🚀 Apply Live") }}</button>
					<span class="toolbar-divider">|</span>
					<button v-if="activePreset" class="btn-secondary" :title="$t('Export active preset as JSON')" @click="exportPreset">{{ $t("📤 Export") }}</button>
					<label class="btn-secondary" :title="$t('Import preset from JSON')" style="cursor: pointer; margin: 0; display: inline-flex; align-items: center; gap: 4px;">
						{{ $t("📥 Import") }}
						<input type="file" accept=".json" @change="importPreset" style="display: none;">
					</label>
				</div>
			</div>
			
			<div class="header-right">
				<!-- High-Fidelity Workbench Toggles -->
				<div class="workbench-toggles">
					<label class="toggle-control" :title="$t('Show/Hide CS2 Gameplay Screenshot')">
						<input type="checkbox" v-model="showBgImage">
						<span>{{ $t("🖼️ Background") }}</span>
					</label>
					<label class="toggle-control" :title="$t('Show/Hide Technical Alignment Grid')">
						<input type="checkbox" v-model="showGrid">
						<span>{{ $t("📐 Grid") }}</span>
					</label>
					<label class="toggle-control" :title="$t('Show/Hide Center Crosshairs')">
						<input type="checkbox" v-model="showCenterLines">
						<span>{{ $t("🎯 Center Lines") }}</span>
					</label>
					<label class="toggle-control" :title="$t('Show/Hide 10% TV Safe Area Outline')">
						<input type="checkbox" v-model="showSafeArea">
						<span>{{ $t("🛡️ Safe Area") }}</span>
					</label>
					<label class="toggle-control" :title="$t('Enable/Disable Snapping to Grid')">
						<input type="checkbox" v-model="snapEnabled">
						<span>{{ $t("🧲 Snap") }}</span>
					</label>
					<label class="toggle-control" :title="$t('Enable/Disable Composition Smart Snapping & Guides')">
						<input type="checkbox" v-model="smartGuidesEnabled">
						<span>{{ $t("🧲 Smart Guides") }}</span>
					</label>
					<label class="toggle-control" :title="$t('Show/Hide Live HUD Reference Iframe')">
						<input type="checkbox" v-model="showLiveHUDReference">
						<span>{{ $t("📺 Live HUD Reference") }}</span>
					</label>
				</div>
				
				<div class="grid-size-selector" style="display: flex; align-items: center; gap: 8px;">
					<span style="font-size: 0.8rem; color: #8b949e;">{{ $t("Grid Size:") }}</span>
					<select v-model="gridIdx" class="grid-select">
						<option v-for="(size, idx) in gridSizes" :key="size" :value="idx">
							{{ $text(size === 0 ? 'Off' : size + 'px') }}
						</option>
					</select>
				</div>
			</div>
		</div>

		<div class="editor-workspace">
			<!-- Canvas Stage Area -->
			<div class="canvas-container" ref="container">
				<div 
					class="viewport" 
					id="viewport"
					:style="viewportStyles"
				>
					<!-- Backdrop CS2 Screenshot (Visual only, does not affect values) -->
					<img 
						v-if="showBgImage" 
						src="https://csprofile.com/Images/Blog/best-cs2-screenshots/Screenshot_without_HUD.webp" 
						class="hud-screenshot-bg" 
						:alt="$t('CS2 Gameplay')"
					/>
					
					<!-- Live HUD Overlay Frame -->
					<iframe v-if="showLiveHUDReference" src="/hud/?transparent" class="hud-bg"></iframe>
					
					<!-- Technical Alignment Grid -->
					<div v-if="showGrid" class="tech-grid"></div>
					
					<!-- Center Lines -->
					<div v-if="showCenterLines" class="center-lines">
						<div class="center-line --vertical"></div>
						<div class="center-line --horizontal"></div>
					</div>
					
					<!-- 10% Broadcast safe area outline -->
					<div v-if="showSafeArea" class="safe-area-outline">
						<span class="safe-area-label">{{ $t("90% Broadcast Safe Area") }}</span>
					</div>
					
					<!-- Smart Snapping Visual Guidelines -->
					<div v-if="smartGuidesEnabled && activeSnapX" class="smart-guide --vertical" :style="{ left: `${activeSnapX.lineValue}px` }">
						<span class="smart-guide-label">{{ snapLabel(activeSnapX.label) }}</span>
					</div>
					<div v-if="smartGuidesEnabled && activeSnapY" class="smart-guide --horizontal" :style="{ top: `${activeSnapY.lineValue}px` }">
						<span class="smart-guide-label">{{ snapLabel(activeSnapY.label) }}</span>
					</div>
					
					<!-- Draggable High-Fidelity Elements -->
					<template v-if="!showLiveHUDReference">
						<div 
							v-for="el in sortedElements" 
							:key="el.def.id"
							:class="[
								'hud-el', 
								{ 
									'--active': selectedId === el.def.id, 
									'--hidden': !el.visible,
									'--outside-safe': showSafeArea && checkOutsideSafe(el),
									'--colliding': getCollidingElements(el).length > 0
								}
							]"
							:style="{
								top: `${el.top}px`,
								left: `${el.left}px`,
								width: `${el.w}px`,
								height: `${el.h}px`
							}"
							@mousedown.stop="startDrag($event, el, 'move')"
						>
							<div class="mock-content" :style="{ transformOrigin: getTransformOrigin(el.def.anchor.h) }">
								
								<!-- 1. TOP BAR -->
								<div v-if="el.def.id === 'top-bar'" class="mock-top-bar">
									<div class="mock-top-bar-team mock-team-ct">
										<span class="team-name">CT</span>
									</div>
									<div class="mock-top-bar-center">
										<span class="timer">{{ $t("TOP BAR") }}</span>
									</div>
									<div class="mock-top-bar-team mock-team-t">
										<span class="team-name">T</span>
									</div>
								</div>

								<!-- 2. RADAR -->
								<div v-else-if="el.def.id === 'radar'" class="mock-radar">
									<div class="radar-plate">
										<div class="radar-grid-vertical"></div>
										<div class="radar-grid-horizontal"></div>
									</div>
									<div class="mock-label-overlay">{{ $t("RADAR") }}</div>
								</div>

								<!-- 3. LEFT SIDEBAR -->
								<div v-else-if="el.def.id === 'sidebar-left'" class="mock-sidebar --left">
									<div v-for="i in 5" :key="i" class="mock-player-card">
										<div class="hp-bar" style="width: 100%;"></div>
										<span class="player-name">{{ $t("CT Player") }} {{ i }}</span>
									</div>
								</div>

								<!-- 4. RIGHT SIDEBAR -->
								<div v-else-if="el.def.id === 'sidebar-right'" class="mock-sidebar --right">
									<div v-for="i in 5" :key="i" class="mock-player-card">
										<span class="player-name">{{ $t("T Player") }} {{ i }}</span>
										<div class="hp-bar" style="width: 100%;"></div>
									</div>
								</div>

								<!-- 5. FOCUSED PLAYER -->
								<div v-else-if="el.def.id === 'focused-player'" class="mock-focused-player">
									<div class="player-details">
										<div class="details-top" style="justify-content: center;">
											<span class="player-name">{{ $t("FOCUSED PLAYER ACTIVE VIEW") }}</span>
										</div>
										<div class="details-bottom">
											<div class="hp-bar" style="width: 100%;"></div>
										</div>
									</div>
								</div>

								<!-- 6. PLAYERS ALIVE -->
								<div v-else-if="el.def.id === 'players-alive'" class="mock-players-alive">
									<div class="ct-alive">CT</div>
									<div class="vs-label">{{ $t("ALIVE") }}</div>
									<div class="t-alive">T</div>
								</div>

								<!-- 7. EVENT BADGE -->
								<div v-else-if="el.def.id === 'event-badge'" class="mock-event-badge">
									<div class="text" style="align-items: center; width: 100%;">
										<span class="title">{{ $t("EVENT BADGE") }}</span>
									</div>
								</div>

								<!-- 8. CURRENT MAP -->
								<div v-else-if="el.def.id === 'current-map'" class="mock-current-map">
									<div class="map-overlay" style="justify-content: center; background: rgba(0,0,0,0.5);">
										<span class="map-name">{{ $t("CURRENT MAP") }}</span>
									</div>
								</div>

								<!-- 9. SLEEK MAPS -->
								<div v-else-if="el.def.id === 'maps-sleek'" class="mock-maps-sleek">
									<div class="veto-bar">
										<span class="veto-item --active" style="width: 100%; border: none;">{{ $t("MAPS VETO") }}</span>
									</div>
								</div>

								<!-- 11. MOBILE TEXT / LOWER THIRD -->
								<div v-else-if="el.def.id === 'promotion-panel'" class="mock-promotion-panel">
									<div class="mock-promo-badge">⚡ {{ $t("PHONE TEXT") }}</div>
									<div class="mock-promo-title">{{ promotionTitle }}</div>
									<div class="mock-promo-subtitle">{{ mobileTickerText }}</div>
								</div>

								<!-- 10. SPONSORS LEFT/RIGHT -->
								<div v-else-if="el.def.id.startsWith('sponsor-')" class="mock-sponsor-panel" style="justify-content: center; align-items: center;">
									<span class="title">{{ $t("SPONSOR SLOT") }}</span>
								</div>

								<!-- FALLBACK WIREFRAME BOX -->
								<div v-else class="mock-box" :style="{ backgroundColor: el.def.color }">
									{{ $text(el.def.label) }}
								</div>
							</div>
							
							<!-- Resize Handles -->
							<template v-if="el.def.resizable && selectedId === el.def.id">
								<div 
									class="resize-handle --x" 
									:style="{ [el.def.anchor.h === 'left' || el.def.anchor.h === 'center' ? 'right' : 'left']: '-6px' }"
									@mousedown.stop="startDrag($event, el, 'resize-x')"
								></div>
								<div 
									v-if="!el.def.keepAspect"
									class="resize-handle --y" 
									@mousedown.stop="startDrag($event, el, 'resize-y')"
								></div>
							</template>
						</div>
					</template>
				</div>
			</div>

			<!-- Properties Sidebar with Technical Diagnostics -->
			<aside class="properties-sidebar">
				<div class="sidebar-header">
					<h3>{{ $t("Elements") }}</h3>
					<p class="sidebar-tip">{{ $t("Select items here if they are overlapping on the canvas.") }}</p>
				</div>
				
				<div class="element-list">
					<div 
						v-for="el in elements" 
						:key="el.def.id"
						:class="['element-item', { 
							'--active': selectedId === el.def.id,
							'--warning': showSafeArea && checkOutsideSafe(el) && el.visible,
							'--danger': getCollidingElements(el).length > 0 && el.visible
						}]"
						@click="selectElement(el.def.id)"
					>
						<span class="el-name">{{ $text(el.def.label) }}</span>
						<div style="display: flex; align-items: center; gap: 8px;">
							<span v-if="el.visible && getCollidingElements(el).length > 0" :title="$t('Collision detected')" style="font-size: 0.75rem;">💥</span>
							<span v-else-if="el.visible && showSafeArea && checkOutsideSafe(el)" :title="$t('Outside Safe Area')" style="font-size: 0.75rem;">⚠️</span>
							<button
								v-if="el.def.visibleKey"
								class="btn-icon"
								@click.stop="toggleVisibility(el)"
								:title="el.visible ? 'Hide' : 'Show'"
							>
								{{ el.visible ? '👁️' : '👁️‍🗨️' }}
							</button>
						</div>
					</div>
				</div>

				<!-- Right-side properties diagnostics inspector panel -->
				<div v-if="selectedElement" class="properties-panel">
					<h3>{{ $t("Properties:") }} {{ $text(selectedElement.def.label) }}</h3>
					
					<!-- 1. Anchor -->
					<div class="prop-group">
						<label>{{ $t("Anchor alignment") }}</label>
						<div class="prop-row" style="color: #58a6ff; font-weight: bold;">
							⚓ {{ $text(selectedElement.def.anchor.v) }} {{ $text(selectedElement.def.anchor.h) }}
						</div>
					</div>
					
					<!-- 2. Visibility state -->
					<div class="prop-group">
						<label>{{ $t("Visibility state") }}</label>
						<div class="prop-row" style="align-items: center;">
							<span :style="{ color: selectedElement.visible ? '#2ecc71' : '#8b949e', fontWeight: 'bold' }">
								{{ $text(selectedElement.visible ? '👁️ Visible (Active)' : '👁️‍🗨️ Hidden (Inactive)') }}
							</span>
						</div>
					</div>

					<!-- 3. Pixel coordinates -->
					<div class="prop-group">
						<label>{{ $t("Stage Position (1080p Pixels)") }}</label>
						<div class="prop-row" style="flex-direction: column; gap: 4px; font-family: monospace; font-size: 0.75rem; color: #adbac7;">
							<div class="coord-item">{{ $t("Canvas Left (X):") }} <span style="color: #fff; font-weight: bold;">{{ Math.round(selectedElement.left) }}px</span></div>
							<div class="coord-item">{{ $t("Canvas Top (Y):") }} <span style="color: #fff; font-weight: bold;">{{ Math.round(selectedElement.top) }}px</span></div>
							<div v-for="prop in selectedElement.def.props" :key="prop.key" class="coord-item">
								<span style="text-transform: capitalize;">{{ $text(prop.edge) }} {{ $t("Anchor") }}</span>: 
								<span style="color: #fff; font-weight: bold;">{{ Math.round(getPixelPositionByEdge(prop.edge)) }}px</span>
							</div>
						</div>
					</div>
					
					<!-- 4. Width/height -->
					<div class="prop-group">
						<label>{{ $t("Size Dimensions") }}</label>
						<div class="prop-row" style="flex-direction: column; gap: 4px; font-family: monospace; font-size: 0.75rem; color: #adbac7;">
							<div class="coord-item">{{ $t("Width:") }} <span style="color: #fff; font-weight: bold;">{{ Math.round(selectedElement.w) }}px</span></div>
							<div class="coord-item">{{ $t("Height:") }} <span style="color: #fff; font-weight: bold;">{{ Math.round(selectedElement.h) }}px</span></div>
						</div>
					</div>

					<!-- 5. Canonical rem options coordinates -->
					<div class="prop-group">
						<label>{{ $t("Canonical Options Save Keys") }}</label>
						<div class="prop-row --canonical-keys" style="flex-direction: column; gap: 6px; font-family: monospace; font-size: 0.7rem; background: #0d1117; padding: 8px; border-radius: 4px; border: 1px solid #21262d;">
							<div v-for="prop in selectedElement.def.props" :key="prop.key" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" :title="prop.key">
								<span style="color: #ff7b72;">{{ prop.key }}</span>: 
								<span style="color: #79c0ff;">"{{ getCanonicalValue(prop) }}"</span>
							</div>
							<div v-if="selectedElement.def.sizeKey" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" :title="selectedElement.def.sizeKey">
								<span style="color: #ff7b72;">{{ selectedElement.def.sizeKey }}</span>: 
								<span style="color: #79c0ff;">"{{ getCanonicalSizeValue() }}"</span>
							</div>
						</div>
					</div>

					<!-- 6. Safe-area validation status -->
					<div class="prop-group">
						<label>{{ $t("Safe Area Status") }}</label>
						<div class="prop-row">
							<span v-if="checkOutsideSafe(selectedElement)" style="color: #e67e22; font-weight: bold; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
								{{ $t("⚠️ Warning: Outside Title Safe Area") }}
							</span>
							<span v-else style="color: #2ecc71; font-weight: bold; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
								{{ $t("🟢 Safe: Inside Safe Area") }}
							</span>
						</div>
					</div>

					<!-- 7. Overlap clashing elements list -->
					<div class="prop-group">
						<label>{{ $t("Component Overlaps") }}</label>
						<div class="prop-row" style="flex-direction: column; gap: 4px;">
							<div v-if="getCollidingElements(selectedElement).length > 0">
								<div 
									v-for="other in getCollidingElements(selectedElement)" 
									:key="other.def.id" 
									style="color: #e74c3c; font-weight: bold; font-size: 0.75rem; display: flex; align-items: center; gap: 4px;"
								>
									{{ $t("💥 Clashes with") }} {{ $text(other.def.label) }}
								</div>
							</div>
							<div v-else style="color: #2ecc71; font-weight: bold; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
								{{ $t("🟢 None: Position Clear") }}
							</div>
						</div>
					</div>

					<!-- Smart Snap Target Diagnostics -->
					<div v-if="smartGuidesEnabled && (activeSnapX || activeSnapY)" class="prop-group">
						<label>{{ $t("Smart Snap Target") }}</label>
						<div class="prop-row" style="flex-direction: column; gap: 4px; font-family: monospace; font-size: 0.75rem; color: #adbac7;">
							<div v-if="activeSnapX" style="color: #00e5ff; display: flex; align-items: center; gap: 4px;">
								🧲 X: {{ snapLabel(activeSnapX.label) }}
							</div>
							<div v-if="activeSnapY" style="color: #00e5ff; display: flex; align-items: center; gap: 4px;">
								🧲 Y: {{ snapLabel(activeSnapY.label) }}
							</div>
						</div>
					</div>

					<button class="btn-secondary" style="width: 100%; margin-top: 12px;" @click="resetElement(selectedElement)">{{ $t("Reset to Default") }}</button>
				</div>
			</aside>
		</div>
	</div>
</template>

<script>
import { text as translateText, state as languageState } from '/config/i18n.js'

import { state, actions } from '/config/store.js'

const VP_W = 1920, VP_H = 1080;

const DEFS = [
	{
		id: 'radar', label: 'Radar',
		color: 'rgba(52,152,219,0.3)', border: 'rgba(52,152,219,0.65)',
		baseW: 480, baseH: 480,
		anchor: { v: 'top', h: 'left' },
		props: [ { key: 'layout.radar.left', edge: 'left' }, { key: 'layout.radar.top', edge: 'top' } ],
		resizable: true, keepAspect: true,
		sizeKey: 'layout.radar.width', sizeUnit: '%', sizeRef: VP_W,
		visibleKey: 'layout.radar.visible'
	},
	{
		id: 'top-bar', label: 'Top Bar',
		color: 'rgba(255,255,255,0.12)', border: 'rgba(255,255,255,0.35)',
		baseW: 960, baseH: 50,
		anchor: { v: 'top', h: 'center' },
		props: [{ key: 'layout.topbar.top', edge: 'top' }],
		visibleKey: 'layout.topbar.visible'
	},
	{
		id: 'players-alive', label: 'Players Alive',
		color: 'rgba(56,148,107,0.3)', border: 'rgba(56,148,107,0.65)',
		baseW: 110, baseH: 35,
		anchor: { v: 'top', h: 'right' },
		props: [ { key: 'layout.playersAlive.top', edge: 'top' }, { key: 'layout.playersAlive.right', edge: 'right' } ],
		visibleKey: 'layout.playersAlive.visible'
	},
	{
		id: 'sponsor-left', label: 'Sponsor Left',
		color: 'rgba(220,180,80,0.2)', border: 'rgba(220,180,80,0.5)',
		baseW: 130, baseH: 48,
		anchor: { v: 'top', h: 'left' },
		props: [ { key: 'layout.sponsorLeft.top', edge: 'top' }, { key: 'layout.sponsorLeft.left', edge: 'left' } ],
		resizable: true, sizeKey: 'style.sponsors.width', sizeUnit: 'rem',
		visibleKey: 'layout.sponsorLeft.visible'
	},
	{
		id: 'sponsor-right', label: 'Sponsor Right',
		color: 'rgba(220,180,80,0.2)', border: 'rgba(220,180,80,0.5)',
		baseW: 130, baseH: 48,
		anchor: { v: 'top', h: 'right' },
		props: [ { key: 'layout.sponsorRight.top', edge: 'top' }, { key: 'layout.sponsorRight.right', edge: 'right' } ],
		resizable: true, sizeKey: 'style.sponsors.width', sizeUnit: 'rem',
		visibleKey: 'layout.sponsorRight.visible'
	},
	{
		id: 'sidebar-left', label: 'Left Sidebar',
		color: 'rgba(240,151,37,0.22)', border: 'rgba(240,151,37,0.55)',
		baseW: 580, baseH: 200,
		anchor: { v: 'bottom', h: 'left' },
		props: [ { key: 'layout.sidebar.left', edge: 'left' }, { key: 'layout.sidebar.bottom', edge: 'bottom' } ],
		visibleKey: 'layout.sidebar.leftVisible'
	},
	{
		id: 'sidebar-right', label: 'Right Sidebar',
		color: 'rgba(240,151,37,0.22)', border: 'rgba(240,151,37,0.55)',
		baseW: 580, baseH: 200,
		anchor: { v: 'bottom', h: 'right' },
		props: [ { key: 'layout.sidebar.right', edge: 'right' }, { key: 'layout.sidebar.bottom', edge: 'bottom' } ],
		visibleKey: 'layout.sidebar.rightVisible'
	},
	{
		id: 'focused-player', label: 'Focused Player',
		color: 'rgba(155,89,182,0.22)', border: 'rgba(155,89,182,0.55)',
		baseW: 960, baseH: 70,
		anchor: { v: 'bottom', h: 'center' },
		props: [{ key: 'layout.focusedPlayer.bottom', edge: 'bottom' }],
		visibleKey: 'layout.focusedPlayer.visible'
	},
	{
		id: 'current-map', label: 'Current Map',
		color: 'rgba(100,180,240,0.18)', border: 'rgba(100,180,240,0.5)',
		baseW: 160, baseH: 90,
		anchor: { v: 'bottom', h: 'right' },
		props: [ { key: 'layout.currentMap.bottom', edge: 'bottom' }, { key: 'layout.currentMap.right', edge: 'right' } ],
		resizable: true, sizeKey: 'style.currentMap.width', sizeUnit: 'rem',
		visibleKey: 'layout.currentMap.visible'
	},
	{
		id: 'maps-sleek', label: 'Sleek Maps',
		color: 'rgba(79,227,193,0.18)', border: 'rgba(79,227,193,0.5)',
		baseW: 210, baseH: 20,
		anchor: { v: 'top', h: 'center' },
		props: [ { key: 'layout.mapsSleek.top', edge: 'top' }, { key: 'layout.mapsSleek.left', edge: 'left' } ],
		resizable: true, sizeKey: 'style.mapsSleek.scale', sizeUnit: ''
	},
	{
		id: 'promotion-panel', label: 'Mobile Text / Lower Third',
		color: 'rgba(31,111,235,0.22)', border: 'rgba(88,166,255,0.65)',
		baseW: 420, baseH: 80,
		anchor: { v: 'bottom', h: 'left' },
		props: [ { key: 'layout.promotion.bottom', edge: 'bottom' }, { key: 'layout.promotion.left', edge: 'left' } ],
		resizable: true, sizeKey: 'layout.promotion.width', sizeUnit: 'px',
		visibleKey: 'promotion.visible'
	},
	{
		id: 'event-badge', label: 'Event Badge',
		color: 'rgba(231,76,60,0.22)', border: 'rgba(231,76,60,0.55)',
		baseW: 240, baseH: 45,
		anchor: { v: 'top', h: 'left' },
		props: [ { key: 'layout.eventBadge.top', edge: 'top' }, { key: 'layout.eventBadge.left', edge: 'left' } ],
		resizable: true, sizeKey: 'style.eventBadge.width', sizeUnit: 'rem',
		visibleKey: 'layout.eventBadge.visible'
	}
]

export default {
	setup() { return { state, actions } },
	data() {
		return {
			elements: [],
			selectedId: null,
			viewportScale: 1,
			gridSizes: [0, 5, 10, 20, 50],
			gridIdx: 2,
			snapEnabled: true,
			remPx: 10,
			drag: null,
			presets: [],
			activePreset: '',
			
			// Visual state toggles for 1:1 layout view
			showBgImage: true,
			showGrid: true,
			showCenterLines: true,
			showSafeArea: true,
			smartGuidesEnabled: true,
			showLiveHUDReference: false,
			activeSnapX: null,
			activeSnapY: null
		}
	},
	computed: {
		selectedElement() { return this.elements.find(e => e.def.id === this.selectedId) },
		sortedElements() {
			return [...this.elements].sort((a, b) => {
				if (a.def.id === this.selectedId) return 1
				if (b.def.id === this.selectedId) return -1
				return 0
			})
		},
		currentPresetIsCustom() {
			if (!this.activePreset) return false
			const p = this.presets.find(x => x.id === this.activePreset)
			return p ? p.isCustom !== false : false
		},
		mobileTickerText() {
			return state.options['branding.ticker'] || '🔥 MATCH POINT / РЕШАЮЩИЙ РАУНД'
		},
		promotionTitle() {
			return state.options['promotion.title'] || '📢 ПРЯМОЙ ЭФИР'
		},
		viewportStyles() {
			const ct = state.options['theme.colors.ctFill'] || '25, 106, 232'
			const ctBorder = state.options['theme.colors.ctBorder'] || '91, 166, 255'
			const ctText = state.options['theme.colors.ctText'] || '156, 204, 255'
			const t = state.options['theme.colors.tFill'] || '232, 137, 22'
			const tBorder = state.options['theme.colors.tBorder'] || '255, 181, 71'
			const tText = state.options['theme.colors.tText'] || '255, 214, 138'
			
			const bg = state.options['theme.materials.panelFill'] || 'rgba(13, 17, 23, 0.95)'
			const border = state.options['theme.materials.panelBorder'] || 'rgba(255, 255, 255, 0.12)'
			const radius = state.options['theme.shapes.radius'] || '4px'
			const skew = state.options['theme.shapes.skewAngle'] || '20deg'
			const primaryFont = state.options['theme.typography.primaryFont'] || 'Quantico'
			
			return {
				transform: `scale(${this.viewportScale})`,
				'--ct-fill': `rgb(${ct})`,
				'--ct-border': `rgb(${ctBorder})`,
				'--ct-text-color': `rgb(${ctText})`,
				'--t-fill': `rgb(${t})`,
				'--t-text-color': `rgb(${tText})`,
				'--t-border': `rgb(${tBorder})`,
				'--panel-bg': bg,
				'--panel-border': border,
				'--panel-radius': radius,
				'--panel-skew': skew,
				'--primary-font': primaryFont
			}
		}
	},
	watch: {
		'state.isSynced': function isSyncedWatcher(synced) {
			if (synced && !this.activePreset) {
				this.computeRemPx()
				this.initElements()
			}
		}
	},
	mounted() {
		if (state.isSynced) {
			this.computeRemPx()
			this.initElements()
		}
		this.computeRemPx()
		this.initElements()
		this.resize()
		window.addEventListener('resize', this.resize)
		window.addEventListener('mousemove', this.onMouseMove)
		window.addEventListener('mouseup', this.onMouseUp)

		this.loadPresetsList().then(() => {
			const lastId = localStorage.getItem('lastSelectedLayoutPresetId')
			if (lastId && this.presets.some(p => p.id === lastId)) {
				this.activePreset = lastId
				this.selectPreset()
			}
		})
	},
	beforeUnmount() {
		window.removeEventListener('resize', this.resize)
		window.removeEventListener('mousemove', this.onMouseMove)
		window.removeEventListener('mouseup', this.onMouseUp)
	},
	methods: {
    snapLabel(label) {
      const edges = { ' Left Edge': 'left', ' Right Edge': 'right', ' Top Edge': 'top', ' Bottom Edge': 'bottom', ' Center X': 'center', ' Center Y': 'center' }
      for (const [suffix, key] of Object.entries(edges)) {
        if (label.endsWith(suffix)) return this.$text(label.slice(0, -suffix.length)) + ' · ' + this.$text(key) + (suffix.includes('Center') ? suffix.slice(-2) : '')
      }
      return this.$text(label)
    },
		computeRemPx() {
			const raw = String(state.options['css.base-scale-factor'] || '0.925925926vh')
			const val = parseFloat(raw)
			if (raw.includes('vh')) this.remPx = val * VP_H / 100
			else if (raw.includes('vw')) this.remPx = val * VP_W / 100
			else this.remPx = val || 10
		},
		evaluateCss(val, refSize = VP_W, fb = 0) {
			if (val == null || val === undefined) return fb
			let s = String(val).trim()
			if (!s) return fb

			let varMatch, safety = 0
			while ((varMatch = s.match(/var\(--(.+?)\)/)) && safety++ < 10) {
				const key = 'css.' + varMatch[1]
				let replacement = state.options[key] ?? state.options[varMatch[1]] ?? '0'
				s = s.replace(varMatch[0], replacement)
			}

			if (s.includes('clamp(')) {
				s = s.replace(/clamp\((.+?)\)/g, (match, inner) => {
					const parts = inner.split(',').map(p => this.evaluateCss(p.trim(), refSize, fb))
					return Math.max(parts[0], Math.min(parts[1], parts[2]))
				})
			}
			if (s.includes('calc(')) s = s.replace(/calc\((.+?)\)/g, (match, inner) => inner)

			const unitMap = { 'rem': this.remPx, 'vh': VP_H/100, 'vw': VP_W/100, 'px': 1, '%': refSize/100 }
			Object.entries(unitMap).forEach(([unit, mult]) => {
				const re = new RegExp(`([\\d\\.-]+)${unit === '%' ? '%' : unit}`, 'g')
				s = s.replace(re, (match, num) => parseFloat(num) * mult)
			})

			try {
				if (/^[ \d\.\-\+\*\/\(\)]+$/.test(s)) return new Function(`return (${s})`)()
			} catch(e) {}
			return parseFloat(s) || fb
		},
		resolveNum(key, fb) { const v = state.options[key]; return v != null ? (parseFloat(v) || fb) : fb },
		initElements() {
			this.elements = DEFS.map(def => {
				let bw = def.baseW, bh = def.baseH

				if (def.sizeKey) {
					const refSize = (def.sizeKey.includes('width') || def.sizeKey.includes('left') || def.sizeKey.includes('right')) ? VP_W : VP_H
					bw = this.evaluateCss(state.options[def.sizeKey], refSize, def.baseW)
					if (def.keepAspect) bh = bw * (def.baseH / def.baseW)
				}

				if (def.id.startsWith('sponsor-')) {
					bw = this.evaluateCss(state.options['style.sponsors.width'], VP_W, 130)
					bh = this.evaluateCss(state.options['style.sponsors.height'], VP_H, 48)
				}

				const positions = {}
				for (const p of def.props) {
					const refSize = (p.edge === 'top' || p.edge === 'bottom') ? VP_H : VP_W
					positions[p.edge] = this.evaluateCss(state.options[p.key], refSize, 11)
				}

				let w = bw, h = bh
				let top = 0, left = 0
				
				if (def.anchor.v === 'top') top = positions.top ?? 0
				else top = VP_H - (positions.bottom ?? 0) - h

				if (def.anchor.h === 'left') left = positions.left ?? 0
				else if (def.anchor.h === 'right') left = VP_W - (positions.right ?? 0) - w
				else {
					// center anchor: if a left prop has a saved value, it is the center X (HUD uses translateX(-50%))
					const leftProp = def.props.find(p => p.edge === 'left')
					if (leftProp && state.options[leftProp.key] != null) {
						left = positions.left - w / 2
					} else {
						left = (VP_W - w) / 2
					}
				}

				const visibleVal = state.options[def.visibleKey]
				const visible = visibleVal !== false && visibleVal !== 'none'
				return { def, top, left, w, h, baseW: bw, baseH: bh, scaleX: 1, scaleY: 1, visible }
			})
		},
		getTransformOrigin(anchorH) {
			if (anchorH === 'left') return 'bottom left'
			if (anchorH === 'right') return 'bottom right'
			return 'bottom center'
		},
		selectElement(id) {
			this.selectedId = id
		},
		toggleVisibility(el) {
			el.visible = !el.visible
			const val = el.visible ? 'flex' : 'none'
			state.options[el.def.visibleKey] = val
			actions.broadcast(el.def.visibleKey, val)
			actions.save({ [el.def.visibleKey]: val })
		},
		resetElement(el) {
			const partial = {}
			for (const p of el.def.props) { partial[p.key] = null; state.options[p.key] = null }
			if (el.def.sizeKey) { partial[el.def.sizeKey] = null; state.options[el.def.sizeKey] = null }
			actions.save(partial)
			this.computeRemPx()
			this.initElements()
		},
		resize() {
			if (!this.$refs.container) return
			const rect = this.$refs.container.getBoundingClientRect()
			const scale = Math.min((rect.width - 40) / VP_W, (rect.height - 40) / VP_H)
			this.viewportScale = Math.max(0.1, scale)
		},
		startDrag(e, el, type) {
			this.selectedId = el.def.id
			this.drag = {
				el, type,
				startX: e.clientX, startY: e.clientY,
				initTop: el.top, initLeft: el.left,
				initW: el.baseW, initH: el.baseH
			}
		},
		onMouseMove(e) {
			if (!this.drag) return
			const dx = (e.clientX - this.drag.startX) / this.viewportScale
			const dy = (e.clientY - this.drag.startY) / this.viewportScale
			const el = this.drag.el
			const g = this.snapEnabled ? this.gridSizes[this.gridIdx] : 0
			const snap = v => (g ? Math.round(v / g) * g : v)

			if (this.drag.type === 'move') {
				let newTop = this.drag.initTop + dy
				let newLeft = this.drag.initLeft + dx
				
				// Clamp values within 1920x1080 stage boundaries to prevent element loss
				newTop = Math.max(0, Math.min(VP_H - el.h, newTop))
				newLeft = Math.max(0, Math.min(VP_W - el.w, newLeft))

				// Lock horizontal position for center-anchored components unless they have horizontal props
				const hasHorizontal = el.def.props.some(p => p.edge === 'left' || p.edge === 'right')
				if (el.def.anchor.h === 'center' && !hasHorizontal) {
					newLeft = (VP_W - el.w) / 2
				}

				// Lock vertical position if there are no vertical keys mapped
				const hasVertical = el.def.props.some(p => p.edge === 'top' || p.edge === 'bottom')
				if (!hasVertical) {
					newTop = el.top
				}

				// Smart composition snapping & alignment guidelines (Phase 19A)
				let activeSnapX = null
				let activeSnapY = null
				
				if (this.smartGuidesEnabled) {
					const snapTolerance = 6
					
					// A. Horizontal axis (X) Snapping - Bypassed if center-anchored horizontally locked
					const isHorizontallyLocked = el.def.anchor.h === 'center' && !hasHorizontal
					if (!isHorizontallyLocked) {
						const xCandidates = [
							{ value: 960, label: 'Viewport Center X' },
							{ value: 96, label: 'Title Safe Left (96px)' },
							{ value: 1824, label: 'Title Safe Right (1824px)' }
						]
						this.elements.forEach(other => {
							if (!other.visible || other.def.id === el.def.id) return
							xCandidates.push({ value: other.left, label: `${other.def.label} Left Edge` })
							xCandidates.push({ value: other.left + other.w, label: `${other.def.label} Right Edge` })
							xCandidates.push({ value: other.left + other.w / 2, label: `${other.def.label} Center X` })
						})
						
						let bestSnapX = null
						let minDeltaX = snapTolerance + 1
						
						const proposedLeft = newLeft
						const proposedRight = newLeft + el.w
						const proposedCenterX = newLeft + el.w / 2
						
						xCandidates.forEach(cand => {
							// 1. el.left snaps to candidate
							const dL = Math.abs(proposedLeft - cand.value)
							if (dL <= snapTolerance && dL < minDeltaX) {
								minDeltaX = dL
								bestSnapX = { snappedPos: cand.value, lineValue: cand.value, label: cand.label }
							}
							// 2. el.right snaps to candidate
							const dR = Math.abs(proposedRight - cand.value)
							if (dR <= snapTolerance && dR < minDeltaX) {
								minDeltaX = dR
								bestSnapX = { snappedPos: cand.value - el.w, lineValue: cand.value, label: cand.label }
							}
							// 3. el.centerX snaps to candidate
							const dC = Math.abs(proposedCenterX - cand.value)
							if (dC <= snapTolerance && dC < minDeltaX) {
								minDeltaX = dC
								bestSnapX = { snappedPos: cand.value - el.w / 2, lineValue: cand.value, label: cand.label }
							}
						})
						
						if (bestSnapX) {
							newLeft = bestSnapX.snappedPos
							activeSnapX = bestSnapX
						}
					}
					
					// B. Vertical axis (Y) Snapping - Bypassed if vertically locked
					if (hasVertical) {
						const yCandidates = [
							{ value: 540, label: 'Viewport Center Y' },
							{ value: 54, label: 'Title Safe Top (54px)' },
							{ value: 1026, label: 'Title Safe Bottom (1026px)' }
						]
						this.elements.forEach(other => {
							if (!other.visible || other.def.id === el.def.id) return
							yCandidates.push({ value: other.top, label: `${other.def.label} Top Edge` })
							yCandidates.push({ value: other.top + other.h, label: `${other.def.label} Bottom Edge` })
							yCandidates.push({ value: other.top + other.h / 2, label: `${other.def.label} Center Y` })
						})
						
						let bestSnapY = null
						let minDeltaY = snapTolerance + 1
						
						const proposedTop = newTop
						const proposedBottom = newTop + el.h
						const proposedCenterY = newTop + el.h / 2
						
						yCandidates.forEach(cand => {
							// 1. el.top snaps to candidate
							const dT = Math.abs(proposedTop - cand.value)
							if (dT <= snapTolerance && dT < minDeltaY) {
								minDeltaY = dT
								bestSnapY = { snappedPos: cand.value, lineValue: cand.value, label: cand.label }
							}
							// 2. el.bottom snaps to candidate
							const dB = Math.abs(proposedBottom - cand.value)
							if (dB <= snapTolerance && dB < minDeltaY) {
								minDeltaY = dB
								bestSnapY = { snappedPos: cand.value - el.h, lineValue: cand.value, label: cand.label }
							}
							// 3. el.centerY snaps to candidate
							const dC = Math.abs(proposedCenterY - cand.value)
							if (dC <= snapTolerance && dC < minDeltaY) {
								minDeltaY = dC
								bestSnapY = { snappedPos: cand.value - el.h / 2, lineValue: cand.value, label: cand.label }
							}
						})
						
						if (bestSnapY) {
							newTop = bestSnapY.snappedPos
							activeSnapY = bestSnapY
						}
					}
				}
				
				this.activeSnapX = activeSnapX
				this.activeSnapY = activeSnapY

				// Fallback to normal grid snapping only if no smart snapping occurred on that axis
				el.top = activeSnapY ? newTop : snap(newTop)
				el.left = activeSnapX ? newLeft : snap(newLeft)
			} else if (this.drag.type === 'resize-x' || this.drag.type === 'resize-y') {
				// Use direct width/height resizing
				if (this.drag.type === 'resize-x') {
					const sign = (el.def.anchor.h === 'right') ? -1 : 1
					el.baseW = snap(Math.max(20, this.drag.initW + dx * sign))
					el.w = el.baseW
					if (el.def.keepAspect) {
						el.baseH = el.baseW * (el.def.baseH / el.def.baseW)
						el.h = el.baseH
					}
				} else {
					el.baseH = snap(Math.max(20, this.drag.initH - dy))
					el.h = el.baseH
				}
			}
		},
		onMouseUp() {
			if (!this.drag) return
			const el = this.drag.el
			this.drag = null

			this.activeSnapX = null
			this.activeSnapY = null

			// Save positions to state
			const partial = {}
			for (const prop of el.def.props) {
				let val = 0
				if (prop.edge === 'top') val = el.top
				else if (prop.edge === 'bottom') val = VP_H - el.top - el.h
				else if (prop.edge === 'left') val = (el.def.anchor.h === 'center') ? el.left + el.w / 2 : el.left
				else if (prop.edge === 'right') val = VP_W - el.left - el.w

				const remVal = (val / this.remPx).toFixed(2) + 'rem'
				state.options[prop.key] = remVal
				partial[prop.key] = remVal
				actions.broadcast(prop.key, remVal)
			}

			if (el.def.sizeKey) {
				const unit = el.def.sizeUnit || 'px'
				let val = el.baseW
				if (unit === '%') val = (el.baseW / VP_W * 100).toFixed(2) + '%'
				else if (unit === 'rem') val = (el.baseW / this.remPx).toFixed(2) + 'rem'
				else val = Math.round(val) + 'px'

				state.options[el.def.sizeKey] = val
				partial[el.def.sizeKey] = val
				actions.broadcast(el.def.sizeKey, val)
			}

			actions.save(partial)
		},
		async loadPresetsList() {
			try {
				const res = await fetch('/config/layout-presets')
				this.presets = await res.json()
			} catch (err) {
				console.error('Failed to load layout presets:', err)
			}
		},
		selectPreset() {
			if (!this.activePreset) {
				this.initElements()
				localStorage.removeItem('lastSelectedLayoutPresetId')
				return
			}
			
			const p = this.presets.find(x => x.id === this.activePreset)
			if (!p) return
			
			localStorage.setItem('lastSelectedLayoutPresetId', this.activePreset)
			
			this.elements.forEach(el => {
				let bw = el.def.baseW, bh = el.def.baseH
				
				if (el.def.sizeKey) {
					const refSize = (el.def.sizeKey.includes('width') || el.def.sizeKey.includes('left') || el.def.sizeKey.includes('right')) ? VP_W : VP_H
					const presetSize = p.options[el.def.sizeKey] ? p.options[el.def.sizeKey].value : null
					bw = this.evaluateCss(presetSize ?? state.options[el.def.sizeKey], refSize, el.def.baseW)
					if (el.def.keepAspect) bh = bw * (el.def.baseH / el.def.baseW)
				}
				
				if (el.def.id.startsWith('sponsor-')) {
					const presetW = p.options['style.sponsors.width'] ? p.options['style.sponsors.width'].value : null
					const presetH = p.options['style.sponsors.height'] ? p.options['style.sponsors.height'].value : null
					bw = this.evaluateCss(presetW ?? state.options['style.sponsors.width'], VP_W, 130)
					bh = this.evaluateCss(presetH ?? state.options['style.sponsors.height'], VP_H, 48)
				}
				
				const positions = {}
				for (const prop of el.def.props) {
					const refSize = (prop.edge === 'top' || prop.edge === 'bottom') ? VP_H : VP_W
					const presetPos = p.options[prop.key] ? p.options[prop.key].value : null
					positions[prop.edge] = this.evaluateCss(presetPos ?? state.options[prop.key], refSize, 11)
				}
				
				let w = bw, h = bh
				let top = 0, left = 0
				
				if (el.def.anchor.v === 'top') top = positions.top ?? 0
				else top = VP_H - (positions.bottom ?? 0) - h
				
				if (el.def.anchor.h === 'left') left = positions.left ?? 0
				else if (el.def.anchor.h === 'right') left = VP_W - (positions.right ?? 0) - w
				else left = (VP_W - w) / 2
				
				const visibleVal = p.options[el.def.visibleKey] ? p.options[el.def.visibleKey].value : state.options[el.def.visibleKey]
				const visible = visibleVal !== false && visibleVal !== 'none'
				
				el.top = top
				el.left = left
				el.w = w
				el.h = h
				el.baseW = bw
				el.baseH = bh
				el.visible = visible
			})
		},
		async saveActivePresetChanges() {
			if (!this.activePreset) return
			const p = this.presets.find(x => x.id === this.activePreset)
			if (!p) return
			
			const options = {}
			this.elements.forEach(el => {
				for (const prop of el.def.props) {
					options[prop.key] = { value: this.getCanonicalValue(prop, el) }
				}
				if (el.def.sizeKey) {
					options[el.def.sizeKey] = { value: this.getCanonicalSizeValue(el) }
				}
				if (el.def.id.startsWith('sponsor-')) {
					options['style.sponsors.width'] = { value: (el.baseW / this.remPx).toFixed(2) + 'rem' }
					options['style.sponsors.height'] = { value: (el.baseH / this.remPx).toFixed(2) + 'rem' }
				}
			})
			
			try {
				const res = await fetch(`/config/layout-presets/${p.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: p.name,
						description: p.description,
						options
					})
				})
				if (!res.ok) {
					const err = await res.json()
					alert(translateText(`Save failed: ${err.message}`))
					return
				}
				const updated = await res.json()
				const idx = this.presets.findIndex(x => x.id === p.id)
				if (idx !== -1) {
					this.presets[idx] = updated
				}
				alert(translateText('Preset changes saved successfully!'))
			} catch (err) {
				alert(translateText(`Failed to save preset changes: ${err.message}`))
			}
		},
		async saveNewPreset() {
			const name = prompt(translateText("Enter new preset name:"))
			if (!name) return
			
			const options = {}
			this.elements.forEach(el => {
				for (const prop of el.def.props) {
					options[prop.key] = { value: this.getCanonicalValue(prop, el) }
				}
				if (el.def.sizeKey) {
					options[el.def.sizeKey] = { value: this.getCanonicalSizeValue(el) }
				}
				if (el.def.id.startsWith('sponsor-')) {
					options['style.sponsors.width'] = { value: (el.baseW / this.remPx).toFixed(2) + 'rem' }
					options['style.sponsors.height'] = { value: (el.baseH / this.remPx).toFixed(2) + 'rem' }
				}
			})
			
			try {
				const res = await fetch('/config/layout-presets', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name,
						options
					})
				})
				if (!res.ok) {
					const err = await res.json()
					alert(translateText(`Save failed: ${err.message}`))
					return
				}
				const saved = await res.json()
				this.presets.push(saved)
				this.activePreset = saved.id
				this.selectPreset()
				alert(translateText('Preset saved successfully!'))
			} catch (err) {
				alert(translateText(`Failed to save preset: ${err.message}`))
			}
		},
		async duplicatePreset() {
			if (!this.activePreset) return
			const p = this.presets.find(x => x.id === this.activePreset)
			if (!p) return
			
			const name = `${p.name} (Copy)`
			
			try {
				const res = await fetch('/config/layout-presets', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name,
						options: p.options
					})
				})
				if (!res.ok) {
					const err = await res.json()
					alert(translateText(`Duplicate failed: ${err.message}`))
					return
				}
				const saved = await res.json()
				this.presets.push(saved)
				this.activePreset = saved.id
				this.selectPreset()
			} catch (err) {
				alert(translateText(`Failed to duplicate preset: ${err.message}`))
			}
		},
		async deletePreset() {
			if (!this.activePreset) return
			const p = this.presets.find(x => x.id === this.activePreset)
			if (!p) return
			
			if (!confirm(translateText(`Are you sure you want to delete layout preset "${p.name}"?`))) return
			
			try {
				const res = await fetch(`/config/layout-presets/${p.id}`, {
					method: 'DELETE'
				})
				if (!res.ok) {
					alert(translateText('Failed to delete preset.'))
					return
				}
				this.presets = this.presets.filter(x => x.id !== p.id)
				this.activePreset = ''
				this.selectPreset()
			} catch (err) {
				alert(translateText(`Failed to delete preset: ${err.message}`))
			}
		},
		async applyPreset() {
			if (!this.activePreset) return
			const p = this.presets.find(x => x.id === this.activePreset)
			if (!p) return
			
			try {
				const res = await fetch(`/config/layout-presets/${p.id}/apply`, {
					method: 'POST'
				})
				if (!res.ok) {
					const err = await res.json()
					alert(translateText(`Apply failed: ${err.message}`))
					return
				}
				this.computeRemPx()
				this.initElements()
				this.activePreset = p.id
				this.selectPreset()
				alert(translateText(`Preset "${p.name}" applied successfully to Live HUD!`))
			} catch (err) {
				alert(translateText(`Failed to apply preset: ${err.message}`))
			}
		},
		exportPreset() {
			if (!this.activePreset) return
			const p = this.presets.find(x => x.id === this.activePreset)
			if (!p) return
			
			const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(p, null, 2))
			const downloadAnchor = document.createElement('a')
			downloadAnchor.setAttribute("href",     dataStr)
			downloadAnchor.setAttribute("download", `eon-layout-${p.id}.json`)
			document.body.appendChild(downloadAnchor)
			downloadAnchor.click()
			downloadAnchor.remove()
		},
		async importPreset(e) {
			const file = e.target.files[0]
			if (!file) return
			
			const reader = new FileReader()
			reader.onload = async (event) => {
				try {
					const imported = JSON.parse(event.target.result)
					
					if (!imported.name || !imported.options || typeof imported.options !== 'object') {
						alert(translateText('Invalid layout preset JSON format. Must contain "name" and "options".'))
						return
					}
					
					const allowedKeys = [
						'style.eventBadge.width',
						'style.currentMap.width',
						'style.sponsors.width',
						'style.sponsors.height',
						'style.maps.scale',
						'style.mapsSleek.scale'
					]
					
					for (const key of Object.keys(imported.options)) {
						const isLayoutKey = key.startsWith('layout.')
						const isAllowedStyleKey = allowedKeys.includes(key)
						if (!isLayoutKey && !isAllowedStyleKey) {
							alert(translateText(`Key mutation rejected: "${key}" is not allowed. Layout presets can only modify layout.* and specific style width/scale keys.`))
							return
						}
						if (key.startsWith('theme.') || key.startsWith('series.') || key.startsWith('sponsors.')) {
							alert(translateText(`Key mutation rejected: "${key}" is branding configuration and cannot be modified.`))
							return
						}
						if (key === 'css.lan66-sidebar-scale-y' || key === 'css.top-bar-width') {
							alert(translateText(`Key mutation rejected: Legacy key "${key}" is deprecated and forbidden.`))
							return
						}
					}
					
					const res = await fetch('/config/layout-presets', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							name: imported.name,
							description: imported.description || '',
							options: imported.options
						})
					})
					
					if (!res.ok) {
						const err = await res.json()
						alert(translateText(`Import failed: ${err.message}`))
						return
					}
					
					const saved = await res.json()
					this.presets.push(saved)
					this.activePreset = saved.id
					this.selectPreset()
					alert(translateText(`Preset "${saved.name}" imported and saved successfully!`))
				} catch (err) {
					alert(translateText(`Failed to import layout preset: ${err.message}`))
				}
			}
			reader.readAsText(file)
			e.target.value = ''
		},
		
		// Phase 18C: Diagnostics and Broadcast Safety Math
		checkOutsideSafe(el) {
			if (!el.visible) return false
			return (el.left < 96 || 
			        (el.left + el.w) > (VP_W - 96) || 
			        el.top < 54 || 
			        (el.top + el.h) > (VP_H - 54))
		},
		checkCollision(el1, el2) {
			if (!el1.visible || !el2.visible || el1.def.id === el2.def.id) return false
			
			const boxA = {
				x1: el1.left, x2: el1.left + el1.w,
				y1: el1.top,  y2: el1.top + el1.h
			}
			const boxB = {
				x1: el2.left, x2: el2.left + el2.w,
				y1: el2.top,  y2: el2.top + el2.h
			}
			
			return !(boxA.x2 < boxB.x1 || 
			         boxB.x2 < boxA.x1 || 
			         boxA.y2 < boxB.y1 || 
			         boxB.y2 < boxA.y1)
		},
		getCollidingElements(el) {
			if (!el.visible) return []
			return this.elements.filter(other => this.checkCollision(el, other))
		},
		getPixelPositionByEdge(edge) {
			if (!this.selectedElement) return 0
			const el = this.selectedElement
			if (edge === 'top') return el.top
			if (edge === 'bottom') return VP_H - el.top - el.h
			if (edge === 'left') return el.left
			if (edge === 'right') return VP_W - el.left - el.w
			return 0
		},
		getCanonicalValue(prop, el = this.selectedElement) {
			if (!el) return '0.00rem'
			let val = 0
			if (prop.edge === 'top') val = el.top
			else if (prop.edge === 'bottom') val = VP_H - el.top - el.h
			else if (prop.edge === 'left') val = (el.def.anchor.h === 'center') ? el.left + el.w / 2 : el.left
			else if (prop.edge === 'right') val = VP_W - el.left - el.w
			return (val / this.remPx).toFixed(2) + 'rem'
		},
		getCanonicalSizeValue(el = this.selectedElement) {
			if (!el || !el.def.sizeKey) return '0px'
			const unit = el.def.sizeUnit || 'px'
			let val = el.baseW
			if (unit === '%') return (el.baseW / VP_W * 100).toFixed(2) + '%'
			else if (unit === 'rem') return (el.baseW / this.remPx).toFixed(2) + 'rem'
			return Math.round(val) + 'px'
		}
	}
}
</script>

<style scoped>
.layout-editor {
	display: flex;
	flex-direction: column;
	height: calc(100vh - 140px);
}

.editor-header {
	display: flex;
	flex-wrap: wrap;
	gap: 16px;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 24px;
}

.header-left h2 { margin: 0 0 8px 0; font-size: 1.2rem; color: #fff; }
.preset-controls { display: flex; gap: 12px; }
.preset-controls select { padding: 6px; background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; border-radius: 4px; }

.btn-secondary { background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.btn-secondary:hover { background: #30363d; color: #fff; }

.header-left { min-width: 0; flex: 1 1 360px; }
.header-right { display: flex; align-items: center; flex-wrap: wrap; max-width: 100%; gap: 16px; color: #8b949e; }

/* Workbench Toggles */
.workbench-toggles {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	background: #161b22;
	border: 1px solid #30363d;
	border-radius: 6px;
	padding: 4px;
	gap: 4px;
}

.toggle-control {
	display: flex;
	white-space: nowrap;
	align-items: center;
	gap: 6px;
	padding: 6px 10px;
	border-radius: 4px;
	cursor: pointer;
	user-select: none;
	transition: background 0.15s;
}

.toggle-control:hover {
	background: #21262d;
}

.toggle-control input[type="checkbox"] {
	margin: 0;
	cursor: pointer;
}

.toggle-control span {
	font-size: 0.75rem;
	font-weight: 600;
	color: #adbac7;
}

.toggle-control input[type="checkbox"]:checked + span {
	color: #fff;
}

.grid-select {
	padding: 6px;
	background: #0d1117;
	border: 1px solid #30363d;
	color: #c9d1d9;
	border-radius: 4px;
	font-size: 0.75rem;
}

.editor-workspace {
	display: flex; gap: 24px; flex: 1; min-height: 0;
}

.canvas-container {
	flex: 1;
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 8px;
	position: relative;
	overflow: hidden;
	display: flex;
	align-items: center;
	justify-content: center;
}

.viewport {
	width: 1920px;
	height: 1080px;
	position: relative;
	background: #111;
	box-shadow: 0 0 40px rgba(0,0,0,0.8);
	transform-origin: center center;
}

/* Optional Background CS2 Screenshot */
.hud-screenshot-bg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	pointer-events: none;
	z-index: 1;
	opacity: 0.75;
}

.hud-bg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	border: none;
	pointer-events: none;
	z-index: 2;
}

/* Technical Alignment Grid styling */
.tech-grid {
	position: absolute;
	inset: 0;
	pointer-events: none;
	z-index: 3;
	background-size: 40px 40px, 40px 40px, 10px 10px, 10px 10px;
	background-image: 
		linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
		linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
		linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
		linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
}

/* Center Crosshair Lines styling */
.center-lines {
	position: absolute;
	inset: 0;
	pointer-events: none;
	z-index: 4;
}

.center-line {
	position: absolute;
	background: none;
}

.center-line.--vertical {
	left: 50%;
	top: 0;
	bottom: 0;
	width: 1px;
	border-left: 1px dashed rgba(52, 152, 219, 0.35);
}

.center-line.--horizontal {
	top: 50%;
	left: 0;
	right: 0;
	height: 1px;
	border-top: 1px dashed rgba(52, 152, 219, 0.35);
}

/* 10% TV safe area outline styling */
.safe-area-outline {
	position: absolute;
	left: 96px;
	top: 54px;
	width: 1728px;
	height: 972px;
	border: 1px dashed rgba(230, 126, 34, 0.35);
	pointer-events: none;
	z-index: 5;
	box-sizing: border-box;
}

.safe-area-label {
	position: absolute;
	top: 6px;
	left: 10px;
	font-size: 0.65rem;
	color: rgba(230, 126, 34, 0.5);
	text-transform: uppercase;
	font-weight: 600;
	letter-spacing: 0.05em;
}

/* Draggable elements - Border details */
.hud-el {
	position: absolute;
	border: 2px dashed transparent;
	box-sizing: border-box;
	cursor: move;
	opacity: 0.9;
	transition: border-color 0.15s, opacity 0.15s, box-shadow 0.15s, background-color 0.15s;
	z-index: 10;
}

.hud-el:hover { 
	opacity: 1; 
	border-color: rgba(52, 152, 219, 0.45);
}

.hud-el.--hidden { opacity: 0.35; }
.hud-el.--hidden:hover, .hud-el.--hidden.--active { opacity: 0.95; }

.hud-el.--active { 
	border-color: #3498db; 
	border-style: dashed; 
	z-index: 100; 
	opacity: 1; 
	background: rgba(255, 255, 255, 0.02);
	box-shadow: 0 0 0 1px #000, inset 0 0 0 1px #000;
}

/* Phase 18C: Subtle Safe area and Collision warning outlines */
.hud-el.--outside-safe:not(.--active) {
	border-color: rgba(230, 126, 34, 0.5) !important;
	border-style: dashed;
	background: rgba(230, 126, 34, 0.03);
}

.hud-el.--colliding:not(.--active) {
	border-color: rgba(231, 76, 60, 0.55) !important;
	border-style: dashed;
	background: rgba(231, 76, 60, 0.03);
}

.hud-el.--active.--colliding {
	border-color: #e74c3c !important;
	box-shadow: 0 0 0 1px #000, inset 0 0 0 1px #000, 0 0 8px rgba(231, 76, 60, 0.35);
}

.hud-el.--active.--outside-safe:not(.--colliding) {
	border-color: #e67e22 !important;
	box-shadow: 0 0 0 1px #000, inset 0 0 0 1px #000, 0 0 8px rgba(230, 126, 34, 0.35);
}

/* Mock components wrappers */
.mock-content {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-family: var(--primary-font), 'Quantico', sans-serif;
	font-size: 0.8rem;
	overflow: hidden;
}

/* TOP BAR score board */
.mock-top-bar {
	width: 100%;
	height: 100%;
	display: grid;
	grid-template-columns: 1fr auto 1fr;
	align-items: center;
	background: var(--panel-bg);
	border: 1px solid var(--panel-border);
	border-radius: var(--panel-radius);
	transform: skewX(var(--panel-skew));
	overflow: hidden;
	box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}

.mock-top-bar-team {
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 16px;
	font-weight: 700;
}

.mock-team-ct {
	background: var(--ct-fill);
	color: var(--ct-text-color);
}

.mock-team-t {
	background: var(--t-fill);
	color: var(--t-text-color);
}

.mock-top-bar-team .team-name {
	transform: skewX(calc(-1 * var(--panel-skew)));
}

.mock-top-bar-team .score {
	font-size: 1.1rem;
	transform: skewX(calc(-1 * var(--panel-skew)));
}

.mock-top-bar-center {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 0 20px;
	transform: skewX(calc(-1 * var(--panel-skew)));
	color: #fff;
}

.mock-top-bar-center .timer {
	font-size: 1.1rem;
	font-weight: 700;
}

.mock-top-bar-center .round {
	font-size: 0.6rem;
	color: #8b949e;
	text-transform: uppercase;
}

/* RADAR plate */
.mock-radar {
	width: 100%;
	height: 100%;
	position: relative;
	background: rgba(13, 17, 23, 0.85);
	border: 1.5px solid var(--panel-border);
	border-radius: 50%;
	overflow: hidden;
	box-shadow: 0 4px 15px rgba(0,0,0,0.5);
}

.radar-plate {
	position: absolute;
	inset: 4px;
	border: 1px solid rgba(255,255,255,0.06);
	border-radius: 50%;
	background: radial-gradient(circle, rgba(0,0,0,0) 30%, rgba(0,0,0,0.5) 100%);
	overflow: hidden;
}

.radar-sweep {
	position: absolute;
	inset: 0;
	background: conic-gradient(from 0deg, rgba(88, 166, 255, 0.15) 0deg, rgba(88, 166, 255, 0) 120deg);
	border-radius: 50%;
	animation: sweep-rotation 6s linear infinite;
}

@keyframes sweep-rotation {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}

.radar-grid-vertical {
	position: absolute;
	left: 50%; top: 0; bottom: 0; width: 1px;
	background: rgba(255,255,255,0.08);
}

.radar-grid-horizontal {
	position: absolute;
	top: 50%; left: 0; right: 0; height: 1px;
	background: rgba(255,255,255,0.08);
}

.radar-blip {
	position: absolute;
	width: 8px;
	height: 8px;
	border-radius: 50%;
	box-shadow: 0 0 8px currentColor;
}

.radar-blip.--ct { background: var(--ct-fill); color: var(--ct-fill); }
.radar-blip.--t { background: var(--t-fill); color: var(--t-fill); }
.radar-blip.--bomb { background: #e74c3c; color: #e74c3c; width: 10px; height: 10px; clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%); }

.mock-label-overlay {
	position: absolute;
	bottom: 12px;
	left: 0; right: 0;
	text-align: center;
	font-weight: 700;
	color: rgba(255,255,255,0.35);
	font-size: 0.75rem;
	text-transform: uppercase;
	letter-spacing: 0.1em;
	pointer-events: none;
}

/* SIDEBARS player rows */
.mock-sidebar {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	gap: 6px;
	justify-content: flex-end;
}

.mock-player-card {
	background: var(--panel-bg);
	border: 1px solid var(--panel-border);
	border-radius: var(--panel-radius);
	transform: skewX(var(--panel-skew));
	height: 32px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 10px;
	position: relative;
	overflow: hidden;
	box-shadow: 0 2px 5px rgba(0,0,0,0.15);
}

.mock-player-card .hp-bar {
	position: absolute;
	left: 0; top: 0; bottom: 0;
	opacity: 0.15;
	z-index: 1;
}

.mock-sidebar.--left .hp-bar {
	background: var(--ct-fill);
	transform-origin: left;
}

.mock-sidebar.--right .hp-bar {
	background: var(--t-fill);
	right: 0; left: auto;
	transform-origin: right;
}

.mock-player-card .player-name {
	font-weight: 600;
	color: #fff;
	z-index: 2;
	transform: skewX(calc(-1 * var(--panel-skew)));
}

.mock-player-card .player-hp {
	font-size: 0.75rem;
	font-weight: 700;
	z-index: 2;
	transform: skewX(calc(-1 * var(--panel-skew)));
}

.mock-sidebar.--left .player-hp { color: var(--ct-text-color); }
.mock-sidebar.--right .player-hp { color: var(--t-text-color); }

.mock-player-card .weapons {
	display: flex;
	gap: 6px;
	align-items: center;
	z-index: 2;
	transform: skewX(calc(-1 * var(--panel-skew)));
}

.mock-player-card .weapon {
	font-size: 0.8rem;
}

/* FOCUSED PLAYER card */
.mock-focused-player {
	width: 100%;
	height: 100%;
	background: var(--panel-bg);
	border: 1.5px solid var(--panel-border);
	border-radius: var(--panel-radius);
	transform: skewX(var(--panel-skew));
	display: flex;
	padding: 8px 12px;
	gap: 12px;
	box-shadow: 0 4px 15px rgba(0,0,0,0.4);
	overflow: hidden;
}

.avatar-placeholder {
	width: 50px;
	height: 100%;
	background: rgba(255,255,255,0.05);
	border: 1px solid var(--panel-border);
	border-radius: 4px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 1.5rem;
	transform: skewX(calc(-1 * var(--panel-skew)));
}

.player-details {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 4px;
	transform: skewX(calc(-1 * var(--panel-skew)));
}

.details-top {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.details-top .player-name {
	font-weight: 700;
	color: #fff;
	font-size: 0.9rem;
}

.details-top .player-weapon {
	font-weight: 600;
	color: var(--ct-text-color);
	font-size: 0.75rem;
}

.details-bottom {
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 20px;
	background: rgba(0,0,0,0.2);
	border-radius: 3px;
	padding: 0 8px;
	position: relative;
	overflow: hidden;
}

.details-bottom .hp-bar {
	position: absolute;
	left: 0; top: 0; bottom: 0;
	background: var(--ct-fill);
	opacity: 0.25;
	z-index: 1;
}

.details-bottom .health-armor {
	font-weight: 700;
	color: #fff;
	z-index: 2;
	font-size: 0.75rem;
}

.details-bottom .ammo {
	font-family: monospace;
	font-weight: 700;
	color: #adbac7;
	z-index: 2;
	font-size: 0.75rem;
}

/* PLAYERS ALIVE meter */
.mock-players-alive {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: var(--panel-bg);
	border: 1px solid var(--panel-border);
	border-radius: var(--panel-radius);
	transform: skewX(var(--panel-skew));
	overflow: hidden;
	box-shadow: 0 3px 8px rgba(0,0,0,0.25);
}

.mock-players-alive div {
	flex: 1;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 700;
	font-size: 0.75rem;
	transform: skewX(calc(-1 * var(--panel-skew)));
}

.mock-players-alive .ct-alive { background: var(--ct-fill); color: var(--ct-text-color); }
.mock-players-alive .t-alive { background: var(--t-fill); color: var(--t-text-color); }
.mock-players-alive .vs-label { flex: none; width: 30px; color: #8b949e; background: none; }

/* EVENT BADGE */
.mock-event-badge {
	width: 100%;
	height: 100%;
	background: var(--panel-bg);
	border: 1px solid var(--panel-border);
	border-radius: var(--panel-radius);
	transform: skewX(var(--panel-skew));
	display: flex;
	align-items: center;
	padding: 0 10px;
	gap: 8px;
	box-shadow: 0 3px 8px rgba(0,0,0,0.2);
}

.mock-event-badge .logo {
	height: 24px;
	transform: skewX(calc(-1 * var(--panel-skew)));
}

.mock-event-badge .text {
	display: flex;
	flex-direction: column;
	transform: skewX(calc(-1 * var(--panel-skew)));
}

.mock-event-badge .title {
	font-size: 0.65rem;
	font-weight: 700;
	color: #fff;
	letter-spacing: 0.05em;
}

.mock-event-badge .subtitle {
	font-size: 0.55rem;
	color: #8b949e;
}

/* CURRENT MAP and VETO STRIP */
.mock-current-map {
	width: 100%;
	height: 100%;
	background: #0d1117;
	border: 1.5px solid var(--panel-border);
	border-radius: var(--panel-radius);
	transform: skewX(var(--panel-skew));
	overflow: hidden;
	position: relative;
	box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}

.mock-current-map .map-bg {
	position: absolute;
	inset: 0;
	background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.8));
	display: flex;
	align-items: center;
	justify-content: center;
	color: rgba(255,255,255,0.06);
	font-size: 1.4rem;
	font-weight: 700;
	text-transform: uppercase;
	transform: skewX(calc(-1 * var(--panel-skew)));
}

.mock-current-map .map-overlay {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	justify-content: center;
	padding: 0 12px;
	transform: skewX(calc(-1 * var(--panel-skew)));
	z-index: 2;
}

.mock-current-map .map-name {
	font-weight: 700;
	color: #fff;
	font-size: 0.8rem;
	text-transform: uppercase;
}

.mock-current-map .series-score {
	font-size: 0.65rem;
	color: var(--t-text-color);
	font-weight: 600;
}

/* SLEEK MAP VETO BAR */
.mock-maps-sleek {
	width: 100%;
	height: 100%;
	background: var(--panel-bg);
	border: 1px solid var(--panel-border);
	border-radius: var(--panel-radius);
	transform: skewX(var(--panel-skew));
	overflow: hidden;
	display: flex;
	box-shadow: 0 3px 8px rgba(0,0,0,0.25);
}

.veto-bar {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	transform: skewX(calc(-1 * var(--panel-skew)));
}

.veto-item {
	flex: 1;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 0.65rem;
	font-weight: 700;
	color: #8b949e;
	border-right: 1px solid var(--panel-border);
}

.veto-item:last-child { border-right: none; }

.veto-item.--picked {
	background: rgba(255,255,255,0.03);
	color: #adbac7;
}

.veto-item.--active {
	background: var(--ct-fill);
	color: var(--ct-text-color);
}

/* SPONSOR PANELS */
.mock-sponsor-panel {
	width: 100%;
	height: 100%;
	background: var(--panel-bg);
	border: 1px solid var(--panel-border);
	border-left: 3px solid var(--t-border);
	border-radius: var(--panel-radius);
	transform: skewX(var(--panel-skew));
	display: flex;
	flex-direction: column;
	justify-content: center;
	padding: 0 10px;
	box-shadow: 0 3px 8px rgba(0,0,0,0.2);
}

.mock-sponsor-panel span {
	display: block;
	transform: skewX(calc(-1 * var(--panel-skew)));
}

.mock-sponsor-panel .title {
	font-size: 0.7rem;
	font-weight: 700;
	color: #fff;
}

.mock-sponsor-panel .subtitle {
	font-size: 0.55rem;
	color: #8b949e;
	text-transform: uppercase;
}

.mock-box {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #fff;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.1em;
	font-size: 24px;
}

.resize-handle {
	position: absolute;
	background: #fff;
	border: 2px solid #3498db;
	z-index: 20;
}

.resize-handle.--x { width: 12px; height: 30px; top: calc(50% - 15px); cursor: ew-resize; }
.resize-handle.--y { width: 30px; height: 12px; left: calc(50% - 15px); top: -6px; cursor: ns-resize; }

.properties-sidebar {
	width: 320px;
	background: #161b22;
	border: 1px solid #30363d;
	border-radius: 8px;
	display: flex;
	flex-direction: column;
}

.sidebar-header { padding: 16px; border-bottom: 1px solid #30363d; }
.sidebar-header h3 { margin: 0 0 4px 0; font-size: 1rem; color: #fff; }
.sidebar-tip { margin: 0; font-size: 0.75rem; color: #8b949e; line-height: 1.3; }

.element-list {
	flex: 1;
	overflow-y: auto;
	padding: 8px;
}

.element-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 10px 12px;
	margin-bottom: 4px;
	border-radius: 6px;
	cursor: pointer;
	color: #adbac7;
	transition: background 0.15s, border-color 0.15s;
	border: 1px solid transparent;
}

.element-item:hover { background: #21262d; color: #fff; }
.element-item.--active { background: #3498db; color: #fff; }

/* Out of Safe Area Warnings in list */
.element-item.--warning:not(.--active) {
	border-color: rgba(230, 126, 34, 0.4);
	background: rgba(230, 126, 34, 0.05);
	color: #e67e22;
}
.element-item.--warning:not(.--active):hover {
	background: rgba(230, 126, 34, 0.1);
}

/* Collision Warnings in list */
.element-item.--danger:not(.--active) {
	border-color: rgba(231, 76, 60, 0.4);
	background: rgba(231, 76, 60, 0.05);
	color: #ea6060;
}
.element-item.--danger:not(.--active):hover {
	background: rgba(231, 76, 60, 0.1);
}

.btn-icon { background: none; border: none; cursor: pointer; filter: grayscale(1); }
.element-item.--active .btn-icon { filter: none; }

.properties-panel {
	padding: 16px;
	border-top: 1px solid #30363d;
	background: #0d1117;
	border-radius: 0 0 8px 8px;
	overflow-y: auto;
	max-height: 480px;
}

.properties-panel h3 { margin: 0 0 16px 0; font-size: 0.95rem; color: #fff; }

.prop-group { margin-bottom: 16px; }
.prop-group label { display: block; font-size: 0.8rem; color: #8b949e; margin-bottom: 8px; text-transform: uppercase; }

.prop-row { display: flex; gap: 16px; font-family: monospace; color: #c9d1d9; }

.coord-item {
	display: flex;
	justify-content: space-between;
	width: 100%;
	padding: 2px 0;
	border-bottom: 1px solid rgba(255,255,255,0.02);
}

.toolbar-divider {
	color: #30363d;
	margin: 0 4px;
	user-select: none;
}
.--danger-btn {
	color: #f85149 !important;
	border-color: rgba(248, 81, 73, 0.4) !important;
}
.--danger-btn:hover {
	background: rgba(248, 81, 73, 0.15) !important;
	border-color: #f85149 !important;
	color: #ff7b72 !important;
}

/* Phase 19A: Smart Snapping visual guidelines */
.smart-guide {
	position: absolute;
	background: none;
	pointer-events: none;
	z-index: 99;
}
.smart-guide.--vertical {
	top: 0;
	bottom: 0;
	width: 1px;
	border-left: 1px dashed rgba(0, 229, 255, 0.8);
}
.smart-guide.--horizontal {
	left: 0;
	right: 0;
	height: 1px;
	border-top: 1px dashed rgba(0, 229, 255, 0.8);
}
.smart-guide-label {
	position: absolute;
	background: rgba(13, 17, 23, 0.9);
	color: #00e5ff;
	font-size: 0.6rem;
	padding: 2px 6px;
	border-radius: 3px;
	border: 1px solid rgba(0, 229, 255, 0.35);
	white-space: nowrap;
	font-family: monospace;
	z-index: 100;
}
.smart-guide.--vertical .smart-guide-label {
	top: 12px;
	left: 6px;
}
.smart-guide.--horizontal .smart-guide-label {
	left: 12px;
	top: 6px;
}

/* 11. Mock Promotion / Mobile Text Panel */
.mock-promotion-panel {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	justify-content: center;
	padding: 8px 14px;
	gap: 3px;
	background: var(--panel-bg);
	border: 1px solid var(--panel-border);
	border-left: 3px solid #58a6ff;
	border-radius: var(--panel-radius);
	overflow: hidden;
	box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}

.mock-promotion-panel .mock-promo-badge {
	font-size: 0.65rem;
	font-weight: 800;
	color: #58a6ff;
	letter-spacing: 0.05em;
	text-transform: uppercase;
}

.mock-promotion-panel .mock-promo-title {
	font-size: 0.75rem;
	font-weight: 700;
	color: #adbac7;
	text-transform: uppercase;
}

.mock-promotion-panel .mock-promo-subtitle {
	font-size: 0.85rem;
	font-weight: 700;
	color: #fff;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

</style>
