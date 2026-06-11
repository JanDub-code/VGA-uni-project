import './style.css'
import './src/components/models/lightkeeper-ship.js'
import './src/components/models/lightkeeper-planet.js'
import './src/components/models/lightkeeper-asteroid.js'
import './src/components/models/lightkeeper-enemy.js'
import './src/components/models/lightkeeper-boss.js'
import './src/components/models/lightkeeper-corridor-ring.js'
import './src/components/models/lightkeeper-mine.js'
import './src/components/models/lightkeeper-powerup.js'
import './src/components/hologram-shader.js'
import './src/components/menu-starfield.js'
import './src/components/menu-terrain.js'
import './src/components/menu-bg-planet.js'
import './src/scenes/galaxyTravel.js'
import './src/scenes/corridorRun.js'
import './src/scenes/ignisDefense.js'
import './src/scenes/zephyrSurface.js'
import './src/scenes/glaciesDrift.js'
import { buildAppShell } from './src/ui/appShell.js'
import { renderCharacterSelectView } from './src/ui/characterSelectView.js'
import { renderMainHeroCard } from './src/ui/mainHeroCard.js'
import { createMenuDisplayScene } from './src/scenes/menuDisplayScene.js'
import { createCharacterDisplayScene } from './src/scenes/characterDisplayScene.js'
import { CHARACTERS, gameState, getPlanet, PLANETS } from './src/services/gameState.js'
import { gamepadService } from './src/services/gamepadService.js'
import { gamepadNavService } from './src/services/gamepadNavService.js'

gamepadService.init()
gamepadNavService.init()
window.gamepadService = gamepadService
window.gamepadNavService = gamepadNavService

const DEV_MODE_STORAGE_KEY = 'lightkeeper.devMode'

