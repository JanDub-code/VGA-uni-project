import { gameState, getPlanet } from '../../services/gameState.js'
import { audioService } from '../../services/audioService.js'
import { gamepadService } from '../../services/gamepadService.js'
import { gamepadNavService } from '../../services/gamepadNavService.js'
import {
  CAMERA,
  GAME_STATES,
  GLACIES_COLORS,
  HUD_SEGMENTS,
  LIGHTING,
  LIGHT_PHASES,
  PHYSICS,
  SHIP_BEAM_STYLES,
} from './constants.js'
import { clamp, createEntity } from './utils.js'
import { terrainArenaMethods } from './terrainArenaMethods.js'
import { lightingMethods } from './lightingMethods.js'
import { projectileMethods } from './projectileMethods.js'
import { enemyMethods } from './enemyMethods.js'
import { effectsMethods } from './effectsMethods.js'
import { gameplayMethods } from './gameplayMethods.js'

const CONTROL_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
  'Space',
])

AFRAME.registerComponent('glacies-drift', {
  schema: {
    planetIndex: { type: 'int', default: 2 },
    autoStart: { type: 'boolean', default: true },
  },

  init() {
    this.THREE = AFRAME.THREE
    this.planet = getPlanet(this.data.planetIndex)
    this.shipSkin = gameState.getSelectedShipSkin()
    this.beamStyle = SHIP_BEAM_STYLES[this.shipSkin.id] || SHIP_BEAM_STYLES['keeper-default']
    this.state = GAME_STATES.PLAYING
    this.clockTime = 0
    this.keys = {}
    this.velocity = new this.THREE.Vector3()
    this.forward = new this.THREE.Vector3(0, 0, -1)
    this.right = new this.THREE.Vector3(1, 0, 0)
    this.yAxis = new this.THREE.Vector3(0, 1, 0)
    this.shipYaw = 0
    this.turnInput = 0
    this.turnInputTarget = 0
    this.throttleInput = 0
    this.shipHealth = gameState.getLanternBrightness() * 100
    this.score = 0
    this.towersDestroyed = 0
    this.lightPhase = 0
    this.lightPhaseTarget = 0
    this.lightPhaseCurrent = { ...LIGHT_PHASES[0] }
    this.finalLightPulse = 0
    this.victoryTimeout = null
    this.driftEnergy = 1
    this.boostEnergy = 1
    this.boostCooldown = 0
    this.boostQueued = false
    this.fireQueued = false
    this.lastFireTime = -Infinity
    this.boundaryPulse = 0
    this.obstaclePulse = 0
    this.damagePulse = 0
    this.damageCooldown = 0
    this.damageStatusHold = 0
    this.damageFlashTimer = null
    this.heat = 0
    this.overheatLockUntil = 0
    this._heatWarningLastPlayed = -Infinity
    this.systemPausedState = null
    this.terrainProps = []
    this.terrainColliders = []
    this.boostCrystals = []
    this.towers = []
    this.drones = []
    this.projectiles = []
    this.projectilePool = []
    this.allProjectileEls = []
    this.enemyProjectiles = []
    this.enemyProjectilePool = []
    this.ephemeralEls = []
    this.pulseEffects = []
    this.pulseEffectPool = []
    this.ended = false
    this.contactShadows = []
    this.contactShadowTexture = null
    this.iceTextures = []
    this.icePhaseMaterials = {}
    this.projectileResources = null
    this.enemyProjectileResources = null
    this.pulseEffectGeometry = null
    this.boostCrystalResources = null
    this._hudCache = {}
    this._tmpVec = new this.THREE.Vector3()
    this._tmpVec2 = new this.THREE.Vector3()
    this._tmpVec3 = new this.THREE.Vector3()
    this._projectileForward = new this.THREE.Vector3()
    this._projectilePosition = new this.THREE.Vector3()
    this._droneAimOffset = new this.THREE.Vector3(0, 1.8, 0)
    this._cameraTarget = new this.THREE.Vector3()
    this._cameraLook = new this.THREE.Vector3()
    this._arenaCenter = new this.THREE.Vector3()
    this.cameraFlipQuat = new this.THREE.Quaternion().setFromAxisAngle(this.yAxis, Math.PI)
    this._timeouts = new Set()
    this._lastFogDensity = null
    this._radarUpdateTimer = 0
    this._terrainShadowTimer = 0

    this.onKeyDown = (event) => {
      if (CONTROL_CODES.has(event.code)) {
        event.preventDefault()
        event.stopPropagation()
      }
      if (!event.repeat && event.code === 'Space') this.boostQueued = true
      this.keys[event.key.toLowerCase()] = true
      this.keys[event.code.toLowerCase()] = true
    }
    this.onKeyUp = (event) => {
      if (CONTROL_CODES.has(event.code)) {
        event.preventDefault()
        event.stopPropagation()
      }
      this.keys[event.key.toLowerCase()] = false
      this.keys[event.code.toLowerCase()] = false
    }
    this.onSystemMenuToggle = (event) => {
      const open = !!event.detail.open
      if (open && this.state === GAME_STATES.PLAYING) {
        this.systemPausedState = this.state
        this.state = GAME_STATES.PAUSED
        this.clearInputState()
      } else if (!open && this.state === GAME_STATES.PAUSED && this.systemPausedState) {
        this.state = this.systemPausedState
        this.systemPausedState = null
      }
    }
    this.onLanternBrightnessChange = (value) => {
      const pct = Math.max(0, Math.min(1, Number(value) || 0)) * 100
      this.shipHealth = pct
    }
    this.onPointerDown = (event) => {
      if (event.button !== 0 || this.state !== GAME_STATES.PLAYING) return
      if (event.target?.closest?.('#system-menu, .overlay, button, [role="button"]')) return
      event.preventDefault()
      this.fireQueued = true
    }

    this.bindUi()
    this.setupUi()
    this.buildScene()
    this.activateCamera()
    window.addEventListener('keydown', this.onKeyDown, true)
    window.addEventListener('keyup', this.onKeyUp, true)
    window.addEventListener('system-menu-toggle', this.onSystemMenuToggle)
    window.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('lantern-brightness-changed', this.onLanternBrightnessChange)
    gameState.resetLanternBrightness()
    this.updateHud()
    audioService.stopMusic()
  },

  bindUi() {
    this.uiHandlers = [
      ['restartButton', () => this.restartMission()],
      ['quitButton', () => window.dispatchEvent(new CustomEvent('return-map'))],
      ['retryButton', () => this.restartMission()],
      ['gameOverMapButton', () => window.dispatchEvent(new CustomEvent('return-map'))],
      ['mainMenuButton', () => window.dispatchEvent(new CustomEvent('return-main-menu'))],
      ['victoryRetryButton', () => this.restartMission()],
      ['victoryMapButton', () => window.dispatchEvent(new CustomEvent('return-map'))],
    ]
    this.uiHandlers.forEach(([id, handler]) => document.getElementById(id)?.addEventListener('click', handler))
  },

  restartMission() {
    gameState.resetLanternBrightness()
    window.clearTimeout(this.damageFlashTimer)
    this.damageFlashTimer = null
    window.clearTimeout(this.victoryTimeout)
    this.victoryTimeout = null
    this._timeouts?.forEach((id) => window.clearTimeout(id))
    this._timeouts?.clear()
    document.getElementById('damageFlash')?.classList.remove('active', 'show')
    this.heat = 0
    this.overheatLockUntil = 0
    this._heatWarningLastPlayed = -Infinity
    this._hudCache = {}
    window.dispatchEvent(new CustomEvent('start-mission', {
      detail: { planetIndex: this.data.planetIndex },
    }))
  },

  setupUi() {
    this.missionUi = document.getElementById('mission-ui')
    this.missionUi?.classList.add('glacies-mission-ui')

    this.hud = document.createElement('div')
    this.hud.className = 'glacies-hud'
    this.hud.innerHTML = `
      <section class="glacies-hud-panel glacies-telemetry" aria-label="Stav lodi">
        <div class="glacies-kicker">RYCHLOST</div>
        <div class="glacies-speed-row">
          <strong id="glaciesSpeed">0</strong>
          <span>km/s</span>
        </div>
        <div class="glacies-meter-label">DRIFT</div>
        <div class="glacies-segments" id="glaciesDriftSegments"></div>
        <div class="glacies-meter-label">JAS LUCERNY</div>
        <div class="glacies-hull-meter" id="glaciesLanternBar"><i id="glaciesHullFill"></i></div>
      </section>

      <section class="glacies-hud-panel glacies-mission-panel" aria-label="Cil mise">
        <div class="glacies-kicker">CIL MISE</div>
        <strong>Znic Pohlcovace Svetla</strong>
        <span id="glaciesMissionState">STAV: 0/3 vezi zniceno</span>
      </section>

      <section class="glacies-hud-panel glacies-radar-panel" aria-label="Radar">
        <div class="glacies-kicker">RADAR</div>
        <div class="glacies-radar" id="glaciesRadar">
          <span class="glacies-radar-ring ring-a"></span>
          <span class="glacies-radar-ring ring-b"></span>
          <span class="glacies-radar-ring ring-c"></span>
          <span class="glacies-radar-sweep"></span>
          <span class="glacies-radar-ship" id="glaciesRadarShip"></span>
          <span class="glacies-radar-boundary"></span>
        </div>
      </section>

      <section class="glacies-hud-panel glacies-controls-panel" aria-label="Ovladani">
        <div class="glacies-kicker">OVLADANI</div>
        <div class="glacies-control-grid">
          <div class="glacies-control" data-key="w"><kbd>W</kbd><span>Zrychlit</span></div>
          <div class="glacies-control" data-key="s"><kbd>S</kbd><span>Zpomalit</span></div>
          <div class="glacies-control" data-key="a"><kbd>A</kbd><span>Otaceni</span></div>
          <div class="glacies-control" data-key="d"><kbd>D</kbd><span>Otaceni</span></div>
          <div class="glacies-control wide" data-key="shift"><kbd>SHIFT</kbd><span>Drift</span></div>
          <div class="glacies-control wide" data-key="space"><kbd>SPACE</kbd><span>Boost</span></div>
          <div class="glacies-control wide" data-key="fire"><kbd>MYS</kbd><span>Strelba</span></div>
        </div>
        <div class="glacies-ability-row">
          <span>DRIFT</span><div class="glacies-mini-meter"><i id="glaciesDriftFill"></i></div>
          <span>BOOST</span><div class="glacies-mini-meter"><i id="glaciesBoostFill"></i></div>
        </div>
        <div class="glacies-meter-label">TEPLO JÁDRA</div>
        <div class="glacies-heat-meter" id="glaciesHeatBar"><i id="glaciesHeatFill"></i></div>
      </section>
      <div class="glacies-heat-vignette" id="glaciesHeatVignette"></div>
    `
    this.missionUi?.appendChild(this.hud)
    this.speedEl = this.hud.querySelector('#glaciesSpeed')
    this.missionStateEl = this.hud.querySelector('#glaciesMissionState')
    this.driftSegmentsEl = this.hud.querySelector('#glaciesDriftSegments')
    this.driftFillEl = this.hud.querySelector('#glaciesDriftFill')
    this.boostFillEl = this.hud.querySelector('#glaciesBoostFill')
    this.hullFillEl = this.hud.querySelector('#glaciesHullFill')
    this.heatBarEl = this.hud.querySelector('#glaciesHeatBar')
    this.heatFillEl = this.hud.querySelector('#glaciesHeatFill')
    this.heatVignetteEl = this.hud.querySelector('#glaciesHeatVignette')
    this.radarEl = this.hud.querySelector('#glaciesRadar')
    this.radarShipEl = this.hud.querySelector('#glaciesRadarShip')
    this.controlEls = [...this.hud.querySelectorAll('.glacies-control')]
    this.driftSegmentsEl.innerHTML = Array.from({ length: HUD_SEGMENTS }, () => '<span></span>').join('')
    this.driftSegmentEls = [...this.driftSegmentsEl.querySelectorAll('span')]
  },

  buildScene() {
    this.el.sceneEl.setAttribute('background', `color: ${GLACIES_COLORS.darkness}`)
    this.el.sceneEl.setAttribute('fog', `type: exponential; color: ${LIGHTING.fogColor}; density: ${LIGHTING.fogDensity}`)
    this.el.sceneEl.setAttribute('shadow', 'type: pcfsoft; autoUpdate: true')
    this.configureRendererShadows()

    this.sky = createEntity('a-sky', {
      color: '#02070d',
    }, this.el)
    this.ambientLight = createEntity('a-entity', {
      light: `type: ambient; color: ${LIGHTING.ambientColor}; intensity: ${LIGHTING.ambientIntensity}`,
    }, this.el)
    this.hemisphereLight = createEntity('a-entity', {
      light: `type: hemisphere; color: ${LIGHTING.hemisphereColor}; groundColor: ${LIGHTING.hemisphereGroundColor}; intensity: ${LIGHTING.hemisphereIntensity}`,
    }, this.el)
    this.directionalLight = createEntity('a-entity', {
      light: `type: directional; color: ${LIGHTING.directionalColor}; intensity: ${LIGHTING.directionalIntensity}; castShadow: false`,
      position: '-90 180 70',
    }, this.el)
    this.fillLight = createEntity('a-entity', {
      light: `type: directional; color: ${LIGHTING.fillColor}; intensity: ${LIGHTING.fillIntensity}; castShadow: false`,
      position: '120 95 -140',
    }, this.el)

    this.createIceField()
    this.createTerrainProps()
    this.createLightAbsorberCones()
    this.createBoostCrystals()

    this.ship = createEntity('a-entity', {
      id: 'glacies-ship',
      position: '0 1.7 0',
      scale: '4.4 4.4 4.4',
      'lk-ship-model': `color: ${this.shipSkin.accentColor || '#ff8f00'}; shield: false; modelUrl: ${this.shipSkin.modelUrl}`,
    }, this.el)
    this.createShipImpactRing()
    this.createShipLantern()

    this.camera = createEntity('a-entity', {
      id: 'mission-camera',
      camera: `active: true; fov: ${CAMERA.fov}; near: 0.05; far: 1400`,
    }, this.el)
    this.updateShipTransform(0)
    this.updateLanternBeam()
    this.updateCamera(1)
    this.initSharedProjectileResources()
    this.initProjectilePool()
    this.initEnemyProjectilePool()
    this.initPulseEffectPool()
    this.prewarmRenderer()
    this.applyLightPhaseValues(this.lightPhaseCurrent)
  },

  ...terrainArenaMethods,
  ...lightingMethods,
  ...projectileMethods,
  ...enemyMethods,
  ...effectsMethods,
  ...gameplayMethods,

  tick(_time, deltaMs) {
    const dt = Math.min((deltaMs || 16) / 1000, 0.05)
    this.clockTime += dt

    const gp = gamepadService.getPad()
    const gpState = gp ? gamepadService.update(this.keys, gp) : null
    if (gpState?.systemMenuJustPressed) {
      window.dispatchEvent(new CustomEvent('gamepad-system-menu'))
    } else if (gpState?.pauseJustPressed) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }))
    }
    if (gpState?.fireJustPressed) this.fireQueued = true

    if (this.state === GAME_STATES.PAUSED) {
      audioService.stopShipEngine(dt)
      this.updateCamera(dt)
      return
    }
    if (this.state === GAME_STATES.VICTORY_SEQUENCE) {
      this.updateVictorySequence(dt)
      this.updatePulseEffects(dt)
      audioService.stopShipEngine(dt)
      return
    }
    if (this.state !== GAME_STATES.PLAYING) {
      audioService.stopShipEngine(dt)
      this.updateCamera(dt)
      return
    }

    this.updateInput(gpState)
    if (this.fireQueued) this.fireProjectile()
    this.fireQueued = false
    this.updateOverheat(dt)
    this.updateMovement(dt)
    this.updateShipTransform(dt)
    this.updateLightPhase(dt)
    this.updateLanternBeam()
    this.updateDamageFeedback(dt)
    this.updateCamera(dt)
    this.updateTerrain(dt)
    this.updateBoostCrystals(dt)
    this.updateLightAbsorbers(dt)
    this.updateDrones(dt)
    this.updateProjectiles(dt)
    this.updateEnemyProjectiles(dt)
    this.updatePulseEffects(dt)
    this.updateHud(dt)
    audioService.updateShipEngine({
      active: true,
      throttle: Math.max(0.08, Math.abs(this.throttleInput) + (this.boostCooldown > 0.45 ? 0.45 : 0)),
      speedPct: clamp(this.velocity.length() / PHYSICS.maxSpeed, 0, 1),
      dt,
      mode: 'mission',
    })
  },

  remove() {
    gamepadNavService.clear()
    this.victorySequence = null
    window.removeEventListener('keydown', this.onKeyDown, true)
    window.removeEventListener('keyup', this.onKeyUp, true)
    window.removeEventListener('system-menu-toggle', this.onSystemMenuToggle)
    window.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('lantern-brightness-changed', this.onLanternBrightnessChange)
    this.uiHandlers?.forEach(([id, handler]) => document.getElementById(id)?.removeEventListener('click', handler))
    this.hud?.remove()
    window.clearTimeout(this.damageFlashTimer)
    window.clearTimeout(this.victoryTimeout)
    this._timeouts?.forEach((id) => window.clearTimeout(id))
    this._timeouts?.clear()
    this.ephemeralEls.forEach((el) => el.remove())
    this.ephemeralEls = []
    document.getElementById('damageFlash')?.classList.remove('active', 'show')
    this.missionUi?.classList.remove('glacies-mission-ui')
    this.terrainProps.forEach((prop) => prop.remove())
    this.terrainProps = []
    this.boostCrystals.forEach((crystal) => {
      crystal.root.removeObject3D?.('boost-crystal')
      crystal.root.remove()
      crystal.blip?.remove()
    })
    this.boostCrystals = []
    this.towers.forEach((tower) => {
      tower.root.remove()
      tower.hpBar?.root?.remove()
    })
    this.towers = []
    this.drones.forEach((drone) => {
      drone.root.remove()
      drone.hpBar?.root?.remove()
    })
    this.drones = []
    this.droneHaloTexture?.dispose?.()
    this.droneHaloTexture = null
    this.allProjectileEls.forEach((projectile) => {
      projectile.remove()
    })
    this.projectiles = []
    this.projectilePool = []
    this.allProjectileEls = []
    this.enemyProjectilePool.forEach((projectile) => {
      projectile.el.remove()
    })
    this.enemyProjectiles = []
    this.enemyProjectilePool = []
    this.projectileResources?.geometry?.dispose?.()
    this.projectileResources?.material?.dispose?.()
    this.projectileResources = null
    this.enemyProjectileResources?.geometry?.dispose?.()
    this.enemyProjectileResources?.material?.dispose?.()
    this.enemyProjectileResources = null
    if (this.boostCrystalResources) {
      this.boostCrystalResources.shardGeometry?.dispose?.()
      this.boostCrystalResources.shardMaterial?.dispose?.()
      this.boostCrystalResources.coreGeometry?.dispose?.()
      this.boostCrystalResources.coreMaterial?.dispose?.()
      this.boostCrystalResources.ringGeometry?.dispose?.()
      this.boostCrystalResources.ringMaterial?.dispose?.()
      this.boostCrystalResources = null
    }
    this.pulseEffects = []
    this.pulseEffectPool.forEach((effect) => {
      effect.material?.dispose?.()
      if (effect.mesh?.parent) effect.mesh.parent.remove(effect.mesh)
    })
    this.pulseEffectPool = []
    this.pulseEffectGeometry?.dispose?.()
    this.pulseEffectGeometry = null
    this.contactShadows.forEach((shadow) => {
      shadow.geometry?.dispose?.()
      shadow.material?.dispose?.()
      if (shadow.parent) shadow.parent.remove(shadow)
    })
    this.contactShadows = []
    this.contactShadowTexture?.dispose?.()
    this.contactShadowTexture = null
    if (this.iceField) {
      this.iceField.traverse((child) => {
        child.geometry?.dispose?.()
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.())
        else child.material?.dispose?.()
      })
      this.el.removeObject3D('glacies-ice-field')
    }
    this.iceTextures.forEach((texture) => texture.dispose?.())
    this.iceTextures = []
    this.lanternCone?.geometry?.dispose?.()
    this.lanternConeMaterial?.dispose?.()
    this.lanternCone = null
    this.lanternConeMaterial = null
    this.groundPool?.geometry?.dispose?.()
    this.groundPool?.material?.dispose?.()
    this.groundPoolBloom?.geometry?.dispose?.()
    this.groundPoolBloom?.material?.dispose?.()
    this.groundPoolTexture?.dispose?.()
    this.groundPool = null
    this.groundPoolBloom = null
    this.groundPoolTexture = null
    if (this.groundContactLight?.parent) this.groundContactLight.parent.remove(this.groundContactLight)
    this.groundContactLight = null
    this.lanternRig?.remove()
    this.lanternRig = null
    this.shipImpactRing?.geometry?.dispose?.()
    this.shipImpactRing?.material?.dispose?.()
    audioService.stopAll()
  },
})
