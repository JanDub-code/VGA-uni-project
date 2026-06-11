const hologramVertex = `
    precision highp float;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPos;
    uniform float time;

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;

        float pulse = sin(position.y * 15.0 + time / 200.0) * 0.03;
        vec3 newPosition = position + (normal * pulse);

        vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
    }
`

const hologramFragment = `
    precision highp float;

    uniform vec3 color1;
    uniform vec3 color2;
    uniform float time;
    uniform float opacity;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPos;

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);

        float rim = 1.0 - max(dot(viewDir, normal), 0.0);
        float rimIntensity = smoothstep(0.4, 1.0, rim) * 1.5;

        float scanline = sin(vWorldPos.y * 3.5 - time / 150.0) * 0.5 + 0.5;
        float scanlinePulse = pow(scanline, 5.0);

        float colorMix = sin(time / 600.0) * 0.5 + 0.5;
        vec3 baseGlow = mix(color1, color2, colorMix);

        vec3 finalColor = (baseGlow * rimIntensity) + (baseGlow * scanlinePulse);
        float finalAlpha = clamp((rimIntensity + scanlinePulse * 0.5) * opacity, 0.0, 1.0);

        gl_FragColor = vec4(finalColor, finalAlpha);
    }
`

AFRAME.registerShader('hologram-wow', {
    schema: {
        color1: { type: 'color', is: 'uniform', default: '#00ffff' },
        color2: { type: 'color', is: 'uniform', default: '#ff00ff' },
        uMap: { type: 'map', is: 'uniform' },
        time: { type: 'time', is: 'uniform' },
        opacity: { type: 'number', is: 'uniform', default: 1.0 },
    },
    vertexShader: hologramVertex,
    fragmentShader: hologramFragment,
})

export { hologramVertex, hologramFragment }
