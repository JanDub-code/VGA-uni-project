AFRAME.registerComponent('lk-menu-bg-planet', {
    schema: {
        radius: { default: 18 },
    },

    init() {
        const T = AFRAME.THREE
        const group = new T.Group()
        const radius = this.data.radius

        this.createNebula(T, group, radius)
        this.createGlowSprites(group, radius)
        this.createPlanet(T, group, radius)

        this.tealBase = radius * 3.2
        this.purpleBase = radius * 3.0
        this.magBase = radius * 2.2
        this.outerGlowBase = radius * 3.0
        this.group = group

        this.el.setObject3D('lk-menu-bg-planet', group)
    },

    createNebula(T, group, radius) {
        const count = 600
        const positions = new Float32Array(count * 3)
        const colors = new Float32Array(count * 3)
        const palettes = {
            teal: [0.0, 0.85, 0.65],
            cyan: [0.0, 0.80, 1.0],
            purple: [0.55, 0.0, 0.95],
            mag: [0.80, 0.0, 0.75],
        }

        for (let i = 0; i < count; i++) {
            let x
            let y
            let z
            let color

            if (i < count * 0.45) {
                x = -radius * 0.3 + (Math.random() - 0.5) * radius * 1.4
                y = radius * 0.4 + Math.random() * radius * 1.2
                z = (Math.random() - 0.5) * radius * 0.6
                color = Math.random() < 0.55 ? palettes.teal : palettes.cyan
            } else {
                x = radius * 0.4 + (Math.random() - 0.5) * radius * 1.3
                y = (Math.random() - 0.5) * radius * 1.2
                z = (Math.random() - 0.5) * radius * 0.6
                color = Math.random() < 0.6 ? palettes.purple : palettes.mag
            }

            const brightness = 0.3 + Math.random() * 0.7
            const i3 = i * 3

            positions[i3] = x
            positions[i3 + 1] = y
            positions[i3 + 2] = z
            colors[i3] = color[0] * brightness
            colors[i3 + 1] = color[1] * brightness
            colors[i3 + 2] = color[2] * brightness
        }

        const geometry = new T.BufferGeometry()
        geometry.setAttribute('position', new T.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new T.BufferAttribute(colors, 3))

        this.nebMat = new T.PointsMaterial({
            size: radius * 0.05,
            vertexColors: true,
            transparent: true,
            opacity: 0.5,
            sizeAttenuation: true,
            depthWrite: false,
        })

        group.add(new T.Points(geometry, this.nebMat))
    },

    createGlowSprites(group, radius) {
        this.tealSpr = makeGlow(256, [
            [0, '#00ffaa', 0.55],
            [0.5, '#00cc88', 0.20],
            [1, '#000000', 0],
        ])
        this.tealSpr.position.set(-radius * 0.55, radius * 0.85, 0)
        this.tealSpr.scale.set(radius * 3.2, radius * 2.8, 1)
        group.add(this.tealSpr)

        this.purpleSpr = makeGlow(256, [
            [0, '#bb00ff', 0.50],
            [0.5, '#660099', 0.18],
            [1, '#000000', 0],
        ])
        this.purpleSpr.position.set(radius * 0.75, -radius * 0.15, 0)
        this.purpleSpr.scale.set(radius * 3.0, radius * 2.8, 1)
        group.add(this.purpleSpr)

        this.magSpr = makeGlow(256, [
            [0, '#ff00bb', 0.35],
            [0.5, '#880055', 0.12],
            [1, '#000000', 0],
        ])
        this.magSpr.position.set(radius * 0.9, -radius * 0.8, 0)
        this.magSpr.scale.set(radius * 2.2, radius * 2.0, 1)
        group.add(this.magSpr)

        this.outerGlowSpr = makeGlow(256, [
            [0, '#2255ff', 0.0],
            [0.55, '#1144dd', 0.0],
            [0.72, '#3366ff', 0.32],
            [0.88, '#1133aa', 0.14],
            [1, '#000000', 0],
        ])
        this.outerGlowSpr.scale.set(radius * 3.0, radius * 3.0, 1)
        group.add(this.outerGlowSpr)

        this.coronaSpr = makeGlow(256, [
            [0, '#000000', 0],
            [0.78, '#000000', 0],
            [0.84, '#00ccff', 0.65],
            [0.92, '#0066cc', 0.28],
            [1, '#000000', 0],
        ])
        this.coronaSpr.scale.set(radius * 2.55, radius * 2.55, 1)
        group.add(this.coronaSpr)
    },

    createPlanet(T, group, radius) {
        group.add(new T.Mesh(
            new T.IcosahedronGeometry(radius, 3),
            new T.MeshStandardMaterial({
                color: new T.Color(0x2255dd),
                emissive: new T.Color(0x1133bb),
                emissiveIntensity: 0.9,
                roughness: 0.42,
                metalness: 0.18,
                flatShading: true,
            }),
        ))

        group.add(new T.PointLight(0x4477ff, 12.0, radius * 7.0))

        const keyLight = new T.PointLight(0x55ddff, 8.0, radius * 6.0)
        keyLight.position.set(-radius * 0.9, radius * 1.05, radius * 0.55)
        group.add(keyLight)

        group.add(new T.Mesh(
            new T.SphereGeometry(radius * 1.06, 32, 32),
            new T.MeshBasicMaterial({
                color: new T.Color(0x4499ff),
                transparent: true,
                opacity: 0.38,
                side: T.BackSide,
                depthWrite: false,
            }),
        ))
    },

    tick(time) {
        if (this.group) {
            this.group.rotation.y = time * 0.000010
        }

        const s = time * 0.001

        if (this.nebMat) {
            this.nebMat.opacity = 0.35 + 0.30 * (0.5 + 0.5 * Math.sin(s * 0.38 + 2.5))
        }
        if (this.tealSpr) {
            const f = 0.5 + 0.5 * Math.sin(s * 0.52)
            const scale = this.tealBase * (0.94 + 0.12 * f)

            this.tealSpr.material.opacity = 0.15 + 0.60 * f
            this.tealSpr.scale.set(scale, scale * 0.88, 1)
        }
        if (this.purpleSpr) {
            const f = 0.5 + 0.5 * Math.sin(s * 0.41 + 1.8)
            const scale = this.purpleBase * (0.92 + 0.14 * f)

            this.purpleSpr.material.opacity = 0.12 + 0.55 * f
            this.purpleSpr.scale.set(scale, scale * 0.93, 1)
        }
        if (this.magSpr) {
            const f = 0.5 + 0.5 * Math.sin(s * 0.67 + 0.9)
            this.magSpr.material.opacity = 0.08 + 0.42 * f
        }
        if (this.coronaSpr) {
            this.coronaSpr.material.opacity = 0.75 + 0.25 * (0.5 + 0.5 * Math.sin(s * 0.9 + 1.1))
        }
        if (this.outerGlowSpr) {
            const f = 0.5 + 0.5 * Math.sin(s * 0.28 + 0.4)
            const scale = this.outerGlowBase * (0.97 + 0.06 * f)

            this.outerGlowSpr.material.opacity = 0.7 + 0.3 * f
            this.outerGlowSpr.scale.set(scale, scale, 1)
        }
    },

    remove() {
        const object = this.el.getObject3D('lk-menu-bg-planet')

        if (object) {
            disposeObject(object)
            this.el.removeObject3D('lk-menu-bg-planet')
        }
    },
})

function makeGlow(size, stops) {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size

    const context = canvas.getContext('2d')
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)

    stops.forEach(([position, hex, alpha]) => {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)

        gradient.addColorStop(position, `rgba(${r},${g},${b},${alpha})`)
    })

    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)

    return new AFRAME.THREE.Sprite(new AFRAME.THREE.SpriteMaterial({
        map: new AFRAME.THREE.CanvasTexture(canvas),
        transparent: true,
        depthWrite: false,
    }))
}

function disposeObject(object) {
    object.traverse((child) => {
        if (child.geometry) child.geometry.dispose()

        if (Array.isArray(child.material)) {
            child.material.forEach((material) => {
                if (material.map) material.map.dispose()
                material.dispose()
            })
        } else if (child.material) {
            if (child.material.map) child.material.map.dispose()
            child.material.dispose()
        }
    })
}
