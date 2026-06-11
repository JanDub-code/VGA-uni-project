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

export const cameraMethods = {
  activateCamera() {
    requestAnimationFrame(() => {
      document.querySelectorAll('a-entity[camera]').forEach((cameraEntity) => {
        cameraEntity.setAttribute('camera', 'active: false')
      })
      this.camera?.setAttribute('camera', 'active: true; fov: 64; near: 0.05; far: 1800')
      this.setThirdPersonCamera()
    })
  },

  setThirdPersonCamera() {
    if (!this.cameraRig?.object3D) return
    const yawDelta = this.THREE.MathUtils.degToRad(this.characterYaw - CHARACTER_BASE_YAW)
    this.cameraOffset
      .set(THIRD_PERSON_CAMERA_OFFSET.x, THIRD_PERSON_CAMERA_OFFSET.y, THIRD_PERSON_CAMERA_OFFSET.z)
      .applyAxisAngle(this.yAxis, yawDelta)
    this.cameraRig.object3D.position.set(
      this.characterPosition.x + this.cameraOffset.x,
      this.characterPosition.y + this.cameraOffset.y,
      this.characterPosition.z + this.cameraOffset.z,
    )
    if (this.cameraShake > 0) {
      const shake = this.cameraShake * 0.018
      this.cameraRig.object3D.position.x += (Math.random() - 0.5) * shake
      this.cameraRig.object3D.position.y += (Math.random() - 0.5) * shake
      this.cameraShake = Math.max(0, this.cameraShake - 0.08)
    }
    this.cameraRig.object3D.rotation.set(
      this.THREE.MathUtils.degToRad(THIRD_PERSON_ROTATION.x),
      this.THREE.MathUtils.degToRad(THIRD_PERSON_ROTATION.y + (this.characterYaw - CHARACTER_BASE_YAW)),
      this.THREE.MathUtils.degToRad(THIRD_PERSON_ROTATION.z),
    )
  }
}
