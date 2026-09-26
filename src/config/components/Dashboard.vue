<template>
	<div class="dashboard">
		<div class="control-grid">
			<div class="card --span-2 reliability-card">
				<div class="card-header">
					<h2>{{ $t("Broadcast Reliability") }}</h2>
					<button class="btn-ghost" @click="loadReliabilitySummary">{{ $t("Refresh") }}</button>
				</div>
				<div v-if="reliabilitySummary" class="reliability-grid">
					<div v-for="item in reliabilityItems" :key="item.key" :class="['reliability-item', `--${item.status}`]">
						<span class="reliability-label">{{ $text(item.label) }}</span>
						<strong>{{ item.value }}</strong>
						<small>{{ item.detail }}</small>
					</div>
				</div>
				<div v-if="reliabilitySummary?.warnings?.length" class="reliability-warnings">
					<span>{{ $t("Warnings:") }} {{ reliabilitySummary.warningCount }}</span>
					<ul>
						<li v-for="warning in reliabilitySummary.warnings.slice(0, 4)" :key="warning">{{ $text(warning) }}</li>
					</ul>
				</div>
				<div v-else-if="reliabilitySummary" class="reliability-ok">{{ $t("No readiness warnings reported.") }}</div>
				<div v-else class="reliability-ok">{{ $t("Readiness summary not loaded yet.") }}</div>
			</div>

			<!-- Telestrator Board -->
			<div class="card --span-2">
				<div class="card-header">
					<h2>{{ $t("Analysis Board") }}</h2>
					<div class="draw-tools">
						<div class="color-palette">
							<button 
								v-for="c in colors" 
								:key="c"
								:class="['color-swatch', { '--active': drawColor === c }]"
								:style="{ background: c }"
								@click="drawColor = c"
							></button>
						</div>
						<select v-model="drawSize" class="size-select">
							<option :value="2">{{ $t("Thin") }}</option>
							<option :value="5">{{ $t("Medium") }}</option>
							<option :value="10">{{ $t("Thick") }}</option>
							<option :value="20">{{ $t("Marker") }}</option>
						</select>
						<button class="btn-ghost" @click="clearCanvas">{{ $t("Clear") }}</button>
					</div>
				</div>
				<div class="canvas-wrapper">
					<iframe src="/hud/?transparent" class="hud-preview-bg"></iframe>
					<canvas 
						ref="canvas"
						@mousedown="startDraw"
						@mousemove="draw"
						@mouseup="stopDraw"
						@mouseleave="stopDraw"
					></canvas>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="card">
				<div class="card-header">
					<h2>{{ $t("Live Control Scenes") }}</h2>
				</div>
				<div class="scene-grid">
					<button 
						v-for="s in scenes" 
						:key="s.id"
						:class="['btn-scene', { '--active': state.options['match.activeScene'] === s.id }]"
						@click="setScene(s.id)"
					>
						{{ $text(s.label) }}
					</button>
				</div>
			</div>

			<!-- Manual Overrides -->
			<div class="card">
				<div class="card-header">
					<h2>{{ $t("Manual Overrides") }}</h2>
				</div>
				<div class="override-group">
					<label>{{ $t("Force Win Celebration") }}</label>
					<div class="button-row">
						<button :class="['btn-win', '--ct', { '--active': state.options['preferences.celebration.forceWinner'] === 'team2' }]" @click="setWinner('team2')">{{ $t("CT Win") }}</button>
						<button :class="['btn-win', '--t', { '--active': state.options['preferences.celebration.forceWinner'] === 'team1' }]" @click="setWinner('team1')">{{ $t("T Win") }}</button>
						<button :class="['btn-win', '--clear', { '--active': state.options['preferences.celebration.forceWinner'] === 'none' }]" @click="setWinner('none')">{{ $t("Auto") }}</button>
						<button :class="['btn-win', '--hidden', { '--active': state.options['preferences.celebration.forceWinner'] === 'hidden' }]" @click="setWinner('hidden')">{{ $t("Hide") }}</button>
					</div>
				</div>
				<div class="override-group" style="margin-top: 24px;">
					<label>{{ $t("Promotion Panel") }}</label>
					<button 
						:class="['btn-promo', { '--active': state.options['promotion.visible'] }]"
						@click="togglePromotion"
					>
						{{ $text(state.options['promotion.visible'] ? 'Hide Panel' : 'Show Panel') }}
					</button>
				</div>
			</div>

			<!-- Visual Style & Flair -->
			<div class="card">
				<div class="card-header">
					<h2>{{ $t("Visual Style & Flair") }}</h2>
				</div>
				<div class="override-group">
					<label>{{ $t("HUD Theme") }}</label>
					<select v-model="state.theme" @change="actions.save({ theme: state.theme })" class="style-select">
						<option value="default">{{ $t("Default") }}</option>
					</select>
				</div>
				<div class="override-group" style="margin-top: 20px;">
					<label>{{ $t("HUD Style Preset") }}</label>
					<div class="style-pill-grid">
						<button 
							v-for="style in uiStyleChoices" 
							:key="style.value"
							:class="['btn-style', { '--active': state.options['css.ui-style'] === style.value }]"
							@click="setUiStyle(style.value)"
						>
							{{ $text(style.label) }}
						</button>
					</div>
				</div>
				<div class="override-group" style="margin-top: 20px;">
					<label>{{ $t("Background Effect") }}</label>
					<div class="style-pill-grid">
						<button 
							v-for="fx in vantaEffects" 
							:key="fx.value"
							:class="['btn-style', { '--active': (state.options['css.vanta-effect'] || 'net') === fx.value }]"
							@click="previewOption('css.vanta-effect', fx.value)"
						>{{ $text(fx.label) }}</button>
					</div>
				</div>
			</div>

			<!-- Match Session Control Panel (Phase 16A) -->
			<div class="card --span-2 match-sessions-card">
				<div class="card-header">
					<h2>{{ $t("Match Session Telemetry Manager") }}</h2>
					<div style="display: flex; gap: 8px; align-items: center;">
						<button class="btn-ghost" style="padding: 4px 10px; font-size: 0.75rem;" @click="loadActiveSession(); loadSessions()">{{ $t("🔄 Refresh") }}</button>
						<div :class="['session-status-badge', activeSessionData ? '--active' : '--inactive']">
							<span class="status-indicator-dot" :class="{ '--pulsing': activeSessionData }"></span>
							{{ $text(activeSessionData ? 'Logging Active' : 'Logging Inactive') }}
						</div>
					</div>
				</div>

				<div v-if="sessionSuccess" class="session-alert --success">{{ $text(sessionSuccess) }}</div>
				<div v-if="sessionError" class="session-alert --error">{{ $text(sessionError) }}</div>

				<div class="session-panel-layout">
					<!-- Active Session & Timeline Preview -->
					<div class="session-panel-main">
						<div v-if="activeSessionData" class="active-session-info">
							<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #21262d; padding-bottom: 12px; margin-bottom: 12px;">
								<span style="font-size: 1rem; font-weight: 700; color: #fff;">
									{{ activeSessionData.teams?.home?.name }} {{ $t("vs") }} {{ activeSessionData.teams?.away?.name }}
								</span>
								<button class="btn-win --hidden" style="flex: none; font-size: 0.8rem; padding: 6px 14px;" @click="endSession" :disabled="sessionLoading">{{ $t("End Session") }}</button>
							</div>
							<div class="session-meta-grid">
								<div class="session-meta-item">
									<span class="session-meta-label">{{ $t("Session ID") }}</span>
									<span class="session-meta-value" style="font-family: monospace;">{{ activeSessionData.id }}</span>
								</div>
								<div class="session-meta-item">
									<span class="session-meta-label">{{ $t("Match Format") }}</span>
									<span class="session-meta-value">{{ activeSessionData.match?.format }}</span>
								</div>
								<div class="session-meta-item">
									<span class="session-meta-label">{{ $t("Event Name") }}</span>
									<span class="session-meta-value">{{ activeSessionData.match?.eventName }}</span>
								</div>
								<div class="session-meta-item">
									<span class="session-meta-label">{{ $t("Created At") }}</span>
									<span class="session-meta-value" style="font-size: 0.8rem;">{{ formatTime(activeSessionData.createdAt) }}</span>
								</div>
							</div>
							
							<!-- Summary Statistics -->
							<div v-if="activeSessionData.summary" class="session-meta-grid" style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #21262d;">
								<div class="session-meta-item">
									<span class="session-meta-label">{{ $t("Rounds Observed") }}</span>
									<span class="session-meta-value" style="color: #58a6ff;">{{ activeSessionData.summary.roundsObserved }}</span>
								</div>
								<div class="session-meta-item">
									<span class="session-meta-label">{{ $t("Maps Played") }}</span>
									<span class="session-meta-value" style="color: #2ecc71;">{{ activeSessionData.summary.mapsObserved }}</span>
								</div>
								<div class="session-meta-item">
									<span class="session-meta-label">{{ $t("Events Logged") }}</span>
									<span class="session-meta-value" style="color: #e67e22;">{{ activeSessionData.summary.eventsRecorded }}</span>
								</div>
							</div>

							<!-- Live Match Statistics (Phase 16B) -->
							<div v-if="activeSessionData.stats" style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed #21262d;">
								<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
									<h4 style="margin: 0; font-size: 0.85rem; font-weight: 600; color: #adbac7; text-transform: uppercase; letter-spacing: 0.05em;">{{ $t("Live Statistics") }}</h4>
									
									<!-- Export buttons -->
									<div style="display: flex; gap: 8px;">
										<a :href="`/api/sessions/${activeSessionData.id}/export/csv`" class="btn-ghost" style="padding: 3px 8px; font-size: 0.7rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" download>
											{{ $t("📥 Export CSV") }}
										</a>
										<a :href="`/api/sessions/${activeSessionData.id}/export/json`" class="btn-ghost" style="padding: 3px 8px; font-size: 0.7rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" download>
											{{ $t("📥 Export JSON") }}
										</a>
									</div>
								</div>

								<!-- Team Summary grid -->
								<div class="team-stats-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; background: #161b22; padding: 12px; border-radius: 6px; border: 1px solid #21262d;">
									<div style="border-right: 1px solid #21262d; padding-right: 8px;">
										<div style="font-weight: 700; color: #58a6ff; font-size: 0.85rem; display: flex; justify-content: space-between;">
											<span>{{ activeSessionData.stats.teams?.home?.name || $t('Home') }}</span>
											<span style="font-size: 1.1rem; color: #fff;">{{ activeSessionData.stats.teams?.home?.roundsWon ?? 0 }}</span>
										</div>
										<div style="font-size: 0.75rem; color: #8b949e; margin-top: 4px; display: flex; flex-direction: column; gap: 2px;">
											<span>{{ $t("Kills:") }} {{ activeSessionData.stats.teams?.home?.kills ?? 0 }}</span>
											<span>{{ $t("Deaths:") }} {{ activeSessionData.stats.teams?.home?.deaths ?? 0 }}</span>
											<span>{{ $t("Plants/Defuses:") }} {{ activeSessionData.stats.teams?.home?.bombPlants ?? 0 }} / {{ activeSessionData.stats.teams?.home?.bombDefuses ?? 0 }}</span>
										</div>
									</div>
									<div style="padding-left: 8px;">
										<div style="font-weight: 700; color: #e67e22; font-size: 0.85rem; display: flex; justify-content: space-between;">
											<span>{{ activeSessionData.stats.teams?.away?.name || $t('Away') }}</span>
											<span style="font-size: 1.1rem; color: #fff;">{{ activeSessionData.stats.teams?.away?.roundsWon ?? 0 }}</span>
										</div>
										<div style="font-size: 0.75rem; color: #8b949e; margin-top: 4px; display: flex; flex-direction: column; gap: 2px;">
											<span>{{ $t("Kills:") }} {{ activeSessionData.stats.teams?.away?.kills ?? 0 }}</span>
											<span>{{ $t("Deaths:") }} {{ activeSessionData.stats.teams?.away?.deaths ?? 0 }}</span>
											<span>{{ $t("Plants/Defuses:") }} {{ activeSessionData.stats.teams?.away?.bombPlants ?? 0 }} / {{ activeSessionData.stats.teams?.away?.bombDefuses ?? 0 }}</span>
										</div>
									</div>
								</div>

								<!-- Top Fraggers -->
								<div v-if="topFraggers.length > 0">
									<div style="font-size: 0.8rem; font-weight: 600; color: #8b949e; text-transform: uppercase; margin-bottom: 8px;">{{ $t("🏆 Top Fraggers") }}</div>
									<div style="display: flex; flex-direction: column; gap: 6px;">
										<div v-for="(p, index) in topFraggers" :key="index" style="display: flex; justify-content: space-between; align-items: center; background: #161b22; border: 1px solid #21262d; border-radius: 6px; padding: 6px 12px; font-size: 0.8rem;">
											<div style="display: flex; align-items: center; gap: 8px;">
												<span style="font-weight: bold; color: #8b949e;">#{{ index + 1 }}</span>
												<span :style="{ color: p.team === 'away' ? '#e67e22' : '#58a6ff' }" style="font-weight: 600;">{{ p.name }}</span>
											</div>
											<div style="display: flex; gap: 12px; color: #adbac7;">
												<span>K: <strong style="color: #fff;">{{ p.kills }}</strong></span>
												<span>D: <strong style="color: #fff;">{{ p.deaths }}</strong></span>
												<span>A: <strong>{{ p.assists ?? 0 }}</strong></span>
												<span>KD: <strong :style="{ color: p.kdRatio >= 1.0 ? '#2ecc71' : '#e74c3c' }">{{ $number(p.kdRatio, { maximumFractionDigits: 2 }) }}</strong></span>
												<span>MVP: <strong style="color: #f1c40f;">{{ p.mvps ?? 0 }}</strong></span>
											</div>
										</div>
									</div>
								</div>
								
								<!-- Match Duration & Bomb Counters -->
								<div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #8b949e; margin-top: 12px; padding: 6px; background: rgba(88, 166, 255, 0.05); border-radius: 4px; border: 1px solid rgba(88, 166, 255, 0.1);">
									<span>{{ $t("Match Duration:") }} <strong>{{ $text(activeSessionDuration) }}</strong></span>
									<span>{{ $t("Bomb Plants:") }} <strong>{{ activeSessionData.stats.matchTotals?.bombPlants ?? 0 }}</strong></span>
									<span>{{ $t("Defuses:") }} <strong>{{ activeSessionData.stats.matchTotals?.bombDefuses ?? 0 }}</strong></span>
								</div>
							</div>
						</div>

						<div v-else style="background: #0d1117; border: 1px dashed #30363d; border-radius: 8px; padding: 32px; text-align: center; color: #8b949e; margin-bottom: 20px;">
							<div style="font-size: 2.2rem; margin-bottom: 12px;">📊</div>
							<p style="margin: 0; font-size: 0.95rem;">{{ $t("No active match telemetry session is running.") }}</p>
							<p style="margin: 6px 0 0 0; font-size: 0.8rem; color: #6e7681;">{{ $t("Create a new session or activate an existing one from the list to start timeline logging.") }}</p>
						</div>

						<!-- Timeline Preview -->
						<div class="timeline-preview">
							<h3 style="font-size: 0.9rem; font-weight: 600; color: #adbac7; margin: 0 0 12px 0; text-transform: uppercase;">{{ $t("Timeline Event Feed (Last 10 Events)") }}</h3>
							<div v-if="activeTimeline.length > 0" class="timeline-events-list">
								<div v-for="evt in activeTimeline" :key="evt.id" class="timeline-event-row">
									<div style="display: flex; align-items: center; gap: 8px;">
										<span class="event-type-badge">{{ $text(evt.type) }}</span>
										<span v-if="evt.actor" style="font-weight: 600; color: #adbac7;">
											{{ evt.actor.name }} [{{ evt.actor.team }}]
										</span>
										<span v-if="evt.type === 'player/death' && evt.target" style="font-weight: 600; color: #adbac7;">
											{{ evt.target.name }} [{{ evt.target.team }}]
										</span>
										<span v-if="evt.type === 'round/over'" style="font-weight: 600; color: #2ecc71;">
											{{ $t("Winner:") }} {{ evt.data?.winner }} {{ $t("(Score: CT") }} {{ evt.data?.score?.ct }} - T {{ evt.data?.score?.t }})
										</span>
										<span v-if="evt.type === 'team/score_changed'" style="font-weight: 600; color: #58a6ff;">
											{{ $t("Score: CT") }} {{ evt.data?.ctScore }} - T {{ evt.data?.tScore }}
										</span>
									</div>
									<div class="event-meta">
										<span v-if="evt.round" style="background: #21262d; padding: 2px 6px; border-radius: 4px;">R{{ evt.round }}</span>
										<span>{{ $date(evt.at, { timeStyle: 'medium' }) }}</span>
									</div>
								</div>
							</div>
							<div v-else style="background: #0d1117; border: 1px solid #21262d; border-radius: 6px; padding: 16px; text-align: center; color: #6e7681; font-size: 0.85rem;">
								{{ $t("No events recorded in this session yet.") }}
							</div>
						</div>
					</div>

					<!-- Create & List Panels -->
					<div class="session-panel-side" style="display: flex; flex-direction: column; gap: 20px;">
						<!-- Create Session Form -->
						<div style="background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 16px;">
							<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
								<h3 style="font-size: 0.9rem; font-weight: 600; color: #adbac7; margin: 0; text-transform: uppercase;">{{ $t("Create Match Session") }}</h3>
								<button class="btn-ghost" style="padding: 3px 8px; font-size: 0.72rem;" @click="autofillFromMatch" :disabled="sessionLoading || !komplettligaen.matchId" :title="$t('Fill from configured KL match')">{{ $t("Fill from KL Match") }}</button>
							</div>
							<div class="session-form">
								<div class="form-row">
									<div>
										<label style="display: block; font-size: 0.75rem; color: #8b949e; margin-bottom: 4px;">{{ $t("Home Team") }}</label>
										<input v-model="sessionForm.homeTeam" class="text-input" style="padding: 8px;" placeholder="Astralis">
									</div>
									<div>
										<label style="display: block; font-size: 0.75rem; color: #8b949e; margin-bottom: 4px;">{{ $t("Away Team") }}</label>
										<input v-model="sessionForm.awayTeam" class="text-input" style="padding: 8px;" placeholder="NaVi">
									</div>
								</div>
								<div class="form-row">
									<div>
										<label style="display: block; font-size: 0.75rem; color: #8b949e; margin-bottom: 4px;">{{ $t("Event Name") }}</label>
										<input v-model="sessionForm.eventName" class="text-input" style="padding: 8px;" placeholder="Major 2026">
									</div>
									<div>
										<label style="display: block; font-size: 0.75rem; color: #8b949e; margin-bottom: 4px;">{{ $t("Format") }}</label>
										<select v-model="sessionForm.format" class="style-select" style="padding: 8px; height: 35px;">
											<option value="BO1">BO1</option>
											<option value="BO3">BO3</option>
											<option value="BO5">BO5</option>
										</select>
									</div>
								</div>
								<div>
									<label style="display: block; font-size: 0.75rem; color: #8b949e; margin-bottom: 4px;">{{ $t("External Match ID") }}</label>
									<input v-model="sessionForm.externalMatchId" class="text-input" style="padding: 8px;" :placeholder="$t('Optional')">
								</div>
								<button class="btn-promo" style="padding: 10px; margin-top: 4px;" @click="createNewSession" :disabled="sessionLoading">{{ $t("Start Session") }}</button>
							</div>
						</div>

						<!-- Recent Sessions List -->
						<div style="background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 16px;">
							<h3 style="font-size: 0.9rem; font-weight: 600; color: #adbac7; margin: 0 0 10px 0; text-transform: uppercase;">{{ $t("Recent Sessions") }}</h3>
							<div v-if="sessionsList.length > 0" class="sessions-list-wrapper">
								<table class="session-list-table">
									<thead>
										<tr>
											<th>{{ $t("Teams / Date") }}</th>
											<th>{{ $t("Status") }}</th>
											<th>{{ $t("Actions") }}</th>
										</tr>
									</thead>
									<tbody>
										<tr v-for="s in sessionsList" :key="s.metadata?.id">
											<td>
												<div style="font-weight: 600; color: #adbac7;">
													{{ s.metadata?.teams?.home?.name }} {{ $t("vs") }} {{ s.metadata?.teams?.away?.name }}
												</div>
												<div style="color: #6e7681; font-size: 0.7rem; margin-top: 2px;">
													{{ formatTime(s.metadata?.createdAt) }}
												</div>
											</td>
											<td>
												<span :class="['session-status-badge', s.metadata?.status === 'active' ? '--active' : '--inactive']" style="padding: 2px 6px; font-size: 0.65rem;">
													{{ $text(s.metadata?.status) }}
												</span>
											</td>
											<td class="session-list-actions">
												<button 
													v-if="s.metadata?.status !== 'active'"
													class="btn-win --clear" 
													style="padding: 4px 8px; font-size: 0.7rem; flex: none;"
													@click="activateSession(s.metadata?.id)"
													:disabled="sessionLoading"
												>
													{{ $t("Activate") }}
												</button>
												<button 
													class="btn-ghost" 
													style="padding: 3px 6px; font-size: 0.7rem;"
													@click="inspectSession(s.metadata?.id)"
												>
													{{ $t("Inspect") }}
												</button>
											</td>
										</tr>
									</tbody>
								</table>
							</div>
							<div v-else style="color: #6e7681; text-align: center; padding: 16px; font-size: 0.8rem;">
								{{ $t("No recent sessions found.") }}
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Inspect Session Summary Popup Modal -->
			<div v-if="inspectedSession" class="inspect-modal-overlay" @click.self="inspectedSession = null">
				<div class="inspect-modal">
					<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #30363d; padding-bottom: 12px; margin-bottom: 16px;">
						<h3 style="font-size: 1.1rem; font-weight: 700; color: #fff; margin: 0;">{{ $t("Session Diagnostics") }}</h3>
						<button class="btn-ghost" style="padding: 2px 8px;" @click="inspectedSession = null">{{ $t("Close") }}</button>
					</div>
					
					<div style="display: flex; flex-direction: column; gap: 12px;">
						<div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
							<span style="color: #8b949e;">{{ $t("Slug:") }}</span>
							<strong style="color: #adbac7; font-family: monospace; font-size: 0.75rem;">{{ inspectedSession.metadata?.slug }}</strong>
						</div>
						<div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
							<span style="color: #8b949e;">{{ $t("Match Format:") }}</span>
							<strong style="color: #adbac7;">{{ inspectedSession.metadata?.match?.format }}</strong>
						</div>
						<div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
							<span style="color: #8b949e;">{{ $t("Event Name:") }}</span>
							<strong style="color: #adbac7;">{{ inspectedSession.metadata?.match?.eventName }}</strong>
						</div>
						<div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
							<span style="color: #8b949e;">{{ $t("Status:") }}</span>
							<strong :style="{ color: inspectedSession.metadata?.status === 'active' ? '#2ecc71' : '#8b949e' }">
								{{ $text(inspectedSession.metadata?.status) }}
							</strong>
						</div>
						
						<div style="background: #0d1117; border: 1px dashed #30363d; border-radius: 8px; padding: 12px; margin-top: 8px; display: flex; flex-direction: column; gap: 8px;">
							<h4 style="margin: 0; font-size: 0.8rem; font-weight: 600; color: #8b949e; text-transform: uppercase;">{{ $t("Recorded Summary") }}</h4>
							<div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
								<span>{{ $t("Rounds Observed:") }}</span>
								<strong>{{ inspectedSession.summary?.roundsObserved }}</strong>
							</div>
							<div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
								<span>{{ $t("Maps Observed:") }}</span>
								<strong>{{ inspectedSession.summary?.mapsObserved }}</strong>
							</div>
							<div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
								<span>{{ $t("Events Recorded:") }}</span>
								<strong style="color: #e67e22;">{{ inspectedSession.summary?.eventsRecorded }}</strong>
							</div>
							<div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
								<span>{{ $t("First GSI Signal:") }}</span>
								<strong>{{ formatTime(inspectedSession.summary?.firstGsiAt) }}</strong>
							</div>
							<div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
								<span>{{ $t("Last GSI Signal:") }}</span>
								<strong>{{ formatTime(inspectedSession.summary?.lastGsiAt) }}</strong>
							</div>
						</div>

						<!-- Export buttons in modal -->
						<div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; border-top: 1px solid #30363d; padding-top: 12px;">
							<a :href="`/api/sessions/${inspectedSession.metadata?.id}/export/csv`" class="btn-ghost" style="padding: 4px 10px; font-size: 0.75rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" download>
								{{ $t("📥 Export CSV") }}
							</a>
							<a :href="`/api/sessions/${inspectedSession.metadata?.id}/export/json`" class="btn-ghost" style="padding: 4px 10px; font-size: 0.75rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" download>
								{{ $t("📥 Export JSON") }}
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import { text as translateText, state as languageState } from '/config/i18n.js'

