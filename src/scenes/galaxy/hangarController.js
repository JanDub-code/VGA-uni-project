import { SHIP_SKINS, gameState } from '../../services/gameState.js'
import { gamepadNavService } from '../../services/gamepadNavService.js'

function createEntity(tag, attrs = {}, parent) {
  const el = document.createElement(tag)
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value))
  if (parent) parent.appendChild(el)
  return el
}

function setText(id, value) {
  const el = document.getElementById(id)
  if (el) el.textContent = value
}

export function createHangarController(host) {
  return {
    activeStation: null,
    skinIndex: 0,
    previewRoot: null,
    previewCamera: null,
    previewRimLight: null,
    previewAccentRing: null,
    shipPivot: null,
    ship: null,

    open(station) {
      host.closeStationPanel()
      document.getElementById('galaxy-ui')?.classList.add('hangar-active')
      this.activeStation = station
      this.skinIndex = Math.max(0, SHIP_SKINS.findIndex((skin) => skin.id === gameState.selectedShipSkinId))
      this.createPreview()
      this.renderSkins()
      document.getElementById('hangar-panel')?.classList.remove('hidden')
      gamepadNavService.push({
        id: 'hangar-panel',
        focusIdx: this.skinIndex,
        elements: () => [
          ...document.querySelectorAll('.hangar-skin-card'),
          document.getElementById('hangar-prev-btn'),
          document.getElementById('hangar-next-btn'),
          document.getElementById('hangar-select-btn'),
          document.getElementById('hangar-return-btn'),
          document.getElementById('hangar-close-btn'),
        ].filter(Boolean),
        onBack: () => this.close(),
        linear: true,
      })
    },

    close() {
      document.getElementById('galaxy-ui')?.classList.remove('hangar-active')
      document.getElementById('hangar-panel')?.classList.add('hidden')
      gamepadNavService.remove('hangar-panel')
      this.destroyPreview()
      if (host.ship?.object3D) host.ship.object3D.visible = true
      host.activateCamera?.()
      if (host.activeStationIdx !== null) {
        const button = document.getElementById('dock-btn')
        if (button) {
          button.disabled = false
          button.textContent = 'OTEVŘÍT HANGÁR'
        }
      }
    },

    renderSkins() {
      const list = document.getElementById('hangar-skin-list')
      if (!list) return
      const selectedId = gameState.selectedShipSkinId
      const previewSkin = SHIP_SKINS[this.skinIndex] || SHIP_SKINS[0]

      list.innerHTML = SHIP_SKINS.map((skin) => {
        const unlocked = gameState.isShipSkinUnlocked(skin.id)
        const selected = skin.id === selectedId
        const previewed = skin.id === previewSkin.id
        const meta = unlocked
          ? (selected ? 'AKTIVNÍ PLÁŠŤ' : skin.role || 'PŘIPRAVENO')
          : 'UZAMČENÉ SCHÉMA'
        return `
          <button class="mm-planet-row hangar-skin-card${previewed ? ' selected' : ''}${unlocked ? '' : ' locked'}" type="button" data-skin-id="${skin.id}">
            <div class="mm-planet-dot hangar-skin-dot" style="background:${skin.accentColor};box-shadow:0 0 10px ${skin.accentColor}80"></div>
            <div class="mm-planet-info">
              <div class="mm-planet-name hangar-skin-name">${skin.name}</div>
              <div class="mm-planet-type hangar-skin-meta">${meta}</div>
            </div>
            <div class="mm-planet-sel${previewed ? ' active' : ''}"></div>
          </button>
        `
      }).join('')

      list.querySelectorAll('.hangar-skin-card').forEach((button) => {
        button.addEventListener('click', () => {
          const skinId = button.dataset.skinId
          const nextIndex = SHIP_SKINS.findIndex((skin) => skin.id === skinId)
          if (nextIndex < 0) return
          this.skinIndex = nextIndex
          this.updatePreview()
          this.renderSkins()
        })
      })

      setText('hangar-preview-name', previewSkin.name)
      setText('hangar-skin-title', previewSkin.name)
      setText('hangar-skin-role', previewSkin.role || 'Lodní plášť Lucerny')
      setText('hangar-skin-desc', previewSkin.desc)

      const status = document.getElementById('hangar-skin-status')
      const specs = document.getElementById('hangar-skin-specs')
      const lockNote = document.getElementById('hangar-lock-note')
      const selectButton = document.getElementById('hangar-select-btn')
      const unlocked = gameState.isShipSkinUnlocked(previewSkin.id)
      const active = previewSkin.id === selectedId
      if (specs) {
        specs.innerHTML = (previewSkin.hangarStats || []).map((stat) => `
          <div class="hangar-spec-row">
            <span>${stat.label}</span>
            <strong>${stat.value}</strong>
          </div>
        `).join('')
      }
      if (lockNote) {
        lockNote.textContent = unlocked
          ? ''
          : previewSkin.unlockHint || 'Tento plášť se odemkne postupem v kampani.'
      }
      document.getElementById('hangar-panel')?.classList.toggle('hangar-preview-locked', !unlocked)
      if (status) status.textContent = active ? 'AKTIVNÍ PLÁŠŤ' : unlocked ? 'PŘIPRAVENO K VÝBĚRU' : 'UZAMČENO'
      if (selectButton) {
        selectButton.disabled = active || !unlocked
        selectButton.textContent = active ? 'AKTIVNÍ' : unlocked ? 'VYBRAT' : 'UZAMČENO'
      }
    },

    stepSkin(direction) {
      const count = SHIP_SKINS.length
      if (!count) return
      this.skinIndex = (this.skinIndex + direction + count) % count
      this.updatePreview()
      this.renderSkins()
    },

    selectSkin() {
      const skin = SHIP_SKINS[this.skinIndex]
      if (!skin || !gameState.selectShipSkin(skin.id)) return
      host.applySelectedShipSkin()
      this.updatePreview()
      this.renderSkins()
    },

    createPreview() {
      if (host.ship?.object3D) host.ship.object3D.visible = false
      if (this.previewRoot) return

      this.previewRoot = createEntity('a-entity', {
        id: 'hangar-preview-root',
      }, host.el)

      host.camera?.setAttribute('camera', 'active: false')
      this.previewCamera = createEntity('a-entity', {
        id: 'hangar-preview-camera',
        camera: 'fov: 54; active: true; near: 0.1; far: 120',
        position: '0 1.35 5.8',
        rotation: '-7 0 0',
      }, this.previewRoot)

      createEntity('a-light', {
        type: 'ambient',
        color: '#2a2630',
        intensity: '0.88',
      }, this.previewRoot)
      createEntity('a-light', {
        type: 'directional',
        color: '#ffe8c2',
        intensity: '2.25',
        position: '-3.5 5.8 4.5',
      }, this.previewRoot)
      createEntity('a-light', {
        type: 'spot',
        color: '#fff1d6',
        intensity: '2.1',
        distance: '12',
        angle: '42',
        penumbra: '0.6',
        position: '0 4.4 1.4',
        rotation: '-72 0 0',
      }, this.previewRoot)
      this.previewRimLight = createEntity('a-light', {
        type: 'point',
        color: '#ffd700',
        intensity: '4.2',
        distance: '14',
        position: '2.8 2.6 0.6',
      }, this.previewRoot)

      createEntity('a-image', {
        position: '0 0.15 -12.8',
        width: '46',
        height: '36.8',
        material: 'src: /img/hangar.png; shader: flat; transparent: true; opacity: 1; side: double',
      }, this.previewRoot)

      createEntity('a-entity', {
        'gltf-model': 'url(/models/environments/platform.glb)',
        position: '0 -1.82 -2.6',
        scale: '0.42 0.42 0.42',
      }, this.previewRoot)
      createEntity('a-circle', {
        position: '0 -1.18 -2.6',
        rotation: '-90 0 0',
        scale: '2.35 0.68 1',
        geometry: 'primitive: circle; radius: 1.08; segments: 96',
        material: 'color: #02050a; shader: flat; transparent: true; opacity: 0.34; depthWrite: false',
      }, this.previewRoot)
      this.previewAccentRing = createEntity('a-ring', {
        position: '0 -1.15 -2.6',
        rotation: '-90 0 0',
        geometry: 'primitive: ring; radiusInner: 1.08; radiusOuter: 1.18; segmentsTheta: 96',
        material: 'color: #00d8ff; emissive: #00d8ff; emissiveIntensity: 1.4; transparent: true; opacity: 0.9; shader: flat',
      }, this.previewRoot)

      this.shipPivot = createEntity('a-entity', {
        position: '0 0.78 -2.6',
        animation__hover: 'property: position; from: 0 0.06 -2.6; to: 0 0.38 -2.6; dur: 3600; dir: alternate; loop: true; easing: easeInOutSine',
        animation__spin: 'property: rotation; from: 0 205 0; to: 0 565 0; dur: 16000; loop: true; easing: linear',
      }, this.previewRoot)

      this.ship = createEntity('a-entity', {
        'lk-ship-model': 'flame: false; size: 6.6',
        rotation: '0 0 0',
      }, this.shipPivot)
      this.updatePreview()
    },

    updatePreview() {
      const skin = SHIP_SKINS[this.skinIndex] || gameState.getSelectedShipSkin()
      if (!this.ship || !skin) return
      this.ship.setAttribute('lk-ship-model', `flame: false; size: 6.6; modelUrl: ${skin.modelUrl}; color: ${skin.accentColor}`)
      this.previewRimLight?.setAttribute('color', skin.accentColor)
      this.previewAccentRing?.setAttribute('material', `color: ${skin.accentColor}; emissive: ${skin.accentColor}; emissiveIntensity: 1.4; transparent: true; opacity: 0.9; shader: flat`)
    },

    destroyPreview() {
      if (this.previewRoot?.object3D) {
        this.previewRoot.object3D.traverse((child) => {
          if (child.geometry) child.geometry.dispose()
          if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach((mat) => {
              Object.values(mat).forEach((val) => {
                if (val?.isTexture) val.dispose()
              })
              mat.dispose()
            })
          }
        })
      }
      this.previewRoot?.remove()
      this.previewRoot = null
      this.previewCamera = null
      this.previewRimLight = null
      this.previewAccentRing = null
      this.shipPivot = null
      this.ship = null
    },
  }
}
