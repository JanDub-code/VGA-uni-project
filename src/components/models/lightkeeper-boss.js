AFRAME.registerComponent('lk-boss-model', {
    schema: {
        type: { type: 'int', default: 1 },
    },

    init() {
        this.uniforms = null
        this.group = this.createBoss(AFRAME.THREE)
        this.el.setObject3D('lk-boss-model', this.group)
    },

    createBoss(T) {
        const group = new T.Group()

        if (this.data.type === 1) {
            group.add(this.createSingleCoreBoss(T))
        } else if (this.data.type === 2) {
            this.createTwinCoreBoss(T).forEach((core) => group.add(core))
        } else {
            group.add(this.createShaderBoss(T))
        }

        return group
    },

    createSingleCoreBoss(T) {
        return new T.Mesh(
            new T.OctahedronGeometry(4, 0),
            new T.MeshStandardMaterial({
                color: '#00ffff',
                emissive: '#0088aa',
                emissiveIntensity: 1.2,
                metalness: 0.8,
                roughness: 0.2,
            }),
        )
    },

    createTwinCoreBoss(T) {
        const material = new T.MeshStandardMaterial({
            color: '#ff6600',
            emissive: '#aa3300',
            emissiveIntensity: 1,
            metalness: 0.7,
        })
        const core1 = new T.Mesh(new T.IcosahedronGeometry(2.5, 0), material)
        const core2 = new T.Mesh(new T.IcosahedronGeometry(2.5, 0), material)

        core1.position.x = -3
        core2.position.x = 3

        return [core1, core2]
    },

    createShaderBoss(T) {
        this.uniforms = { time: { value: 0 } }

        return new T.Mesh(
            new T.DodecahedronGeometry(5, 1),
            new T.ShaderMaterial({
                uniforms: this.uniforms,
                vertexShader: `
                    varying vec3 vNormal;
                    uniform float time;

                    void main() {
                        vNormal = normal;
                        vec3 pos = position;
                        pos += normal * sin(time * 2.0 + position.x * 2.0) * 0.1;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                    }
                `,
                fragmentShader: `
                    varying vec3 vNormal;
                    uniform float time;

                    void main() {
                        float pulse = sin(time * 3.0) * 0.5 + 0.5;
                        vec3 color = mix(vec3(0.5, 0.0, 0.8), vec3(1.0, 0.2, 1.0), pulse);
                        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
                        color += fresnel * vec3(0.8, 0.4, 1.0) * 0.5;
                        gl_FragColor = vec4(color, 1.0);
                    }
                `,
            }),
        )
    },

    tick(time, deltaMs) {
        if (!this.group) return

        const dt = deltaMs / 1000
        this.group.rotation.x += dt * 0.35
        this.group.rotation.y += dt * 0.55

        if (this.uniforms) {
            this.uniforms.time.value = time / 1000
        }
    },

    remove() {
        const object = this.el.getObject3D('lk-boss-model')

        if (object) {
            disposeObject(object)
            this.el.removeObject3D('lk-boss-model')
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
