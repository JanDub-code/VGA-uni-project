import { createEntity } from './utils.js'
import { audioService } from '../../services/audioService.js'
import { ARENA, DRONE, GLACIES_COLORS, OVERHEAT, PHYSICS, PROJECTILE, TOWER_VISUAL } from './constants.js'

export const projectileMethods = {
  initSharedProjectileResources() {
    const T = this.THREE
    this.projectileResources = {
      geometry: new T.SphereGeometry(PROJECTILE.radius, 8, 6),
      material: new T.MeshBasicMaterial({
        color: this.beamStyle.projectileColor,
        toneMapped: false,
      }),
    }
    this.enemyProjectileResources = {
      geometry: new T.SphereGeometry(DRONE.projectileRadius, 8, 6),
      material: new T.MeshBasicMaterial({
        color: GLACIES_COLORS.anomalyPurple,
        transparent: true,
        opacity: 0.92,
        toneMapped: false,
      }),
    }
    this.pulseEffectGeometry = new T.RingGeometry(0.62, 1, 48)
  },

  prewarmRenderer() {
    requestAnimationFrame(() => {
      const renderer = this.el.sceneEl.renderer
      if (!renderer || !this.camera?.object3D) return
      renderer.compile?.(this.el.object3D, this.camera.object3D)
    })
  },

  initProjectilePool() {
    for (let i = 0; i < PROJECTILE.poolSize; i++) {
      const el = this.createProjectileEntity()
      el.object3D.visible = false
      this.projectilePool.push({
        el,
        position: new this.THREE.Vector3(),
        direction: new this.THREE.Vector3(),
        life: 0,
        active: false,
      })
    }
  },

  createProjectileEntity() {
    const T = this.THREE
    const resources = this.projectileResources || {
      geometry: new T.SphereGeometry(PROJECTILE.radius, 8, 6),
      material: new T.MeshBasicMaterial({ color: this.beamStyle.projectileColor, toneMapped: false }),
    }
    const mesh = new T.Mesh(resources.geometry, resources.material)
    mesh.name = 'projectile-mesh'

    const entity = createEntity('a-entity', {
      position: '0 -1000 0',
    }, this.el)

    entity.setObject3D('mesh', mesh)
    this.allProjectileEls.push(entity)
    return entity
  },

  getPooledProjectile() {
    return this.projectilePool.pop() || null
  },

  recycleProjectile(projectile) {
    projectile.active = false
    projectile.life = 0
    projectile.el.object3D.visible = false
    projectile.el.object3D.position.set(0, -1000, 0)
    this.projectilePool.push(projectile)
  },

  initEnemyProjectilePool() {
    for (let i = 0; i < DRONE.projectilePoolSize; i += 1) {
      const projectile = this.createEnemyProjectileRecord()
      projectile.el.object3D.visible = false
      this.enemyProjectilePool.push(projectile)
    }
  },

  createEnemyProjectileRecord() {
    const T = this.THREE
    const resources = this.enemyProjectileResources || {
      geometry: new T.SphereGeometry(DRONE.projectileRadius, 8, 6),
      material: new T.MeshBasicMaterial({
        color: GLACIES_COLORS.anomalyPurple,
        transparent: true,
        opacity: 0.92,
        toneMapped: false,
      }),
    }
    const mesh = new T.Mesh(resources.geometry, resources.material)
    mesh.name = 'enemy-projectile-mesh'
    const el = createEntity('a-entity', {
      position: '0 -1000 0',
    }, this.el)
    el.setObject3D('mesh', mesh)
    return {
      el,
      position: new this.THREE.Vector3(),
      direction: new this.THREE.Vector3(),
      life: 0,
      active: false,
    }
  },

  fireProjectile() {
    if (this.ended || this.clockTime - this.lastFireTime < PROJECTILE.fireRate) return
    if (!this.ship?.object3D) return
    if (this.heat >= 1 || this.clockTime < this.overheatLockUntil) {
      this.playBlockedShotAudio()
      return
    }
    this.lastFireTime = this.clockTime
    this.heat = Math.min(1, this.heat + OVERHEAT.perShot)
    if (this.heat >= 1) {
      this.overheatLockUntil = this.clockTime + OVERHEAT.lockDuration
      if (audioService?.playTone) {
        audioService.playTone({ frequency: OVERHEAT.lockAudioFreq, duration: 0.4, type: 'sawtooth' })
      }
    }

    const shipPos = this.ship.object3D.position
    const direction = this._projectileForward.set(0, 0, -1).applyAxisAngle(this.yAxis, this.shipYaw).normalize()
    const position = this._projectilePosition.copy(shipPos).addScaledVector(direction, PHYSICS.projectileSpawnForward)
    position.y = 3.0

    const projectile = this.getPooledProjectile()
    if (!projectile) return

    projectile.position.copy(position)
    projectile.direction.copy(direction)
    projectile.life = PROJECTILE.lifetime
    projectile.active = true
    projectile.el.object3D.position.copy(position)
    projectile.el.object3D.visible = true

    this.projectiles.push(projectile)
  },

  updateProjectiles(dt) {
    let write = 0
    for (let i = 0; i < this.projectiles.length; i += 1) {
      const projectile = this.projectiles[i]
      projectile.life -= dt
      projectile.position.addScaledVector(projectile.direction, PROJECTILE.speed * dt)
      projectile.el.object3D.position.copy(projectile.position)

      const hitDrone = this.getProjectileDroneHit(projectile)
      if (hitDrone) {
        this.damageDrone(hitDrone, PROJECTILE.damage)
        this.recycleProjectile(projectile)
        continue
      }

      const hitTower = this.getProjectileTowerHit(projectile)
      if (hitTower) {
        this.damageTower(hitTower, PROJECTILE.damage)
        this.recycleProjectile(projectile)
        continue
      }

      const hitTerrain = this.getProjectileTerrainHit(projectile)
      if (hitTerrain) {
        this.createProjectileTerrainHit(hitTerrain, GLACIES_COLORS.lanternGold)
        this.recycleProjectile(projectile)
        continue
      }

      const maxDistance = ARENA.radius + 40
      const distanceSq = projectile.position.x * projectile.position.x
        + projectile.position.z * projectile.position.z
      if (projectile.life <= 0 || distanceSq > maxDistance * maxDistance) {
        this.recycleProjectile(projectile)
        continue
      }
      this.projectiles[write] = projectile
      write += 1
    }
    this.projectiles.length = write
  },

  getProjectileTowerHit(projectile) {
    for (let i = 0; i < this.towers.length; i += 1) {
      const tower = this.towers[i]
      if (tower.destroyed) continue
      const dx = projectile.position.x - tower.position.x
      const dz = projectile.position.z - tower.position.z
      const dy = projectile.position.y - TOWER_VISUAL.height * 0.48
      const radius = TOWER_VISUAL.hitRadius + PROJECTILE.radius
      if (dx * dx + dz * dz <= radius * radius && Math.abs(dy) < TOWER_VISUAL.height * 0.72) return tower
    }
    return null
  },

  getProjectileDroneHit(projectile) {
    for (let i = 0; i < this.drones.length; i += 1) {
      const drone = this.drones[i]
      if (drone.destroyed || drone.tower.destroyed) continue
      const dx = projectile.position.x - drone.position.x
      const dy = projectile.position.y - drone.position.y
      const dz = projectile.position.z - drone.position.z
      const radius = DRONE.hitRadius + PROJECTILE.radius + 2.4
      const verticalTolerance = DRONE.guardHeight + DRONE.hpBarYOffset
      if (dx * dx + dz * dz <= radius * radius && Math.abs(dy) <= verticalTolerance) return drone
    }
    return null
  },

  getProjectileTerrainHit(projectile) {
    if (!this.terrainColliders || this.terrainColliders.length === 0) return null
    const maxY = 18
    if (projectile.position.y > maxY) return null
    for (let i = 0; i < this.terrainColliders.length; i += 1) {
      const collider = this.terrainColliders[i]
      const dx = projectile.position.x - collider.position.x
      const dz = projectile.position.z - collider.position.z
      const minDistance = collider.radius + PROJECTILE.radius
      if (dx * dx + dz * dz <= minDistance * minDistance) {
        return { collider, position: projectile.position }
      }
    }
    return null
  },

  createProjectileTerrainHit(hit, color) {
    if (!hit) return
    this._tmpVec.set(hit.position.x, 0.12, hit.position.z)
    this.triggerPulseEffect(this._tmpVec, color, 1.4, 5.2, 0.22, 0.62)
  },

  acquireEnemyProjectile() {
    return this.enemyProjectilePool.find((item) => !item.active) || null
  },

  releaseEnemyProjectile(projectile) {
    projectile.active = false
    projectile.life = 0
    projectile.el.object3D.visible = false
  },

  updateEnemyProjectiles(dt) {
    if (!this.ship?.object3D) return
    const shipPos = this.ship.object3D.position
    let write = 0
    for (let i = 0; i < this.enemyProjectiles.length; i += 1) {
      const projectile = this.enemyProjectiles[i]
      projectile.life -= dt
      projectile.position.addScaledVector(projectile.direction, (projectile.speed || DRONE.projectileSpeed) * dt)
      projectile.el.object3D.position.copy(projectile.position)

      const dx = projectile.position.x - shipPos.x
      const dy = projectile.position.y - (shipPos.y + 1.5)
      const dz = projectile.position.z - shipPos.z
      const hitRadius = PHYSICS.shipRadius + DRONE.projectileRadius
      if (dx * dx + dy * dy + dz * dz <= hitRadius * hitRadius) {
        this.damageShip(DRONE.projectileDamage)
        this.releaseEnemyProjectile(projectile)
        continue
      }

      const hitTerrain = this.getProjectileTerrainHit(projectile)
      if (hitTerrain) {
        this.createProjectileTerrainHit(hitTerrain, GLACIES_COLORS.anomalyPurple)
        this.releaseEnemyProjectile(projectile)
        continue
      }

      const distanceFromCenter = Math.sqrt(
        projectile.position.x * projectile.position.x
        + projectile.position.z * projectile.position.z,
      )
      if (projectile.life <= 0 || distanceFromCenter > ARENA.radius + 48) {
        this.releaseEnemyProjectile(projectile)
        continue
      }
      this.enemyProjectiles[write] = projectile
      write += 1
    }
    this.enemyProjectiles.length = write
  },

  playBlockedShotAudio() {
    if (!audioService?.playTone) return
    const now = this.clockTime || 0
    if (this._lastBlockedAudioAt && now - this._lastBlockedAudioAt < 0.12) return
    this._lastBlockedAudioAt = now
    audioService.playTone({ frequency: OVERHEAT.blockAudioFreq, duration: 0.03, type: 'square' })
  },
}
