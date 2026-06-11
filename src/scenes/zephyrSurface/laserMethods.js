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

export const laserMethods = {
  createSurfaceReticle() {
    this.surfaceReticle = createEntity('a-entity', {
      id: 'zephyr-aim-reticle',
      visible: 'false',
      position: '0 0 0',
    }, this.el)
    createEntity('a-entity', {
      geometry: `primitive: ring; radiusInner: ${LASER_RETICLE_RADIUS * 0.72}; radiusOuter: ${LASER_RETICLE_RADIUS}; segmentsTheta: 48`,
      material: 'color: #ffd700; emissive: #ffd700; emissiveIntensity: 1.4; transparent: true; opacity: 0.88; shader: flat; depthTest: false; depthWrite: false',
    }, this.surfaceReticle)
    ;[
      ['0 0.085 0', '0.006', '0.04', '0.002'],
      ['0.085 0 0', '0.04', '0.006', '0.002'],
      ['0 -0.085 0', '0.006', '0.04', '0.002'],
      ['-0.085 0 0', '0.04', '0.006', '0.002'],
    ].forEach(([position, width, height, depth]) => {
      createEntity('a-box', {
        position,
        width,
        height,
        depth,
        material: 'color: #ffd700; emissive: #ffd700; emissiveIntensity: 1.25; transparent: true; opacity: 0.86; shader: flat; depthTest: false; depthWrite: false',
      }, this.surfaceReticle)
    })
    createEntity('a-sphere', {
      radius: '0.008',
      material: `color: ${LASER_COLOR}; emissive: ${LASER_COLOR}; emissiveIntensity: 1.6; transparent: true; opacity: 0.95; shader: flat; depthTest: false; depthWrite: false`,
    }, this.surfaceReticle)
  },

  createLaserBeam() {
    audioService.playLaserShot()
    this.forwardVector.copy(this.localForward).applyQuaternion(this.characterRoot.object3D.quaternion)
    this.forwardVector.y = 0
    this.forwardVector.normalize()
    this.rightVector.copy(this.localRight).applyQuaternion(this.characterRoot.object3D.quaternion)
    this.rightVector.y = 0
    this.rightVector.normalize()

    const origin = this.getLaserMuzzleWorldPosition()
    this.pulseSurfaceReticle()
    const midpoint = origin.clone().addScaledVector(this.forwardVector, LASER_BOLT_LENGTH / 2)
    const yaw = this.characterYaw
    const laser = createEntity('a-entity', {
      id: 'zephyr-laser-shot',
      position: `${midpoint.x} ${midpoint.y} ${midpoint.z}`,
      rotation: `90 ${yaw} 0`,
    }, this.el)
    createEntity('a-cylinder', {
      class: 'zephyr-laser-core',
      radius: `${LASER_BOLT_RADIUS}`,
      height: `${LASER_BOLT_LENGTH}`,
      segmentsRadial: '10',
      material: `color: ${LASER_COLOR}; shader: flat; transparent: true; opacity: 0.98`,
    }, laser)
    createEntity('a-cylinder', {
      class: 'zephyr-laser-glow',
      radius: '0.014',
      height: `${LASER_BOLT_LENGTH}`,
      segmentsRadial: '14',
      material: `color: ${LASER_COLOR}; shader: flat; transparent: true; opacity: 0.28; depthWrite: false`,
    }, laser)
    createEntity('a-sphere', {
      class: 'zephyr-laser-muzzle',
      radius: '0.012',
      position: `0 ${-LASER_BOLT_LENGTH / 2} 0`,
      material: `color: ${LASER_COLOR}; shader: flat; transparent: true; opacity: 0.85`,
    }, laser)
    laser.object3D.userData.velocity = this.forwardVector.clone().multiplyScalar(LASER_BOLT_SPEED)
    laser.object3D.userData.life = LASER_DURATION_MS / 1000
    this.lasers.add(laser)
  },

  createHitFeedback(position, color = '#d000ff', size = 0.08) {
    const burst = createEntity('a-sphere', {
      radius: `${size}`,
      position: `${position.x} ${position.y} ${position.z}`,
      material: `color: ${color}; emissive: ${color}; emissiveIntensity: 1.8; transparent: true; opacity: 0.8; shader: flat`,
      animation__scale: 'property: scale; to: 2.6 2.6 2.6; dur: 180; easing: easeOutQuad',
      animation__fade: 'property: material.opacity; to: 0; dur: 180; easing: easeOutQuad',
    }, this.el)
    window.setTimeout(() => burst.remove(), 220)
  },

  updateLaserMuzzleMarker() {
    if (!this.laserMuzzleMarker || !this.characterRoot?.object3D) return
    this.forwardVector.copy(this.localForward).applyQuaternion(this.characterRoot.object3D.quaternion)
    this.forwardVector.y = 0
    this.forwardVector.normalize()
    this.rightVector.copy(this.localRight).applyQuaternion(this.characterRoot.object3D.quaternion)
    this.rightVector.y = 0
    this.rightVector.normalize()
    this.laserMuzzleMarker.object3D.position.copy(this.getLaserMuzzleWorldPosition())
  },

  updateSurfaceReticle(dt = 0.016) {
    if (!this.surfaceReticle || !this.characterRoot?.object3D) return
    this.surfaceReticle.object3D.visible = this.armed
    if (!this.armed) return

    this.forwardVector.copy(this.localForward).applyQuaternion(this.characterRoot.object3D.quaternion)
    this.forwardVector.y = 0
    this.forwardVector.normalize()
    this.rightVector.copy(this.localRight).applyQuaternion(this.characterRoot.object3D.quaternion)
    this.rightVector.y = 0
    this.rightVector.normalize()

    const position = this.getLaserMuzzleWorldPosition().addScaledVector(this.forwardVector, LASER_RETICLE_FORWARD_OFFSET)
    this.surfaceReticle.object3D.position.copy(position)
    this.surfaceReticle.object3D.rotation.set(0, this.THREE.MathUtils.degToRad(this.characterYaw), 0)

    this.surfaceReticlePulse = Math.max(0, this.surfaceReticlePulse - dt * 8)
    const scale = 1 + this.surfaceReticlePulse * 0.35
    this.surfaceReticle.object3D.scale.setScalar(scale)
  },

  pulseSurfaceReticle() {
    if (!this.surfaceReticle) return
    this.surfaceReticlePulse = 1
  },

  updateLaserBolts(dt) {
    this.lasers.forEach((laser) => {
      const velocity = laser.object3D.userData.velocity
      laser.object3D.userData.life -= dt
      if (velocity) laser.object3D.position.addScaledVector(velocity, dt)
      const hitZombie = [...this.zombies].find((zombie) => {
        if (!this.canZombieInteract(zombie)) return false
        const hitPosition = this.getZombieHitPosition(zombie)
        return laser.object3D.position.distanceToSquared(hitPosition) <= zombie.radius * zombie.radius
      })
      if (hitZombie) {
        this.damageZombie(hitZombie, 1)
      }
      if (hitZombie || laser.object3D.userData.life <= 0) {
        this.lasers.delete(laser)
        laser.remove()
      }
    })
  }
}
