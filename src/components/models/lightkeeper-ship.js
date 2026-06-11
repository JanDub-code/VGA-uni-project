import { assetUrl } from '../../services/assetPaths.js'

const SHIP_MODEL_URL = assetUrl('models/ships/spaceship.glb')
const SHIP_SCOUT_MODEL_URL = assetUrl('models/ships/spaceship-2.glb')
const SHIP_RELIC_MODEL_URL = assetUrl('models/ships/spaceship-3.glb')

function toModelKey(url) {
    try {
        return new URL(url, 'https://lightkeeper.local').pathname
    } catch {
        return url
    }
}

const DEFAULT_EFFECT_LAYOUT = {
    engine: {
        position: [0, -0.22, 1.55],
        outer: { radius: 0.22, length: 1.05, z: -0.52 },
        inner: { radius: 0.09, length: 0.72, z: -0.34 },
        nozzleGlow: { position: [0, 0, -0.04], scale: [0.7, 0.7, 1] },
    },
    shipGlow: { position: [0, -0.16, 0.84], scale: [1.1, 1.1, 1] },
    rcs: [
        { name: 'rcs-up-left', x: -0.52, y: 0.43, z: 0.96, dir: [0, 1, 0], surface: 'top', xRatio: 0.3, zRatio: 0.76 },
        { name: 'rcs-up-right', x: 0.52, y: 0.43, z: 0.96, dir: [0, 1, 0], surface: 'top', xRatio: 0.7, zRatio: 0.76 },
        { name: 'rcs-down-left', x: -0.52, y: -0.43, z: 0.96, dir: [0, -1, 0], surface: 'bottom', xRatio: 0.3, zRatio: 0.76 },
        { name: 'rcs-down-right', x: 0.52, y: -0.43, z: 0.96, dir: [0, -1, 0], surface: 'bottom', xRatio: 0.7, zRatio: 0.76 },
    ],
}
const SHIP_EFFECT_LAYOUTS = {
    [toModelKey(SHIP_MODEL_URL)]: DEFAULT_EFFECT_LAYOUT,
    [toModelKey(SHIP_SCOUT_MODEL_URL)]: {
        engine: {
            position: [0, -0.02, 1.32],
            outer: { radius: 0.18, length: 0.95, z: -0.45 },
            inner: { radius: 0.075, length: 0.66, z: -0.3 },
            nozzleGlow: { position: [0, 0, -0.02], scale: [0.58, 0.58, 1] },
        },
        shipGlow: { position: [0, -0.04, 0.72], scale: [0.86, 0.86, 1] },
        rcs: [
            { name: 'rcs-up-left', x: -0.42, y: 0.31, z: 0.84, dir: [0, 1, 0], surface: 'top', xRatio: 0.34, zRatio: 0.7, radius: 0.055, length: 0.24, glowScale: 0.15 },
            { name: 'rcs-up-right', x: 0.42, y: 0.31, z: 0.84, dir: [0, 1, 0], surface: 'top', xRatio: 0.66, zRatio: 0.7, radius: 0.055, length: 0.24, glowScale: 0.15 },
            { name: 'rcs-down-left', x: -0.42, y: -0.27, z: 0.84, dir: [0, -1, 0], surface: 'bottom', xRatio: 0.34, zRatio: 0.7, radius: 0.055, length: 0.24, glowScale: 0.15 },
            { name: 'rcs-down-right', x: 0.42, y: -0.27, z: 0.84, dir: [0, -1, 0], surface: 'bottom', xRatio: 0.66, zRatio: 0.7, radius: 0.055, length: 0.24, glowScale: 0.15 },
        ],
    },
    [toModelKey(SHIP_RELIC_MODEL_URL)]: {
        engine: {
            position: [0, -0.12, 1.42],
            outer: { radius: 0.2, length: 0.98, z: -0.48 },
            inner: { radius: 0.08, length: 0.68, z: -0.31 },
            nozzleGlow: { position: [0, 0, -0.03], scale: [0.64, 0.64, 1] },
        },
        shipGlow: { position: [0, -0.1, 0.78], scale: [1.0, 1.0, 1] },
        rcs: [
            { name: 'rcs-up-left', x: -0.58, y: 0.36, z: 0.88, dir: [0, 1, 0], surface: 'top', xRatio: 0.28, zRatio: 0.7, radius: 0.065, length: 0.28, glowScale: 0.18 },
            { name: 'rcs-up-right', x: 0.58, y: 0.36, z: 0.88, dir: [0, 1, 0], surface: 'top', xRatio: 0.72, zRatio: 0.7, radius: 0.065, length: 0.28, glowScale: 0.18 },
            { name: 'rcs-down-left', x: -0.58, y: -0.34, z: 0.88, dir: [0, -1, 0], surface: 'bottom', xRatio: 0.28, zRatio: 0.7, radius: 0.065, length: 0.28, glowScale: 0.18 },
            { name: 'rcs-down-right', x: 0.58, y: -0.34, z: 0.88, dir: [0, -1, 0], surface: 'bottom', xRatio: 0.72, zRatio: 0.7, radius: 0.065, length: 0.28, glowScale: 0.18 },
        ],
    },
}

