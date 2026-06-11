import { audioService } from '../../services/audioService.js'
import { gamepadNavService } from '../../services/gamepadNavService.js'
import * as surfaceConstants from './constants.js'
import { easeInOut } from './utils.js'

const {
  SURFACE_MODEL_URL,
  ZOMBIE_MODEL_URL,
  DAY_SKY_COLOR,
  NIGHT_SKY_COLOR,
  SUN_COLOR,
  SUN_LIGHT_COLOR,
  DAY_SECONDS,
  DUSK_SECONDS,
  NIGHT_SECONDS,
  DAWN_SECONDS,
  DAY_NIGHT_CYCLE_SECONDS,
  NIGHT_WARNING_SECONDS,
  CHARACTER_HEIGHT,
  CHARACTER_POSITION,
  THIRD_PERSON_CAMERA_OFFSET,
  THIRD_PERSON_ROTATION,
  CHARACTER_BASE_YAW,
  WALK_SPEED,
  RUN_SPEED,
  ARMED_WALK_SPEED,
  ARMED_RUN_SPEED,
  TURN_SPEED,
  WALK_CLIP,
  IDLE_CLIP,
  RIFLE_IDLE_CLIP,
  RIFLE_AIMING_CLIP,
  RIFLE_RUN_CLIP,
  RIFLE_BACKWARD_CLIP,
  GRAB_RIFLE_CLIP,
  PUT_BACK_RIFLE_CLIP,
  FIRE_RIFLE_WALK_CLIP,
  PUNCH_LEFT_CLIP,
  PUNCH_RIGHT_CLIP,
  RUN_CLIP,
  RUN_BACKWARD_CLIP,
  JUMP_CLIP,
  LASER_COLOR,
  LASER_DURATION_MS,
  LASER_BOLT_LENGTH,
  LASER_BOLT_RADIUS,
  LASER_BOLT_SPEED,
  LASER_MUZZLE_OFFSET,
  LASER_RETICLE_FORWARD_OFFSET,
  LASER_RETICLE_RADIUS,
  FIRE_COOLDOWN_MS,
  JUMP_FALLBACK_MS,
  JUMP_LAND_BLEND_MS,
  AIM_BEFORE_FIRE_MS,
  GRAVITY,
  JUMP_VELOCITY,
  CHARACTER_GROUND_OFFSET,
  GROUND_RAY_HEIGHT,
  GROUND_RAY_DEPTH,
  CHARACTER_COLLISION_RADIUS,
  COLLISION_MIN_HEIGHT,
  COLLISION_MIN_SIZE,
  COLLISION_MAX_FLATNESS,
  TREE_COLLIDER_PADDING,
  ROCK_COLLIDER_PADDING,
  OBSTACLE_TOP_STAND_TOLERANCE,
  OBSTACLE_TOP_GROUND_TOLERANCE,
  COLLISION_PUSH_EPSILON,
  WATER_SURFACE_TOLERANCE,
  WATER_SINK_ACCELERATION,
  WATER_SINK_MAX_SPEED,
  ZOMBIE_HEIGHT,
  ZOMBIE_ROOT_GROUND_OFFSET,
  ZOMBIE_HEALTH,
  ZOMBIE_SPEED,
  ZOMBIE_ATTACK_RANGE,
  ZOMBIE_ATTACK_COOLDOWN,
  ZOMBIE_SPAWN_DROP_HEIGHT,
  ZOMBIE_SPAWN_INTERVAL,
  ZOMBIE_MAX_ALIVE,
  ZOMBIE_HIT_RADIUS,
  ZOMBIE_ROOT_Y_TOLERANCE,
  ZOMBIE_INVALID_GROUND_MAX_SECONDS,
  ZOMBIE_KILL_SCORE,
  NIGHT_CONFIGS,
  DAY_BRIEFINGS,
  MAX_NIGHTS,
  SCORE_POPUP_DURATION_MS,
  ZOMBIE_CLIPS,
  ZOMBIE_ROOT_MOTION_CLIPS,
  ROOT_MOTION_CLIPS,
  SURFACE_CONTROL_KEYS,
} = surfaceConstants

