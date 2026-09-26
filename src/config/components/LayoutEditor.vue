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
					<label class="toggle-control" :title="$t('Show/Hide Live Text from Mobile Phone')">
						<input type="checkbox" v-model="showMobileTicker">
						<span>{{ $t("💬 Mobile Text") }}</span>
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
							v-show="el.def.id !== 'mobile-ticker' || showMobileTicker"
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

								<!-- 10. SPONSORS LEFT/RIGHT -->
								<div v-else-if="el.def.id.startsWith('sponsor-')" class="mock-sponsor-panel" style="justify-content: center; align-items: center;">
									<span class="title">{{ $t("SPONSOR SLOT") }}</span>
								</div>

								<!-- 11. MOBILE LOWER THIRD / TEXT TICKER -->
								<div v-else-if="el.def.id === 'mobile-ticker'" class="mock-mobile-ticker">
									<div class="mock-ticker-header">
										<span class="mock-badge">⚡ {{ $t("PHONE ON-AIR") }}</span>
										<span class="mock-ticker-title">{{ currentMobileTickerTitle }}</span>
									</div>
									<div class="mock-ticker-text">{{ currentMobileTickerText }}</div>
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

			<!-- Diagnostics Sidebar Inspector & Element Navigator -->
			<aside class="editor-sidebar">
				<div class="elements-list">
					<div 
						v-for="el in elements" 
						:key="el.def.id"
						:class="['element-item', { '--active': selectedId === el.def.id }]"
						@click="selectedId = el.def.id"
					>
						<div style="display: flex; align-items: center; gap: 8px;">
							<span class="element-color-bullet" :style="{ background: el.def.border || el.def.color }"></span>
							<span class="element-name">{{ $text(el.def.label) }}</span>
						</div>
						
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
					
					<!-- Special Mobile Text Tester when mobile-ticker is selected -->
					<div v-if="selectedElement.def.id === 'mobile-ticker'" class="prop-group" style="background: rgba(31, 111, 235, 0.1); border: 1px solid rgba(88, 166, 255, 0.3); border-radius: 6px; padding: 10px;">
						<label style="color: #58a6ff; font-weight: bold;">💬 {{ $t("Live Phone Text Stream") }}</label>
						<div class="prop-row" style="flex-direction: column; gap: 8px;">
							<input 
								type="text" 
								v-model="phoneTextDraft" 
								:placeholder="$t('Type text or send from mobile...')"
								style="background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 6px 8px; color: #fff; font-size: 0.8rem; width: 100%;"
								@keyup.enter="sendPhoneTextDraft"
							/>
							<div style="display: flex; gap: 6px;">
								<button class="btn-secondary" style="flex: 1; background: #1f6feb; color: #fff; border: none;" @click="sendPhoneTextDraft">
									{{ $t("🚀 Send to Stream") }}
								</button>
								<button class="btn-secondary --danger-btn" @click="clearPhoneTextDraft">
									{{ $t("Clear") }}
								</button>
							</div>
						</div>
					</div>

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
		id: 'event-badge', label: 'Event Badge',
		color: 'rgba(231,76,60,0.22)', border: 'rgba(231,76,60,0.55)',
		baseW: 240, baseH: 45,
		anchor: { v: 'top', h: 'left' },
		props: [ { key: 'layout.eventBadge.top', edge: 'top' }, { key: 'layout.eventBadge.left', edge: 'left' } ],
		resizable: true, sizeKey: 'style.eventBadge.width', sizeUnit: 'rem',
		visibleKey: 'layout.eventBadge.visible'
	},
	{
		id: 'mobile-ticker', label: 'Mobile Ticker / Banner',
		color: 'rgba(31,111,235,0.25)', border: 'rgba(88,166,255,0.7)',
		baseW: 460, baseH: 80,
		anchor: { v: 'bottom', h: 'left' },
		props: [ { key: 'layout.promotion.left', edge: 'left' }, { key: 'layout.promotion.bottom', edge: 'bottom' } ],
		resizable: true, sizeKey: 'layout.promotion.width', sizeUnit: 'px',
		visibleKey: 'promotion.visible'
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
			showMobileTicker: true,
			phoneTextDraft: '',
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
		currentMobileTickerTitle() {
			return state.options['promotion.title'] || '📢 ПРЯМОЙ ЭФИР'
		},
		currentMobileTickerText() {
			return state.options['branding.ticker'] || this.phoneTextDraft || '🔥 MATCH POINT / РЕШАЮЩИЙ РАУНД'
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
	mounted() {
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
		sendPhoneTextDraft() {
			if (!this.phoneTextDraft) return
			actions.setOption('branding.ticker', this.phoneTextDraft)
		},
		clearPhoneTextDraft() {
			this.phoneTextDraft = ''
			actions.setOption('branding.ticker', '')
		},
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
				if (/^[\d\s\+\-\*\/\(\)\.]+$/.test(s)) {
					const res = Function(`'use strict'; return (${s})`)()
					return isNaN(res) ? fb : res
				}
			} catch (_) {}
			return parseFloat(s) || fb
		},
		getTransformOrigin(hAnchor) {
			if (hAnchor === 'left') return 'left center'
			if (hAnchor === 'right') return 'right center'
			return 'center center'
		},
		initElements() {
			this.elements = DEFS.map(def => {
				let bw = def.baseW
				let bh = def.baseH
				
				if (def.sizeKey) {
					const sizeVal = state.options[def.sizeKey]
					if (sizeVal !== undefined && sizeVal !== null) {
						if (def.sizeUnit === '%') {
							const pct = parseFloat(sizeVal) || 100
							bw = (pct / 100) * (def.sizeRef || VP_W)
						} else if (def.sizeUnit === 'rem') {
							const rem = parseFloat(sizeVal) || (def.baseW / this.remPx)
							bw = rem * this.remPx
						} else if (def.sizeUnit === '') {
							const scale = parseFloat(sizeVal) || 1
							bw = def.baseW * scale
							bh = def.baseH * scale
						}
					}
				}

				if (def.id.startsWith('sponsor-')) {
					const wOpt = state.options['style.sponsors.width']
					const hOpt = state.options['style.sponsors.height']
					if (wOpt) bw = this.evaluateCss(wOpt, VP_W, bw)
					if (hOpt) bh = this.evaluateCss(hOpt, VP_H, bh)
				}

				const positions = {}
				for (const prop of def.props) {
					const val = state.options[prop.key]
					positions[prop.edge] = this.evaluateCss(val, prop.edge === 'top' || prop.edge === 'bottom' ? VP_H : VP_W, 0)
				}

				let top = 0, left = 0
				if (def.anchor.v === 'top') top = positions.top ?? 0
				else top = VP_H - (positions.bottom ?? 0) - bh

				if (def.anchor.h === 'left') left = positions.left ?? 0
				else if (def.anchor.h === 'right') left = VP_W - (positions.right ?? 0) - bw
				else left = (VP_W - bw) / 2

				const visibleVal = state.options[def.visibleKey]
				const visible = visibleVal !== false && visibleVal !== 'none'

				return {
					def,
					top, left,
					w: bw, h: bh,
					baseW: bw, baseH: bh,
					visible
				}
			})
		},
		resize() {
			if (!this.$refs.container) return
			const rect = this.$refs.container.getBoundingClientRect()
			const padding = 20
			const availW = rect.width - padding * 2
			const availH = rect.height - padding * 2
			
			const scaleX = availW / VP_W
			const scaleY = availH / VP_H
			this.viewportScale = Math.min(scaleX, scaleY, 1)
		},
		startDrag(e, el, mode) {
			e.preventDefault()
			this.selectedId = el.def.id
			
			this.drag = {
				mode,
				el,
				startX: e.clientX,
				startY: e.clientY,
				initLeft: el.left,
				initTop: el.top,
				initW: el.w,
				initH: el.h,
				initBaseW: el.baseW,
				initBaseH: el.baseH
			}
		},
		onMouseMove(e) {
			if (!this.drag) return
			const { mode, el, startX, startY, initLeft, initTop, initW, initH, initBaseW, initBaseH } = this.drag
			const dx = (e.clientX - startX) / this.viewportScale
			const dy = (e.clientY - startY) / this.viewportScale
			
			const grid = this.gridSizes[this.gridIdx]
			
			if (mode === 'move') {
				let nextLeft = initLeft + dx
				let nextTop = initTop + dy
				
				this.activeSnapX = null
				this.activeSnapY = null
				
				if (this.smartGuidesEnabled) {
					const snapThreshold = 6
					
					const linesX = [
						{ value: 0, label: 'Stage Left Edge' },
						{ value: VP_W / 2, label: 'Stage Center X' },
						{ value: VP_W, label: 'Stage Right Edge' },
						{ value: 96, label: '90% Title Safe Area Left' },
						{ value: VP_W - 96, label: '90% Title Safe Area Right' }
					]
					
					const linesY = [
						{ value: 0, label: 'Stage Top Edge' },
						{ value: VP_H / 2, label: 'Stage Center Y' },
						{ value: VP_H, label: 'Stage Bottom Edge' },
						{ value: 54, label: '90% Title Safe Area Top' },
						{ value: VP_H - 54, label: '90% Title Safe Area Bottom' }
					]
					
					this.elements.forEach(other => {
						if (other.def.id === el.def.id || !other.visible) return
						linesX.push(
							{ value: other.left, label: `${this.$text(other.def.label)} Left Edge` },
							{ value: other.left + other.w / 2, label: `${this.$text(other.def.label)} Center X` },
							{ value: other.left + other.w, label: `${this.$text(other.def.label)} Right Edge` }
						)
						linesY.push(
							{ value: other.top, label: `${this.$text(other.def.label)} Top Edge` },
							{ value: other.top + other.h / 2, label: `${this.$text(other.def.label)} Center Y` },
							{ value: other.top + other.h, label: `${this.$text(other.def.label)} Bottom Edge` }
						)
					})
					
					let bestDistX = snapThreshold + 1
					let bestSnapX = null
					
					const elEdgesX = [
						{ offset: 0, label: 'Left' },
						{ offset: el.w / 2, label: 'Center' },
						{ offset: el.w, label: 'Right' }
					]
					
					for (const target of linesX) {
						for (const edge of elEdgesX) {
							const currentEdgePos = nextLeft + edge.offset
							const dist = Math.abs(currentEdgePos - target.value)
							if (dist <= snapThreshold && dist < bestDistX) {
								bestDistX = dist
								bestSnapX = {
									nextLeft: target.value - edge.offset,
									lineValue: target.value,
									label: target.label
								}
							}
						}
					}
					
					if (bestSnapX) {
						nextLeft = bestSnapX.nextLeft
						this.activeSnapX = bestSnapX
					}
					
					let bestDistY = snapThreshold + 1
					let bestSnapY = null
					
					const elEdgesY = [
						{ offset: 0, label: 'Top' },
						{ offset: el.h / 2, label: 'Center' },
						{ offset: el.h, label: 'Bottom' }
					]
					
					for (const target of linesY) {
						for (const edge of elEdgesY) {
							const currentEdgePos = nextTop + edge.offset
							const dist = Math.abs(currentEdgePos - target.value)
							if (dist <= snapThreshold && dist < bestDistY) {
								bestDistY = dist
								bestSnapY = {
									nextTop: target.value - edge.offset,
									lineValue: target.value,
									label: target.label
								}
							}
						}
					}
					
					if (bestSnapY) {
						nextTop = bestSnapY.nextTop
						this.activeSnapY = bestSnapY
					}
				}
				
				if (grid > 0 && this.snapEnabled && !this.activeSnapX) {
					nextLeft = Math.round(nextLeft / grid) * grid
				}
				if (grid > 0 && this.snapEnabled && !this.activeSnapY) {
					nextTop = Math.round(nextTop / grid) * grid
				}
				
				el.left = Math.max(0, Math.min(VP_W - el.w, nextLeft))
				el.top = Math.max(0, Math.min(VP_H - el.h, nextTop))
				
				this.persistElementCoordinates(el)
			} else if (mode === 'resize-x') {
				let factor = 1
				if (el.def.anchor.h === 'right') factor = -1
				
				let nextW = initW + dx * factor
				if (grid > 0 && this.snapEnabled) nextW = Math.round(nextW / grid) * grid
				
				nextW = Math.max(50, Math.min(VP_W, nextW))
				el.w = nextW
				el.baseW = nextW
				
				if (el.def.keepAspect) {
					const ratio = el.def.baseH / el.def.baseW
					el.h = nextW * ratio
					el.baseH = el.h
				}
				
				if (el.def.anchor.h === 'right') {
					el.left = initLeft - (nextW - initW)
				}
				
				this.persistElementSize(el)
			} else if (mode === 'resize-y') {
				let nextH = initH + dy
				if (grid > 0 && this.snapEnabled) nextH = Math.round(nextH / grid) * grid
				
				nextH = Math.max(20, Math.min(VP_H, nextH))
				el.h = nextH
				el.baseH = nextH
				
				this.persistElementSize(el)
			}
		},
		onMouseUp() {
			this.drag = null
			this.activeSnapX = null
			this.activeSnapY = null
		},
		persistElementCoordinates(el) {
			for (const prop of el.def.props) {
				let val = 0
				if (prop.edge === 'top') val = el.top
				else if (prop.edge === 'bottom') val = VP_H - el.top - el.h
				else if (prop.edge === 'left') {
					if (el.def.anchor.h === 'center') val = el.left + el.w / 2
					else val = el.left
				}
				else if (prop.edge === 'right') val = VP_W - el.left - el.w
				
				const remVal = (val / this.remPx).toFixed(2) + 'rem'
				actions.setOption(prop.key, remVal)
			}
		},
		persistElementSize(el) {
			if (!el.def.sizeKey) return
			const unit = el.def.sizeUnit
			let val = el.baseW
			if (unit === '%') {
				val = (el.baseW / VP_W * 100).toFixed(2) + '%'
			} else if (unit === 'rem') {
				val = (el.baseW / this.remPx).toFixed(2) + 'rem'
			} else if (unit === '') {
				val = (el.baseW / el.def.baseW).toFixed(2)
			}
			actions.setOption(el.def.sizeKey, val)
			
			if (el.def.id.startsWith('sponsor-')) {
				const remW = (el.baseW / this.remPx).toFixed(2) + 'rem'
				const remH = (el.baseH / this.remPx).toFixed(2) + 'rem'
				actions.setOption('style.sponsors.width', remW)
				actions.setOption('style.sponsors.height', remH)
			}
		},
		toggleVisibility(el) {
			if (!el.def.visibleKey) return
			el.visible = !el.visible
			actions.setOption(el.def.visibleKey, el.visible)
		},
		resetElement(el) {
			this.initElements()
			this.persistElementCoordinates(el)
			this.persistElementSize(el)
		},
		
		// Presets Management
		async loadPresetsList() {
			try {
				const res = await fetch('/config/layout-presets')
				if (res.ok) {
					this.presets = await res.json()
				}
			} catch (err) {
				console.error('Failed to load presets:', err)
			}
		},
		selectPreset() {
			localStorage.setItem('lastSelectedLayoutPresetId', this.activePreset)
			if (!this.activePreset) {
				this.initElements()
				return
			}
			const p = this.presets.find(x => x.id === this.activePreset)
			if (!p) return
			
			this.elements.forEach(el => {
				let bw = el.def.baseW
				let bh = el.def.baseH
				
				if (el.def.sizeKey && p.options[el.def.sizeKey]) {
					const sizeVal = p.options[el.def.sizeKey].value
					if (el.def.sizeUnit === '%') bw = (parseFloat(sizeVal) / 100) * (el.def.sizeRef || VP_W)
					else if (el.def.sizeUnit === 'rem') bw = parseFloat(sizeVal) * this.remPx
					else if (el.def.sizeUnit === '') {
						bw = el.def.baseW * parseFloat(sizeVal)
						bh = el.def.baseH * parseFloat(sizeVal)
					}
				}
				
				const positions = {}
				for (const prop of el.def.props) {
					const opt = p.options[prop.key]
					if (opt) {
						positions[prop.edge] = this.evaluateCss(opt.value, prop.edge === 'top' || prop.edge === 'bottom' ? VP_H : VP_W, 0)
					}
				}
				
				let top = 0, left = 0
				let w = bw, h = bh
				
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
			
			const name = prompt(translateText("Enter name for duplicated preset:"), `${p.name} (Copy)`)
			if (!name) return
			
			try {
				const res = await fetch('/config/layout-presets', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name,
						description: p.description,
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
				alert(translateText('Preset duplicated successfully!'))
			} catch (err) {
				alert(translateText(`Failed to duplicate preset: ${err.message}`))
			}
		},
		async deletePreset() {
			if (!this.activePreset) return
			const p = this.presets.find(x => x.id === this.activePreset)
			if (!p || p.isCustom === false) return
			
			if (!confirm(translateText(`Are you sure you want to delete preset "${p.name}"?`))) return
			
			try {
				const res = await fetch(`/config/layout-presets/${p.id}`, { method: 'DELETE' })
				if (!res.ok) {
					const err = await res.json()
					alert(translateText(`Delete failed: ${err.message}`))
					return
				}
				this.presets = this.presets.filter(x => x.id !== p.id)
				this.activePreset = ''
				this.selectPreset()
				alert(translateText('Preset deleted successfully!'))
			} catch (err) {
				alert(translateText(`Failed to delete preset: ${err.message}`))
			}
		},
		async applyPreset() {
			if (!this.activePreset) return
			const p = this.presets.find(x => x.id === this.activePreset)
			if (!p) return
			
			for (const [key, val] of Object.entries(p.options)) {
				actions.setOption(key, val.value)
			}
			alert(translateText(`Preset "${p.name}" applied live to HUD options!`))
		},
		exportPreset() {
			if (!this.activePreset) return
			const p = this.presets.find(x => x.id === this.activePreset)
			if (!p) return
			
			const json = JSON.stringify({
				name: p.name,
				description: p.description,
				options: p.options
			}, null, 2)
			
			const blob = new Blob([json], { type: 'application/json' })
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `neuroncast-layout-${p.id}.json`
			a.click()
			URL.revokeObjectURL(url)
		},
		importPreset(e) {
			const file = e.target.files[0]
			if (!file) return
			
			const reader = new FileReader()
			reader.onload = async (evt) => {
				try {
					const imported = JSON.parse(evt.target.result)
					if (!imported.name || !imported.options) {
						alert(translateText('Invalid layout preset JSON format. Must contain "name" and "options".'))
						return
					}
					
					const allowedKeys = [
						'style.eventBadge.width',
						'style.currentMap.width',
						'style.sponsors.width',
						'style.sponsors.height',
						'style.maps.scale',
						'style.mapsSleek.scale',
						'layout.promotion.width',
						'promotion.visible'
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
	padding: 4px 8px;
	gap: 12px;
}

.toggle-control {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 0.8rem;
	color: #c9d1d9;
	cursor: pointer;
	user-select: none;
}

.toggle-control input[type="checkbox"] {
	cursor: pointer;
	accent-color: #58a6ff;
}

.grid-select {
	padding: 4px 8px;
	background: #0d1117;
	border: 1px solid #30363d;
	color: #c9d1d9;
	border-radius: 4px;
	font-size: 0.8rem;
}

.editor-workspace {
	display: flex;
	gap: 20px;
	flex: 1;
	min-height: 0;
}

.canvas-container {
	flex: 1;
	background: #090d13;
	border: 1px solid #30363d;
	border-radius: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	overflow: hidden;
}

.viewport {
	width: 1920px;
	height: 1080px;
	background: #000;
	position: relative;
	transform-origin: center center;
	box-shadow: 0 0 30px rgba(0,0,0,0.8);
	overflow: hidden;
}

.hud-screenshot-bg {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	pointer-events: none;
	opacity: 0.75;
}

.hud-bg {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	border: none;
	pointer-events: none;
	opacity: 0.6;
}

/* Technical Alignment Grid */
.tech-grid {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-size: 50px 50px;
	background-image: 
		linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
		linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
	pointer-events: none;
}

/* Center Crosshairs */
.center-lines {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
}

.center-line.--vertical {
	position: absolute;
	left: 50%;
	top: 0;
	bottom: 0;
	width: 1px;
	background: rgba(88, 166, 255, 0.4);
	border-left: 1px dashed rgba(88, 166, 255, 0.6);
}

.center-line.--horizontal {
	position: absolute;
	top: 50%;
	left: 0;
	right: 0;
	height: 1px;
	background: rgba(88, 166, 255, 0.4);
	border-top: 1px dashed rgba(88, 166, 255, 0.6);
}

/* 10% Safe Area Guide */
.safe-area-outline {
	position: absolute;
	top: 54px;
	left: 96px;
	right: 96px;
	bottom: 54px;
	border: 1px dashed rgba(46, 204, 113, 0.5);
	pointer-events: none;
}

.safe-area-label {
	position: absolute;
	top: 4px;
	left: 8px;
	font-size: 10px;
	color: rgba(46, 204, 113, 0.7);
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

/* Smart Snap Visual Guidelines */
.smart-guide {
	position: absolute;
	pointer-events: none;
	z-index: 999;
}

.smart-guide.--vertical {
	top: 0;
	bottom: 0;
	width: 1px;
	background: #00e5ff;
	box-shadow: 0 0 6px rgba(0, 229, 255, 0.8);
}

.smart-guide.--horizontal {
	left: 0;
	right: 0;
	height: 1px;
	background: #00e5ff;
	box-shadow: 0 0 6px rgba(0, 229, 255, 0.8);
}

.smart-guide-label {
	position: absolute;
	background: rgba(0, 229, 255, 0.9);
	color: #000;
	font-size: 9px;
	font-weight: bold;
	padding: 1px 4px;
	border-radius: 2px;
	white-space: nowrap;
}

.smart-guide.--vertical .smart-guide-label {
	top: 8px;
	left: 4px;
}

.smart-guide.--horizontal .smart-guide-label {
	left: 8px;
	top: 4px;
}

/* Elements on canvas */
.hud-el {
	position: absolute;
	cursor: move;
	user-select: none;
	transition: outline 0.15s ease;
	box-sizing: border-box;
}

.hud-el:hover {
	outline: 1.5px dashed rgba(255, 255, 255, 0.6);
}

.hud-el.--active {
	outline: 2px solid #58a6ff !important;
	z-index: 100 !important;
}

.hud-el.--hidden {
	opacity: 0.35;
	filter: grayscale(80%);
}

.hud-el.--outside-safe {
	outline: 2px dashed #e67e22;
}

.hud-el.--colliding {
	outline: 2px dashed #e74c3c;
}

.mock-content {
	width: 100%;
	height: 100%;
	pointer-events: none;
	display: flex;
}

/* 1. Mock Top Bar */
.mock-top-bar {
	width: 100%;
	height: 100%;
	display: flex;
	background: var(--panel-bg);
	border: 1px solid var(--panel-border);
	border-radius: var(--panel-radius);
	overflow: hidden;
	font-family: var(--primary-font);
}

.mock-top-bar-team {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: bold;
	font-size: 1.1rem;
}

.mock-team-ct { background: var(--ct-fill); color: var(--ct-text-color); border-right: 2px solid var(--ct-border); }
.mock-team-t { background: var(--t-fill); color: var(--t-text-color); border-left: 2px solid var(--t-border); }

.mock-top-bar-center {
	width: 180px;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #fff;
	font-weight: bold;
	font-size: 0.9rem;
	letter-spacing: 0.05em;
}

/* 2. Mock Radar */
.mock-radar {
	width: 100%;
	height: 100%;
	background: radial-gradient(circle, rgba(16, 24, 38, 0.9) 0%, rgba(8, 12, 20, 0.95) 100%);
	border: 2px solid rgba(88, 166, 255, 0.5);
	border-radius: 8px;
	position: relative;
	overflow: hidden;
}

.radar-plate {
	width: 100%;
	height: 100%;
	position: relative;
	opacity: 0.4;
}

.radar-grid-vertical {
	position: absolute;
	top: 0; bottom: 0; left: 50%;
	width: 1px;
	background: rgba(88, 166, 255, 0.4);
}

.radar-grid-horizontal {
	position: absolute;
	left: 0; right: 0; top: 50%;
	height: 1px;
	background: rgba(88, 166, 255, 0.4);
}

.mock-label-overlay {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	color: #58a6ff;
	font-weight: 800;
	font-size: 1.1rem;
	letter-spacing: 0.1em;
}

/* 3 & 4. Mock Sidebars */
.mock-sidebar {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	gap: 4px;
	justify-content: space-between;
}

.mock-player-card {
	flex: 1;
	background: var(--panel-bg);
	border: 1px solid var(--panel-border);
	border-radius: var(--panel-radius);
	display: flex;
	align-items: center;
	padding: 0 8px;
	position: relative;
	overflow: hidden;
}

.mock-sidebar.--left .mock-player-card { border-left: 3px solid var(--ct-border); }
.mock-sidebar.--right .mock-player-card { border-right: 3px solid var(--t-border); justify-content: flex-end; }

.mock-player-card .hp-bar {
	position: absolute;
	bottom: 0;
	left: 0;
	height: 2px;
	background: #2ecc71;
}

.mock-player-card .player-name {
	font-size: 0.75rem;
	font-weight: bold;
	color: #fff;
	z-index: 1;
}

/* 5. Mock Focused Player */
.mock-focused-player {
	width: 100%;
	height: 100%;
	background: var(--panel-bg);
	border: 1px solid var(--panel-border);
	border-radius: var(--panel-radius);
	display: flex;
	align-items: center;
	padding: 0 16px;
}

.mock-focused-player .player-details {
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.mock-focused-player .player-name {
	color: #fff;
	font-weight: bold;
	font-size: 0.9rem;
	letter-spacing: 0.05em;
}

.mock-focused-player .hp-bar {
	height: 4px;
	background: #2ecc71;
	border-radius: 2px;
}

/* 6. Mock Players Alive */
.mock-players-alive {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	background: var(--panel-bg);
	border: 1px solid var(--panel-border);
	border-radius: var(--panel-radius);
	overflow: hidden;
	font-weight: bold;
	font-size: 0.8rem;
}

.mock-players-alive .ct-alive { flex: 1; background: var(--ct-fill); color: #fff; text-align: center; height: 100%; display: flex; align-items: center; justify-content: center; }
.mock-players-alive .t-alive { flex: 1; background: var(--t-fill); color: #fff; text-align: center; height: 100%; display: flex; align-items: center; justify-content: center; }
.mock-players-alive .vs-label { padding: 0 4px; color: #8b949e; font-size: 0.65rem; }

/* 7. Mock Event Badge */
.mock-event-badge {
	width: 100%;
	height: 100%;
	background: linear-gradient(90deg, rgba(231,76,60,0.3) 0%, var(--panel-bg) 100%);
	border: 1px solid var(--panel-border);
	border-left: 3px solid #e74c3c;
	border-radius: var(--panel-radius);
	display: flex;
	align-items: center;
	padding: 0 12px;
	color: #fff;
	font-weight: bold;
	font-size: 0.8rem;
}

/* 8. Mock Current Map */
.mock-current-map {
	width: 100%;
	height: 100%;
	border: 1px solid var(--panel-border);
	border-radius: var(--panel-radius);
	overflow: hidden;
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
}

.mock-current-map .map-name {
	color: #fff;
	font-weight: bold;
	font-size: 0.85rem;
	letter-spacing: 0.05em;
}

/* 9. Mock Sleek Maps */
.mock-maps-sleek {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--panel-bg);
	border: 1px solid var(--panel-border);
	border-radius: var(--panel-radius);
	color: #4fe3c1;
	font-size: 0.75rem;
	font-weight: bold;
}

/* 10. Mock Sponsor Panel */
.mock-sponsor-panel {
	width: 100%;
	height: 100%;
	display: flex;
	background: rgba(220,180,80,0.15);
	border: 1px dashed rgba(220,180,80,0.5);
	border-radius: var(--panel-radius);
	color: #e3b341;
	font-size: 0.75rem;
	font-weight: bold;
}

/* 11. Mock Mobile Ticker */
.mock-mobile-ticker {
	width: 100%;
	height: 100%;
	background: linear-gradient(135deg, rgba(31, 111, 235, 0.25) 0%, rgba(13, 17, 23, 0.95) 100%);
	border: 1.5px solid rgba(88, 166, 255, 0.65);
	border-left: 4px solid #58a6ff;
	border-radius: 6px;
	display: flex;
	flex-direction: column;
	justify-content: center;
	padding: 10px 14px;
	gap: 4px;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
	backdrop-filter: blur(10px);
}

.mock-mobile-ticker .mock-ticker-header {
	display: flex;
	align-items: center;
	gap: 6px;
}

.mock-mobile-ticker .mock-badge {
	background: #1f6feb;
	color: #fff;
	font-size: 0.65rem;
	font-weight: 800;
	padding: 2px 6px;
	border-radius: 4px;
	letter-spacing: 0.05em;
}

.mock-mobile-ticker .mock-ticker-title {
	font-size: 0.75rem;
	font-weight: 800;
	color: #adbac7;
	text-transform: uppercase;
	letter-spacing: 0.06em;
}

.mock-mobile-ticker .mock-ticker-text {
	font-size: 0.9rem;
	font-weight: 700;
	color: #fff;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

/* Fallback Wireframe */
.mock-box {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #fff;
	font-weight: bold;
	font-size: 0.8rem;
	text-transform: uppercase;
}

/* Resize Handles */
.resize-handle {
	position: absolute;
	background: #58a6ff;
	border: 1px solid #fff;
	z-index: 101;
}

.resize-handle.--x {
	top: 50%;
	transform: translateY(-50%);
	width: 10px;
	height: 24px;
	border-radius: 3px;
	cursor: ew-resize;
}

.resize-handle.--y {
	left: 50%;
	bottom: -6px;
	transform: translateX(-50%);
	width: 24px;
	height: 10px;
	border-radius: 3px;
	cursor: ns-resize;
}

/* Sidebar Navigator & Diagnostics Inspector */
.editor-sidebar {
	width: 320px;
	display: flex;
	flex-direction: column;
	gap: 16px;
	background: #161b22;
	border: 1px solid #30363d;
	border-radius: 8px;
	padding: 16px;
	overflow-y: auto;
}

.elements-list {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.element-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 12px;
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 6px;
	cursor: pointer;
	font-size: 0.85rem;
	color: #c9d1d9;
}

.element-item:hover {
	background: #21262d;
}

.element-item.--active {
	border-color: #58a6ff;
	background: rgba(88, 166, 255, 0.1);
	color: #fff;
}

.element-color-bullet {
	width: 10px;
	height: 10px;
	border-radius: 50%;
}

.btn-icon {
	background: none;
	border: none;
	cursor: pointer;
	padding: 2px;
	font-size: 1rem;
	opacity: 0.7;
}

.btn-icon:hover {
	opacity: 1;
}

.properties-panel {
	border-top: 1px solid #30363d;
	padding-top: 16px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.properties-panel h3 {
	margin: 0;
	font-size: 0.95rem;
	color: #fff;
}

.prop-group {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.prop-group label {
	font-size: 0.75rem;
	color: #8b949e;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.prop-row {
	display: flex;
	font-size: 0.85rem;
	color: #c9d1d9;
}

.coord-item {
	display: flex;
	justify-content: space-between;
}

.--danger-btn {
	color: #f85149 !important;
	border-color: rgba(248, 81, 73, 0.4) !important;
}

.--danger-btn:hover {
	background: rgba(248, 81, 73, 0.15) !important;
}

.toolbar-divider {
	color: #30363d;
	margin: 0 4px;
}
</style>
