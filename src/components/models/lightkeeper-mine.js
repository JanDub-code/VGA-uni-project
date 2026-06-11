AFRAME.registerComponent('lk-mine-model', {
    init() {
        this.group = this.createMine(AFRAME.THREE)
        this.pulseTime = Math.random() * Math.PI * 2

        this.el.setObject3D('lk-mine-model', this.group)
    },

    createMine(T) {
        const group = new T.Group()
        const core = new T.Mesh(
            new T.SphereGeometry(0.8, 12, 12),
            new T.MeshStandardMaterial({
                color: '#660000',
                emissive: '#330000',
                emissiveIntensity: 0.8,
                metalness: 0.7,
            }),
        )
        const spikeGeometry = new T.ConeGeometry(0.15, 0.6, 4)
        const spikeMaterial = new T.MeshStandardMaterial({
            color: '#990000',
            emissive: '#440000',
            emissiveIntensity: 0.5,
        })
        const positions = [
            [0, 0, 1],
            [0, 0, -1],
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
            [0.7, 0.7, 0],
            [-0.7, -0.7, 0],
        ]

        group.add(core)

        positions.forEach((position) => {
            const spike = new T.Mesh(spikeGeometry, spikeMaterial)
            spike.position.set(position[0] * 0.8, position[1] * 0.8, position[2] * 0.8)
            spike.lookAt(position[0] * 2, position[1] * 2, position[2] * 2)
            group.add(spike)
        })

        return group
    },

    tick(_time, deltaMs) {
        if (!this.group) return

        const dt = deltaMs / 1000
        this.pulseTime += dt
        this.group.rotation.x += dt
        this.group.rotation.y += dt * 0.7

        const pulse = Math.sin(this.pulseTime * 4) * 0.1 + 1
        this.group.scale.setScalar(pulse)
    },

    remove() {
        const object = this.el.getObject3D('lk-mine-model')

        if (object) {
            disposeObject(object)
            this.el.removeObject3D('lk-mine-model')
        }
    },
})

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
