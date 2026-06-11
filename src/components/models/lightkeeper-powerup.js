AFRAME.registerComponent('lk-powerup-model', {
    schema: {
        type: { type: 'string', default: 'shield' },
    },

    init() {
        this.group = this.createPowerup(AFRAME.THREE)
        this.el.setObject3D('lk-powerup-model', this.group)
    },

    createPowerup(T) {
        const group = new T.Group()
        const types = {
            shield: {
                geometry: new T.TorusGeometry(0.8, 0.2, 8, 16),
                color: '#0088ff',
            },
            rapid: {
                geometry: new T.ConeGeometry(0.5, 1.2, 4),
                color: '#ff4444',
            },
            score: {
                geometry: createStarGeometry(T),
                color: '#ffaa00',
            },
        }
        const def = types[this.data.type] || types.shield
        const material = new T.MeshStandardMaterial({
            color: def.color,
            emissive: def.color,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.9,
        })

        const mesh = new T.Mesh(def.geometry, material)
        group.add(mesh)

        if (this.data.type === 'rapid') {
            const secondCone = new T.Mesh(def.geometry, material)
            secondCone.rotation.x = Math.PI
            secondCone.position.y = -0.3
            group.add(secondCone)
        }

        return group
    },

    tick(_time, deltaMs) {
        if (!this.group) return

        const dt = deltaMs / 1000
        this.group.rotation.y += dt * 2.2
        this.group.rotation.z += dt * 0.8
    },

    remove() {
        const object = this.el.getObject3D('lk-powerup-model')

        if (object) {
            disposeObject(object)
            this.el.removeObject3D('lk-powerup-model')
        }
    },
})

function createStarGeometry(T) {
    const shape = new T.Shape()
    const outerRadius = 0.8
    const innerRadius = 0.4

    for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius

        if (i === 0) {
            shape.moveTo(x, y)
        } else {
            shape.lineTo(x, y)
        }
    }

    shape.closePath()

    return new T.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false })
}

function disposeObject(object) {
    object.traverse((child) => {
        if (child.geometry) child.geometry.dispose()

        if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose())
        } else if (child.material) {
            child.material.dispose()
        }
    })
}
