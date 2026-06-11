import { PLANETS, SHIP_SKINS, STATIONS, gameState } from '../services/gameState.js'
import { audioService } from '../services/audioService.js'
import { gamepadService } from '../services/gamepadService.js'
import { gamepadNavService } from '../services/gamepadNavService.js'
import { expSmoothingFactor, springValue } from '../services/motionDynamics.js'
import { createHangarController } from './galaxy/hangarController.js'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const rand = (min, max) => min + Math.random() * (max - min)

const BEACON_WORLD = { x: 0, y: 0, z: -3000 }
const BEACON_SCALE_PER_WIN = 0.08
const BEACON_BASE_LIGHT_INTENSITY = 18
const BEACON_BASE_LIGHT_DISTANCE = 4200
const BEACON_GLOW_POWER_PER_WIN = 0.32
const SHIP_COLLISION_RADIUS = 5.2
const PLANET_COLLISION_RADIUS_MULTIPLIER = 1.04
const PLANET_MIN_COLLISION_ORBIT_RATIO = 0.72
const STATION_COLLISION_RADIUS_MULTIPLIER = 0.42
const STATION_VISUAL_REVEAL_RADIUS_MULTIPLIER = 6
const STATION_VISUAL_REVEAL_FADE_RADIUS_MULTIPLIER = 1.4
const STATION_DISCOVERY_MARKER_REVEAL_ALPHA = 0.55
const STATION_DISCOVERY_MARKER_OFFSET = { x: 10, y: -65, z: -5 }
const SPACE_OBJECT_MODELS = [
  {
    type: 'asteroid',
    url: '/models/objects/asteroid.glb',
    count: 88,
    sizeMin: 5,
    sizeMax: 42,
    radiusMul: 0.62,
  },
  {
    type: 'asteroid-field',
    url: '/models/objects/asteroid-group.glb',
    count: 20,
    sizeMin: 7,
    sizeMax: 34,
    radiusMul: 0.78,
  },
]

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

function setWidth(id, value) {
  const el = document.getElementById(id)
  if (el) el.style.width = `${clamp(value, 0, 1) * 100}%`
}

