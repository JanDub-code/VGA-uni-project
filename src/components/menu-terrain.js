AFRAME.registerComponent('lk-menu-terrain', {
    init() {
        const T = AFRAME.THREE
        const group = new T.Group()

        group.add(this.createGround(T))
        this.addRocks(T, group)
        this.addLandingPad(T, group)

        this.el.setObject3D('lk-menu-terrain', group)
    },

    createGround(T) {
        const geometry = new T.PlaneGeometry(44, 34, 30, 22)
        geometry.rotateX(-Math.PI / 2)

        const positions = geometry.attributes.position
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i)
            const z = positions.getZ(i)
            const distance = Math.sqrt(x * x + z * z)

            if (distance > 3.8) {
                const bump = (Math.random() - 0.15) * Math.min(distance * 0.07, 1.5)
                positions.setY(i, Math.max(0, bump))
            }
        }
        geometry.computeVertexNormals()

        return new T.Mesh(
            geometry,
            new T.MeshStandardMaterial({
                color: new T.Color(0xb09060),
                emissive: new T.Color(0x251808),
                roughness: 0.9,
                metalness: 0.04,
                flatShading: true,
            }),
        )
    },

    addRocks(T, group) {
        const darkRock = new T.MeshStandardMaterial({
            color: 0x1e2030,
            emissive: 0x060810,
            roughness: 0.88,
            metalness: 0.15,
            flatShading: true,
        })
        const crystalRock = new T.MeshStandardMaterial({
            color: 0x0a2040,
            emissive: 0x003366,
            emissiveIntensity: 1.2,
            roughness: 0.6,
            metalness: 0.4,
            flatShading: true,
        })
        const rocks = [
            [-5.5, 0.75, -2, darkRock],
            [6.8, 0.55, -1.5, darkRock],
            [-8.2, 1.0, 1.0, darkRock],
            [7.8, 0.65, 2.2, darkRock],
            [-4.2, 0.4, 5.5, darkRock],
            [4.5, 0.8, 6.5, darkRock],
            [-7.8, 1.2, -5.2, darkRock],
            [9.5, 0.6, -3.5, darkRock],
            [-11, 1.4, 2.5, darkRock],
            [11.5, 0.9, 4.0, darkRock],
            [-4.5, 0.9, -4.0, crystalRock],
            [5.5, 0.85, -4.5, crystalRock],
            [-6.0, 0.7, 3.5, crystalRock],
            [3.5, 0.8, -8.0, crystalRock],
        ]

        rocks.forEach(([x, y, z, material]) => {
            const rock = new T.Mesh(new T.IcosahedronGeometry(0.55, 0), material)

            rock.position.set(x, y, z)
            rock.scale.set(
                0.7 + Math.random() * 0.6,
                0.9 + Math.random() * 0.5,
                0.7 + Math.random() * 0.6,
            )
            rock.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI * 2,
                Math.random() * 0.8,
            )

            group.add(rock)
        })
    },

    addLandingPad(T, group) {
        const y0 = 0.015
        const baseFill = flatHex(
            3.2,
            0,
            new T.MeshBasicMaterial({
                color: 0x00111e,
                transparent: true,
                opacity: 0.6,
                depthWrite: false,
            }),
        )
        const midRing = hexRing(
            1.8,
            2.8,
            new T.MeshBasicMaterial({
                color: 0x003355,
                transparent: true,
                opacity: 0.45,
                depthWrite: false,
                side: T.DoubleSide,
            }),
        )
        const outerEdge = hexRing(
            2.95,
            3.2,
            new T.MeshBasicMaterial({
                color: 0x0099ff,
                transparent: true,
                opacity: 0.92,
                side: T.DoubleSide,
            }),
        )
        const innerEdge = hexRing(
            1.22,
            1.38,
            new T.MeshBasicMaterial({
                color: 0x0077cc,
                transparent: true,
                opacity: 0.75,
                side: T.DoubleSide,
            }),
        )

        baseFill.position.y = y0
        midRing.position.y = y0 + 0.005
        outerEdge.position.y = y0 + 0.01
        innerEdge.position.y = y0 + 0.01
        group.add(baseFill, midRing, outerEdge, innerEdge)

        this.addPadBeacons(T, group)
        this.addPadArrows(T, group, y0)

        const padLight = new T.PointLight(0x0088ff, 1.2, 8)
        padLight.position.set(0, 0.4, 0)
        group.add(padLight)
    },

    addPadBeacons(T, group) {
        const beaconMaterial = new T.MeshBasicMaterial({ color: 0x00ccff })

        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + Math.PI / 6
            const beacon = new T.Mesh(new T.CylinderGeometry(0.07, 0.09, 0.28, 6), beaconMaterial)

            beacon.position.set(Math.cos(angle) * 3.06, 0.14, Math.sin(angle) * 3.06)
            group.add(beacon)
        }
    },

    addPadArrows(T, group, y0) {
        const arrowMaterial = new T.MeshBasicMaterial({
            color: 0x0055aa,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
        })

        ;[-1, 1].forEach((side) => {
            const arrow = new T.Mesh(new T.ConeGeometry(0.18, 0.45, 3), arrowMaterial)

            arrow.rotation.set(-Math.PI / 2, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0)
            arrow.position.set(side * 1.9, y0 + 0.02, 0)
            group.add(arrow)
        })
    },

    remove() {
        const object = this.el.getObject3D('lk-menu-terrain')

        if (object) {
            disposeObject(object)
            this.el.removeObject3D('lk-menu-terrain')
        }
    },
})

function flatHex(radius, rotY, material) {
    const geometry = new AFRAME.THREE.CircleGeometry(radius, 6)
    geometry.rotateX(-Math.PI / 2)
    geometry.rotateY(rotY)

    return new AFRAME.THREE.Mesh(geometry, material)
}

function hexRing(inner, outer, material) {
    const geometry = new AFRAME.THREE.RingGeometry(inner, outer, 6)
    geometry.rotateX(-Math.PI / 2)

    return new AFRAME.THREE.Mesh(geometry, material)
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
