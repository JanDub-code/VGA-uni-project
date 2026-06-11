import { clamp, createEntity } from './utils.js'
import { BOOST_CRYSTAL, GLACIES_COLORS } from './constants.js'

export const effectsMethods = {
  setManagedTimeout(callback, delay) {
    const id = window.setTimeout(() => {
      this._timeouts.delete(id)
      callback()
    }, delay)
    this._timeouts.add(id)
    return id
  },

  removeEphemeralLater(el, delay) {
    this.ephemeralEls.push(el)
    this.setManagedTimeout(() => {
      const index = this.ephemeralEls.indexOf(el)
      if (index >= 0) this.ephemeralEls.splice(index, 1)
      el.remove()
    }, delay)
  },

  initPulseEffectPool() {
    for (let i = 0; i < 10; i += 1) {
      this.pulseEffectPool.push(this.createPulseEffectMesh())
    }
  },

  createPulseEffectMesh() {
    const T = this.THREE
    const material = new T.MeshBasicMaterial({
      color: GLACIES_COLORS.cyan,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
      toneMapped: false,
    })
    const mesh = new T.Mesh(this.pulseEffectGeometry || new T.RingGeometry(0.62, 1, 48), material)
    mesh.rotation.x = -Math.PI / 2
    mesh.visible = false
    mesh.renderOrder = 8
    this.el.object3D.add(mesh)
    return {
      mesh,
      material,
      active: false,
      age: 0,
      duration: 1,
      startScale: 1,
      endScale: 1,
      startOpacity: 1,
    }
  },

  triggerPulseEffect(position, color, startScale, endScale, duration, opacity = 0.85) {
    let effect = this.pulseEffectPool.find((item) => !item.active)
    if (!effect) effect = this.pulseEffectPool[0]
    effect.active = true
    effect.age = 0
    effect.duration = duration
    effect.startScale = startScale
    effect.endScale = endScale
    effect.startOpacity = opacity
    effect.material.color.set(color)
    effect.material.opacity = opacity
    effect.mesh.position.copy(position)
    effect.mesh.visible = true
    effect.mesh.scale.setScalar(startScale)
    if (!this.pulseEffects.includes(effect)) this.pulseEffects.push(effect)
    return effect
  },

  updatePulseEffects(dt) {
    let write = 0
    for (let i = 0; i < this.pulseEffects.length; i += 1) {
      const effect = this.pulseEffects[i]
      effect.age += dt
      const t = clamp(effect.age / effect.duration, 0, 1)
      const eased = 1 - (1 - t) * (1 - t)
      const scale = effect.startScale + (effect.endScale - effect.startScale) * eased
      effect.mesh.scale.setScalar(scale)
      effect.material.opacity = effect.startOpacity * (1 - t)
      if (t >= 1) {
        effect.active = false
        effect.mesh.visible = false
        effect.material.opacity = 0
        continue
      }
      this.pulseEffects[write] = effect
      write += 1
    }
    this.pulseEffects.length = write
  },

  createBoostCrystals() {
    const T = this.THREE
    const resources = this.getBoostCrystalResources()
    this.boostCrystals = BOOST_CRYSTAL.layout.slice(0, BOOST_CRYSTAL.count).map((layout, index) => {
      const root = createEntity('a-entity', {
        class: 'glacies-boost-crystal',
        position: `${layout.x} ${BOOST_CRYSTAL.y} ${layout.z}`,
        rotation: `0 ${(index * 47) % 360} 0`,
        scale: `${BOOST_CRYSTAL.modelScale} ${BOOST_CRYSTAL.modelScale} ${BOOST_CRYSTAL.modelScale}`,
      }, this.el)
      const body = new T.Group()
      body.name = 'glacies-procedural-boost-crystal'
      const shard = new T.Mesh(resources.shardGeometry, resources.shardMaterial)
      shard.position.y = 1.08
      shard.rotation.y = index * 0.4
      const core = new T.Mesh(resources.coreGeometry, resources.coreMaterial)
      core.position.y = 1.1
      const ring = new T.Mesh(resources.ringGeometry, resources.ringMaterial)
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.04
      body.add(shard, core, ring)
      root.setObject3D('boost-crystal', body)

      const blip = document.createElement('span')
      blip.className = 'glacies-radar-blip boost'
      blip.style.left = '50%'
      blip.style.top = '50%'
      this.radarEl?.appendChild(blip)

      return {
        root,
        position: new T.Vector3(layout.x, BOOST_CRYSTAL.y, layout.z),
        collected: false,
        phase: index * 0.9,
        blip,
      }
    })
  },

  getBoostCrystalResources() {
    if (this.boostCrystalResources) return this.boostCrystalResources
    const T = this.THREE
    this.boostCrystalResources = {
      shardGeometry: new T.ConeGeometry(0.78, 2.2, 6, 1),
      shardMaterial: new T.MeshStandardMaterial({
        color: '#ffe6a3',
        emissive: '#ffb13b',
        emissiveIntensity: 0.95,
        roughness: 0.38,
        metalness: 0.05,
        flatShading: true,
      }),
      coreGeometry: new T.SphereGeometry(0.42, 8, 6),
      coreMaterial: new T.MeshBasicMaterial({
        color: '#ffd76a',
        transparent: true,
        opacity: 0.82,
        toneMapped: false,
      }),
      ringGeometry: new T.RingGeometry(0.9, 1.25, 32),
      ringMaterial: new T.MeshBasicMaterial({
        color: '#ffd76a',
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
        toneMapped: false,
      }),
    }
    return this.boostCrystalResources
  },

  updateBoostCrystals(dt) {
    if (!this.ship?.object3D) return
    const shipPos = this.ship.object3D.position
    const animateDistanceSq = BOOST_CRYSTAL.animateDistance * BOOST_CRYSTAL.animateDistance
    this.boostCrystals.forEach((crystal) => {
      if (crystal.collected) return
      const obj = crystal.root.object3D
      const dx = shipPos.x - crystal.position.x
      const dz = shipPos.z - crystal.position.z

      if (dx * dx + dz * dz < animateDistanceSq) {
        crystal.phase += dt
        obj.rotation.y += dt * 0.62
        obj.position.y = BOOST_CRYSTAL.y + Math.sin(this.clockTime * 2.4 + crystal.phase) * 0.18
      }

      if (dx * dx + dz * dz > BOOST_CRYSTAL.collectRadius * BOOST_CRYSTAL.collectRadius) return

      crystal.collected = true
      obj.visible = false
      crystal.blip?.classList.add('hidden')
      this.applyCoolantCharge()
      this.score += 120
      this.createBoostCollectPulse(crystal.position)
    })
  },

  createBoostCollectPulse(position) {
    this._tmpVec.set(position.x, 0.13, position.z)
    this.triggerPulseEffect(this._tmpVec, '#ffd76a', 2.4, 18, 0.42, 0.78)
  },
}