function readDevModePreference() {
  try {
    const storedValue = localStorage.getItem(DEV_MODE_STORAGE_KEY)
    if (storedValue !== null) return storedValue === 'true'
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
  return !!import.meta.env.DEV
}

const app = document.querySelector('#app')
const initialDevMode = readDevModePreference()
app.innerHTML = buildAppShell({ showDebugControls: initialDevMode })

const scene = document.querySelector('#game-scene')
scene.addEventListener('renderstart', () => {
  scene.renderer.outputColorSpace = AFRAME.THREE.SRGBColorSpace
})

const mainMenu = document.querySelector('#main-menu')
const characterSelectUi = document.querySelector('#character-select-ui')
const galaxyUi = document.querySelector('#galaxy-ui')
const missionUi = document.querySelector('#mission-ui')
const systemMenu = document.querySelector('#system-menu')
const systemReturnMapButton = document.querySelector('#systemReturnMapButton')
const systemHomeButton = document.querySelector('#systemHomeButton')
const systemSettingsButton = document.querySelector('#systemSettingsButton')
const systemDevModeToggle = document.querySelector('#systemDevModeToggle')
const systemDevModeState = document.querySelector('#systemDevModeState')

let activeMode = 'main'
let activeMissionPlanet = 0
let activeRoot = null
let activeCharacterScene = null
let systemMenuOpen = false
let selectedMenuPlanet = 0
let devModeEnabled = initialDevMode
let lastGamepadSystemMenuToggle = 0

let menuShipEl = null
let menuShipYaw = 0
let menuDragActive = false
let menuDragLastX = 0
let menuAutoRotateRaf = null

const DEBUG_MISSION_ALIASES = {
  anomaly: 'anomalie',
}

// ── Ship rotation ──────────────────────────────────────────────────────────────

function menuAutoRotateTick() {
  if (activeMode !== 'main') {
    menuAutoRotateRaf = null
    return
  }
  if (!menuDragActive && menuShipEl?.object3D) {
    menuShipYaw += 0.1
    menuShipEl.object3D.rotation.y = (menuShipYaw * Math.PI) / 180
  }
  menuAutoRotateRaf = requestAnimationFrame(menuAutoRotateTick)
}

function onMenuPointerDown(x) {
  if (activeMode !== 'main') return
  menuDragActive = true
  menuDragLastX = x
}

function onMenuPointerMove(x) {
  if (!menuDragActive || !menuShipEl?.object3D) return
  menuShipYaw += (x - menuDragLastX) * 0.38
  menuDragLastX = x
  menuShipEl.object3D.rotation.y = (menuShipYaw * Math.PI) / 180
}

function onMenuPointerUp() {
  menuDragActive = false
}

// ── System menu ────────────────────────────────────────────────────────────────

function setSystemSection(section) {
  const nextSection = section === 'settings' && activeMode === 'main' ? 'settings' : 'controls'
  document.querySelectorAll('[data-system-section]').forEach((button) => {
    const active = button.dataset.systemSection === nextSection
    button.classList.toggle('active', active)
    button.setAttribute('aria-selected', active ? 'true' : 'false')
  })
  document.querySelectorAll('.system-content-panel').forEach((panel) => {
    const active = panel.id === (nextSection === 'settings' ? 'systemSettingsPanel' : 'systemControlsPanel')
    panel.classList.toggle('hidden', !active)
  })
}

function setSystemMenu(open, { section = null } = {}) {
  systemMenuOpen = open
  systemMenu?.classList.toggle('hidden', !open)
  systemReturnMapButton?.classList.toggle('hidden', activeMode !== 'mission')
  systemHomeButton?.classList.toggle('hidden', activeMode === 'main')
  systemSettingsButton?.classList.toggle('hidden', activeMode !== 'main')
  const initialSection = section ?? (activeMode === 'main' ? 'settings' : 'controls')
  if (open) setSystemSection(initialSection)
  window.dispatchEvent(new CustomEvent('system-menu-toggle', {
    detail: { open, mode: activeMode },
  }))
  if (open) {
    gamepadNavService.push({
      id: 'system-menu',
      linear: true,
      focusIdx: initialSection === 'settings' && activeMode === 'main' ? 1 : 0,
      elements: () => [
        ...document.querySelectorAll('button.system-nav-button:not([disabled])'),
        systemDevModeToggle,
        ...document.querySelectorAll('.control-mode-button'),
      ].filter((element) => element && !element.classList.contains('hidden') && !element.closest('.hidden')),
      onBack: () => setSystemMenu(false),
    })
  } else {
    gamepadNavService.remove('system-menu')
  }
}

function setControlMode(mode) {
  const nextMode = mode === 'keyboard' ? 'keyboard' : 'gamepad'
  document.querySelectorAll('.control-mode-button').forEach((button) => {
    const active = button.dataset.controlMode === nextMode
    button.classList.toggle('active', active)
    button.setAttribute('aria-selected', active ? 'true' : 'false')
  })
  document.querySelectorAll('.control-mode-panel').forEach((panel) => {
    const active = panel.id === (nextMode === 'keyboard' ? 'controlKeyboardPanel' : 'controlGamepadPanel')
    panel.classList.toggle('active', active)
    panel.hidden = !active
  })
}

function setDevMode(enabled, { persist = true } = {}) {
  devModeEnabled = !!enabled
  document.getElementById('mainDebugPlanetButtons')?.classList.toggle('hidden', !devModeEnabled)
  systemDevModeToggle?.classList.toggle('active', devModeEnabled)
  systemDevModeToggle?.setAttribute('aria-checked', devModeEnabled ? 'true' : 'false')
  if (systemDevModeState) systemDevModeState.textContent = devModeEnabled ? 'ZAPNUTO' : 'VYPNUTO'

  if (!persist) return
  try {
    localStorage.setItem(DEV_MODE_STORAGE_KEY, devModeEnabled ? 'true' : 'false')
  } catch {
    // Ignore persistence failures; the runtime switch still works.
  }
}

// ── Scene management ───────────────────────────────────────────────────────────

function removeWarpOverlays() {
  document.querySelectorAll('.warp-overlay').forEach((overlay) => overlay.remove())
}

function setUiMode(mode) {
  activeMode = mode
  mainMenu.classList.toggle('hidden', mode !== 'main')
  characterSelectUi?.classList.toggle('hidden', mode !== 'character')
  galaxyUi.classList.toggle('hidden', mode !== 'galaxy')
  missionUi.classList.toggle('hidden', mode !== 'mission')
}

function clearScene() {
  activeCharacterScene?.dispose?.()
  activeCharacterScene = null
  document.querySelectorAll('a-entity[camera]').forEach((cameraEntity) => {
    cameraEntity.setAttribute('camera', 'active: false')
  })
  if (activeRoot?.parentNode) {
    activeRoot.parentNode.removeChild(activeRoot)
  }
  activeRoot = null
}

// ── Mission UI helpers ─────────────────────────────────────────────────────────

function resetMissionUi(showStart = true) {
  document.getElementById('startMenu')?.classList.toggle('hidden', !showStart)
  ;['pauseMenu', 'gameOverMenu', 'victoryMenu'].forEach((id) => {
    document.getElementById(id)?.classList.add('hidden')
  })
  document.getElementById('boss-hud')?.classList.remove('active', 'show')
  document.getElementById('damageFlash')?.classList.remove('active', 'show')
  document.querySelectorAll('#mission-ui .score-popup').forEach((popup) => popup.remove())
  document.querySelectorAll('#mission-ui .powerup-slot').forEach((slot) => {
    slot.classList.remove('active')
    slot.querySelector('.powerup-timer')?.remove()
  })
  const score = document.getElementById('scoreDisplay')
  if (score) score.textContent = '0'
  const progress = document.getElementById('mapProgress')
  if (progress) progress.style.width = '0%'
  document.querySelectorAll('#heartsDisplay .heart').forEach((heart) => {
    heart.classList.remove('empty')
  })
}

function activateMissionCamera() {
  requestAnimationFrame(() => {
    const missionCamera = document.getElementById('mission-camera')
    if (!missionCamera) return
    document.querySelectorAll('a-entity[camera]').forEach((cameraEntity) => {
      cameraEntity.setAttribute('camera', 'active: false')
    })
    missionCamera.setAttribute('camera', 'active: true; fov: 75; near: 0.1; far: 1000')
  })
}

function normalizeDebugMissionValue(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function findPlanetIndexByDebugValue(value) {
  const normalizedValue = normalizeDebugMissionValue(value)
  if (!normalizedValue) return null

  const missionValue = DEBUG_MISSION_ALIASES[normalizedValue] ?? normalizedValue
  const planetIndex = PLANETS.findIndex((planet) => {
    const planetName = normalizeDebugMissionValue(planet.name)
    const missionComponent = normalizeDebugMissionValue(planet.missionComponent ?? '')
    return planetName === missionValue || missionComponent === missionValue
  })

  return planetIndex >= 0 ? planetIndex : null
}

function getDebugStartMissionIndex() {
  const rawValue = import.meta.env?.VITE_DEBUG_START_MISSION
  if (!rawValue) return null

  const value = normalizeDebugMissionValue(rawValue)
  if (!value || value === 'false' || value === 'off' || value === 'none') return null

  const numericIndex = Number(value)
  if (Number.isInteger(numericIndex) && PLANETS[numericIndex]) return numericIndex

  return findPlanetIndexByDebugValue(value)
}

// ── Screens ────────────────────────────────────────────────────────────────────

function renderMainMenuPlanets(selected = selectedMenuPlanet) {
  const list = document.getElementById('mmPlanetList')
  if (!list) return
  list.innerHTML = PLANETS.map((p, i) => `
    <div class="mm-planet-row${i === selected ? ' selected' : ''}" data-idx="${i}">
      <div class="mm-planet-dot" style="background:${p.color};box-shadow:0 0 10px ${p.color}80"></div>
      <div class="mm-planet-info">
        <div class="mm-planet-name">${p.name}</div>
        <div class="mm-planet-type">${p.type} &middot; ${p.diff}</div>
      </div>
      <div class="mm-planet-sel${i === selected ? ' active' : ''}"></div>
    </div>
  `).join('')
  list.querySelectorAll('.mm-planet-row').forEach((row) => {
    row.addEventListener('click', () => {
      selectedMenuPlanet = parseInt(row.dataset.idx)
      renderMainMenuPlanets(selectedMenuPlanet)
      const p = PLANETS[selectedMenuPlanet]
      const desc = document.getElementById('mmMissionDesc')
      const title = document.getElementById('mmMissionTitle')
      if (desc) desc.innerHTML = p.desc
      if (title) title.textContent = p.name
    })
  })
}

function renderMainMenuCharacters() {
  renderMainHeroCard(gameState.getSelectedCharacter())
}

function renderCharacterSelectUi() {
  renderCharacterSelectView({
    characters: CHARACTERS,
    selectedCharacter: gameState.getSelectedCharacter(),
    onSelect: selectCharacter,
  })
}

function selectCharacter(characterId) {
  if (!gameState.selectCharacter(characterId)) return
  const selectedCharacter = gameState.getSelectedCharacter()
  renderCharacterSelectUi()
  renderMainMenuCharacters()
  if (activeMode === 'character') {
    activeCharacterScene?.setCharacter(selectedCharacter, { celebrate: true })
  }
}

function setGalaxySpawnNearPlanet(planetIndex) {
  const planet = PLANETS[planetIndex]
  if (!planet?.worldPos) return false

  const spawnDistance = Math.max(
    (planet.orbitRadius ?? 200) * 0.86,
    (planet.radius ?? planet.size ?? 40) + 48,
  )

  gameState.galaxyTravel = {
    worldPos: {
      x: planet.worldPos.x,
      y: planet.worldPos.y,
      z: planet.worldPos.z + spawnDistance,
    },
    velocity: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
  }

  return true
}

function showGalaxy({ spawnPlanetIndex = null } = {}) {
  removeWarpOverlays()
  setSystemMenu(false)
  gamepadNavService.clear()
  if (Number.isInteger(spawnPlanetIndex)) {
    setGalaxySpawnNearPlanet(spawnPlanetIndex)
  }
  setUiMode('galaxy')
  clearScene()
  const galaxy = document.createElement('a-entity')
  galaxy.dataset.gameRoot = 'true'
  galaxy.setAttribute('galaxy-travel', '')
  scene.appendChild(galaxy)
  activeRoot = galaxy
}

function showMainMenu() {
  removeWarpOverlays()
  setSystemMenu(false)
  setUiMode('main')
  clearScene()
  const { root, shipEl } = createMenuDisplayScene(scene)
  activeRoot = root
  menuShipEl = shipEl
  if (!menuAutoRotateRaf) menuAutoRotateTick()
  renderMainMenuPlanets(0)
  renderMainMenuCharacters()
  selectedMenuPlanet = 0
  gamepadNavService.replace({
    id: 'main-menu',
    linear: true,
    elements: () => [
      document.getElementById('mmHeroPanel'),
      document.getElementById('mainStartButton'),
      ...document.querySelectorAll('#mainDebugPlanetButtons .mm-debug-btn'),
      document.getElementById('mainSettingsButton'),
    ].filter((element) => element && !element.classList.contains('hidden') && !element.closest('.hidden')),
  })
  const desc = document.getElementById('mmMissionDesc')
  const title = document.getElementById('mmMissionTitle')
  if (desc) desc.innerHTML = 'Hvězdný Maják kdysi osvětloval nesčetné světy a přinášel energii i život napříč galaxií. Nyní je jeho jádro rozbité.<br><br>Jako LightKeeper procestujte hvězdy, nalezněte fragmenty a obnovte světlo.'
  if (title) title.textContent = 'VAŠE MISE'
}

function showCharacterSelect() {
  removeWarpOverlays()
  setSystemMenu(false)
  setUiMode('character')
  clearScene()
  const selectedCharacter = gameState.getSelectedCharacter()
  const characterScene = createCharacterDisplayScene(scene, selectedCharacter)
  const { root, characterEl } = characterScene
  activeCharacterScene = characterScene
  activeRoot = root
  menuShipEl = characterEl
  renderCharacterSelectUi()
  const selectedFocusIndex = Math.max(0, CHARACTERS.findIndex((character) => character.id === selectedCharacter.id))
  gamepadNavService.replace({
    id: 'character-select',
    linear: true,
    focusIdx: selectedFocusIndex,
    elements: () => [
      ...document.querySelectorAll('.cs-character-card'),
      document.getElementById('characterStartButton'),
      document.getElementById('characterBackButton'),
    ].filter(Boolean),
    onBack: () => showMainMenu(),
  })
}

function showMission(planetIndex) {
  removeWarpOverlays()
  setSystemMenu(false)
  activeMissionPlanet = planetIndex
  const planet = getPlanet(planetIndex)
  setUiMode('mission')
  resetMissionUi(false)
  clearScene()
  const mission = document.createElement('a-entity')
  mission.dataset.gameRoot = 'true'
  if (planet.missionComponent === 'ignis-defense') {
    mission.setAttribute('ignis-defense', `planetIndex: ${planetIndex}; autoStart: true`)
  } else if (planet.missionComponent === 'zephyr-surface') {
    mission.setAttribute('zephyr-surface', `planetIndex: ${planetIndex}`)
  } else if (planet.missionComponent === 'glacies-drift') {
    mission.setAttribute('glacies-drift', `planetIndex: ${planetIndex}; autoStart: true`)
  } else {
    mission.setAttribute('corridor-run', `planetIndex: ${planetIndex}; mapIndex: ${planet.mapIndex}; autoStart: true`)
  }
  scene.appendChild(mission)
  activeRoot = mission
  resetMissionUi(false)
  activateMissionCamera()
  removeWarpOverlays()
}

function launchMissionWithWarp(planetIndex) {
  removeWarpOverlays()
  const overlay = document.createElement('div')
  overlay.className = 'warp-overlay'
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#000;z-index:9999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.5s ease;pointer-events:auto;'
  overlay.innerHTML = '<h1 style="color:#00ffff;font-family:Orbitron,sans-serif;letter-spacing:5px;text-shadow:0 0 30px #00ffff;">WARP DRIVE AKTIVOVÁN</h1>'
  document.body.appendChild(overlay)

  requestAnimationFrame(() => {
    overlay.style.opacity = '1'
    window.setTimeout(() => {
      showMission(planetIndex)
      removeWarpOverlays()
    }, 600)
  })
}

function bootInitialScreen() {
  const debugMissionIndex = getDebugStartMissionIndex()
  if (debugMissionIndex !== null) {
    console.info(`[dev] Starting mission from VITE_DEBUG_START_MISSION=${import.meta.env.VITE_DEBUG_START_MISSION}`)
    showMission(debugMissionIndex)
    return
  }

  showMainMenu()
}

// ── Event wiring ───────────────────────────────────────────────────────────────

window.addEventListener('start-mission', (event) => {
  removeWarpOverlays()
  showMission(event.detail.planetIndex)
})

window.addEventListener('launch-mission', (event) => {
  launchMissionWithWarp(event.detail.planetIndex)
})

window.addEventListener('mission-ended', (event) => {
  const result = event.detail
  if (result.completed) {
    gameState.completeMission(result.planetIndex, result.score)
    gameState.rewardLanternShard()
  } else {
    gameState.setLanternBrightness(0)
  }
})

window.addEventListener('return-map', () => showGalaxy())
window.addEventListener('return-main-menu', () => showMainMenu())

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopImmediatePropagation()
  setSystemMenu(!systemMenuOpen)
}, true)

