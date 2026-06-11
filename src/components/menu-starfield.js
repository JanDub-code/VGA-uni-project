AFRAME.registerComponent('lk-menu-starfield', {
    init() {
        const T = AFRAME.THREE
        const starfield = this.createStarfield(T)

        this.points = starfield
        this.el.setObject3D('lk-starfield', starfield)
    },

    createStarfield(T) {
        const count = 3600
        const positions = new Float32Array(count * 3)
        const colors = new Float32Array(count * 3)

        for (let i = 0; i < count; i++) {
            const i3 = i * 3
            const theta = Math.random() * Math.PI * 2
            const phi = Math.acos(2 * Math.random() - 1)
            const r = 220 + Math.random() * 180

            positions[i3] = r * Math.sin(phi) * Math.cos(theta)
            positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta)
            positions[i3 + 2] = r * Math.cos(phi)

            const warm = Math.random() < 0.12
            const brightness = 0.4 + Math.random() * 0.6

            colors[i3] = warm ? brightness : brightness * 0.88
            colors[i3 + 1] = warm ? brightness * 0.82 : brightness * 0.94
            colors[i3 + 2] = warm ? brightness * 0.55 : brightness
        }

        const geometry = new T.BufferGeometry()
        geometry.setAttribute('position', new T.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new T.BufferAttribute(colors, 3))

        const material = new T.PointsMaterial({
            size: 0.75,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            sizeAttenuation: true,
            depthWrite: false,
        })

        return new T.Points(geometry, material)
    },

    remove() {
        const object = this.el.getObject3D('lk-starfield')

        if (object) {
            object.geometry.dispose()
            object.material.dispose()
            this.el.removeObject3D('lk-starfield')
        }
    },
})