function getEffectLayout(modelUrl) {
    return SHIP_EFFECT_LAYOUTS[toModelKey(modelUrl || SHIP_MODEL_URL)] || DEFAULT_EFFECT_LAYOUT
}

AFRAME.registerComponent('lk-ship-model', {
    schema: {
        color: { type: 'color', default: '#0088ff' },
        shield: { type: 'boolean', default: false },
        flame: { type: 'boolean', default: true },
        size: { type: 'number', default: 2.7 },
        modelUrl: { type: 'string', default: SHIP_MODEL_URL },
        brightness: { type: 'number', default: 1.0 },
        brightnessReactive: { type: 'boolean', default: true },
    },

    init() {
        const T = AFRAME.THREE

        this.group = null
        this.modelEntity = null
        this.glowTexture = this.createGlowTexture(T)
        this.onModelLoaded = null
        this.effectLayout = getEffectLayout(this.data.modelUrl)
        this._brightnessApplied = null
        this._brightnessMaterials = null
        this._lanternHandler = (event) => {
            const value = Number(event?.detail)
            if (Number.isFinite(value)) this.setBrightness(value)
        }

        this.modelEntity = this.createModelEntity()
        this.group = this.createShipGroup(T)

        this.el.setObject3D('lk-ship-model', this.group)

        if (this.data.brightnessReactive && typeof window !== 'undefined') {
            window.addEventListener('lantern-brightness-changed', this._lanternHandler)
        }
    },

    update(oldData) {
        if (oldData?.shield !== this.data.shield) {
            const shield = this.group?.getObjectByName('shield')
            if (shield?.material) {
                shield.visible = this.data.shield
                shield.material.opacity = this.data.shield ? 0.16 : 0
            }
        }
        if (oldData && oldData.brightness !== this.data.brightness) {
            this.setBrightness(this.data.brightness)
        }
        if (!oldData || !oldData.modelUrl || oldData.modelUrl === this.data.modelUrl) return
        const loadedModel = this.modelEntity?.getObject3D('mesh')
        if (this.modelEntity && this.onModelLoaded) {
            this.modelEntity.removeEventListener('model-loaded', this.onModelLoaded)
        }
        if (loadedModel) disposeObject(loadedModel)
        if (this.modelEntity) this.modelEntity.remove()
        this._brightnessMaterials = null
        this._brightnessApplied = null
        this.effectLayout = getEffectLayout(this.data.modelUrl)
        this.applyEffectLayout(AFRAME.THREE)
        this.modelEntity = this.createModelEntity()
    },

    createShipGroup(T) {
        const group = new T.Group()

        if (this.data.flame) {
            group.add(this.createEngine(T, this.effectLayout))
            group.add(this.createShipGlow(T, this.effectLayout))
        }
        group.add(this.createRcsThrusters(T, this.effectLayout))

        group.add(this.createShield(T))

        return group
    },

    createModelEntity() {
        const modelEntity = document.createElement('a-entity')

        this.onModelLoaded = (event) => {
            this.fitLoadedShip(event.detail.model)
            modelEntity.object3D.rotation.y = Math.PI
            this.anchorEffectsToLoadedModel()
            this._brightnessMaterials = null
            this._brightnessApplied = null
            this.setBrightness(this.data.brightness)
        }

        modelEntity.addEventListener('model-loaded', this.onModelLoaded)
        modelEntity.setAttribute('gltf-model', `url(${this.data.modelUrl || SHIP_MODEL_URL})`)
        this.el.appendChild(modelEntity)

        return modelEntity
    },

    applyEffectLayout(T) {
        if (!this.group) return

        const layout = this.effectLayout || DEFAULT_EFFECT_LAYOUT
        const engineLayout = layout.engine || DEFAULT_EFFECT_LAYOUT.engine
        const engine = this.group.getObjectByName('engine')
        if (engine) {
            engine.position.set(...engineLayout.position)
            this.updateEnginePlume(engine, 'engine-plume-outer', engineLayout.outer, 18)
            this.updateEnginePlume(engine, 'engine-plume-inner', engineLayout.inner, 14)
            const nozzleGlow = engine.getObjectByName('engine-nozzle-glow')
            if (nozzleGlow) {
                nozzleGlow.position.set(...engineLayout.nozzleGlow.position)
                nozzleGlow.scale.set(...engineLayout.nozzleGlow.scale)
                nozzleGlow.userData.baseScale = engineLayout.nozzleGlow.scale
            }
        }

        const glowLayout = layout.shipGlow || DEFAULT_EFFECT_LAYOUT.shipGlow
        const shipGlow = this.group.getObjectByName('ship-glow')
        if (shipGlow) {
            shipGlow.position.set(...glowLayout.position)
            shipGlow.scale.set(...glowLayout.scale)
            shipGlow.userData.baseScale = glowLayout.scale
        }

        ;(layout.rcs || DEFAULT_EFFECT_LAYOUT.rcs).forEach((definition) => {
            const thruster = this.group.getObjectByName(definition.name)
            if (!thruster) return

            thruster.position.set(definition.x, definition.y, definition.z)
            const direction = new T.Vector3(definition.dir[0], definition.dir[1], definition.dir[2]).normalize()
            const plume = thruster.getObjectByName('rcs-plume')
            if (plume) {
                plume.geometry?.dispose?.()
                plume.geometry = new T.ConeGeometry(definition.radius || 0.08, definition.length || 0.36, 12, 1, true)
                plume.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction)
                plume.position.copy(direction).multiplyScalar((definition.length || 0.36) * 0.5 + 0.01)
            }
            const inner = thruster.getObjectByName('rcs-plume-inner')
            if (inner) {
                inner.geometry?.dispose?.()
                inner.geometry = new T.ConeGeometry((definition.radius || 0.08) * 0.42, (definition.length || 0.36) * 0.68, 10, 1, true)
                inner.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction)
                inner.position.copy(direction).multiplyScalar((definition.length || 0.36) * 0.34 + 0.012)
            }
            const glow = thruster.getObjectByName('rcs-glow')
            if (glow) {
                glow.position.copy(direction).multiplyScalar(0.04)
                glow.userData.baseScale = definition.glowScale || 0.22
                glow.scale.set(glow.userData.baseScale, glow.userData.baseScale, 1)
            }
        })
    },

    anchorEffectsToLoadedModel() {
        if (!this.group || !this.modelEntity?.object3D) return

        const T = AFRAME.THREE
        this.modelEntity.object3D.updateMatrixWorld(true)
        this.el.object3D.updateMatrixWorld(true)

        const worldBox = new T.Box3().setFromObject(this.modelEntity.object3D)
        if (worldBox.isEmpty()) return

        const min = this.el.object3D.worldToLocal(worldBox.min.clone())
        const max = this.el.object3D.worldToLocal(worldBox.max.clone())
        const box = new T.Box3().setFromPoints([min, max])
        const size = box.getSize(new T.Vector3())

        ;(this.effectLayout.rcs || DEFAULT_EFFECT_LAYOUT.rcs).forEach((definition) => {
            if (!definition.surface) return

            const thruster = this.group.getObjectByName(definition.name)
            if (!thruster) return

            const x = box.min.x + size.x * (definition.xRatio ?? 0.5)
            const z = box.min.z + size.z * (definition.zRatio ?? 0.75)
            const y = definition.surface === 'top'
                ? box.max.y - 0.012
                : box.min.y + 0.012

            thruster.position.set(x, y, z)
        })
    },

    updateEnginePlume(engine, name, options, segments) {
        const plume = engine.getObjectByName(name)
        if (!plume) return

        plume.geometry?.dispose?.()
        plume.geometry = new AFRAME.THREE.ConeGeometry(options.radius, options.length, segments, 1, true)
        plume.rotation.x = Math.PI / 2
        plume.position.z = options.z
    },

    createGlowTexture(T) {
        const canvas = document.createElement('canvas')
        canvas.width = 128
        canvas.height = 128

        const context = canvas.getContext('2d')
        const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)

        gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)')
        gradient.addColorStop(0.35, 'rgba(0, 190, 255, 0.32)')
        gradient.addColorStop(1, 'rgba(0, 255, 255, 0)')
        context.fillStyle = gradient
        context.fillRect(0, 0, 128, 128)

        return new T.CanvasTexture(canvas)
    },

    createEngine(T, layout = DEFAULT_EFFECT_LAYOUT) {
        const engineLayout = layout.engine || DEFAULT_EFFECT_LAYOUT.engine
        const engine = new T.Group()
        engine.name = 'engine'
        engine.position.set(...engineLayout.position)

        engine.add(this.createEnginePlume(T, {
            name: 'engine-plume-outer',
            radius: engineLayout.outer.radius,
            length: engineLayout.outer.length,
            segments: 18,
            color: '#ff6a00',
            opacity: 0.34,
            z: engineLayout.outer.z,
        }))
        engine.add(this.createEnginePlume(T, {
            name: 'engine-plume-inner',
            radius: engineLayout.inner.radius,
            length: engineLayout.inner.length,
            segments: 14,
            color: '#fff0a8',
            opacity: 0.72,
            z: engineLayout.inner.z,
        }))
        engine.add(this.createNozzleGlow(T, engineLayout))

        const sparks = []
        for (let i = 0; i < 10; i++) {
            const spark = this.createSpark(T, i)
            sparks.push(spark)
            engine.add(spark)
        }
        engine.userData.sparks = sparks

        return engine
    },

    createRcsThrusters(T, layout = DEFAULT_EFFECT_LAYOUT) {
        const thrusters = new T.Group()
        const definitions = layout.rcs || DEFAULT_EFFECT_LAYOUT.rcs

        definitions.forEach((definition) => {
            if (definition.surface === 'top') return
            thrusters.add(this.createRcsThruster(T, definition))
        })

        return thrusters
    },

    createRcsThruster(T, options) {
        const thruster = new T.Group()
        thruster.name = options.name
        thruster.position.set(options.x, options.y, options.z)
        const direction = new T.Vector3(options.dir[0], options.dir[1], options.dir[2]).normalize()

        const plume = new T.Mesh(
            new T.ConeGeometry(options.radius || 0.08, options.length || 0.36, 12, 1, true),
            new T.MeshBasicMaterial({
                color: '#50f3ff',
                transparent: true,
                opacity: 0,
                depthWrite: false,
                side: T.DoubleSide,
                blending: T.AdditiveBlending,
            }),
        )
        plume.name = 'rcs-plume'
        plume.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction)
        plume.position.copy(direction).multiplyScalar((options.length || 0.36) * 0.5 + 0.01)
        thruster.add(plume)

        const inner = new T.Mesh(
            new T.ConeGeometry((options.radius || 0.08) * 0.42, (options.length || 0.36) * 0.68, 10, 1, true),
            new T.MeshBasicMaterial({
                color: '#dffcff',
                transparent: true,
                opacity: 0,
                depthWrite: false,
                side: T.DoubleSide,
                blending: T.AdditiveBlending,
            }),
        )
        inner.name = 'rcs-plume-inner'
        inner.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction)
        inner.position.copy(direction).multiplyScalar((options.length || 0.36) * 0.34 + 0.012)
        thruster.add(inner)

        const glow = new T.Sprite(new T.SpriteMaterial({
            map: this.glowTexture,
            color: '#7ef8ff',
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: T.AdditiveBlending,
        }))
        glow.name = 'rcs-glow'
        glow.position.copy(direction).multiplyScalar(0.04)
        glow.userData.baseScale = options.glowScale || 0.22
        glow.scale.set(glow.userData.baseScale, glow.userData.baseScale, 1)
        thruster.add(glow)

        return thruster
    },

    createEnginePlume(T, options) {
        const plume = new T.Mesh(
            new T.ConeGeometry(options.radius, options.length, options.segments, 1, true),
            new T.MeshBasicMaterial({
                color: options.color,
                transparent: true,
                opacity: options.opacity,
                depthWrite: false,
                side: T.DoubleSide,
                blending: T.AdditiveBlending,
            }),
        )

        plume.name = options.name
        plume.rotation.x = Math.PI / 2
        plume.position.z = options.z

        return plume
    },

    createNozzleGlow(T, layout = DEFAULT_EFFECT_LAYOUT.engine) {
        const glow = new T.Sprite(new T.SpriteMaterial({
            map: this.glowTexture,
            color: '#fff1a0',
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            blending: T.AdditiveBlending,
        }))

        glow.name = 'engine-nozzle-glow'
        glow.position.set(...layout.nozzleGlow.position)
        glow.scale.set(...layout.nozzleGlow.scale)
        glow.userData.baseScale = layout.nozzleGlow.scale

        return glow
    },

    createSpark(T, index) {
        const spark = new T.Sprite(new T.SpriteMaterial({
            map: this.glowTexture,
            color: index % 3 === 0 ? '#ffffff' : '#ff9b24',
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
            blending: T.AdditiveBlending,
        }))

        spark.name = 'engine-spark'
        spark.userData.seed = Math.random() * Math.PI * 2
        spark.userData.radius = 0.035 + Math.random() * 0.08
        spark.userData.length = 0.18 + Math.random() * 0.75
        spark.userData.speed = 8 + Math.random() * 10

        return spark
    },

    createShipGlow(T, layout = DEFAULT_EFFECT_LAYOUT) {
        const glowLayout = layout.shipGlow || DEFAULT_EFFECT_LAYOUT.shipGlow
        const glow = new T.Sprite(new T.SpriteMaterial({
            map: this.glowTexture,
            color: '#ff7a18',
            transparent: true,
            opacity: 0.26,
            depthWrite: false,
            blending: T.AdditiveBlending,
        }))

        glow.name = 'ship-glow'
        glow.position.set(...glowLayout.position)
        glow.scale.set(...glowLayout.scale)
        glow.userData.baseScale = glowLayout.scale

        return glow
    },

    createShield(T) {
        const shield = new T.Mesh(
            new T.SphereGeometry(1.85, 32, 24),
            new T.MeshBasicMaterial({
                color: '#50f3ff',
                transparent: true,
                opacity: this.data.shield ? 0.14 : 0,
                depthWrite: false,
                side: T.BackSide,
                blending: T.AdditiveBlending,
            }),
        )

        shield.name = 'shield'
        shield.visible = this.data.shield

        return shield
    },

    setBrightness(value) {
        const clamped = Math.max(0, Math.min(1, Number(value) || 0))
        if (clamped === this._brightnessApplied && this._brightnessMaterials) return
        this._brightnessApplied = clamped

        const model = this.modelEntity?.getObject3D('mesh')
        if (!model) {
            this.data.brightness = clamped
            return
        }

        if (!this._brightnessMaterials) {
            this._brightnessMaterials = []
            model.traverse((child) => {
                if (!child.isMesh || !child.material) return
                const materials = Array.isArray(child.material) ? child.material : [child.material]
                materials.forEach((mat) => {
                    if (!mat || !mat.color) return
                    this._brightnessMaterials.push({
                        material: mat,
                        baseColor: mat.color.clone(),
                        baseEmissive: mat.emissive ? mat.emissive.clone() : null,
                        baseEmissiveIntensity: typeof mat.emissiveIntensity === 'number' ? mat.emissiveIntensity : 1,
                    })
                })
            })
        }

        const dimAmount = 1 - clamped
        const deadColor = { r: 0.5, g: 0.05, b: 0.04 }
        this._brightnessMaterials.forEach((entry) => {
            const mat = entry.material
            if (mat.color) {
                mat.color.copy(entry.baseColor).lerp(deadColor, dimAmount * 0.85)
            }
            if (mat.emissive && entry.baseEmissive) {
                mat.emissive.copy(entry.baseEmissive).multiplyScalar(clamped)
            }
            if (typeof mat.emissiveIntensity === 'number') {
                mat.emissiveIntensity = entry.baseEmissiveIntensity * (0.25 + clamped * 0.75)
            }
        })

        this.data.brightness = clamped
    },

    fitLoadedShip(model) {
        const T = AFRAME.THREE

        // Temporarily remove parent to calculate raw local bounding box without parent scale
        const oldParent = model.parent
        model.parent = null
        model.updateMatrixWorld(true)

        const box = new T.Box3().setFromObject(model)
        const size = new T.Vector3()
        const center = new T.Vector3()

        box.getSize(size)
        box.getCenter(center)

        const maxSize = Math.max(size.x, size.y, size.z)
        
        // Restore parent tree
        model.parent = oldParent

        if (maxSize > 0) {
            model.scale.multiplyScalar(this.data.size / maxSize)
            model.updateMatrixWorld(true)
            new T.Box3().setFromObject(model).getCenter(center)
            if (model.parent) {
                model.parent.worldToLocal(center)
            }
            model.position.sub(center)
            model.updateMatrixWorld(true)
        }

        model.traverse((child) => {
            if (!child.isMesh) return

            child.castShadow = true
            child.receiveShadow = true
        })
    },

    remove() {
        const object = this.el.getObject3D('lk-ship-model')
        const loadedModel = this.modelEntity?.getObject3D('mesh')

        if (this.modelEntity && this.onModelLoaded) {
            this.modelEntity.removeEventListener('model-loaded', this.onModelLoaded)
        }

        if (typeof window !== 'undefined' && this._lanternHandler) {
            window.removeEventListener('lantern-brightness-changed', this._lanternHandler)
        }

        if (object) {
            disposeObject(object, false)
            this.el.removeObject3D('lk-ship-model')
        }
        if (loadedModel) {
            disposeObject(loadedModel)
        }

        if (this.glowTexture) this.glowTexture.dispose()
        if (this.modelEntity) this.modelEntity.remove()

        this.group = null
        this.modelEntity = null
        this.glowTexture = null
        this.onModelLoaded = null
        this._brightnessMaterials = null
        this._brightnessApplied = null
        this._lanternHandler = null
    },
})

function disposeObject(object, disposeMaps = true) {
    object.traverse((child) => {
        if (child.geometry) child.geometry.dispose()

        if (Array.isArray(child.material)) {
            child.material.forEach((material) => disposeMaterial(material, disposeMaps))
        } else if (child.material) {
            disposeMaterial(child.material, disposeMaps)
        }
    })
}

function disposeMaterial(material, disposeMap) {
    if (disposeMap && material.map) material.map.dispose()
    material.dispose()
}
