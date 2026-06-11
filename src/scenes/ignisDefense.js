import { getPlanet } from '../services/gameState.js'
import { audioService } from '../services/audioService.js'
import { gamepadService } from '../services/gamepadService.js'
import { gamepadNavService } from '../services/gamepadNavService.js'
import { assetUrl } from '../services/assetPaths.js'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const rand = (min, max) => min + Math.random() * (max - min)
const damp = (current, target, speed, dt) => current + (target - current) * (1 - Math.exp(-speed * dt))
const smoothstep = (edge0, edge1, value) => {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - (2 * t))
}

const GAME_STATES = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
  VICTORY: 'VICTORY',
}

const ENEMY_MODEL_URL = assetUrl('models/ships/alien-green-spaceship.glb')
const ENEMY_MODEL_TARGET_SIZE = 2.85
const ENEMY_HIT_RADIUS = 1.45
const BOMB_MODEL_URL = assetUrl('models/objects/Spike Mine.glb')
const BOMB_MODEL_TARGET_SIZE = 2.0
const BOMB_HIT_RADIUS = 1.4
const VOLCANO_MODEL_URL = assetUrl('models/environments/Volcano.glb')
const VOLCANO_TARGET_HEIGHT = 18
const VOLCANO_LAVA_KEY_COLOR = '#ff4e00'
const VOLCANO_LAVA_WARM_COLOR = '#ff6a00'
const VOLCANO_LAVA_HOT_COLOR = '#ffd27a'
const VOLCANO_LAVA_MASK_INNER = 0.1
const VOLCANO_LAVA_MASK_OUTER = 0.32
const IGNIS_SURFACE_Y = -3.25
const IGNIS_ARENA_Z = -19
const IGNIS_FISSURES = [
  { ax: -25, az: -35, bx: -7, bz: -18, width: 2.5, glow: 1.0 },
  { ax: 10, az: -12, bx: 27, bz: -30, width: 2.2, glow: 0.92 },
  { ax: -17, az: -8, bx: 0, bz: -24, width: 1.7, glow: 0.7 },
  { ax: -4, az: -44, bx: 14, bz: -57, width: 2.8, glow: 0.82 },
  { ax: -28, az: -53, bx: -11, bz: -42, width: 2.1, glow: 0.78 },
]
const IGNIS_VENTS = [
  { x: -18, z: -39, radius: 2.4, height: 2.5, glow: 0.78 },
  { x: -11, z: -12, radius: 1.9, height: 1.8, glow: 0.56 },
  { x: 16, z: -45, radius: 3.0, height: 2.9, glow: 0.88 },
  { x: 9, z: -12, radius: 2.1, height: 2.0, glow: 0.62 },
  { x: -25, z: -24, radius: 2.8, height: 2.4, glow: 0.74 },
  { x: 23, z: -33, radius: 2.5, height: 2.2, glow: 0.68 },
]
const IGNIS_HORIZON_MESAS = [
  { x: -29, z: -58, width: 11, height: 6.4, depth: 9, rotation: -12 },
  { x: -10, z: -63, width: 16, height: 8.1, depth: 12, rotation: 9 },
  { x: 15, z: -59, width: 14, height: 7.2, depth: 10, rotation: -6 },
  { x: 33, z: -54, width: 10, height: 5.6, depth: 8, rotation: 14 },
]
const AIM_X_LIMIT = 30
const AIM_Y_MIN = 0.5
const AIM_Y_MAX = 22
const AIM_Z = -48
const WAVE_CONFIG = [
  { columns: 5, rows: 2, speed: 2.2, bombSpeed: 7.5, dropMin: 5.2, dropMax: 8.2, dropChance: 0.42, maxBombs: 2, health: 1 },
  { columns: 6, rows: 2, speed: 2.7, bombSpeed: 8.4, dropMin: 4.7, dropMax: 7.6, dropChance: 0.46, maxBombs: 2, health: 1 },
  { columns: 6, rows: 3, speed: 3.0, bombSpeed: 9.2, dropMin: 4.2, dropMax: 7.0, dropChance: 0.5, maxBombs: 3, health: 1 },
  { columns: 7, rows: 3, speed: 3.4, bombSpeed: 10.2, dropMin: 3.8, dropMax: 6.5, dropChance: 0.54, maxBombs: 3, health: 2 },
]

function createDropDelay(config, column = 0, row = 0) {
  const laneOffset = ((column * 0.37) + (row * 0.73)) % 2.1
  return rand(config.dropMin, config.dropMax) + laneOffset + Math.random() * Math.random() * 2.4
}

function createEntity(tag, attrs = {}, parent) {
  const el = document.createElement(tag)
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value))
  if (parent) parent.appendChild(el)
  return el
}

function distanceToSegment2D(px, pz, ax, az, bx, bz) {
  const dx = bx - ax
  const dz = bz - az
  const lengthSq = (dx * dx) + (dz * dz)
  if (!lengthSq) return Math.hypot(px - ax, pz - az)
  const t = clamp((((px - ax) * dx) + ((pz - az) * dz)) / lengthSq, 0, 1)
  const closestX = ax + (dx * t)
  const closestZ = az + (dz * t)
  return Math.hypot(px - closestX, pz - closestZ)
}

function sampleIgnisHeat(x, z) {
  const fissureHeat = IGNIS_FISSURES.reduce((maxHeat, fissure) => {
    const distance = distanceToSegment2D(x, z, fissure.ax, fissure.az, fissure.bx, fissure.bz)
    const heat = 1 - smoothstep(fissure.width * 0.4, fissure.width * 1.85, distance)
    return Math.max(maxHeat, heat * fissure.glow)
  }, 0)

  const ventHeat = IGNIS_VENTS.reduce((maxHeat, vent) => {
    const distance = Math.hypot(x - vent.x, z - vent.z)
    const heat = 1 - smoothstep(vent.radius * 0.3, vent.radius * 1.55, distance)
    return Math.max(maxHeat, heat * vent.glow)
  }, 0)

  return Math.max(fissureHeat, ventHeat)
}

function sampleIgnisTerrainHeight(x, z) {
  const localZ = z - IGNIS_ARENA_Z
  const radial = Math.hypot(x * 0.9, localZ * 0.72)
  const basin = -1.08 * Math.exp(-(radial * radial) / 230)
  const shieldShelf = 0.52 * Math.exp(-(((radial - 10.4) ** 2) / 26))
  const backWall = 2.25 * Math.exp(-(((z + 55) ** 2) / 70))
  const frontRise = 1.12 * Math.exp(-(((z - 5) ** 2) / 90))
  const sideWalls = 0.82 * Math.exp(-(((Math.abs(x) - 24) ** 2) / 20))
  const undulation = (
    (Math.sin((x * 0.26) + (z * 0.14)) * 0.26) +
    (Math.sin((x * 0.56) - (z * 0.32)) * 0.14) +
    (Math.cos((z * 0.44) + (x * 0.09)) * 0.08)
  )
  const lavaCut = sampleIgnisHeat(x, z) * -0.58
  return clamp(basin + shieldShelf + backWall + frontRise + sideWalls + undulation + lavaCut, -1.85, 2.9)
}

function setText(id, value) {
  const el = document.getElementById(id)
  if (el) el.textContent = value
}

function setFirstLabel(containerSelector, value) {
  const label = document.querySelector(`${containerSelector} .hud-label`)
  if (label) label.textContent = value
}

