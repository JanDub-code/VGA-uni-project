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

export const levelMethods = {
  fitSurfaceModel(model) {
    if (!model) return

    const box = new this.THREE.Box3().setFromObject(model)
    const size = box.getSize(new this.THREE.Vector3())
    const center = box.getCenter(new this.THREE.Vector3())
    const maxSize = Math.max(size.x, size.y, size.z)
    if (!Number.isFinite(maxSize) || maxSize <= 0) return

    const scale = maxSize > 220 ? 180 / maxSize : 1
    this.surface.object3D.scale.setScalar(scale)
    this.setModelShadows(model, { cast: true, receive: true })
    this.surface.object3D.position.set(
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale,
    )
    this.buildSurfaceCollision(model)
    this.snapCharacterToGround()
    this.startDayBeacons?.(this.currentNight)
  },

  setModelShadows(object, { cast = true, receive = true } = {}) {
    object?.traverse?.((child) => {
      if (!child.isMesh) return
      child.castShadow = cast
      child.receiveShadow = receive
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach((material) => {
          material.needsUpdate = true
        })
      }
    })
  },

  buildSurfaceCollision(model) {
    this.surface.object3D.updateMatrixWorld(true)
    this.surfaceMeshes = []
    this.collisionBoxes = []
    this.collisionCircles = []
    this.collisionPolygons = []
    this.waterPolygons = []
    this.zombieSpawnPoints = []
    this.clearDebugTreeColliders()
    this.clearDebugRockColliders()
    let treeMeshCount = 0
    let rockMeshCount = 0
    let terrainBlockerCount = 0
    let waterMeshCount = 0

    model.traverse((child) => {
      if (!child.isMesh) return
      const objectName = this.getObjectNameChain(child)
      if (this.isZombieSpawnObject(objectName)) {
        this.addZombieSpawnPoint(child, objectName)
        this.hideSurfaceHelperObject(child)
        return
      }
      const box = new this.THREE.Box3().setFromObject(child)
      if (box.isEmpty()) return

      if (this.isWaterObject(objectName)) {
        waterMeshCount += 1
        this.addWaterPolygonFromObject(child)
        return
      }

      if (objectName.includes('TREE')) {
        treeMeshCount += 1
        this.addTreeCollisionCircle(child, {
          materialPattern: /trunk|stem|bark|wood|kmen/i,
          minHeight: 0.12,
          maxRadius: 0.45,
          padding: TREE_COLLIDER_PADDING,
        })
        return
      }

      if (this.isRockCollisionObject(objectName)) {
        rockMeshCount += 1
        this.surfaceMeshes.push(child)
        this.addCollisionPolygonFromObject(child, {
          padding: ROCK_COLLIDER_PADDING,
          minHeight: 0.04,
          minHorizontal: 0.05,
          allowStandingOnTop: true,
          debug: true,
        })
        return
      }

      if (this.isTerrainBlockerObject(objectName)) {
        terrainBlockerCount += 1
        this.addCollisionPolygonFromObject(child, {
          padding: ROCK_COLLIDER_PADDING,
          minHeight: 0.06,
          minHorizontal: 0.08,
          verticalPadding: CHARACTER_HEIGHT,
          allowStandingOnTop: false,
          debug: true,
        })
        return
      }

      if (objectName.includes('PIER')) {
        this.surfaceMeshes.push(child)
        this.addCollisionBoxFromObject(child)
        return
      }

      if (objectName.includes('HOUSE')) {
        this.addCollisionBoxFromObject(child)
        return
      }

      if (this.isGroundCollisionMesh(objectName, box)) this.surfaceMeshes.push(child)
    })
    console.debug(`[zephyr-surface] collision: ${this.surfaceMeshes.length} ground meshes, ${this.collisionBoxes.length} box colliders, ${this.collisionPolygons.length} polygon colliders from ${rockMeshCount} rock meshes and ${terrainBlockerCount} hill/cliff meshes, ${this.collisionCircles.length} tree circle colliders from ${treeMeshCount} tree meshes, ${this.waterPolygons.length} water polygons from ${waterMeshCount} water meshes, ${this.zombieSpawnPoints.length} zombie spawn points`)
  },

  isZombieSpawnObject(objectName) {
    return objectName.includes('SPAWN_')
  },

  isPrimaryZombieSpawnObject(objectName) {
    return this.isZombieSpawnObject(objectName) &&
      !objectName.includes('_VERTICAL_MARKER') &&
      !objectName.includes('_LABEL') &&
      !objectName.includes('_EMPTY')
  },

  addZombieSpawnPoint(object, objectName) {
    if (!this.isPrimaryZombieSpawnObject(objectName)) return
    object.updateMatrixWorld(true)
    const position = object.getWorldPosition(new this.THREE.Vector3())
    this.zombieSpawnPoints.push(position)
  },

  hideSurfaceHelperObject(object) {
    object.visible = false
    object.traverse?.((child) => {
      child.visible = false
    })
  },

  isWaterObject(objectName) {
    return objectName.includes('LAKE_WATER_SURFACE') ||
      objectName.includes('LAKE_DEEP_BLUE_UNDERWATER')
  },

  isRockCollisionObject(objectName) {
    return objectName.includes('ROCK')
  },

  isTerrainBlockerObject(objectName) {
    return objectName.includes('HILL') || objectName.includes('CLIFF')
  },

  isGroundCollisionMesh(objectName, box) {
    if (
      objectName.includes('LAKE_VISIBLE_BOTTOM') ||
      objectName.includes('LAKE_WATER_SURFACE') ||
      objectName.includes('LAKE_DEEP_BLUE_UNDERWATER')
    ) {
      return false
    }

    if (
      objectName.includes('TERRAIN') ||
      objectName.includes('PATH') ||
      objectName.includes('LAKE_SANDY') ||
      objectName.includes('TERRAIN_PATCH')
    ) {
      return true
    }

    const size = box.getSize(new this.THREE.Vector3())
    const maxHorizontal = Math.max(size.x, size.z)
    const minHorizontal = Math.min(size.x, size.z)
    return size.y < Math.max(maxHorizontal * COLLISION_MAX_FLATNESS, COLLISION_MIN_HEIGHT) &&
      minHorizontal > CHARACTER_COLLISION_RADIUS * 1.4
  },

  addTreeCollisionCircle(mesh, { materialPattern = null, minHeight = 0.08, maxRadius = Infinity, padding = 0 }) {
    const fullBox = new this.THREE.Box3().setFromObject(mesh)
    const fullSize = fullBox.getSize(new this.THREE.Vector3())
    let box = this.getMaterialWorldBox(mesh, materialPattern)
    let trunkRadius = null
    if (box) {
      const trunkSize = box.getSize(new this.THREE.Vector3())
      trunkRadius = Math.max(trunkSize.x, trunkSize.z) / 2
    } else {
      const estimatedTrunkRadius = Math.min(fullSize.x, fullSize.z) * 0.075
      trunkRadius = Math.max(estimatedTrunkRadius, 0.02)
      const trunkHeight = Math.min(fullSize.y * 0.5, fullSize.y)
      const fullCenter = fullBox.getCenter(new this.THREE.Vector3())
      box = new this.THREE.Box3(
        new this.THREE.Vector3(fullCenter.x - trunkRadius, fullBox.min.y, fullCenter.z - trunkRadius),
        new this.THREE.Vector3(fullCenter.x + trunkRadius, fullBox.min.y + trunkHeight, fullCenter.z + trunkRadius),
      )
    }
    const size = box.getSize(new this.THREE.Vector3())
    const radius = (trunkRadius || Math.max(size.x, size.z) / 2) + padding
    if (size.y < minHeight || radius > maxRadius) return
    const center = box.getCenter(new this.THREE.Vector3())
    this.collisionCircles.push({
      x: center.x,
      z: center.z,
      radius,
      minY: fullBox.min.y,
      maxY: fullBox.max.y,
    })
    this.createDebugTreeColliderCylinder(center, radius, fullSize.y)
  },

  createDebugTreeColliderCylinder(center, radius, height) {
    const cylinder = createEntity('a-cylinder', {
      class: 'zephyr-debug-tree-collider',
      radius: `${radius}`,
      height: `${height}`,
      position: `${center.x} ${center.y} ${center.z}`,
      segmentsRadial: '18',
      visible: 'false',
      material: 'color: #d000ff; transparent: true; opacity: 0; depthWrite: false',
    }, this.el)
    this.debugTreeColliderEls.push(cylinder)
  },

  clearDebugTreeColliders() {
    this.debugTreeColliderEls?.forEach((el) => el.remove())
    this.debugTreeColliderEls = []
  },

  addCollisionBoxFromObject(object, { padding = 0, minHeight = 0, minHorizontal = 0, maxHorizontal = Infinity, debug = false } = {}) {
    const box = new this.THREE.Box3().setFromObject(object)
    if (box.isEmpty()) return
    const size = box.getSize(new this.THREE.Vector3())
    const horizontalSize = Math.max(size.x, size.z)
    if (size.y < minHeight || horizontalSize < minHorizontal || horizontalSize > maxHorizontal) return
    box.expandByVector(new this.THREE.Vector3(padding, 0, padding))
    this.collisionBoxes.push(box)
    if (debug) this.createDebugRockColliderBox(box)
  },

  addCollisionPolygonFromObject(object, { padding = 0, minHeight = 0, minHorizontal = 0, verticalPadding = 0, allowStandingOnTop = false, debug = false } = {}) {
    const box = new this.THREE.Box3().setFromObject(object)
    if (box.isEmpty()) return
    const size = box.getSize(new this.THREE.Vector3())
    const horizontalSize = Math.max(size.x, size.z)
    if (size.y < minHeight || horizontalSize < minHorizontal) return

    const hull = this.getObjectFootprintHull(object)
    if (hull.length < 3) {
      this.addCollisionBoxFromObject(object, { padding, minHeight, minHorizontal, debug })
      return
    }

    const polygon = {
      points: hull,
      minY: box.min.y - verticalPadding,
      maxY: box.max.y,
      padding,
      allowStandingOnTop,
    }
    this.collisionPolygons.push(polygon)
    if (debug) this.createDebugRockColliderPolygon(polygon)
  },

  addWaterPolygonFromObject(object) {
    const box = new this.THREE.Box3().setFromObject(object)
    if (box.isEmpty()) return
    const hull = this.getObjectFootprintHull(object)
    if (hull.length < 3) return
    this.waterPolygons.push({
      points: hull,
      minY: box.min.y,
      maxY: box.max.y,
      surfaceY: box.max.y,
    })
  },

  getObjectFootprintHull(object) {
    const geometry = object.geometry
    const positionAttribute = geometry?.attributes?.position
    if (!positionAttribute) return []

    object.updateMatrixWorld(true)
    const points = []
    const seen = new Set()
    const vertex = new this.THREE.Vector3()

    for (let index = 0; index < positionAttribute.count; index += 1) {
      vertex.fromBufferAttribute(positionAttribute, index).applyMatrix4(object.matrixWorld)
      const x = Number(vertex.x.toFixed(4))
      const z = Number(vertex.z.toFixed(4))
      const key = `${x}:${z}`
      if (seen.has(key)) continue
      seen.add(key)
      points.push({ x, z })
    }

    return this.getConvexHull2D(points)
  },

  getConvexHull2D(points) {
    if (points.length <= 3) return points
    const sorted = [...points].sort((a, b) => (a.x - b.x) || (a.z - b.z))
    const cross = (origin, a, b) => (a.x - origin.x) * (b.z - origin.z) - (a.z - origin.z) * (b.x - origin.x)
    const lower = []
    const upper = []

    sorted.forEach((point) => {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop()
      lower.push(point)
    })
    for (let index = sorted.length - 1; index >= 0; index -= 1) {
      const point = sorted[index]
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop()
      upper.push(point)
    }

    lower.pop()
    upper.pop()
    return lower.concat(upper)
  },

  createDebugRockColliderBox(box) {
    const size = box.getSize(new this.THREE.Vector3())
    const center = box.getCenter(new this.THREE.Vector3())
    const marker = createEntity('a-box', {
      class: 'zephyr-debug-rock-collider',
      width: `${size.x}`,
      height: `${size.y}`,
      depth: `${size.z}`,
      position: `${center.x} ${center.y} ${center.z}`,
      visible: 'false',
      material: 'color: #d000ff; emissive: #d000ff; emissiveIntensity: 0; transparent: true; opacity: 0; depthWrite: false',
    }, this.el)
    this.debugRockColliderEls.push(marker)
  },

  createDebugRockColliderPolygon(polygon) {
    const entity = createEntity('a-entity', {
      class: 'zephyr-debug-rock-collider',
      visible: 'false',
    }, this.el)
    const geometry = new this.THREE.BufferGeometry()
    const y = polygon.maxY + 0.015
    const vertices = []
    polygon.points.forEach((point) => {
      vertices.push(point.x, y, point.z)
    })
    vertices.push(polygon.points[0].x, y, polygon.points[0].z)
    geometry.setAttribute('position', new this.THREE.Float32BufferAttribute(vertices, 3))
    const material = new this.THREE.LineBasicMaterial({
      color: LASER_COLOR,
      transparent: true,
      opacity: 0,
      depthTest: false,
    })
    const line = new this.THREE.Line(geometry, material)
    line.visible = false
    entity.object3D.add(line)
    this.debugRockColliderEls.push(entity)
  },

  clearDebugRockColliders() {
    this.debugRockColliderEls?.forEach((el) => el.remove())
    this.debugRockColliderEls = []
  },

  getMaterialWorldBox(mesh, materialPattern) {
    if (!materialPattern) return null
    const geometry = mesh.geometry
    const positionAttribute = geometry?.attributes?.position
    if (!positionAttribute) return null

    mesh.updateMatrixWorld(true)
    const index = geometry.index?.array || null
    const groups = geometry.groups?.length
      ? geometry.groups
      : [{ start: 0, count: index ? index.length : positionAttribute.count, materialIndex: 0 }]
    const box = new this.THREE.Box3()
    const vertex = new this.THREE.Vector3()

    groups.forEach((group) => {
      if (!materialPattern.test(this.getMeshMaterialName(mesh, group.materialIndex))) return
      const end = group.start + group.count
      for (let offset = group.start; offset < end; offset += 1) {
        const vertexIndex = index ? index[offset] : offset
        vertex.fromBufferAttribute(positionAttribute, vertexIndex).applyMatrix4(mesh.matrixWorld)
        box.expandByPoint(vertex)
      }
    })

    return box.isEmpty() ? null : box
  },

  getMeshMaterialName(mesh, materialIndex = 0) {
    const material = Array.isArray(mesh.material) ? mesh.material[materialIndex] : mesh.material
    return material?.name || ''
  },

  getObjectNameChain(object) {
    const names = []
    let current = object
    while (current) {
      if (current.name) names.push(current.name)
      current = current.parent
    }
    if (object.geometry?.name) names.push(object.geometry.name)
    return names.join(' ').toUpperCase()
  },

  getGroundHeight(position) {
    if (!this.surfaceMeshes.length) return null
    const cache = this._groundHeightCache
    if (cache) {
      const dx = position.x - cache.x
      const dz = position.z - cache.z
      if (dx * dx + dz * dz < 0.25) return cache.y
    }
    this.rayOrigin.set(position.x, position.y + GROUND_RAY_HEIGHT, position.z)
    this.groundRaycaster.set(this.rayOrigin, this.downVector)
    this.groundRaycaster.far = GROUND_RAY_DEPTH
    const intersections = this.groundRaycaster.intersectObjects(this.surfaceMeshes, true)
    const y = intersections.length ? intersections[0].point.y : null
    this._groundHeightCache = { x: position.x, z: position.z, y }
    return y
  },

  getCharacterRootYForGround(groundY) {
    return groundY + CHARACTER_GROUND_OFFSET
  },

  getZombieRootYForGround(groundY) {
    return groundY + ZOMBIE_ROOT_GROUND_OFFSET
  },

  getWaterAtPosition(position) {
    return this.waterPolygons.find((water) => {
      if (position.y - CHARACTER_GROUND_OFFSET > water.surfaceY + WATER_SURFACE_TOLERANCE) return false
      return this.circleIntersectsPolygon2D(
        position.x,
        position.z,
        CHARACTER_COLLISION_RADIUS * 0.45,
        water.points,
      )
    }) || null
  },

  resolveHorizontalCollisions(position, previousPosition) {
    if (!this.collidesWithSurfaceObstacle(position)) return

    if (this.collidesWithSurfaceObstacle(previousPosition)) {
      position.copy(previousPosition)
      if (this.pushPositionOutOfSurfaceObstacles(position)) return
    }

    const xOnly = position.clone()
    xOnly.z = previousPosition.z
    if (!this.collidesWithSurfaceObstacle(xOnly)) {
      position.copy(xOnly)
      return
    }

    const zOnly = position.clone()
    zOnly.x = previousPosition.x
    if (!this.collidesWithSurfaceObstacle(zOnly)) {
      position.copy(zOnly)
      return
    }

    const moveDirection = position.clone().sub(previousPosition)
    moveDirection.y = 0
    const moveDistance = Math.sqrt(moveDirection.x * moveDirection.x + moveDirection.z * moveDirection.z)
    if (moveDistance > 0.001) {
      moveDirection.x /= moveDistance
      moveDirection.z /= moveDistance
      const perpendicularLeft = { x: -moveDirection.z, z: moveDirection.x }
      const perpendicularRight = { x: moveDirection.z, z: -moveDirection.x }
      const slideDistance = moveDistance * 0.8

      const slideLeft = previousPosition.clone()
      slideLeft.x += perpendicularLeft.x * slideDistance
      slideLeft.z += perpendicularLeft.z * slideDistance
      if (!this.collidesWithSurfaceObstacle(slideLeft)) {
        position.copy(slideLeft)
        return
      }

      const slideRight = previousPosition.clone()
      slideRight.x += perpendicularRight.x * slideDistance
      slideRight.z += perpendicularRight.z * slideDistance
      if (!this.collidesWithSurfaceObstacle(slideRight)) {
        position.copy(slideRight)
        return
      }
    }

    position.x = previousPosition.x
    position.z = previousPosition.z
    this.pushPositionOutOfSurfaceObstacles(position)
    this.moveSpeed = 0
  },

  collidesWithSurfaceObstacle(position, { groundOffset = CHARACTER_GROUND_OFFSET, collisionRadius = CHARACTER_COLLISION_RADIUS, bodyHeight = CHARACTER_HEIGHT } = {}) {
    const footY = position.y - groundOffset
    const bodyMinY = footY + 0.03
    const bodyMaxY = footY + bodyHeight * 0.92
    const collidesWithBox = this.collisionBoxes.some((box) => {
      if (box.max.y < bodyMinY || box.min.y > bodyMaxY) return false
      const closestX = Math.max(box.min.x, Math.min(position.x, box.max.x))
      const closestZ = Math.max(box.min.z, Math.min(position.z, box.max.z))
      const dx = position.x - closestX
      const dz = position.z - closestZ
      return dx * dx + dz * dz < collisionRadius * collisionRadius
    })
    if (collidesWithBox) return true

    const collidesWithPolygon = this.collisionPolygons.some((polygon) => {
      if (polygon.maxY < bodyMinY || polygon.minY > bodyMaxY) return false
      if (polygon.allowStandingOnTop && footY >= polygon.maxY - OBSTACLE_TOP_STAND_TOLERANCE) return false
      if (polygon.allowStandingOnTop && this.isStandingOnObstacleTop(position, footY, polygon, { groundOffset, collisionRadius })) return false
      return this.circleIntersectsPolygon2D(
        position.x,
        position.z,
        collisionRadius + polygon.padding,
        polygon.points,
      )
    })
    if (collidesWithPolygon) return true

    return this.collisionCircles.some((circle) => {
      if (circle.maxY < bodyMinY || circle.minY > bodyMaxY) return false
      const dx = position.x - circle.x
      const dz = position.z - circle.z
      const radius = circle.radius + collisionRadius
      return dx * dx + dz * dz < radius * radius
    })
  },

  circleIntersectsPolygon2D(x, z, radius, points) {
    if (this.isPointInsidePolygon2D(x, z, points)) return true
    const radiusSq = radius * radius
    for (let index = 0; index < points.length; index += 1) {
      const start = points[index]
      const end = points[(index + 1) % points.length]
      if (this.distanceToSegmentSquared2D(x, z, start.x, start.z, end.x, end.z) < radiusSq) return true
    }
    return false
  },

  isStandingOnObstacleTop(position, footY, polygon, { groundOffset = CHARACTER_GROUND_OFFSET, collisionRadius = CHARACTER_COLLISION_RADIUS } = {}) {
    const obstacleHeight = polygon.maxY - polygon.minY
    const topClearance = Math.min(
      OBSTACLE_TOP_GROUND_TOLERANCE,
      Math.max(0.02, obstacleHeight * 0.25),
    )
    if (footY < polygon.minY + topClearance || footY > polygon.maxY + OBSTACLE_TOP_GROUND_TOLERANCE) return false
    if (!this.circleIntersectsPolygon2D(
      position.x,
      position.z,
      collisionRadius + polygon.padding,
      polygon.points,
    )) return false

    const groundY = this.getGroundHeight(position)
    if (groundY === null) return true
    if (groundY >= polygon.minY && groundY <= polygon.maxY + OBSTACLE_TOP_GROUND_TOLERANCE) return true
    return Math.abs(footY - groundY) <= OBSTACLE_TOP_GROUND_TOLERANCE
  },

  pushPositionOutOfSurfaceObstacles(position) {
    const footY = position.y - CHARACTER_GROUND_OFFSET
    const bodyMinY = footY + 0.03
    const bodyMaxY = footY + CHARACTER_HEIGHT * 0.92
    let pushed = false

    this.collisionPolygons.forEach((polygon) => {
      if (polygon.maxY < bodyMinY || polygon.minY > bodyMaxY) return
      if (polygon.allowStandingOnTop && footY >= polygon.maxY - OBSTACLE_TOP_STAND_TOLERANCE) return
      if (polygon.allowStandingOnTop && this.isStandingOnObstacleTop(position, footY, polygon)) return

      const correction = this.getPolygonCircleCorrection2D(
        position.x,
        position.z,
        CHARACTER_COLLISION_RADIUS + polygon.padding,
        polygon.points,
      )
      if (!correction) return
      position.x += correction.x
      position.z += correction.z
      pushed = true
    })

    this.collisionCircles.forEach((circle) => {
      if (circle.maxY < bodyMinY || circle.minY > bodyMaxY) return
      const dx = position.x - circle.x
      const dz = position.z - circle.z
      const distanceSq = dx * dx + dz * dz
      const combinedRadius = circle.radius + CHARACTER_COLLISION_RADIUS
      if (distanceSq >= combinedRadius * combinedRadius) return

      const distance = Math.sqrt(distanceSq)
      if (distance < 0.0001) {
        position.x += combinedRadius + COLLISION_PUSH_EPSILON
        pushed = true
        return
      }
      const pushDistance = combinedRadius - distance + COLLISION_PUSH_EPSILON
      position.x += (dx / distance) * pushDistance
      position.z += (dz / distance) * pushDistance
      pushed = true
    })

    return pushed && !this.collidesWithSurfaceObstacle(position)
  },

  getPolygonCircleCorrection2D(x, z, radius, points) {
    const inside = this.isPointInsidePolygon2D(x, z, points)
    let closest = null
    let closestDistanceSq = Infinity

    for (let index = 0; index < points.length; index += 1) {
      const start = points[index]
      const end = points[(index + 1) % points.length]
      const candidate = this.getClosestPointOnSegment2D(x, z, start.x, start.z, end.x, end.z)
      if (candidate.distanceSq < closestDistanceSq) {
        closestDistanceSq = candidate.distanceSq
        closest = candidate
      }
    }

    if (!closest) return null
    const distance = Math.sqrt(closestDistanceSq)
    if (!inside && distance >= radius) return null

    let dirX = inside ? closest.x - x : x - closest.x
    let dirZ = inside ? closest.z - z : z - closest.z
    let dirLength = Math.hypot(dirX, dirZ)
    if (dirLength < 0.0001) {
      const center = this.getPolygonCenter2D(points)
      dirX = x - center.x
      dirZ = z - center.z
      dirLength = Math.hypot(dirX, dirZ) || 1
    }

    const pushDistance = inside
      ? distance + radius + COLLISION_PUSH_EPSILON
      : radius - distance + COLLISION_PUSH_EPSILON
    return {
      x: (dirX / dirLength) * pushDistance,
      z: (dirZ / dirLength) * pushDistance,
    }
  },

  getClosestPointOnSegment2D(x, z, startX, startZ, endX, endZ) {
    const dx = endX - startX
    const dz = endZ - startZ
    const lengthSq = dx * dx + dz * dz
    if (lengthSq === 0) {
      const pointDx = x - startX
      const pointDz = z - startZ
      return {
        x: startX,
        z: startZ,
        distanceSq: pointDx * pointDx + pointDz * pointDz,
      }
    }

    const t = Math.max(0, Math.min(1, ((x - startX) * dx + (z - startZ) * dz) / lengthSq))
    const closestX = startX + t * dx
    const closestZ = startZ + t * dz
    const pointDx = x - closestX
    const pointDz = z - closestZ
    return {
      x: closestX,
      z: closestZ,
      distanceSq: pointDx * pointDx + pointDz * pointDz,
    }
  },

  getPolygonCenter2D(points) {
    const center = points.reduce((acc, point) => {
      acc.x += point.x
      acc.z += point.z
      return acc
    }, { x: 0, z: 0 })
    center.x /= points.length || 1
    center.z /= points.length || 1
    return center
  },

  isPointInsidePolygon2D(x, z, points) {
    let inside = false
    for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
      const currentPoint = points[index]
      const previousPoint = points[previous]
      const intersects = ((currentPoint.z > z) !== (previousPoint.z > z)) &&
        (x < ((previousPoint.x - currentPoint.x) * (z - currentPoint.z)) / (previousPoint.z - currentPoint.z) + currentPoint.x)
      if (intersects) inside = !inside
    }
    return inside
  },

  distanceToSegmentSquared2D(x, z, startX, startZ, endX, endZ) {
    const dx = endX - startX
    const dz = endZ - startZ
    const lengthSq = dx * dx + dz * dz
    if (lengthSq === 0) {
      const pointDx = x - startX
      const pointDz = z - startZ
      return pointDx * pointDx + pointDz * pointDz
    }

    const t = Math.max(0, Math.min(1, ((x - startX) * dx + (z - startZ) * dz) / lengthSq))
    const closestX = startX + t * dx
    const closestZ = startZ + t * dz
    const pointDx = x - closestX
    const pointDz = z - closestZ
    return pointDx * pointDx + pointDz * pointDz
  }
}