import { state, actions } from '/config/store.js'

export default {
	setup() {
		return { state, actions }
	},
	computed: {
		topFraggers() {
			if (!this.activeSessionData?.stats?.players) return []
			return Object.values(this.activeSessionData.stats.players)
				.sort((a, b) => b.kills - a.kills)
				.slice(0, 5)
		},
		activeSessionDuration() {
			const sec = this.activeSessionData?.stats?.matchTotals?.durationSeconds || 0
			return `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`
		},
		reliabilityItems() {
			const summary = this.reliabilitySummary
			if (!summary) return []
			return [
				{
					key: 'gsi',
					label: 'GSI',
					value: this.$t(summary.gsi.connected ? 'Connected' : 'Waiting'),
					detail: summary.gsi.uiDevMode ? this.$t('UI dev mode') : (summary.gsi.mapName || this.$t('No map')),
					status: summary.gsi.connected ? 'pass' : 'warn',
				},
				{
					key: 'kl',
					label: 'GG Arena',
					value: this.$t(summary.komplettligaen.loaded ? 'Loaded' : 'Missing'),
					detail: summary.komplettligaen.matchId || this.$t('No match ID'),
					status: summary.komplettligaen.loaded ? 'pass' : 'warn',
				},
				{
					key: 'identity',
					label: 'Team Identity',
					value: summary.teamIdentity.healthy ? this.$t('Healthy') : this.$t('{count} warnings', { count: this.$number(summary.teamIdentity.warningCount) }),
					detail: `${summary.teamIdentity.ct.name} vs ${summary.teamIdentity.t.name}`,
					status: summary.teamIdentity.healthy ? 'pass' : 'warn',
				},
				{
					key: 'package',
					label: 'Package',
					value: this.$t(summary.package.active ? 'Active' : 'None'),
					detail: summary.package.name || this.$t('No package applied'),
					status: summary.package.active && summary.package.warningCount === 0 ? 'pass' : 'warn',
				},
				{
					key: 'clients',
					label: 'HUD Clients',
					value: this.$number(summary.hudClients.connected),
					detail: this.$t('WebSocket clients'),
					status: summary.hudClients.connected > 0 ? 'pass' : 'warn',
				},
				{
					key: 'cache',
					label: 'Cache',
					value: this.$t(summary.cache.exists ? (summary.cache.stale ? 'Stale' : 'Ready') : 'Missing'),
					detail: summary.cache.source || this.$t('No cache source'),
					status: summary.cache.exists && !summary.cache.stale ? 'pass' : 'warn',
				},
			]
		}
	},
	data() {
		return {
			drawColor: '#ff5a00',
			drawSize: 5,
			isDrawing: false,
			lastX: 0,
			lastY: 0,
			colors: ['#ff5a00', '#3498db', '#2ecc71', '#f1c40f', '#ffffff', '#e74c3c', '#9b59b6', '#000000'],
			komplettligaen: { matchId: '', activeView: 'match' },
			komplettligaenLoading: false,
			komplettligaenStatus: '',
			komplettligaenError: false,
			cacheStatus: null, // Holds cache diagnostics (Phase 13)
			reliabilitySummary: null,
			komplettligaenMatchData: null, // Last fetched KL match (for session autofill)
			sessionsList: [],
			activeSessionData: null,
			activeTimeline: [],
			sessionForm: {
				homeTeam: '',
				awayTeam: '',
				eventName: '',
				format: 'BO3',
				externalMatchId: ''
			},
			sessionLoading: false,
			sessionError: '',
			sessionSuccess: '',
			inspectedSession: null,
			sessionPollInterval: null,
			scenes: [
				{ id: 'default', label: 'Live HUD' },
				{ id: 'radar', label: 'Full Radar' },
				{ id: 'intro', label: 'KL Match Overview' },
				{ id: 'halftime', label: 'KL Waiting' },
				{ id: 'fulltime', label: 'KL Result' },
				{ id: 'analytics', label: 'KL Table/Form' },
			],
			uiStyleChoices: [
				{ value: 'slanted', label: 'Default' },
				{ value: 'classic', label: 'Classic' },
				{ value: 'compact', label: 'Compact' },
				{ value: 'diagonal', label: 'Diagonal' },
				{ value: 'rounded', label: 'Rounded' },
			],
			vantaEffects: [
				{ value: 'net', label: 'Net' },
				{ value: 'cells', label: 'Cells' },
				{ value: 'waves', label: 'Waves' },
				{ value: 'birds', label: 'Birds' },
				{ value: 'clouds', label: 'Clouds' },
				{ value: 'topology', label: 'Topology' },
				{ value: 'dots', label: 'Dots' },
				{ value: 'halo', label: 'Halo' },
			],
		}
	},
	methods: {
		setScene(id) {
			state.options['match.activeScene'] = id
			actions.broadcast('match.activeScene', id)
			actions.save({ 'match.activeScene': id })
		},
		async loadKomplettligaen() {
			try {
				const res = await fetch('/config/komplettligaen')
				this.komplettligaen = await res.json()
			} catch (err) {
				this.komplettligaenStatus = 'Could not load Komplettligaen config'
				this.komplettligaenError = true
			}
		},
		async saveKomplettligaen() {
			this.komplettligaenLoading = true
			this.komplettligaenError = false
			this.komplettligaenStatus = 'Saving...'
			try {
				const res = await fetch('/config/komplettligaen', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(this.komplettligaen),
				})
				this.komplettligaen = await res.json()
				this.komplettligaenStatus = 'Saved. HUD scenes will refresh.'
				await this.loadCacheStatus()
			} catch (err) {
				this.komplettligaenStatus = 'Save failed'
				this.komplettligaenError = true
			} finally {
				this.komplettligaenLoading = false
			}
		},
		async refreshKomplettligaen() {
			this.komplettligaenLoading = true
			this.komplettligaenError = false
			this.komplettligaenStatus = 'Refreshing cache...'
			try {
				await fetch('/config/komplettligaen/refresh', { method: 'POST' })
				this.komplettligaenStatus = 'Cache cleared. Re-fetching data...'
				await this.testKomplettligaen()
			} catch (err) {
				this.komplettligaenStatus = 'Refresh failed'
				this.komplettligaenError = true
			} finally {
				this.komplettligaenLoading = false
			}
		},
		async testKomplettligaen() {
			this.komplettligaenLoading = true
			this.komplettligaenError = false
			this.komplettligaenStatus = 'Fetching...'
			try {
				const res = await fetch(`/api/komplettligaen/preview?matchId=${encodeURIComponent(this.komplettligaen.matchId)}`)
				const data = await res.json()
				if (!res.ok || data.error) throw new Error(data.error || 'Fetch failed')
				this.komplettligaenStatus = `${data.match.home.name} vs ${data.match.away.name}`
				this.komplettligaenMatchData = data.match
				await this.loadCacheStatus()
			} catch (err) {
				this.komplettligaenStatus = err.message || 'Fetch failed'
				this.komplettligaenError = true
				await this.loadCacheStatus()
			} finally {
				this.komplettligaenLoading = false
			}
		},
		async loadCacheStatus() {
			try {
				const res = await fetch('/api/komplettligaen/cache-status')
				if (res.ok) {
					this.cacheStatus = await res.json()
				}
			} catch (err) {
				console.warn('Failed to load cache status:', err)
			}
		},
		async loadReliabilitySummary() {
			try {
				const res = await fetch('/api/diagnostics/broadcast-readiness')
				if (res.ok) {
					this.reliabilitySummary = await res.json()
				}
			} catch (err) {
				console.warn('Failed to load broadcast readiness summary:', err)
			}
		},
		async resetCache() {
			if (!confirm(translateText('Are you sure you want to completely clear NeuronCast\'s offline tournament cache?'))) return;
			
			this.komplettligaenLoading = true
			this.komplettligaenStatus = 'Resetting cache...'
			try {
				const res = await fetch('/config/komplettligaen/cache-reset', { method: 'POST' })
				if (res.ok) {
					this.komplettligaenStatus = 'Offline cache reset successfully.'
					await this.loadCacheStatus()
				} else {
					this.komplettligaenStatus = 'Failed to reset cache'
				}
			} catch (err) {
				this.komplettligaenStatus = 'Error resetting cache'
			} finally {
				this.komplettligaenLoading = false
			}
		},
		formatTime(dateStr) {
			if (!dateStr) return 'N/A';
			try {
				return new Date(dateStr).toLocaleString(languageState.locale);
			} catch (e) {
				return dateStr;
			}
		},
		setWinner(id) {
			state.options['preferences.celebration.forceWinner'] = id
			actions.broadcast('preferences.celebration.forceWinner', id)
			actions.save({ 'preferences.celebration.forceWinner': id })
		},
		togglePromotion() {
			const newVal = !state.options['promotion.visible']
			state.options['promotion.visible'] = newVal
			actions.broadcast('promotion.visible', newVal)
			actions.save({ 'promotion.visible': newVal })
		},
		getPos(e) {
			const rect = this.$refs.canvas.getBoundingClientRect()
			return {
				x: (e.clientX - rect.left) / rect.width,
				y: (e.clientY - rect.top) / rect.height
			}
		},
		startDraw(e) {
			this.isDrawing = true
			const pos = this.getPos(e)
			this.lastX = pos.x
			this.lastY = pos.y
		},
		draw(e) {
			if (!this.isDrawing) return
			const pos = this.getPos(e)
			const ctx = this.$refs.canvas.getContext('2d')
			const rect = this.$refs.canvas.getBoundingClientRect()
			
			// Local Draw
			ctx.beginPath()
			ctx.moveTo(this.lastX * rect.width, this.lastY * rect.height)
			ctx.lineTo(pos.x * rect.width, pos.y * rect.height)
			ctx.strokeStyle = this.drawColor
			ctx.lineWidth = this.drawSize
			ctx.lineCap = 'round'
			ctx.stroke()

			// Sync
			actions.broadcast('draw:line', {
				x1: this.lastX, y1: this.lastY,
				x2: pos.x, y2: pos.y,
				color: this.drawColor, size: this.drawSize
			})

			this.lastX = pos.x
			this.lastY = pos.y
		},
		stopDraw() { this.isDrawing = false },
		clearCanvas() {
			const ctx = this.$refs.canvas.getContext('2d')
			ctx.clearRect(0, 0, this.$refs.canvas.width, this.$refs.canvas.height)
			actions.broadcast('draw:clear')
		},
		setUiStyle(s) {
			state.options['css.ui-style'] = s
			actions.broadcast('css.ui-style', s)
			actions.save({ 'css.ui-style': s })
		},
		setOption(key, value) {
			state.options[key] = value
			actions.broadcast(key, value)
			actions.save({ [key]: value })
		},
		previewOption(key, value) {
			state.options[key] = value
			actions.broadcast(key, value)
		},
		async autofillFromMatch() {
			let match = this.komplettligaenMatchData
			if (!match) {
				if (!this.komplettligaen.matchId) {
					this.sessionError = 'No KL match configured. Enter a GG Arena Match ID above first.'
					return
				}
				this.sessionLoading = true
				this.sessionError = ''
				try {
					const res = await fetch(`/api/komplettligaen/preview?matchId=${encodeURIComponent(this.komplettligaen.matchId)}`)
					const data = await res.json()
					if (!res.ok || data.error) throw new Error(data.error || 'Fetch failed')
					match = data.match
					this.komplettligaenMatchData = match
				} catch (err) {
					this.sessionError = `Could not fetch KL match: ${err.message}`
					return
				} finally {
					this.sessionLoading = false
				}
			}
			this.sessionForm.homeTeam = match.home?.name || ''
			this.sessionForm.awayTeam = match.away?.name || ''
			this.sessionForm.eventName = match.division || 'Komplettligaen'
			if (match.bestOf) this.sessionForm.format = `BO${match.bestOf}`
			this.sessionForm.externalMatchId = String(match.id || '')
		},
		async loadSessions() {
			try {
				const res = await fetch('/api/sessions')
				if (res.ok) {
					this.sessionsList = await res.json()
				}
			} catch (err) {
				console.warn('Failed to load sessions:', err)
			}
		},
		async loadActiveSession() {
			try {
				const res = await fetch('/api/sessions/active')
				if (res.ok) {
					const data = await res.json()
					if (data && data.active) {
						// Fetch active session summary data dynamically
						const summaryRes = await fetch(`/api/sessions/${data.session.id}`)
						if (summaryRes.ok) {
							const details = await summaryRes.json()
							this.activeSessionData = {
								...data.session,
								summary: details.summary,
								stats: details.stats
							}
						} else {
							this.activeSessionData = data.session
						}
						await this.loadTimeline(data.session.id)
					} else {
						this.activeSessionData = null
						this.activeTimeline = []
					}
				}
			} catch (err) {
				console.warn('Failed to load active session:', err)
			}
		},
		async loadTimeline(sessionId) {
			try {
				const res = await fetch(`/api/sessions/${sessionId}/timeline`)
				if (res.ok) {
					const events = await res.json()
					this.activeTimeline = events.slice(-10).reverse()
				}
			} catch (err) {
				console.warn('Failed to load timeline:', err)
			}
		},
		async createNewSession() {
			if (!this.sessionForm.homeTeam || !this.sessionForm.awayTeam) {
				this.sessionError = 'Home and Away team names are required.'
				return
			}
			this.sessionLoading = true
			this.sessionError = ''
			this.sessionSuccess = ''
			try {
				const payload = {
					teams: {
						home: { name: this.sessionForm.homeTeam, id: 'home', logo: '' },
						away: { name: this.sessionForm.awayTeam, id: 'away', logo: '' }
					},
					match: {
						format: this.sessionForm.format,
						eventName: this.sessionForm.eventName || 'NeuronCast Match',
						externalMatchId: this.sessionForm.externalMatchId || null
					}
				}
				const res = await fetch('/api/sessions', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				})
				const data = await res.json()
				if (!res.ok || data.error) {
					throw new Error(data.error || 'Failed to create session.')
				}
				this.sessionSuccess = `Session "${data.slug}" started successfully.`
				this.sessionForm.homeTeam = ''
				this.sessionForm.awayTeam = ''
				this.sessionForm.eventName = ''
				this.sessionForm.externalMatchId = ''
				await this.loadActiveSession()
				await this.loadSessions()
			} catch (err) {
				this.sessionError = err.message || 'Error starting session.'
			} finally {
				this.sessionLoading = false
			}
		},
		async endSession() {
			if (!confirm(translateText('Are you sure you want to end the active match session?'))) return
			this.sessionLoading = true
			this.sessionError = ''
			this.sessionSuccess = ''
			try {
				const res = await fetch('/api/sessions/end', { method: 'POST' })
				const data = await res.json()
				if (!res.ok || data.error) {
					throw new Error(data.error || 'Failed to end session.')
				}
				this.sessionSuccess = 'Active session ended successfully.'
				await this.loadActiveSession()
				await this.loadSessions()
			} catch (err) {
				this.sessionError = err.message || 'Error ending active session.'
			} finally {
				this.sessionLoading = false
			}
		},
		async activateSession(sessionId) {
			this.sessionLoading = true
			this.sessionError = ''
			this.sessionSuccess = ''
			try {
				const res = await fetch(`/api/sessions/active/${sessionId}`, { method: 'POST' })
				const data = await res.json()
				if (!res.ok || data.error) {
					throw new Error(data.error || 'Failed to activate session.')
				}
				this.sessionSuccess = `Session activated successfully.`
				await this.loadActiveSession()
				await this.loadSessions()
			} catch (err) {
				this.sessionError = err.message || 'Error activating session.'
			} finally {
				this.sessionLoading = false
			}
		},
		async inspectSession(sessionId) {
			try {
				const res = await fetch(`/api/sessions/${sessionId}`)
				if (res.ok) {
					this.inspectedSession = await res.json()
				}
			} catch (err) {
				console.warn('Failed to inspect session:', err)
			}
		},
	},
	mounted() {
		const canvas = this.$refs.canvas
		const rect = canvas.getBoundingClientRect()
		canvas.width = rect.width
		canvas.height = rect.height
		this.loadKomplettligaen()
		this.loadCacheStatus() // Fetch initial cache diagnostics
		this.loadReliabilitySummary()
		this.loadSessions()
		this.loadActiveSession()
		this.sessionPollInterval = setInterval(() => {
			this.loadActiveSession()
			this.loadSessions()
		}, 5000)
	},
	beforeUnmount() {
		if (this.sessionPollInterval) {
			clearInterval(this.sessionPollInterval)
		}
	}
}
</script>