AFRAME.registerComponent('galaxy-travel', {
  init() {
    this.THREE = AFRAME.THREE
    this.keys = {}
    this.planetState = PLANETS.map((_, index) => ({
      missionWon: gameState.isMissionWonOnPlanet(index),
      orbitVisited: false,
      nearby: false,
    }))
    this.stationState = STATIONS.map((station) => ({
      dockVisited: gameState.visitedStations.has(station.id),
      nearby: false,
    }))
    this.activeMissionPlanetIdx = null
    this.activeStationIdx = null
    this.hangarController = createHangarController(this)
    this.collisionCooldown = 0
    this.totalTime = 0
    this.launching = false
    this.docking = false
    this.systemMenuOpen = false

    this.travel = {
      worldPos: new this.THREE.Vector3(),
      velocity: new this.THREE.Vector3(),
      speed: 0,
      inputX: 0,
      inputY: 0,
      yaw: 0,
      pitch: 0,
      yawVelocity: 0,
      pitchVelocity: 0,
      strafeThrust: 210,
      forwardThrust: 260,
      reverseThrust: 180,
      maxForwardSpeed: 260,
      maxReverseSpeed: 160,
      maxStrafeSpeed: 220,
      drag: 2.2,
      brakeDrag: 6.5,
      turnAccel: 2.8,
      turnDamping: 5.2,
      maxTurnSpeed: 2.5,
    }
    if (gameState.galaxyTravel) {
      const saved = gameState.galaxyTravel
      this.travel.worldPos.set(saved.worldPos.x, saved.worldPos.y, saved.worldPos.z)
      this.travel.velocity.set(saved.velocity.x, saved.velocity.y, saved.velocity.z)
      this.travel.yaw = saved.yaw
      this.travel.pitch = saved.pitch
    }
    this.shipAttitude = {
      roll: 0,
      pitch: 0,
      yaw: 0,
      rollVelocity: 0,
      pitchVelocity: 0,
      yawVelocity: 0,
      previousLocalStrafe: 0,
      previousLocalLift: 0,
    }

    this.tmpForward = new this.THREE.Vector3()
    this.tmpRight = new this.THREE.Vector3()
    this.tmpUp = new this.THREE.Vector3()
    this.tmpVec = new this.THREE.Vector3()
    this.tmpVec2 = new this.THREE.Vector3()
    this.tmpVec3 = new this.THREE.Vector3()
    this.tmpVec4 = new this.THREE.Vector3()
    this.tmpVec5 = new this.THREE.Vector3()
    this.tmpCollisionStart = new this.THREE.Vector3()
    this.tmpCollisionEnd = new this.THREE.Vector3()
    this.tmpCollisionPoint = new this.THREE.Vector3()
    this.tmpCollisionNormal = new this.THREE.Vector3()
    this.tmpCollisionStep = new this.THREE.Vector3()
    this.tmpCollisionDelta = new this.THREE.Vector3()
    this.worldUp = new this.THREE.Vector3(0, 1, 0)
    this.lightOffset = new this.THREE.Vector3(0, 1, 2)
    this._compassCache = { heading: '', planets: [], stations: [] }
    this.shipBankQuat = new this.THREE.Quaternion()
    this.shipPitchQuat = new this.THREE.Quaternion()
    this.shipYawQuat = new this.THREE.Quaternion()
    this.shipTargetQuat = new this.THREE.Quaternion()
    this.cameraFlipQuat = new this.THREE.Quaternion().setFromAxisAngle(new this.THREE.Vector3(0, 1, 0), Math.PI)
    this.shipRollAxis = new this.THREE.Vector3(0, 0, 1)
    this.shipPitchAxis = new this.THREE.Vector3(1, 0, 0)
    this.shipYawAxis = new this.THREE.Vector3(0, 1, 0)

    this.onKeyDown = (event) => {
      if (this.systemMenuOpen) return
      this.keys[event.key.toLowerCase()] = true
      this.keys[event.code.toLowerCase()] = true
    }
    this.onKeyUp = (event) => {
      this.keys[event.key.toLowerCase()] = false
      this.keys[event.code.toLowerCase()] = false
    }
    this.onLaunch = () => this.launchMission()
    this.onDock = () => this.dockStation()
    this.onHangarClose = () => this.closeHangar()
    this.onHangarPrev = () => this.stepHangarSkin(-1)
    this.onHangarNext = () => this.stepHangarSkin(1)
    this.onHangarSelect = () => this.selectHangarSkin()
    this.onSystemMenuToggle = (event) => {
      this.systemMenuOpen = !!event.detail.open
      if (this.systemMenuOpen) {
        Object.keys(this.keys).forEach((key) => {
          this.keys[key] = false
        })
        this.travel.inputX = 0
        this.travel.inputY = 0
        this.travel.yawVelocity = 0
        this.travel.pitchVelocity = 0
      }
    }

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('system-menu-toggle', this.onSystemMenuToggle)
    document.getElementById('launch-btn')?.addEventListener('click', this.onLaunch)
    document.getElementById('dock-btn')?.addEventListener('click', this.onDock)
    document.getElementById('hangar-close-btn')?.addEventListener('click', this.onHangarClose)
    document.getElementById('hangar-return-btn')?.addEventListener('click', this.onHangarClose)
    document.getElementById('hangar-prev-btn')?.addEventListener('click', this.onHangarPrev)
    document.getElementById('hangar-next-btn')?.addEventListener('click', this.onHangarNext)
    document.getElementById('hangar-select-btn')?.addEventListener('click', this.onHangarSelect)

    this.el.sceneEl.setAttribute('background', 'color: #000508')
    this.el.sceneEl.setAttribute('fog', 'type: linear; color: #000508; near: 300; far: 3800')

    this.buildScene()
    this.activateCamera()
    this.buildCompassMarkers()
    this.setupMobileControls()
    this.closeMissionPanel()

    const loader = document.getElementById('loader')
    loader?.classList.remove('done')
    this.loaderTimer = window.setTimeout(() => loader?.classList.add('done'), 900)
  },

  buildScene() {
    createEntity('a-entity', {
      light: 'type: ambient; color: #112244; intensity: 0.8',
    }, this.el)
    createEntity('a-entity', {
      light: 'type: directional; color: #ffffff; intensity: 1',
      position: '10 20 10',
    }, this.el)

    this.camera = createEntity('a-entity', {
      id: 'galaxy-camera',
      camera: 'active: true; fov: 70; near: 0.1; far: 8000',
      position: '0 4 14',
    }, this.el)

    this.ship = createEntity('a-entity', {
      id: 'galaxy-ship',
      scale: '1.6 1.6 1.6',
      'lk-ship-model': `color: #0088ff; shield: false; modelUrl: ${gameState.getSelectedShipSkin().modelUrl}`,
    }, this.el)
    this.ship.object3D.position.set(0, 0, 0)
    this.ship.object3D.userData.targetX = 0
    this.ship.object3D.userData.targetY = 0

    this.shipLight = createEntity('a-entity', {
      light: 'type: point; color: #00aaff; intensity: 4; distance: 40',
      position: '0 2 8',
    }, this.el)

    this.worldGroup = new this.THREE.Group()
    this.el.object3D.add(this.worldGroup)

    this.createStarfield()
    this.createPlanets()
    this.createStations()
    // Nebulae placed to match planet quadrants and the Beacon center
    this.createNebula(-1000, 480, -2400, '#8844ff', 600)   // Zephyr — upper-left, purple
    this.createNebula(1000, 430, -2400, '#ff3300', 450)    // Ignis — upper-right, red
    this.createNebula(-1000, -480, -2600, '#006699', 520)  // Glacies — lower-left, cyan
    this.createNebula(0, 0, -3000, '#996600', 750)         // Beacon — center, gold
    this.createDebris()
    this.createBeacon()
    this.createLightStreams()
  },

  activateCamera() {
    requestAnimationFrame(() => {
      document.querySelectorAll('a-entity[camera]').forEach((cameraEntity) => {
        cameraEntity.setAttribute('camera', 'active: false')
      })
      this.camera?.setAttribute('camera', 'active: true; fov: 70; near: 0.1; far: 8000')
    })
  },

  createStarfield() {
    const geometry = new this.THREE.BufferGeometry()
    const count = 3600
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3
      positions[i3] = rand(-180, 180)
      positions[i3 + 1] = rand(-180, 180)
      positions[i3 + 2] = rand(-180, 180)
      const brightness = rand(0.4, 1)
      colors[i3] = brightness
      colors[i3 + 1] = brightness
      colors[i3 + 2] = brightness
    }

    geometry.setAttribute('position', new this.THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new this.THREE.BufferAttribute(colors, 3))
    this.starPositions = geometry.attributes.position

    const material = new this.THREE.PointsMaterial({
      size: 0.75,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
    })

    this.starfield = new this.THREE.Points(geometry, material)
    this.worldGroup.add(this.starfield)
  },

  createPlanets() {
    this.planetMeshes = PLANETS.map((planet) => {
      const group = new this.THREE.Group()
      const worldPos = new this.THREE.Vector3(planet.worldPos.x, planet.worldPos.y, planet.worldPos.z)
      group.userData.worldPos = worldPos
      const fallbackCollisionRadius = planet.collisionRadius || Math.max(
        (planet.radius || planet.size) * PLANET_COLLISION_RADIUS_MULTIPLIER,
        planet.orbitRadius * PLANET_MIN_COLLISION_ORBIT_RATIO,
      )
      group.userData.collisionRadius = fallbackCollisionRadius

      let mesh = null
      let gltfEntity = null
      
      if (planet.gltfModel) {
        // GLTF přes A-Frame entitu (A-Frame se postará o načtení)
        gltfEntity = document.createElement('a-entity')
        gltfEntity.setAttribute('gltf-model', planet.gltfModel)
        gltfEntity.setAttribute('animation', `property: rotation; to: 0 360 0; loop: true; dur: 18000; easing: linear;`)
        // Změníme i měřítko, protože původní planety měly radius 22 až 30
        gltfEntity.setAttribute('scale', `${planet.size} ${planet.size} ${planet.size}`)
        
        // OPRAVA TMAVÝCH MODELŮ: Snížíme metalness, povrch zůstane přirozeně barevný
        gltfEntity.addEventListener('model-loaded', (e) => {
          const model = e.detail.model
          model.traverse((child) => {
            if (child.isMesh && child.material) {
              child.material.metalness = 0.05
              child.material.roughness = 0.8
            }
          })
          const bounds = new this.THREE.Box3().setFromObject(gltfEntity.object3D)
          if (!bounds.isEmpty()) {
            const modelSize = bounds.getSize(new this.THREE.Vector3())
            const modelRadius = modelSize.length() * 0.5
            group.userData.collisionRadius = clamp(
              Math.max(fallbackCollisionRadius, modelRadius),
              fallbackCollisionRadius,
              planet.orbitRadius * 0.9,
            )
          }
        }, { once: true })
        
        this.el.appendChild(gltfEntity)

        // PŘIDÁNÍ LOKÁLNÍHO SVĚTLA K PLANETĚ:
        // Skutečné světlo (PointLight) vytvořené v Groupu, aby obklopovalo a reálně svítilo
        // na planetu samotnou i odráželo od lodě při příletu.
        const planetLight = new this.THREE.PointLight(planet.color, 4, planet.orbitRadius * 3)
        // Světlo vyosené vpravo nahoru k hráči (typický "Sluneční" efekt)
        planetLight.position.set(planet.size * 2, planet.size * 1.5, planet.size * 2)
        group.add(planetLight)

      } else {
        const geometry = planet.geomType === 'icosahedron'
          ? new this.THREE.IcosahedronGeometry(planet.size, 3)
          : new this.THREE.SphereGeometry(planet.size, 48, 48)
        const material = new this.THREE.MeshStandardMaterial({
          color: planet.color,
          emissive: planet.emissive,
          emissiveIntensity: 0.6,
          roughness: planet.roughness ?? 0.75,
          metalness: planet.metalness ?? 0.2,
          flatShading: planet.geomType === 'icosahedron',
        })
        mesh = new this.THREE.Mesh(geometry, material)
        group.add(mesh)
        group.userData.collisionRadius = fallbackCollisionRadius
      }
      group.userData.planetMesh = mesh
      group.userData.gltfEntity = gltfEntity

      // Vytvoření pěkné kruhové záře
      const glowCanvas = document.createElement('canvas')
      glowCanvas.width = 256
      glowCanvas.height = 256
      const glowCtx = glowCanvas.getContext('2d')
      const glowGradient = glowCtx.createRadialGradient(128, 128, 0, 128, 128, 128)
      
      const glowColors = planet.glowColors || [planet.color, planet.color]
      const cInner = new this.THREE.Color(glowColors[0])
      const cOuter = new this.THREE.Color(glowColors[1] || glowColors[0])

      const rI = Math.round(cInner.r * 255)
      const gI = Math.round(cInner.g * 255)
      const bI = Math.round(cInner.b * 255)

      const rO = Math.round(cOuter.r * 255)
      const gO = Math.round(cOuter.g * 255)
      const bO = Math.round(cOuter.b * 255)

      // Uděláme záři vprostřed velmi intenzivní a více sytou vůči okrajům
      glowGradient.addColorStop(0, `rgba(${rI}, ${gI}, ${bI}, 1)`)
      glowGradient.addColorStop(0.2, `rgba(${rI}, ${gI}, ${bI}, 0.85)`)
      glowGradient.addColorStop(0.5, `rgba(${rO}, ${gO}, ${bO}, 0.35)`)
      glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      
      glowCtx.fillStyle = glowGradient
      glowCtx.fillRect(0, 0, 256, 256)
      
      const glowScale = planet.glowScale || 6
      const glowTexture = new this.THREE.CanvasTexture(glowCanvas)
      const glowMaterial = new this.THREE.SpriteMaterial({
        map: glowTexture,
        color: '#ffffff',
        transparent: true,
        opacity: 1.0, // Zcela bez průhlednosti samotného spritu
        depthWrite: false,
        blending: this.THREE.AdditiveBlending,
      })
      const glow = new this.THREE.Sprite(glowMaterial)
      glow.scale.set(planet.size * glowScale, planet.size * glowScale, 1)
      group.add(glow)
      group.userData.glowTexture = glowTexture // Pro pozdější uvolnění paměti

      if (planet.hasRings) {
        const ringGeometry = new this.THREE.RingGeometry(planet.size + 4, planet.size + 10, 80)
        const ringMaterial = new this.THREE.MeshBasicMaterial({
          color: planet.color,
          transparent: true,
          opacity: 0.22,
          side: this.THREE.DoubleSide,
        })
        const ring = new this.THREE.Mesh(ringGeometry, ringMaterial)
        ring.rotation.x = Math.PI / 2.3
        group.add(ring)
      }

      const orbitGeometry = new this.THREE.RingGeometry(planet.orbitRadius - 1, planet.orbitRadius + 1, 128)
      const orbitMaterial = new this.THREE.MeshBasicMaterial({
        color: '#00ff88',
        transparent: true,
        opacity: 0.06,
        side: this.THREE.DoubleSide,
      })
      const orbitRing = new this.THREE.Mesh(orbitGeometry, orbitMaterial)
      orbitRing.rotation.x = Math.PI / 2
      group.add(orbitRing)
      group.userData.orbitMaterial = orbitMaterial

      const atmosphereGeometry = new this.THREE.SphereGeometry(planet.size + 2, 32, 32)
      const atmosphereMaterial = new this.THREE.MeshBasicMaterial({
        color: planet.color,
        transparent: true,
        opacity: 0.08,
        side: this.THREE.BackSide,
        depthWrite: false,
      })
      const atmosphere = new this.THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
      group.add(atmosphere)
      group.userData.atmosphereMaterial = atmosphereMaterial

      group.position.copy(worldPos)
      this.worldGroup.add(group)
      return group
    })
  },

  createStations() {
    this.stationMeshes = STATIONS.map((station, index) => {
      const group = new this.THREE.Group()
      const worldPos = new this.THREE.Vector3(station.worldPos.x, station.worldPos.y, station.worldPos.z)
      group.userData.worldPos = worldPos
      const stationRevealAlpha = this.getStationRevealAlpha(index, this.travel.worldPos.distanceTo(worldPos))

      const stationEntity = createEntity('a-entity', {
        'gltf-model': `url(${station.model})`,
        scale: '34 34 34',
      }, this.el)
      const fallbackCollisionRadius = station.collisionRadius || station.dockRadius * STATION_COLLISION_RADIUS_MULTIPLIER
      stationEntity.addEventListener('model-loaded', (event) => {
        this.prepareStationModelMaterials(event.detail.model, group.userData.stationRevealAlpha)
        const bounds = new this.THREE.Box3().setFromObject(stationEntity.object3D)
        if (!bounds.isEmpty()) {
          const size = bounds.getSize(new this.THREE.Vector3())
          const modelRadius = size.length() * 0.32
          group.userData.collisionRadius = clamp(
            Math.max(fallbackCollisionRadius, modelRadius),
            fallbackCollisionRadius,
            station.dockRadius * 0.68,
          )
        }
      }, { once: true })

      const ringGeometry = new this.THREE.RingGeometry(station.dockRadius - 1.5, station.dockRadius + 1.5, 96)
      const ringMaterial = new this.THREE.MeshBasicMaterial({
        color: station.color,
        transparent: true,
        opacity: 0.08,
        side: this.THREE.DoubleSide,
      })
      const dockRing = new this.THREE.Mesh(ringGeometry, ringMaterial)
      dockRing.rotation.x = Math.PI / 2
      group.add(dockRing)

      const beaconGeometry = new this.THREE.OctahedronGeometry(18, 0)
      const beaconMaterial = new this.THREE.MeshBasicMaterial({
        color: station.color,
        transparent: true,
        opacity: 0.48,
        wireframe: true,
      })
      const beacon = new this.THREE.Mesh(beaconGeometry, beaconMaterial)
      beacon.position.y = 72
      group.add(beacon)

      const light = new this.THREE.PointLight(station.color, 3.2, station.dockRadius * 3)
      light.position.set(0, 40, 0)
      light.intensity = 3.2 * stationRevealAlpha
      group.add(light)

      const accents = this.createStationAccents(station)
      group.add(accents)

      const discoveryMarker = this.createStationDiscoveryMarker(station)
      group.add(discoveryMarker)

      const stationNavigationVisible = gameState.visitedStations.has(station.id)
      dockRing.visible = stationNavigationVisible
      beacon.visible = stationNavigationVisible
      accents.visible = stationNavigationVisible
      discoveryMarker.visible = stationRevealAlpha >= STATION_DISCOVERY_MARKER_REVEAL_ALPHA && !stationNavigationVisible

      group.userData.stationEntity = stationEntity
      group.userData.collisionRadius = fallbackCollisionRadius
      group.userData.stationLight = light
      group.userData.stationLightBaseIntensity = 3.2
      group.userData.stationRevealAlpha = stationRevealAlpha
      group.userData.dockRing = dockRing
      group.userData.ringMaterial = ringMaterial
      group.userData.beacon = beacon
      group.userData.beaconMaterial = beaconMaterial
      group.userData.accents = accents
      group.userData.discoveryMarker = discoveryMarker
      group.userData.stationIndex = index
      group.position.copy(worldPos)
      this.worldGroup.add(group)
      return group
    })
  },

  setStationVisualVisibility(index, visible) {
    const group = this.stationMeshes?.[index]
    if (!group) return

    group.userData.dockRing.visible = visible
    group.userData.beacon.visible = visible
    group.userData.accents.visible = visible
    if (visible && group.userData.discoveryMarker) group.userData.discoveryMarker.visible = false
  },

  createStationDiscoveryMarker(station) {
    const T = this.THREE
    const marker = new T.Group()
    const markerColor = new T.Color(station.color)
    const baseY = Math.max(178, station.dockRadius * 1.05)
    marker.position.set(
      STATION_DISCOVERY_MARKER_OFFSET.x,
      baseY + STATION_DISCOVERY_MARKER_OFFSET.y,
      STATION_DISCOVERY_MARKER_OFFSET.z,
    )
    marker.userData.baseY = baseY
    marker.userData.bobDistance = 28
    marker.userData.stationColor = markerColor

    const arrowMaterial = new T.MeshBasicMaterial({
      color: markerColor,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    })
    const arrow = new T.Mesh(new T.ConeGeometry(16, 38, 5), arrowMaterial)
    arrow.rotation.x = Math.PI
    arrow.position.y = 0
    marker.add(arrow)

    const stemMaterial = new T.MeshBasicMaterial({
      color: markerColor,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
    const stem = new T.Mesh(new T.CylinderGeometry(3.2, 3.2, 18, 5), stemMaterial)
    stem.position.y = 22
    marker.add(stem)

    const ringMaterial = new T.MeshBasicMaterial({
      color: markerColor,
      transparent: true,
      opacity: 0.32,
      side: T.DoubleSide,
      depthWrite: false,
    })
    const ring = new T.Mesh(new T.RingGeometry(20, 28, 40), ringMaterial)
    ring.rotation.x = Math.PI / 2
    ring.position.y = -28
    marker.add(ring)

    marker.userData.arrow = arrow
    marker.userData.stem = stem
    marker.userData.ring = ring
    marker.userData.materials = [arrowMaterial, stemMaterial, ringMaterial]
    marker.visible = false
    return marker
  },

  prepareStationModelMaterials(model, alpha = 1) {
    if (!model) return

    model.traverse((child) => {
      if (!child.isMesh || !child.material) return

      const materials = Array.isArray(child.material)
        ? child.material.map((material) => material.clone())
        : [child.material.clone()]
      child.material = Array.isArray(child.material) ? materials : materials[0]

      materials.forEach((material) => {
        material.userData.stationBaseOpacity = material.opacity ?? 1
        material.userData.stationBaseTransparent = !!material.transparent
        material.userData.stationBaseDepthWrite = material.depthWrite
        material.roughness = Math.max(material.roughness ?? 0.55, 0.55)
        material.metalness = Math.min(material.metalness ?? 0.25, 0.35)
      })
    })

    this.applyStationModelAlpha(model, alpha)
  },

  applyStationModelAlpha(model, alpha = 1) {
    if (!model) return

    model.traverse((child) => {
      if (!child.isMesh || !child.material) return

      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        const baseOpacity = material.userData.stationBaseOpacity ?? material.opacity ?? 1
        material.opacity = baseOpacity * alpha
        material.transparent = alpha < 0.999 || material.userData.stationBaseTransparent
        material.depthWrite = alpha >= 0.999 ? material.userData.stationBaseDepthWrite ?? true : false
        material.needsUpdate = true
      })
    })
  },

  setStationModelReveal(index, alpha) {
    const group = this.stationMeshes?.[index]
    if (!group) return

    const nextAlpha = clamp(alpha, 0, 1)
    if (Math.abs((group.userData.stationRevealAlpha ?? -1) - nextAlpha) < 0.005) return

    group.userData.stationRevealAlpha = nextAlpha
    if (group.userData.stationEntity) {
      group.userData.stationEntity.object3D.visible = true
      this.applyStationModelAlpha(group.userData.stationEntity.object3D, nextAlpha)
    }
    if (group.userData.stationLight) {
      group.userData.stationLight.intensity = group.userData.stationLightBaseIntensity * nextAlpha
    }
  },

  getStationVisualRevealDistance(station) {
    return station.visualRevealDistance || station.dockRadius * STATION_VISUAL_REVEAL_RADIUS_MULTIPLIER
  },

  getStationRevealFadeDistance(station) {
    return station.visualRevealFadeDistance || station.dockRadius * STATION_VISUAL_REVEAL_FADE_RADIUS_MULTIPLIER
  },

  getStationRevealAlpha(index, dist = Infinity) {
    const station = STATIONS[index]
    if (!station) return 0
    if (gameState.visitedStations.has(station.id)) return 1

    const revealDistance = this.getStationVisualRevealDistance(station)
    const fadeDistance = Math.max(this.getStationRevealFadeDistance(station), 1)
    const revealProgress = clamp((revealDistance - dist) / fadeDistance, 0, 1)
    return revealProgress * revealProgress * (3 - 2 * revealProgress)
  },

  isStationVisible(index) {
    const station = STATIONS[index]
    return !!station && gameState.visitedStations.has(station.id)
  },

  createStationAccents(station) {
    const T = this.THREE
    const accents = new T.Group()
    accents.name = `station-accents-${station.id}`
    accents.userData.kind = station.type

    const materialOptions = {
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
    }

    if (station.type === 'HANGÁR') {
      const laneMaterial = new T.MeshBasicMaterial({
        ...materialOptions,
        color: '#ffd700',
        opacity: 0.34,
      })
      const laneGeometry = new T.BoxGeometry(12, 2, 132)
      ;[-34, 34].forEach((x) => {
        const lane = new T.Mesh(laneGeometry, laneMaterial)
        lane.position.set(x, -18, 0)
        accents.add(lane)
      })

      const gateMaterial = new T.MeshBasicMaterial({
        ...materialOptions,
        color: '#00d8ff',
        opacity: 0.28,
      })
      const gateGeometry = new T.TorusGeometry(62, 1.4, 8, 96)
      const gate = new T.Mesh(gateGeometry, gateMaterial)
      gate.rotation.x = Math.PI / 2
      gate.position.z = -78
      accents.add(gate)
      accents.userData.pulseMaterials = [laneMaterial, gateMaterial]
      accents.userData.rotors = [{ object: gate, speed: 0.35 }]
      return accents
    }

    if (station.type === 'ARCHIV') {
      const ringMaterials = ['#ffd700', '#fff4b0', '#00d8ff'].map((color, index) => new T.MeshBasicMaterial({
        ...materialOptions,
        color,
        opacity: index === 1 ? 0.22 : 0.3,
      }))
      const ringDefs = [
        { radius: 74, tube: 1.2, rotation: [Math.PI / 2.1, 0, 0.2], speed: 0.18 },
        { radius: 96, tube: 0.9, rotation: [Math.PI / 2.8, 0.3, 0], speed: -0.12 },
        { radius: 118, tube: 0.7, rotation: [Math.PI / 1.85, -0.35, 0.5], speed: 0.08 },
      ]
      const rotors = ringDefs.map((def, index) => {
        const ring = new T.Mesh(new T.TorusGeometry(def.radius, def.tube, 8, 128), ringMaterials[index])
        ring.rotation.set(...def.rotation)
        accents.add(ring)
        return { object: ring, speed: def.speed }
      })

      accents.userData.pulseMaterials = ringMaterials
      accents.userData.rotors = rotors
      return accents
    }

    const beamMaterial = new T.MeshBasicMaterial({
      ...materialOptions,
      color: '#9b30ff',
      opacity: 0.2,
    })
    const beam = new T.Mesh(new T.CylinderGeometry(3, 18, 185, 24, 1, true), beamMaterial)
    beam.position.y = 92
    accents.add(beam)

    const waveMaterial = new T.MeshBasicMaterial({
      ...materialOptions,
      color: '#00d8ff',
      opacity: 0.2,
    })
    const wave = new T.Mesh(new T.TorusGeometry(72, 1, 8, 96), waveMaterial)
    wave.rotation.x = Math.PI / 2
    wave.position.y = 42
    accents.add(wave)

    const antennaMaterial = new T.MeshBasicMaterial({
      ...materialOptions,
      color: '#fff4b0',
      opacity: 0.38,
    })
    const antenna = new T.Mesh(new T.CylinderGeometry(1.8, 1.8, 92, 10), antennaMaterial)
    antenna.position.y = 62
    accents.add(antenna)

    accents.userData.pulseMaterials = [beamMaterial, waveMaterial, antennaMaterial]
    accents.userData.rotors = [{ object: wave, speed: 0.42 }]
    accents.userData.scalers = [{ object: beam, baseY: 1 }]
    return accents
  },

  createNebula(x, y, z, color, radius) {
    const points = []
    for (let i = 0; i < 600; i += 1) {
      const r = Math.random() * radius
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      points.push(
        r * Math.sin(phi) * Math.cos(theta) + x,
        r * Math.sin(phi) * Math.sin(theta) * 0.4 + y,
        r * Math.cos(phi) + z,
      )
    }
    const geometry = new this.THREE.BufferGeometry()
    geometry.setAttribute('position', new this.THREE.Float32BufferAttribute(points, 3))
    const material = new this.THREE.PointsMaterial({
      color,
      size: 3,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    })
    this.worldGroup.add(new this.THREE.Points(geometry, material))
  },

  createDebris() {
    this.obstacles = []

    SPACE_OBJECT_MODELS.forEach((def) => {
      for (let i = 0; i < def.count; i += 1) {
        const size = this.createDebrisSize(def)
        const scale = this.createDebrisScale(size, def.type)
        const pos = this.randomDebrisWorldPos()
        const entity = createEntity('a-entity', {
          'gltf-model': `url(${def.url})`,
          scale: `${scale.x} ${scale.y} ${scale.z}`,
          position: `${pos.x} ${pos.y} ${pos.z}`,
        }, this.el)
        const object = entity.object3D

        object.scale.copy(scale)
        object.position.copy(pos)
        object.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
        const fallbackRadius = Math.max(scale.x, scale.y, scale.z) * def.radiusMul
        entity.addEventListener('model-loaded', (event) => {
          event.detail.model.traverse((child) => {
            if (!child.isMesh || !child.material) return
            child.material.roughness = Math.max(child.material.roughness ?? 0.8, 0.75)
            child.material.metalness = Math.min(child.material.metalness ?? 0.1, 0.18)
          })
          const bounds = new this.THREE.Box3().setFromObject(entity.object3D)
          if (!bounds.isEmpty()) {
            const modelSize = bounds.getSize(new this.THREE.Vector3())
            const modelRadius = modelSize.length() * 0.5 * def.radiusMul
            object.userData.radius = Math.max(fallbackRadius, modelRadius)
          }
        }, { once: true })

        object.userData = {
          entity,
          debrisType: def.type,
          worldPos: pos.clone(),
          radius: fallbackRadius,
          drift: this.createDebrisDrift(def.type),
          rotationProfile: this.createDebrisRotationProfile(def.type, size),
          waveAmpX: rand(10, 34),
          waveAmpY: rand(8, 28),
          waveAmpZ: rand(4, 18),
          waveSpeed: rand(0.18, 0.56),
          waveOffset: Math.random() * Math.PI * 2,
        }

        this.obstacles.push(object)
      }
    })
  },

  randomDebrisWorldPos() {
    const lane = Math.random()
    const x = lane < 0.34
      ? rand(-2300, -620)
      : lane < 0.68
        ? rand(620, 2300)
        : rand(-1500, 1500)
    return new this.THREE.Vector3(x, rand(-1200, 1200), -550 - Math.random() * 5000)
  },

  createDebrisSize(def) {
    const t = Math.random()
    if (def.type === 'asteroid-field') {
      if (t > 0.9) return rand(def.sizeMax * 0.72, def.sizeMax)
      if (t > 0.55) return rand(def.sizeMin * 1.6, def.sizeMax * 0.62)
      return rand(def.sizeMin, def.sizeMin * 1.8)
    }
    if (t > 0.94) return rand(def.sizeMax * 0.7, def.sizeMax)
    if (t > 0.68) return rand(def.sizeMin * 2.2, def.sizeMax * 0.58)
    return rand(def.sizeMin, def.sizeMin * 2.4)
  },

  createDebrisScale(size, type) {
    const stretch = type === 'asteroid-field' ? 0.16 : 0.28
    return new this.THREE.Vector3(
      size * rand(1 - stretch, 1 + stretch),
      size * rand(1 - stretch, 1 + stretch),
      size * rand(1 - stretch, 1 + stretch),
    )
  },

  createDebrisDrift(type) {
    const speed = type === 'asteroid-field' ? rand(10, 24) : rand(18, 48)
    return new this.THREE.Vector3(
      rand(-0.7, 0.7),
      rand(-0.45, 0.45),
      rand(-0.35, 0.55),
    ).normalize().multiplyScalar(speed)
  },

  createDebrisRotationProfile(type, size) {
    const axis = () => new this.THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize()
    const sizeFactor = clamp(18 / Math.max(size, 1), 0.45, 2.8)
    const baseSpin = type === 'asteroid-field' ? rand(0.08, 0.24) : rand(0.18, 0.62)
    const fastSmallBody = type !== 'asteroid-field' && size < 12 && Math.random() > 0.72
    const spinRate = (fastSmallBody ? rand(0.7, 1.25) : baseSpin) * sizeFactor
    const tumbling = Math.random() > (type === 'asteroid-field' ? 0.68 : 0.38)

    return {
      spinAxis: axis(),
      tumbleAxis: axis(),
      precessionAxis: axis(),
      spinRate,
      tumbleRate: tumbling ? spinRate * rand(0.18, 0.46) : spinRate * rand(0.03, 0.11),
      precessionRate: tumbling ? spinRate * rand(0.08, 0.2) : spinRate * rand(0.015, 0.05),
      wobble: tumbling ? rand(0.25, 0.72) : rand(0.04, 0.18),
      phase: Math.random() * Math.PI * 2,
    }
  },

  createBeacon() {
    const T = this.THREE
    this.beaconGroup = new T.Group()
    this.beaconGroup.userData.worldPos = new T.Vector3(BEACON_WORLD.x, BEACON_WORLD.y, BEACON_WORLD.z)

    const coreGeo = new T.SphereGeometry(96, 64, 48)
    const coreMat = new T.MeshStandardMaterial({
      color: '#ffcf42',
      emissive: '#ff8a00',
      emissiveIntensity: 4.8,
      roughness: 0.42,
      metalness: 0,
    })
    this.beaconCore = new T.Mesh(coreGeo, coreMat)
    this.beaconGroup.add(this.beaconCore)

    const innerMat = new T.MeshBasicMaterial({
      color: '#fff6b2',
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: T.AdditiveBlending,
    })
    const innerSphere = new T.Mesh(new T.SphereGeometry(102, 48, 32), innerMat)
    this.beaconInnerSphere = innerSphere
    this.beaconGroup.add(innerSphere)

    const coronaMat = new T.MeshBasicMaterial({
      color: '#ff7a18',
      transparent: true,
      opacity: 0.18,
      side: T.BackSide,
      depthWrite: false,
      blending: T.AdditiveBlending,
    })
    this.beaconCorona = new T.Mesh(new T.SphereGeometry(135, 48, 32), coronaMat)
    this.beaconGroup.add(this.beaconCorona)

    // Subtle magnetic arcs around the sun, kept secondary to the larger body.
    this.beaconRings = []
    ;[
      { r: 150, tube: 0.45, color: '#ffd36a', speed: 0.003, rx: 0.22, rz: 0 },
      { r: 190, tube: 0.36, color: '#ff9b24', speed: -0.0025, rx: Math.PI / 2.7, rz: 0.36 },
      { r: 230, tube: 0.3, color: '#fff0a8', speed: 0.002, rx: Math.PI / 1.85, rz: -0.58 },
    ].forEach((cfg) => {
      const mat = new T.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: T.AdditiveBlending,
      })
      const ring = new T.Mesh(new T.TorusGeometry(cfg.r, cfg.tube, 8, 80), mat)
      ring.rotation.x = cfg.rx
      ring.rotation.z = cfg.rz
      ring.userData.rotSpeed = cfg.speed
      this.beaconGroup.add(ring)
      this.beaconRings.push(ring)
    })

    // Large glow sprite
    const gc = document.createElement('canvas')
    gc.width = 256
    gc.height = 256
    const gctx = gc.getContext('2d')
    const grad = gctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(255, 248, 190, 1)')
    grad.addColorStop(0.18, 'rgba(255, 200, 70, 0.86)')
    grad.addColorStop(0.5, 'rgba(255, 105, 18, 0.32)')
    grad.addColorStop(0.78, 'rgba(255, 42, 0, 0.08)')
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    gctx.fillStyle = grad
    gctx.fillRect(0, 0, 256, 256)
    const glowTex = new T.CanvasTexture(gc)
    const glowMat = new T.SpriteMaterial({
      map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    })
    const glow = new T.Sprite(glowMat)
    glow.scale.set(960, 960, 1)
    this.beaconGlow = glow
    this.beaconGroup.add(glow)
    this.beaconGroup.userData.glowTexture = glowTex

    // Golden point light
    this.beaconLight = new T.PointLight('#ffd080', BEACON_BASE_LIGHT_INTENSITY, BEACON_BASE_LIGHT_DISTANCE)
    this.beaconGroup.add(this.beaconLight)

    this.updateBeaconPower()
    this.worldGroup.add(this.beaconGroup)
  },

  updateBeaconPower(dt = 0) {
    if (!this.beaconGroup) return

    const wonCount = gameState.getWonMissionCount()
    const targetScale = 1 + wonCount * BEACON_SCALE_PER_WIN
    const targetGlowPower = 1 + wonCount * BEACON_GLOW_POWER_PER_WIN
    const smoothing = dt > 0 ? expSmoothingFactor(4, dt) : 1

    this.beaconCurrentScale = this.beaconCurrentScale == null
      ? targetScale
      : this.beaconCurrentScale + (targetScale - this.beaconCurrentScale) * smoothing
    this.beaconCurrentGlowPower = this.beaconCurrentGlowPower == null
      ? targetGlowPower
      : this.beaconCurrentGlowPower + (targetGlowPower - this.beaconCurrentGlowPower) * smoothing

    this.beaconGroup.scale.setScalar(this.beaconCurrentScale)

    if (this.beaconLight) {
      this.beaconLight.intensity = BEACON_BASE_LIGHT_INTENSITY * this.beaconCurrentGlowPower
      this.beaconLight.distance = BEACON_BASE_LIGHT_DISTANCE + wonCount * 450
    }
    if (this.beaconInnerSphere?.material) {
      this.beaconInnerSphere.material.opacity = Math.min(0.46, 0.28 + wonCount * 0.04)
    }
    if (this.beaconCorona?.material) {
      this.beaconCorona.material.opacity = Math.min(0.34, 0.18 + wonCount * 0.035)
    }
    if (this.beaconGlow?.material) {
      this.beaconGlow.material.opacity = Math.min(1, 0.82 + wonCount * 0.04)
    }
    this.beaconRings?.forEach((ring) => {
      ring.material.opacity = Math.min(0.34, 0.16 + wonCount * 0.035)
    })
  },

  createLightStreams() {
    const T = this.THREE
    this.lightStreams = []
    const beaconPos = new T.Vector3(BEACON_WORLD.x, BEACON_WORLD.y, BEACON_WORLD.z)

    PLANETS.forEach((planet, index) => {
      const planetPos = new T.Vector3(planet.worldPos.x, planet.worldPos.y, planet.worldPos.z)
      const count = 80
      const basePositions = new Float32Array(count * 3)

      for (let j = 0; j < count; j++) {
        const t = j / (count - 1)
        basePositions[j * 3] = beaconPos.x + (planetPos.x - beaconPos.x) * t
        basePositions[j * 3 + 1] = beaconPos.y + (planetPos.y - beaconPos.y) * t
        basePositions[j * 3 + 2] = beaconPos.z + (planetPos.z - beaconPos.z) * t
      }

      const geo = new T.BufferGeometry()
      geo.setAttribute('position', new T.BufferAttribute(new Float32Array(count * 3), 3))
      geo.userData.basePositions = basePositions
      geo.userData.count = count

      const mat = new T.PointsMaterial({
        color: planet.color,
        size: 3.5,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        blending: T.AdditiveBlending,
      })

      const stream = new T.Points(geo, mat)
      stream.userData.offset = Math.random()
      stream.userData.planetIndex = index
      stream.visible = gameState.isMissionWonOnPlanet(index)
      this.worldGroup.add(stream)
      this.lightStreams.push(stream)
    })
  },

  setupMobileControls() {
    const base = document.getElementById('galaxyJoystickBase')
    const knob = document.getElementById('galaxyJoystickKnob')
    if (!base || !knob) return

    let active = false
    let touchId = null

    const release = () => {
      active = false
      touchId = null
      knob.style.transform = 'translate(-50%, -50%)'
      ;['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].forEach((key) => {
        this.keys[key] = false
      })
    }

    const handle = (clientX, clientY) => {
      const rect = base.getBoundingClientRect()
      const dx = clientX - (rect.left + rect.width / 2)
      const dy = clientY - (rect.top + rect.height / 2)
      const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 50)
      const angle = Math.atan2(dy, dx)
      knob.style.transform = `translate(${Math.cos(angle) * dist - 25}px, ${Math.sin(angle) * dist - 25}px)`
      const normalized = dist / 50
      const joyX = Math.cos(angle) * normalized
      const joyY = Math.sin(angle) * normalized
      this.keys.arrowleft = joyX < -0.18
      this.keys.arrowright = joyX > 0.18
      this.keys.arrowup = joyY < -0.18
      this.keys.arrowdown = joyY > 0.18
    }

    this.mobileHandlers = {
      touchstart: (event) => {
        event.preventDefault()
        active = true
        touchId = event.touches[0].identifier
        handle(event.touches[0].clientX, event.touches[0].clientY)
      },
      touchmove: (event) => {
        if (!active) return
        event.preventDefault()
        for (const touch of event.touches) {
          if (touch.identifier === touchId) {
            handle(touch.clientX, touch.clientY)
            break
          }
        }
      },
      touchend: release,
      touchcancel: release,
    }

    base.addEventListener('touchstart', this.mobileHandlers.touchstart, { passive: false })
    window.addEventListener('touchmove', this.mobileHandlers.touchmove, { passive: false })
    window.addEventListener('touchend', this.mobileHandlers.touchend)
    window.addEventListener('touchcancel', this.mobileHandlers.touchcancel)
  },

  buildCompassMarkers() {
    const container = document.getElementById('compass-markers')
    if (!container) return
    container.innerHTML = ''
    this.compassMarkerEls = []
    this.stationCompassMarkerEls = []

    PLANETS.forEach((planet, index) => {
      const marker = document.createElement('div')
      marker.className = 'cm-marker'
      marker.id = `cm-marker-${index}`

      const dot = document.createElement('div')
      dot.className = 'cm-dot'
      dot.style.color = planet.color
      dot.style.background = planet.color
      dot.style.boxShadow = `0 0 8px ${planet.color}, 0 0 16px ${planet.color}`

      const label = document.createElement('div')
      label.className = 'cm-label'
      label.textContent = planet.name

      // Distance + elevation arrow on same row
      const distRow = document.createElement('div')
      distRow.className = 'cm-dist-row'

      const dist = document.createElement('span')
      dist.className = 'cm-dist'
      dist.id = `cm-dist-${index}`
      dist.textContent = '—'

      // ▲/▼ elevation arrow shown next to distance
      const elevArrow = document.createElement('span')
      elevArrow.className = 'cm-elev-arrow'
      elevArrow.id = `cm-elev-arrow-${index}`

      distRow.appendChild(dist)
      distRow.appendChild(elevArrow)

      // ◄/► horizontal off-screen arrow
      const arrow = document.createElement('div')
      arrow.className = 'cm-arrow'
      arrow.id = `cm-arrow-${index}`
      arrow.textContent = '◄'

      marker.appendChild(dot)
      marker.appendChild(label)
      marker.appendChild(distRow)
      marker.appendChild(arrow)
      container.appendChild(marker)

      this.compassMarkerEls.push({ marker, dot, label, dist, elevArrow, arrow })
    })

    STATIONS.forEach((station, index) => {
      const marker = document.createElement('div')
      marker.className = 'cm-marker station-marker'
      marker.id = `cm-station-marker-${index}`
      marker.hidden = !this.isStationVisible(index)

      const dot = document.createElement('div')
      dot.className = 'cm-dot station-dot'
      dot.style.color = station.color
      dot.style.background = station.color
      dot.style.boxShadow = `0 0 8px ${station.color}, 0 0 16px ${station.color}`

      const label = document.createElement('div')
      label.className = 'cm-label'
      label.textContent = station.name

      const distRow = document.createElement('div')
      distRow.className = 'cm-dist-row'

      const dist = document.createElement('span')
      dist.className = 'cm-dist'
      dist.id = `cm-station-dist-${index}`
      dist.textContent = '---'

      const elevArrow = document.createElement('span')
      elevArrow.className = 'cm-elev-arrow'
      elevArrow.id = `cm-station-elev-arrow-${index}`

      distRow.appendChild(dist)
      distRow.appendChild(elevArrow)

      const arrow = document.createElement('div')
      arrow.className = 'cm-arrow'
      arrow.id = `cm-station-arrow-${index}`
      arrow.textContent = '>'

      marker.appendChild(dot)
      marker.appendChild(label)
      marker.appendChild(distRow)
      marker.appendChild(arrow)
      container.appendChild(marker)

      this.stationCompassMarkerEls.push({ marker, dot, label, dist, elevArrow, arrow })
    })
  },

  buildPillsUI() {
    // planet-pills container removed from HTML; this is now a no-op kept for safety
    const container = document.getElementById('planet-pills')
    if (!container) return
    container.innerHTML = ''
  },

  getOrientationVectors() {
    const { yaw, pitch } = this.travel
    this.tmpForward.set(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    ).normalize()
    this.tmpRight.crossVectors(this.tmpForward, this.worldUp).normalize()
    this.tmpUp.crossVectors(this.tmpRight, this.tmpForward).normalize()
    return { forward: this.tmpForward, right: this.tmpRight, up: this.tmpUp }
  },

  recycleDebris(mesh, forward, right, up) {
    const ahead = rand(1400, 5600)
    const side = Math.random() < 0.5 ? rand(-2300, -520) : rand(520, 2300)
    const lift = rand(-1200, 1200)
    mesh.userData.worldPos.copy(this.travel.worldPos)
      .addScaledVector(forward, ahead)
      .addScaledVector(right, side)
      .addScaledVector(up, lift)
    mesh.userData.drift = this.createDebrisDrift(mesh.userData.debrisType)
    mesh.userData.rotationProfile = this.createDebrisRotationProfile(
      mesh.userData.debrisType,
      mesh.userData.radius,
    )
    mesh.userData.waveOffset = Math.random() * Math.PI * 2
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
  },

  closestPointOnSegment(start, end, point, target) {
    const segment = this.tmpCollisionStep.copy(end).sub(start)
    const segmentLenSq = segment.lengthSq()
    if (segmentLenSq <= 0.0001) return target.copy(end)

    const t = clamp(this.tmpCollisionDelta.copy(point).sub(start).dot(segment) / segmentLenSq, 0, 1)
    return target.copy(start).addScaledVector(segment, t)
  },

  getApproachRatio(planet, dist) {
    return clamp(1 - dist / (planet.orbitRadius * 6), 0.04, 1)
  },

  getBearingText(relativePos) {
    const parts = []
    if (relativePos.x < -120) parts.push('PORT')
    if (relativePos.x > 120) parts.push('STARBOARD')
    if (relativePos.y > 120) parts.push('HIGH')
    if (relativePos.y < -120) parts.push('LOW')
    if (!parts.length) return relativePos.z < -220 ? 'AHEAD' : 'LOCKED'
    return parts.join(' / ')
  },

  updateTargetCard(planet, dist, relativePos, missionWon) {
    setText('target-name', planet.name)
    setText('target-status', missionWon ? 'MISSION COMPLETE' : dist < planet.orbitRadius * 1.8 ? 'CLOSE APPROACH' : 'LONG RANGE')
    setText('target-bearing', this.getBearingText(relativePos))
    setWidth('target-bar-fill', this.getApproachRatio(planet, dist))
  },

  updatePills(shipWorldPos, nearestIdx) {
    // Pills replaced by compass markers; kept for backward compat (no-op if elements absent)
    PLANETS.forEach((planet, index) => {
      const worldPos = new this.THREE.Vector3(planet.worldPos.x, planet.worldPos.y, planet.worldPos.z)
      const dist = shipWorldPos.distanceTo(worldPos)
      const missionWon = gameState.isMissionWonOnPlanet(index)
      this.planetState[index].missionWon = missionWon
      const distTxt = missionWon ? '\u2713 HOTOVO' : `${Math.round(dist / 10)} km`
      // Legacy pill elements (absent in new HTML — safe to ignore)
      const pillDist = document.getElementById(`pill-dist-${index}`)
      if (pillDist) pillDist.textContent = distTxt
    })
  },

  updateStationAccents(accents, inDockRange, nearby, index, dt) {
    if (!accents) return
    const pulse = 0.5 + Math.sin(this.totalTime * 2.4 + index * 0.9) * 0.5
    const targetBoost = inDockRange ? 1.75 : nearby ? 1.25 : 0.85

    accents.userData.pulseMaterials?.forEach((material, materialIndex) => {
      if (!material) return
      const base = material.userData.baseOpacity ?? material.opacity ?? 0.25
      material.userData.baseOpacity = base
      material.opacity = base * targetBoost * (0.78 + pulse * 0.34 + materialIndex * 0.04)
    })

    accents.userData.rotors?.forEach(({ object, speed }) => {
      if (object) object.rotation.z += speed * dt
    })

    accents.userData.scalers?.forEach(({ object, baseY }) => {
      if (!object) return
      object.scale.y = baseY + pulse * (inDockRange ? 0.55 : 0.28)
    })
  },

  updateStationDiscoveryMarker(group, station, index, dist, dt) {
    const marker = group?.userData?.discoveryMarker
    if (!marker) return

    const discovered = (group.userData.stationRevealAlpha ?? 0) >= STATION_DISCOVERY_MARKER_REVEAL_ALPHA
    const explored = gameState.visitedStations.has(station.id)
    marker.visible = discovered && !explored
    if (!marker.visible) return

    const baseY = marker.userData.baseY || 120
    const bobDistance = marker.userData.bobDistance || 28
    const wave = Math.sin(this.totalTime * 2.15 + index * 0.7)
    const pulse = 0.5 + Math.sin(this.totalTime * 4.8 + index) * 0.5
    const proximityBoost = clamp(1 - dist / (station.dockRadius * 5), 0, 1)

    marker.position.set(
      STATION_DISCOVERY_MARKER_OFFSET.x,
      baseY + STATION_DISCOVERY_MARKER_OFFSET.y + wave * bobDistance * 0.5,
      STATION_DISCOVERY_MARKER_OFFSET.z,
    )
    marker.rotation.y += dt * 0.55
    marker.scale.setScalar(1 + pulse * 0.04 + proximityBoost * 0.08)

    const [arrowMaterial, stemMaterial, ringMaterial] = marker.userData.materials || []
    if (arrowMaterial) arrowMaterial.opacity = 0.72 + pulse * 0.16 + proximityBoost * 0.12
    if (stemMaterial) stemMaterial.opacity = 0.36 + pulse * 0.18
    if (ringMaterial) ringMaterial.opacity = 0.16 + pulse * 0.18 + proximityBoost * 0.08
    if (marker.userData.ring) marker.userData.ring.scale.setScalar(0.88 + pulse * 0.18)
  },

  updateCompassBar(shipWorldPos, nearestIdx, nearestStationIdx = -1) {
    if (!this.compassMarkerEls) return
    const track = document.getElementById('cb-track')
    if (!track) return
    const trackW = track.offsetWidth
    const trackH = track.offsetHeight
    if (!trackW || !trackH) return

    const { yaw } = this.travel
    const hdgDeg = ((yaw * 180 / Math.PI) % 360 + 360) % 360
    const headingText = `HDG ${String(Math.round(hdgDeg)).padStart(3, '0')}°`
    if (this._compassCache.heading !== headingText) {
      this._compassCache.heading = headingText
      const el = document.getElementById('cb-heading')
      if (el) el.textContent = headingText
    }

    const HALF = trackW / 2
    const FOV  = 120
    const ELEV_RANGE = 1500
    const ELEV_DEAD = 80
    const MARGIN_V = 6
    const MIN_TOP = MARGIN_V
    const MAX_TOP = trackH - MARGIN_V

    const tmpPlanetWorld = this.tmpVec
    const tmpToTarget = this.tmpVec2
    const cache = this._compassCache
    PLANETS.forEach((planet, index) => {
      tmpPlanetWorld.set(planet.worldPos.x, planet.worldPos.y, planet.worldPos.z)
      const toPlanet = tmpToTarget.copy(tmpPlanetWorld).sub(shipWorldPos)
      const dist = toPlanet.length()
      const missionWon = gameState.isMissionWonOnPlanet(index)
      this.planetState[index].missionWon = missionWon

      const dx = toPlanet.x
      const dz = toPlanet.z
      const worldAz = Math.atan2(dx, -dz)
      let relAz = worldAz - yaw
      relAz = ((relAz + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      const relAzDeg = relAz * 180 / Math.PI

      const dY = planet.worldPos.y - shipWorldPos.y

      const { marker, dist: distEl, elevArrow, arrow } = this.compassMarkerEls[index]
      let c = cache.planets[index]
      if (!c) c = cache.planets[index] = {}

      const distText = missionWon ? '\u2713 HOTOVO' : `${Math.round(dist / 10)} km`
      if (c.dist !== distText) { c.dist = distText; distEl.textContent = distText }

      const elevText = dY > ELEV_DEAD ? '▲' : dY < -ELEV_DEAD ? '▼' : ''
      if (c.elev !== elevText) { c.elev = elevText; elevArrow.textContent = elevText }

      const isLeft = relAzDeg < -FOV / 2
      const isRight = relAzDeg > FOV / 2
      const reached = missionWon
      const active = index === nearestIdx
      const nearby = !missionWon && dist < planet.orbitRadius * 2.8

      if (c.reached !== reached) { c.reached = reached; marker.classList.toggle('reached', reached) }
      if (c.active !== active) { c.active = active; marker.classList.toggle('active', active) }
      if (c.nearby !== nearby) { c.nearby = nearby; marker.classList.toggle('nearby', nearby) }
      if (c.isLeft !== isLeft) { c.isLeft = isLeft; marker.classList.toggle('edge-left', isLeft) }
      if (c.isRight !== isRight) { c.isRight = isRight; marker.classList.toggle('edge-right', isRight) }

      if (isLeft || isRight) {
        const arrowText = isLeft ? '◄' : '►'
        if (c.arrow !== arrowText) { c.arrow = arrowText; arrow.textContent = arrowText }
      } else {
        if (c.arrow !== '') { c.arrow = ''; arrow.textContent = '' }
        const px = Math.round(HALF + (relAzDeg / (FOV / 2)) * HALF)
        if (c.left !== px) { c.left = px; marker.style.left = `${px}px` }
        const frac = -dY / ELEV_RANGE
        const clamped = Math.max(-1, Math.min(1, frac))
        const topPx = Math.round(Math.max(MIN_TOP, Math.min(MAX_TOP, (0.5 + clamped * 0.5) * trackH)))
        if (c.top !== topPx) { c.top = topPx; marker.style.top = `${topPx}px` }
      }
    })

    const tmpStationWorld = this.tmpVec3
    const tmpToStation = this.tmpVec4
    STATIONS.forEach((station, index) => {
      tmpStationWorld.set(station.worldPos.x, station.worldPos.y, station.worldPos.z)
      const toStation = tmpToStation.copy(tmpStationWorld).sub(shipWorldPos)
      const dist = toStation.length()
      const dY = station.worldPos.y - shipWorldPos.y
      const markerParts = this.stationCompassMarkerEls?.[index]
      if (!markerParts) return
      const visible = this.isStationVisible(index)
      let sc = cache.stations[index]
      if (!sc) sc = cache.stations[index] = {}

      if (!visible) {
        if (sc.hidden !== true) { sc.hidden = true; markerParts.marker.hidden = true }
        return
      }
      if (sc.hidden !== false) { sc.hidden = false; markerParts.marker.hidden = false }

      const dx = toStation.x
      const dz = toStation.z
      const worldAz = Math.atan2(dx, -dz)
      let relAz = worldAz - yaw
      relAz = ((relAz + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      const relAzDeg = relAz * 180 / Math.PI
      const { marker, dist: distEl, elevArrow, arrow } = markerParts

      const distText = `${Math.round(dist / 10)} km`
      if (sc.dist !== distText) { sc.dist = distText; distEl.textContent = distText }

      const elevText = dY > ELEV_DEAD ? '^' : dY < -ELEV_DEAD ? 'v' : ''
      if (sc.elev !== elevText) { sc.elev = elevText; elevArrow.textContent = elevText }

      const active = index === nearestStationIdx
      const nearby = dist < station.dockRadius * 2.8
      const reached = gameState.visitedStations.has(station.id)
      const isLeft = relAzDeg < -FOV / 2
      const isRight = relAzDeg > FOV / 2

      if (sc.active !== active) { sc.active = active; marker.classList.toggle('active', active) }
      if (sc.nearby !== nearby) { sc.nearby = nearby; marker.classList.toggle('nearby', nearby) }
      if (sc.reached !== reached) { sc.reached = reached; marker.classList.toggle('reached', reached) }
      if (sc.isLeft !== isLeft) { sc.isLeft = isLeft; marker.classList.toggle('edge-left', isLeft) }
      if (sc.isRight !== isRight) { sc.isRight = isRight; marker.classList.toggle('edge-right', isRight) }

      if (isLeft || isRight) {
        const arrowText = isLeft ? '<' : '>'
        if (sc.arrow !== arrowText) { sc.arrow = arrowText; arrow.textContent = arrowText }
      } else {
        if (sc.arrow !== '') { sc.arrow = ''; arrow.textContent = '' }
        const px = Math.round(HALF + (relAzDeg / (FOV / 2)) * HALF)
        if (sc.left !== px) { sc.left = px; marker.style.left = `${px}px` }
        const frac = -dY / ELEV_RANGE
        const clamped = Math.max(-1, Math.min(1, frac))
        const topPx = Math.round(Math.max(MIN_TOP, Math.min(MAX_TOP, (0.5 + clamped * 0.5) * trackH)))
        if (sc.top !== topPx) { sc.top = topPx; marker.style.top = `${topPx}px` }
      }
    })
  },

  showMissionPanel(index) {
    if (this.activeMissionPlanetIdx === index) return
    this.closeStationPanel()
    this.activeMissionPlanetIdx = index
    const planet = PLANETS[index]
    const missionWon = gameState.isMissionWonOnPlanet(index)
    this.planetState[index].missionWon = missionWon

    const dot = document.getElementById('mp-dot')
    if (dot) {
      dot.style.background = planet.color
      dot.style.boxShadow = `0 0 10px ${planet.color}`
      dot.style.color = planet.color
    }
    setText('mp-title', planet.name)
    setText('mp-desc', planet.desc)
    setText('mp-status-badge', missionWon ? '✓ MISE SPLNĚNA' : '▸ MISE NESPLNĚNA')

    const statusBadge = document.getElementById('mp-status-badge')
    statusBadge?.classList.toggle('mission-won', missionWon)
    statusBadge?.classList.toggle('mission-open', !missionWon)

    const statsEl = document.getElementById('mp-stats')
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="mp-stat-row mission-status">
          <span class="mp-stat-label">STAV MISE</span>
          <span class="mp-stat-val ${missionWon ? 'mission-won' : 'mission-open'}">${missionWon ? 'SPLNĚNA' : 'NESPLNĚNA'}</span>
        </div>
        <div class="mp-stat-row">
          <span class="mp-stat-label">OBTÍŽNOST</span>
          <span class="mp-stat-val" style="color:${planet.diffColor}">${planet.diff}</span>
        </div>
        <div class="mp-stat-row">
          <span class="mp-stat-label">ODMĚNA</span>
          <span class="mp-stat-val" style="color:#00ffff">${planet.reward}</span>
        </div>
        <div class="mp-stat-row">
          <span class="mp-stat-label">TYP MISE</span>
          <span class="mp-stat-val" style="color:#aabbee">${planet.type}</span>
        </div>
      `
    }

    const button = document.getElementById('launch-btn')
    if (button) {
      button.disabled = false
      button.textContent = missionWon ? '↻ OPAKOVAT MISI' : '→ ZAHÁJIT MISI'
    }

    document.getElementById('mission-panel')?.classList.add('open')
    gamepadNavService.push({
      id: 'mission-panel',
      elements: () => [document.getElementById('launch-btn')].filter(Boolean),
      onBack: () => this.closeMissionPanel(),
    })
  },

  closeMissionPanel() {
    this.activeMissionPlanetIdx = null
    document.getElementById('mission-panel')?.classList.remove('open')
    gamepadNavService.remove('mission-panel')
  },

  showStationPanel(index) {
    if (this.activeStationIdx === index) return
    this.closeMissionPanel()
    this.activeStationIdx = index
    const station = STATIONS[index]
    const visited = gameState.visitedStations.has(station.id)
    const rewardSkin = SHIP_SKINS.find((skin) => skin.id === station.rewardSkinId)

    const dot = document.getElementById('sp-dot')
    if (dot) {
      dot.style.background = station.color
      dot.style.boxShadow = `0 0 10px ${station.color}`
      dot.style.color = station.color
    }
    setText('sp-title', station.name)
    setText('sp-desc', station.desc)
    setText('sp-status-badge', visited ? 'DOK NAVŠTÍVEN' : 'DOKOVÁNÍ DOSTUPNÉ')

    const statsEl = document.getElementById('sp-stats')
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="mp-stat-row">
          <span class="mp-stat-label">TYP STANICE</span>
          <span class="mp-stat-val" style="color:${station.color}">${station.type}</span>
        </div>
        <div class="mp-stat-row">
          <span class="mp-stat-label">ODMENA</span>
          <span class="mp-stat-val" style="color:#ffd700">${rewardSkin ? rewardSkin.name : 'Archivni zaznam'}</span>
        </div>
        <div class="mp-stat-row">
          <span class="mp-stat-label">STAV</span>
          <span class="mp-stat-val ${visited ? 'mission-won' : 'mission-open'}">${visited ? 'NAVŠTÍVENO' : 'PŘIPRAVENO'}</span>
        </div>
      `
    }

    const button = document.getElementById('dock-btn')
    if (button) {
      button.disabled = false
      button.textContent = visited ? 'OTEVŘÍT HANGÁR' : 'PŘISTÁT'
    }

    document.getElementById('station-panel')?.classList.add('open')
    gamepadNavService.push({
      id: 'station-panel',
      elements: () => [document.getElementById('dock-btn')].filter(Boolean),
      onBack: () => this.closeStationPanel(),
    })
  },

  closeStationPanel() {
    this.activeStationIdx = null
    document.getElementById('station-panel')?.classList.remove('open')
    gamepadNavService.remove('station-panel')
  },

  dockStation() {
    if (this.activeStationIdx === null || this.docking) return
    this.docking = true
    this.travel.velocity.multiplyScalar(0.18)
    const button = document.getElementById('dock-btn')
    if (button) {
      button.disabled = true
      button.textContent = 'DOKOVÁNÍ...'
    }

    this.dockingOverlay?.remove()
    this.dockingOverlay = document.createElement('div')
    this.dockingOverlay.className = 'warp-overlay'
    this.dockingOverlay.style.cssText = 'position:fixed;inset:0;z-index:510;display:flex;align-items:center;justify-content:center;background:rgba(0,4,10,0.88);opacity:0;transition:opacity 0.35s ease;pointer-events:auto;'
    this.dockingOverlay.innerHTML = '<h1 style="color:#00ffff;font-family:Orbitron,sans-serif;letter-spacing:5px;text-shadow:0 0 30px #00ffff;">DOKOVÁNÍ ZAHÁJENO</h1>'
    document.body.appendChild(this.dockingOverlay)

    requestAnimationFrame(() => {
      if (this.dockingOverlay) this.dockingOverlay.style.opacity = '1'
    })

    this.dockingTimer = window.setTimeout(() => {
      const station = STATIONS[this.activeStationIdx]
      if (station) {
        gameState.visitStation(station.id)
        this.setStationModelReveal(this.activeStationIdx, 1)
        this.setStationVisualVisibility(this.activeStationIdx, true)
        if (station.rewardSkinId) gameState.unlockShipSkin(station.rewardSkinId)
      }
      this.dockingOverlay?.remove()
      this.dockingOverlay = null
      this.docking = false
      this.openHangar(station)
    }, 850)
  },

  openHangar(station) {
    return this.hangarController.open(station)
  },

  closeHangar() {
    return this.hangarController.close()
  },

  renderHangarSkins() {
    return this.hangarController.renderSkins()
  },

  stepHangarSkin(direction) {
    return this.hangarController.stepSkin(direction)
  },

  selectHangarSkin() {
    return this.hangarController.selectSkin()
  },

  createHangarPreview() {
    return this.hangarController.createPreview()
  },

  updateHangarPreview() {
    return this.hangarController.updatePreview()
  },

  destroyHangarPreview() {
    return this.hangarController.destroyPreview()
  },

  applySelectedShipSkin() {
    const skin = gameState.getSelectedShipSkin()
    this.ship?.setAttribute('lk-ship-model', `color: ${skin.accentColor}; shield: false; modelUrl: ${skin.modelUrl}`)
  },

  launchMission() {
    if (this.activeMissionPlanetIdx === null || this.launching) return
    this.launching = true
    const planetIndex = this.activeMissionPlanetIdx
    const button = document.getElementById('launch-btn')
    if (button) {
      button.textContent = 'WARP DRIVE AKTIVOVÁN…'
      button.disabled = true
    }

    window.dispatchEvent(new CustomEvent('launch-mission', {
      detail: { planetIndex },
    }))
  },

  showApproachHint(planetName) {
    const indicator = document.getElementById('approach-indicator')
    setText('approach-text', `ORBIT DOSAŽENA › ${planetName} – Přistání povoleno`)
    indicator?.classList.add('visible')
    if (this.approachTimeout) window.clearTimeout(this.approachTimeout)
    this.approachTimeout = window.setTimeout(() => indicator?.classList.remove('visible'), 5000)
  },

  showDockHint(stationName) {
    const indicator = document.getElementById('approach-indicator')
    setText('approach-text', `DOK DOSAZEN > ${stationName} - pristani povoleno`)
    indicator?.classList.add('visible')
    if (this.approachTimeout) window.clearTimeout(this.approachTimeout)
    this.approachTimeout = window.setTimeout(() => indicator?.classList.remove('visible'), 5000)
  },

  playOrbitFx() {
    const fx = document.getElementById('orbit-fx')
    if (!fx) return
    fx.classList.remove('play')
    void fx.offsetWidth
    fx.classList.add('play')
  },

  updateShipModel(totalTime, throttleVisual, rcsVerticalInput = 0) {
    const engine = this.ship.object3D.getObjectByName('engine')
    if (!engine) return
    const thrust = clamp(throttleVisual, 0.08, 1.65)
    const flicker = 0.86 + Math.sin(totalTime * 26) * 0.08 + Math.sin(totalTime * 43.7) * 0.05
    const outer = engine.getObjectByName('engine-plume-outer')
    const inner = engine.getObjectByName('engine-plume-inner')
    const nozzleGlow = engine.getObjectByName('engine-nozzle-glow')
    const shipGlow = this.ship.object3D.getObjectByName('ship-glow')

    if (outer?.material) {
      outer.scale.set(0.9 + thrust * 0.16, 0.85 + thrust * 0.55, 0.9 + thrust * 0.16)
      outer.material.opacity = (0.18 + thrust * 0.18) * flicker
    }
    if (inner?.material) {
      inner.scale.set(0.72 + thrust * 0.1, 0.72 + thrust * 0.48, 0.72 + thrust * 0.1)
      inner.material.opacity = (0.38 + thrust * 0.28) * flicker
    }
    if (nozzleGlow?.material) {
      const glowScale = 0.46 + thrust * 0.38 + Math.sin(totalTime * 31) * 0.04
      const baseScale = nozzleGlow.userData.baseScale || [0.7, 0.7, 1]
      nozzleGlow.scale.set(baseScale[0] * glowScale, baseScale[1] * glowScale, baseScale[2])
      nozzleGlow.material.opacity = (0.2 + thrust * 0.28) * flicker
    }
    if (shipGlow?.material) {
      const glowScale = 0.86 + thrust * 0.45
      const baseScale = shipGlow.userData.baseScale || [1.1, 1.1, 1]
      shipGlow.scale.set(baseScale[0] * glowScale, baseScale[1] * glowScale, baseScale[2])
      shipGlow.material.opacity = (0.08 + thrust * 0.18) * flicker
    }
    engine.userData.sparks?.forEach((spark, index) => {
      const cycle = (totalTime * spark.userData.speed + spark.userData.seed) % 1
      const angle = spark.userData.seed + totalTime * (1.4 + index * 0.03)
      const spread = spark.userData.radius + cycle * 0.22 * thrust
      spark.position.set(
        Math.cos(angle) * spread,
        Math.sin(angle) * spread * 0.6,
        -cycle * spark.userData.length * (0.7 + thrust * 0.65),
      )
      const size = (0.05 + cycle * 0.13) * (0.8 + thrust * 0.35)
      spark.scale.set(size, size, 1)
      spark.material.opacity = (1 - cycle) * (0.16 + thrust * 0.26)
    })

    this.updateRcsThrusters(totalTime, rcsVerticalInput)
  },

  updateRcsThrusters(totalTime, verticalInput) {
    const activeNames = verticalInput > 0
      ? ['rcs-down-left', 'rcs-down-right']
      : []
    const activeSet = new Set(activeNames)
    const powerLevel = clamp(Math.abs(verticalInput), 0, 1)
    const flicker = 0.84 + Math.sin(totalTime * 38) * 0.09 + Math.sin(totalTime * 61.3) * 0.06

    ;['rcs-down-left', 'rcs-down-right'].forEach((name) => {
      const thruster = this.ship.object3D.getObjectByName(name)
      if (!thruster) return
      const power = activeSet.has(name) ? powerLevel : 0
      const plume = thruster.getObjectByName('rcs-plume')
      const inner = thruster.getObjectByName('rcs-plume-inner')
      const glow = thruster.getObjectByName('rcs-glow')
      if (plume?.material) {
        plume.material.opacity = (0.13 + power * 0.34) * power * flicker
        plume.scale.set(
          0.62 + power * 0.22,
          0.7 + power * 0.5,
          0.62 + power * 0.22,
        )
      }
      if (inner?.material) {
        inner.material.opacity = (0.32 + power * 0.48) * power * flicker
        inner.scale.set(
          0.72 + power * 0.12,
          0.78 + power * 0.42,
          0.72 + power * 0.12,
        )
      }
      if (glow?.material) {
        const baseGlowScale = glow.userData.baseScale || 0.22
        const glowScale = baseGlowScale + power * baseGlowScale * 0.72 + Math.sin(totalTime * 44) * power * baseGlowScale * 0.1
        glow.scale.set(glowScale, glowScale, 1)
        glow.material.opacity = (0.1 + power * 0.22) * power * flicker
      }
    })
  },

  updateShipAttitude({ yawInput, forwardInput, braking, localStrafe, localLift, dt }) {
    const attitude = this.shipAttitude
    const safeDt = Math.max(dt, 1 / 120)
    const localStrafeAccel = (localStrafe - attitude.previousLocalStrafe) / safeDt
    const localLiftAccel = (localLift - attitude.previousLocalLift) / safeDt

    const targetRoll = clamp(
      -this.travel.yawVelocity * 0.34
      - localStrafe * 0.0035
      - localStrafeAccel * 0.0009
      - yawInput * 0.08,
      -0.62,
      0.62,
    )
    const targetPitch = clamp(
      this.travel.inputY * 0.16
      + localLift * 0.0016
      + localLiftAccel * 0.00045
      - Math.max(0, forwardInput) * 0.045
      + (braking ? 0.08 : 0),
      -0.26,
      0.24,
    )
    const targetYaw = clamp(
      -yawInput * 0.055 - localStrafe * 0.0009,
      -0.13,
      0.13,
    )

    const roll = springValue(attitude.roll, attitude.rollVelocity, targetRoll, 34, 8.5, dt)
    const pitch = springValue(attitude.pitch, attitude.pitchVelocity, targetPitch, 30, 8, dt)
    const yaw = springValue(attitude.yaw, attitude.yawVelocity, targetYaw, 28, 7.5, dt)

    attitude.roll = roll.value
    attitude.rollVelocity = roll.velocity
    attitude.pitch = pitch.value
    attitude.pitchVelocity = pitch.velocity
    attitude.yaw = yaw.value
    attitude.yawVelocity = yaw.velocity
    attitude.previousLocalStrafe = localStrafe
    attitude.previousLocalLift = localLift

    return clamp(Math.abs(attitude.roll) / 0.62 + Math.abs(attitude.pitch) / 0.26, 0, 1.4)
  },

  applyShipAttitude(cameraObj, shipObj, dt) {
    this.shipYawQuat.setFromAxisAngle(this.shipYawAxis, this.shipAttitude.yaw)
    this.shipBankQuat.setFromAxisAngle(this.shipRollAxis, this.shipAttitude.roll)
    this.shipPitchQuat.setFromAxisAngle(this.shipPitchAxis, this.shipAttitude.pitch)
    this.shipTargetQuat.copy(cameraObj.quaternion)
      .multiply(this.shipYawQuat)
      .multiply(this.shipBankQuat)
      .multiply(this.shipPitchQuat)
    shipObj.quaternion.slerp(this.shipTargetQuat, expSmoothingFactor(9, dt))
  },

  tick(_time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.05)

    // Always update gamepad (keeps _prev in sync even when menu is open).
    const gp = gamepadService.getPad()
    const gpState = gp ? gamepadService.update(this.keys, gp) : null
    if (gpState?.systemMenuJustPressed) {
      window.dispatchEvent(new CustomEvent('gamepad-system-menu'))
    }

    const hangarOpen = !document.getElementById('hangar-panel')?.classList.contains('hidden')
    if (hangarOpen) {
      if (gpState?.leftShoulderJustPressed) this.stepHangarSkin(-1)
      if (gpState?.rightShoulderJustPressed) this.stepHangarSkin(1)
    }
    if (this.systemMenuOpen || this.docking || hangarOpen) {
      this.updateShipAttitude({
        yawInput: 0,
        forwardInput: 0,
        braking: false,
        localStrafe: 0,
        localLift: 0,
        dt,
      })
      this.updateShipModel(this.totalTime, 0, 0)
      if (this.camera?.object3D && this.ship?.object3D) {
        this.applyShipAttitude(this.camera.object3D, this.ship.object3D, dt)
      }
      audioService.stopShipEngine(dt)
      audioService.stopMusic(dt)
      return
    }

    if (gpState?.backJustPressed) {
      this.closeMissionPanel()
      this.closeStationPanel()
    }

    this.totalTime += dt
    this.collisionCooldown = Math.max(0, this.collisionCooldown - dt)

    const T = this.THREE
    const travel = this.travel
    const moveY = (this.keys.w || this.keys.arrowup ? 1 : 0) - (this.keys.s || this.keys.arrowdown ? 1 : 0)
    const targetInputY = clamp(moveY, -1, 1)
    travel.inputX += (0 - travel.inputX) * 10 * dt
    travel.inputY += (targetInputY - travel.inputY) * 8 * dt

    const yawInput = (this.keys.d || this.keys.arrowright ? 1 : 0) - (this.keys.a || this.keys.arrowleft ? 1 : 0)
    const keyForward = (this.keys.shift || this.keys.shiftleft || this.keys.shiftright ? 1 : 0)
      - (this.keys.control || this.keys.controlleft || this.keys.controlright ? 1 : 0)
    const gpThrottle = gpState ? gpState.forwardThrottle - gpState.reverseThrottle : 0
    const forwardInput = clamp(keyForward + gpThrottle, -1, 1)
    const braking = !!(this.keys[' '] || this.keys.space)

    travel.yawVelocity += yawInput * travel.turnAccel * dt
    travel.pitchVelocity *= Math.exp(-travel.turnDamping * dt)
    travel.yawVelocity *= Math.exp(-travel.turnDamping * dt)
    travel.yawVelocity = clamp(travel.yawVelocity, -travel.maxTurnSpeed, travel.maxTurnSpeed)
    travel.pitchVelocity = clamp(travel.pitchVelocity, -travel.maxTurnSpeed, travel.maxTurnSpeed)
    travel.yaw += travel.yawVelocity * dt
    travel.pitch = clamp(travel.pitch + travel.pitchVelocity * dt, -1.15, 1.15)

    const { forward, right, up } = this.getOrientationVectors()
    const acceleration = this.tmpVec.set(0, 0, 0)
      .addScaledVector(right, travel.inputX * travel.strafeThrust)

    if (forwardInput > 0) acceleration.addScaledVector(forward, forwardInput * travel.forwardThrust)
    if (forwardInput < 0) acceleration.addScaledVector(forward, forwardInput * travel.reverseThrust)
    const verticalAuthority = 0.55 + Math.max(0, forwardInput) * 0.45
    acceleration.addScaledVector(up, travel.inputY * travel.strafeThrust * verticalAuthority)

    travel.velocity.addScaledVector(acceleration, dt)

    const forwardSpeed = clamp(travel.velocity.dot(forward), -travel.maxReverseSpeed, travel.maxForwardSpeed)
    const lateralVelocity = this.tmpVec2.copy(travel.velocity).addScaledVector(forward, -travel.velocity.dot(forward))
    const lateralSpeed = lateralVelocity.length()
    if (lateralSpeed > travel.maxStrafeSpeed) lateralVelocity.multiplyScalar(travel.maxStrafeSpeed / lateralSpeed)
    travel.velocity.copy(lateralVelocity).addScaledVector(forward, forwardSpeed)

    travel.velocity.multiplyScalar(Math.exp(-(braking ? travel.brakeDrag : travel.drag) * dt))
    if (braking && travel.velocity.length() < 4) travel.velocity.set(0, 0, 0)

    travel.worldPos.addScaledVector(travel.velocity, dt)
    travel.speed = travel.velocity.length()

    const localStrafe = travel.velocity.dot(right)
    const localLift = travel.velocity.dot(up)
    const shipTargetX = clamp(
      -travel.yawVelocity * 0.42
      + localStrafe * 0.008
      - yawInput * 0.55,
      -2.8,
      2.8,
    )
    const shipTargetY = clamp(
      localLift * 0.012
      + travel.inputY * 0.45,
      -2.7,
      1.5,
    )

    const shipObj = this.ship.object3D
    const previousShipX = shipObj.position.x
    const previousShipY = shipObj.position.y
    shipObj.userData.targetX += (shipTargetX - shipObj.userData.targetX) * expSmoothingFactor(5.5, dt)
    shipObj.userData.targetY += (shipTargetY - shipObj.userData.targetY) * expSmoothingFactor(5.0, dt)
    shipObj.position.set(shipObj.userData.targetX, shipObj.userData.targetY, 0)
    shipObj.scale.set(1.6, 1.6, 1.6)
    shipObj.visible = true

    const maneuverIntensity = this.updateShipAttitude({
      yawInput,
      forwardInput,
      braking,
      localStrafe,
      localLift,
      dt,
    })
    const throttleVisual = Math.max(0, forwardInput) + (travel.speed / travel.maxForwardSpeed) * 0.6
    this.updateShipModel(this.totalTime, throttleVisual + maneuverIntensity * 0.12, travel.inputY)
    audioService.updateShipEngine({
      active: true,
      throttle: Math.max(0, forwardInput),
      speedPct: travel.speed / travel.maxForwardSpeed,
      dt,
      mode: 'galaxy',
    })
    audioService.updateMusic({
      track: 'galaxy',
      active: true,
      volume: 0.09,
      dt,
    })

    if (this.starPositions) {
      const starShift = this.tmpVec3.copy(travel.velocity).multiplyScalar(-dt * 0.18)
      for (let i = 0; i < this.starPositions.count; i += 1) {
        let x = this.starPositions.getX(i) + starShift.x
        let y = this.starPositions.getY(i) + starShift.y
        let z = this.starPositions.getZ(i) + starShift.z
        if (x > 180) x -= 360
        if (x < -180) x += 360
        if (y > 180) y -= 360
        if (y < -180) y += 360
        if (z > 180) z -= 360
        if (z < -180) z += 360
        this.starPositions.setXYZ(i, x, y, z)
      }
      this.starPositions.needsUpdate = true
    }

    const cameraObj = this.camera.object3D
    const cameraTarget = this.tmpVec4.copy(shipObj.position)
      .addScaledVector(forward, -13)
      .addScaledVector(up, 4.2)
      .addScaledVector(right, shipObj.position.x * 0.04)
    cameraObj.position.lerp(cameraTarget, 1 - Math.exp(-4 * dt))
    const lookTarget = this.tmpVec5.copy(shipObj.position).addScaledVector(forward, 80).addScaledVector(up, 2.2)
    cameraObj.lookAt(lookTarget)
    cameraObj.quaternion.multiply(this.cameraFlipQuat)

    const camera = this.camera.getObject3D('camera')
    if (camera) {
      const targetFov = forwardInput > 0 ? 76 : 70
      camera.fov += (targetFov - camera.fov) * 2.8 * dt
      camera.updateProjectionMatrix()
    }

    this.applyShipAttitude(cameraObj, shipObj, dt)

    this.shipLight.object3D.position.copy(shipObj.position).add(this.lightOffset)

    const shipWorld = travel.worldPos
    const previousShipLocal = this.tmpCollisionStart
      .copy(travel.velocity)
      .multiplyScalar(-dt)
      .addScaledVector(right, previousShipX)
      .addScaledVector(up, previousShipY)
    const currentShipLocal = this.tmpCollisionEnd.copy(shipObj.position)
    this.obstacles.forEach((obstacle) => {
      obstacle.userData.worldPos.addScaledVector(obstacle.userData.drift, dt)
      const wave = this.totalTime * obstacle.userData.waveSpeed + obstacle.userData.waveOffset
      obstacle.position.x = obstacle.userData.worldPos.x - shipWorld.x + Math.sin(wave) * obstacle.userData.waveAmpX
      obstacle.position.y = obstacle.userData.worldPos.y - shipWorld.y + Math.cos(wave * 1.2) * obstacle.userData.waveAmpY
      obstacle.position.z = obstacle.userData.worldPos.z - shipWorld.z + Math.sin(wave * 0.7) * obstacle.userData.waveAmpZ

      if (obstacle.userData.worldPos.distanceTo(shipWorld) > 5200) {
        this.recycleDebris(obstacle, forward, right, up)
      }

      const rotation = obstacle.userData.rotationProfile
      const wobblePulse = 0.5 + Math.sin(this.totalTime * rotation.precessionRate + rotation.phase) * 0.5
      obstacle.rotateOnAxis(rotation.spinAxis, rotation.spinRate * dt)
      obstacle.rotateOnWorldAxis(rotation.tumbleAxis, rotation.tumbleRate * dt)
      obstacle.rotateOnWorldAxis(rotation.precessionAxis, rotation.wobble * wobblePulse * rotation.precessionRate * dt)

      const closestShipPoint = this.closestPointOnSegment(previousShipLocal, currentShipLocal, obstacle.position, this.tmpCollisionPoint)
      const collisionDist = closestShipPoint.distanceTo(obstacle.position)
      const combinedRadius = obstacle.userData.radius + SHIP_COLLISION_RADIUS
      if (collisionDist < combinedRadius) {
        const normal = this.tmpCollisionNormal.copy(currentShipLocal).sub(obstacle.position)
        if (normal.lengthSq() < 0.0001) normal.copy(closestShipPoint).sub(obstacle.position)
        if (normal.lengthSq() < 0.0001) normal.copy(forward).multiplyScalar(-1)
        normal.normalize()

        const penetration = combinedRadius - collisionDist
        travel.worldPos.addScaledVector(normal, Math.min(penetration + 1.2, 44))

        const normalSpeed = travel.velocity.dot(normal)
        if (normalSpeed < 0) travel.velocity.addScaledVector(normal, -normalSpeed * 1.35)
        travel.velocity.multiplyScalar(0.62)
        obstacle.userData.drift.addScaledVector(normal, -18)

        if (this.collisionCooldown === 0) {
          this.collisionCooldown = 0.16
          const flash = document.getElementById('damage-flash')
          flash?.classList.add('on')
          window.setTimeout(() => flash?.classList.remove('on'), 150)
        }
      }
    })

    let nearestDist = Infinity
    let nearestIdx = -1
    let nearestStationDist = Infinity
    let nearestStationIdx = -1

    PLANETS.forEach((planet, index) => {
      const group = this.planetMeshes[index]
      const planetWorld = group.userData.worldPos
      group.position.set(
        planetWorld.x - shipWorld.x,
        planetWorld.y - shipWorld.y,
        planetWorld.z - shipWorld.z,
      )
      
      // Synchronizace oddělené A-Frame entity na stejnou pozici
      if (group.userData.gltfEntity) {
        group.userData.gltfEntity.object3D.position.copy(group.position)
      }

      const planetBodyRadius = (group.userData.collisionRadius || planet.orbitRadius * PLANET_MIN_COLLISION_ORBIT_RATIO) + SHIP_COLLISION_RADIUS
      const closestShipPoint = this.closestPointOnSegment(previousShipLocal, currentShipLocal, group.position, this.tmpCollisionPoint)
      const collisionDist = closestShipPoint.distanceTo(group.position)
      if (collisionDist < planetBodyRadius) {
        const normal = this.tmpCollisionNormal.copy(currentShipLocal).sub(group.position)
        if (normal.lengthSq() < 0.0001) normal.copy(closestShipPoint).sub(group.position)
        if (normal.lengthSq() < 0.0001) normal.copy(forward).multiplyScalar(-1)
        normal.normalize()

        const penetration = planetBodyRadius - collisionDist
        travel.worldPos.addScaledVector(normal, penetration + 2.5)

        const normalSpeed = travel.velocity.dot(normal)
        if (normalSpeed < 0) travel.velocity.addScaledVector(normal, -normalSpeed * 1.65)
        travel.velocity.multiplyScalar(0.38)

        if (this.collisionCooldown === 0) {
          this.collisionCooldown = 0.24
          const flash = document.getElementById('damage-flash')
          flash?.classList.add('on')
          window.setTimeout(() => flash?.classList.remove('on'), 150)
        }
      }

      if (group.userData.planetMesh) {
        group.userData.planetMesh.rotation.y += 0.002
      }
      group.userData.atmosphereMaterial.opacity = 0.06 + Math.sin(this.totalTime * 1.5 + index) * 0.02

      const dist = shipWorld.distanceTo(planetWorld)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestIdx = index
      }

      const inOrbit = dist < planet.orbitRadius
      const nearby = dist < planet.orbitRadius * 2.8
      this.planetState[index].nearby = nearby
      const missionWon = gameState.isMissionWonOnPlanet(index)
      this.planetState[index].missionWon = missionWon

      group.userData.orbitMaterial.opacity = inOrbit ? 0.22 : nearby ? 0.12 : 0.04
      group.userData.orbitMaterial.color.set(inOrbit && !missionWon ? '#00ffff' : '#00ff88')
      if (group.userData.planetMesh) {
        group.userData.planetMesh.material.emissiveIntensity = inOrbit ? 1.2 : nearby ? 0.8 : 0.5
      }

      if (inOrbit && !this.planetState[index].orbitVisited) {
        this.planetState[index].orbitVisited = true
        this.playOrbitFx()
        this.showApproachHint(planet.name)
        this.showMissionPanel(index)
      }

      if (inOrbit && this.activeMissionPlanetIdx !== index) {
        this.showMissionPanel(index)
      }
    })

    STATIONS.forEach((station, index) => {
      const group = this.stationMeshes?.[index]
      if (!group) return
      const stationWorld = group.userData.worldPos
      group.position.set(
        stationWorld.x - shipWorld.x,
        stationWorld.y - shipWorld.y,
        stationWorld.z - shipWorld.z,
      )
      if (group.userData.stationEntity) {
        group.userData.stationEntity.object3D.position.copy(group.position)
        group.userData.stationEntity.object3D.rotation.y += dt * 0.18
      }

      const stationCollisionRadius = (group.userData.collisionRadius || station.dockRadius * STATION_COLLISION_RADIUS_MULTIPLIER) + SHIP_COLLISION_RADIUS
      const closestShipPoint = this.closestPointOnSegment(previousShipLocal, currentShipLocal, group.position, this.tmpCollisionPoint)
      const collisionDist = closestShipPoint.distanceTo(group.position)
      if (collisionDist < stationCollisionRadius) {
        const normal = this.tmpCollisionNormal.copy(currentShipLocal).sub(group.position)
        if (normal.lengthSq() < 0.0001) normal.copy(closestShipPoint).sub(group.position)
        if (normal.lengthSq() < 0.0001) normal.copy(forward).multiplyScalar(-1)
        normal.normalize()

        const penetration = stationCollisionRadius - collisionDist
        travel.worldPos.addScaledVector(normal, Math.min(penetration + 1.8, 58))

        const normalSpeed = travel.velocity.dot(normal)
        if (normalSpeed < 0) travel.velocity.addScaledVector(normal, -normalSpeed * 1.5)
        travel.velocity.multiplyScalar(0.46)

        if (this.collisionCooldown === 0) {
          this.collisionCooldown = 0.22
          const flash = document.getElementById('damage-flash')
          flash?.classList.add('on')
          window.setTimeout(() => flash?.classList.remove('on'), 150)
        }
      }

      group.userData.beacon.rotation.y += dt * 0.8
      group.userData.beacon.rotation.z -= dt * 0.45

      const dist = shipWorld.distanceTo(stationWorld)
      const inDockRange = dist < station.dockRadius
      const nearby = dist < station.dockRadius * 2.8
      this.stationState[index].nearby = nearby

      this.setStationModelReveal(index, this.getStationRevealAlpha(index, dist))

      const stationVisible = this.isStationVisible(index)
      this.updateStationDiscoveryMarker(group, station, index, dist, dt)
      if (stationVisible && dist < nearestStationDist) {
        nearestStationDist = dist
        nearestStationIdx = index
      }

      group.userData.ringMaterial.opacity = inDockRange ? 0.24 : nearby ? 0.14 : 0.055
      group.userData.ringMaterial.color.set(station.color)
      group.userData.beaconMaterial.opacity = inDockRange
        ? 0.72
        : 0.38 + Math.sin(this.totalTime * 1.8 + index) * 0.08
      if (stationVisible) this.updateStationAccents(group.userData.accents, inDockRange, nearby, index, dt)

      if (inDockRange && !this.stationState[index].dockVisited) {
        this.stationState[index].dockVisited = true
        this.playOrbitFx()
        this.showDockHint(station.name)
        this.showStationPanel(index)
      }

      if (inDockRange && this.activeStationIdx !== index) {
        this.showStationPanel(index)
      }
    })

    // Beacon position + animation
    if (this.beaconGroup) {
      const bw = this.beaconGroup.userData.worldPos
      this.beaconGroup.position.set(bw.x - shipWorld.x, bw.y - shipWorld.y, bw.z - shipWorld.z)
      this.updateBeaconPower(dt)
      this.beaconCore.rotation.y += 0.0018
      this.beaconCore.rotation.z += 0.001
      if (this.beaconCorona) {
        const coronaPulse = 1 + Math.sin(this.totalTime * 1.7) * 0.025
        this.beaconCorona.scale.setScalar(coronaPulse)
        this.beaconCorona.rotation.y -= 0.0012
      }
      this.beaconCore.material.emissiveIntensity = (3 + Math.sin(this.totalTime * 2.2) * 0.8) * this.beaconCurrentGlowPower
      this.beaconRings.forEach((ring) => {
        ring.rotation.y += ring.userData.rotSpeed
        ring.rotation.z += ring.userData.rotSpeed * 0.35
      })
    }

    // Light streams become visible only after the linked planet mission is won.
    this.lightStreams?.forEach((stream) => {
      const missionWon = gameState.isMissionWonOnPlanet(stream.userData.planetIndex)
      stream.visible = missionWon
      if (!missionWon) return

      stream.userData.offset = (stream.userData.offset + dt * 0.28) % 1
      const { basePositions, count } = stream.geometry.userData
      const pos = stream.geometry.attributes.position
      for (let j = 0; j < count; j++) {
        const t = ((j / count) + stream.userData.offset) % 1
        const src = Math.floor(t * count)
        pos.setXYZ(j,
          basePositions[src * 3] - shipWorld.x,
          basePositions[src * 3 + 1] - shipWorld.y,
          basePositions[src * 3 + 2] - shipWorld.z,
        )
      }
      pos.needsUpdate = true
    })

    if (this.activeMissionPlanetIdx !== null) {
      const activePlanet = PLANETS[this.activeMissionPlanetIdx]
      const activeWorld = new T.Vector3(activePlanet.worldPos.x, activePlanet.worldPos.y, activePlanet.worldPos.z)
      if (shipWorld.distanceTo(activeWorld) > activePlanet.orbitRadius * 1.4) this.closeMissionPanel()
    }

    if (this.activeStationIdx !== null) {
      const activeStation = STATIONS[this.activeStationIdx]
      const activeWorld = new T.Vector3(activeStation.worldPos.x, activeStation.worldPos.y, activeStation.worldPos.z)
      if (shipWorld.distanceTo(activeWorld) > activeStation.dockRadius * 1.4) this.closeStationPanel()
    }

    if (nearestStationIdx >= 0 && nearestStationDist < nearestDist) {
      const station = STATIONS[nearestStationIdx]
      const stationWorld = new T.Vector3(station.worldPos.x, station.worldPos.y, station.worldPos.z)
      setText('nearest-name', station.name)
      setText('nearest-dist', `${Math.round(nearestStationDist / 10)} km`)
      setText('target-name', station.name)
      setText('target-status', nearestStationDist < station.dockRadius * 1.8 ? 'DOCK RANGE' : 'LONG RANGE')
      setText('target-bearing', this.getBearingText(stationWorld.clone().sub(shipWorld)))
      setWidth('target-bar-fill', this.getApproachRatio({ orbitRadius: station.dockRadius }, nearestStationDist))
    } else if (nearestIdx >= 0) {
      const nearestPlanet = PLANETS[nearestIdx]
      const nearestWorld = new T.Vector3(nearestPlanet.worldPos.x, nearestPlanet.worldPos.y, nearestPlanet.worldPos.z)
      const missionWon = gameState.isMissionWonOnPlanet(nearestIdx)
      this.planetState[nearestIdx].missionWon = missionWon
      setText('nearest-name', nearestPlanet.name)
      setText('nearest-dist', missionWon ? '\u2713 HOTOVO' : `${Math.round(nearestDist / 10)} km`)
      this.updateTargetCard(nearestPlanet, nearestDist, nearestWorld.clone().sub(shipWorld), missionWon)
    }

    setText('speed-val', Math.round(travel.speed))
    setWidth('speed-bar', travel.speed / travel.maxForwardSpeed)
    this.updatePills(shipWorld, nearestIdx)
    this.updateCompassBar(shipWorld, nearestIdx, nearestStationIdx)
  },

  remove() {
    gameState.galaxyTravel = {
      worldPos: {
        x: this.travel.worldPos.x,
        y: this.travel.worldPos.y,
        z: this.travel.worldPos.z,
      },
      velocity: {
        x: this.travel.velocity.x,
        y: this.travel.velocity.y,
        z: this.travel.velocity.z,
      },
      yaw: this.travel.yaw,
      pitch: this.travel.pitch,
    }
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('system-menu-toggle', this.onSystemMenuToggle)
    document.getElementById('launch-btn')?.removeEventListener('click', this.onLaunch)
    document.getElementById('dock-btn')?.removeEventListener('click', this.onDock)
    document.getElementById('hangar-close-btn')?.removeEventListener('click', this.onHangarClose)
    document.getElementById('hangar-return-btn')?.removeEventListener('click', this.onHangarClose)
    document.getElementById('hangar-prev-btn')?.removeEventListener('click', this.onHangarPrev)
    document.getElementById('hangar-next-btn')?.removeEventListener('click', this.onHangarNext)
    document.getElementById('hangar-select-btn')?.removeEventListener('click', this.onHangarSelect)

    const base = document.getElementById('galaxyJoystickBase')
    if (this.mobileHandlers) {
      base?.removeEventListener('touchstart', this.mobileHandlers.touchstart)
      window.removeEventListener('touchmove', this.mobileHandlers.touchmove)
      window.removeEventListener('touchend', this.mobileHandlers.touchend)
      window.removeEventListener('touchcancel', this.mobileHandlers.touchcancel)
    }

    if (this.loaderTimer) window.clearTimeout(this.loaderTimer)
    if (this.approachTimeout) window.clearTimeout(this.approachTimeout)
    if (this.dockingTimer) window.clearTimeout(this.dockingTimer)
    audioService.stopAll()
    this.warpOverlay?.remove()
    this.dockingOverlay?.remove()
    this.destroyHangarPreview()
    this.obstacles?.forEach((obstacle) => obstacle.userData.entity?.remove())
    document.getElementById('launch-btn')?.removeAttribute('disabled')
    const launchButton = document.getElementById('launch-btn')
    if (launchButton) launchButton.textContent = '⟶ ZAHÁJIT MISI'
    document.getElementById('mission-panel')?.classList.remove('open')
    document.getElementById('station-panel')?.classList.remove('open')
    document.getElementById('hangar-panel')?.classList.add('hidden')
    document.getElementById('galaxy-ui')?.classList.remove('hangar-active')
    document.getElementById('approach-indicator')?.classList.remove('visible')
    gamepadNavService.remove('station-panel')
    gamepadNavService.remove('hangar-panel')

    if (this.worldGroup) {
      this.el.object3D.remove(this.worldGroup)
      this.worldGroup.traverse((object) => {
        if (object.userData.gltfEntity) {
          object.userData.gltfEntity.remove()
        }
        if (object.userData.stationEntity) {
          object.userData.stationEntity.remove()
        }
        if (object.userData.glowTexture) {
          object.userData.glowTexture.dispose()
        }
        object.geometry?.dispose?.()
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.())
        else object.material?.dispose?.()
      })
    }
  },
})