window.addEventListener('gamepad-system-menu', () => {
  const now = performance.now()
  if (now - lastGamepadSystemMenuToggle < 80) return
  lastGamepadSystemMenuToggle = now
  setSystemMenu(!systemMenuOpen)
})

document.getElementById('systemCloseButton')?.addEventListener('click', () => setSystemMenu(false))
document.querySelector('.system-menu-nav')?.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-system-section]')
  if (!button) return
  setSystemSection(button.dataset.systemSection)
})
document.querySelector('.control-mode-switch')?.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-control-mode]')
  if (!button) return
  setControlMode(button.dataset.controlMode)
})
systemDevModeToggle?.addEventListener('click', () => setDevMode(!devModeEnabled))
systemHomeButton?.addEventListener('click', () => {
  setSystemMenu(false)
  showMainMenu()
})
document.getElementById('mainStartButton')?.addEventListener('click', () => showGalaxy())
document.getElementById('mainDebugPlanetButtons')?.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-planet-index]')
  if (!button) return
  const planetIndex = Number(button.dataset.planetIndex)
  if (!Number.isInteger(planetIndex) || !PLANETS[planetIndex]) return
  showGalaxy({ spawnPlanetIndex: planetIndex })
})
document.getElementById('mainSettingsButton')?.addEventListener('click', () => setSystemMenu(true, { section: 'settings' }))
document.getElementById('mmHeroPanel')?.addEventListener('click', () => showCharacterSelect())
document.getElementById('characterBackButton')?.addEventListener('click', () => showMainMenu())
document.getElementById('characterStartButton')?.addEventListener('click', () => showGalaxy())
systemReturnMapButton?.addEventListener('click', () => {
  setSystemMenu(false)
  window.dispatchEvent(new CustomEvent('return-map'))
})

document.addEventListener('mousedown', (e) => onMenuPointerDown(e.clientX))
document.addEventListener('mousemove', (e) => onMenuPointerMove(e.clientX))
document.addEventListener('mouseup', () => onMenuPointerUp())
document.addEventListener('touchstart', (e) => onMenuPointerDown(e.touches[0].clientX), { passive: true })
document.addEventListener('touchmove', (e) => onMenuPointerMove(e.touches[0].clientX), { passive: true })
document.addEventListener('touchend', () => onMenuPointerUp())

setDevMode(initialDevMode, { persist: false })
bootInitialScreen()
