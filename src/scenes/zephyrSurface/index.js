import { gameState, getPlanet } from '../../services/gameState.js'
import { audioService } from '../../services/audioService.js'
import { gamepadService } from '../../services/gamepadService.js'
import { gamepadNavService } from '../../services/gamepadNavService.js'
import * as surfaceConstants from './constants.js'
import { createEntity, damp } from './utils.js'
import { cameraMethods } from './cameraMethods.js'
import { beaconMethods } from './beaconMethods.js'
import { heroMethods } from './heroMethods.js'
import { laserMethods } from './laserMethods.js'
import { levelMethods } from './levelMethods.js'
import { missionMethods } from './missionMethods.js'
import { zombieMethods } from './zombieMethods.js'

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
  MAX_NIGHTS,
  SCORE_POPUP_DURATION_MS,
  ZOMBIE_CLIPS,
  ZOMBIE_ROOT_MOTION_CLIPS,
  ROOT_MOTION_CLIPS,
  SURFACE_CONTROL_KEYS,
} = surfaceConstants

AFRAME.registerComponent('zephyr-surface', {
  schema: {
    planetIndex: { type: 'int', default: 0 },
  },

  init() {
    this.THREE = AFRAME.THREE
    requestAnimationFrame(() => {
      const shadowMap = this.el.renderer?.shadowMap
      if (!shadowMap) return
      shadowMap.enabled = true
      shadowMap.type = this.THREE.PCFSoftShadowMap
    })
    this.planet = getPlanet(this.data.planetIndex)
    this.character = gameState.getSelectedCharacter()
    this.characterPosition = new this.THREE.Vector3(CHARACTER_POSITION.x, CHARACTER_POSITION.y, CHARACTER_POSITION.z)
    this.characterYaw = CHARACTER_BASE_YAW
    this.moveSpeed = 0
    this.turnSpeed = 0
    this.movementLocked = false
    this.armed = false
    this.actionLocked = false
    this.fireCooldown = 0
    this.verticalVelocity = 0
    this.grounded = false
    this.actionTimer = null
    this.jumpTimer = null
    this.weaponTimer = null
    this.surfaceControlsTimer = null
    this.weaponObjects = []
    this.nextPunchLeft = true
    this.queuedMeleeCount = 0
    this.queuedFireCount = 0
    this.fireSequenceActive = false
    this.isJumping = false
    this.jumpTime = 0
    this.jumpDuration = JUMP_FALLBACK_MS / 1000
    this.forwardVector = new this.THREE.Vector3()
    this.rightVector = new this.THREE.Vector3()
    this.cameraOffset = new this.THREE.Vector3()
    this.localForward = new this.THREE.Vector3(0, 0, 1)
    this.localRight = new this.THREE.Vector3(1, 0, 0)
    this.yAxis = new this.THREE.Vector3(0, 1, 0)
    this.clipDurations = new Map()
    this.lasers = new Set()
    this.zombies = new Set()
    this.laserMuzzleMarker = null
    this.surfaceReticle = null
    this.surfaceReticlePulse = 0
    this.nightOverlay = null
    this.dayNightTime = 0
    this.dayNightPhase = 'day'
    this.wasNight = false
    this.nightSurvived = false
    this.nightSurvivalAwarded = false
    this.zombieSpawnTimer = ZOMBIE_SPAWN_INTERVAL
    this.zombieSpawnCursor = 0
    this.dayBeacons = []
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
    this.shownDayBriefings = new Set()
    this.playerDamageCooldown = 0
    this.damageFlashTimer = null
    this.cameraShake = 0
    this.daySkyColor = new this.THREE.Color(DAY_SKY_COLOR)
    this.nightSkyColor = new this.THREE.Color(NIGHT_SKY_COLOR)
    this.skyColor = new this.THREE.Color()
    this.ambientColorDay = new this.THREE.Color('#ffffff')
    this.ambientColorNight = new this.THREE.Color('#9fbaff')
    this.ambientColor = new this.THREE.Color()
    this.moonColorDay = new this.THREE.Color('#ffffff')
    this.moonColorNight = new this.THREE.Color('#d6e6ff')
    this.moonColor = new this.THREE.Color()
    this.hemiColorDay = new this.THREE.Color('#bde7ff')
    this.hemiColorNight = new this.THREE.Color('#6f98ce')
    this.hemiColor = new this.THREE.Color()
    this.hemiGroundDay = new this.THREE.Color('#18253d')
    this.hemiGroundNight = new this.THREE.Color('#1a2740')
    this.hemiGroundColor = new this.THREE.Color()
    this.groundRaycaster = new this.THREE.Raycaster()
    this.rayOrigin = new this.THREE.Vector3()
    this.downVector = new this.THREE.Vector3(0, -1, 0)
    this.proposedPosition = new this.THREE.Vector3()
    this.surfaceMeshes = []
    this._groundHeightCache = null
    this.collisionBoxes = []
    this.collisionCircles = []
    this.collisionPolygons = []
    this.waterPolygons = []
    this.zombieSpawnPoints = []
    this.debugTreeColliderEls = []
    this.debugRockColliderEls = []
    this.keys = {}
    this.activeClip = null
    this.onModelLoaded = (event) => this.fitSurfaceModel(event.detail.model)
    this.onCharacterLoaded = (event) => this.fitCharacterModel(event.detail.model)
    this.onReturnMap = () => window.dispatchEvent(new CustomEvent('return-map'))
    this.onDayBriefingContinue = () => this.closeDayBriefing()
    this.onKeyDown = (event) => {
      if (this.surfaceBriefingOpen) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        if (!event.repeat && (event.code === 'Enter' || event.code === 'Space' || event.code === 'Escape')) {
          this.closeDayBriefing()
        }
        return
      }
      if (SURFACE_CONTROL_KEYS.has(event.code)) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
      }
      if (!event.repeat && event.code === 'KeyR') {
        this.toggleWeapon()
        return
      }
      if (!event.repeat && event.code === 'Space') {
        this.jump()
        return
      }
      if (!event.repeat && event.code === 'KeyF') {
        this.handlePrimaryAction()
        return
      }
      if (!event.repeat && event.code === 'KeyQ') {
        this.handleBeaconAction()
        return
      }
      // Debug zombie spawn is intentionally disabled for normal mission flow.
      // if (!event.repeat && event.code === 'KeyZ') {
      //   this.debugSpawnZombieInFront()
      //   return
      // }
      this.keys[event.key.toLowerCase()] = true
      this.keys[event.code.toLowerCase()] = true
    }
    this.onKeyUp = (event) => {
      if (SURFACE_CONTROL_KEYS.has(event.code)) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
      }
      this.keys[event.key.toLowerCase()] = false
      this.keys[event.code.toLowerCase()] = false
    }

    this.setupUi()
    this.buildScene()
    this.activateCamera()
    this.showDayBriefing(this.currentNight)
    window.addEventListener('keydown', this.onKeyDown, true)
    window.addEventListener('keyup', this.onKeyUp, true)
    audioService.stopShipEngine()
    audioService.stopMusic()
  },

  ...missionMethods,

  buildScene() {
    this.sky = createEntity('a-sky', {
      color: DAY_SKY_COLOR,
    }, this.el)

    this.ambientLight = createEntity('a-entity', {
      light: 'type: ambient; color: #ffffff; intensity: 0.48',
    }, this.el)
    this.sunLight = createEntity('a-entity', {
      id: 'zephyr-sunlight',
      light: `type: directional; color: ${SUN_LIGHT_COLOR}; intensity: 1.45; castShadow: true; shadowBias: -0.00025; shadowCameraTop: 70; shadowCameraBottom: -70; shadowCameraLeft: -70; shadowCameraRight: 70; shadowCameraNear: 0.2; shadowCameraFar: 160; shadowMapWidth: 2048; shadowMapHeight: 2048`,
      position: '-24 8 -18',
    }, this.el)
    this.moonLight = createEntity('a-entity', {
      id: 'zephyr-moonlight',
      light: 'type: directional; color: #d6e6ff; intensity: 0',
      position: '-10 14 7',
    }, this.el)
    this.hemisphereLight = createEntity('a-entity', {
      light: 'type: hemisphere; color: #bde7ff; groundColor: #18253d; intensity: 0.42',
    }, this.el)
    this.moon = createEntity('a-sphere', {
      id: 'zephyr-moon',
      radius: '1.4',
      position: '-18 26 -24',
      material: 'color: #d7e7ff; emissive: #d7e7ff; emissiveIntensity: 1.15; shader: flat; transparent: true; opacity: 0',
    }, this.el)
    this.sun = createEntity('a-sphere', {
      id: 'zephyr-sun',
      radius: '1.15',
      position: '-24 8 -18',
      material: `color: ${SUN_COLOR}; emissive: ${SUN_COLOR}; emissiveIntensity: 1.6; shader: flat; transparent: true; opacity: 1`,
    }, this.el)
    this.updateDayNightCycle(0)

    this.surface = createEntity('a-entity', {
      id: 'zephyr-surface-map',
      'gltf-model': `url(${SURFACE_MODEL_URL})`,
      position: '0 0 0',
      shadow: 'cast: true; receive: true',
    }, this.el)
    this.sunLight.setAttribute('shadow-camera-automatic', '#zephyr-surface-map')
    this.surface.addEventListener('model-loaded', this.onModelLoaded)

    this.characterRoot = createEntity('a-entity', {
      id: 'zephyr-character',
      position: `${this.characterPosition.x} ${this.characterPosition.y} ${this.characterPosition.z}`,
      rotation: `0 ${this.characterYaw} 0`,
      scale: '0.1 0.1 0.1',
    }, this.el)
    this.characterModel = createEntity('a-entity', {
      id: 'zephyr-character-model',
      'gltf-model': `url(${this.character.modelUrl})`,
      shadow: 'cast: true; receive: false',
    }, this.characterRoot)
    this.characterModel.addEventListener('model-loaded', this.onCharacterLoaded)
    this.laserMuzzleMarker = createEntity('a-sphere', {
      id: 'zephyr-laser-muzzle-origin',
      radius: `${LASER_BOLT_RADIUS}`,
      position: '0 0 0',
      visible: 'false',
      material: `color: ${LASER_COLOR}; shader: flat; transparent: true; opacity: 0`,
    }, this.el)
    this.createSurfaceReticle()

    this.cameraRig = createEntity('a-entity', {
      id: 'zephyr-camera-rig',
      position: '0 0 0',
      rotation: `${THIRD_PERSON_ROTATION.x} ${THIRD_PERSON_ROTATION.y} ${THIRD_PERSON_ROTATION.z}`,
    }, this.el)
    this.camera = createEntity('a-entity', {
      id: 'mission-camera',
      camera: 'active: true; fov: 64; near: 0.05; far: 1800',
    }, this.cameraRig)
    this.setThirdPersonCamera()
  },

  ...levelMethods,
  ...heroMethods,
  ...beaconMethods,
  ...laserMethods,
  ...zombieMethods,
  ...cameraMethods,

  tick(_time, deltaMs) {
    const dt = Math.min((deltaMs || 16) / 1000, 0.05)
    this.fireCooldown = Math.max(0, this.fireCooldown - dt)

    const gp = gamepadService.getPad()
    const gpState = gp ? gamepadService.update(this.keys, gp) : null
    if (gpState?.systemMenuJustPressed) {
      window.dispatchEvent(new CustomEvent('gamepad-system-menu'))
    } else if (gpState?.pauseJustPressed) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }))
    }

    if (this.surfaceBriefingOpen) {
      this.updateSurfaceReticle(dt)
      this.updateLaserMuzzleMarker()
      this.setThirdPersonCamera()
      return
    }
    if (!this.surfaceGameOver && !this.surfaceVictory) {
      if (gpState?.fireJustPressed) this.handlePrimaryAction()
      if (gpState?.westJustPressed) this.toggleWeapon()
      if (gpState?.northJustPressed) this.jump()
      if (gpState?.shoulderJustPressed) this.handleBeaconAction()
    }
    const movementLocked = this.isCharacterMovementLocked()
    const gpForward = gpState ? -gpState.leftY : 0
    const gpTurn = gpState ? gpState.leftX : 0
    const digitalForward = movementLocked ? 0 : (this.keys.w || this.keys.arrowup ? 1 : 0) - (this.keys.s || this.keys.arrowdown ? 1 : 0)
    const digitalTurn = movementLocked ? 0 : (this.keys.d || this.keys.arrowright ? 1 : 0) - (this.keys.a || this.keys.arrowleft ? 1 : 0)
    const forward = movementLocked ? 0 : (gpState ? (gpForward !== 0 ? gpForward : digitalForward) : digitalForward)
    const turn = movementLocked ? 0 : (gpState ? (gpTurn !== 0 ? gpTurn : digitalTurn) : digitalTurn)
    if (!movementLocked && (forward !== 0 || turn !== 0)) this.cancelFireSequenceForMovement()
    const sprinting = !!(this.keys.shift || this.keys.shiftleft || this.keys.shiftright || gpState?.forwardThrottle > 0.12 || gpState?.startPressed)
    const forwardSpeed = this.armed
      ? (sprinting ? ARMED_RUN_SPEED : ARMED_WALK_SPEED)
      : (sprinting ? RUN_SPEED : WALK_SPEED)
    const backwardSpeed = this.armed ? ARMED_WALK_SPEED * 0.68 : WALK_SPEED * 0.62
    const targetMoveSpeed = forward > 0 ? forwardSpeed * forward : forward < 0 ? -backwardSpeed * -forward : 0
    const targetTurnSpeed = -turn * TURN_SPEED

    this.moveSpeed = damp(this.moveSpeed, targetMoveSpeed, forward === 0 ? 9 : 6, dt)
    this.turnSpeed = damp(this.turnSpeed, targetTurnSpeed, turn === 0 ? 12 : 8, dt)
    this.characterYaw += this.turnSpeed * dt

    if (this.characterRoot?.object3D) {
      this.characterRoot.object3D.rotation.y = this.THREE.MathUtils.degToRad(this.characterYaw)
    }

    this.proposedPosition.copy(this.characterPosition)
    if (Math.abs(this.moveSpeed) > 0.001 && this.characterRoot?.object3D) {
      this.forwardVector.copy(this.localForward).applyQuaternion(this.characterRoot.object3D.quaternion)
      this.forwardVector.y = 0
      this.forwardVector.normalize()
      this.proposedPosition.addScaledVector(this.forwardVector, this.moveSpeed * dt)
    }
    this.resolveHorizontalCollisions(this.proposedPosition, this.characterPosition)
    this.applyGravity(this.proposedPosition, dt)
    this.characterPosition.copy(this.proposedPosition)

    if (this.characterRoot?.object3D) {
      this.characterRoot.object3D.position.copy(this.characterPosition)
    }

    this.updateLocomotionClip()
    this.updateSurfaceReticle(dt)
    this.updateLaserMuzzleMarker()
    this.updateDayNightCycle(dt)
    this.updateNightGameplay(dt)
    this.updateDayBeacons(dt)
    this.updateLaserBolts(dt)

    this.setThirdPersonCamera()
  },

  remove() {
    this.surface?.removeEventListener('model-loaded', this.onModelLoaded)
    this.characterModel?.removeEventListener('model-loaded', this.onCharacterLoaded)
    window.clearTimeout(this.actionTimer)
    window.clearTimeout(this.jumpTimer)
    window.clearTimeout(this.weaponTimer)
    window.clearTimeout(this.surfaceControlsTimer)
    window.clearTimeout(this.damageFlashTimer)
    this.lasers.forEach((laser) => {
      laser.remove()
    })
    this.lasers.clear()
    this.clearAllZombies()
    this.clearDayBeacons()
    this.clearDebugTreeColliders()
    this.clearDebugRockColliders()
    window.removeEventListener('keydown', this.onKeyDown, true)
    window.removeEventListener('keyup', this.onKeyUp, true)
    this.panel?.querySelector('#surfaceMapButton')?.removeEventListener('click', this.onReturnMap)
    this.surfaceBriefingButton?.removeEventListener('click', this.onDayBriefingContinue)
    this.panel?.remove()
    this.surfaceControlsPanel?.remove()
    this.surfaceOverlay?.remove()
    this.surfaceBriefingOverlay?.remove()
    this.nightOverlay?.remove()
    this.surfaceReticle?.remove()
    document.querySelectorAll('#mission-ui .surface-score-popup').forEach((popup) => popup.remove())
    this.missionUi?.classList.remove('surface-mission-ui')
    gamepadNavService.remove('zephyr-surface')
    audioService.stopAll()
  }
})
