import * as surfaceConstants from './constants.js'

const {
  SURFACE_MODEL_URL,
  ZOMBIE_MODEL_URL,
  DAY_SKY_COLOR,
  NIGHT_SKY_COLOR,
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

export const heroMethods = {
  snapCharacterToGround() {
    const groundY = this.getGroundHeight(this.characterPosition)
    if (groundY === null) return
    this.characterPosition.y = this.getCharacterRootYForGround(groundY)
    this.grounded = true
    this.verticalVelocity = 0
    this.characterRoot?.object3D.position.copy(this.characterPosition)
  },

  fitCharacterModel(model) {
    if (!model) return

    const box = new this.THREE.Box3().setFromObject(model)
    const size = box.getSize(new this.THREE.Vector3())
    const height = size.y || Math.max(size.x, size.z, 1)
    if (!Number.isFinite(height) || height <= 0) return

    const scale = CHARACTER_HEIGHT / height
    model.scale.multiplyScalar(scale)
    model.updateMatrixWorld(true)
    this.setModelShadows?.(model, { cast: true, receive: false })

    const fittedBox = new this.THREE.Box3().setFromObject(model)
    const fittedCenter = fittedBox.getCenter(new this.THREE.Vector3())
    const rootWorld = this.characterRoot.object3D.getWorldPosition(new this.THREE.Vector3())
    this.applyWorldDeltaToObject(model, new this.THREE.Vector3(
      rootWorld.x - fittedCenter.x,
      rootWorld.y - CHARACTER_GROUND_OFFSET - fittedBox.min.y,
      rootWorld.z - fittedCenter.z,
    ))

    model.traverse((child) => {
      if (/^LaserGun/i.test(child.name || '')) {
        this.weaponObjects.push(child)
      }
      if (!child.isMesh || !child.material) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        material.roughness = Math.max(material.roughness ?? 0.55, 0.5)
        material.metalness = Math.min(material.metalness ?? 0.35, 0.45)
      })
    })

    this.clipDurations = new Map((model.animations || []).map((clip) => [clip.name, clip.duration]))
    this.setWeaponVisible(false)
    this.lockRootMotion(model)
    this.setCharacterClip(IDLE_CLIP)
  },

  applyWorldDeltaToObject(object, deltaWorld) {
    const parent = object.parent
    if (!parent) {
      object.position.add(deltaWorld)
      object.updateMatrixWorld(true)
      return
    }

    parent.updateMatrixWorld(true)
    object.updateMatrixWorld(true)
    const worldBase = object.getWorldPosition(new this.THREE.Vector3())
    const localBase = parent.worldToLocal(worldBase.clone())
    const localTarget = parent.worldToLocal(worldBase.clone().add(deltaWorld))
    object.position.add(localTarget.sub(localBase))
    object.updateMatrixWorld(true)
  },

  getClipDurationMs(clip, fallbackDurationMs) {
    return Math.max(120, (this.clipDurations.get(clip) || fallbackDurationMs / 1000) * 1000)
  },

  lockRootMotion(model, { lockZombieBody = false } = {}) {
    const animations = model.animations || []
    animations.forEach((clip) => {
      const clipName = clip.name.includes('|') ? clip.name.split('|').pop() : clip.name
      const locksCharacterMotion = ROOT_MOTION_CLIPS.has(clipName)
      const locksZombieMotion = ZOMBIE_ROOT_MOTION_CLIPS.has(clipName)
      clip.tracks.forEach((track) => {
        const isCharacterRootTrack = track.name.includes('Hips.position') || track.name.includes('Body.position')
        const isZombieRootTrack = (locksZombieMotion || lockZombieBody) && track.name.includes('Body.position')
        if (!locksCharacterMotion && !locksZombieMotion && !isZombieRootTrack) return
        if (!isCharacterRootTrack && !isZombieRootTrack) return
        const values = track.values
        if (!values || values.length < 3) return
        const baseX = values[0]
        const baseY = values[1]
        const baseZ = values[2]
        for (let i = 0; i < values.length; i += 3) {
          values[i] = baseX
          values[i + 1] = baseY
          values[i + 2] = baseZ
        }
      })
    })
  },

  setCharacterClip(clip) {
    if (this.activeClip === clip || !this.characterModel) return
    this.activeClip = clip
    this.characterModel.setAttribute('animation-mixer', `clip: ${clip}; loop: repeat; crossFadeDuration: 0.35`)
  },

  restartCharacterClip(value) {
    if (!this.characterModel) return
    this.characterModel.removeAttribute('animation-mixer')
    requestAnimationFrame(() => {
      this.characterModel?.setAttribute('animation-mixer', value)
    })
  },

  playCharacterClip(clip, value) {
    if (!this.characterModel) return
    if (this.activeClip === clip) {
      this.restartCharacterClip(value)
    } else {
      this.characterModel.setAttribute('animation-mixer', value)
    }
    this.activeClip = clip
  },

  playOneShotClip(clip, fallbackDurationMs, onDone) {
    if (!this.characterModel) return
    window.clearTimeout(this.actionTimer)
    this.actionLocked = true
    this.playCharacterClip(clip, `clip: ${clip}; loop: once; clampWhenFinished: true; crossFadeDuration: 0.18`)
    const durationMs = this.getClipDurationMs(clip, fallbackDurationMs)
    this.actionTimer = window.setTimeout(() => {
      this.actionLocked = false
      this.actionTimer = null
      const startedNextAction = onDone?.() === true
      if (!startedNextAction && !this.actionLocked) this.updateLocomotionClip()
    }, durationMs)
  },

  playTimedClip(clip, durationMs, { onDone = null, release = true } = {}) {
    if (!this.characterModel) return
    window.clearTimeout(this.actionTimer)
    this.actionLocked = true
    this.activeClip = clip
    this.restartCharacterClip(`clip: ${clip}; loop: once; clampWhenFinished: false; crossFadeDuration: 0.18`)
    this.actionTimer = window.setTimeout(() => {
      this.actionLocked = false
      this.actionTimer = null
      const startedNextAction = onDone?.() === true
      if (release && !startedNextAction && !this.actionLocked) this.updateLocomotionClip()
    }, durationMs)
  },

  updateLocomotionClip() {
    if (this.isJumping) return
    if (this.actionLocked) return
    this.setCharacterClip(this.getLocomotionClip())
  },

  toggleWeapon() {
    if (this.actionLocked) return
    window.clearTimeout(this.weaponTimer)
    this.movementLocked = true
    this.moveSpeed = 0
    this.turnSpeed = 0
    if (this.armed) {
      const durationMs = this.getClipDurationMs(PUT_BACK_RIFLE_CLIP, 700)
      this.weaponTimer = window.setTimeout(() => this.setWeaponVisible(false), durationMs * 0.5)
      this.playOneShotClip(PUT_BACK_RIFLE_CLIP, 700, () => {
        this.armed = false
        this.movementLocked = false
        this.setWeaponVisible(false)
        this.updateSurfaceReticle()
      })
    } else {
      this.setWeaponVisible(false)
      const durationMs = this.getClipDurationMs(GRAB_RIFLE_CLIP, 700)
      this.weaponTimer = window.setTimeout(() => this.setWeaponVisible(true), durationMs * 0.5)
      this.playOneShotClip(GRAB_RIFLE_CLIP, 700, () => {
        this.armed = true
        this.movementLocked = false
        this.setWeaponVisible(true)
        this.updateSurfaceReticle()
      })
    }
  },

  setWeaponVisible(visible) {
    this.weaponObjects.forEach((object) => {
      object.visible = visible
      object.traverse?.((child) => {
        child.visible = visible
      })
    })
  },

  isCharacterMovementLocked() {
    return this.movementLocked || this.surfaceBriefingOpen || this.surfaceGameOver || this.surfaceVictory
  },

  handlePrimaryAction() {
    if (this.armed) {
      this.fireLaser()
    } else {
      this.meleeAttack()
    }
  },

  meleeAttack() {
    if (this.actionLocked) {
      this.queuedMeleeCount = Math.min(this.queuedMeleeCount + 1, 4)
      return
    }
    this.startMeleeStrike()
  },

  startMeleeStrike() {
    if (!this.characterModel) return
    const clip = this.nextPunchLeft ? PUNCH_LEFT_CLIP : PUNCH_RIGHT_CLIP
    this.nextPunchLeft = !this.nextPunchLeft
    this.playTimedClip(clip, this.getClipDurationMs(clip, 560), { onDone: () => {
      if (this.queuedMeleeCount > 0) {
        this.queuedMeleeCount -= 1
        this.startMeleeStrike()
        return true
      }
      return false
    } })
  },

  jump() {
    if (this.armed || this.isJumping || !this.grounded || this.moveSpeed <= 0.03) return
    const durationMs = this.getClipDurationMs(JUMP_CLIP, JUMP_FALLBACK_MS)
    window.clearTimeout(this.jumpTimer)
    this.isJumping = true
    this.jumpTime = 0
    this.jumpDuration = durationMs / 1000
    this.grounded = false
    this.verticalVelocity = JUMP_VELOCITY
    this.activeClip = JUMP_CLIP
    this.restartCharacterClip(`clip: ${JUMP_CLIP}; loop: once; clampWhenFinished: false; crossFadeDuration: 0.12`)
    this.jumpTimer = window.setTimeout(() => {
      this.endJump()
      this.jumpTimer = null
    }, durationMs)
  },

  endJump() {
    if (!this.isJumping) return
    this.isJumping = false
    this.blendFromJumpToLocomotion()
  },

  getLocomotionClip() {
    const isMoving = Math.abs(this.moveSpeed) > 0.03
    const isRunning = Math.abs(this.moveSpeed) > WALK_SPEED * 1.08
    if (!this.armed) {
      if (!isMoving) return IDLE_CLIP
      return isRunning
        ? (this.moveSpeed >= 0 ? RUN_CLIP : RUN_BACKWARD_CLIP)
        : WALK_CLIP
    }
    if (!isMoving) return RIFLE_IDLE_CLIP
    if (this.moveSpeed < 0) return RIFLE_BACKWARD_CLIP
    return RIFLE_RUN_CLIP
  },

  blendFromJumpToLocomotion() {
    if (this.actionLocked) return
    const clip = this.getLocomotionClip()
    this.activeClip = clip
    this.characterModel?.setAttribute('animation-mixer', `clip: ${clip}; loop: repeat; crossFadeDuration: ${JUMP_LAND_BLEND_MS / 1000}`)
  },

  fireLaser() {
    if (!this.armed || !this.characterRoot?.object3D) return
    if (Math.abs(this.moveSpeed) > 0.03) {
      if (this.fireCooldown > 0) return
      this.fireCooldown = FIRE_COOLDOWN_MS / 1000
      this.createLaserBeam()
      return
    }

    this.queuedFireCount = Math.min(this.queuedFireCount + 1, 8)
    this.startFireSequence()
  },

  startFireSequence() {
    if (this.fireSequenceActive || !this.armed || Math.abs(this.moveSpeed) > 0.03) return
    this.fireSequenceActive = true
    this.actionLocked = true
    this.playCharacterClip(RIFLE_AIMING_CLIP, `clip: ${RIFLE_AIMING_CLIP}; loop: repeat; crossFadeDuration: 0.22`)
    window.clearTimeout(this.actionTimer)
    this.actionTimer = window.setTimeout(() => this.fireQueuedShot(), AIM_BEFORE_FIRE_MS)
  },

  fireQueuedShot() {
    this.actionTimer = null
    if (!this.fireSequenceActive || !this.armed || this.queuedFireCount <= 0) {
      this.finishFireSequence()
      return
    }

    this.queuedFireCount -= 1
    this.fireCooldown = FIRE_COOLDOWN_MS / 1000
    this.createLaserBeam()
    window.clearTimeout(this.actionTimer)
    this.actionTimer = window.setTimeout(() => {
      if (this.queuedFireCount > 0) {
        this.fireQueuedShot()
      } else {
        this.finishFireSequence()
      }
    }, FIRE_COOLDOWN_MS)
  },

  finishFireSequence() {
    this.fireSequenceActive = false
    this.queuedFireCount = 0
    this.actionLocked = false
    this.actionTimer = null
    this.updateLocomotionClip()
  },

  cancelFireSequenceForMovement() {
    if (!this.fireSequenceActive) return
    window.clearTimeout(this.actionTimer)
    this.fireSequenceActive = false
    this.queuedFireCount = 0
    this.actionLocked = false
    this.actionTimer = null
    this.updateLocomotionClip()
  },

  getLaserMuzzleWorldPosition() {
    const origin = this.characterPosition.clone()
      .addScaledVector(this.forwardVector, LASER_MUZZLE_OFFSET.forward)
      .addScaledVector(this.rightVector, LASER_MUZZLE_OFFSET.right)
    origin.y += LASER_MUZZLE_OFFSET.up
    return origin
  },

  applyGravity(position, dt) {
    if (!this.surfaceMeshes.length) {
      position.y = CHARACTER_POSITION.y
      this.grounded = true
      this.verticalVelocity = 0
      return
    }

    if (this.isJumping) {
      this.jumpTime = Math.min(this.jumpTime + dt, this.jumpDuration)
    }

    const groundY = this.getGroundHeight(position)
    const water = this.getWaterAtPosition(position)
    const hasWalkableSurfaceAboveWater = water &&
      groundY !== null &&
      groundY > water.surfaceY + WATER_SURFACE_TOLERANCE * 0.5
    if (water && !hasWalkableSurfaceAboveWater && position.y - CHARACTER_GROUND_OFFSET <= water.surfaceY + WATER_SURFACE_TOLERANCE) {
      this.grounded = false
      if (this.isJumping) {
        window.clearTimeout(this.jumpTimer)
        this.jumpTimer = null
        this.endJump()
      }
      this.verticalVelocity = Math.max(
        this.verticalVelocity - WATER_SINK_ACCELERATION * dt,
        -WATER_SINK_MAX_SPEED,
      )
      position.y += this.verticalVelocity * dt
      if (groundY !== null) {
        const groundedRootY = this.getCharacterRootYForGround(groundY)
        if (position.y <= groundedRootY) {
          position.y = groundedRootY
          this.verticalVelocity = 0
          this.grounded = true
        }
      }
      return
    }

    if (groundY === null) {
      this.grounded = false
      this.verticalVelocity -= GRAVITY * dt
      position.y += this.verticalVelocity * dt
      return
    }

    if (this.grounded && this.verticalVelocity <= 0) {
      position.y = this.getCharacterRootYForGround(groundY)
      this.verticalVelocity = 0
      return
    }

    this.verticalVelocity -= GRAVITY * dt
    position.y += this.verticalVelocity * dt
    const groundedRootY = this.getCharacterRootYForGround(groundY)
    if (position.y <= groundedRootY) {
      position.y = groundedRootY
      this.verticalVelocity = 0
      this.grounded = true
      if (this.isJumping && this.jumpTime > 0.12) {
        window.clearTimeout(this.jumpTimer)
        this.jumpTimer = null
        this.endJump()
      }
    } else {
      this.grounded = false
    }
  }
}
