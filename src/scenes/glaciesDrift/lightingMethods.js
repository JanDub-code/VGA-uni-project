import { clamp, createEntity, damp, seededRandom } from './utils.js'
import { audioService } from '../../services/audioService.js'
import { CAMERA, GAME_STATES, GLACIES_COLORS, LIGHTING, LIGHT_PHASES, VICTORY_SEQUENCE } from './constants.js'

export const lightingMethods = {
  configureRendererShadows() {
    requestAnimationFrame(() => {
      const renderer = this.el.sceneEl.renderer
      if (!renderer?.shadowMap) return
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = this.THREE.PCFSoftShadowMap
    })
  },

  createShipImpactRing() {
    const T = this.THREE
    this.shipImpactRing = new T.Mesh(
      new T.RingGeometry(1.9, 3.0, 64),
      new T.MeshBasicMaterial({
        color: '#ff3b1f',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
      }),
    )
    this.shipImpactRing.name = 'glacies-ship-impact-ring'
    this.shipImpactRing.rotation.x = -Math.PI / 2
    this.shipImpactRing.position.y = -0.35
    this.shipImpactRing.visible = false
    this.ship.object3D.add(this.shipImpactRing)
  },

  createShipLantern() {
    const style = this.beamStyle
    this.lanternRig = createEntity('a-entity', {
      id: 'glacies-lantern-rig',
    }, this.el)
    this.shipLanternTarget = createEntity('a-entity', {
      id: 'glacies-lantern-target',
      position: `0 -${LIGHTING.lanternTargetDrop} -${LIGHTING.lanternTargetDistance}`,
    }, this.lanternRig)
    this.shipSpot = createEntity('a-entity', {
      light: `type: spot; color: ${style.lanternColor}; intensity: ${LIGHTING.lanternIntensity * style.intensity}; distance: ${LIGHTING.lanternDistance}; angle: ${LIGHTING.lanternAngle}; penumbra: ${LIGHTING.lanternPenumbra}; decay: ${LIGHTING.lanternDecay}; target: #glacies-lantern-target; castShadow: true; shadowMapWidth: ${LIGHTING.shadowMapSize}; shadowMapHeight: ${LIGHTING.shadowMapSize}; shadowCameraNear: ${LIGHTING.shadowCameraNear}; shadowCameraFar: ${LIGHTING.shadowCameraFar}; shadowCameraFov: ${LIGHTING.lanternAngle}; shadowBias: ${LIGHTING.shadowBias}`,
      position: `0 ${LIGHTING.lanternSourceY} ${LIGHTING.lanternSourceZ}`,
    }, this.lanternRig)
    this.shipGlow = createEntity('a-entity', {
      light: `type: point; color: ${style.glowColor}; intensity: ${LIGHTING.shipGlowIntensity * style.intensity}; distance: ${LIGHTING.shipGlowDistance}`,
      position: '0 0 0',
    }, this.ship)
    this.createLanternVolumetricCone()
    this.createLanternGroundPool()
    this.configureLanternShadow()
  },

  createLanternVolumetricCone() {
    const T = this.THREE
    const style = this.beamStyle
    const h = LIGHTING.beamHeight
    const nearHalfWidth = LIGHTING.beamNearWidth
    const farHalfWidth = LIGHTING.beamRadius
    const shipY = this.ship.object3D.position.y || 1.7
    const shipScaleY = this.ship.object3D.scale.y || 1
    const airLocalY = (LIGHTING.beamAirY - shipY) / shipScaleY
    const farDrop = airLocalY - LIGHTING.beamApexY
    const segmentsX = 28
    const segmentsZ = 36
    const positions = []
    const uvs = []
    const indices = []

    for (let z = 0; z <= segmentsZ; z += 1) {
      const along = z / segmentsZ
      const halfWidth = nearHalfWidth + (farHalfWidth - nearHalfWidth) * Math.pow(along, 0.86)
      const centerLift = Math.sin(along * Math.PI) * 0.08
      for (let x = 0; x <= segmentsX; x += 1) {
        const side = (x / segmentsX) * 2 - 1
        positions.push(
          side * halfWidth,
          farDrop * Math.pow(along, 1.18) + centerLift,
          -h * along,
        )
        uvs.push(x / segmentsX, along)
      }
    }

    for (let z = 0; z < segmentsZ; z += 1) {
      for (let x = 0; x < segmentsX; x += 1) {
        const a = z * (segmentsX + 1) + x
        const b = a + 1
        const c = a + segmentsX + 1
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }

    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    this.lanternConeMaterial = new T.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCoreColor: { value: new T.Color(style.coreColor) },
        uEdgeColor: { value: new T.Color(style.edgeColor) },
        uIntensity: { value: LIGHTING.beamOpacity * style.intensity },
        uLength: { value: h },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec3 uCoreColor;
        uniform vec3 uEdgeColor;
        uniform float uIntensity;
        uniform float uLength;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          float along = clamp(vUv.y, 0.0, 1.0);
          float side = abs(vUv.x * 2.0 - 1.0);
          float core = pow(1.0 - side, 1.35);
          float centerHotspot = pow(1.0 - side, 2.7);
          float feather = 1.0 - smoothstep(0.28, 1.0, side);
          float edgeDissolve = 1.0 - smoothstep(0.52, 1.0, side);
          float sourceFade = smoothstep(0.0, 0.11, along);
          float distanceFade = 1.0 - smoothstep(0.58, 1.0, along);
          float farFeather = 1.0 - smoothstep(0.66 + noise(vec2(vUv.x * 3.5, uTime * 0.15)) * 0.12, 1.0, along);
          float contactGlow = smoothstep(0.44, 0.78, along) * (1.0 - smoothstep(0.88, 1.0, along));
          float mist = noise(vec2(vUv.x * 6.0 + uTime * 0.1, along * 7.0 - uTime * 0.22));
          float slowBand = sin(along * 9.0 - uTime * 1.1 + mist * 1.8) * 0.5 + 0.5;
          float breakup = mix(0.9, 1.06, mist) * mix(0.96, 1.03, slowBand);
          float alpha = (core * 0.3 + centerHotspot * 0.17 + feather * 0.18 + contactGlow * 0.2)
            * farFeather
            * edgeDissolve * sourceFade * distanceFade * breakup * uIntensity;
          vec3 color = mix(uEdgeColor, uCoreColor, clamp(centerHotspot * 0.75 + core * 0.48 + contactGlow * 0.16, 0.0, 1.0));
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.72));
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
      toneMapped: false,
    })

    this.lanternCone = new T.Mesh(geometry, this.lanternConeMaterial)
    this.lanternCone.name = 'glacies-lantern-soft-fan-beam'
    this.lanternCone.position.set(0, LIGHTING.beamApexY, LIGHTING.beamApexZ)
    this.lanternCone.renderOrder = 5
    this.lanternCone.frustumCulled = false
    this.lanternRig.object3D.add(this.lanternCone)
  },

  createLanternGroundPool() {
    const T = this.THREE
    const style = this.beamStyle
    const texture = this.createLanternPoolTexture({
      width: 384, height: 384,
      nearBias: 0.0, noiseSeed: 333,
    })

    this.groundPoolTexture = texture

    this.groundPool = new T.Mesh(
      new T.PlaneGeometry(LIGHTING.groundPoolWidth, LIGHTING.groundPoolLength),
      new T.MeshBasicMaterial({
        color: style.groundColor,
        map: texture,
        transparent: true,
        opacity: LIGHTING.groundPoolOpacity,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
        toneMapped: false,
      }),
    )
    this.groundPool.name = 'glacies-lantern-ground-pool'
    this.groundPool.rotation.x = -Math.PI / 2

    this.groundPoolBloom = new T.Mesh(
      new T.PlaneGeometry(LIGHTING.groundPoolWidth * 1.75, LIGHTING.groundPoolLength * 1.55),
      new T.MeshBasicMaterial({
        color: style.edgeColor,
        map: texture,
        transparent: true,
        opacity: LIGHTING.groundPoolBloomOpacity,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
        toneMapped: false,
      }),
    )
    this.groundPoolBloom.name = 'glacies-lantern-ground-pool-bloom'
    this.groundPoolBloom.rotation.x = -Math.PI / 2

    // Keep the decal in ship-local space, but pin its height to the ice plane.
    const tilt = this.THREE.MathUtils.degToRad(LIGHTING.beamTilt)
    const h = LIGHTING.beamHeight
    const shipY = this.ship.object3D.position.y || 1.7
    const shipScaleY = this.ship.object3D.scale.y || 1
    const localY = (LIGHTING.beamGroundY - shipY) / shipScaleY
    const localZ = LIGHTING.beamApexZ - h * Math.cos(tilt)
    this.groundPool.position.set(
      0,
      localY,
      localZ,
    )
    this.groundPoolBloom.position.copy(this.groundPool.position)
    this.groundPoolBloom.position.z += 0.72
    this.groundPool.renderOrder = 4
    this.groundPoolBloom.renderOrder = 3
    this.lanternRig.object3D.add(this.groundPoolBloom)
    this.lanternRig.object3D.add(this.groundPool)
    this.createLanternGroundContactLight(this.groundPool.position)
  },

  createLanternGroundContactLight(localPosition) {
    const T = this.THREE
    const style = this.beamStyle
    const shipScaleY = this.ship.object3D.scale.y || 1
    this.groundContactLight = new T.PointLight(
      style.groundColor,
      LIGHTING.groundContactLightIntensity * style.intensity,
      LIGHTING.groundContactLightDistance,
      1.1,
    )
    this.groundContactLight.name = 'glacies-lantern-ground-contact-light'
    this.groundContactLight.position.copy(localPosition)
    this.groundContactLight.position.y += 0.72 / shipScaleY
    this.lanternRig.object3D.add(this.groundContactLight)
  },

  configureLanternShadow() {
    requestAnimationFrame(() => {
      const spotLight = this.shipSpot?.components?.light?.light
      if (!spotLight?.isSpotLight) return
      spotLight.castShadow = true
      spotLight.decay = LIGHTING.lanternDecay
      spotLight.distance = LIGHTING.lanternDistance
      spotLight.angle = this.THREE.MathUtils.degToRad(LIGHTING.lanternAngle)
      spotLight.penumbra = LIGHTING.lanternPenumbra
      spotLight.shadow.mapSize.set(LIGHTING.shadowMapSize, LIGHTING.shadowMapSize)
      spotLight.shadow.camera.near = LIGHTING.shadowCameraNear
      spotLight.shadow.camera.far = LIGHTING.shadowCameraFar
      spotLight.shadow.camera.fov = LIGHTING.lanternAngle
      spotLight.shadow.bias = LIGHTING.shadowBias
      spotLight.shadow.camera.updateProjectionMatrix()
    })
  },

  createLanternPoolTexture({ width, height, nearBias, noiseSeed }) {
    const T = this.THREE
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const image = ctx.createImageData(width, height)
    const data = image.data

    for (let y = 0; y < height; y += 1) {
      const v = (y / (height - 1)) * 2 - 1
      for (let x = 0; x < width; x += 1) {
        const u = (x / (width - 1)) * 2 - 1
        const forwardBias = v + nearBias - 0.1
        const radial = Math.sqrt(u * u * 0.48 + forwardBias * forwardBias * 0.86)
        const center = Math.pow(1 - clamp((radial - 0.02) / 0.98, 0, 1), 2.7)
        const core = Math.pow(1 - clamp(Math.sqrt(u * u * 1.25 + forwardBias * forwardBias * 1.8) / 0.72, 0, 1), 2.1)
        const feather = Math.pow(1 - clamp(radial / 1.15, 0, 1), 1.2)
        const crackLift = Math.max(0, Math.sin((u * 17.0 + v * 9.0) + noiseSeed) * 0.5 + 0.5)
        const noise = 0.82 + seededRandom(noiseSeed + x * 0.71 + y * 1.37) * 0.22
        const alpha = (center * 0.74 + core * 0.34 + feather * 0.15 + crackLift * center * 0.08) * noise
        const index = (y * width + x) * 4
        data[index] = 255
        data[index + 1] = 255
        data[index + 2] = 255
        data[index + 3] = Math.round(clamp(alpha, 0, 1) * 255)
      }
    }

    ctx.putImageData(image, 0, 0)
    const texture = new T.CanvasTexture(canvas)
    texture.wrapS = T.ClampToEdgeWrapping
    texture.wrapT = T.ClampToEdgeWrapping
    texture.needsUpdate = true
    return texture
  },

  updateLanternBeam() {
    if (!this.ship?.object3D) return
    this.updateLanternRig()
    const phaseScale = this.lightPhaseCurrent?.lanternScale ?? 1
    const flicker = 0.96 + Math.sin(this.clockTime * 9.5 * this.beamStyle.pulseSpeed) * 0.035
    const beamIntensity = this.beamStyle.intensity * phaseScale * flicker

    if (this.lanternConeMaterial) {
      this.lanternConeMaterial.uniforms.uTime.value = this.clockTime
      this.lanternConeMaterial.uniforms.uIntensity.value = LIGHTING.beamOpacity
        * beamIntensity
    }

    if (this.groundPool?.material) {
      this.groundPool.material.opacity = LIGHTING.groundPoolOpacity
        * phaseScale
        * (0.9 + Math.sin(this.clockTime * 6.2) * 0.05)
    }

    if (this.groundPoolBloom?.material) {
      this.groundPoolBloom.material.opacity = LIGHTING.groundPoolBloomOpacity
        * phaseScale
        * (0.88 + Math.sin(this.clockTime * 4.7 + 1.8) * 0.08)
    }

    if (this.groundContactLight) {
      this.groundContactLight.intensity = LIGHTING.groundContactLightIntensity
        * this.beamStyle.intensity
        * phaseScale
        * (0.88 + Math.sin(this.clockTime * 5.4 + 0.7) * 0.06)
      this.groundContactLight.distance = LIGHTING.groundContactLightDistance
    }

    const spotLight = this.shipSpot?.components?.light?.light
    if (spotLight?.isSpotLight) {
      spotLight.intensity = LIGHTING.lanternIntensity
        * beamIntensity
    }
  },

  updateLanternRig() {
    if (!this.lanternRig?.object3D || !this.ship?.object3D) return
    this.lanternRig.object3D.position.copy(this.ship.object3D.position)
    this.lanternRig.object3D.rotation.set(0, this.shipYaw, 0)
    this.lanternRig.object3D.scale.copy(this.ship.object3D.scale)
  },

  updateCamera(dt) {
    if (!this.camera?.object3D || !this.ship?.object3D) return
    const shipPos = this.ship.object3D.position
    this.forward.set(0, 0, -1).applyAxisAngle(this.yAxis, this.shipYaw).normalize()
    this._cameraTarget
      .copy(shipPos)
      .addScaledVector(this.forward, -CAMERA.backDistance)
    this._cameraTarget.y += CAMERA.height
    this._cameraLook
      .copy(shipPos)
      .addScaledVector(this.forward, CAMERA.lookAhead)
    this._cameraLook.y += CAMERA.lookHeight

    const cameraObj = this.camera.object3D
    const smooth = 1 - Math.exp(-CAMERA.smoothing * dt)
    cameraObj.position.lerp(this._cameraTarget, smooth)
    cameraObj.lookAt(this._cameraLook)
    cameraObj.quaternion.multiply(this.cameraFlipQuat)
  },

  activateCamera() {
    requestAnimationFrame(() => {
      document.querySelectorAll('a-entity[camera]').forEach((cameraEntity) => {
        cameraEntity.setAttribute('camera', 'active: false')
      })
      this.camera?.setAttribute('camera', `active: true; fov: ${CAMERA.fov}; near: 0.05; far: 1400`)
      this.updateCamera(1)
    })
  },

  startLightPhaseTransition(phase) {
    this.lightPhaseTarget = clamp(phase, 0, LIGHT_PHASES.length - 1)
  },

  updateLightPhase(dt) {
    const target = LIGHT_PHASES[this.lightPhaseTarget] || LIGHT_PHASES[0]
    const speed = target.transitionSpeed || 1
    this.lightPhaseCurrent.fogDensity = damp(this.lightPhaseCurrent.fogDensity, target.fogDensity, speed, dt)
    this.lightPhaseCurrent.ambientIntensity = damp(this.lightPhaseCurrent.ambientIntensity, target.ambientIntensity, speed, dt)
    this.lightPhaseCurrent.hemisphereIntensity = damp(this.lightPhaseCurrent.hemisphereIntensity, target.hemisphereIntensity, speed, dt)
    this.lightPhaseCurrent.directionalIntensity = damp(this.lightPhaseCurrent.directionalIntensity, target.directionalIntensity, speed, dt)
    this.lightPhaseCurrent.fillIntensity = damp(this.lightPhaseCurrent.fillIntensity, target.fillIntensity, speed, dt)
    this.lightPhaseCurrent.iceEmissiveIntensity = damp(this.lightPhaseCurrent.iceEmissiveIntensity, target.iceEmissiveIntensity, speed, dt)
    this.lightPhaseCurrent.crackOpacity = damp(this.lightPhaseCurrent.crackOpacity, target.crackOpacity, speed, dt)
    this.lightPhaseCurrent.frostOpacity = damp(this.lightPhaseCurrent.frostOpacity, target.frostOpacity, speed, dt)
    this.lightPhaseCurrent.boundaryOpacity = damp(this.lightPhaseCurrent.boundaryOpacity, target.boundaryOpacity, speed, dt)
    this.lightPhaseCurrent.lanternScale = damp(this.lightPhaseCurrent.lanternScale, target.lanternScale, speed, dt)
    this.lightPhaseCurrent.droneHaloOpacity = damp(
      this.lightPhaseCurrent.droneHaloOpacity ?? LIGHT_PHASES[0].droneHaloOpacity,
      target.droneHaloOpacity,
      speed,
      dt,
    )
    this.finalLightPulse = Math.max(0, this.finalLightPulse - dt * 1.15)
    this.applyLightPhaseValues(this.lightPhaseCurrent)
  },

  applyLightPhaseValues(phase) {
    const pulse = this.finalLightPulse
    const fogDensity = Math.max(0.0008, phase.fogDensity - pulse * 0.001)
    const sceneFog = this.el.sceneEl.object3D?.fog
    if (sceneFog && 'density' in sceneFog) {
      sceneFog.density = fogDensity
    } else {
      const roundedFog = Math.round(fogDensity * 100000) / 100000
      if (this._lastFogDensity !== roundedFog) {
        this._lastFogDensity = roundedFog
        this.el.sceneEl.setAttribute('fog', `type: exponential; color: ${LIGHTING.fogColor}; density: ${roundedFog}`)
      }
    }

    const ambient = this.ambientLight?.components?.light?.light
    if (ambient) ambient.intensity = phase.ambientIntensity + pulse * 0.28
    const hemisphere = this.hemisphereLight?.components?.light?.light
    if (hemisphere) hemisphere.intensity = phase.hemisphereIntensity + pulse * 0.32
    const directional = this.directionalLight?.components?.light?.light
    if (directional) directional.intensity = phase.directionalIntensity + pulse * 0.18
    const fill = this.fillLight?.components?.light?.light
    if (fill) fill.intensity = phase.fillIntensity + pulse * 0.16

    const ice = this.icePhaseMaterials.ice
    if (ice) {
      ice.emissiveIntensity = phase.iceEmissiveIntensity + pulse * 0.32
    }
    const cracks = this.icePhaseMaterials.cracks
    if (cracks) cracks.opacity = clamp(phase.crackOpacity + pulse * 0.16, 0, 1)
    const frost = this.icePhaseMaterials.frost
    if (frost) frost.opacity = clamp(phase.frostOpacity + pulse * 0.12, 0, 1)
    const boundary = this.icePhaseMaterials.boundary
    if (boundary) boundary.opacity = clamp(phase.boundaryOpacity + this.boundaryPulse * 0.28 + pulse * 0.18, 0, 1)

    const spot = this.shipSpot?.components?.light?.light
    if (spot) spot.intensity = LIGHTING.lanternIntensity * this.beamStyle.intensity * phase.lanternScale
  },

  createFinalLightPulse() {
    this.finalLightPulse = 1
    this._tmpVec.set(0, 0.18, 0)
    this.triggerPulseEffect(this._tmpVec, GLACIES_COLORS.cyan, 16, 544, 0.9, 0.88)
  },

  createVictorySequence() {
    if (this.victorySequence) return
    this.victorySequence = {
      age: 0,
      pulseIndex: 0,
      nextPulseAt: 0,
      cameraStart: this.camera?.object3D?.position?.clone() || new this.THREE.Vector3(),
      ambientBase: this.ambientLight?.components?.light?.light?.intensity || 0,
      hemisphereBase: this.hemisphereLight?.components?.light?.light?.intensity || 0,
      directionalBase: this.directionalLight?.components?.light?.light?.intensity || 0,
    }
    this.state = GAME_STATES.VICTORY_SEQUENCE
    this.playVictoryAudio()
    this.setManagedTimeout(() => {
      this.victorySequence = null
      this.endMission(true)
    }, VICTORY_SEQUENCE.duration * 1000)
  },

  playVictoryAudio() {
    if (!audioService?.playTone) return
    VICTORY_SEQUENCE.audioTones.forEach((tone) => {
      this.setManagedTimeout(() => {
        audioService.playTone({
          frequency: tone.freq,
          duration: tone.duration,
          type: tone.type,
        })
      }, tone.delay * 1000)
    })
  },

  updateVictorySequence(dt) {
    if (this.state !== GAME_STATES.VICTORY_SEQUENCE || !this.victorySequence) return
    const seq = this.victorySequence
    seq.age += dt
    const totalSeconds = VICTORY_SEQUENCE.duration
    const t = clamp(seq.age / totalSeconds, 0, 1)
    const approachEnd = VICTORY_SEQUENCE.cameraApproachSeconds
    const holdEnd = approachEnd + VICTORY_SEQUENCE.cameraHoldSeconds

    if (seq.age >= seq.nextPulseAt && seq.pulseIndex < VICTORY_SEQUENCE.pulseWaves) {
      const color = VICTORY_SEQUENCE.pulseColors[seq.pulseIndex % VICTORY_SEQUENCE.pulseColors.length]
      this._tmpVec.set(0, 0.18, 0)
      this.triggerPulseEffect(
        this._tmpVec,
        color,
        VICTORY_SEQUENCE.pulseStartScale,
        VICTORY_SEQUENCE.pulseEndScale,
        VICTORY_SEQUENCE.pulseDuration,
        VICTORY_SEQUENCE.pulseOpacity,
      )
      seq.pulseIndex += 1
      seq.nextPulseAt = seq.pulseIndex * VICTORY_SEQUENCE.pulseInterval
    }

    const camera = this.camera?.object3D
    if (camera) {
      let cx, cy, cz
      if (seq.age < approachEnd) {
        const u = clamp(seq.age / approachEnd, 0, 1)
        const eased = 1 - Math.pow(1 - u, 3)
        cx = seq.cameraStart.x + (VICTORY_SEQUENCE.cameraFinal.x - seq.cameraStart.x) * eased
        cy = seq.cameraStart.y + (VICTORY_SEQUENCE.cameraFinal.y - seq.cameraStart.y) * eased
        cz = seq.cameraStart.z + (VICTORY_SEQUENCE.cameraFinal.z - seq.cameraStart.z) * eased
      } else if (seq.age < holdEnd) {
        cx = VICTORY_SEQUENCE.cameraFinal.x
        cy = VICTORY_SEQUENCE.cameraFinal.y
        cz = VICTORY_SEQUENCE.cameraFinal.z
      } else {
        const exitAge = seq.age - holdEnd
        const u = clamp(exitAge / VICTORY_SEQUENCE.cameraExitSeconds, 0, 1)
        const eased = u * u
        cx = VICTORY_SEQUENCE.cameraFinal.x + (seq.cameraStart.x - VICTORY_SEQUENCE.cameraFinal.x) * eased
        cy = VICTORY_SEQUENCE.cameraFinal.y + (seq.cameraStart.y - VICTORY_SEQUENCE.cameraFinal.y) * eased
        cz = VICTORY_SEQUENCE.cameraFinal.z + (seq.cameraStart.z - VICTORY_SEQUENCE.cameraFinal.z) * eased
      }
      camera.position.set(cx, cy, cz)
      camera.lookAt(
        VICTORY_SEQUENCE.cameraLookAt.x,
        VICTORY_SEQUENCE.cameraLookAt.y,
        VICTORY_SEQUENCE.cameraLookAt.z,
      )
    }

    const fogDensity = VICTORY_SEQUENCE.fogStartDensity + (VICTORY_SEQUENCE.fogEndDensity - VICTORY_SEQUENCE.fogStartDensity) * t
    const sceneFog = this.el.sceneEl.object3D?.fog
    if (sceneFog && 'density' in sceneFog) {
      sceneFog.density = fogDensity
    } else {
      const roundedFog = Math.round(fogDensity * 100000) / 100000
      if (this._lastFogDensity !== roundedFog) {
        this._lastFogDensity = roundedFog
        this.el.sceneEl.setAttribute('fog', `type: exponential; color: ${LIGHTING.fogColor}; density: ${roundedFog}`)
      }
    }

    const ambientBoost = 1 + (VICTORY_SEQUENCE.ambientBoost - 1) * Math.sin(t * Math.PI)
    const ambient = this.ambientLight?.components?.light?.light
    if (ambient) ambient.intensity = seq.ambientBase * ambientBoost
    const hemisphere = this.hemisphereLight?.components?.light?.light
    if (hemisphere) hemisphere.intensity = seq.hemisphereBase * ambientBoost
    const directional = this.directionalLight?.components?.light?.light
    if (directional) directional.intensity = seq.directionalBase * (1 + (ambientBoost - 1) * 0.6)
  },
}
