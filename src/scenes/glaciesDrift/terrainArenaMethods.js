import { clamp, createEntity, seededRandom } from './utils.js'
import { ARENA, GLACIES_COLORS, ICE_COLLISION_PROFILES, ICE_PROP_PROFILES, PHYSICS, TERRAIN, TOWER_LAYOUT, TOWER_VISUAL } from './constants.js'

export const terrainArenaMethods = {
  createIceField() {
    const T = this.THREE
    const group = new T.Group()
    group.name = 'glacies-ice-field'
    const iceTexture = this.createIceTexture()
    this.iceTextures.push(iceTexture)
    const IceMaterial = T.MeshPhysicalMaterial || T.MeshStandardMaterial

    const ice = new T.Mesh(
      new T.PlaneGeometry(ARENA.visualSize, ARENA.visualSize, 72, 72),
      new IceMaterial({
        color: '#071929',
        map: iceTexture,
        roughness: 0.13,
        metalness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.055,
        reflectivity: 0.94,
        emissive: '#03283f',
        emissiveIntensity: 0.22,
      }),
    )
    ice.rotation.x = -Math.PI / 2
    ice.position.y = -0.08
    ice.receiveShadow = true
    group.add(ice)
    this.icePhaseMaterials.ice = ice.material

    const crackGeometry = new T.BufferGeometry()
    const positions = []
    const addCrackSegment = (from, to, y = 0.035) => {
      positions.push(from.x, y, from.z, to.x, y, to.z)
    }
    for (let i = 0; i < 82; i += 1) {
      const startAngle = seededRandom(i + 2) * Math.PI * 2
      const startRadius = 24 + seededRandom(i + 18) * 338
      let x = Math.cos(startAngle) * startRadius
      let z = Math.sin(startAngle) * startRadius
      let travelAngle = startAngle + Math.PI * 0.5 + (seededRandom(i + 61) - 0.5) * 1.2
      const steps = 3 + Math.floor(seededRandom(i + 82) * 6)
      for (let step = 0; step < steps; step += 1) {
        const length = 10 + seededRandom(i + step * 19 + 40) * 50
        travelAngle += (seededRandom(i + step * 23 + 91) - 0.5) * 0.7
        const next = {
          x: x + Math.cos(travelAngle) * length,
          z: z + Math.sin(travelAngle) * length,
        }
        addCrackSegment({ x, z }, next)
        if (seededRandom(i + step * 31 + 120) > 0.62) {
          const branchAngle = travelAngle + (seededRandom(i + step * 37 + 140) > 0.5 ? 1 : -1) * (0.55 + seededRandom(i + step * 41 + 150) * 0.75)
          const branchLength = length * (0.35 + seededRandom(i + step * 43 + 160) * 0.42)
          addCrackSegment({ x, z }, {
            x: x + Math.cos(branchAngle) * branchLength,
            z: z + Math.sin(branchAngle) * branchLength,
          }, 0.038)
        }
        x = next.x
        z = next.z
      }
    }
    crackGeometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
    const cracks = new T.LineSegments(
      crackGeometry,
      new T.LineBasicMaterial({
        color: GLACIES_COLORS.iceLine,
        transparent: true,
        opacity: 0.58,
      }),
    )
    group.add(cracks)
    this.icePhaseMaterials.cracks = cracks.material

    const frostGeometry = new T.BufferGeometry()
    const frostPositions = []
    for (let i = 0; i < 260; i += 1) {
      const angle = seededRandom(i + 801) * Math.PI * 2
      const radius = 12 + seededRandom(i + 802) * 370
      const scratchAngle = seededRandom(i + 803) * Math.PI * 2
      const length = 4 + seededRandom(i + 804) * 18
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const dx = Math.cos(scratchAngle) * length
      const dz = Math.sin(scratchAngle) * length
      frostPositions.push(x, 0.041, z, x + dx, 0.041, z + dz)
    }
    frostGeometry.setAttribute('position', new T.Float32BufferAttribute(frostPositions, 3))
    const frostLines = new T.LineSegments(
      frostGeometry,
      new T.LineBasicMaterial({
        color: '#d6fbff',
        transparent: true,
        opacity: 0.28,
      }),
    )
    group.add(frostLines)
    this.icePhaseMaterials.frost = frostLines.material

    const boundary = new T.LineLoop(
      new T.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, i) => {
        const angle = (i / 96) * Math.PI * 2
        return new T.Vector3(Math.cos(angle) * ARENA.radius, 0.06, Math.sin(angle) * ARENA.radius)
      })),
      new T.LineBasicMaterial({
        color: GLACIES_COLORS.cyan,
        transparent: true,
        opacity: 0.62,
      }),
    )
    group.add(boundary)
    this.iceBoundary = boundary
    this.icePhaseMaterials.boundary = boundary.material

    this.el.setObject3D('glacies-ice-field', group)
    this.iceField = group
  },

  createIceTexture() {
    const T = this.THREE
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createLinearGradient(0, 0, 1024, 1024)
    gradient.addColorStop(0, '#030a12')
    gradient.addColorStop(0.28, '#0a2437')
    gradient.addColorStop(0.58, '#071a29')
    gradient.addColorStop(0.82, '#0c3146')
    gradient.addColorStop(1, '#02070d')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 1024, 1024)

    for (let i = 0; i < 7200; i += 1) {
      const shade = 8 + Math.floor(seededRandom(i + 3100) * 42)
      const alpha = 0.018 + seededRandom(i + 3200) * 0.035
      const size = 1 + seededRandom(i + 3500) * 2.8
      ctx.fillStyle = `rgba(${shade}, ${shade + 42}, ${shade + 64}, ${alpha})`
      ctx.fillRect(seededRandom(i + 3300) * 1024, seededRandom(i + 3400) * 1024, size, size)
    }

    for (let i = 0; i < 92; i += 1) {
      const x = seededRandom(i + 4100) * 1024
      const y = seededRandom(i + 4200) * 1024
      const radius = 42 + seededRandom(i + 4300) * 210
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
      glow.addColorStop(0, 'rgba(142, 244, 255, 0.095)')
      glow.addColorStop(0.45, 'rgba(38, 151, 196, 0.045)')
      glow.addColorStop(1, 'rgba(5, 25, 42, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    }

    const drawPath = (points, shadowWidth, highlightWidth, highlightAlpha) => {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })
      ctx.strokeStyle = 'rgba(0, 7, 15, 0.62)'
      ctx.lineWidth = shadowWidth
      ctx.stroke()

      ctx.beginPath()
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })
      ctx.strokeStyle = `rgba(188, 249, 255, ${highlightAlpha * 0.34})`
      ctx.lineWidth = highlightWidth + 3.5
      ctx.stroke()

      ctx.beginPath()
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })
      ctx.strokeStyle = `rgba(226, 255, 255, ${highlightAlpha})`
      ctx.lineWidth = highlightWidth
      ctx.stroke()
    }

    for (let i = 0; i < 62; i += 1) {
      const points = []
      let x = seededRandom(i + 5100) * 1024
      let y = seededRandom(i + 5200) * 1024
      let angle = seededRandom(i + 5300) * Math.PI * 2
      const steps = 2 + Math.floor(seededRandom(i + 5400) * 5)
      points.push({ x, y })
      for (let step = 0; step < steps; step += 1) {
        const length = 32 + seededRandom(i + step * 37 + 5500) * 122
        angle += (seededRandom(i + step * 41 + 5600) - 0.5) * 0.95
        x += Math.cos(angle) * length
        y += Math.sin(angle) * length
        points.push({ x, y })
      }
      drawPath(points, 5 + seededRandom(i + 5700) * 8, 0.8 + seededRandom(i + 5800) * 2.1, 0.32 + seededRandom(i + 5900) * 0.34)
    }

    for (let i = 0; i < 135; i += 1) {
      const x = seededRandom(i + 6100) * 1024
      const y = seededRandom(i + 6200) * 1024
      const angle = seededRandom(i + 6300) * Math.PI * 2
      const length = 10 + seededRandom(i + 6400) * 86
      drawPath([
        { x, y },
        {
          x: x + Math.cos(angle) * length,
          y: y + Math.sin(angle) * length,
        },
      ], 2.5, 0.65, 0.18 + seededRandom(i + 6500) * 0.2)
    }

    for (let i = 0; i < 52; i += 1) {
      const x = seededRandom(i + 7100) * 1024
      const y = seededRandom(i + 7200) * 1024
      const angle = seededRandom(i + 7300) * Math.PI * 2
      const length = 44 + seededRandom(i + 7400) * 176
      ctx.strokeStyle = `rgba(206, 248, 255, ${0.045 + seededRandom(i + 7500) * 0.075})`
      ctx.lineWidth = 7 + seededRandom(i + 7600) * 22
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length)
      ctx.stroke()
    }

    for (let i = 0; i < 78; i += 1) {
      const x = seededRandom(i + 8100) * 1024
      const y = seededRandom(i + 8200) * 1024
      const angle = seededRandom(i + 8300) * Math.PI * 2
      const width = 70 + seededRandom(i + 8400) * 240
      const height = 7 + seededRandom(i + 8500) * 20
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.fillStyle = `rgba(220, 252, 255, ${0.018 + seededRandom(i + 8600) * 0.028})`
      ctx.fillRect(-width * 0.5, -height * 0.5, width, height)
      ctx.restore()
    }

    const texture = new T.CanvasTexture(canvas)
    texture.wrapS = T.RepeatWrapping
    texture.wrapT = T.RepeatWrapping
    texture.repeat.set(8, 8)
    texture.anisotropy = 8
    return texture
  },

  createTerrainProps() {
    const placed = []
    let created = 0

    for (let attempt = 0; attempt < TERRAIN.placementAttempts && created < TERRAIN.propCount; attempt += 1) {
      const profile = this.selectTerrainProfile(attempt + created * 31)
      const collisionProfile = ICE_COLLISION_PROFILES[profile.asset]
      if (!collisionProfile) continue

      const placement = this.createTerrainPlacement(profile, collisionProfile, attempt, placed)
      if (!placement) continue

      const { x, z, yaw, scale, colliderRadius, colliderPosition } = placement
      const prop = createEntity('a-entity', {
        'gltf-model': `url(${profile.asset})`,
        position: `${x.toFixed(2)} ${profile.y} ${z.toFixed(2)}`,
        rotation: `0 ${this.THREE.MathUtils.radToDeg(yaw).toFixed(2)} 0`,
        scale: `${scale.toFixed(2)} ${scale.toFixed(2)} ${scale.toFixed(2)}`,
        shadow: 'cast: true; receive: true',
      }, this.el)
      prop.object3D.userData.profile = profile
      prop.object3D.userData.shadowActive = true
      prop.object3D.userData.shadowMeshes = []
      prop.object3D.userData.spin = profile.family === 'ice' && profile.role.includes('crystal')
        ? (seededRandom(attempt + 707) - 0.5) * 0.025
        : 0
      prop.addEventListener('model-loaded', (event) => this.tintIceModel(event.detail.model, profile, prop))

      this.terrainProps.push(prop)
      this.terrainColliders.push({
        asset: profile.asset,
        profile,
        el: prop,
        position: colliderPosition,
        radius: colliderRadius,
        scale,
      })
      placed.push({ x: colliderPosition.x, z: colliderPosition.z, radius: colliderRadius })
      this.createContactShadow(colliderPosition, colliderRadius, profile)
      created += 1
    }
  },

  selectTerrainProfile(seed) {
    const totalWeight = ICE_PROP_PROFILES.reduce((sum, profile) => sum + profile.weight, 0)
    let pick = seededRandom(seed + 310) * totalWeight
    for (const profile of ICE_PROP_PROFILES) {
      pick -= profile.weight
      if (pick <= 0) return profile
    }
    return ICE_PROP_PROFILES[ICE_PROP_PROFILES.length - 1]
  },

  createTerrainPlacement(profile, collisionProfile, seed, placed) {
    const radiusRandom = seededRandom(seed + 404)
    const targetRadius = profile.targetRadius.min
      + radiusRandom * (profile.targetRadius.max - profile.targetRadius.min)
    const scale = targetRadius / collisionProfile.radiusXZ
    const colliderRadius = collisionProfile.radiusXZ * scale * profile.colliderPadding
    const minDistanceFromCenter = ARENA.safeSpawnRadius + colliderRadius + 18
    const maxDistanceFromCenter = ARENA.radius - colliderRadius - 14
    if (maxDistanceFromCenter <= minDistanceFromCenter) return null

    const ringBias = seededRandom(seed + 101)
    const distance = minDistanceFromCenter
      + Math.sqrt(ringBias) * (maxDistanceFromCenter - minDistanceFromCenter)
    const angle = seededRandom(seed + 202) * Math.PI * 2
    const x = Math.cos(angle) * distance
    const z = Math.sin(angle) * distance
    const yaw = seededRandom(seed + 505) * Math.PI * 2

    const centerX = collisionProfile.center.x * scale
    const centerZ = collisionProfile.center.z * scale
    const cos = Math.cos(yaw)
    const sin = Math.sin(yaw)
    const colliderPosition = new this.THREE.Vector3(
      x + centerX * cos - centerZ * sin,
      0,
      z + centerX * sin + centerZ * cos,
    )

    const colliderDistance = Math.sqrt(colliderPosition.x * colliderPosition.x + colliderPosition.z * colliderPosition.z)
    if (colliderDistance + colliderRadius > ARENA.radius - 8) return null
    if (colliderDistance - colliderRadius < ARENA.safeSpawnRadius + 8) return null
    const avoidsTowers = TOWER_LAYOUT.every((tower) => {
      const dx = colliderPosition.x - tower.x
      const dz = colliderPosition.z - tower.z
      const minDistance = colliderRadius + TOWER_VISUAL.protectedRadius
      return dx * dx + dz * dz > minDistance * minDistance
    })
    if (!avoidsTowers) return null

    const canPlace = placed.every((other) => {
      const dx = colliderPosition.x - other.x
      const dz = colliderPosition.z - other.z
      const minDistance = colliderRadius + other.radius + TERRAIN.minObjectGap
      return dx * dx + dz * dz > minDistance * minDistance
    })
    if (!canPlace) return null

    return { x, z, yaw, scale, colliderRadius, colliderPosition }
  },

  createContactShadow(position, radius, profile) {
    const T = this.THREE
    if (!this.contactShadowTexture) this.contactShadowTexture = this.createContactShadowTexture()
    if (!this.contactShadowMaterials) {
      this.contactShadowMaterials = {
        ice: new T.MeshBasicMaterial({
          color: '#00070d',
          map: this.contactShadowTexture,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
        }),
        other: new T.MeshBasicMaterial({
          color: '#00070d',
          map: this.contactShadowTexture,
          transparent: true,
          opacity: 0.24,
          depthWrite: false,
        }),
      }
    }
    const material = profile.family === 'ice'
      ? this.contactShadowMaterials.ice
      : this.contactShadowMaterials.other
    const shadow = new T.Mesh(new T.PlaneGeometry(1, 1), material)
    const shadowScale = radius * profile.contactShadowScale
    shadow.name = 'glacies-contact-shadow'
    shadow.rotation.x = -Math.PI / 2
    shadow.position.set(position.x, 0.062, position.z)
    shadow.scale.set(shadowScale * 2.1, shadowScale * 1.45, 1)
    shadow.renderOrder = 3
    this.el.object3D.add(shadow)
    this.contactShadows.push(shadow)
  },

  createContactShadowTexture() {
    const T = this.THREE
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    gradient.addColorStop(0, 'rgba(255,255,255,0.78)')
    gradient.addColorStop(0.42, 'rgba(255,255,255,0.36)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 256, 256)
    const texture = new T.CanvasTexture(canvas)
    texture.wrapS = T.ClampToEdgeWrapping
    texture.wrapT = T.ClampToEdgeWrapping
    return texture
  },

  tintIceModel(model, profile, prop) {
    const isKenneyNature = profile.family.startsWith('kenney')
    model.traverse((child) => {
      if (!child.isMesh || !child.material) return
      child.castShadow = true
      child.receiveShadow = true
      prop?.object3D.userData.shadowMeshes?.push(child)
      const material = Array.isArray(child.material) ? child.material[0] : child.material
      material.color?.lerp?.(new this.THREE.Color(profile.tint), profile.tintStrength)
      if (material.emissive) {
        material.emissive.set(profile.emissive)
        material.emissiveIntensity = profile.emissiveIntensity
      }
      material.roughness = isKenneyNature ? Math.max(material.roughness ?? 0.5, 0.46) : Math.max(material.roughness ?? 0.45, 0.32)
      material.metalness = Math.min(material.metalness ?? 0.15, isKenneyNature ? 0.08 : 0.24)
    })
  },

  createRadarBlips() {
    if (!this.radarEl) return
    this.towers.forEach((tower) => {
      const blip = document.createElement('span')
      blip.className = 'glacies-radar-blip tower'
      blip.style.left = '50%'
      blip.style.top = '50%'
      this.radarEl.appendChild(blip)
      tower.radarBlip = blip
    })
    this.drones.forEach((drone) => {
      const blip = document.createElement('span')
      blip.className = 'glacies-radar-blip drone'
      blip.style.left = '50%'
      blip.style.top = '50%'
      this.radarEl.appendChild(blip)
      drone.radarBlip = blip
    })
  },

  updateRadarBlips() {
    if (!this.ship?.object3D || !this.radarEl) return
    const shipPos = this.ship.object3D.position
    const center = this.radarEl.clientWidth * 0.5
    const radius = this.radarEl.clientWidth * 0.43
    const scale = radius / ARENA.radius
    const updateBlip = (blip, position, hidden) => {
      if (!blip) return
      blip.classList.toggle('hidden', hidden)
      if (hidden) return
      const dx = position.x - shipPos.x
      const dz = position.z - shipPos.z
      const cos = Math.cos(this.shipYaw)
      const sin = Math.sin(this.shipYaw)
      const rx = dx * cos - dz * sin
      const rz = dx * sin + dz * cos
      const distance = Math.sqrt(rx * rx + rz * rz)
      const clampScale = distance > ARENA.radius ? ARENA.radius / distance : 1
      const x = rx * clampScale * scale
      const y = rz * clampScale * scale
      blip.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`
    }
    this.towers.forEach((tower) => updateBlip(tower.radarBlip, tower.position, tower.destroyed))
    this.drones.forEach((drone) => updateBlip(drone.radarBlip, drone.position, drone.destroyed || drone.tower.destroyed))
    this.boostCrystals.forEach((crystal) => updateBlip(crystal.blip, crystal.position, crystal.collected))
  },

  updateTerrain(dt) {
    const shipPos = this.ship?.object3D?.position
    this._terrainShadowTimer -= dt
    const updateShadows = this._terrainShadowTimer <= 0
    if (updateShadows) this._terrainShadowTimer = 0.18
    this.terrainProps.forEach((prop) => {
      const spin = prop.object3D.userData.spin || 0
      prop.object3D.rotation.y += spin * dt
      if (!shipPos || !updateShadows) return
      const dx = prop.object3D.position.x - shipPos.x
      const dz = prop.object3D.position.z - shipPos.z
      const distanceSq = dx * dx + dz * dz
      const active = !!prop.object3D.userData.shadowActive
      const enableDistance = TERRAIN.activeShadowDistance
      const disableDistance = TERRAIN.activeShadowDistance + 28
      const shouldCastShadow = active
        ? distanceSq < disableDistance * disableDistance
        : distanceSq < enableDistance * enableDistance
      if (prop.object3D.userData.shadowActive === shouldCastShadow) return
      prop.object3D.userData.shadowActive = shouldCastShadow
      prop.object3D.userData.shadowMeshes?.forEach((mesh) => {
        mesh.castShadow = shouldCastShadow
      })
    })
    if (this.iceBoundary?.material) {
      this.iceBoundary.material.opacity = clamp(
        (this.lightPhaseCurrent?.boundaryOpacity ?? 0.62) + this.boundaryPulse * 0.28 + this.finalLightPulse * 0.18,
        0,
        1,
      )
    }
  },

  resolveArenaBoundary(shipPos) {
    const distance = Math.sqrt(shipPos.x * shipPos.x + shipPos.z * shipPos.z)
    if (distance <= ARENA.radius) return

    const normal = this._tmpVec.set(shipPos.x, 0, shipPos.z).normalize()
    shipPos.x = normal.x * ARENA.radius
    shipPos.z = normal.z * ARENA.radius
    const outwardSpeed = this.velocity.dot(normal)
    if (outwardSpeed > 0) this.velocity.addScaledVector(normal, -(1 + PHYSICS.boundaryBounce) * outwardSpeed)
    this.boundaryPulse = 1
  },

  resolveTerrainCollisions(shipPos) {
    for (const collider of this.terrainColliders) {
      const dx = shipPos.x - collider.position.x
      const dz = shipPos.z - collider.position.z
      const minDistance = collider.radius + PHYSICS.shipRadius
      const distanceSq = dx * dx + dz * dz
      if (distanceSq >= minDistance * minDistance) continue

      const distance = Math.sqrt(distanceSq) || 0.0001
      const normal = this._tmpVec.set(dx / distance, 0, dz / distance)
      const push = minDistance - distance
      shipPos.x += normal.x * push
      shipPos.z += normal.z * push
      const intoObstacle = this.velocity.dot(normal)
      if (intoObstacle < 0) {
        const impactSpeed = -intoObstacle
        this.velocity.addScaledVector(normal, -(1 + PHYSICS.obstacleBounce) * intoObstacle)
        this.velocity.multiplyScalar(0.92)
        this.registerObstacleImpact(impactSpeed)
      }
      this.obstaclePulse = 1
    }
  },
}