export const missionMethods = {
  setupUi() {
    this.missionUi = document.getElementById('mission-ui')
    this.missionUi?.classList.add('surface-mission-ui')

    this.panel = document.createElement('div')
    this.panel.className = 'surface-panel'
    this.panel.innerHTML = `
      <div class="surface-kicker">PRISTANI / ${this.planet?.name || 'ZEPHYR'}</div>
      <div class="surface-title">Povrch planety</div>
      <div class="surface-readout">
        <div class="surface-stat">
          <span>SKORE</span>
          <strong id="surfaceScore">0</strong>
        </div>
        <div class="surface-stat">
          <span>ZIVOTY</span>
          <strong id="surfaceHealth">3</strong>
        </div>
        <div class="surface-stat surface-stat-wide">
          <span id="surfacePhaseLabel">DEN</span>
          <strong id="surfacePhaseTimer">--</strong>
        </div>
        <div class="surface-stat surface-stat-wide">
          <span>VLNA</span>
          <strong id="surfaceNightCount">NOC 1 / 3</strong>
        </div>
        <div class="surface-stat">
          <span>MAJAKY</span>
          <strong id="surfaceBeaconCount">0/0</strong>
        </div>
      </div>
      <div class="surface-status" id="surfaceStatus">NOC PRIJDE ZA CHVILI</div>
    `
    this.missionUi?.appendChild(this.panel)
    this.surfaceScoreEl = this.panel.querySelector('#surfaceScore')
    this.surfaceHealthEl = this.panel.querySelector('#surfaceHealth')
    this.surfacePhaseLabelEl = this.panel.querySelector('#surfacePhaseLabel')
    this.surfacePhaseTimerEl = this.panel.querySelector('#surfacePhaseTimer')
    this.surfaceNightCountEl = this.panel.querySelector('#surfaceNightCount')
    this.surfaceBeaconCountEl = this.panel.querySelector('#surfaceBeaconCount')
    this.surfaceStatusEl = this.panel.querySelector('#surfaceStatus')
    this.surfaceControlsPanel = document.createElement('div')
    this.surfaceControlsPanel.className = 'surface-controls-panel is-hidden'
    this.surfaceControlsPanel.innerHTML = `
      <div class="surface-controls-kicker">OVLADANI</div>
      <div class="surface-controls-grid">
        <div><kbd>WASD</kbd><span>Pohyb</span></div>
        <div><kbd>SHIFT</kbd><span>Beh</span></div>
        <div><kbd>SPACE</kbd><span>Skok</span></div>
        <div><kbd>R</kbd><span>Zbran</span></div>
        <div><kbd>F</kbd><span>Utok / strelba</span></div>
        <div><kbd>Q</kbd><span>Aktivovat majak</span></div>
      </div>
    `
    this.missionUi?.appendChild(this.surfaceControlsPanel)
    this.nightOverlay = document.createElement('div')
    this.nightOverlay.className = 'surface-night-overlay'
    this.nightOverlay.setAttribute('aria-hidden', 'true')
    this.missionUi?.appendChild(this.nightOverlay)
    this.surfaceOverlay = document.createElement('div')
    this.surfaceOverlay.className = 'surface-result-overlay hidden'
    this.surfaceOverlay.innerHTML = `
      <div class="surface-result-panel">
        <div class="surface-result-kicker" id="surfaceResultKicker">SURFACE MISSION</div>
        <div class="surface-result-title" id="surfaceResultTitle">SIGNAL ZTRACEN</div>
        <div class="surface-result-copy" id="surfaceResultCopy">Pokus ukoncen.</div>
        <div class="surface-result-stats">
          <div><span>SKORE</span><strong id="surfaceResultScore">0</strong></div>
          <div><span>KILLY</span><strong id="surfaceResultKills">0</strong></div>
          <div><span>NOCI</span><strong id="surfaceResultNights">0 / 3</strong></div>
        </div>
        <div class="surface-result-actions">
          <button class="surface-map-button" id="surfaceRestartButton" type="button">ZKUSIT ZNOVU</button>
          <button class="surface-map-button" id="surfaceResultMapButton" type="button">ZPET NA ORBITU</button>
        </div>
      </div>
    `
    this.missionUi?.appendChild(this.surfaceOverlay)
    this.surfaceOverlay.querySelector('#surfaceRestartButton')?.addEventListener('click', () => this.restartSurfaceMission())
    this.surfaceOverlay.querySelector('#surfaceResultMapButton')?.addEventListener('click', () => this.finishSurfaceResult())

    this.surfaceBriefingOverlay = document.createElement('div')
    this.surfaceBriefingOverlay.className = 'surface-briefing-overlay hidden'
    this.surfaceBriefingOverlay.setAttribute('role', 'dialog')
    this.surfaceBriefingOverlay.setAttribute('aria-modal', 'true')
    this.surfaceBriefingOverlay.innerHTML = `
      <div class="surface-briefing-panel">
        <div class="surface-briefing-kicker" id="surfaceBriefingKicker">DEN</div>
        <div class="surface-briefing-title" id="surfaceBriefingTitle">Briefing</div>
        <div class="surface-briefing-copy" id="surfaceBriefingSummary"></div>
        <div class="surface-briefing-grid">
          <div class="surface-briefing-card">
            <span>HROZBA</span>
            <strong id="surfaceBriefingThreat"></strong>
          </div>
          <div class="surface-briefing-card">
            <span>CIL DNE</span>
            <strong id="surfaceBriefingObjective"></strong>
          </div>
          <div class="surface-briefing-card surface-briefing-card-wide">
            <span>DOPORUCENI</span>
            <strong id="surfaceBriefingAdvice"></strong>
          </div>
        </div>
        <button class="surface-map-button" id="surfaceBriefingButton" type="button">ZACIT DEN</button>
      </div>
    `
    this.missionUi?.appendChild(this.surfaceBriefingOverlay)
    this.surfaceBriefingKickerEl = this.surfaceBriefingOverlay.querySelector('#surfaceBriefingKicker')
    this.surfaceBriefingTitleEl = this.surfaceBriefingOverlay.querySelector('#surfaceBriefingTitle')
    this.surfaceBriefingSummaryEl = this.surfaceBriefingOverlay.querySelector('#surfaceBriefingSummary')
    this.surfaceBriefingThreatEl = this.surfaceBriefingOverlay.querySelector('#surfaceBriefingThreat')
    this.surfaceBriefingObjectiveEl = this.surfaceBriefingOverlay.querySelector('#surfaceBriefingObjective')
    this.surfaceBriefingAdviceEl = this.surfaceBriefingOverlay.querySelector('#surfaceBriefingAdvice')
    this.surfaceBriefingButton = this.surfaceBriefingOverlay.querySelector('#surfaceBriefingButton')
    this.surfaceBriefingButton?.addEventListener('click', this.onDayBriefingContinue)

  },

  activateSurfaceBriefingNav() {
    gamepadNavService.replace({
      id: 'zephyr-surface',
      elements: () => [document.getElementById('surfaceBriefingButton')].filter(Boolean),
      onBack: () => this.closeDayBriefing(),
    })
  },

  activateSurfaceResultNav() {
    gamepadNavService.replace({
      id: 'zephyr-surface',
      linear: true,
      elements: () => [
        document.getElementById('surfaceRestartButton'),
        document.getElementById('surfaceResultMapButton'),
      ].filter(Boolean),
      onBack: () => this.finishSurfaceResult(),
    })
  },

  showDayBriefing(day) {
    const briefingDay = Math.min(Math.max(day || 1, 1), MAX_NIGHTS)
    if (!this.surfaceBriefingOverlay || this.shownDayBriefings?.has(briefingDay)) return

    const briefing = DAY_BRIEFINGS[briefingDay - 1]
    if (!briefing) return

    this.shownDayBriefings.add(briefingDay)
    this.surfaceBriefingDay = briefingDay
    this.surfaceBriefingOpen = true
    this.movementLocked = true
    this.moveSpeed = 0
    this.turnSpeed = 0
    this.keys = {}

    this.surfaceBriefingKickerEl.textContent = briefing.kicker
    this.surfaceBriefingTitleEl.textContent = briefing.title
    this.surfaceBriefingSummaryEl.textContent = briefing.summary
    this.surfaceBriefingThreatEl.textContent = briefing.threat
    this.surfaceBriefingObjectiveEl.textContent = briefing.objective
    this.surfaceBriefingAdviceEl.textContent = briefing.advice
    this.surfaceBriefingButton.textContent = briefingDay === 1 ? 'ZACIT MISI' : 'POKRACOVAT'
    this.surfaceBriefingOverlay.classList.remove('hidden')
    this.setSurfaceStatus(`${briefing.kicker} - BRIEFING`, 2)
    this.activateSurfaceBriefingNav()
    window.requestAnimationFrame(() => this.surfaceBriefingButton?.focus())
  },

  closeDayBriefing() {
    if (!this.surfaceBriefingOpen) return
    this.surfaceBriefingOpen = false
    this.surfaceBriefingOverlay?.classList.add('hidden')
    gamepadNavService.remove('zephyr-surface')
    if (!this.surfaceGameOver && !this.surfaceVictory) this.movementLocked = false
    this.setSurfaceStatus('PRIPRAV SE NA NOC', 1.5)
    this.showSurfaceControlsHint()
  },

  showSurfaceControlsHint(durationMs = 9000) {
    if (!this.surfaceControlsPanel) return
    window.clearTimeout(this.surfaceControlsTimer)
    this.surfaceControlsPanel.classList.remove('is-hidden')
    this.surfaceControlsTimer = window.setTimeout(() => {
      this.surfaceControlsPanel?.classList.add('is-hidden')
      this.surfaceControlsTimer = null
    }, durationMs)
  },

  getDayNightState() {
    const time = this.dayNightTime
    const nightStart = DAY_SECONDS + DUSK_SECONDS
    const dawnStart = nightStart + NIGHT_SECONDS
    const timeUntilNight = time < nightStart
      ? nightStart - time
      : DAY_NIGHT_CYCLE_SECONDS - time + nightStart

    if (time < DAY_SECONDS) {
      return {
        phase: 'day',
        nightAmount: 0,
        phaseRemaining: DAY_SECONDS - time,
        timeUntilNight,
      }
    }

    if (time < nightStart) {
      const phaseTime = time - DAY_SECONDS
      return {
        phase: 'dusk',
        nightAmount: easeInOut(phaseTime / DUSK_SECONDS),
        phaseRemaining: DUSK_SECONDS - phaseTime,
        timeUntilNight,
      }
    }

    if (time < dawnStart) {
      const phaseTime = time - nightStart
      return {
        phase: 'night',
        nightAmount: 1,
        phaseRemaining: NIGHT_SECONDS - phaseTime,
        timeUntilNight,
      }
    }

    const phaseTime = time - dawnStart
    return {
      phase: 'dawn',
      nightAmount: 1 - easeInOut(phaseTime / DAWN_SECONDS),
      phaseRemaining: DAWN_SECONDS - phaseTime,
      timeUntilNight,
    }
  },

  damagePlayer(amount) {
    if (this.surfaceGameOver || this.playerDamageCooldown > 0) return
    this.playerDamageCooldown = 0.85
    this.surfaceHealth = Math.max(0, this.surfaceHealth - amount)
    this.cameraShake = Math.max(this.cameraShake, 1)
    audioService.playSurfaceDamage()
    this.updateSurfaceHud()
    this.flashSurfaceDamage()

    if (this.surfaceHealth <= 0) {
      this.surfaceGameOver = true
      this.movementLocked = true
      this.setSurfaceStatus('SIGNAL ZTRACEN - ZPET NA ORBITU')
      this.showSurfaceResult('gameover')
    }
  },

  flashSurfaceDamage() {
    const flash = document.getElementById('damageFlash')
    if (!flash) return
    flash.classList.add('active')
    window.clearTimeout(this.damageFlashTimer)
    this.damageFlashTimer = window.setTimeout(() => {
      flash.classList.remove('active')
      this.damageFlashTimer = null
    }, 120)
  },

  showScorePopup(text, worldPosition) {
    const camera = this.camera?.components?.camera?.camera
    if (!this.missionUi || !camera) return
    const vector = worldPosition.clone()
    vector.y += 0.45
    vector.project(camera)
    if (vector.z < -1 || vector.z > 1) return

    const popup = document.createElement('div')
    popup.className = 'score-popup surface-score-popup'
    popup.textContent = text
    popup.style.left = `${(vector.x * 0.5 + 0.5) * window.innerWidth}px`
    popup.style.top = `${(-vector.y * 0.5 + 0.5) * window.innerHeight}px`
    this.missionUi.appendChild(popup)
    window.setTimeout(() => popup.remove(), SCORE_POPUP_DURATION_MS)
  },

  addSurfaceScore(points) {
    this.surfaceScore += points
    this.updateSurfaceHud()
  },

  getNightConfig() {
    return NIGHT_CONFIGS[Math.min(this.currentNight - 1, NIGHT_CONFIGS.length - 1)]
  },

  updateSurfaceHud(state = this.dayNightState) {
    if (this.surfaceScoreEl) this.surfaceScoreEl.textContent = this.surfaceScore.toLocaleString('cs-CZ')
    if (this.surfaceHealthEl) this.surfaceHealthEl.textContent = `${this.surfaceHealth}`
    if (this.surfaceNightCountEl) this.surfaceNightCountEl.textContent = `NOC ${Math.min(this.currentNight, MAX_NIGHTS)} / ${MAX_NIGHTS}`
    this.updateBeaconHud?.()
    if (!state) return

    const phaseLabel = state.phase === 'night'
      ? 'NOC'
      : state.timeUntilNight <= NIGHT_WARNING_SECONDS
        ? 'NOC ZA'
        : state.phase === 'dawn'
          ? 'SVITANI'
          : state.phase === 'dusk'
            ? 'STMIVANI'
            : 'DEN'
    const timer = state.phase === 'night' || state.phase === 'dawn'
      ? state.phaseRemaining
      : state.timeUntilNight
    if (this.surfacePhaseLabelEl) this.surfacePhaseLabelEl.textContent = phaseLabel
    if (this.surfacePhaseTimerEl) this.surfacePhaseTimerEl.textContent = `${Math.max(0, Math.ceil(timer))}s`

    if (this.surfaceGameOver || this.surfaceVictory || this.surfaceStatusHold > 0) return
    if (state.phase === 'night') this.setSurfaceStatus(`PREZIJ NOC ${this.currentNight}/${MAX_NIGHTS} - ZOMBIE ${this.getAliveZombieCount()}/${this.getNightConfig().maxAlive}`)
    else if (state.timeUntilNight <= NIGHT_WARNING_SECONDS) this.setSurfaceStatus(`NOC ZA ${Math.ceil(state.timeUntilNight)}s`)
    else if (state.phase === 'dawn') this.setSurfaceStatus('SVITA')
    else if (state.phase === 'dusk') this.setSurfaceStatus('STMIVA SE')
    else if (!this.missionCompleted) this.setSurfaceStatus('PRIPRAV SE NA NOC')
  },

  setSurfaceStatus(value, holdSeconds = 0) {
    if (this.surfaceStatusEl) this.surfaceStatusEl.textContent = value
    if (holdSeconds > 0) this.surfaceStatusHold = holdSeconds
  },

  completeSurfaceMission() {
    if (this.missionCompleted) return
    this.missionCompleted = true
    this.surfaceVictory = true
    this.movementLocked = true
    audioService.playSurfaceVictory()
    this.showSurfaceResult('victory')
  },

  submitSurfaceMissionResult() {
    if (this.missionResultSubmitted || !this.missionCompleted) return
    this.missionResultSubmitted = true
    window.dispatchEvent(new CustomEvent('mission-ended', {
      detail: { completed: true, planetIndex: this.data.planetIndex, score: this.surfaceScore },
    }))
  },

  showSurfaceResult(type) {
    if (!this.surfaceOverlay) return
    const victory = type === 'victory'
    this.surfaceOverlay.classList.remove('hidden')
    this.surfaceOverlay.querySelector('#surfaceResultKicker').textContent = victory ? 'MISE SPLNENA' : 'MISE SELHALA'
    this.surfaceOverlay.querySelector('#surfaceResultTitle').textContent = victory ? 'SVITANI' : 'SIGNAL ZTRACEN'
    this.surfaceOverlay.querySelector('#surfaceResultCopy').textContent = victory
      ? 'Prezili jste vsechny nocni vlny na povrchu planety.'
      : 'Postava podlehla nocnimu utoku.'
    this.surfaceOverlay.querySelector('#surfaceResultScore').textContent = this.surfaceScore.toLocaleString('cs-CZ')
    this.surfaceOverlay.querySelector('#surfaceResultKills').textContent = `${this.totalKills}`
    this.surfaceOverlay.querySelector('#surfaceResultNights').textContent = `${victory ? MAX_NIGHTS : Math.max(0, this.currentNight - 1)} / ${MAX_NIGHTS}`
    this.surfaceOverlay.querySelector('#surfaceResultMapButton').textContent = victory ? 'ULOZIT A NA ORBITU' : 'ZPET NA ORBITU'
    this.activateSurfaceResultNav()
  },

  finishSurfaceResult() {
    if (this.missionCompleted) this.submitSurfaceMissionResult()
    window.dispatchEvent(new CustomEvent('return-map'))
  },

  restartSurfaceMission() {
    window.clearTimeout(this.actionTimer)
    window.clearTimeout(this.jumpTimer)
    window.clearTimeout(this.weaponTimer)
    window.clearTimeout(this.surfaceControlsTimer)
    this.surfaceControlsTimer = null
    this.clearAllZombies()
    this.lasers.forEach((laser) => laser.remove())
    this.lasers.clear()
    this.clearDayBeacons?.()
    this.surfaceOverlay?.classList.add('hidden')
    this.surfaceBriefingOverlay?.classList.add('hidden')
    this.surfaceControlsPanel?.classList.add('is-hidden')
    this.dayNightTime = 0
    this.dayNightPhase = 'day'
    this.wasNight = false
    this.nightSurvivalAwarded = false
    this.zombieSpawnTimer = ZOMBIE_SPAWN_INTERVAL
    this.zombieSpawnCursor = 0
    this.dayBeaconDay = 0
    this.surfaceScore = 0
    this.surfaceHealth = 3
    this.currentNight = 1
    this.totalKills = 0
    this.surfaceGameOver = false
    this.surfaceVictory = false
    this.missionCompleted = false
    this.missionResultSubmitted = false
    this.surfaceStatusHold = 0
    this.surfaceBriefingOpen = false
    this.surfaceBriefingDay = 0
    this.shownDayBriefings?.clear()
    this.playerDamageCooldown = 0
    this.movementLocked = false
    this.actionLocked = false
    this.fireSequenceActive = false
    this.queuedFireCount = 0
    this.queuedMeleeCount = 0
    this.armed = false
    this.setWeaponVisible(false)
    this.updateSurfaceReticle()
    this.characterPosition.set(CHARACTER_POSITION.x, CHARACTER_POSITION.y, CHARACTER_POSITION.z)
    this.characterYaw = CHARACTER_BASE_YAW
    this.moveSpeed = 0
    this.turnSpeed = 0
    this.verticalVelocity = 0
    this.snapCharacterToGround()
    this.updateDayNightCycle(0)
    this.setSurfaceStatus('PRIPRAV SE NA NOC')
    this.startDayBeacons?.(this.currentNight)
    this.showDayBriefing(this.currentNight)
  },

  updateDayNightCycle(dt) {
    const previousPhase = this.dayNightPhase
    this.dayNightTime = (this.dayNightTime + dt) % DAY_NIGHT_CYCLE_SECONDS
    const state = this.getDayNightState()
    const nightAmount = state.nightAmount
    this.dayNightState = state
    this.dayNightPhase = state.phase

    this.skyColor.copy(this.daySkyColor).lerp(this.nightSkyColor, nightAmount)
    const skyObj = this.sky?.object3D
    if (skyObj?.material) skyObj.material.color.copy(this.skyColor)
    this.nightOverlay?.style.setProperty('opacity', `${nightAmount}`)

    const sunProgress = Math.max(0, Math.min(1, this.dayNightTime / DAY_SECONDS))
    const sunArc = Math.sin(Math.PI * sunProgress)
    const sunX = -24 + 48 * sunProgress
    const sunY = 8 + 20 * sunArc
    const sunZ = -18 - 4 * sunArc
    const duskLight = state.phase === 'dusk' ? 1 - nightAmount : 1
    const dawnLight = state.phase === 'dawn' ? Math.max(0, 1 - nightAmount) * 0.25 : 0
    const sunAmount = state.phase === 'day'
      ? 0.68 + 0.42 * sunArc
      : state.phase === 'dusk'
        ? Math.max(0, duskLight) * 0.5
        : dawnLight
    const sunOpacity = state.phase === 'night' ? 0 : Math.min(1, Math.max(0, sunAmount))

    const sunObj = this.sun?.object3D
    if (sunObj) {
      sunObj.position.set(sunX, sunY, sunZ)
      if (sunObj.material) {
        sunObj.material.emissiveIntensity = 1.2 + sunOpacity * 0.8
        sunObj.material.opacity = sunOpacity
      }
    }

    const sunLightObj = this.sunLight?.object3D
    if (sunLightObj) {
      sunLightObj.position.set(sunX, sunY, sunZ)
      const sunLight = sunLightObj.children?.[0]
      if (sunLight?.isLight) sunLight.intensity = 1.45 * sunAmount
    }

    const ambientObj = this.ambientLight?.object3D?.children?.[0]
    if (ambientObj?.isLight) {
      this.ambientColor.copy(this.ambientColorDay).lerp(this.ambientColorNight, nightAmount)
      ambientObj.color.copy(this.ambientColor)
      ambientObj.intensity = 0.48 + (0.36 - 0.48) * nightAmount
    }

    const moonLightObj = this.moonLight?.object3D?.children?.[0]
    if (moonLightObj?.isLight) {
      this.moonColor.copy(this.moonColorDay).lerp(this.moonColorNight, nightAmount)
      moonLightObj.color.copy(this.moonColor)
      moonLightObj.intensity = 0.86 * nightAmount
    }

    const hemiObj = this.hemisphereLight?.object3D?.children?.[0]
    if (hemiObj?.isLight) {
      this.hemiColor.copy(this.hemiColorDay).lerp(this.hemiColorNight, nightAmount)
      hemiObj.color.copy(this.hemiColor)
      this.hemiGroundColor.copy(this.hemiGroundDay).lerp(this.hemiGroundNight, nightAmount)
      hemiObj.groundColor.copy(this.hemiGroundColor)
      hemiObj.intensity = 0.42 + (0.32 - 0.42) * nightAmount
    }

    const moonObj = this.moon?.object3D
    if (moonObj?.material) moonObj.material.opacity = nightAmount
    this.updateSurfaceHud(state)
    if (
      state.phase === 'day' &&
      previousPhase &&
      previousPhase !== 'day' &&
      !this.surfaceGameOver &&
      !this.surfaceVictory
    ) {
      this.startDayBeacons?.(this.currentNight)
      this.showDayBriefing(this.currentNight)
    }
  }
}
