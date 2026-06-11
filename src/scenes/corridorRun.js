import { gameState, getMap, getPlanet } from '../services/gameState.js'
import { audioService } from '../services/audioService.js'
import { gamepadService } from '../services/gamepadService.js'
import { gamepadNavService } from '../services/gamepadNavService.js'
import { springValue } from '../services/motionDynamics.js'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const rand = (min, max) => min + Math.random() * (max - min)
const damp = (current, target, speed, dt) => current + (target - current) * (1 - Math.exp(-speed * dt))

const GAME_STATES = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  BOSS: 'BOSS',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
  VICTORY: 'VICTORY',
}

const ASTEROID_MODEL_URL = '/models/objects/asteroid.glb'
const POWERUP_TYPES = ['shield', 'rapid', 'score']
const STAR_POWER_DURATION = 10

function createEntity(tag, attrs = {}, parent) {
  const el = document.createElement(tag)
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value))
  if (parent) parent.appendChild(el)
  return el
}

function setText(id, value) {
  const el = document.getElementById(id)
  if (el) el.textContent = value
}

AFRAME.registerComponent('corridor-run', {
  schema: {
    planetIndex: { type: 'int', default: 0 },
    mapIndex: { type: 'int', default: 0 },
    autoStart: { type: 'boolean', default: false },
  },

  init() {
    this.THREE = AFRAME.THREE
    this.map = getMap(this.data.mapIndex)
    this.planet = getPlanet(this.data.planetIndex)
    this.keys = {}
    this.state = GAME_STATES.MENU
    this.currentMap = this.data.mapIndex
    this.clockTime = 0
    this.mapTime = 0
    this.score = 0
    this.lives = 3
    this.noHitStreak = 0
    this.noHitTimer = 0
    this.powerupTimers = { shield: 0, rapid: 0, score: 0 }
    this.scoreMultiplier = 1
    this.speedMultiplier = 1
    this.fireRate = 0.12
    this.lastFireTime = 0
    this.fireQueued = false
    this.spawnTimers = { enemy: 0, asteroid: 0, mine: 0, powerup: 0 }
    this.systemMenuOpen = false
    this.systemPausedState = null

    this.enemies = []
    this.asteroids = []
    this.mines = []
    this.powerups = []
    this.bullets = []
    this.enemyBullets = []
    this.particles = []
    this.boss = null
    this.ended = false
    this._hudCache = {}
    this._timeouts = new Set()

    this.onKeyDown = (event) => {
      this.keys[event.key.toLowerCase()] = true
      this.keys[event.code.toLowerCase()] = true
      if (event.code === 'Space') {
        event.preventDefault()
        if (!event.repeat) this.fireQueued = true
      }
      if (event.key === 'p' || event.key === 'P') this.togglePause()
    }
    this.onKeyUp = (event) => {
      this.keys[event.key.toLowerCase()] = false
      this.keys[event.code.toLowerCase()] = false
    }
    this.onSystemMenuToggle = (event) => {
      this.systemMenuOpen = !!event.detail.open
      if (this.systemMenuOpen) {
        Object.keys(this.keys).forEach((key) => {
          this.keys[key] = false
        })
        this.fireQueued = false
        if (this.state === GAME_STATES.PLAYING || this.state === GAME_STATES.BOSS) {
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
    this.setupMobileControls()
    this.buildScene()
    this.activateCamera()
    if (this.data.autoStart) this.hideAllMenus()
    else this.resetUi()
    this.loadMap(this.currentMap)
    this.updateHud()
    audioService.stopMusic()
    if (this.data.autoStart) this.startGame()
  },

  bindUi() {
    this.uiHandlers = [
      ['startButton', () => this.startGame()],
      ['startBackButton', () => window.dispatchEvent(new CustomEvent('return-map'))],
      ['resumeButton', () => this.togglePause()],
      ['restartButton', () => this.restartGame()],
      ['quitButton', () => this.quitToMenu()],
      ['retryButton', () => this.restartGame()],
      ['gameOverMapButton', () => window.dispatchEvent(new CustomEvent('return-map'))],
      ['mainMenuButton', () => window.dispatchEvent(new CustomEvent('return-main-menu'))],
      ['victoryRetryButton', () => this.restartGame()],
      ['victoryMapButton', () => {
        window.dispatchEvent(new CustomEvent('return-map'))
      }],
    ]
    this.uiHandlers.forEach(([id, handler]) => document.getElementById(id)?.addEventListener('click', handler))
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
        this.fireQueued = true
      },
      fireend: (event) => {
        event.preventDefault()
      },
    }

    base.addEventListener('touchstart', this.mobileHandlers.touchstart, { passive: false })
    window.addEventListener('touchmove', this.mobileHandlers.touchmove, { passive: false })
    window.addEventListener('touchend', this.mobileHandlers.touchend)
    window.addEventListener('touchcancel', this.mobileHandlers.touchcancel)
    fireButton.addEventListener('touchstart', this.mobileHandlers.firestart, { passive: false })
    fireButton.addEventListener('touchend', this.mobileHandlers.fireend, { passive: false })
  },

  resetUi() {
    ;['pauseMenu', 'gameOverMenu', 'victoryMenu'].forEach((id) => document.getElementById(id)?.classList.add('hidden'))
    document.getElementById('startMenu')?.classList.remove('hidden')
    document.getElementById('boss-hud')?.classList.remove('active', 'show')
    document.querySelectorAll('#mission-ui .powerup-slot').forEach((slot) => {
      slot.classList.remove('active')
      slot.querySelector('.powerup-timer')?.remove()
    })
  },

  buildScene() {
    createEntity('a-entity', {
      light: 'type: ambient; color: #222244; intensity: 0.5',
    }, this.el)
    createEntity('a-entity', {
      light: 'type: directional; color: #ffffff; intensity: 0.8',
      position: '5 10 5',
    }, this.el)

    this.playerLight = createEntity('a-entity', {
      light: 'type: point; color: #00aaff; intensity: 2; distance: 20',
      position: '0 0 7',
    }, this.el)

    this.camera = createEntity('a-entity', {
      id: 'mission-camera',
      camera: 'active: true; fov: 75; near: 0.1; far: 1000',
      position: '0 2 12',
      rotation: '-16 0 0',
    }, this.el)

    this.player = createEntity('a-entity', {
      id: 'mission-ship',
      position: '0 0 5',
      scale: '1.55 1.55 1.55',
      'lk-ship-model': `color: #0088ff; shield: false; modelUrl: ${gameState.getSelectedShipSkin().modelUrl}`,
    }, this.el)
    this.createStarPowerAura()
    this.fireReticle = createEntity('a-entity', {
      position: '0 0 -7.2',
    }, this.player)
    createEntity('a-entity', {
      geometry: 'primitive: ring; radiusInner: 0.18; radiusOuter: 0.27',
      material: 'color: #00ffff; emissive: #00ffff; emissiveIntensity: 1.5; transparent: true; opacity: 0.98; shader: flat; depthTest: false; depthWrite: false',
      rotation: '90 0 0',
      scale: '1.15 1.15 1.15',
    }, this.fireReticle)
    createEntity('a-entity', {
      geometry: 'primitive: ring; radiusInner: 0.06; radiusOuter: 0.11',
      material: 'color: #ffffff; emissive: #ffffff; emissiveIntensity: 1.2; transparent: true; opacity: 0.72; shader: flat; depthTest: false; depthWrite: false',
      rotation: '90 0 0',
    }, this.fireReticle)
    ;[
      ['0.34 0 0', '0.12 0.02 0.02'],
      ['-0.34 0 0', '0.12 0.02 0.02'],
      ['0 0.34 0', '0.02 0.12 0.02'],
      ['0 -0.34 0', '0.02 0.12 0.02'],
    ].forEach(([position, size]) => {
      createEntity('a-box', {
        position,
        depth: '0.02',
        height: size.split(' ')[1],
        width: size.split(' ')[0],
        material: 'color: #00ffff; emissive: #00ffff; emissiveIntensity: 1.2; transparent: true; opacity: 0.92; shader: flat; depthTest: false; depthWrite: false',
      }, this.fireReticle)
    })
    createEntity('a-sphere', {
      radius: '0.05',
      material: 'color: #ffffff; emissive: #00ffff; emissiveIntensity: 1.8; transparent: true; opacity: 0.95; shader: flat; depthTest: false; depthWrite: false',
    }, this.fireReticle)
    this.player.object3D.userData.targetX = 0
    this.player.object3D.userData.targetY = 0
    this.player.object3D.userData.velocityX = 0
    this.player.object3D.userData.velocityY = 0

    this.createStarfield()
  },

  activateCamera() {
    requestAnimationFrame(() => {
      document.querySelectorAll('a-entity[camera]').forEach((cameraEntity) => {
        cameraEntity.setAttribute('camera', 'active: false')
      })
      this.camera?.setAttribute('camera', 'active: true; fov: 75; near: 0.1; far: 1000')
      this.camera?.setAttribute('rotation', '-16 0 0')
    })
  },

  createStarfield() {
    const geometry = new this.THREE.BufferGeometry()
    const starCount = 200
    const positions = new Float32Array(starCount * 3)
    const colors = new Float32Array(starCount * 3)

    for (let i = 0; i < starCount; i += 1) {
      const i3 = i * 3
      const angle = Math.random() * Math.PI * 2
      const radius = rand(5, 20)
      positions[i3] = Math.cos(angle) * radius
      positions[i3 + 1] = Math.sin(angle) * radius
      positions[i3 + 2] = -Math.random() * 200
      const brightness = rand(0.5, 1)
      colors[i3] = brightness
      colors[i3 + 1] = brightness
      colors[i3 + 2] = brightness
    }

    geometry.setAttribute('position', new this.THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new this.THREE.BufferAttribute(colors, 3))
    this.starPositions = geometry.attributes.position

    const material = new this.THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    })
    this.starfield = new this.THREE.Points(geometry, material)
    this.el.setObject3D('mission-stars', this.starfield)
  },

  startGame() {
    gamepadNavService.clear()
    this.hideAllMenus()
    this.resetGame()
    this.state = GAME_STATES.PLAYING
    this.loadMap(this.currentMap)
  },

  hideAllMenus() {
    ;['startMenu', 'pauseMenu', 'gameOverMenu', 'victoryMenu'].forEach((id) => document.getElementById(id)?.classList.add('hidden'))
  },

  togglePause() {
    if (this.systemMenuOpen) return
    if (this.state === GAME_STATES.PLAYING || this.state === GAME_STATES.BOSS) {
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

  quitToMenu() {
    if (this.data.autoStart) {
      window.dispatchEvent(new CustomEvent('return-map'))
      return
    }

    this.clearAllObjects()
    this.state = GAME_STATES.MENU
    this.resetUi()
    this.resetPlayer()
  },

  restartGame() {
    gamepadNavService.clear()
    this.startGame()
  },

  resetGame() {
    this.score = 0
    this.lives = 3
    this.mapTime = 0
    this.noHitStreak = 0
    this.noHitTimer = 0
    this.powerupTimers = { shield: 0, rapid: 0, score: 0 }
    this.systemPausedState = null
    this.scoreMultiplier = 1
    this.speedMultiplier = 1
    this.fireRate = 0.12
    this.lastFireTime = 0
    this.ended = false
    this.spawnTimers = { enemy: 0, asteroid: 0, mine: 0, powerup: 0 }
    this.clearAllObjects()
    this.resetPlayer()
    this.updateHud()
  },

  resetPlayer() {
    const player = this.player.object3D
    player.position.set(0, 0, 5)
    player.rotation.set(0, 0, 0)
    player.scale.set(1.55, 1.55, 1.55)
    player.visible = true
    player.userData.targetX = 0
    player.userData.targetY = 0
    player.userData.velocityX = 0
    player.userData.velocityY = 0
    player.userData.prevX = 0
    player.userData.prevY = 0
    player.userData.attitude = {
      roll: 0,
      pitch: 0,
      yaw: 0,
      rollVelocity: 0,
      pitchVelocity: 0,
      yawVelocity: 0,
    }
    player.rotation.set(0, 0, 0)
    const shield = player.getObjectByName('shield')
    if (shield?.material) {
      shield.material.opacity = 0
      shield.visible = false
    }
    this.updateStarPowerVisual(0, true)
  },

  loadMap(mapIndex) {
    this.currentMap = mapIndex
    this.map = getMap(mapIndex)
    this.el.sceneEl.setAttribute('background', `color: ${this.map.bgColor}`)
    this.el.sceneEl.setAttribute('fog', `type: linear; color: ${this.map.fogColor}; near: ${this.map.fogNear}; far: ${this.map.fogFar}`)
    setText('mapName', this.map.name)
    const progress = document.getElementById('mapProgress')
    if (progress) progress.style.width = '0%'
  },

  clearAllObjects() {
    ;[
      ...this.enemies,
      ...this.asteroids,
      ...this.mines,
      ...this.powerups,
      ...this.bullets,
      ...this.enemyBullets,
      ...this.particles,
    ].forEach((object) => object.el?.remove())
    if (this.boss?.el) this.boss.el.remove()
    this.enemies = []
    this.asteroids = []
    this.mines = []
    this.powerups = []
    this.bullets = []
    this.enemyBullets = []
    this.particles = []
    this.boss = null
    document.getElementById('boss-hud')?.classList.remove('active', 'show')
  },

  spawnEnemy() {
    const variants = ['tetra', 'box', 'octa']
    const variant = variants[Math.floor(Math.random() * variants.length)]
    const enemy = createEntity('a-entity', {
      position: `${rand(-7, 7)} ${rand(-4.5, 4.5)} ${rand(-120, -80)}`,
      'lk-enemy-model': `variant: ${variant}`,
    }, this.el)
    this.enemies.push({
      el: enemy,
      type: 'enemy',
      points: 100,
      radius: 1.5,
      health: 1,
      shootTimer: rand(1, 3),
    })
  },

  spawnAsteroid() {
    const radius = rand(1.2, 2)
    const asteroid = createEntity('a-entity', {
      position: `${rand(-7, 7)} ${rand(-4.5, 4.5)} ${rand(-120, -80)}`,
      'gltf-model': `url(${ASTEROID_MODEL_URL})`,
      scale: `${radius} ${radius} ${radius}`,
    }, this.el)
    asteroid.addEventListener('model-loaded', (event) => {
      event.detail.model.traverse((child) => {
        if (!child.isMesh || !child.material) return
        child.material.roughness = Math.max(child.material.roughness ?? 0.8, 0.75)
        child.material.metalness = Math.min(child.material.metalness ?? 0.1, 0.18)
      })
    })
    asteroid.object3D.userData.rotationSpeed = new this.THREE.Vector3(rand(-2, 2), rand(-2, 2), rand(-2, 2))
    this.asteroids.push({
      el: asteroid,
      type: 'asteroid',
      points: 25,
      radius: radius * 1.05,
    })
  },

  spawnMine() {
    const mine = createEntity('a-entity', {
      position: `${rand(-6, 6)} ${rand(-4, 4)} ${rand(-120, -80)}`,
      'lk-mine-model': '',
    }, this.el)
    this.mines.push({
      el: mine,
      type: 'mine',
      points: 150,
      radius: 1.6,
      pulseTime: Math.random() * Math.PI * 2,
    })
  },

  spawnPowerup() {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]
    const powerup = createEntity('a-entity', {
      position: `${rand(-5, 5)} ${rand(-3.5, 3.5)} -60`,
      'lk-powerup-model': `type: ${type}`,
    }, this.el)
    this.powerups.push({
      el: powerup,
      type,
      radius: 1.2,
      rotationSpeed: 0.02,
      floatOffset: Math.random() * Math.PI * 2,
    })
  },

  fireBullet() {
    if (this.clockTime - this.lastFireTime < this.fireRate) return
    this.lastFireTime = this.clockTime
    const shipPos = new this.THREE.Vector3()
    const reticlePos = new this.THREE.Vector3()
    this.player.object3D.getWorldPosition(shipPos)
    this.fireReticle?.object3D.getWorldPosition(reticlePos)
    const direction = reticlePos.clone().sub(shipPos).normalize()
    const spawnPos = shipPos.clone().addScaledVector(direction, 2.2)
    const orientation = new this.THREE.Quaternion().setFromUnitVectors(
      new this.THREE.Vector3(0, 1, 0),
      direction,
    )
    const flash = createEntity('a-entity', {
      position: `${spawnPos.x} ${spawnPos.y} ${spawnPos.z}`,
      geometry: 'primitive: ring; radiusInner: 0.08; radiusOuter: 0.18',
      material: 'color: #ffffff; emissive: #00ffff; emissiveIntensity: 2; transparent: true; opacity: 0.95; shader: flat; depthTest: false; depthWrite: false',
      rotation: '90 0 0',
      scale: '1.2 1.2 1.2',
    }, this.el)
    const flashId = window.setTimeout(() => { flash.remove(); this._timeouts.delete(flashId) }, 90)
    this._timeouts.add(flashId)
    const bullet = createEntity('a-cylinder', {
      radius: '0.05',
      height: '4.8',
      position: `${spawnPos.x} ${spawnPos.y} ${spawnPos.z}`,
      material: 'color: #00ffff; emissive: #00ffff; emissiveIntensity: 1.25; transparent: true; opacity: 0.98; shader: flat',
    }, this.el)
    bullet.object3D.quaternion.copy(orientation)
    this.bullets.push({ el: bullet, radius: 0.2, velocity: direction.clone().multiplyScalar(95) })
  },

  fireEnemyBullet(enemy) {
    const pos = enemy.el.object3D.position
    const bullet = createEntity('a-sphere', {
      radius: '0.12',
      position: `${pos.x} ${pos.y} ${pos.z + 1}`,
      material: 'color: #ff0044; emissive: #ff0044; emissiveIntensity: 1',
    }, this.el)
    const velocity = new this.THREE.Vector3()
      .subVectors(this.player.object3D.position, pos)
      .normalize()
      .multiplyScalar(28)
    this.enemyBullets.push({ el: bullet, radius: 0.25, velocity })
  },

  startBossFight(type) {
    if (this.boss) return
    this.state = GAME_STATES.BOSS
    ;[...this.enemies, ...this.asteroids, ...this.mines, ...this.powerups].forEach((object) => object.el.remove())
    this.enemies = []
    this.asteroids = []
    this.mines = []
    this.powerups = []
    const bossType = type || (this.currentMap === 0 ? 1 : this.currentMap === 1 ? 2 : 3)
    const boss = createEntity('a-entity', {
      position: `0 0 ${bossType === 3 ? -50 : -40}`,
      'lk-boss-model': `type: ${bossType}`,
    }, this.el)
    const health = bossType === 1 ? 30 : bossType === 2 ? 45 : 100
    this.boss = {
      el: boss,
      type: bossType,
      health,
      maxHealth: health,
      radius: bossType === 3 ? 6 : 5,
      shootTimer: 0,
      phase: 1,
      moveTimer: 0,
      pattern: 0,
      orbitAngle: 0,
    }
    setText('bossName', bossType === 1 ? 'MINI-BOSS ALPHA' : bossType === 2 ? 'MINI-BOSS BETA' : 'JÁDRO PRÁZDNOTY')
    document.getElementById('boss-hud')?.classList.add('active')
    this.updateBossHp()
  },

  updateBossHp() {
    if (!this.boss) return
    const percent = clamp(this.boss.health / this.boss.maxHealth, 0, 1) * 100
    const fill = document.getElementById('bossHpFill')
    if (fill) fill.style.width = `${percent}%`
  },

  damageBoss(amount) {
    if (!this.boss) return
    this.boss.health -= amount
    this.addScore(200)
    this.updateBossHp()
    const bossObj = this.boss.el.object3D
    bossObj.scale.set(1.08, 1.08, 1.08)
    const bossId = window.setTimeout(() => { bossObj.scale.set(1, 1, 1); this._timeouts.delete(bossId) }, 80)
    this._timeouts.add(bossId)
    if (this.boss.health <= 0) {
      this.createExplosion(bossObj.position, '#ff00ff', 1.2)
      this.boss.el.remove()
      this.boss = null
      this.addScore(5000)
      this.endMission(true)
    }
  },

  takeDamage() {
    if (this.isStarPowerActive()) return
    if (this.powerupTimers.shield > 0) {
      this.powerupTimers.shield = 0
      this.updatePowerupSlots()
      const shield = this.player.object3D.getObjectByName('shield')
      if (shield?.material) {
        shield.material.opacity = 0
        shield.visible = false
      }
      return
    }

    this.lives -= 1
    this.noHitStreak = 0
    this.noHitTimer = 0
    const flash = document.getElementById('damageFlash')
    flash?.classList.add('active')
    const dmgId = window.setTimeout(() => { flash?.classList.remove('active'); this._timeouts.delete(dmgId) }, 120)
    this._timeouts.add(dmgId)
    if (this.lives <= 0) this.endMission(false)
  },

  collectPowerup(powerup) {
    powerup.el.remove()
    this.addScore(50)
    this.powerupTimers[powerup.type] = powerup.type === 'score' ? STAR_POWER_DURATION : 10
    if (powerup.type === 'shield') {
      const shield = this.player.object3D.getObjectByName('shield')
      if (shield?.material) {
        shield.visible = true
        shield.material.opacity = 0.16
      }
    } else if (powerup.type === 'rapid') {
      this.fireRate = 0.08
    }
    this.updatePowerupSlots()
  },

  addScore(points) {
    const actual = Math.floor(points * this.scoreMultiplier)
    this.score += actual
    setText('scoreDisplay', this.score.toLocaleString('cs-CZ'))
    this.showScorePopup(actual)
  },

  showScorePopup(points) {
    const popup = document.createElement('div')
    popup.className = 'score-popup'
    popup.textContent = `+${points}`
    popup.style.left = `${window.innerWidth / 2 + rand(-90, 90)}px`
    popup.style.top = `${window.innerHeight / 2 + rand(-60, 60)}px`
    document.getElementById('mission-ui')?.appendChild(popup)
    const popupId = window.setTimeout(() => { popup.remove(); this._timeouts.delete(popupId) }, 1000)
    this._timeouts.add(popupId)
  },

  createExplosion(position, color = '#ff4400', scale = 1) {
    for (let i = 0; i < 8; i += 1) {
      const particle = createEntity('a-sphere', {
        radius: `${rand(0.1, 0.3) * scale}`,
        position: `${position.x} ${position.y} ${position.z}`,
        material: `color: ${color}; emissive: ${color}; emissiveIntensity: 1`,
      }, this.el)
      const velocity = new this.THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(4, 12) * scale)
      this.particles.push({ el: particle, velocity, life: 0.7 })
    }
  },

  updateHud() {
    const c = this._hudCache
    const scoreText = this.score.toLocaleString('cs-CZ')
    if (c.score !== scoreText) { c.score = scoreText; setText('scoreDisplay', scoreText) }
    if (c.mapName !== this.map.name) { c.mapName = this.map.name; setText('mapName', this.map.name) }

    const progressPct = Math.round(clamp(this.mapTime / this.map.duration, 0, 1) * 100)
    if (c.progress !== progressPct) {
      c.progress = progressPct
      const progress = document.getElementById('mapProgress')
      if (progress) progress.style.width = `${progressPct}%`
    }

    if (c.lives !== this.lives) {
      c.lives = this.lives
      document.querySelectorAll('#heartsDisplay .heart').forEach((heart, index) => {
        heart.classList.toggle('empty', index >= this.lives)
      })
    }
    this.updatePowerupSlots()
  },

  updatePowerupSlots() {
    Object.entries(this.powerupTimers).forEach(([type, time]) => {
      const slot = document.getElementById(`${type}Slot`)
      if (!slot) return
      slot.classList.toggle('active', time > 0)
      let timer = slot.querySelector('.powerup-timer')
      if (time > 0 && !timer) {
        timer = document.createElement('div')
        timer.className = 'powerup-timer'
        slot.appendChild(timer)
      }
      if (timer) {
        timer.textContent = Math.ceil(time)
        if (time <= 0) timer.remove()
      }
    })
  },

  tick(_time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.033)
    this.clockTime += dt

    // Gamepad runs before the state guard so pause/unpause works while paused.
    const gp = gamepadService.getPad()
    const gpState = gp ? gamepadService.update(this.keys, gp) : null
    if (gpState?.systemMenuJustPressed) {
      window.dispatchEvent(new CustomEvent('gamepad-system-menu'))
    }
    if (gpState?.pauseJustPressed) this.togglePause()
    if (gpState?.fireJustPressed) this.fireQueued = true

    if (this.state !== GAME_STATES.PLAYING && this.state !== GAME_STATES.BOSS) {
      this.fireQueued = false
      audioService.stopShipEngine(dt)
      return
    }

    const speed = this.map.speed * this.speedMultiplier
    audioService.updateShipEngine({
      active: true,
      throttle: 0.18 + Math.max(0, this.speedMultiplier - 1),
      speedPct: speed / 65,
      dt,
      mode: 'mission',
    })
    this.updatePlayer(dt)
    if (this.fireQueued) {
      this.fireBullet()
      this.fireQueued = false
    }
    this.updateStarfield(dt, speed)
    this.updatePowerupTimers(dt)

    if (this.state === GAME_STATES.PLAYING) {
      this.updateMapProgress(dt)
      this.updateSpawns(dt)
      this.updateMovingObjects(dt, speed)
    }

    this.updatePowerups(dt, speed)
    this.updateBullets(dt)
    this.updateEnemyBullets(dt)
    this.updateBoss(dt)
    this.updateParticles(dt)
    this.checkCollisions()
    this.updateHud()
  },

  updatePlayer(dt) {
    const player = this.player.object3D
    let targetX = player.userData.targetX
    let targetY = player.userData.targetY

    if (this.keys.a || this.keys.arrowleft) targetX -= 8 * dt
    if (this.keys.d || this.keys.arrowright) targetX += 8 * dt
    if (this.keys.w || this.keys.arrowup) targetY += 6 * dt
    if (this.keys.s || this.keys.arrowdown) targetY -= 6 * dt

    targetX = clamp(targetX, -7, 7)
    targetY = clamp(targetY, -4.5, 4.5)
    player.userData.targetX = targetX
    player.userData.targetY = targetY

    player.position.x = damp(player.position.x, targetX, 7.5, dt)
    player.position.y = damp(player.position.y, targetY, 7.0, dt)
    const prevX = player.userData.prevX ?? player.position.x
    const prevY = player.userData.prevY ?? player.position.y
    const safeDt = Math.max(dt, 1 / 120)
    player.userData.velocityX = (player.position.x - prevX) / safeDt
    player.userData.velocityY = (player.position.y - prevY) / safeDt
    player.userData.prevX = player.position.x
    player.userData.prevY = player.position.y

    const attitude = player.userData.attitude
    const targetRoll = clamp(-player.userData.velocityX * 0.035, -0.3, 0.3)
    const targetPitch = clamp(player.userData.velocityY * 0.025, -0.18, 0.18)
    const targetYaw = clamp(-player.userData.velocityX * 0.012, -0.1, 0.1)
    const roll = springValue(attitude.roll, attitude.rollVelocity, targetRoll, 42, 10, dt)
    const pitch = springValue(attitude.pitch, attitude.pitchVelocity, targetPitch, 36, 9, dt)
    const yaw = springValue(attitude.yaw, attitude.yawVelocity, targetYaw, 34, 9, dt)
    attitude.roll = roll.value
    attitude.rollVelocity = roll.velocity
    attitude.pitch = pitch.value
    attitude.pitchVelocity = pitch.velocity
    attitude.yaw = yaw.value
    attitude.yawVelocity = yaw.velocity
    player.rotation.z = attitude.roll
    player.rotation.x = attitude.pitch
    player.rotation.y = attitude.yaw

    this.playerLight.object3D.position.copy(player.position)
    this.playerLight.object3D.position.z += 2

    const engine = player.getObjectByName('engine')
    if (engine) {
      const flicker = 0.86 + Math.sin(this.clockTime * 30) * 0.09 + Math.random() * 0.08
      const thrust = 1.05
      const outer = engine.getObjectByName('engine-plume-outer')
      const inner = engine.getObjectByName('engine-plume-inner')
      const nozzleGlow = engine.getObjectByName('engine-nozzle-glow')
      if (outer?.material) {
        outer.scale.set(1.02, 1.25 + flicker * 0.18, 1.02)
        outer.material.opacity = 0.34 * flicker
      }
      if (inner?.material) {
        inner.scale.set(0.82, 1.18 + flicker * 0.14, 0.82)
        inner.material.opacity = 0.68 * flicker
      }
      if (nozzleGlow?.material) {
        const glowScale = 0.64 + flicker * 0.08
        nozzleGlow.scale.set(glowScale, glowScale, 1)
        nozzleGlow.material.opacity = 0.48 * flicker
      }
      engine.userData.sparks?.forEach((spark, index) => {
        const cycle = (this.clockTime * spark.userData.speed + spark.userData.seed) % 1
        const angle = spark.userData.seed + this.clockTime * (1.8 + index * 0.04)
        const spread = spark.userData.radius + cycle * 0.18
        spark.position.set(
          Math.cos(angle) * spread,
          Math.sin(angle) * spread * 0.6,
          -cycle * spark.userData.length * thrust,
        )
        const size = 0.05 + cycle * 0.12
        spark.scale.set(size, size, 1)
        spark.material.opacity = (1 - cycle) * 0.34
      })
    }

    const shield = player.getObjectByName('shield')
    if (shield && this.powerupTimers.shield > 0) {
      shield.visible = true
      shield.rotation.y += dt * 2
      shield.scale.setScalar(1 + Math.sin(this.clockTime * 5) * 0.05)
    }
    this.updateStarPowerVisual(dt)
  },

  createStarPowerAura() {
    const T = this.THREE
    this.starPowerAura = new T.Group()
    this.starPowerAura.name = 'star-power-aura'
    this.starPowerMaterials = []
    this.starPowerShipMaterials = []
    this.starPowerOutlineMeshes = []

    this.starPowerAura.visible = false
    this.player.object3D.add(this.starPowerAura)
  },

  isStarPowerActive() {
    return this.powerupTimers.score > 0
  },

  getStarPowerColor(offset = 0) {
    const color = new this.THREE.Color()
    color.setHSL((this.clockTime * 0.32 + offset) % 1, 1, 0.62)
    return `#${color.getHexString()}`
  },

  updateStarPowerVisual(dt = 0, forceOff = false) {
    if (!this.starPowerAura) return
    const active = !forceOff && this.isStarPowerActive()
    this.starPowerAura.visible = active
    const light = this.playerLight?.components?.light?.light
    if (!active) {
      this.restoreStarPowerShipMaterials()
      this.starPowerOutlineMeshes?.forEach((mesh) => { mesh.visible = false })
      if (light) {
        light.color.set('#00aaff')
        light.intensity = 2
        light.distance = 20
      }
      return
    }

    this.ensureStarPowerOutline()
    const pulse = 0.82 + Math.sin(this.clockTime * 12) * 0.18
    this.starPowerOutlineMeshes?.forEach((mesh, index) => {
      mesh.visible = true
      mesh.scale.setScalar(1.09 + Math.sin(this.clockTime * 9 + index) * 0.014)
    })
    this.starPowerMaterials?.forEach((material, index) => {
      material.color.setHSL((this.clockTime * 0.58 + index * 0.22) % 1, 0.86, 0.56)
      material.opacity = 0.45 * pulse
    })
    this.starPowerShipMaterials?.forEach((entry, index) => {
      const hue = (this.clockTime * 0.62 + index * 0.14) % 1
      const material = entry.material
      if (material.color) material.color.setHSL(hue, 0.82, 0.64)
      if (material.emissive) {
        material.emissive.setHSL((hue + 0.08) % 1, 0.9, 0.54)
        material.emissiveIntensity = 2.05 + pulse * 1.35
      }
    })
    if (light) {
      light.color.setHSL((this.clockTime * 0.58) % 1, 0.9, 0.56)
      light.intensity = 4.4
      light.distance = 34
    }
  },

  ensureStarPowerOutline() {
    if (this.starPowerOutlineReady || !this.player?.object3D) return
    const T = this.THREE
    this.player.object3D.updateMatrixWorld(true)
    this.player.object3D.traverse((child) => {
      if (!child.isMesh || child.name?.startsWith?.('star-power')) return
      if (child.parent === this.starPowerAura) return

      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        if (!material || this.starPowerShipMaterials.some((entry) => entry.material === material)) return
        this.starPowerShipMaterials.push({
          material,
          color: material.color?.clone?.() || null,
          emissive: material.emissive?.clone?.() || null,
          emissiveIntensity: material.emissiveIntensity,
        })
      })

      const outlineMaterial = new T.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: T.AdditiveBlending,
        side: T.BackSide,
        toneMapped: false,
      })
      const outline = new T.Mesh(child.geometry, outlineMaterial)
      outline.name = `star-power-outline-${this.starPowerOutlineMeshes.length}`
      outline.renderOrder = 12
      outline.visible = false
      outline.frustumCulled = false
      child.add(outline)
      this.starPowerMaterials.push(outlineMaterial)
      this.starPowerOutlineMeshes.push(outline)
    })
    this.starPowerOutlineReady = true
  },

  restoreStarPowerShipMaterials() {
    this.starPowerShipMaterials?.forEach((entry) => {
      const material = entry.material
      if (entry.color && material.color) material.color.copy(entry.color)
      if (entry.emissive && material.emissive) material.emissive.copy(entry.emissive)
      if (entry.emissiveIntensity !== undefined) material.emissiveIntensity = entry.emissiveIntensity
    })
  },

  disposeStarPowerAura() {
    this.restoreStarPowerShipMaterials()
    this.starPowerOutlineMeshes?.forEach((mesh) => {
      mesh.material?.dispose?.()
      if (mesh.parent) mesh.parent.remove(mesh)
    })
    if (!this.starPowerAura) return
    if (this.starPowerAura.parent) this.starPowerAura.parent.remove(this.starPowerAura)
    this.starPowerAura = null
    this.starPowerMaterials = []
    this.starPowerShipMaterials = []
    this.starPowerOutlineMeshes = []
    this.starPowerOutlineReady = false
  },

  updateStarfield(dt, speed) {
    if (!this.starPositions) return
    for (let i = 0; i < this.starPositions.count; i += 1) {
      let z = this.starPositions.getZ(i) + speed * dt
      let x = this.starPositions.getX(i)
      let y = this.starPositions.getY(i)
      if (z > 10) {
        z = -200
        const angle = Math.random() * Math.PI * 2
        const radius = rand(5, 20)
        x = Math.cos(angle) * radius
        y = Math.sin(angle) * radius
      }
      this.starPositions.setXYZ(i, x, y, z)
    }
    this.starPositions.needsUpdate = true
  },

  updatePowerupTimers(dt) {
    Object.keys(this.powerupTimers).forEach((key) => {
      if (this.powerupTimers[key] <= 0) return
      this.powerupTimers[key] = Math.max(0, this.powerupTimers[key] - dt)
      if (this.powerupTimers[key] === 0) {
        if (key === 'shield') {
          const shield = this.player.object3D.getObjectByName('shield')
          if (shield?.material) {
            shield.material.opacity = 0
            shield.visible = false
          }
        } else if (key === 'rapid') {
          this.fireRate = 0.12
        }
      }
    })
    this.speedMultiplier = this.powerupTimers.rapid > 0 ? 1.08 : 1
  },

  updateMapProgress(dt) {
    this.mapTime += dt
    this.spawnTimers.enemy += dt
    this.spawnTimers.asteroid += dt
    this.spawnTimers.mine += dt
    this.spawnTimers.powerup += dt

    this.noHitTimer += dt
    if (this.noHitTimer >= 10) {
      this.noHitTimer = 0
      this.noHitStreak += 1
      this.addScore(500)
    }

    if (this.mapTime >= this.map.duration) {
      this.addScore(1000)
      this.startBossFight(this.currentMap === 0 ? 1 : this.currentMap === 1 ? 2 : 3)
    }
  },

  updateSpawns() {
    if (this.map.enemyRate > 0 && this.spawnTimers.enemy > 1 / this.map.enemyRate) {
      this.spawnTimers.enemy = 0
      if (Math.random() < 0.7) this.spawnEnemy()
    }
    if (this.spawnTimers.asteroid > 1 / this.map.asteroidRate) {
      this.spawnTimers.asteroid = 0
      if (Math.random() < 0.8) this.spawnAsteroid()
    }
    if (this.spawnTimers.mine > 1 / this.map.mineRate) {
      this.spawnTimers.mine = 0
      if (Math.random() < 0.5) this.spawnMine()
    }
    if (this.spawnTimers.powerup > 8) {
      this.spawnTimers.powerup = 0
      if (Math.random() < 0.35) this.spawnPowerup()
    }
  },

  updateMovingObjects(dt, speed) {
    const moveObjects = (array) => {
      array.forEach((object) => {
        const obj = object.el.object3D
        obj.position.z += speed * dt
        if (obj.userData.rotationSpeed) {
          obj.rotation.x += obj.userData.rotationSpeed.x * dt
          obj.rotation.y += obj.userData.rotationSpeed.y * dt
          obj.rotation.z += obj.userData.rotationSpeed.z * dt
        } else {
          obj.rotation.x += dt
          obj.rotation.y += dt * 0.7
        }
      })
      return array.filter((object) => {
        if (object.el.object3D.position.z <= 15) return true
        object.el.remove()
        return false
      })
    }
    this.enemies = moveObjects(this.enemies)
    this.asteroids = moveObjects(this.asteroids)
    this.mines = moveObjects(this.mines)

    this.enemies.forEach((enemy) => {
      enemy.shootTimer -= dt
      if (enemy.shootTimer <= 0) {
        enemy.shootTimer = rand(2, 4)
        if (Math.random() < 0.3) this.fireEnemyBullet(enemy)
      }
    })
  },

  updatePowerups(dt, speed) {
    this.powerups.forEach((powerup) => {
      const obj = powerup.el.object3D
      obj.position.z += speed * dt * 0.8
      obj.rotation.y += powerup.rotationSpeed
      obj.position.y += Math.sin(this.clockTime * 3 + powerup.floatOffset) * 0.01
    })
    this.powerups = this.powerups.filter((powerup) => {
      if (powerup.el.object3D.position.z <= 15) return true
      powerup.el.remove()
      return false
    })
  },

  updateBullets(dt) {
    this.bullets.forEach((bullet) => {
      if (bullet.velocity) bullet.el.object3D.position.addScaledVector(bullet.velocity, dt)
      else bullet.el.object3D.position.z -= 80 * dt
    })
    this.bullets = this.bullets.filter((bullet) => {
      const pos = bullet.el.object3D.position
      if (Math.abs(pos.x) < 180 && Math.abs(pos.y) < 120 && pos.z > -180 && pos.z < 120) return true
      bullet.el.remove()
      return false
    })
  },

  updateEnemyBullets(dt) {
    this.enemyBullets.forEach((bullet) => {
      if (bullet.velocity) bullet.el.object3D.position.addScaledVector(bullet.velocity, dt)
      else bullet.el.object3D.position.z += 40 * dt
    })
    this.enemyBullets = this.enemyBullets.filter((bullet) => {
      const z = bullet.el.object3D.position.z
      if (z < 18 && z > -130) return true
      bullet.el.remove()
      return false
    })
  },

  updateBoss(dt) {
    if (!this.boss) return
    const boss = this.boss
    const obj = boss.el.object3D
    boss.moveTimer += dt

    if (boss.type === 1) {
      obj.position.x = Math.sin(boss.moveTimer * 1.8) * 5
      obj.position.y = Math.cos(boss.moveTimer * 1.2) * 2
    } else if (boss.type === 2) {
      obj.position.x = Math.sin(boss.moveTimer * 1.4) * 6
      obj.position.y = Math.sin(boss.moveTimer * 2.2) * 2
      boss.orbitAngle += dt
    } else {
      obj.position.x = Math.sin(boss.moveTimer * 0.8) * 4
      obj.position.y = Math.cos(boss.moveTimer * 0.7) * 2
      boss.phase = boss.health / boss.maxHealth > 0.66 ? 1 : boss.health / boss.maxHealth > 0.33 ? 2 : 3
    }

    boss.shootTimer -= dt
    const interval = boss.type === 3 ? (boss.phase === 1 ? 1 : boss.phase === 2 ? 0.7 : 0.5) : 0.9
    if (boss.shootTimer > 0) return
    boss.shootTimer = interval

    if (boss.type === 3 && boss.phase >= 2 && Math.random() < 0.45) {
      const count = boss.phase === 2 ? 8 : 12
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + boss.moveTimer
        const bullet = createEntity('a-sphere', {
          radius: '0.16',
          position: `${obj.position.x} ${obj.position.y} ${obj.position.z + 2}`,
          material: 'color: #ff00ff; emissive: #ff00ff; emissiveIntensity: 1',
        }, this.el)
        const velocity = new this.THREE.Vector3(Math.cos(angle) * 18, Math.sin(angle) * 18, 32)
        this.enemyBullets.push({ el: bullet, radius: 0.25, velocity })
      }
    } else {
      const bullet = createEntity('a-sphere', {
        radius: '0.18',
        position: `${obj.position.x} ${obj.position.y} ${obj.position.z + 2}`,
        material: 'color: #ff0044; emissive: #ff0044; emissiveIntensity: 1',
      }, this.el)
      const velocity = new this.THREE.Vector3()
        .subVectors(this.player.object3D.position, obj.position)
        .normalize()
        .multiplyScalar(34)
      this.enemyBullets.push({ el: bullet, radius: 0.3, velocity })
    }
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
    const playerPos = this.player.object3D.position
    const playerRadius = 1.2
    const starPowerActive = this.isStarPowerActive()

    const hitPlayerObject = (array) => array.filter((object) => {
      if (playerPos.distanceTo(object.el.object3D.position) >= playerRadius + object.radius) return true
      if (starPowerActive) {
        this.addScore(object.points || 100)
        this.createExplosion(object.el.object3D.position, this.getStarPowerColor(0.18), 0.85)
      } else {
        this.takeDamage()
        this.createExplosion(object.el.object3D.position, object.type === 'mine' ? '#ff0000' : '#ff4400', 0.6)
      }
      object.el.remove()
      return false
    })

    this.enemies = hitPlayerObject(this.enemies)
    this.asteroids = hitPlayerObject(this.asteroids)
    this.mines = hitPlayerObject(this.mines)

    this.powerups = this.powerups.filter((powerup) => {
      if (playerPos.distanceTo(powerup.el.object3D.position) >= playerRadius + powerup.radius) return true
      this.collectPowerup(powerup)
      return false
    })

    this.bullets = this.bullets.filter((bullet) => {
      const bulletPos = bullet.el.object3D.position

      if (this.boss && bulletPos.distanceTo(this.boss.el.object3D.position) < this.boss.radius) {
        this.createExplosion(bulletPos, '#00ffff', 0.3)
        bullet.el.remove()
        this.damageBoss(1)
        return false
      }

      const objectArrays = [this.enemies, this.asteroids, this.mines]
      for (const array of objectArrays) {
        const hit = array.find((object) => bulletPos.distanceTo(object.el.object3D.position) < object.radius)
        if (hit) {
          this.addScore(hit.points)
          this.createExplosion(hit.el.object3D.position, hit.type === 'enemy' ? '#ff4400' : hit.type === 'asteroid' ? '#888888' : '#ff0000')
          hit.el.remove()
          bullet.el.remove()
          this.enemies = this.enemies.filter((object) => object !== hit)
          this.asteroids = this.asteroids.filter((object) => object !== hit)
          this.mines = this.mines.filter((object) => object !== hit)
          return false
        }
      }
      return true
    })

    this.enemyBullets = this.enemyBullets.filter((bullet) => {
      if (bullet.el.object3D.position.distanceTo(playerPos) >= playerRadius + bullet.radius) return true
      if (starPowerActive) {
        this.createExplosion(bullet.el.object3D.position, this.getStarPowerColor(0.45), 0.36)
      } else {
        this.takeDamage()
        this.createExplosion(bullet.el.object3D.position, '#ff0044', 0.3)
      }
      bullet.el.remove()
      return false
    })
  },

  endMission(completed) {
    if (this.ended) return
    this.ended = true
    this.state = completed ? GAME_STATES.VICTORY : GAME_STATES.GAME_OVER
    if (completed) {
      window.dispatchEvent(new CustomEvent('mission-ended', {
        detail: { completed: true, planetIndex: this.data.planetIndex, score: this.score },
      }))
      setText('victoryScore', this.score.toLocaleString('cs-CZ'))
      const copy = document.querySelector('#victoryMenu .victory-copy')
      if (copy) copy.textContent = this.currentMap === 2 ? 'Porazil jsi Jádro Prázdnoty!' : 'Mise dokončena!'
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
    }

    this.clearAllObjects()
    this.disposeStarPowerAura()
    audioService.stopAll()
    this.fireReticle = null
    if (this.starfield) {
      this.starfield.geometry?.dispose?.()
      this.starfield.material?.dispose?.()
    }
    this.el.removeObject3D('mission-stars')
    document.getElementById('boss-hud')?.classList.remove('active', 'show')
    document.querySelectorAll('#mission-ui .score-popup').forEach((popup) => popup.remove())
  },
})