<style scoped>
.control-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 24px;
}

.card {
	background: #1a1d23;
	border: 1px solid #2d333b;
	border-radius: 12px;
	padding: 24px;
}

.card.--span-2 { grid-column: span 2; }

.card-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 20px;
}

.card-header h2 { font-size: 1.1rem; font-weight: 600; color: #fff; margin: 0; }

.reliability-card {
	border-color: #30363d;
}

.reliability-grid {
	display: grid;
	grid-template-columns: repeat(6, minmax(0, 1fr));
	gap: 10px;
}

.reliability-item {
	min-width: 0;
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 8px;
	padding: 12px;
	display: flex;
	flex-direction: column;
	gap: 5px;
}

.reliability-item.--pass {
	border-color: rgba(46, 204, 113, 0.42);
}

.reliability-item.--warn {
	border-color: rgba(241, 196, 15, 0.42);
}

.reliability-label,
.reliability-item small {
	color: #8b949e;
	font-size: 0.76rem;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.reliability-item strong {
	color: #f0f3f6;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.reliability-warnings {
	margin-top: 14px;
	color: #f1c40f;
	font-size: 0.86rem;
}

.reliability-warnings ul {
	margin: 8px 0 0;
	padding-left: 18px;
}

.reliability-ok {
	margin-top: 12px;
	color: #2ecc71;
	font-size: 0.86rem;
}

@media (max-width: 1180px) {
	.reliability-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
}

@media (max-width: 760px) {
	.reliability-grid {
		grid-template-columns: 1fr;
	}
}

.draw-tools { display: flex; align-items: center; gap: 16px; }

.color-palette { display: flex; gap: 4px; }
.color-swatch { 
	width: 20px; height: 20px; border-radius: 4px; border: 2px solid transparent; cursor: pointer;
}
.color-swatch.--active { border-color: #fff; }

.canvas-wrapper {
	position: relative;
	aspect-ratio: 16 / 9;
	background: #000;
	border-radius: 8px;
	overflow: hidden;
}

.hud-preview-bg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	border: none;
	pointer-events: none;
}

canvas {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	cursor: crosshair;
}

.scene-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

.btn-scene {
	padding: 12px;
	background: #2d333b;
	border: 1px solid transparent;
	border-radius: 6px;
	color: #adbac7;
	cursor: pointer;
	transition: all 0.2s;
}

.btn-scene:hover { background: #3e444d; color: #fff; }
.btn-scene.--active { background: #3498db; color: #fff; font-weight: 600; }

.override-group label { display: block; font-size: 0.8rem; color: #8b949e; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }

.button-row { display: flex; gap: 8px; }
.btn-win { flex: 1; padding: 10px; border: 1px solid #30363d; border-radius: 6px; font-weight: 600; cursor: pointer; background: #2d333b; color: #adbac7; transition: all 0.2s; }

.btn-win.--ct.--active { background: #3498db; color: #fff; border-color: transparent; }
.btn-win.--t.--active { background: #e67e22; color: #fff; border-color: transparent; }
.btn-win.--clear.--active { background: #444c56; color: #fff; border-color: #539bf5; }
.btn-win.--hidden.--active { background: #e74c3c; color: #fff; border-color: transparent; }

.btn-win:hover:not(.--active) { background: #3e444d; color: #fff; }

.btn-promo { width: 100%; padding: 12px; background: #2d333b; border: 1px solid #3498db; color: #3498db; border-radius: 6px; font-weight: 600; cursor: pointer; }
.btn-promo.--active { background: #3498db; color: #fff; }

.btn-ghost { background: none; border: 1px solid #2d333b; color: #8b949e; padding: 4px 12px; border-radius: 4px; cursor: pointer; }
.btn-ghost:hover { color: #fff; border-color: #444; }

.style-select {
	width: 100%;
	padding: 10px;
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 6px;
	color: #c9d1d9;
}

.text-input {
	width: 100%;
	box-sizing: border-box;
	padding: 10px;
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 6px;
	color: #c9d1d9;
}


.kl-status {
	min-height: 20px;
	margin-top: 10px;
	color: #8b949e;
	font-size: 0.9rem;
}

.kl-status.--error { color: #e74c3c; }

.style-pill-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px;
}

.btn-style {
	padding: 8px;
	background: #2d333b;
	border: 1px solid transparent;
	border-radius: 4px;
	color: #adbac7;
	cursor: pointer;
	text-transform: capitalize;
}

.btn-style.--active {
	background: #3498db;
	color: #fff;
	font-weight: 600;
}

/* Session Card Styles */
.match-sessions-card {
	margin-top: 24px;
}
.session-panel-layout {
	display: grid;
	grid-template-columns: 1.2fr 0.8fr;
	gap: 24px;
}
@media (max-width: 1024px) {
	.session-panel-layout {
		grid-template-columns: 1fr;
	}
}
.session-form {
	display: flex;
	flex-direction: column;
	gap: 12px;
}
.form-row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px;
}
.session-status-badge {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 4px 10px;
	border-radius: 99px;
	font-size: 0.75rem;
	font-weight: 600;
	text-transform: uppercase;
}
.session-status-badge.--active {
	background: rgba(46, 204, 113, 0.15);
	color: #2ecc71;
	border: 1px solid rgba(46, 204, 113, 0.3);
}
.session-status-badge.--inactive {
	background: rgba(139, 148, 158, 0.15);
	color: #8b949e;
	border: 1px solid rgba(139, 148, 158, 0.3);
}
.status-indicator-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: currentColor;
}
.status-indicator-dot.--pulsing {
	animation: dot-pulse 1.5s infinite alternate;
}
@keyframes dot-pulse {
	0% { opacity: 0.4; }
	100% { opacity: 1; }
}
.active-session-info {
	background: #0d1117;
	border: 1px solid #30363d;
	border-radius: 8px;
	padding: 16px;
	margin-bottom: 20px;
}
.session-meta-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
	gap: 16px;
	margin-top: 16px;
}
.session-meta-item {
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.session-meta-label {
	font-size: 0.75rem;
	color: #8b949e;
	text-transform: uppercase;
}
.session-meta-value {
	font-size: 0.95rem;
	font-weight: 600;
	color: #c9d1d9;
}
.timeline-preview {
	margin-top: 20px;
}
.timeline-events-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	max-height: 260px;
	overflow-y: auto;
	padding-right: 4px;
}
.timeline-event-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	background: #161b22;
	border: 1px solid #30363d;
	border-radius: 6px;
	padding: 8px 12px;
	font-size: 0.8rem;
}
.event-type-badge {
	font-family: monospace;
	padding: 2px 6px;
	border-radius: 4px;
	background: rgba(52, 152, 219, 0.15);
	color: #58a6ff;
	font-weight: 600;
}
.event-meta {
	display: flex;
	align-items: center;
	gap: 12px;
	color: #8b949e;
}
.sessions-list-wrapper {
	max-height: 220px;
	overflow-y: auto;
	margin-top: 12px;
}
.session-list-table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.8rem;
	text-align: left;
}
.session-list-table th, .session-list-table td {
	padding: 10px;
	border-bottom: 1px solid #21262d;
}
.session-list-table th {
	color: #8b949e;
	text-transform: uppercase;
	font-weight: 600;
}
.session-list-actions {
	display: flex;
	gap: 6px;
}
.session-alert {
	padding: 10px;
	border-radius: 6px;
	font-size: 0.85rem;
	margin-bottom: 16px;
}
.session-alert.--success {
	background: rgba(46, 204, 113, 0.1);
	border: 1px solid rgba(46, 204, 113, 0.2);
	color: #2ecc71;
}
.session-alert.--error {
	background: rgba(231, 76, 60, 0.1);
	border: 1px solid rgba(231, 76, 60, 0.2);
	color: #ea6060;
}
.inspect-modal-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.7);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1000;
}
.inspect-modal {
	background: #1a1d23;
	border: 1px solid #30363d;
	border-radius: 12px;
	width: 90%;
	max-width: 500px;
	padding: 24px;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
</style>
