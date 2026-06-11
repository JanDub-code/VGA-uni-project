AFRAME.registerComponent('lk-enemy-model', {
    schema: {
        variant: { type: 'string', default: 'random' },
    },

    init() {
        const T = AFRAME.THREE
        const mesh = this.createEnemy(T)

        mesh.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI,
        )

        this.mesh = mesh
        this.el.setObject3D('lk-enemy-model', mesh)
    },

    createEnemy(T) {
        const variantDefs = {
            tetra: { geometryFn: () => new T.TetrahedronGeometry(1), color: '#ff0044', emissive: '#660011' },
            box: { geometryFn: () => new T.BoxGeometry(1.5, 1.5, 1.5), color: '#ff6600', emissive: '#662200' },
            octa: { geometryFn: () => new T.OctahedronGeometry(1), color: '#aa00ff', emissive: '#330066' },
        }
        const keys = Object.keys(variantDefs)
        const variantName = this.data.variant === 'random'
            ? keys[Math.floor(Math.random() * keys.length)]
            : this.data.variant
        const variant = variantDefs[variantName] || variantDefs.tetra

        return new T.Mesh(
            variant.geometryFn(),
            new T.MeshStandardMaterial({
                color: variant.color,
                emissive: variant.emissive,
                emissiveIntensity: 0.6,
                metalness: 0.5,
                roughness: 0.5,
            }),
        )
    },

    tick(_time, deltaMs) {
        if (!this.mesh) return

        const dt = deltaMs / 1000
        this.mesh.rotation.x += dt
        this.mesh.rotation.y += dt * 0.7
    },

    remove() {
        const object = this.el.getObject3D('lk-enemy-model')

        if (object) {
            object.geometry.dispose()
            object.material.dispose()
            this.el.removeObject3D('lk-enemy-model')
        }
    },
})
