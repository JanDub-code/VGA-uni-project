AFRAME.registerComponent('lk-asteroid-model', {
    schema: {
        radius: { type: 'number', default: 1.6 },
    },

    init() {
        const T = AFRAME.THREE
        const mesh = this.createAsteroid(T)

        mesh.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI,
        )

        this.spin = new T.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
        )
        this.mesh = mesh

        this.el.setObject3D('lk-asteroid-model', mesh)
    },

    createAsteroid(T) {
        const geometry = new T.IcosahedronGeometry(this.data.radius, 1)
        const positions = geometry.attributes.position

        for (let i = 0; i < positions.count; i++) {
            const factor = 0.8 + Math.random() * 0.4
            positions.setXYZ(
                i,
                positions.getX(i) * factor,
                positions.getY(i) * factor,
                positions.getZ(i) * factor,
            )
        }

        positions.needsUpdate = true
        geometry.computeVertexNormals()

        return new T.Mesh(
            geometry,
            new T.MeshStandardMaterial({
                color: '#666666',
                emissive: '#222222',
                emissiveIntensity: 0.2,
                roughness: 0.9,
                metalness: 0.1,
                flatShading: true,
            }),
        )
    },

    tick(_time, deltaMs) {
        if (!this.mesh) return

        const dt = deltaMs / 1000
        this.mesh.rotation.x += this.spin.x * dt
        this.mesh.rotation.y += this.spin.y * dt
        this.mesh.rotation.z += this.spin.z * dt
    },

    remove() {
        const object = this.el.getObject3D('lk-asteroid-model')

        if (object) {
            object.geometry.dispose()
            object.material.dispose()
            this.el.removeObject3D('lk-asteroid-model')
        }
    },
})
