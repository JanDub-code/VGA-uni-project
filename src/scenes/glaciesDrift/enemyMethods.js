import { clamp, createEntity, seededRandom } from './utils.js'
import { ARENA, DRONE, DRONE_AI, DRONE_GLOW, DRONE_STATES, GLACIES_COLORS, LIGHT_PHASES, TOWER_LAYOUT, TOWER_VISUAL } from './constants.js'

export const enemyMethods = {
  createLightAbsorberCones() {
    TOWER_LAYOUT.forEach((layout, index) => {
      const root = createEntity('a-entity', {
        class: 'glacies-light-absorber',
        position: `${layout.x} 0 ${layout.z}`,
      }, this.el)

      const cone = createEntity('a-entity', {
        'gltf-model': `url(${TOWER_VISUAL.asset})`,
        scale: `${TOWER_VISUAL.modelScale} ${TOWER_VISUAL.modelScale} ${TOWER_VISUAL.modelScale}`,
        shadow: 'cast: true; receive: true',
      }, root)
      cone.addEventListener('model-loaded', (event) => this.prepareTowerModel(event.detail.model, cone), { once: true })

      const hpBar = this.createTowerHpBar(layout)

      root.object3D.userData.towerIndex = index
      this.towers.push({
        root,
        cone,
        coneMeshes: cone.object3D.userData.towerMeshes || [],
        towerIndex: index,
        hpBar,
        position: new this.THREE.Vector3(layout.x, 0, layout.z),
        hp: TOWER_VISUAL.hp,
        maxHp: TOWER_VISUAL.hp,
        destroyed: false,
        hitFlash: 0,
      })
    })
    this.createDefendingDrones()
  },

  createDefendingDrones() {
    this.towers.forEach((tower, towerIndex) => {
      const centerAngle = Math.atan2(-tower.position.z, -tower.position.x)
      for (let slot = 0; slot < DRONE.perTower; slot += 1) {
        const side = slot === 0 ? -1 : 1
        const guardAngle = centerAngle + side * DRONE.guardSpread + (towerIndex - 1) * 0.1
        const guardPoint = this.getDroneGuardPoint(tower, guardAngle, DRONE.guardRadius)
        const position = guardPoint.clone()
        const root = createEntity('a-entity', {
          class: 'glacies-defending-drone',
          'gltf-model': `url(${DRONE.asset})`,
          position: `${position.x} ${position.y} ${position.z}`,
          scale: `${DRONE.modelScale} ${DRONE.modelScale} ${DRONE.modelScale}`,
          shadow: 'cast: false; receive: false',
        }, this.el)
        root.addEventListener('model-loaded', (event) => this.disableDroneModelShadows(event.detail.model), { once: true })
        createEntity('a-sphere', {
          geometry: 'primitive: sphere; radius: 0.34; segmentsWidth: 8; segmentsHeight: 6',
          material: `color: #f1d7ff; emissive: ${GLACIES_COLORS.anomalyPurple}; emissiveIntensity: 2.5; shader: flat; transparent: true; opacity: 0.9`,
          position: '0 -0.34 0',
        }, root)
        root.object3D.lookAt(tower.position.x, DRONE.guardHeight, tower.position.z)
        const hpBar = this.createDroneHpBar(position)
        const drone = {
          root,
          tower,
          towerIndex,
          slot,
          side,
          hp: DRONE.hp,
          maxHp: DRONE.hp,
          hpBar,
          destroyed: false,
          hitFlash: 0,
          guardAngle,
          guardPoint,
          hoverPhase: towerIndex * 1.9 + slot * 2.7,
          shootTimer: 0.65 + slot * 0.48 + towerIndex * 0.18,
          state: DRONE_STATES.PASSIVE,
          stateAge: 0,
          burstRemaining: 0,
          burstCooldown: 0,
          position,
          desired: position.clone(),
          radial: new this.THREE.Vector3(),
          tangent: new this.THREE.Vector3(),
          toShip: new this.THREE.Vector3(),
        }
        this.drones.push(drone)
        this.createDroneHalo(drone)
      }
    })
    this.createRadarBlips()
  },

  createDroneHaloTexture() {
    const T = this.THREE
    const size = DRONE_GLOW.textureSize
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const center = size / 2
    const grad = ctx.createRadialGradient(center, center, 0, center, center, center)
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)')
    grad.addColorStop(0.18, 'rgba(255, 255, 255, 0.85)')
    grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.35)')
    grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.08)')
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    const texture = new T.CanvasTexture(canvas)
    texture.colorSpace = T.SRGBColorSpace
    texture.minFilter = T.LinearFilter
    texture.magFilter = T.LinearFilter
    texture.needsUpdate = true
    return texture
  },

  createDroneHalo(drone) {
    const T = this.THREE
    if (!this.droneHaloTexture) this.droneHaloTexture = this.createDroneHaloTexture()
    const material = new T.SpriteMaterial({
      map: this.droneHaloTexture,
      color: new T.Color(DRONE_GLOW.color),
      blending: T.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      opacity: LIGHT_PHASES[0].droneHaloOpacity,
      sizeAttenuation: true,
      toneMapped: false,
    })
    const sprite = new T.Sprite(material)
    sprite.name = 'glacies-drone-halo'
    sprite.scale.set(DRONE_GLOW.baseSize, DRONE_GLOW.baseSize, 1)
    sprite.position.set(0, DRONE_GLOW.yOffset, 0)
    sprite.renderOrder = 6
    drone.root.object3D.add(sprite)
    drone.halo = sprite
  },

  getDroneGuardPoint(tower, angle, radius) {
    return new this.THREE.Vector3(
      tower.position.x + Math.cos(angle) * radius,
      DRONE.guardHeight,
      tower.position.z + Math.sin(angle) * radius,
    )
  },

  getDronePhasePressure() {
    const phase = clamp(this.lightPhaseTarget ?? this.lightPhase ?? 0, 0, 3)
    return {
      approach: 2.8 + phase * 1.15,
      chaseSmoothing: 4.2 + phase * 0.65,
      fireRate: DRONE.fireRate * (1 - phase * 0.12),
      fireRange: DRONE.fireRange + phase * 12,
      projectileSpeed: DRONE.projectileSpeed * (1 + phase * 0.12),
      timerJitter: Math.max(0.18, 0.45 - phase * 0.07),
    }
  },

  disableDroneModelShadows(model) {
    model?.traverse?.((child) => {
      if (!child.isMesh) return
      child.castShadow = false
      child.receiveShadow = false
    })
  },

  createTowerHpBar(layout) {
    const y = TOWER_VISUAL.hpBarY
    const width = TOWER_VISUAL.hpBarWidth
    const height = TOWER_VISUAL.hpBarHeight
    const root = createEntity('a-entity', {
      class: 'glacies-tower-hp-bar',
      position: `${layout.x} ${y} ${layout.z}`,
    }, this.el)

    createEntity('a-entity', {
      geometry: `primitive: plane; width: ${width + 0.9}; height: ${height + 0.55}`,
      material: 'color: #02070d; transparent: true; opacity: 0.2; shader: flat; side: double; depthWrite: false',
      position: '0 0 -0.02',
    }, root)

    createEntity('a-entity', {
      geometry: `primitive: plane; width: ${width + 0.25}; height: ${height + 0.18}`,
      material: `color: ${GLACIES_COLORS.cyan}; transparent: true; opacity: 0.18; shader: flat; side: double; depthWrite: false`,
      position: '0 0 -0.01',
    }, root)

    const fill = createEntity('a-entity', {
      geometry: `primitive: plane; width: ${width}; height: ${height}`,
      material: `color: ${GLACIES_COLORS.lanternGold}; emissive: ${GLACIES_COLORS.lanternGold}; emissiveIntensity: 0.75; transparent: true; opacity: 0.78; shader: flat; side: double; depthWrite: false`,
    }, root)

    return { root, fill, fillMesh: fill.getObject3D('mesh'), width }
  },

  createDroneHpBar(position) {
    const width = DRONE.hpBarWidth
    const height = DRONE.hpBarHeight
    const root = createEntity('a-entity', {
      class: 'glacies-drone-hp-bar',
      position: `${position.x} ${position.y + DRONE.hpBarYOffset} ${position.z}`,
    }, this.el)

    createEntity('a-entity', {
      geometry: `primitive: plane; width: ${width + 0.35}; height: ${height + 0.22}`,
      material: 'color: #02070d; transparent: true; opacity: 0.32; shader: flat; side: double; depthWrite: false',
      position: '0 0 -0.02',
    }, root)

    const fill = createEntity('a-entity', {
      geometry: `primitive: plane; width: ${width}; height: ${height}`,
      material: `color: ${GLACIES_COLORS.cyan}; emissive: ${GLACIES_COLORS.cyan}; emissiveIntensity: 0.72; transparent: true; opacity: 0.82; shader: flat; side: double; depthWrite: false`,
    }, root)

    return { root, fill, fillMesh: fill.getObject3D('mesh'), width }
  },

  prepareTowerModel(model, towerEl) {
    const towerMeshes = []
    model.traverse((child) => {
      if (!child.isMesh || !child.material) return
      child.castShadow = true
      child.receiveShadow = true
      towerMeshes.push(child)
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        if (material.emissive) {
          material.userData.glaciesTowerBaseEmissive = material.emissiveIntensity ?? 0
        }
      })
    })
    towerEl.object3D.userData.towerMeshes = towerMeshes
  },

  damageDrone(drone, amount) {
    if (drone.destroyed) return
    drone.hp = Math.max(0, drone.hp - amount)
    drone.hitFlash = 1
    this.score += 45
    if (drone.hp <= 0) this.destroyDrone(drone)
  },

  destroyDrone(drone) {
    if (drone.destroyed) return
    drone.destroyed = true
    this.score += 160
    drone.root.object3D.visible = false
    if (drone.hpBar?.root?.object3D) drone.hpBar.root.object3D.visible = false
    this.createDroneBurst(drone.position)
  },

  damageTower(tower, amount) {
    if (tower.destroyed) return
    tower.hp = Math.max(0, tower.hp - amount)
    tower.hitFlash = 1
    this.score += 75
    if (tower.hp <= 0) this.destroyTower(tower)
  },

  destroyTower(tower) {
    if (tower.destroyed || tower.collapsing) return
    tower.collapsing = true
    this.drones.forEach((drone) => {
      if (drone.tower === tower && !drone.destroyed) this.destroyDrone(drone)
    })
    this.createTowerCollapsePulse(tower.position)
    this.triggerTowerCollapse(tower)
  },

  triggerTowerCollapse(tower) {
    tower.collapseState = {
      age: 0,
      fallDuration: 0.6,
      lightDelay: 0.6,
      totalDuration: 1.4,
      fallTriggered: false,
      lightTriggered: false,
      lightPhase: this.towersDestroyed + 1,
      rotationAxis: this._tmpVec.set(
        (seededRandom(tower.towerIndex * 7 + 11) - 0.5) * 0.6 - 0.4,
        0,
        (seededRandom(tower.towerIndex * 13 + 19) - 0.5) * 0.6 - 0.2,
      ).normalize(),
      baseY: tower.root.object3D.position.y,
      baseEmissive: (tower.coneMeshes?.[0]?.material?.emissiveIntensity) || 1,
    }
    if (tower.hpBar?.root?.object3D) tower.hpBar.root.object3D.visible = false
  },

  updateTowerCollapse(tower, dt) {
    if (!tower.collapseState) return
    const cs = tower.collapseState
    cs.age += dt
    const t = clamp(cs.age / cs.fallDuration, 0, 1)
    const eased = 1 - Math.pow(1 - t, 2)
    const fallAngle = eased * (Math.PI / 2)
    const fallY = cs.baseY * (1 - eased * 0.95)

    tower.cone.object3D.rotation.x = cs.rotationAxis.x * fallAngle
    tower.cone.object3D.rotation.z = cs.rotationAxis.z * fallAngle
    tower.root.object3D.position.y = fallY

    const coneMeshes = tower.coneMeshes
    if (coneMeshes?.length) {
      const dimT = clamp(cs.age / cs.totalDuration, 0, 1)
      coneMeshes.forEach((mesh) => {
        if (mesh.material && 'emissiveIntensity' in mesh.material) {
          mesh.material.emissiveIntensity = cs.baseEmissive * (1 - dimT)
        }
      })
    }

    if (!cs.fallTriggered && cs.age >= cs.fallDuration) {
      cs.fallTriggered = true
      this._tmpVec.set(tower.position.x, 0.18, tower.position.z)
      this.triggerPulseEffect(
        this._tmpVec,
        GLACIES_COLORS.lanternGold,
        5,
        32,
        0.7,
        0.88,
      )
    }

    if (!cs.lightTriggered && cs.age >= cs.lightDelay) {
      cs.lightTriggered = true
      this.completeTowerCollapse(tower)
    }
  },

  completeTowerCollapse(tower) {
    if (tower.destroyed) return
    tower.destroyed = true
    this.towersDestroyed += 1
    this.score += 500
    tower.root.object3D.visible = false
    this.lightPhase = this.towersDestroyed
    this.startLightPhaseTransition(this.lightPhase)
    tower.collapseState = null
    if (this.towersDestroyed >= this.towers.length) {
      this.createFinalLightPulse()
      this.createVictorySequence()
    }
  },

  createTowerCollapsePulse(position) {
    this._tmpVec.set(position.x, 0.14, position.z)
    this.triggerPulseEffect(this._tmpVec, GLACIES_COLORS.lanternGold, 7, 49, 0.52, 0.78)
  },

  createDroneBurst(position) {
    this.triggerPulseEffect(position, GLACIES_COLORS.anomalyPurple, 2.3, 9.2, 0.32, 0.86)
  },

  updateLightAbsorbers(dt) {
    this.towers.forEach((tower) => {
      this.updateTowerHpBar(tower)
      if (tower.collapseState) {
        this.updateTowerCollapse(tower, dt)
        return
      }
      if (tower.destroyed) return
      tower.hitFlash = Math.max(0, tower.hitFlash - dt * 4)
      tower.root.object3D.rotation.y += 0.18 * dt
      tower.cone.object3D.rotation.y -= 0.28 * dt
      const coneMeshes = tower.coneMeshes?.length ? tower.coneMeshes : tower.cone.object3D.userData.towerMeshes
      tower.coneMeshes = coneMeshes || []
      tower.coneMeshes.forEach((mesh) => {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach((material) => {
          if (material?.emissive) {
            material.emissiveIntensity = (material.userData.glaciesTowerBaseEmissive ?? material.emissiveIntensity ?? 0) + tower.hitFlash * 1.7
          }
        })
      })
    })
  },

  updateDrones(dt) {
    if (!this.ship?.object3D) return
    const shipPos = this.ship.object3D.position
    const pressure = this.getDronePhasePressure()
    const haloBaseOpacity = this.lightPhaseCurrent?.droneHaloOpacity ?? LIGHT_PHASES[0].droneHaloOpacity
    const haloPulseSpeed = DRONE_GLOW.pulseSpeed
    const haloPulseAmount = DRONE_GLOW.pulseAmount
    const haloHitBoost = DRONE_GLOW.hitFlashBoost
    this.drones.forEach((drone) => {
      if (drone.halo?.material) {
        const pulse = 1 + Math.sin(this.clockTime * haloPulseSpeed + drone.hoverPhase) * haloPulseAmount
        drone.halo.material.opacity = clamp((haloBaseOpacity + drone.hitFlash * haloHitBoost) * pulse, 0, 1)
      }
      if (drone.destroyed || drone.tower.destroyed) {
        this.updateDroneHpBar(drone)
        return
      }
      const towerPct = drone.tower.destroyed ? 0 : clamp(drone.tower.hp / drone.tower.maxHp, 0, 1)
      const nextState = this.getDroneNextState(drone, shipPos, towerPct)
      if (nextState !== drone.state) {
        drone.state = nextState
        drone.stateAge = 0
        if (nextState === DRONE_STATES.ENRAGED) {
          drone.burstRemaining = DRONE_AI.enraged.burstCount
          drone.burstCooldown = 0
        }
      } else {
        drone.stateAge += dt
      }

      const ai = DRONE_AI[drone.state.toLowerCase()] || DRONE_AI.passive
      const phase = this.clockTime * DRONE.guardStrafeSpeed + drone.hoverPhase
      const radial = drone.radial
        .set(Math.cos(drone.guardAngle), 0, Math.sin(drone.guardAngle))
        .normalize()
      const tangent = drone.tangent
        .set(-radial.z * drone.side, 0, radial.x * drone.side)
        .normalize()
      const desired = drone.desired
        .copy(drone.guardPoint)
        .addScaledVector(tangent, Math.sin(phase) * DRONE.guardDriftRadius * ai.driftMul)
        .addScaledVector(radial, Math.cos(phase * 0.7) * DRONE.guardDriftRadius * 0.42 * ai.driftMul)
      desired.y = DRONE.guardHeight + ai.hoverYOffset + Math.sin(phase * 1.6) * 1.25

      const toShip = drone.toShip.copy(shipPos).sub(drone.guardPoint)
      toShip.y = 0
      const shipDistance = toShip.length()
      if (shipDistance > 0.001 && shipDistance < pressure.fireRange) {
        const approachDistance = pressure.approach * ai.approachMul
        desired.addScaledVector(toShip.normalize(), approachDistance)
      }

      const chaseSmoothing = ((ai.chaseSmoothing ?? pressure.chaseSmoothing) + pressure.chaseSmoothing) * 0.5
      drone.position.lerp(desired, 1 - Math.exp(-chaseSmoothing * dt))
      const obj = drone.root.object3D
      obj.position.copy(drone.position)
      obj.lookAt(shipPos.x, shipPos.y + 1.8, shipPos.z)
      obj.rotation.z = Math.sin(this.clockTime * 4.2 + drone.slot) * 0.08
      drone.hitFlash = Math.max(0, drone.hitFlash - dt * 4.5)
      const flashScale = 1 + drone.hitFlash * 0.18
      obj.scale.setScalar(DRONE.modelScale * flashScale)
      this.updateDroneHpBar(drone)

      if (ai.fireRateMul <= 0) return
      const dx = shipPos.x - drone.position.x
      const dz = shipPos.z - drone.position.z
      const inRange = dx * dx + dz * dz <= pressure.fireRange * pressure.fireRange
      const adjustedFireRate = pressure.fireRate / Math.max(ai.fireRateMul, 0.01)
      const adjustedProjectileSpeed = pressure.projectileSpeed * ai.projectileSpeedMul

      if (drone.burstRemaining > 0) {
        drone.burstCooldown -= dt
        if (drone.burstCooldown <= 0) {
          this.fireDroneProjectile(drone, shipPos, adjustedProjectileSpeed, ai.predictive)
          drone.burstRemaining -= 1
          drone.burstCooldown = 0.18
        }
        return
      }

      drone.shootTimer -= dt
      if (inRange && drone.shootTimer <= 0) {
        drone.shootTimer = adjustedFireRate + seededRandom(Math.floor(this.clockTime * 10) + drone.towerIndex * 17 + drone.slot) * pressure.timerJitter
        this.fireDroneProjectile(drone, shipPos, adjustedProjectileSpeed, ai.predictive)
      }
    })
  },

  getDroneNextState(drone, shipPos, towerPct) {
    const t = DRONE_AI.transition
    const dx = shipPos.x - drone.position.x
    const dz = shipPos.z - drone.position.z
    const shipDistance = Math.sqrt(dx * dx + dz * dz)
    const current = drone.state
    const towerCritical = towerPct < t.towerCriticalThreshold
    const towerHurt = towerPct < t.towerHurtThreshold
    const towerRecovered = towerPct > t.towerRecoverThreshold

    if (current === DRONE_STATES.PASSIVE) {
      if (shipDistance < t.alertDistance || towerHurt) return DRONE_STATES.ALERT
      return DRONE_STATES.PASSIVE
    }
    if (current === DRONE_STATES.ALERT) {
      if (shipDistance < t.aggressiveDistance || towerHurt) return DRONE_STATES.AGGRESSIVE
      if (shipDistance > t.disengageDistance && !towerHurt) return DRONE_STATES.PASSIVE
      return DRONE_STATES.ALERT
    }
    if (current === DRONE_STATES.AGGRESSIVE) {
      if (towerCritical) return DRONE_STATES.ENRAGED
      if (shipDistance > t.disengageDistance + t.stateHysteresis && towerRecovered) return DRONE_STATES.ALERT
      return DRONE_STATES.AGGRESSIVE
    }
    if (current === DRONE_STATES.ENRAGED) {
      if (towerRecovered && shipDistance > t.disengageDistance + t.stateHysteresis * 2) return DRONE_STATES.AGGRESSIVE
      return DRONE_STATES.ENRAGED
    }
    return DRONE_STATES.PASSIVE
  },

  fireDroneProjectile(drone, targetPos, speed = DRONE.projectileSpeed, predictive = false) {
    const projectile = this.acquireEnemyProjectile()
    if (!projectile) return
    projectile.position.copy(drone.position)
    const aim = this._tmpVec3.copy(targetPos).add(this._droneAimOffset)
    if (predictive && this.velocity) {
      const distance = aim.distanceTo(drone.position)
      const timeToTarget = distance / Math.max(speed, 0.01)
      const shipVel = this.velocity
      const leadDistance = shipVel.length() * timeToTarget
      if (leadDistance > 0.5) {
        const leadDir = this._tmpVec.set(shipVel.x, 0, shipVel.z).normalize()
        aim.addScaledVector(leadDir, Math.min(leadDistance, 12))
      }
    }
    projectile.direction.copy(aim).sub(drone.position).normalize()
    projectile.speed = speed
    projectile.life = DRONE.projectileLifetime
    projectile.active = true
    projectile.el.object3D.position.copy(projectile.position)
    projectile.el.object3D.visible = true
    this.enemyProjectiles.push(projectile)
  },

  updateTowerHpBar(tower) {
    if (!tower.hpBar?.root?.object3D) return
    tower.hpBar.root.object3D.visible = !tower.destroyed
    if (tower.destroyed) return

    tower.hpBar.root.object3D.position.set(
      tower.position.x,
      TOWER_VISUAL.hpBarY,
      tower.position.z,
    )
    if (this.camera?.object3D) {
      tower.hpBar.root.object3D.quaternion.copy(this.camera.object3D.quaternion)
    }

    const pct = clamp(tower.hp / tower.maxHp, 0, 1)
    tower.hpBar.fill.object3D.scale.x = pct
    tower.hpBar.fill.object3D.position.x = -tower.hpBar.width * (1 - pct) * 0.5
    const fillMesh = tower.hpBar.fillMesh || tower.hpBar.fill.getObject3D('mesh')
    tower.hpBar.fillMesh = fillMesh
    if (fillMesh?.material) {
      fillMesh.material.color.set(pct <= 0.34 ? '#ff3b1f' : pct <= 0.67 ? '#ffd700' : GLACIES_COLORS.lanternGold)
      fillMesh.material.emissive?.copy?.(fillMesh.material.color)
      fillMesh.material.emissiveIntensity = 0.75 + tower.hitFlash * 0.55
    }
  },

  updateDroneHpBar(drone) {
    if (!drone.hpBar?.root?.object3D) return
    const visible = !drone.destroyed && !drone.tower.destroyed
    drone.hpBar.root.object3D.visible = visible
    if (!visible) return

    drone.hpBar.root.object3D.position.set(
      drone.position.x,
      drone.position.y + DRONE.hpBarYOffset,
      drone.position.z,
    )
    if (this.camera?.object3D) {
      drone.hpBar.root.object3D.quaternion.copy(this.camera.object3D.quaternion)
    }

    const pct = clamp(drone.hp / drone.maxHp, 0, 1)
    drone.hpBar.fill.object3D.scale.x = pct
    drone.hpBar.fill.object3D.position.x = -drone.hpBar.width * (1 - pct) * 0.5
    const fillMesh = drone.hpBar.fillMesh || drone.hpBar.fill.getObject3D('mesh')
    drone.hpBar.fillMesh = fillMesh
    if (fillMesh?.material) {
      fillMesh.material.color.set(pct <= 0.5 ? '#ff3b1f' : GLACIES_COLORS.cyan)
      fillMesh.material.emissive?.copy?.(fillMesh.material.color)
      fillMesh.material.emissiveIntensity = 0.72 + drone.hitFlash * 0.5
    }
  },
}
