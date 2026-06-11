import { gameState } from '../../services/gameState.js'
import { audioService } from '../../services/audioService.js'
import { gamepadNavService } from '../../services/gamepadNavService.js'
import { clamp, damp } from './utils.js'
import { ARENA, GAME_STATES, LIGHTING, OVERHEAT, PHYSICS } from './constants.js'

function setText(id, value) {
  const el = document.getElementById(id)
  if (el) el.textContent = value
}

export const gameplayMethods = {
  clearInputState() {
    Object.keys(this.keys).forEach((key) => { this.keys[key] = false })
    this.boostQueued = false
    this.fireQueued = false
    this.gpDrift = false
  },

  updateInput(gpState) {
    const keyForward = this.keys.w || this.keys.keyw || (!gpState && this.keys.arrowup)
    const keyReverse = this.keys.s || this.keys.keys || (!gpState && this.keys.arrowdown)
    const gpForward = gpState?.forwardThrottle > 0.08 ? gpState.forwardThrottle : 0
    const gpReverse = gpState?.reverseThrottle > 0.08 ? gpState.reverseThrottle : 0
    this.throttleInput = Math.max(keyForward ? 1 : 0, gpForward) - Math.max(keyReverse ? 1 : 0, gpReverse)
    const keyTurn = (this.keys.d || this.keys.keyd || (!gpState && this.keys.arrowright) ? 1 : 0)
      - (this.keys.a || this.keys.keya || (!gpState && this.keys.arrowleft) ? 1 : 0)
    const gpTurn = gpState ? clamp(gpState.leftX || 0, -1, 1) * 0.72 : 0
    this.turnInputTarget = gpState && Math.abs(gpTurn) > 0 ? gpTurn : keyTurn
    if (this.keys.space || gpState?.rightShoulderPressed) this.boostQueued = true
    this.gpDrift = !!gpState?.leftShoulderPressed
  },

  updateMovement(dt) {
    const drifting = this.isDrifting()
    this.boostCooldown = Math.max(0, this.boostCooldown - dt)
    this.turnInput = damp(this.turnInput, this.turnInputTarget || 0, 7.5, dt)
    this.shipYaw -= this.turnInput * PHYSICS.turnSpeed * dt

    this.forward.set(0, 0, -1).applyAxisAngle(this.yAxis, this.shipYaw).normalize()
    this.right.set(1, 0, 0).applyAxisAngle(this.yAxis, this.shipYaw).normalize()

    if (this.throttleInput > 0) {
      this.velocity.addScaledVector(this.forward, PHYSICS.acceleration * this.throttleInput * dt)
    } else if (this.throttleInput < 0) {
      this.velocity.addScaledVector(this.forward, PHYSICS.reverseAcceleration * this.throttleInput * dt)
    }

    if (this.boostQueued && this.boostEnergy >= 0.32 && this.boostCooldown <= 0) {
      this.velocity.addScaledVector(this.forward, PHYSICS.boostImpulse)
      this.boostEnergy = Math.max(0, this.boostEnergy - 0.34)
      this.boostCooldown = PHYSICS.boostCooldown
    }
    this.boostQueued = false

    const lateralSpeed = this.velocity.dot(this.right)
    const stabilization = drifting ? PHYSICS.driftStabilization : PHYSICS.lateralStabilization
    this.velocity.addScaledVector(this.right, -lateralSpeed * clamp(stabilization * dt, 0, 1))
    this.velocity.multiplyScalar(Math.exp(-(drifting ? PHYSICS.driftFriction : PHYSICS.baseFriction) * dt))
    if (this.velocity.length() > PHYSICS.maxSpeed) this.velocity.setLength(PHYSICS.maxSpeed)

    const shipPos = this.ship.object3D.position
    shipPos.addScaledVector(this.velocity, dt)
    shipPos.y = 1.7
    this.resolveTerrainCollisions(shipPos)
    this.resolveArenaBoundary(shipPos)

    if (drifting) {
      this.driftEnergy = Math.max(0, this.driftEnergy - 0.24 * dt)
    } else {
      this.driftEnergy = Math.min(1, this.driftEnergy + 0.18 * dt)
    }
    this.boostEnergy = Math.min(1, this.boostEnergy + 0.16 * dt)
    this.damageCooldown = Math.max(0, this.damageCooldown - dt)
    this.damageStatusHold = Math.max(0, this.damageStatusHold - dt)
    this.boundaryPulse = Math.max(0, this.boundaryPulse - dt * 2.4)
    this.obstaclePulse = Math.max(0, this.obstaclePulse - dt * 3.0)
  },

  isDrifting() {
    return !!(this.keys.shift || this.keys.shiftleft || this.keys.shiftright || this.gpDrift) && this.driftEnergy > 0.03
  },

  updateShipTransform(dt) {
    if (!this.ship?.object3D) return
    const shipObj = this.ship.object3D
    const speedPct = clamp(this.velocity.length() / PHYSICS.maxSpeed, 0, 1)
    const roll = -this.turnInput * 0.16 - clamp(this.velocity.dot(this.right) / PHYSICS.maxSpeed, -1, 1) * 0.18
    const pitch = -this.throttleInput * 0.07 - speedPct * 0.035
    shipObj.rotation.set(
      damp(shipObj.rotation.x, pitch, 8, dt),
      this.shipYaw,
      damp(shipObj.rotation.z, roll, 8, dt),
    )

    const engine = this.shipEngine || shipObj.getObjectByName('engine')
    if (!engine) return
    this.shipEngine = engine

    const thrust = Math.max(0.15, Math.abs(this.throttleInput)) + (this.boostCooldown > 0.45 ? 1.0 : 0)
    const flicker = 0.86 + Math.sin(this.clockTime * 26) * 0.08 + Math.sin(this.clockTime * 43.7) * 0.05

    const outer = this.shipEngineOuter || engine.getObjectByName('engine-plume-outer')
    const inner = this.shipEngineInner || engine.getObjectByName('engine-plume-inner')
    const nozzleGlow = this.shipEngineGlow || engine.getObjectByName('engine-nozzle-glow')
    const shipGlowSprite = this.shipGlowSprite || shipObj.getObjectByName('ship-glow')

    this.shipEngineOuter = outer
    this.shipEngineInner = inner
    this.shipEngineGlow = nozzleGlow
    this.shipGlowSprite = shipGlowSprite

    if (outer?.material) {
      outer.scale.set(0.9 + thrust * 0.16, 0.85 + thrust * 0.55, 0.9 + thrust * 0.16)
      outer.material.opacity = (0.18 + thrust * 0.18) * flicker
    }
    if (inner?.material) {
      inner.scale.set(0.72 + thrust * 0.1, 0.72 + thrust * 0.48, 0.72 + thrust * 0.1)
      inner.material.opacity = (0.38 + thrust * 0.28) * flicker
    }
    if (nozzleGlow?.material) {
      const glowScale = 0.46 + thrust * 0.38 + Math.sin(this.clockTime * 31) * 0.04
      const baseScale = nozzleGlow.userData.baseScale || [0.7, 0.7, 1]
      nozzleGlow.scale.set(baseScale[0] * glowScale, baseScale[1] * glowScale, baseScale[2])
      nozzleGlow.material.opacity = (0.2 + thrust * 0.28) * flicker
    }
    if (shipGlowSprite?.material) {
      const glowScale = 0.86 + thrust * 0.45
      const baseScale = shipGlowSprite.userData.baseScale || [1.1, 1.1, 1]
      shipGlowSprite.scale.set(baseScale[0] * glowScale, baseScale[1] * glowScale, baseScale[2])
      shipGlowSprite.material.opacity = (0.08 + thrust * 0.18) * flicker
    }

    engine.userData.sparks?.forEach((spark, index) => {
      const cycle = (this.clockTime * spark.userData.speed + spark.userData.seed) % 1
      const angle = spark.userData.seed + this.clockTime * (1.4 + index * 0.03)
      const spread = spark.userData.radius + cycle * 0.22 * thrust
      spark.position.set(
        Math.cos(angle) * spread,
        Math.sin(angle) * spread * 0.6,
        -cycle * spark.userData.length * (0.7 + thrust * 0.65),
      )
      const size = (0.05 + cycle * 0.13) * (0.8 + thrust * 0.35)
      spark.scale.set(size, size, 1)
      spark.material.opacity = (1 - cycle) * (0.16 + thrust * 0.26)
    })
  },

  registerObstacleImpact(impactSpeed) {
    if (impactSpeed < PHYSICS.impactDamageMinSpeed || this.damageCooldown > 0) return
    const damage = Math.min(9, Math.max(1, Math.round((impactSpeed - PHYSICS.impactDamageMinSpeed) * PHYSICS.impactDamageMultiplier)))
    this.damageShip(damage)
    this.damageCooldown = PHYSICS.collisionDamageCooldown
  },

  damageShip(damage) {
    if (this.ended || damage <= 0) return
    gameState.damageLantern(damage / 100)
    this.shipHealth = gameState.getLanternBrightness() * 100
    this.damagePulse = 1
    this.damageStatusHold = 1.25
    this.lastDamage = damage
    this.flashDamage()
    if (gameState.isLanternDepleted()) this.endMission(false)
  },

  flashDamage() {
    const flash = document.getElementById('damageFlash')
    if (!flash) return
    flash.classList.add('active', 'show')
    window.clearTimeout(this.damageFlashTimer)
    this.damageFlashTimer = window.setTimeout(() => {
      flash.classList.remove('active', 'show')
      this.damageFlashTimer = null
    }, 120)
  },

  updateDamageFeedback(dt) {
    this.damagePulse = Math.max(0, this.damagePulse - dt * 2.8)
    if (this.shipImpactRing?.material) {
      const pulse = this.damagePulse
      const isVisible = pulse > 0.01
      if (this.shipImpactRing.visible !== isVisible || isVisible) {
        this.shipImpactRing.visible = isVisible
        this.shipImpactRing.material.opacity = pulse * 0.58
        const scale = 1 + (1 - pulse) * 1.35
        this.shipImpactRing.scale.set(scale, scale, 1)
      }
    }
    const shipLight = this.shipGlow?.object3D?.children?.[0]
    if (shipLight?.isLight) {
      if (this.damagePulse > 0) {
        shipLight.intensity = LIGHTING.shipGlowIntensity * this.beamStyle.intensity + this.damagePulse * 1.4
        shipLight.color.set(this.damagePulse > 0.01 ? '#ff3b1f' : this.beamStyle.glowColor)
        this._shipLightReset = false
      } else if (!this._shipLightReset) {
        shipLight.intensity = LIGHTING.shipGlowIntensity * this.beamStyle.intensity
        shipLight.color.set(this.beamStyle.glowColor)
        this._shipLightReset = true
      }
    }
  },

  updateHud(dt = 0) {
    if (!this.hud) return
    const speed = Math.round(this.velocity.length())
    if (this._hudCache.speed !== speed) {
      this._hudCache.speed = speed
      this.speedEl.textContent = `${speed}`
    }

    const driftEnergyRounded = Math.round(this.driftEnergy * 100)
    const isDrifting = this.isDrifting()
    const lit = Math.round(clamp(this.driftEnergy, 0, 1) * this.driftSegmentEls.length)
    if (this._hudCache.driftEnergy !== driftEnergyRounded || this._hudCache.isDrifting !== isDrifting) {
      this._hudCache.driftEnergy = driftEnergyRounded
      this._hudCache.isDrifting = isDrifting
      if (this.driftFillEl) this.driftFillEl.style.width = `${this.driftEnergy * 100}%`

      if (this._hudCache.driftLit !== lit || this._hudCache.isDrifting !== isDrifting) {
        this._hudCache.driftLit = lit
        this.updateSegments(this.driftSegmentEls, lit, isDrifting)
      }
    }
    const boostPct = Math.round(this.boostEnergy * 100)
    if (this._hudCache.boostEnergy !== boostPct) {
      this._hudCache.boostEnergy = boostPct
      if (this.boostFillEl) this.boostFillEl.style.width = `${boostPct}%`
    }
    const hullPct = Math.round(this.shipHealth)
    if (this._hudCache.shipHealth !== hullPct) {
      this._hudCache.shipHealth = hullPct
      if (this.hullFillEl) {
        this.hullFillEl.style.width = `${hullPct}%`
        this.hullFillEl.classList.toggle('depleted', hullPct <= 0)
        this.hullFillEl.classList.toggle('low', hullPct < 35 && hullPct > 0)
      }
    }
    const heatPct = Math.round(this.heat * 100)
    const isOverheated = this.heat >= 1
    const isWarning = this.heat >= OVERHEAT.warningThreshold && !isOverheated
    const heatClass = isOverheated ? 'overheated' : isWarning ? 'warning' : ''
    if (this._hudCache.heat !== heatPct) {
      this._hudCache.heat = heatPct
      if (this.heatFillEl) this.heatFillEl.style.width = `${heatPct}%`
    }
    if (this._hudCache.heatClass !== heatClass) {
      this._hudCache.heatClass = heatClass
      if (this.heatFillEl) {
        this.heatFillEl.classList.toggle('warning', isWarning)
        this.heatFillEl.classList.toggle('overheated', isOverheated)
      }
    }
    if (this.heatBarEl) {
      const lockRemaining = Math.max(0, this.overheatLockUntil - this.clockTime)
      const lockText = lockRemaining > 0 ? ` <span class="glacies-heat-lock">${lockRemaining.toFixed(1)}s</span>` : ''
      const labelEl = this.heatBarEl.previousElementSibling
      if (labelEl && labelEl.classList.contains('glacies-meter-label')) {
        const baseText = 'TEPLO JÁDRA'
        const newText = isOverheated ? `${baseText}${lockText}` : baseText
        if (labelEl.dataset.baseText !== baseText) labelEl.dataset.baseText = baseText
        if (labelEl.innerHTML !== newText) labelEl.innerHTML = newText
      }
    }
    if (this.heatVignetteEl) {
      const shouldShow = isOverheated
      if (this._hudCache.heatVignette !== shouldShow) {
        this._hudCache.heatVignette = shouldShow
        this.heatVignetteEl.classList.toggle('active', shouldShow)
      }
    }
    this._radarUpdateTimer -= dt
    if (this._radarUpdateTimer <= 0) {
      this._radarUpdateTimer = 0.08
      if (this.radarShipEl) this.radarShipEl.style.transform = `translate(-50%, -50%) rotate(${-this.shipYaw}rad)`
      this.updateRadarBlips()
    }
    this.controlEls.forEach((el) => {
      const key = el.dataset.key
      const active = key === 'shift'
        ? this.isDrifting()
        : key === 'space'
          ? this.boostCooldown > 0
          : key === 'fire'
            ? this.clockTime - this.lastFireTime < 0.12
            : !!this.keys[key]
      el.classList.toggle('active', active)
    })
    if (this.missionStateEl) {
      const note = this.damageStatusHold > 0
        ? ` / JAS -${this.lastDamage}%`
        : this.boundaryPulse > 0
          ? ' / HRANICE LEDU'
          : this.obstaclePulse > 0
            ? ' / NARAZ DO LEDU'
            : ''
      const text = `STAV: ${this.towersDestroyed}/${this.towers.length} vezi zniceno${note}`
      if (this._hudCache.missionState !== text) {
        this._hudCache.missionState = text
        this.missionStateEl.textContent = text
      }
    }
  },

  updateSegments(segments, lit, active) {
    segments.forEach((segment, index) => {
      segment.classList.toggle('on', index < lit)
      segment.classList.toggle('hot', active && index < lit)
    })
  },

  updateOverheat(dt) {
    if (this.overheatLockUntil > 0 || this.heat >= 1) {
      this.heat = Math.max(0, this.heat - OVERHEAT.overheatCooling * dt)
      if (this.heat < 1 && this.clockTime >= this.overheatLockUntil) {
        this.overheatLockUntil = 0
      }
    } else {
      this.heat = Math.max(0, this.heat - OVERHEAT.passiveCooling * dt)
    }
    if (this.heat >= OVERHEAT.warningThreshold && this.clockTime - this._heatWarningLastPlayed >= OVERHEAT.warningAudioInterval) {
      this._heatWarningLastPlayed = this.clockTime
      if (audioService?.playTone) {
        audioService.playTone({ frequency: OVERHEAT.warningAudioFreq, duration: 0.06, type: 'sine' })
      }
    }
  },

  applyCoolantCharge() {
    this.heat = Math.max(0, this.heat - OVERHEAT.coolantReduction)
    this.overheatLockUntil = 0
    this.boostEnergy = 1
    this.boostCooldown = 0
    this.showCoolantNotification()
    if (this.ship?.object3D) {
      this._tmpVec.set(this.ship.object3D.position.x, 0.13, this.ship.object3D.position.z)
      this.triggerPulseEffect(this._tmpVec, OVERHEAT.coolantAudioFreq === 1320 ? '#7DF9FF' : '#7DF9FF', 4, 26, 0.5, 0.82)
    }
    if (audioService?.playTone) {
      audioService.playTone({ frequency: OVERHEAT.coolantAudioFreq, duration: 0.2, type: 'sine' })
    }
  },

  showCoolantNotification() {
    if (!this.missionUi) return
    const toast = document.createElement('div')
    toast.className = 'glacies-coolant-toast'
    toast.textContent = '+CHLADICÍ NÁPLŇ'
    this.missionUi.appendChild(toast)
    this.setManagedTimeout(() => {
      if (toast.parentNode) toast.remove()
    }, 1400)
  },

  endMission(completed) {
    if (this.ended) return
    this.ended = true
    window.clearTimeout(this.victoryTimeout)
    this.victoryTimeout = null
    window.clearTimeout(this.damageFlashTimer)
    this.damageFlashTimer = null
    this._timeouts?.forEach((id) => window.clearTimeout(id))
    this._timeouts?.clear()
    document.getElementById('damageFlash')?.classList.remove('active', 'show')
    this.heat = 0
    this.overheatLockUntil = 0
    this._hudCache = {}
    this.victorySequence = null
    this.state = completed ? GAME_STATES.VICTORY : GAME_STATES.GAME_OVER
    audioService.stopShipEngine()

    if (completed) {
      window.dispatchEvent(new CustomEvent('mission-ended', {
        detail: { completed: true, planetIndex: this.data.planetIndex, score: this.score },
      }))
      setText('victoryScore', this.score.toLocaleString('cs-CZ'))
      const copy = document.querySelector('#victoryMenu .victory-copy')
      if (copy) copy.textContent = 'Pohlcovače Světla padly. Led Glacies znovu propouští paprsky Majáku.'
      document.getElementById('victoryMenu')?.classList.remove('hidden')
      gamepadNavService.replace({
        id: 'victory',
        linear: true,
        elements: () => ['victoryRetryButton', 'victoryMapButton']
          .map((id) => document.getElementById(id))
          .filter(Boolean),
      })
    } else {
      setText('finalScore', this.score.toLocaleString('cs-CZ'))
      document.getElementById('gameOverMenu')?.classList.remove('hidden')
      gamepadNavService.replace({
        id: 'game-over',
        linear: true,
        elements: () => ['retryButton', 'gameOverMapButton', 'mainMenuButton']
          .map((id) => document.getElementById(id))
          .filter(Boolean),
      })
    }
  },
}
