import { audioService } from '../../services/audioService.js'
import * as surfaceConstants from './constants.js'
import { createEntity } from './utils.js'

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

export const zombieMethods = {
  updateNightGameplay(dt) {
    this.playerDamageCooldown = Math.max(0, this.playerDamageCooldown - dt)
    this.surfaceStatusHold = Math.max(0, this.surfaceStatusHold - dt)
    if (this.surfaceGameOver || this.surfaceVictory) {
      return
    }

    const isNight = this.dayNightPhase === 'night'
    if (isNight && !this.wasNight) {
      this.wasNight = true
      this.nightSurvivalAwarded = false
      this.zombieSpawnTimer = 0
      this.setSurfaceStatus('PREZIJ NOC')
    }

    if (!isNight && this.wasNight) {
      this.wasNight = false
      if (!this.nightSurvivalAwarded) {
        this.nightSurvivalAwarded = true
        const bonus = this.getNightConfig().survivalBonus
        this.addSurfaceScore(bonus)
        this.setSurfaceStatus(`NOC ${this.currentNight} PREZITA +${bonus}`, 4)
        this.clearAllZombies()
        if (this.currentNight >= MAX_NIGHTS) {
          this.completeSurfaceMission()
        } else {
          this.currentNight += 1
        }
      }
    }

    if (isNight) {
      this.zombieSpawnTimer -= dt
      if (this.zombieSpawnTimer <= 0) {
        const config = this.getNightConfig()
        this.zombieSpawnTimer = config.spawnInterval + Math.random() * 0.7
        if (this.getAliveZombieCount() < config.maxAlive && !this.spawnZombie()) {
          console.debug('[zephyr-surface] zombie spawn skipped: no valid ground position found')
        }
      }
    }

    this.updateZombies(dt)
  },

  spawnZombie() {
    if (!this.surfaceMeshes.length) return false
    const config = this.getNightConfig()
    const spawnPoints = this.getOrderedZombieSpawnPoints()
    const startIndex = this.zombieSpawnCursor % Math.max(spawnPoints.length, 1)

    for (let attempt = 0; attempt < spawnPoints.length; attempt += 1) {
      const index = (startIndex + attempt) % spawnPoints.length
      const position = spawnPoints[index].clone()
      const zombie = this.spawnZombieFromWorldPosition(position, config)
      if (!zombie) continue
      this.zombieSpawnCursor = index + 1
      console.debug('[zephyr-surface] night zombie spawn point used', {
        index,
        sourcePosition: { x: position.x, y: position.y, z: position.z },
        spawnPosition: {
          x: zombie.el.object3D.position.x,
          y: zombie.el.object3D.position.y,
          z: zombie.el.object3D.position.z,
        },
        player: { x: this.characterPosition.x, y: this.characterPosition.y, z: this.characterPosition.z },
      })
      return true
    }

    return false
  },

  getOrderedZombieSpawnPoints() {
    if (!this.zombieSpawnPoints?.length) return []
    return [...this.zombieSpawnPoints].sort((a, b) => {
      const distanceA = a.distanceToSquared(this.characterPosition)
      const distanceB = b.distanceToSquared(this.characterPosition)
      return distanceA - distanceB
    })
  },

  debugSpawnZombieInFront() {
    if (!this.characterRoot?.object3D || !this.surfaceMeshes.length) return
    this.forwardVector.copy(this.localForward).applyQuaternion(this.characterRoot.object3D.quaternion)
    this.forwardVector.y = 0
    this.forwardVector.normalize()

    const position = this.characterPosition.clone().addScaledVector(this.forwardVector, 1.8)
    this.spawnZombieFromWorldPosition(position, this.getNightConfig(), true)
  },

  spawnZombieFromWorldPosition(sourcePosition, config, debug = false) {
    if (!sourcePosition || !this.surfaceMeshes.length) return null
    const position = sourcePosition.clone()
    position.y = this.characterPosition.y
    const groundY = this.getGroundHeight(position)
    if (groundY === null) {
      if (debug) this.setSurfaceStatus('DEBUG ZOMBIE: NENALEZENA ZEM', 2)
      console.debug('[zephyr-surface] zombie spawn failed: no ground', { position })
      return null
    }
    if (this.getWaterAtPosition(position)) return null
    if (this.isPositionProtectedByBeacon?.(position)) {
      if (debug) this.setSurfaceStatus('DEBUG ZOMBIE: MAJAK CHRANI ZONU', 2)
      console.debug('[zephyr-surface] zombie spawn failed: protected beacon radius', { position })
      return null
    }

    const collisionProbe = position.clone()
    collisionProbe.y = this.getZombieRootYForGround(groundY)
    if (this.collidesWithSurfaceObstacle(collisionProbe, { groundOffset: ZOMBIE_ROOT_GROUND_OFFSET, collisionRadius: ZOMBIE_HIT_RADIUS * 0.5, bodyHeight: ZOMBIE_HEIGHT })) {
      if (debug) this.setSurfaceStatus('DEBUG ZOMBIE: PREKAZKA', 2)
      console.debug('[zephyr-surface] zombie spawn failed: obstacle', { position: collisionProbe })
      return null
    }

    position.y = this.getZombieRootYForGround(groundY) + ZOMBIE_SPAWN_DROP_HEIGHT
    return this.createZombieAt(position, config, debug)
  },

  createZombieAt(position, config, debug = false) {
    const zombiePhysicsEl = createEntity('a-entity', {
      class: 'zephyr-zombie-physics',
      position: `${position.x} ${position.y} ${position.z}`,
    }, this.el)
    const hitboxEl = createEntity('a-cylinder', {
      class: 'zephyr-zombie-sim-cylinder',
      radius: '0.08',
      height: `${ZOMBIE_HEIGHT}`,
      position: `0 ${ZOMBIE_HEIGHT * 0.5} 0`,
      segmentsRadial: '18',
      visible: 'false',
      material: 'color: #ff2a2a; emissive: #ff2a2a; emissiveIntensity: 0; transparent: true; opacity: 0; roughness: 0.65',
    }, zombiePhysicsEl)
    const modelEl = createEntity('a-entity', {
      class: 'zephyr-zombie-mesh',
      position: '0 0 0',
      shadow: 'cast: true; receive: false',
    }, zombiePhysicsEl)
    const debugMarker = createEntity('a-sphere', {
      class: 'zephyr-zombie-debug-marker',
      radius: '0.035',
      position: '0 0.035 0',
      visible: 'false',
      material: 'color: #ff2a2a; emissive: #ff2a2a; emissiveIntensity: 0; shader: flat; transparent: true; opacity: 0',
    }, zombiePhysicsEl)
    const zombie = {
      el: zombiePhysicsEl,
      visualEl: zombiePhysicsEl,
      meshEl: modelEl,
      hitboxEl,
      debugMarker,
      model: null,
      simulated: false,
      health: ZOMBIE_HEALTH,
      maxHealth: ZOMBIE_HEALTH,
      radius: ZOMBIE_HIT_RADIUS,
      speed: config.zombieSpeed,
      attackCooldown: Math.random() * 0.45,
      hitStun: 0,
      dead: false,
      isAttacking: false,
      modelLoaded: false,
      verticalVelocity: 0,
      groundValid: true,
      grounded: false,
      attackEnabled: false,
      lastGroundY: position.y - ZOMBIE_ROOT_GROUND_OFFSET - ZOMBIE_SPAWN_DROP_HEIGHT,
      lastValidPosition: position.clone(),
      invalidGroundTime: 0,
      stuckTime: 0,
      clip: null,
      timers: new Set(),
    }
    modelEl.addEventListener('model-loaded', (event) => this.fitZombieModel(zombie, event.detail.model), { once: true })
    modelEl.addEventListener('model-error', (event) => {
      console.warn('[zephyr-surface] zombie model failed to load', event.detail)
      this.setSurfaceStatus('ZOMBIE MODEL ERROR', 2)
      this.removeZombie(zombie)
    }, { once: true })
    modelEl.setAttribute('gltf-model', `url(${ZOMBIE_MODEL_URL})`)
    this.zombies.add(zombie)
    this.setSurfaceStatus(`${debug ? 'DEBUG ' : ''}ZOMBIE DETEKOVAN ${this.getAliveZombieCount()}/${config.maxAlive}`, 1.8)
    console.debug('[zephyr-surface] zombie cylinder hitbox with model spawned', {
      position: { x: position.x, y: position.y, z: position.z },
      debug,
    })
    return zombie
  },

  fitZombieModel(zombie, model) {
    if (!zombie?.el || !zombie.meshEl || !model) return

    zombie.model = model
    const modelRoot = zombie.meshEl.object3D
    modelRoot.position.set(0, 0, 0)
    model.position.set(0, 0, 0)
    modelRoot.updateWorldMatrix(true, true)

    const box = this.getObjectBoxRelativeTo(modelRoot, model)
    const size = box.getSize(new this.THREE.Vector3())
    const height = size.y || Math.max(size.x, size.z, 1)
    if (!Number.isFinite(height) || height <= 0) return

    const scale = ZOMBIE_HEIGHT / height
    model.scale.multiplyScalar(scale)
    modelRoot.updateWorldMatrix(true, true)
    this.setModelShadows?.(model, { cast: true, receive: false })
    this.lockRootMotion(model, { lockZombieBody: true })

    model.traverse((child) => {
      if (!child.isMesh || !child.material) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        material.roughness = Math.max(material.roughness ?? 0.55, 0.58)
        material.metalness = Math.min(material.metalness ?? 0.2, 0.22)
      })
    })

    const fittedBox = this.getObjectBoxRelativeTo(modelRoot, model)
    if (!fittedBox.isEmpty()) {
      const center = fittedBox.getCenter(new this.THREE.Vector3())
      const bottomCenter = new this.THREE.Vector3(center.x, fittedBox.min.y, center.z)
      modelRoot.position.set(0, -bottomCenter.y, -bottomCenter.z)
    }
    modelRoot.updateWorldMatrix(true, true)

    zombie.modelLoaded = true
    zombie.attackEnabled = zombie.groundValid && zombie.grounded
    this.setZombieClip(zombie, zombie.grounded ? ZOMBIE_CLIPS.walk : ZOMBIE_CLIPS.idle)
  },

  getObjectBoxRelativeTo(referenceObject, targetObject) {
    const box = new this.THREE.Box3()
    const meshBox = new this.THREE.Box3()
    const inverseReferenceMatrix = new this.THREE.Matrix4()
    referenceObject.updateWorldMatrix(true, true)
    inverseReferenceMatrix.copy(referenceObject.matrixWorld).invert()

    targetObject.traverse((child) => {
      if (!child.isMesh || !child.geometry) return
      if (!child.geometry.boundingBox) child.geometry.computeBoundingBox()
      if (!child.geometry.boundingBox) return
      child.updateWorldMatrix(true, false)
      meshBox.copy(child.geometry.boundingBox)
        .applyMatrix4(child.matrixWorld)
        .applyMatrix4(inverseReferenceMatrix)
      box.union(meshBox)
    })

    return box
  },

  updateZombies(dt) {
    this.zombies.forEach((zombie) => {
      if (!zombie.el?.object3D || zombie.dead) return
      if (!zombie.modelLoaded) return

      zombie.attackCooldown = Math.max(0, zombie.attackCooldown - dt)
      if (!this.applyZombieGravity(zombie, dt)) return
      if (!zombie.grounded) {
        this.setZombieClip(zombie, ZOMBIE_CLIPS.idle)
        return
      }
      if (zombie.hitStun > 0) {
        zombie.hitStun = Math.max(0, zombie.hitStun - dt)
        return
      }
      if (zombie.isAttacking) return

      const position = zombie.el.object3D.position
      const toPlayer = this.characterPosition.clone().sub(position)
      toPlayer.y = 0
      const distance = toPlayer.length()
      const verticalDistance = Math.abs(position.y - this.characterPosition.y)

      if (distance <= ZOMBIE_ATTACK_RANGE && verticalDistance <= ZOMBIE_HEIGHT * 1.2) {
        this.setZombieClip(zombie, ZOMBIE_CLIPS.idle)
        if (zombie.attackCooldown <= 0) this.attackPlayer(zombie)
        return
      }

      if (distance <= 0.001) return
      toPlayer.normalize()
      const speedMultiplier = this.getBeaconSpeedMultiplier?.(position) ?? 1
      const moveDistance = zombie.speed * speedMultiplier * dt
      const nextPosition = position.clone().addScaledVector(toPlayer, moveDistance)
      const groundY = this.getGroundHeight(nextPosition)
      if (groundY === null) {
        this.invalidateZombieGround(zombie, dt)
        return
      }
      nextPosition.y = this.getZombieRootYForGround(groundY)

      const collisionProbe = nextPosition.clone()
      const zombieCollisionOptions = { groundOffset: ZOMBIE_ROOT_GROUND_OFFSET, collisionRadius: ZOMBIE_HIT_RADIUS * 0.5, bodyHeight: ZOMBIE_HEIGHT }
      if (!this.collidesWithSurfaceObstacle(collisionProbe, zombieCollisionOptions)) {
        position.copy(nextPosition)
        zombie.grounded = true
        zombie.groundValid = true
        zombie.attackEnabled = true
        zombie.lastGroundY = groundY
        zombie.lastValidPosition.copy(nextPosition)
        zombie.invalidGroundTime = 0
        zombie.stuckTime = 0
      } else {
        zombie.stuckTime = (zombie.stuckTime || 0) + dt
        const avoidDirection = this.getZombieAvoidanceDirection(position, toPlayer, zombie, moveDistance)
        if (avoidDirection) {
          const avoidPosition = position.clone().addScaledVector(avoidDirection, moveDistance)
          const avoidGroundY = this.getGroundHeight(avoidPosition)
          if (avoidGroundY !== null) {
            avoidPosition.y = this.getZombieRootYForGround(avoidGroundY)
            const avoidProbe = avoidPosition.clone()
            if (!this.collidesWithSurfaceObstacle(avoidProbe, zombieCollisionOptions)) {
              position.copy(avoidPosition)
              zombie.grounded = true
              zombie.groundValid = true
              zombie.attackEnabled = true
              zombie.lastGroundY = avoidGroundY
              zombie.lastValidPosition.copy(avoidPosition)
              zombie.invalidGroundTime = 0
            }
          }
        }
        if (zombie.stuckTime > 2.5) {
          this.relocateStuckZombie(zombie)
          zombie.stuckTime = 0
        }
      }

      this.faceZombieVisualToPlayer(zombie)
      this.setZombieClip(zombie, ZOMBIE_CLIPS.walk)
    })
  },

  faceZombieVisualToPlayer(zombie) {
    if (!zombie?.el?.object3D) return
    const position = zombie.el.object3D.position
    zombie.el.object3D.lookAt(this.characterPosition.x, position.y, this.characterPosition.z)
  },

  applyZombieGravity(zombie, dt) {
    const position = zombie.el?.object3D?.position
    if (!position || ![position.x, position.y, position.z].every(Number.isFinite)) return false

    const groundY = this.getGroundHeight(position)
    if (groundY === null) {
      zombie.grounded = false
      zombie.groundValid = false
      zombie.attackEnabled = false
      zombie.invalidGroundTime += dt
      zombie.verticalVelocity -= GRAVITY * dt
      position.y += zombie.verticalVelocity * dt
      if (zombie.invalidGroundTime > ZOMBIE_INVALID_GROUND_MAX_SECONDS) this.removeZombie(zombie)
      return false
    }

    const expectedY = this.getZombieRootYForGround(groundY)
    if (position.y <= expectedY) {
      position.y = expectedY
      zombie.verticalVelocity = 0
      zombie.grounded = true
      zombie.groundValid = true
      zombie.attackEnabled = zombie.modelLoaded
      zombie.lastGroundY = groundY
      zombie.lastValidPosition.copy(position)
      zombie.invalidGroundTime = 0
      return true
    }

    zombie.verticalVelocity -= GRAVITY * dt
    position.y += zombie.verticalVelocity * dt
    zombie.grounded = false
    zombie.groundValid = true
    zombie.attackEnabled = false
    zombie.lastGroundY = groundY
    zombie.invalidGroundTime = 0
    return true
  },

  validateZombieGround(zombie, dt = 0) {
    const position = zombie.el?.object3D?.position
    if (!position || ![position.x, position.y, position.z].every(Number.isFinite)) return false
    const groundY = this.getGroundHeight(position)
    if (groundY === null) {
      this.invalidateZombieGround(zombie, dt)
      return false
    }

    const expectedY = this.getZombieRootYForGround(groundY)
    if (Math.abs(position.y - expectedY) > ZOMBIE_ROOT_Y_TOLERANCE) {
      position.y = expectedY
    }
    zombie.grounded = true
    zombie.groundValid = true
    zombie.attackEnabled = zombie.modelLoaded
    zombie.lastGroundY = groundY
    zombie.lastValidPosition.copy(position)
    zombie.invalidGroundTime = 0
    return true
  },

  invalidateZombieGround(zombie, dt = 0) {
    zombie.grounded = false
    zombie.groundValid = false
    zombie.attackEnabled = false
    zombie.invalidGroundTime += dt
    if (zombie.lastValidPosition) {
      zombie.el.object3D.position.copy(zombie.lastValidPosition)
    }
    if (zombie.invalidGroundTime > ZOMBIE_INVALID_GROUND_MAX_SECONDS) {
      this.removeZombie(zombie)
    }
  },

  canZombieInteract(zombie) {
    if (!zombie || zombie.dead || !zombie.el?.object3D) return false
    if (!zombie.modelLoaded || !zombie.grounded || !zombie.groundValid) return false
    const position = zombie.el.object3D.position
    if (![position.x, position.y, position.z].every(Number.isFinite)) return false
    const groundY = this.getGroundHeight(position)
    if (groundY === null) return false
    const expectedY = this.getZombieRootYForGround(groundY)
    return Math.abs(position.y - expectedY) <= ZOMBIE_ROOT_Y_TOLERANCE * 1.5
  },

  canZombieAttack(zombie) {
    if (!this.canZombieInteract(zombie) || !zombie.attackEnabled) return false
    const position = zombie.el.object3D.position
    const dx = this.characterPosition.x - position.x
    const dz = this.characterPosition.z - position.z
    if (dx * dx + dz * dz > ZOMBIE_ATTACK_RANGE * ZOMBIE_ATTACK_RANGE) return false
    return Math.abs(position.y - this.characterPosition.y) <= ZOMBIE_HEIGHT * 1.2
  },

  attackPlayer(zombie) {
    if (this.surfaceGameOver || zombie.dead || !this.canZombieAttack(zombie)) return
    zombie.attackCooldown = ZOMBIE_ATTACK_COOLDOWN
    zombie.isAttacking = true
    this.setZombieClip(zombie, ZOMBIE_CLIPS.attack, { loop: 'once', clamp: false })
    this.damagePlayer(1)

    const timer = window.setTimeout(() => {
      zombie.timers.delete(timer)
      zombie.isAttacking = false
      if (!zombie.dead) this.setZombieClip(zombie, ZOMBIE_CLIPS.walk)
    }, 750)
    zombie.timers.add(timer)
  },

  damageZombie(zombie, amount = 1) {
    if (!this.canZombieInteract(zombie)) return
    zombie.health -= amount
    this.createHitFeedback(this.getZombieHitPosition(zombie), '#d000ff', 0.08)
    this.flashZombie(zombie, '#ff4df0')
    audioService.playSurfaceHit()

    if (zombie.health <= 0) {
      this.killZombie(zombie)
      return
    }

    zombie.hitStun = 0.58
    this.setZombieClip(zombie, ZOMBIE_CLIPS.hit, { loop: 'once', clamp: false })
    const timer = window.setTimeout(() => {
      zombie.timers.delete(timer)
      if (!zombie.dead) this.setZombieClip(zombie, ZOMBIE_CLIPS.walk)
    }, 580)
    zombie.timers.add(timer)
  },

  killZombie(zombie) {
    if (!zombie || zombie.dead) return
    zombie.dead = true
    zombie.attackEnabled = false
    zombie.isAttacking = false
    zombie.timers.forEach((timer) => window.clearTimeout(timer))
    zombie.timers.clear()
    this.totalKills += 1
    this.addSurfaceScore(ZOMBIE_KILL_SCORE)
    this.showScorePopup(`+${ZOMBIE_KILL_SCORE}`, zombie.el.object3D.position)
    this.createHitFeedback(this.getZombieHitPosition(zombie), '#ffd166', 0.16)
    audioService.playSurfaceKill()
    this.setZombieClip(zombie, ZOMBIE_CLIPS.death, { loop: 'once', clamp: true })

    const timer = window.setTimeout(() => {
      zombie.timers.delete(timer)
      this.removeZombie(zombie)
    }, 780)
    zombie.timers.add(timer)
  },

  removeZombie(zombie) {
    if (!zombie) return
    zombie.timers?.forEach((timer) => window.clearTimeout(timer))
    zombie.timers?.clear()
    zombie.el?.remove()
    this.zombies.delete(zombie)
  },

  setZombieClip(zombie, clip, { loop = 'repeat', clamp = false } = {}) {
    if (zombie?.simulated) return
    if (!zombie?.meshEl || zombie.clip === clip) return
    zombie.clip = clip
    zombie.meshEl.setAttribute('animation-mixer', `clip: ${clip}; loop: ${loop}; clampWhenFinished: ${clamp}; crossFadeDuration: 0.16`)
  },

  flashZombie(zombie, color) {
    const model = zombie.meshEl?.getObject3D('mesh')
    if (!model) return
    const touched = []
    model.traverse((child) => {
      if (!child.isMesh || !child.material) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        touched.push({
          material,
          emissive: material.emissive?.clone?.() || null,
          emissiveIntensity: material.emissiveIntensity ?? 0,
        })
        if (material.emissive) material.emissive.set(color)
        material.emissiveIntensity = 1.4
      })
    })
    const timer = window.setTimeout(() => {
      zombie.timers.delete(timer)
      touched.forEach(({ material, emissive, emissiveIntensity }) => {
        if (material.emissive && emissive) material.emissive.copy(emissive)
        material.emissiveIntensity = emissiveIntensity
      })
    }, 90)
    zombie.timers.add(timer)
  },

  getAliveZombieCount() {
    let count = 0
    this.zombies.forEach((zombie) => {
      if (!zombie.dead) count += 1
    })
    return count
  },

  getZombieHitPosition(zombie) {
    return zombie.el.object3D.position.clone().setY(
      zombie.el.object3D.position.y - ZOMBIE_ROOT_GROUND_OFFSET + ZOMBIE_HEIGHT * 0.55,
    )
  },

  clearAllZombies() {
    ;[...this.zombies].forEach((zombie) => this.removeZombie(zombie))
  },

  getZombieAvoidanceDirection(position, toPlayer, zombie, moveDistance) {
    const perpendicularLeft = new this.THREE.Vector3(-toPlayer.z, 0, toPlayer.x)
    const perpendicularRight = new this.THREE.Vector3(toPlayer.z, 0, -toPlayer.x)

    const probeDistance = moveDistance * 2.5
    const leftProbe = position.clone().addScaledVector(perpendicularLeft, probeDistance)
    const rightProbe = position.clone().addScaledVector(perpendicularRight, probeDistance)
    const zombieCollisionOptions = { groundOffset: ZOMBIE_ROOT_GROUND_OFFSET, collisionRadius: ZOMBIE_HIT_RADIUS * 0.5, bodyHeight: ZOMBIE_HEIGHT }

    const leftBlocked = this.collidesWithSurfaceObstacle(leftProbe, zombieCollisionOptions)
    const rightBlocked = this.collidesWithSurfaceObstacle(rightProbe, zombieCollisionOptions)

    if (!leftBlocked && !rightBlocked) {
      const hash = Math.abs(Math.sin(position.x * 12.9898 + position.z * 78.233 + (zombie.stuckTime || 0) * 43.12)) % 1
      return hash > 0.5 ? perpendicularLeft : perpendicularRight
    }
    if (!leftBlocked) return perpendicularLeft
    if (!rightBlocked) return perpendicularRight

    const angles = [Math.PI * 0.25, -Math.PI * 0.25, Math.PI * 0.5, -Math.PI * 0.5, Math.PI * 0.75, -Math.PI * 0.75]
    for (const angle of angles) {
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const dir = new this.THREE.Vector3(
        toPlayer.x * cos - toPlayer.z * sin,
        0,
        toPlayer.x * sin + toPlayer.z * cos,
      )
      const probe = position.clone().addScaledVector(dir, probeDistance)
      if (!this.collidesWithSurfaceObstacle(probe, zombieCollisionOptions)) return dir
    }

    return null
  },

  relocateStuckZombie(zombie) {
    if (!zombie?.el?.object3D) return
    const position = zombie.el.object3D.position
    const toPlayer = this.characterPosition.clone().sub(position)
    toPlayer.y = 0
    const distance = toPlayer.length()
    if (distance < 0.5) return

    toPlayer.normalize()
    const offsets = [1.2, -1.2, 2.0, -2.0, 0.6, -0.6]
    const zombieCollisionOptions = { groundOffset: ZOMBIE_ROOT_GROUND_OFFSET, collisionRadius: ZOMBIE_HIT_RADIUS * 0.5, bodyHeight: ZOMBIE_HEIGHT }
    for (const offset of offsets) {
      const perpendicular = new this.THREE.Vector3(-toPlayer.z, 0, toPlayer.x)
      const candidate = position.clone().addScaledVector(perpendicular, offset)
      candidate.addScaledVector(toPlayer, -0.5)
      const groundY = this.getGroundHeight(candidate)
      if (groundY === null) continue
      candidate.y = this.getZombieRootYForGround(groundY)
      if (!this.collidesWithSurfaceObstacle(candidate, zombieCollisionOptions) && !this.getWaterAtPosition(candidate)) {
        position.copy(candidate)
        zombie.lastValidPosition.copy(candidate)
        zombie.lastGroundY = groundY
        zombie.invalidGroundTime = 0
        return
      }
    }
  }
}
