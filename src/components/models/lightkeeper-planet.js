AFRAME.registerComponent('lk-planet-model', {
    schema: {
        color: { type: 'color', default: '#0088ff' },
        emissive: { type: 'color', default: '#002244' },
        radius: { type: 'number', default: 22 },
        orbitRadius: { type: 'number', default: 160 },
        rings: { type: 'boolean', default: false },
        spinDuration: { type: 'number', default: 18000 },
        gltf: { type: 'string', default: '' },
    },

    init() {
        const T = AFRAME.THREE

        this.planet = null
        this.modelEntity = null
        this.glowTexture = null

        const group = this.createPlanetGroup(T)
        this.el.setObject3D('lk-planet-model', group)
    },

    createPlanetGroup(T) {
        const group = new T.Group()

        if (this.data.gltf) {
            this.createGltfPlanet()
        } else {
            this.planet = this.createProceduralPlanet(T)
            group.add(this.planet)
        }

        const glow = this.createGlowSprite(T)
        group.add(glow)

        if (this.data.rings) {
            group.add(this.createRings(T))
        }

        group.add(this.createOrbit(T))
        group.add(this.createAtmosphere(T))

        return group
    },

    createGltfPlanet() {
        const modelEntity = document.createElement('a-entity')

        modelEntity.setAttribute('gltf-model', this.data.gltf)
        modelEntity.setAttribute(
            'animation',
            `property: rotation; to: 0 360 0; loop: true; dur: ${this.data.spinDuration}; easing: linear;`,
        )

        this.modelEntity = modelEntity
        this.el.appendChild(modelEntity)
    },

    createProceduralPlanet(T) {
        const planet = new T.Mesh(
            new T.SphereGeometry(this.data.radius, 48, 48),
            new T.MeshStandardMaterial({
                color: this.data.color,
                emissive: this.data.emissive,
                emissiveIntensity: 0.6,
                roughness: 0.75,
                metalness: 0.2,
            }),
        )

        planet.name = 'planet'

        return planet
    },

    createGlowSprite(T) {
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 256

        const context = canvas.getContext('2d')
        const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128)
        const color = new T.Color(this.data.color)
        const r = Math.round(color.r * 255)
        const g = Math.round(color.g * 255)
        const b = Math.round(color.b * 255)

        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.5)`)
        gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.25)`)
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
        context.fillStyle = gradient
        context.fillRect(0, 0, 256, 256)

        this.glowTexture = new T.CanvasTexture(canvas)

        const glow = new T.Sprite(new T.SpriteMaterial({
            map: this.glowTexture,
            color: this.data.color,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            blending: T.AdditiveBlending,
        }))
        glow.scale.set(this.data.radius * 6, this.data.radius * 6, 1)

        return glow
    },

    createRings(T) {
        const ring = new T.Mesh(
            new T.RingGeometry(this.data.radius + 4, this.data.radius + 10, 80),
            new T.MeshBasicMaterial({
                color: this.data.color,
                transparent: true,
                opacity: 0.22,
                side: T.DoubleSide,
            }),
        )

        ring.rotation.x = Math.PI / 2.3

        return ring
    },

    createOrbit(T) {
        const orbit = new T.Mesh(
            new T.RingGeometry(this.data.orbitRadius - 1, this.data.orbitRadius + 1, 128),
            new T.MeshBasicMaterial({
                color: '#00ff88',
                transparent: true,
                opacity: 0.06,
                side: T.DoubleSide,
            }),
        )

        orbit.rotation.x = Math.PI / 2
        orbit.name = 'orbit'

        return orbit
    },

    createAtmosphere(T) {
        return new T.Mesh(
            new T.SphereGeometry(this.data.radius + 2, 32, 32),
            new T.MeshBasicMaterial({
                color: this.data.color,
                transparent: true,
                opacity: 0.08,
                side: T.BackSide,
                depthWrite: false,
            }),
        )
    },

    tick(_time, deltaMs) {
        if (!this.planet) return

        this.planet.rotation.y += (deltaMs / this.data.spinDuration) * Math.PI * 2
    },

    remove() {
        const object = this.el.getObject3D('lk-planet-model')

        if (object) {
            disposeObject(object)
            this.el.removeObject3D('lk-planet-model')
        }

        if (this.glowTexture) this.glowTexture.dispose()
        if (this.modelEntity) this.modelEntity.remove()
    },
})

function disposeObject(object) {
    object.traverse((child) => {
        if (child.geometry) child.geometry.dispose()

        if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose())
        } else if (child.material) {
            if (child.material.map) child.material.map.dispose()
            child.material.dispose()
        }
    })
}