AFRAME.registerComponent('ignis-defense', {
  schema: {
    planetIndex: { type: 'int', default: 1 },
    autoStart: { type: 'boolean', default: false },
  },

  init() {
    this.THREE = AFRAME.THREE
    this.planet = getPlanet(this.data.planetIndex)
    this.keys = {}
    this.state = GAME_STATES.MENU
    this.clockTime = 0
    this.score = 0
    this.lives = 3
    this.waveIndex = 0
    this.waveTotalEnemies = 1
    this.waveClearTimer = 0
    this.enemyDirection = 1
    this.edgeCooldown = 0
    this.lastFireTime = 0
    this.fireRate = 0.16
    this.fireHeld = false
    this.heat = 0
    this.overheated = false
    this.overheatTimer = 0
    this.heatChargeRate = 0.25
    this.heatCooldownRate = 0.18
    this.overheatCooldown = 1.5
    this.isFiring = false
    this.aimTarget = { x: 0, y: 8.8 }
    this.aim = { x: 0, y: 8.8 }
    this.systemMenuOpen = false
    this.systemPausedState = null
    this.ended = false
    this._hudCache = {}
    this._timeouts = new Set()
    this.volcanoShaderStates = []
    this.volcanoShaderMaterials = []
    this.surfacePulseElements = []
    this.ashPlumes = []
    this.embers = []
    this.ignisTerrain = null

    this.enemies = []
    this.bombs = []
    this.bullets = []
    this.particles = []

    this.onKeyDown = (event) => {
      this.keys[event.key.toLowerCase()] = true
      this.keys[event.code.toLowerCase()] = true
      if (event.code === 'Space') {
        event.preventDefault()
        this.fireHeld = true
      }
      if (event.key === 'p' || event.key === 'P') this.togglePause()
    }
    this.onKeyUp = (event) => {
      this.keys[event.key.toLowerCase()] = false
      this.keys[event.code.toLowerCase()] = false
      if (event.code === 'Space') this.fireHeld = false
    }
    this.onSystemMenuToggle = (event) => {
      this.systemMenuOpen = !!event.detail.open
      if (this.systemMenuOpen) {
        Object.keys(this.keys).forEach((key) => {
          this.keys[key] = false
        })
        this.fireHeld = false
        this.isFiring = false
        if (this.state === GAME_STATES.PLAYING) {
          this.systemPausedState = this.state
          this.state = GAME_STATES.PAUSED
        }
      } else if (this.state === GAME_STATES.PAUSED && this.systemPausedState) {
        this.state = this.systemPausedState
        this.systemPausedState = null
      }
    }

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('system-menu-toggle', this.onSystemMenuToggle)

    this.bindUi()
    this.setupMissionUi()
    this.setupMobileControls()
    this.buildScene()
    this.activateCamera()
    this.hideAllMenus()
    this.resetGame()
    audioService.stopShipEngine()
    audioService.stopMusic()
    if (this.data.autoStart) this.startGame()
    else this.resetUi()
  },

  bindUi() {
    this.uiHandlers = [
      ['startButton', () => this.startGame()],
      ['startBackButton', () => window.dispatchEvent(new CustomEvent('return-map'))],
      ['resumeButton', () => this.togglePause()],
      ['restartButton', () => this.restartGame()],
      ['quitButton', () => this.quitToMap()],
      ['retryButton', () => this.restartGame()],
      ['gameOverMapButton', () => window.dispatchEvent(new CustomEvent('return-map'))],
      ['mainMenuButton', () => window.dispatchEvent(new CustomEvent('return-main-menu'))],
      ['victoryRetryButton', () => this.restartGame()],
      ['victoryMapButton', () => window.dispatchEvent(new CustomEvent('return-map'))],
    ]
    this.uiHandlers.forEach(([id, handler]) => document.getElementById(id)?.addEventListener('click', handler))
  },

  setupMissionUi() {
    const missionUi = document.getElementById('mission-ui')
    missionUi?.classList.add('ignis-defense-ui')

    this.savedLabels = [
      [document.querySelector('#hud-top-left .hud-label'), document.querySelector('#hud-top-left .hud-label')?.textContent],
      [document.querySelector('#hud-top-right .hud-label'), document.querySelector('#hud-top-right .hud-label')?.textContent],
      [document.querySelector('#hud-bottom .hud-label'), document.querySelector('#hud-bottom .hud-label')?.textContent],
    ]

    setFirstLabel('#hud-top-left', 'Skóre')
    setFirstLabel('#hud-top-right', 'Štít')
    setFirstLabel('#hud-bottom', 'Vlna')
    setText('mapName', 'Orbitalni obrana')
    document.getElementById('boss-hud')?.classList.remove('active', 'show')
  },

  restoreMissionUi() {
    document.getElementById('mission-ui')?.classList.remove('ignis-defense-ui')
    this.savedLabels?.forEach(([el, value]) => {
      if (el && value) el.textContent = value
    })
  },

  setupMobileControls() {
    const base = document.getElementById('missionJoystickBase')
    const knob = document.getElementById('missionJoystickKnob')
    const fireButton = document.getElementById('fireButton')
    if (!base || !knob || !fireButton) return

    let active = false
    let touchId = null

    const releaseJoystick = () => {
      active = false
      touchId = null
      knob.style.transform = 'translate(-50%, -50%)'
      ;['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].forEach((key) => {
        this.keys[key] = false
      })
    }

    const handleJoystick = (clientX, clientY) => {
      const rect = base.getBoundingClientRect()
      const dx = clientX - (rect.left + rect.width / 2)
      const dy = clientY - (rect.top + rect.height / 2)
      const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 50)
      const angle = Math.atan2(dy, dx)
      knob.style.transform = `translate(${Math.cos(angle) * dist - 25}px, ${Math.sin(angle) * dist - 25}px)`
      this.keys.arrowleft = dx < -15
      this.keys.arrowright = dx > 15
      this.keys.arrowup = dy < -15
      this.keys.arrowdown = dy > 15
    }

    this.mobileHandlers = {
      touchstart: (event) => {
        event.preventDefault()
        active = true
        touchId = event.touches[0].identifier
        handleJoystick(event.touches[0].clientX, event.touches[0].clientY)
      },
      touchmove: (event) => {
        if (!active) return
        event.preventDefault()
        for (const touch of event.touches) {
          if (touch.identifier === touchId) {
            handleJoystick(touch.clientX, touch.clientY)
            break
          }
        }
      },
      touchend: releaseJoystick,
      touchcancel: releaseJoystick,
      firestart: (event) => {
        event.preventDefault()
        this.isFiring = true
      },
      fireend: (event) => {
        event.preventDefault()
        this.isFiring = false
      },
    }

    base.addEventListener('touchstart', this.mobileHandlers.touchstart, { passive: false })
    window.addEventListener('touchmove', this.mobileHandlers.touchmove, { passive: false })
    window.addEventListener('touchend', this.mobileHandlers.touchend)
    window.addEventListener('touchcancel', this.mobileHandlers.touchcancel)
    fireButton.addEventListener('touchstart', this.mobileHandlers.firestart, { passive: false })
    fireButton.addEventListener('touchend', this.mobileHandlers.fireend)
    fireButton.addEventListener('touchcancel', this.mobileHandlers.fireend)
  },

  buildScene() {
    this.el.sceneEl.setAttribute('background', 'color: #050206')
    this.el.sceneEl.setAttribute('fog', 'type: linear; color: #2c0907; near: 30; far: 138')

    createEntity('a-entity', {
      light: 'type: ambient; color: #3a1418; intensity: 0.82',
    }, this.el)
    createEntity('a-entity', {
      light: 'type: directional; color: #ffd9b6; intensity: 0.92',
      position: '-10 19 10',
    }, this.el)
    createEntity('a-entity', {
      light: 'type: point; color: #ff6a1a; intensity: 5.6; distance: 36',
      position: '0 -2 3.5',
    }, this.el)

    this.camera = createEntity('a-entity', {
      id: 'mission-camera',
      camera: 'active: true; fov: 70; near: 0.1; far: 1000',
      position: '0 2.4 16',
      rotation: '-8 0 0',
    }, this.el)

    this.createStarfield()
    this.createIgnisSurface()
    this.createTurret()
    this.createReticle()
  },

  activateCamera() {
    requestAnimationFrame(() => {
      document.querySelectorAll('a-entity[camera]').forEach((cameraEntity) => {
        cameraEntity.setAttribute('camera', 'active: false')
      })
      this.camera?.setAttribute('camera', 'active: true; fov: 70; near: 0.1; far: 1000')
    })
  },

  createStarfield() {
    const T = this.THREE
    const count = 520
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3
      positions[i3] = rand(-80, 80)
      positions[i3 + 1] = rand(2, 50)
      positions[i3 + 2] = rand(-130, -24)
      const hot = Math.random() > 0.78
      colors[i3] = hot ? 1 : rand(0.55, 1)
      colors[i3 + 1] = hot ? rand(0.25, 0.55) : rand(0.55, 1)
      colors[i3 + 2] = hot ? rand(0.08, 0.2) : rand(0.7, 1)
    }

    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3))
    const material = new T.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      sizeAttenuation: true,
    })

    this.starfield = new T.Points(geometry, material)
    this.el.setObject3D('ignis-stars', this.starfield)
  },

  registerSurfacePulse(entity, {
    emissiveIntensity = 1,
    opacity = null,
    speed = 3,
    phase = Math.random() * Math.PI * 2,
    scaleAmp = 0,
  } = {}) {
    this.surfacePulseElements.push({
      entity,
      baseEmissiveIntensity: emissiveIntensity,
      baseOpacity: opacity,
      speed,
      phase,
      scaleAmp,
      baseScale: entity.object3D.scale.clone(),
    })
  },

  createTerrainMesh() {
    const T = this.THREE
    const geometry = new T.PlaneGeometry(66, 86, 72, 96)
    geometry.rotateX(-Math.PI / 2)

    const position = geometry.attributes.position
    const colors = new Float32Array(position.count * 3)
    const shadowColor = new T.Color('#170809')
    const ashColor = new T.Color('#341713')
    const ridgeColor = new T.Color('#67311e')
    const emberColor = new T.Color('#ff6a1a')
    const terrainColor = new T.Color()

    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i)
      const z = position.getZ(i) - 18
      const height = sampleIgnisTerrainHeight(x, z)
      const heat = sampleIgnisHeat(x, z)
      const ridgeMask = smoothstep(-0.4, 1.6, height)
      const warmMask = clamp(0.22 + (ridgeMask * 0.62), 0, 1)

      terrainColor.copy(shadowColor).lerp(ashColor, warmMask)
      terrainColor.lerp(ridgeColor, ridgeMask * 0.55)
      terrainColor.lerp(emberColor, heat * 0.34)

      const i3 = i * 3
      colors[i3] = terrainColor.r
      colors[i3 + 1] = terrainColor.g
      colors[i3 + 2] = terrainColor.b

      position.setXYZ(i, x, IGNIS_SURFACE_Y + height, z)
    }

    geometry.setAttribute('color', new T.BufferAttribute(colors, 3))
    position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()

    const material = new T.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.98,
      metalness: 0.04,
      emissive: '#1a0806',
      emissiveIntensity: 0.28,
    })

    this.ignisTerrain = new T.Mesh(geometry, material)
    this.ignisTerrain.receiveShadow = true
    this.el.setObject3D('ignis-terrain', this.ignisTerrain)
  },

  createFissureBand(fissure, index) {
    const dx = fissure.bx - fissure.ax
    const dz = fissure.bz - fissure.az
    const length = Math.hypot(dx, dz)
    const yaw = Math.atan2(dx, dz) * (180 / Math.PI)
    const segments = Math.max(4, Math.round(length / 4))

    for (let i = 0; i < segments; i += 1) {
      const t = (i + 0.5) / segments
      const wobble = Math.sin((t * Math.PI * 2) + (index * 0.9))
      const x = fissure.ax + (dx * t) + (wobble * fissure.width * 0.18)
      const z = fissure.az + (dz * t) + (Math.cos((t * Math.PI * 1.7) + index) * fissure.width * 0.18)
      const groundY = IGNIS_SURFACE_Y + sampleIgnisTerrainHeight(x, z)
      const segmentDepth = (length / segments) + 0.65

      createEntity('a-box', {
        position: `${x} ${groundY + 0.08} ${z}`,
        rotation: `0 ${yaw} 0`,
        width: `${fissure.width * 1.78}`,
        height: '0.16',
        depth: `${segmentDepth}`,
        material: 'color: #160707; roughness: 1; metalness: 0.02',
      }, this.el)

      const glowStrip = createEntity('a-box', {
        position: `${x} ${groundY + 0.15} ${z}`,
        rotation: `0 ${yaw} 0`,
        width: `${fissure.width * 0.72}`,
        height: '0.05',
        depth: `${segmentDepth * 0.94}`,
        material: `color: #ff6b1a; emissive: #ff3300; emissiveIntensity: ${1.08 + (fissure.glow * 0.52)}; transparent: true; opacity: ${0.56 + (fissure.glow * 0.2)}; shader: flat`,
      }, this.el)
      this.registerSurfacePulse(glowStrip, {
        emissiveIntensity: 1.08 + (fissure.glow * 0.52),
        opacity: 0.56 + (fissure.glow * 0.2),
        speed: 4 + (index * 0.35),
        phase: (t * 4.8) + index,
        scaleAmp: 0.03,
      })
    }
  },

  createVentCluster(vent, index) {
    const groundY = IGNIS_SURFACE_Y + sampleIgnisTerrainHeight(vent.x, vent.z)
    createEntity('a-cylinder', {
      position: `${vent.x} ${groundY + 0.16} ${vent.z}`,
      radius: `${vent.radius * 1.08}`,
      height: '0.34',
      material: 'color: #1a0908; roughness: 1; metalness: 0.02',
    }, this.el)
    createEntity('a-cone', {
      position: `${vent.x} ${groundY + (vent.height * 0.44)} ${vent.z}`,
      radiusBottom: `${vent.radius}`,
      radiusTop: `${vent.radius * 0.3}`,
      height: `${vent.height}`,
      material: 'color: #220b0b; roughness: 1',
    }, this.el)

    const ventRing = createEntity('a-ring', {
      position: `${vent.x} ${groundY + (vent.height * 0.84)} ${vent.z}`,
      rotation: '-90 0 0',
      geometry: `primitive: ring; radiusInner: ${vent.radius * 0.26}; radiusOuter: ${vent.radius * 0.48}; segmentsTheta: 40`,
      material: `color: #ff6b1a; emissive: #ff3300; emissiveIntensity: ${1 + (vent.glow * 0.45)}; transparent: true; opacity: ${0.58 + (vent.glow * 0.18)}; shader: flat`,
    }, this.el)
    this.registerSurfacePulse(ventRing, {
      emissiveIntensity: 1 + (vent.glow * 0.45),
      opacity: 0.58 + (vent.glow * 0.18),
      speed: 3.4 + (index * 0.28),
      phase: index * 0.7,
      scaleAmp: 0.04,
    })

    const ventCore = createEntity('a-sphere', {
      radius: `${vent.radius * 0.16}`,
      position: `${vent.x} ${groundY + (vent.height * 0.86)} ${vent.z}`,
      material: `color: #ffd27a; emissive: #ff8f00; emissiveIntensity: ${1.2 + (vent.glow * 0.35)}; transparent: true; opacity: 0.82; shader: flat; depthWrite: false`,
    }, this.el)
    this.registerSurfacePulse(ventCore, {
      emissiveIntensity: 1.2 + (vent.glow * 0.35),
      opacity: 0.82,
      speed: 4.6 + (index * 0.24),
      phase: index * 0.9,
      scaleAmp: 0.18,
    })

    for (let i = 0; i < 3; i += 1) {
      const angle = (((Math.PI * 2) / 3) * i) + (index * 0.4)
      const distance = vent.radius * (0.75 + (i * 0.16))
      const shardX = vent.x + (Math.cos(angle) * distance)
      const shardZ = vent.z + (Math.sin(angle) * distance)
      const shardGroundY = IGNIS_SURFACE_Y + sampleIgnisTerrainHeight(shardX, shardZ)
      const shardHeight = 1.2 + (i * 0.32)
      createEntity('a-box', {
        position: `${shardX} ${shardGroundY + (shardHeight * 0.46)} ${shardZ}`,
        rotation: `${-8 + (i * 5)} ${(angle * 180 / Math.PI) + 40} ${7 - (i * 6)}`,
        width: `${0.62 + (i * 0.12)}`,
        height: `${shardHeight}`,
        depth: `${0.74 + (i * 0.16)}`,
        material: 'color: #160707; roughness: 1; metalness: 0.03',
      }, this.el)
    }
  },

  createBasaltOutcrops() {
    IGNIS_HORIZON_MESAS.forEach((mesa, index) => {
      const groundY = IGNIS_SURFACE_Y + sampleIgnisTerrainHeight(mesa.x, mesa.z)
      const root = createEntity('a-entity', {
        position: `${mesa.x} ${groundY + (mesa.height * 0.48)} ${mesa.z}`,
        rotation: `0 ${mesa.rotation} 0`,
      }, this.el)

      createEntity('a-box', {
        width: `${mesa.width}`,
        height: `${mesa.height}`,
        depth: `${mesa.depth}`,
        material: 'color: #180708; roughness: 1; metalness: 0.02',
      }, root)
      createEntity('a-box', {
        position: `0 ${mesa.height * 0.28} -0.3`,
        width: `${mesa.width * 0.72}`,
        height: `${mesa.height * 0.46}`,
        depth: `${mesa.depth * 0.84}`,
        material: 'color: #2a120f; roughness: 0.95; metalness: 0.04',
      }, root)

      const mesaGlow = createEntity('a-box', {
        position: `0 ${-mesa.height * 0.08} ${-mesa.depth * 0.05}`,
        width: `${mesa.width * 0.5}`,
        height: '0.18',
        depth: `${mesa.depth * 0.45}`,
        material: 'color: #ff5317; emissive: #ff2f00; emissiveIntensity: 0.9; transparent: true; opacity: 0.34; shader: flat',
      }, root)
      this.registerSurfacePulse(mesaGlow, {
        emissiveIntensity: 0.9,
        opacity: 0.34,
        speed: 2.8 + (index * 0.22),
        phase: index,
      })
    })

    for (let i = 0; i < 8; i += 1) {
      const side = i % 2 === 0 ? -1 : 1
      const band = Math.floor(i / 2)
      const x = side * (14.5 + (band * 4.9) + ((i % 3) * 0.9))
      const z = -10 - (band * 11.2) - ((i % 2) * 2.4)
      const width = 1.8 + (band * 0.5)
      const height = 2.4 + (band * 0.7) + (((i + 1) % 3) * 0.3)
      const depth = 1.7 + (band * 0.45)
      const groundY = IGNIS_SURFACE_Y + sampleIgnisTerrainHeight(x, z)
      createEntity('a-box', {
        position: `${x} ${groundY + (height * 0.46)} ${z}`,
        rotation: `${-10 + (band * 3)} ${side * (20 + (band * 7))} ${side * (8 - band)}`,
        width: `${width}`,
        height: `${height}`,
        depth: `${depth}`,
        material: 'color: #140607; roughness: 1; metalness: 0.03',
      }, this.el)
    }
  },

  createAshAtmosphere() {
    const plumeSources = [
      ...IGNIS_VENTS.map((vent, index) => ({
        x: vent.x,
        z: vent.z,
        height: 0.8 + (vent.height * 0.35),
        baseScale: 0.82 + ((index % 3) * 0.18),
        maxOpacity: 0.075 + ((index % 2) * 0.014),
      })),
      ...IGNIS_FISSURES.slice(0, 3).map((fissure, index) => ({
        x: (fissure.ax + fissure.bx) * 0.5,
        z: (fissure.az + fissure.bz) * 0.5,
        height: 0.95 + (index * 0.22),
        baseScale: 0.74 + (index * 0.14),
        maxOpacity: 0.062 + (index * 0.008),
      })),
    ]

    plumeSources.forEach((source, index) => {
      const groundY = IGNIS_SURFACE_Y + sampleIgnisTerrainHeight(source.x, source.z)
      const plume = createEntity('a-sphere', {
        radius: `${0.72 + ((index % 3) * 0.18)}`,
        position: `${source.x} ${groundY + source.height} ${source.z}`,
        material: 'color: #541910; emissive: #2a0906; emissiveIntensity: 0.12; transparent: true; opacity: 0.08; shader: flat; depthWrite: false',
      }, this.el)
      this.ashPlumes.push({
        el: plume,
        baseX: source.x,
        baseY: groundY + source.height,
        baseZ: source.z,
        driftX: 0.38 + ((index % 3) * 0.14),
        driftZ: 0.26 + ((index % 2) * 0.08),
        lift: 1.8 + ((index % 4) * 0.38),
        speed: 0.09 + ((index % 5) * 0.018),
        phase: index / plumeSources.length,
        baseScale: source.baseScale,
        maxOpacity: source.maxOpacity,
      })
    })

    for (let i = 0; i < 20; i += 1) {
      const fissure = IGNIS_FISSURES[i % IGNIS_FISSURES.length]
      const t = (i * 0.61803398875) % 1
      const x = fissure.ax + ((fissure.bx - fissure.ax) * t) + (Math.sin(i * 1.7) * fissure.width * 0.35)
      const z = fissure.az + ((fissure.bz - fissure.az) * t) + (Math.cos(i * 1.3) * fissure.width * 0.4)
      const groundY = IGNIS_SURFACE_Y + sampleIgnisTerrainHeight(x, z)
      const ember = createEntity('a-sphere', {
        radius: `${0.07 + ((i % 3) * 0.015)}`,
        position: `${x} ${groundY + 0.34} ${z}`,
        material: 'color: #ffd17a; emissive: #ff6a1a; emissiveIntensity: 1.45; transparent: true; opacity: 0.72; shader: flat; depthWrite: false',
      }, this.el)
      this.embers.push({
        el: ember,
        originX: x,
        originY: groundY + 0.24,
        originZ: z,
        lift: 1.9 + ((i % 4) * 0.42),
        driftX: 0.35 + ((i % 3) * 0.18),
        driftZ: 0.22 + ((i % 2) * 0.14),
        speed: 0.19 + ((i % 5) * 0.03),
        phase: i / 20,
        baseOpacity: 0.72,
        baseEmissive: 1.45,
        baseScale: 1 + ((i % 3) * 0.15),
      })
    }
  },

  updateSurfaceAtmosphere() {
    this.surfacePulseElements.forEach((pulse) => {
      const wave = 0.5 + (0.5 * Math.sin((this.clockTime * pulse.speed) + pulse.phase))
      const mesh = pulse.entity.getObject3D('mesh')
      const materials = mesh?.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []
      materials.forEach((material) => {
        if (Number.isFinite(pulse.baseOpacity) && 'opacity' in material) {
          material.opacity = clamp(pulse.baseOpacity * (0.84 + (wave * 0.32)), 0.04, 1)
        }
        if ('emissiveIntensity' in material) {
          material.emissiveIntensity = pulse.baseEmissiveIntensity * (0.82 + (wave * 0.5))
        }
      })
      if (pulse.scaleAmp > 0) {
        const scale = 1 + ((wave - 0.5) * pulse.scaleAmp)
        pulse.entity.object3D.scale.set(
          pulse.baseScale.x * scale,
          pulse.baseScale.y * scale,
          pulse.baseScale.z * scale,
        )
      }
    })

    this.ashPlumes.forEach((plume) => {
      const cycle = ((this.clockTime * plume.speed) + plume.phase) % 1
      const driftWave = Math.sin((this.clockTime * 0.75) + (plume.phase * Math.PI * 2))
      plume.el.object3D.position.set(
        plume.baseX + (driftWave * plume.driftX * 0.35),
        plume.baseY + (cycle * plume.lift),
        plume.baseZ + (Math.cos((this.clockTime * 0.58) + (plume.phase * 7)) * plume.driftZ * 0.4),
      )
      const opacity = Math.sin(cycle * Math.PI) * plume.maxOpacity
      const material = plume.el.getObject3D('mesh')?.material
      if (material) material.opacity = opacity
      const scale = plume.baseScale * (0.72 + (cycle * 0.95))
      plume.el.object3D.scale.set(scale * 1.12, scale * 0.72, scale * 1.12)
    })

    this.embers.forEach((ember) => {
      const cycle = ((this.clockTime * ember.speed) + ember.phase) % 1
      const glow = Math.sin(cycle * Math.PI)
      ember.el.object3D.position.set(
        ember.originX + (Math.sin((this.clockTime * 2.5) + (ember.phase * 8)) * ember.driftX * 0.35),
        ember.originY + (cycle * ember.lift),
        ember.originZ + (Math.cos((this.clockTime * 1.9) + (ember.phase * 6)) * ember.driftZ * 0.28),
      )
      const material = ember.el.getObject3D('mesh')?.material
      if (material) {
        material.opacity = ember.baseOpacity * (0.38 + (glow * 0.62))
        material.emissiveIntensity = ember.baseEmissive * (0.8 + (glow * 0.72))
      }
      const scale = ember.baseScale * (0.82 + (glow * 0.42))
      ember.el.object3D.scale.setScalar(scale)
    })
  },

  createIgnisSurface() {
    this.createTerrainMesh()

    createEntity('a-cylinder', {
      position: `0 ${IGNIS_SURFACE_Y + 0.34} ${IGNIS_ARENA_Z}`,
      radius: '12.2',
      height: '0.34',
      material: 'color: #24100f; roughness: 0.95; metalness: 0.06',
    }, this.el)
    createEntity('a-ring', {
      position: `0 ${IGNIS_SURFACE_Y + 0.39} ${IGNIS_ARENA_Z}`,
      rotation: '-90 0 0',
      geometry: 'primitive: ring; radiusInner: 10.7; radiusOuter: 11.25; segmentsTheta: 96',
      material: 'color: #3a140f; emissive: #220806; emissiveIntensity: 0.42; transparent: true; opacity: 0.94; shader: flat',
    }, this.el)

    this.impactRing = createEntity('a-ring', {
      position: `0 ${IGNIS_SURFACE_Y + 0.27} -24`,
      rotation: '-90 0 0',
      geometry: 'primitive: ring; radiusInner: 13.2; radiusOuter: 13.75; segmentsTheta: 96',
      material: 'color: #ff6b1a; emissive: #ff3300; emissiveIntensity: 1.4; transparent: true; opacity: 0.76; shader: flat',
    }, this.el)
    this.registerSurfacePulse(this.impactRing, {
      emissiveIntensity: 1.4,
      opacity: 0.76,
      speed: 4.2,
      phase: 0.6,
      scaleAmp: 0.02,
    })

    this.shieldRing = createEntity('a-ring', {
      position: `0 ${IGNIS_SURFACE_Y + 0.53} ${IGNIS_ARENA_Z}`,
      rotation: '-90 0 0',
      geometry: 'primitive: ring; radiusInner: 8.6; radiusOuter: 8.95; segmentsTheta: 96',
      material: 'color: #ffd166; emissive: #ff8f00; emissiveIntensity: 1.5; transparent: true; opacity: 0.34; shader: flat',
    }, this.el)
    this.registerSurfacePulse(this.shieldRing, {
      emissiveIntensity: 1.5,
      opacity: 0.34,
      speed: 3.4,
      phase: 1.4,
      scaleAmp: 0.015,
    })

    for (let i = 0; i < 6; i += 1) {
      const angle = (((Math.PI * 2) / 6) * i) + 0.22
      const radius = 11.4
      const x = Math.cos(angle) * radius
      const z = IGNIS_ARENA_Z + (Math.sin(angle) * radius)
      const groundY = IGNIS_SURFACE_Y + sampleIgnisTerrainHeight(x, z)
      createEntity('a-box', {
        position: `${x} ${groundY + 0.74} ${z}`,
        rotation: `${-6 + ((i % 3) * 4)} ${(-angle * 180 / Math.PI) + 90} ${6 - ((i % 2) * 10)}`,
        width: '1.1',
        height: '1.6',
        depth: '1.2',
        material: 'color: #1d0a0a; roughness: 0.98; metalness: 0.05',
      }, this.el)
    }

    IGNIS_FISSURES.forEach((fissure, index) => this.createFissureBand(fissure, index))
    IGNIS_VENTS.forEach((vent, index) => this.createVentCluster(vent, index))
    this.createBasaltOutcrops()
    this.createAshAtmosphere()

    const volcanoRoot = createEntity('a-entity', {
      position: '20 -3.24 -13.8',
      rotation: '0 -45 0',
    }, this.el)
    const volcano = createEntity('a-entity', {
      'gltf-model': `url(${VOLCANO_MODEL_URL})`,
    }, volcanoRoot)
    volcano.addEventListener('model-loaded', (event) => this.fitVolcanoModel(volcano, event.detail.model), { once: true })
  },

  createTurret() {
    this.turretRoot = createEntity('a-entity', {
      position: '0 -2.3 5.8',
    }, this.el)
    createEntity('a-cylinder', {
      radius: '1.35',
      height: '0.55',
      position: '0 -0.28 0',
      material: 'color: #251a18; metalness: 0.35; roughness: 0.42',
    }, this.turretRoot)
    createEntity('a-cylinder', {
      radius: '0.86',
      height: '0.72',
      position: '0 0.06 0',
      material: 'color: #4b2b22; metalness: 0.46; roughness: 0.34',
    }, this.turretRoot)

    this.turretYaw = createEntity('a-entity', {
      position: '0 0.46 0',
    }, this.turretRoot)
    createEntity('a-box', {
      position: '0 0 0',
      width: '1.35',
      height: '0.48',
      depth: '1',
      material: 'color: #38211d; metalness: 0.5; roughness: 0.32',
    }, this.turretYaw)

    this.barrelPivot = createEntity('a-entity', {
      position: '0 0.14 -0.28',
    }, this.turretYaw)
    createEntity('a-box', {
      position: '0 0 -1.36',
      width: '0.28',
      height: '0.28',
      depth: '2.72',
      material: 'color: #ff8f2a; emissive: #ff3b00; emissiveIntensity: 0.22; metalness: 0.5; roughness: 0.24',
    }, this.barrelPivot)
    createEntity('a-cylinder', {
      radius: '0.21',
      height: '0.2',
      position: '0 0 -2.78',
      rotation: '90 0 0',
      material: 'color: #fff1a0; emissive: #ff8f00; emissiveIntensity: 1.6; shader: flat',
      visible: 'false',
    }, this.barrelPivot)
    this.muzzleCap = this.barrelPivot.querySelector ? this.barrelPivot.querySelector('[geometry]') : null
    this.muzzle = createEntity('a-entity', {
      position: '0 0 -2.92',
    }, this.barrelPivot)

    // muzzle glow for firing / overheat visual
    this.muzzleGlow = createEntity('a-sphere', {
      position: '0 0.02 -0.12',
      radius: '0.28',
      material: 'color: #ffd166; emissive: #ff8f00; emissiveIntensity: 1.8; transparent: true; opacity: 0.98; shader: flat',
      visible: 'true',
    }, this.muzzle)

    // small point light at muzzle for stronger visual feedback
    this.muzzleLight = createEntity('a-entity', {
      light: 'type: point; color: #ff8f00; intensity: 0.6; distance: 8',
      position: '0 0 0',
    }, this.muzzle)

    this.turretLight = createEntity('a-entity', {
      light: 'type: point; color: #ff8f00; intensity: 2.2; distance: 12',
      position: '0 0.35 -2.6',
    }, this.barrelPivot)
  },

  createReticle() {
    this.reticle = createEntity('a-entity', {
      position: `0 8.8 ${AIM_Z}`,
    }, this.el)
    createEntity('a-entity', {
      geometry: 'primitive: ring; radiusInner: 0.54; radiusOuter: 0.65; segmentsTheta: 48',
      material: 'color: #ffd166; emissive: #ff8f00; emissiveIntensity: 1.5; transparent: true; opacity: 0.9; shader: flat; depthTest: false; depthWrite: false',
    }, this.reticle)
    ;[
      ['0.94 0 0', '0.34 0.035 0.02'],
      ['-0.94 0 0', '0.34 0.035 0.02'],
      ['0 0.94 0', '0.035 0.34 0.02'],
      ['0 -0.94 0', '0.035 0.34 0.02'],
    ].forEach(([position, size]) => {
      const [width, height, depth] = size.split(' ')
      createEntity('a-box', {
        position,
        width,
        height,
        depth,
        material: 'color: #ffd166; emissive: #ff8f00; emissiveIntensity: 1.4; transparent: true; opacity: 0.86; shader: flat; depthTest: false; depthWrite: false',
      }, this.reticle)
    })
  },

  resetUi() {
    ;['pauseMenu', 'gameOverMenu', 'victoryMenu'].forEach((id) => document.getElementById(id)?.classList.add('hidden'))
    document.getElementById('startMenu')?.classList.remove('hidden')
  },

  hideAllMenus() {
    ;['startMenu', 'pauseMenu', 'gameOverMenu', 'victoryMenu'].forEach((id) => document.getElementById(id)?.classList.add('hidden'))
  },

  startGame() {
    gamepadNavService.clear()
    this.hideAllMenus()
    this.resetGame()
    this.state = GAME_STATES.PLAYING
    this.spawnWave()
  },

  restartGame() {
    this.startGame()
  },

  quitToMap() {
    window.dispatchEvent(new CustomEvent('return-map'))
  },

  resetGame() {
    this.score = 0
    this.lives = 3
    this.waveIndex = 0
    this.waveTotalEnemies = 1
    this.waveClearTimer = 0
    this.enemyDirection = 1
    this.edgeCooldown = 0
    this.descentTimer = 0
    this.lastFireTime = 0
    this.heat = 0
    this.overheated = false
    this.overheatTimer = 0
    this.aimTarget = { x: 0, y: 8.8 }
    this.aim = { x: 0, y: 8.8 }
    this.ended = false
    this.clearCombatObjects()
    this.updateHud()
    setText('mapName', `Vlna 0/${WAVE_CONFIG.length}`)
    const progress = document.getElementById('mapProgress')
    if (progress) progress.style.width = '0%'
  },

  clearCombatObjects() {
    ;[...this.enemies, ...this.bombs, ...this.bullets, ...this.particles].forEach((object) => object.el?.remove())
    this.enemies = []
    this.bombs = []
    this.bullets = []
    this.particles = []
  },

  spawnWave() {
    const config = WAVE_CONFIG[this.waveIndex]
    if (!config) {
      this.endMission(true)
      return
    }

    this.waveIndex += 1
    this.waveClearTimer = 0
    this.descentTimer = 0
    this.enemyDirection = this.waveIndex % 2 === 0 ? -1 : 1
    this.waveTotalEnemies = config.columns * config.rows
    setText('mapName', `Vlna ${this.waveIndex}/${WAVE_CONFIG.length}`)

    const spacingX = 3.25
    const spacingY = 2.45
    const offsetX = ((config.columns - 1) * spacingX) / 2

    for (let row = 0; row < config.rows; row += 1) {
      for (let col = 0; col < config.columns; col += 1) {
        const x = col * spacingX - offsetX
        const y = 9.2 + row * spacingY
        const z = -48 - row * 4.2
        const enemy = createEntity('a-entity', {
          position: `${x} ${y} ${z}`,
          'gltf-model': `url(${ENEMY_MODEL_URL})`,
        }, this.el)
        enemy.addEventListener('model-loaded', (event) => this.fitEnemyModel(enemy, event.detail.model), { once: true })
        this.enemies.push({
          el: enemy,
          radius: ENEMY_HIT_RADIUS,
          health: config.health,
          maxHealth: config.health,
          baseY: y,
          phase: rand(0, Math.PI * 2),
          dropTimer: createDropDelay(config, col, row),
          points: 120 + this.waveIndex * 35,
        })
      }
    }
  },

  updateAim(dt) {
    const moveX = (this.keys.d || this.keys.arrowright ? 1 : 0) - (this.keys.a || this.keys.arrowleft ? 1 : 0)
    const moveY = (this.keys.w || this.keys.arrowup ? 1 : 0) - (this.keys.s || this.keys.arrowdown ? 1 : 0)
    this.aimTarget.x = clamp(this.aimTarget.x + moveX * 20 * dt, -AIM_X_LIMIT, AIM_X_LIMIT)
    this.aimTarget.y = clamp(this.aimTarget.y + moveY * 13 * dt, AIM_Y_MIN, AIM_Y_MAX)
    this.aim.x = damp(this.aim.x, this.aimTarget.x, 12, dt)
    this.aim.y = damp(this.aim.y, this.aimTarget.y, 12, dt)

    const target = new this.THREE.Vector3(this.aim.x, this.aim.y, AIM_Z)
    const turretPos = new this.THREE.Vector3()
    this.turretYaw.object3D.getWorldPosition(turretPos)
    const dir = target.clone().sub(turretPos)
    const yaw = -Math.atan2(dir.x, -dir.z)
    const horizontal = Math.sqrt(dir.x * dir.x + dir.z * dir.z)
    const pitch = clamp(Math.atan2(dir.y, horizontal), -0.4, 0.85)

    this.turretYaw.object3D.rotation.y = damp(this.turretYaw.object3D.rotation.y, yaw, 14, dt)
    this.barrelPivot.object3D.rotation.x = damp(this.barrelPivot.object3D.rotation.x, pitch, 14, dt)
    this.reticle.object3D.position.set(this.aim.x, this.aim.y, AIM_Z)
    const reticlePulse = 1 + Math.sin(this.clockTime * 8) * 0.035
    this.reticle.object3D.scale.set(reticlePulse, reticlePulse, 1)
  },

  updateFireHeat(dt, gpState) {
    const fireRequest = this.fireHeld || this.isFiring || gpState?.fire
    if (fireRequest && !this.overheated) {
      this.heat = Math.min(1, this.heat + this.heatChargeRate * dt)
      if (this.heat >= 1) {
        this.overheated = true
        this.overheatTimer = this.overheatCooldown
      }
    } else {
      if (this.overheated) {
        this.overheatTimer = Math.max(0, this.overheatTimer - dt)
        if (this.overheatTimer <= 0) {
          this.overheated = false
          this.heat = 0.75
        }
      } else {
        this.heat = Math.max(0, this.heat - this.heatCooldownRate * dt)
      }
    }

    // update muzzle glow visual
    if (this.muzzleGlow) {
      const intensity = 0.9 + (this.heat * 2.2)
      const color = this.overheated ? '#ff6b6b' : '#ffd166'
      const emissive = this.overheated ? '#ff3b3b' : '#ff8f2a'
      this.muzzleGlow.setAttribute('material', `color: ${color}; emissive: ${emissive}; emissiveIntensity: ${intensity.toFixed(2)}; transparent: true; opacity: ${ (0.7 + this.heat*0.45).toFixed(2) }; shader: flat`)
      // keep the muzzle geometry a constant size; only change color/intensity
      this.muzzleGlow.setAttribute('scale', `1 1 1`)
      if (this.muzzleLight) {
        const lightInt = (0.4 + this.heat * 2.0) * (this.overheated ? 1.4 : 1)
        const lightColor = this.overheated ? '#ff6b6b' : '#ff8f2a'
        this.muzzleLight.setAttribute('light', `type: point; color: ${lightColor}; intensity: ${lightInt.toFixed(2)}; distance: 10`)
      }
    }
  },

  fitEnemyModel(entity, model) {
    const oldParent = model.parent
    model.parent = null
    model.updateMatrixWorld(true)

    const box = new this.THREE.Box3().setFromObject(model)
    const size = new this.THREE.Vector3()
    const center = new this.THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    model.parent = oldParent

    const maxSize = Math.max(size.x, size.y, size.z)
    if (maxSize > 0) {
      const scaleFactor = ENEMY_MODEL_TARGET_SIZE / maxSize
      entity.setAttribute('scale', `${scaleFactor} ${scaleFactor} ${scaleFactor}`)
      model.position.sub(center)
      model.updateMatrixWorld(true)
      entity.object3D.userData.baseScale = scaleFactor
    }

    model.rotation.y = Math.PI
    entity.object3D.userData.modelReady = true
  },

  fireBullet() {
    if (this.clockTime - this.lastFireTime < this.fireRate) return
    this.lastFireTime = this.clockTime

    const muzzle = new this.THREE.Vector3()
    this.muzzle.object3D.getWorldPosition(muzzle)
    const target = new this.THREE.Vector3(this.aim.x, this.aim.y, AIM_Z)
    const direction = target.sub(muzzle).normalize()
    const spawnPos = muzzle.clone().addScaledVector(direction, 0.65)
    const orientation = new this.THREE.Quaternion().setFromUnitVectors(
      new this.THREE.Vector3(0, 1, 0),
      direction,
    )

    const flash = createEntity('a-sphere', {
      radius: '0.28',
      position: `${spawnPos.x} ${spawnPos.y} ${spawnPos.z}`,
      material: 'color: #fff1a0; emissive: #ff8f00; emissiveIntensity: 2; transparent: true; opacity: 0.9; shader: flat',
    }, this.el)
    const flashId = window.setTimeout(() => { flash.remove(); this._timeouts.delete(flashId) }, 70)
    this._timeouts.add(flashId)

    const bullet = createEntity('a-cylinder', {
      radius: '0.055',
      height: '4.2',
      position: `${spawnPos.x} ${spawnPos.y} ${spawnPos.z}`,
      material: 'color: #ffd166; emissive: #ff8f00; emissiveIntensity: 1.5; transparent: true; opacity: 0.96; shader: flat',
    }, this.el)
    bullet.object3D.quaternion.copy(orientation)
    this.bullets.push({
      el: bullet,
      radius: 0.22,
      velocity: direction.clone().multiplyScalar(92),
      life: 1.25,
    })
  },

  spawnBomb(enemy) {
    const config = WAVE_CONFIG[this.waveIndex - 1] || WAVE_CONFIG[0]
    const start = enemy.el.object3D.position.clone()
    const impact = new this.THREE.Vector3(
      clamp(start.x + rand(-2.2, 2.2), -10.5, 10.5),
      -2.78,
      rand(-22, -9),
    )
    const velocity = impact.clone().sub(start).normalize().multiplyScalar(config.bombSpeed)
    const bombRoot = createEntity('a-entity', {
      position: `${start.x} ${start.y - 0.5} ${start.z + 0.35}`,
      'gltf-model': `url(${BOMB_MODEL_URL})`,
    }, this.el)
    bombRoot.addEventListener('model-loaded', (event) => this.fitBombModel(bombRoot, event.detail.model), { once: true })

    this.bombs.push({
      el: bombRoot,
      radius: BOMB_HIT_RADIUS,
      velocity,
      spin: rand(-4, 4),
      points: 90,
    })
  },

  fitBombModel(entity, model) {
    const oldParent = model.parent
    model.parent = null
    model.updateMatrixWorld(true)

    const box = new this.THREE.Box3().setFromObject(model)
    const size = new this.THREE.Vector3()
    const center = new this.THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    model.parent = oldParent

    const maxSize = Math.max(size.x, size.y, size.z)
    if (maxSize > 0) {
      const scaleFactor = BOMB_MODEL_TARGET_SIZE / maxSize
      entity.setAttribute('scale', `${scaleFactor} ${scaleFactor} ${scaleFactor}`)
      model.position.sub(center)
      model.updateMatrixWorld(true)
    }

    entity.object3D.userData.modelReady = true
  },

  fitVolcanoModel(entity, model) {
    const oldParent = model.parent
    model.parent = null
    model.updateMatrixWorld(true)

    const box = new this.THREE.Box3().setFromObject(model)
    const size = new this.THREE.Vector3()
    const center = new this.THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    model.parent = oldParent

    const height = size.y || Math.max(size.x, size.z, 1)
    if (height > 0) {
      const scaleFactor = VOLCANO_TARGET_HEIGHT / height
      entity.setAttribute('scale', `${scaleFactor} ${scaleFactor} ${scaleFactor}`)
    }

    model.position.x -= center.x
    model.position.y -= box.min.y
    model.position.z -= center.z

    this.applyVolcanoLavaShader(model)
  },

  applyVolcanoLavaShader(model) {
    const toLinearColor = (value) => {
      const srgbColor = new this.THREE.Color(value)
      if (typeof srgbColor.convertSRGBToLinear === 'function') return srgbColor.convertSRGBToLinear()
      if (typeof srgbColor.copySRGBToLinear === 'function') return new this.THREE.Color().copySRGBToLinear(srgbColor)
      return srgbColor
    }

    const lavaKeyColor = toLinearColor(VOLCANO_LAVA_KEY_COLOR)
    const lavaWarmColor = toLinearColor(VOLCANO_LAVA_WARM_COLOR)
    const lavaHotColor = toLinearColor(VOLCANO_LAVA_HOT_COLOR)

    model.traverse((child) => {
      if (!child.isMesh || !child.material) return

      const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material]
      const patchedMaterials = sourceMaterials.map((sourceMaterial) => {
        const material = sourceMaterial.clone()
        material.roughness = Math.max(material.roughness ?? 0.72, 0.72)
        material.metalness = Math.min(material.metalness ?? 0.12, 0.12)
        if (material.emissive) material.emissive.setRGB(0.02, 0.008, 0)
        material.emissiveIntensity = Math.max(material.emissiveIntensity ?? 0, 0.18)

        if (!material.map) return material

        const shaderState = { uniforms: null }
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uVolcanoTime = { value: this.clockTime }
          shader.uniforms.uVolcanoLavaKeyColor = { value: lavaKeyColor.clone() }
          shader.uniforms.uVolcanoLavaWarmColor = { value: lavaWarmColor.clone() }
          shader.uniforms.uVolcanoLavaHotColor = { value: lavaHotColor.clone() }
          shader.uniforms.uVolcanoLavaMaskRange = {
            value: new this.THREE.Vector2(VOLCANO_LAVA_MASK_INNER, VOLCANO_LAVA_MASK_OUTER),
          }
          shader.uniforms.uVolcanoGlowStrength = { value: 1.35 }

          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
varying vec3 vVolcanoWorldPos;
varying vec3 vVolcanoLocalPos;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
vVolcanoLocalPos = transformed;
vVolcanoWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`)

          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
varying vec3 vVolcanoWorldPos;
varying vec3 vVolcanoLocalPos;
uniform float uVolcanoTime;
uniform vec3 uVolcanoLavaKeyColor;
uniform vec3 uVolcanoLavaWarmColor;
uniform vec3 uVolcanoLavaHotColor;
uniform vec2 uVolcanoLavaMaskRange;
uniform float uVolcanoGlowStrength;`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
vec3 volcanoBaseColor = diffuseColor.rgb;
float volcanoMaskDistance = distance(volcanoBaseColor, uVolcanoLavaKeyColor);
float volcanoLavaMask = 1.0 - smoothstep(uVolcanoLavaMaskRange.x, uVolcanoLavaMaskRange.y, volcanoMaskDistance);
float volcanoFlowA = sin(vVolcanoLocalPos.y * 1.25 - uVolcanoTime * 4.8 + vVolcanoLocalPos.z * 0.42);
float volcanoFlowB = sin(vVolcanoLocalPos.y * 2.1 - uVolcanoTime * 3.1 - vVolcanoWorldPos.x * 0.18);
float volcanoFlowC = sin(vVolcanoLocalPos.z * 1.4 + uVolcanoTime * 2.4 + vVolcanoLocalPos.x * 0.55);
float volcanoFlow = clamp(0.52 + volcanoFlowA * 0.34 + volcanoFlowB * 0.24 + volcanoFlowC * 0.14, 0.0, 1.0);
float volcanoPulse = 0.82 + 0.18 * sin(uVolcanoTime * 5.6 + vVolcanoLocalPos.y * 0.45);
vec3 volcanoLavaColor = mix(uVolcanoLavaWarmColor, uVolcanoLavaHotColor, volcanoFlow);
diffuseColor.rgb = mix(diffuseColor.rgb, volcanoLavaColor, volcanoLavaMask * (0.24 + volcanoFlow * 0.28));
totalEmissiveRadiance += volcanoLavaColor * volcanoLavaMask * (0.42 + volcanoFlow * 0.78) * volcanoPulse * uVolcanoGlowStrength;`)

          shaderState.uniforms = shader.uniforms
        }
        material.customProgramCacheKey = () => 'ignis-volcano-lava-v1'
        material.needsUpdate = true
        this.volcanoShaderStates.push(shaderState)
        this.volcanoShaderMaterials.push(material)
        return material
      })

      child.material = Array.isArray(child.material) ? patchedMaterials : patchedMaterials[0]
      child.castShadow = true
      child.receiveShadow = true
    })
  },

  updateVolcanoShader() {
    this.volcanoShaderStates.forEach((state) => {
      if (!state.uniforms?.uVolcanoTime) return
      state.uniforms.uVolcanoTime.value = this.clockTime
    })
  },

  updateEnemies(dt) {
    const config = WAVE_CONFIG[this.waveIndex - 1] || WAVE_CONFIG[0]
    this.edgeCooldown = Math.max(0, this.edgeCooldown - dt)
    this.descentTimer = (this.descentTimer || 0) + dt

    this.enemies.forEach((enemy) => {
      const obj = enemy.el.object3D
      obj.position.x += this.enemyDirection * config.speed * dt
      obj.position.y = enemy.baseY + Math.sin(this.clockTime * 1.7 + enemy.phase) * 0.36
      obj.rotation.z = Math.sin(this.clockTime * 2.3 + enemy.phase) * 0.18

      enemy.dropTimer -= dt
      if (enemy.dropTimer <= 0) {
        enemy.dropTimer = createDropDelay(config)
        if (this.bombs.length < config.maxBombs && Math.random() < config.dropChance) {
          this.spawnBomb(enemy)
        }
      }
    })

    const descentInterval = 8.0
    if (this.descentTimer >= descentInterval) {
      this.descentTimer = 0
      this.enemyDirection *= -1
      this.enemies.forEach((enemy) => {
        enemy.baseY = Math.max(4.5, enemy.baseY - 0.6)
        enemy.el.object3D.position.z += 1.0
      })
    }
  },

  updateBombs(dt) {
    const impacted = new Set()
    this.bombs.forEach((bomb) => {
      const obj = bomb.el.object3D
      obj.position.addScaledVector(bomb.velocity, dt)
      obj.rotation.x += bomb.spin * dt
      obj.rotation.y += (bomb.spin + 1.5) * dt
      obj.rotation.z += bomb.spin * 0.5 * dt
      if (Math.random() < 0.3) {
        const trail = createEntity('a-sphere', {
          radius: `${rand(0.04, 0.1)}`,
          position: `${obj.position.x} ${obj.position.y} ${obj.position.z}`,
          material: 'color: #ff6600; emissive: #ff3300; emissiveIntensity: 1.5; transparent: true; opacity: 0.8; shader: flat',
        }, this.el)
        this.particles.push({
          el: trail,
          velocity: new this.THREE.Vector3(rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5)),
          life: rand(0.2, 0.4),
        })
      }
      if (obj.position.y <= -2.78 || obj.position.z > 6) {
        impacted.add(bomb)
        this.createExplosion(obj.position, '#ff3b00', 0.9)
        this.takeDamage()
      }
    })

    this.bombs = this.bombs.filter((bomb) => {
      if (!impacted.has(bomb)) return true
      bomb.el.remove()
      return false
    })
  },

  updateBullets(dt) {
    this.bullets.forEach((bullet) => {
      bullet.life -= dt
      bullet.el.object3D.position.addScaledVector(bullet.velocity, dt)
    })
    this.bullets = this.bullets.filter((bullet) => {
      const pos = bullet.el.object3D.position
      const alive = bullet.life > 0 && Math.abs(pos.x) < 80 && pos.y < 45 && pos.z > -135
      if (!alive) bullet.el.remove()
      return alive
    })
  },

  updateParticles(dt) {
    this.particles.forEach((particle) => {
      particle.life -= dt
      particle.el.object3D.position.addScaledVector(particle.velocity, dt)
      particle.el.object3D.scale.multiplyScalar(0.98)
    })
    this.particles = this.particles.filter((particle) => {
      if (particle.life > 0) return true
      particle.el.remove()
      return false
    })
  },

  checkCollisions() {
    const bulletsToRemove = new Set()
    const bombsToRemove = new Set()
    const enemiesToRemove = new Set()

    this.bullets.forEach((bullet) => {
      const bulletPos = bullet.el.object3D.position

      for (const bomb of this.bombs) {
        if (bombsToRemove.has(bomb)) continue
        if (bulletPos.distanceTo(bomb.el.object3D.position) >= bullet.radius + bomb.radius) continue
        bulletsToRemove.add(bullet)
        bombsToRemove.add(bomb)
        this.addScore(bomb.points)
        this.createExplosion(bomb.el.object3D.position, '#ffd166', 0.58)
        return
      }

      for (const enemy of this.enemies) {
        if (enemiesToRemove.has(enemy)) continue
        if (bulletPos.distanceTo(enemy.el.object3D.position) >= bullet.radius + enemy.radius) continue
        bulletsToRemove.add(bullet)
        enemy.health -= 1
        this.createExplosion(bulletPos, '#ffd166', 0.36)
        const baseScale = enemy.el.object3D.userData.baseScale || 1
        enemy.el.object3D.scale.setScalar(baseScale * 1.15)
        const hitId = window.setTimeout(() => { enemy.el?.object3D?.scale.setScalar(baseScale); this._timeouts.delete(hitId) }, 90)
        this._timeouts.add(hitId)
        if (enemy.health <= 0) {
          enemiesToRemove.add(enemy)
          this.addScore(enemy.points)
          this.createExplosion(enemy.el.object3D.position, '#ff5a12', 0.8)
        }
        return
      }
    })

    this.bullets = this.bullets.filter((bullet) => {
      if (!bulletsToRemove.has(bullet)) return true
      bullet.el.remove()
      return false
    })
    this.bombs = this.bombs.filter((bomb) => {
      if (!bombsToRemove.has(bomb)) return true
      bomb.el.remove()
      return false
    })
    this.enemies = this.enemies.filter((enemy) => {
      if (!enemiesToRemove.has(enemy)) return true
      enemy.el.remove()
      return false
    })
  },

  updateWaveFlow(dt) {
    if (this.enemies.length > 0 || this.bombs.length > 0) {
      this.waveClearTimer = 0
      return
    }

    this.waveClearTimer += dt
    if (this.waveClearTimer < 1.0) return
    if (this.waveIndex >= WAVE_CONFIG.length) this.endMission(true)
    else this.spawnWave()
  },

  addScore(points) {
    this.score += points
    setText('scoreDisplay', this.score.toLocaleString('cs-CZ'))
    const popup = document.createElement('div')
    popup.className = 'score-popup'
    popup.textContent = `+${points}`
    popup.style.left = `${window.innerWidth / 2 + rand(-120, 120)}px`
    popup.style.top = `${window.innerHeight / 2 + rand(-80, 80)}px`
    document.getElementById('mission-ui')?.appendChild(popup)
    const popupId = window.setTimeout(() => { popup.remove(); this._timeouts.delete(popupId) }, 1000)
    this._timeouts.add(popupId)
  },

  takeDamage() {
    if (this.state !== GAME_STATES.PLAYING) return
    this.lives -= 1
    const flash = document.getElementById('damageFlash')
    flash?.classList.add('active')
    const dmgId = window.setTimeout(() => { flash?.classList.remove('active'); this._timeouts.delete(dmgId) }, 120)
    this._timeouts.add(dmgId)
    this.shakeCamera(0.4, 0.3)
    const shieldMaterial = this.shieldRing?.getObject3D('mesh')?.material
    if (shieldMaterial) {
      shieldMaterial.opacity = 0.72
      const shieldId = window.setTimeout(() => {
        if (shieldMaterial) shieldMaterial.opacity = 0.34
        this._timeouts.delete(shieldId)
      }, 130)
      this._timeouts.add(shieldId)
    }
    if (this.lives <= 0) this.endMission(false)
  },

  shakeCamera(intensity, duration) {
    if (!this.camera) return
    const originalPos = this.camera.object3D.position.clone()
    const startTime = this.clockTime
    const shakeInterval = window.setInterval(() => {
      const elapsed = this.clockTime - startTime
      if (elapsed > duration) {
        this.camera.object3D.position.copy(originalPos)
        window.clearInterval(shakeInterval)
        this._timeouts.delete(shakeInterval)
        return
      }
      const decay = 1 - (elapsed / duration)
      this.camera.object3D.position.x = originalPos.x + rand(-intensity, intensity) * decay
      this.camera.object3D.position.y = originalPos.y + rand(-intensity, intensity) * decay
    }, 16)
    this._timeouts.add(shakeInterval)
  },

  createExplosion(position, color = '#ff5a12', scale = 1) {
    const particleCount = Math.floor(12 * scale)
    for (let i = 0; i < particleCount; i += 1) {
      const particle = createEntity('a-sphere', {
        radius: `${rand(0.08, 0.24) * scale}`,
        position: `${position.x} ${position.y} ${position.z}`,
        material: `color: ${color}; emissive: ${color}; emissiveIntensity: 1.4; transparent: true; opacity: 0.95; shader: flat`,
      }, this.el)
      const velocity = new this.THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1))
        .normalize()
        .multiplyScalar(rand(5, 15) * scale)
      this.particles.push({ el: particle, velocity, life: rand(0.5, 0.9) })
    }
    const flash = createEntity('a-sphere', {
      radius: `${0.6 * scale}`,
      position: `${position.x} ${position.y} ${position.z}`,
      material: `color: #ffffff; emissive: ${color}; emissiveIntensity: 2; transparent: true; opacity: 0.9; shader: flat`,
    }, this.el)
    const flashId = window.setTimeout(() => { flash.remove(); this._timeouts.delete(flashId) }, 60)
    this._timeouts.add(flashId)
  },

  updateHud() {
    const c = this._hudCache
    const scoreText = this.score.toLocaleString('cs-CZ')
    if (c.score !== scoreText) { c.score = scoreText; setText('scoreDisplay', scoreText) }

    if (c.lives !== this.lives) {
      c.lives = this.lives
      document.querySelectorAll('#heartsDisplay .heart').forEach((heart, index) => {
        heart.classList.toggle('empty', index >= this.lives)
      })
    }

    const config = WAVE_CONFIG[this.waveIndex - 1]
    const currentWave = clamp(this.waveIndex, 0, WAVE_CONFIG.length)
    const remainingRatio = config ? clamp(this.enemies.length / Math.max(this.waveTotalEnemies, 1), 0, 1) : 0
    const progressPct = Math.round(clamp((Math.max(0, currentWave - 1) + (1 - remainingRatio)) / WAVE_CONFIG.length, 0, 1) * 100)
    if (c.progress !== progressPct) {
      c.progress = progressPct
      const progressEl = document.getElementById('mapProgress')
      if (progressEl) progressEl.style.width = `${progressPct}%`
    }
    // Heat HUD (Ignis)
    const heatFill = document.getElementById('ignisHeatFill')
    if (heatFill) {
      const pct = Math.round(this.heat * 100)
      heatFill.style.width = `${pct}%`
      heatFill.classList.toggle('overheated', this.overheated)
      const warning = this.heat >= 0.75 && !this.overheated
      heatFill.classList.toggle('warning', warning)
    }
    const overText = document.getElementById('ignisOverheatText')
    if (overText) overText.classList.toggle('hidden', !this.overheated)
  },

  togglePause() {
    if (this.systemMenuOpen) return
    if (this.state === GAME_STATES.PLAYING) {
      this.previousState = this.state
      this.state = GAME_STATES.PAUSED
      document.getElementById('pauseMenu')?.classList.remove('hidden')
      gamepadNavService.push({
        id: 'pause',
        elements: () => ['resumeButton', 'restartButton', 'quitButton']
          .map((id) => document.getElementById(id))
          .filter(Boolean),
        onBack: () => this.togglePause(),
      })
    } else if (this.state === GAME_STATES.PAUSED) {
      this.state = this.previousState || GAME_STATES.PLAYING
      document.getElementById('pauseMenu')?.classList.add('hidden')
      gamepadNavService.remove('pause')
    }
  },

  endMission(completed) {
    if (this.ended) return
    this.ended = true
    this.state = completed ? GAME_STATES.VICTORY : GAME_STATES.GAME_OVER
    audioService.stopMusic()

    if (completed) {
      window.dispatchEvent(new CustomEvent('mission-ended', {
        detail: { completed: true, planetIndex: this.data.planetIndex, score: this.score },
      }))
      setText('victoryScore', this.score.toLocaleString('cs-CZ'))
      const copy = document.querySelector('#victoryMenu .victory-copy')
      if (copy) copy.textContent = 'Ignis ubráněn. Bomby Stínu se nedostaly k jádru planety.'
      document.getElementById('victoryMenu')?.classList.remove('hidden')
      gamepadNavService.replace({
        id: 'victory',
        linear: true,
        elements: () => ['victoryRetryButton', 'victoryMapButton']
          .map((id) => document.getElementById(id))
          .filter(Boolean),
      })
    } else {
      setText('finalScore', this.score.toLocaleString('cs-CZ'))
      document.getElementById('gameOverMenu')?.classList.remove('hidden')
      gamepadNavService.replace({
        id: 'game-over',
        linear: true,
        elements: () => ['retryButton', 'gameOverMapButton', 'mainMenuButton']
          .map((id) => document.getElementById(id))
          .filter(Boolean),
      })
    }
  },

  tick(_time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.033)
    this.clockTime += dt
    this.updateVolcanoShader()
    this.updateSurfaceAtmosphere()

    const gp = gamepadService.getPad()
    const gpState = gp ? gamepadService.update(this.keys, gp) : null
    if (gpState?.systemMenuJustPressed) {
      window.dispatchEvent(new CustomEvent('gamepad-system-menu'))
    }
    if (gpState?.pauseJustPressed) this.togglePause()

    if (this.state !== GAME_STATES.PLAYING) {
      audioService.stopShipEngine(dt)
      if (this.state === GAME_STATES.PAUSED) audioService.stopMusic(dt)
      return
    }

    audioService.stopShipEngine(dt)
    audioService.updateMusic({
      track: 'galaxy',
      active: true,
      volume: 0.075,
      dt,
    })

    this.updateAim(dt)
    this.updateFireHeat(dt, gpState)
    if (!this.overheated && (this.fireHeld || this.isFiring || gpState?.fire)) this.fireBullet()
    this.updateEnemies(dt)
    this.updateBombs(dt)
    this.updateBullets(dt)
    this.updateParticles(dt)
    this.checkCollisions()
    this.updateWaveFlow(dt)
    this.updateHud()
  },

  remove() {
    gamepadNavService.clear()
    this._timeouts.forEach((id) => window.clearTimeout(id))
    this._timeouts.clear()
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('system-menu-toggle', this.onSystemMenuToggle)
    this.uiHandlers?.forEach(([id, handler]) => document.getElementById(id)?.removeEventListener('click', handler))

    const base = document.getElementById('missionJoystickBase')
    const fireButton = document.getElementById('fireButton')
    if (this.mobileHandlers) {
      base?.removeEventListener('touchstart', this.mobileHandlers.touchstart)
      window.removeEventListener('touchmove', this.mobileHandlers.touchmove)
      window.removeEventListener('touchend', this.mobileHandlers.touchend)
      window.removeEventListener('touchcancel', this.mobileHandlers.touchcancel)
      fireButton?.removeEventListener('touchstart', this.mobileHandlers.firestart)
      fireButton?.removeEventListener('touchend', this.mobileHandlers.fireend)
      fireButton?.removeEventListener('touchcancel', this.mobileHandlers.fireend)
    }

    this.clearCombatObjects()
    if (this.starfield) {
      this.starfield.geometry?.dispose?.()
      this.starfield.material?.dispose?.()
      this.el.removeObject3D('ignis-stars')
    }
    if (this.ignisTerrain) {
      this.ignisTerrain.geometry?.dispose?.()
      this.ignisTerrain.material?.dispose?.()
      this.el.removeObject3D('ignis-terrain')
      this.ignisTerrain = null
    }
    this.volcanoShaderMaterials.forEach((material) => material.dispose?.())
    this.volcanoShaderMaterials = []
    this.volcanoShaderStates = []
    this.surfacePulseElements = []
    this.ashPlumes = []
    this.embers = []
    audioService.stopShipEngine()
    audioService.stopMusic()
    this.restoreMissionUi()
    document.getElementById('boss-hud')?.classList.remove('active', 'show')
    document.querySelectorAll('#mission-ui .score-popup').forEach((popup) => popup.remove())
  },
})
