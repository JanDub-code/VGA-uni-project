import * as surfaceConstants from './constants.js'
import { createEntity } from './utils.js'

const {
  BEACON_MODEL_URL,
  CHARACTER_GROUND_OFFSET,
  DAY_BEACON_COUNTS,
  DAY_BEACON_HEIGHT,
  DAY_BEACON_INTERACTION_RADIUS,
  DAY_BEACON_LIGHT_RADIUS,
  DAY_BEACON_SAFE_RADIUS,
  DAY_BEACON_SLOW_RADIUS,
  DAY_BEACON_SLOW_MULTIPLIER,
  DAY_BEACON_SCORE,
  MAX_NIGHTS,
} = surfaceConstants

const BEACON_TARGET_HEIGHT = DAY_BEACON_HEIGHT
const BEACON_BASE_HEIGHT = 0.17
const BEACON_BASE_RADIUS = 0.27
const BEACON_LIGHT_POOL_RADIUS = 1.35
const BEACON_LIGHT_CORE_RADIUS = 0.64

export const beaconMethods = {
  startDayBeacons(day = this.currentNight) {
    if (!this.surfaceMeshes?.length) return
    const beaconDay = Math.min(Math.max(day || 1, 1), MAX_NIGHTS)
    if (this.dayBeaconDay === beaconDay && this.dayBeacons?.length) return

    this.clearDayBeacons()
    this.dayBeaconDay = beaconDay
    const count = DAY_BEACON_COUNTS[beaconDay - 1] || DAY_BEACON_COUNTS[DAY_BEACON_COUNTS.length - 1]
    const positions = this.getDayBeaconPositions(count)
    this.dayBeacons = positions.map((position, index) => this.createDayBeacon(position, index))
    this.updateBeaconHud()
  },

  getDayBeaconPositions(count) {
    const positions = []
    const candidates = [...(this.zombieSpawnPoints || [])]
      .sort((a, b) => b.distanceToSquared(this.characterPosition) - a.distanceToSquared(this.characterPosition))

    candidates.forEach((candidate) => {
      if (positions.length >= count) return
      const position = this.getValidBeaconPosition(candidate)
      if (!position) return
      if (position.distanceTo(this.characterPosition) < 1.1) return
      if (positions.some((existing) => existing.distanceTo(position) < 1.25)) return
      positions.push(position)
    })

    const fallbackRadius = 1.35
    for (let index = 0; positions.length < count && index < count * 6; index += 1) {
      const angle = (Math.PI * 2 * index) / Math.max(count * 2, 1) + 0.55
      const source = this.characterPosition.clone()
      source.x += Math.cos(angle) * (fallbackRadius + index * 0.18)
      source.z += Math.sin(angle) * (fallbackRadius + index * 0.18)
      const position = this.getValidBeaconPosition(source)
      if (!position) continue
      if (positions.some((existing) => existing.distanceTo(position) < 0.85)) continue
      positions.push(position)
    }

    return positions
  },

  getValidBeaconPosition(sourcePosition) {
    if (!sourcePosition) return null
    const position = sourcePosition.clone()
    position.y = this.characterPosition.y
    const groundY = this.getGroundHeight(position)
    if (groundY === null) return null
    position.y = this.getCharacterRootYForGround(groundY)
    if (this.getWaterAtPosition(position)) return null
    const collisionProbe = position.clone()
    collisionProbe.y = this.getCharacterRootYForGround(groundY)
    if (this.collidesWithSurfaceObstacle(collisionProbe)) return null
    return position
  },

  createDayBeacon(position, index) {
    const root = createEntity('a-entity', {
      class: 'zephyr-day-beacon',
      position: `${position.x} ${position.y - CHARACTER_GROUND_OFFSET + 0.01} ${position.z}`,
    }, this.el)

    const baseRoot = createEntity('a-entity', {
      class: 'zephyr-day-beacon-base',
      position: '0 0 0.055',
    }, root)

    const groundLightPool = createEntity('a-cylinder', {
      radius: `${BEACON_LIGHT_POOL_RADIUS}`,
      height: '0.004',
      position: '0 0.004 0',
      segmentsRadial: '48',
      visible: 'false',
      material: 'color: #ffd166; emissive: #ffb347; emissiveIntensity: 0.42; transparent: true; opacity: 0.08; shader: flat; depthWrite: false',
    }, baseRoot)
    const groundGlow = createEntity('a-cylinder', {
      radius: `${BEACON_LIGHT_CORE_RADIUS}`,
      height: '0.005',
      position: '0 0.007 0',
      segmentsRadial: '32',
      visible: 'false',
      material: 'color: #ffe08a; emissive: #ffc247; emissiveIntensity: 0.62; transparent: true; opacity: 0.18; shader: flat; depthWrite: false',
    }, baseRoot)
    const baseFoot = createEntity('a-cylinder', {
      radius: `${BEACON_BASE_RADIUS}`,
      height: '0.052',
      position: '0 0.026 0',
      segmentsRadial: '8',
      shadow: 'cast: true; receive: true',
      material: 'color: #1a171a; emissive: #080506; emissiveIntensity: 0.04; metalness: 0.18; roughness: 0.78',
    }, baseRoot)
    const baseStep = createEntity('a-cylinder', {
      radius: `${BEACON_BASE_RADIUS * 0.78}`,
      height: '0.048',
      position: '0 0.076 0',
      segmentsRadial: '8',
      shadow: 'cast: true; receive: true',
      material: 'color: #242026; emissive: #0b0606; emissiveIntensity: 0.05; metalness: 0.24; roughness: 0.7',
    }, baseRoot)
    const baseCap = createEntity('a-cylinder', {
      radius: `${BEACON_BASE_RADIUS * 0.55}`,
      height: '0.048',
      position: '0 0.124 0',
      segmentsRadial: '8',
      shadow: 'cast: true; receive: true',
      material: 'color: #121014; emissive: #160b04; emissiveIntensity: 0.08; metalness: 0.5; roughness: 0.56',
    }, baseRoot)
    const baseCollar = createEntity('a-cylinder', {
      radius: `${BEACON_BASE_RADIUS * 0.32}`,
      height: '0.034',
      position: '0 0.159 0',
      segmentsRadial: '8',
      shadow: 'cast: true; receive: true',
      material: 'color: #070608; emissive: #1d0d04; emissiveIntensity: 0.1; metalness: 0.62; roughness: 0.48',
    }, baseRoot)

    const modelEl = createEntity('a-entity', {
      class: 'zephyr-day-beacon-model',
      shadow: 'cast: true; receive: true',
    }, root)
    modelEl.addEventListener('model-loaded', (event) => {
      console.debug('[beacon] Torch.glb loaded', event.detail.model)
      this.fitBeaconModel(event.detail.model, modelEl)
    }, { once: true })
    modelEl.addEventListener('model-error', (event) => {
      console.warn('[beacon] Torch.glb failed to load:', event.detail)
    }, { once: true })

    const fallbackHandle = createEntity('a-cylinder', {
      radius: '0.022',
      height: `${DAY_BEACON_HEIGHT * 0.7}`,
      position: `0 ${BEACON_BASE_HEIGHT + DAY_BEACON_HEIGHT * 0.35} 0`,
      segmentsRadial: '8',
      shadow: 'cast: true; receive: true',
      material: 'color: #4a2a18; emissive: #2a1408; emissiveIntensity: 0.2; metalness: 0.3; roughness: 0.7',
    }, root)
    const fallbackTop = createEntity('a-cylinder', {
      radius: '0.028',
      height: '0.06',
      position: `0 ${BEACON_BASE_HEIGHT + DAY_BEACON_HEIGHT * 0.74} 0`,
      segmentsRadial: '8',
      shadow: 'cast: true; receive: true',
      material: 'color: #2a1a10; emissive: #1a0a04; emissiveIntensity: 0.15; metalness: 0.5; roughness: 0.4',
    }, root)
    const lampLight = createEntity('a-entity', {
      position: `0 ${BEACON_BASE_HEIGHT + DAY_BEACON_HEIGHT * 0.98} 0`,
      light: `type: point; color: #ffd9a0; intensity: 0; distance: ${DAY_BEACON_LIGHT_RADIUS}; decay: 1.4`,
    }, root)

    const beacon = {
      index,
      active: false,
      root,
      modelEl,
      baseRoot,
      baseParts: [baseFoot, baseStep, baseCap, baseCollar],
      groundLightPool,
      groundGlow,
      fallbackParts: [fallbackHandle, fallbackTop],
      parts: [],
      topParts: [],
      lampLight,
      position: position.clone(),
    }

    modelEl.object3D.userData.beacon = beacon

    this.updateBeaconVisual(beacon, false)
    modelEl.setAttribute('gltf-model', `url(${BEACON_MODEL_URL})`)
    return beacon
  },

  fitBeaconModel(model, modelEl) {
    const beacon = modelEl.object3D.userData.beacon
    if (!beacon || !model) {
      console.warn('[beacon] fitBeaconModel: missing beacon or model', { beacon: !!beacon, model: !!model })
      return
    }

    const modelRoot = modelEl.object3D
    modelRoot.position.set(0, 0, 0)
    modelRoot.scale.set(1, 1, 1)
    model.position.set(0, 0, 0)
    model.updateMatrixWorld(true)
    modelRoot.updateWorldMatrix(true, true)

    const box = this.getBeaconObjectBoxRelativeTo(modelRoot, model)
    if (box.isEmpty()) {
      console.warn('[beacon] fitBeaconModel: empty Torch.glb bounds')
      return
    }

    const size = box.getSize(new this.THREE.Vector3())
    console.debug('[beacon] Torch.glb size', { x: size.x, y: size.y, z: size.z })

    let height = size.y
    if (!Number.isFinite(height) || height <= 0) height = Math.max(size.x, size.z, 0.1)
    if (!Number.isFinite(height) || height <= 0) return

    const scale = BEACON_TARGET_HEIGHT / height
    console.debug('[beacon] Torch.glb scale', scale)
    model.scale.multiplyScalar(scale)
    modelRoot.updateWorldMatrix(true, true)

    const fittedBox = this.getBeaconObjectBoxRelativeTo(modelRoot, model)
    if (fittedBox.isEmpty()) {
      console.warn('[beacon] fitBeaconModel: empty Torch.glb fitted bounds')
      return
    }
    const fittedCenter = fittedBox.getCenter(new this.THREE.Vector3())
    model.position.x -= fittedCenter.x
    model.position.y -= fittedBox.min.y
    model.position.z -= fittedCenter.z
    modelRoot.position.y = BEACON_BASE_HEIGHT
    modelRoot.updateWorldMatrix(true, true)

    const anchorBox = this.getBeaconBaseAnchorBox(modelRoot, model)
    if (!anchorBox.isEmpty()) {
      const anchorCenter = anchorBox.getCenter(new this.THREE.Vector3())
      model.position.x -= anchorCenter.x
      model.position.z -= anchorCenter.z
      modelRoot.updateWorldMatrix(true, true)
    }

    const finalBox = this.getBeaconObjectBoxRelativeTo(modelRoot, model)

    const meshes = []
    const topMeshes = []
    model.traverse((child) => {
      if (!child.isMesh || !child.material) return
      child.castShadow = true
      child.receiveShadow = true
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => material.clone())
        : child.material.clone()
      meshes.push(child)
      const meshBox = this.getBeaconObjectBoxRelativeTo(modelRoot, child)
      if (this.isBeaconTopMesh(child, meshBox, finalBox)) topMeshes.push(child)
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        if (!material.emissive) return
        material.userData = material.userData || {}
        material.userData.beaconBaseEmissive = material.emissive.clone()
        material.userData.beaconBaseEmissiveIntensity = material.emissiveIntensity ?? 0
      })
    })

    if (!meshes.length) {
      console.warn('[beacon] fitBeaconModel: Torch.glb has no renderable meshes')
      return
    }

    beacon.fallbackParts?.forEach((part) => part.setAttribute('visible', 'false'))
    beacon.parts = meshes
    beacon.topParts = topMeshes
    console.debug('[beacon] Torch.glb fitted, meshes:', meshes.length, 'top meshes:', topMeshes.length)

    this.updateBeaconVisual(beacon, beacon.active)
  },

  isBeaconTopMesh(mesh, meshBox, modelBox) {
    if (!mesh || meshBox.isEmpty() || modelBox.isEmpty()) return false
    const name = `${mesh.name || ''} ${mesh.material?.name || ''}`.toLowerCase()
    if (/(flame|fire|light|glow|wick|tip|top|lamp)/.test(name)) return true

    const modelSize = modelBox.getSize(new this.THREE.Vector3())
    if (!Number.isFinite(modelSize.y) || modelSize.y <= 0) return false
    const topStart = modelBox.min.y + modelSize.y * 0.72
    return meshBox.max.y >= topStart && meshBox.getSize(new this.THREE.Vector3()).y <= modelSize.y * 0.45
  },

  getBeaconBaseAnchorBox(referenceObject, targetObject) {
    const modelBox = this.getBeaconObjectBoxRelativeTo(referenceObject, targetObject)
    const modelSize = modelBox.getSize(new this.THREE.Vector3())
    const anchorBox = new this.THREE.Box3()
    if (modelBox.isEmpty() || !Number.isFinite(modelSize.y) || modelSize.y <= 0) return anchorBox

    const anchorMaxY = modelBox.min.y + modelSize.y * 0.42
    targetObject.traverse((child) => {
      if (!child.isMesh || !child.geometry) return
      const meshBox = this.getBeaconObjectBoxRelativeTo(referenceObject, child)
      if (meshBox.isEmpty() || meshBox.min.y > anchorMaxY) return
      const meshSize = meshBox.getSize(new this.THREE.Vector3())
      if (meshSize.x > modelSize.x * 0.55 || meshSize.z > modelSize.z * 0.55) return
      anchorBox.union(meshBox)
    })

    return anchorBox.isEmpty() ? modelBox : anchorBox
  },

  getBeaconObjectBoxRelativeTo(referenceObject, targetObject) {
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

  updateDayBeacons(dt = 0) {
    if (!this.dayBeacons?.length && this.dayNightPhase === 'day') this.startDayBeacons(this.currentNight)
    if (!this.dayBeacons?.length) return

    const dayPrepActive = this.dayNightPhase === 'day' || this.dayNightPhase === 'dusk'
    const nearby = dayPrepActive ? this.getNearestInactiveBeacon() : null
    this.dayBeacons.forEach((beacon) => {
      const isNearby = beacon === nearby
      this.updateBeaconVisual(beacon, isNearby)
    })

    if (nearby && this.surfaceStatusHold <= 0) {
      this.setSurfaceStatus('MAJAK V DOSAHU - Q AKTIVOVAT')
    }
  },

  getNearestInactiveBeacon() {
    let nearest = null
    let nearestDistanceSq = DAY_BEACON_INTERACTION_RADIUS * DAY_BEACON_INTERACTION_RADIUS
    this.dayBeacons?.forEach((beacon) => {
      if (beacon.active) return
      const distanceSq = beacon.position.distanceToSquared(this.characterPosition)
      if (distanceSq > nearestDistanceSq) return
      nearest = beacon
      nearestDistanceSq = distanceSq
    })
    return nearest
  },

  handleBeaconAction() {
    if (this.surfaceGameOver || this.surfaceVictory || this.surfaceBriefingOpen) return
    if (this.dayNightPhase !== 'day' && this.dayNightPhase !== 'dusk') {
      this.setSurfaceStatus('MAJAKY LZE AKTIVOVAT POUZE ZA DNE', 1.5)
      return
    }

    const beacon = this.getNearestInactiveBeacon()
    if (!beacon) {
      this.setSurfaceStatus('ZADNY MAJAK V DOSAHU', 1.2)
      return
    }

    beacon.active = true
    this.updateBeaconVisual(beacon, false)
    this.addSurfaceScore(DAY_BEACON_SCORE)
    this.updateBeaconHud()
    this.setSurfaceStatus(`MAJAK AKTIVOVAN ${this.getActiveBeaconCount()}/${this.dayBeacons.length} +${DAY_BEACON_SCORE}`, 2.4)
  },

  getActiveBeaconCount() {
    return this.dayBeacons?.filter((beacon) => beacon.active).length || 0
  },

  getBeaconSpeedMultiplier(position) {
    if (this.dayNightPhase !== 'night' || !this.dayBeacons?.length) return 1
    const radiusSq = DAY_BEACON_SLOW_RADIUS * DAY_BEACON_SLOW_RADIUS
    return this.dayBeacons.some((beacon) => (
      beacon.active && beacon.position.distanceToSquared(position) <= radiusSq
    ))
      ? DAY_BEACON_SLOW_MULTIPLIER
      : 1
  },

  isPositionProtectedByBeacon(position) {
    if (!position || !this.dayBeacons?.length) return false
    const radiusSq = DAY_BEACON_SAFE_RADIUS * DAY_BEACON_SAFE_RADIUS
    return this.dayBeacons.some((beacon) => (
      beacon.active && beacon.position.distanceToSquared(position) <= radiusSq
    ))
  },

  updateBeaconVisual(beacon, highlighted = false) {
    if (!beacon) return
    const nightLit = this.dayNightPhase === 'night' || this.dayNightPhase === 'dusk'
    const activeIntensity = nightLit ? 4.2 : 1.15
    const lightDistance = beacon.active ? (nightLit ? 4.4 : 3.2) : DAY_BEACON_LIGHT_RADIUS
    const lightIntensity = beacon.active ? activeIntensity : highlighted ? 0.35 : 0

    beacon.lampLight?.setAttribute('light', `type: point; color: #ffd166; intensity: ${lightIntensity}; distance: ${lightDistance}; decay: 1.15`)
    beacon.groundLightPool?.setAttribute('visible', `${beacon.active}`)
    beacon.groundLightPool?.setAttribute('material', `color: #ffd166; emissive: #ffb347; emissiveIntensity: 0.42; transparent: true; opacity: ${beacon.active ? (nightLit ? 0.13 : 0.08) : 0}; shader: flat; depthWrite: false`)
    beacon.groundGlow?.setAttribute('visible', `${beacon.active}`)
    beacon.groundGlow?.setAttribute('material', `color: #ffe08a; emissive: #ffc247; emissiveIntensity: 0.62; transparent: true; opacity: ${beacon.active ? (nightLit ? 0.25 : 0.14) : 0}; shader: flat; depthWrite: false`)

    beacon.baseParts?.forEach((part) => {
      const material = part.getObject3D?.('mesh')?.material
      if (!material) return
      material.emissive?.set(beacon.active ? '#3a1b08' : '#080506')
      material.emissiveIntensity = beacon.active ? (nightLit ? 0.22 : 0.12) : 0.04
      material.needsUpdate = true
    })

    const topParts = beacon.topParts?.length ? new Set(beacon.topParts) : new Set()
    beacon.parts?.forEach((mesh) => {
      const lightsTop = topParts.has(mesh)
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.filter(Boolean).forEach((item) => {
        if (!item.emissive) return
        const baseEmissive = item.userData?.beaconBaseEmissive
        if (baseEmissive) item.emissive.copy(baseEmissive)
        item.emissiveIntensity = item.userData?.beaconBaseEmissiveIntensity ?? 0
        if (lightsTop && (beacon.active || highlighted)) {
          item.emissive.set(beacon.active ? '#ffd166' : '#dffbff')
          item.emissiveIntensity = beacon.active ? (nightLit ? 1.8 : 1.15) : 0.55
        }
        item.needsUpdate = true
      })
    })
  },

  updateBeaconHud() {
    if (!this.surfaceBeaconCountEl) return
    const total = this.dayBeacons?.length || (DAY_BEACON_COUNTS[Math.min(this.currentNight - 1, DAY_BEACON_COUNTS.length - 1)] || 0)
    this.surfaceBeaconCountEl.textContent = `${this.getActiveBeaconCount()}/${total}`
  },

  clearDayBeacons() {
    this.dayBeacons?.forEach((beacon) => beacon.root?.remove())
    this.dayBeacons = []
    this.updateBeaconHud()
  },
}
