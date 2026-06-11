const ZEPHYR_MODEL_URL = '/models/planets/earth.glb'
const IGNIS_MODEL_URL = '/models/planets/magma.glb'
const ANOMALY_MODEL_URL = '/models/planets/orbion.glb'
const DEFAULT_SHIP_SKIN_ID = 'keeper-default'
const DEFAULT_CHARACTER_ID = 'david'

export const CHARACTERS = [
  {
    id: 'david',
    name: 'David',
    role: 'Pilot / Obránce',
    portraitUrl: '/img/david.png',
    modelUrl: '/models/characters/david.glb',
    accentColor: '#00d8ff',
    stats: [
      { label: 'Rychlost letu', value: '+12%', color: '#ffaa00' },
      { label: 'Přesnost střelby', value: '+8%', color: '#44AAAA' },
      { label: 'Energie štítu', value: '+5%', color: '#00d8ff' },
    ],
    desc: 'Vyrovnaný pilot pro obranu světelných tras. Hodí se pro stabilní let, přesné zásahy a bezpečný průzkum.',
  },
  {
    id: 'ivo',
    name: 'Ivo',
    role: 'Inženýr / Průzkumník',
    portraitUrl: '/img/ivo.png',
    modelUrl: '/models/characters/ivo.glb',
    accentColor: '#9b30ff',
    stats: [
      { label: 'Rychlost oprav', value: '+15%', color: '#ffaa00' },
      { label: 'Sběr fragmentů', value: '+10%', color: '#44AAAA' },
      { label: 'Účinnost energie', value: '+6%', color: '#00d8ff' },
    ],
    desc: 'Technický průzkumník zaměřený na efektivní sběr a práci s energií Lucerny v nebezpečných sektorech.',
  },
]

export const SHIP_SKINS = [
  {
    id: DEFAULT_SHIP_SKIN_ID,
    name: 'Lucerna Strážce',
    modelUrl: '/models/ships/spaceship.glb',
    role: 'Vyvážený hlídkový plášť',
    desc: 'Původní loď posledního Strážce. Drží klidnou stopu v rychlých obratech, odpouští chyby při přiblížení k orbitě a nechává pilotovi dost prostoru na korekce.',
    hangarStats: [
      { label: 'Stabilita', value: 'Vysoká' },
      { label: 'Tah', value: 'Střední' },
      { label: 'Použití', value: 'Univerzální let' },
    ],
    accentColor: '#df7008ff',
    unlockedByDefault: true,
  },
  {
    id: 'keeper-scout',
    name: 'Průzkumník Zephyru',
    modelUrl: '/models/ships/spaceship-2.glb',
    role: 'Lehký průzkumný rám',
    desc: 'Ostrý a lehký plášť pro piloty, kteří chtějí rychle měnit výšku a číst proudy kolem planet. Nejlépe funguje při svižném průletu mezi stanicemi a prstenci.',
    hangarStats: [
      { label: 'Stabilita', value: 'Citlivá' },
      { label: 'Tah', value: 'Rychlý nástup' },
      { label: 'Použití', value: 'Průzkum a manévry' },
    ],
    unlockHint: 'Odměna za dokování v Doku Strážců Alfa.',
    accentColor: '#ae08bdff',
  },
  {
    id: 'keeper-relic',
    name: 'Relikvie Řádu',
    modelUrl: '/models/ships/spaceship-3.glb',
    role: 'Archivní těžší konstrukce',
    desc: 'Obnovený návrh starých Strážců s pevnějším trupem a klidnějším profilem letu. Není tak hravý jako průzkumník, ale působí jistě při dlouhých přesunech v temných sektorech.',
    hangarStats: [
      { label: 'Stabilita', value: 'Velmi vysoká' },
      { label: 'Tah', value: 'Plynulý' },
      { label: 'Použití', value: 'Dlouhý dosah' },
    ],
    unlockHint: 'Odměna za dokování v Archivu Majáku.',
    accentColor: '#d8d8d8ff',
  },
]

export const STATIONS = [
  {
    id: 'guardian-dock-alpha',
    name: 'DOK STRÁŽCŮ ALFA',
    type: 'HANGÁR',
    worldPos: { x: -760, y: 260, z: -1500 },
    dockRadius: 185,
    model: '/models/stations/space-station.glb',
    color: '#00ffff',
    desc: 'Servisní uzel z dob, kdy Řád Strážců hlídal světelné trasy Majáku. V paměti stanice zůstaly konstrukční vzory starých Luceren.',
    rewardSkinId: 'keeper-scout',
  },
  {
    id: 'beacon-archive',
    name: 'ARCHIV MAJÁKU',
    type: 'ARCHIV',
    worldPos: { x: 1720, y: -180, z: -2500 },
    dockRadius: 170,
    model: '/models/stations/space-station.glb',
    color: '#ffd700',
    desc: 'Tichý archiv zachytil poslední signály před pádem Majáku. Část dat se odemkne až s rostoucím jasem Lucerny.',
    rewardSkinId: 'keeper-relic',
  },
  {
    id: 'lost-relay',
    name: 'ZTRACENÉ RELÉ',
    type: 'RELÉ',
    worldPos: { x: -2700, y: -260, z: -4100 },
    dockRadius: 160,
    model: '/models/stations/space-station.glb',
    color: '#9b30ff',
    desc: 'Relé kdysi vedlo lodě bezpečnými proudy světla. Teď pulzuje mezi signálem Majáku a šumem Anomálie.',
    rewardSkinId: null,
  },
]

export const PLANETS = [
  {
    name: 'ZEPHYR',
    color: '#b490ff',
    emissive: '#3d1a7a',
    size: 68,
    radius: 68,
    worldPos: { x: -1400, y: 600, z: -2200 },
    position: { x: -1400, y: 600, z: -2200 },
    orbitRadius: 260,
    gltfModel: ZEPHYR_MODEL_URL,
    glowColors: ['#e8c8ff', '#9b6fff'],
    glowScale: 8,
    desc: 'Obyvatelná planeta podobná Zemi, kde je možný jednoduch practise život. Zephyr nabízí vhodné podmínky pro existence, i když v minulosti došlo k menší invazi.',
    diff: '★★☆☆☆',
    diffColor: '#00aaff',
    reward: '400 CR',
    type: 'POVRCHOVÝ PRŮZKUM',
    mapIndex: 0,
    missionComponent: 'zephyr-surface',
    hasRings: false,
  },
  {
    name: 'IGNIS',
    color: '#ff5500',
    emissive: '#550800',
    size: 44,
    radius: 44,
    worldPos: { x: 3200, y: 600, z: -3800 },
    position: { x: 3200, y: 600, z: -3800 },
    orbitRadius: 210,
    gltfModel: IGNIS_MODEL_URL,
    glowColors: ['#ffaa00', '#ff2200'],
    glowScale: 10,
    desc: 'Sopečný svět pod orbitálním útokem. Strážce usedá do obranné věže na povrchu a sestřeluje lodě i bomby Stínu dřív, než prorazí planetární štít.',
    diff: '★★★☆☆',
    diffColor: '#ffaa00',
    reward: '750 CR',
    type: 'IGNIS DEFENSE',
    mapIndex: 1,
    missionComponent: 'ignis-defense',
    hasRings: false,
  },
  {
    name: 'GLACIES',
    color: '#7df9ff',
    emissive: '#003355',
    size: 52,
    radius: 52,
    worldPos: { x: -4500, y: -600, z: -2500 },
    position: { x: -4500, y: -600, z: -2500 },
    orbitRadius: 240,
    gltfModel: null,
    geomType: 'icosahedron',
    roughness: 0.15,
    metalness: 0.85,
    glowColors: ['#ffffff', '#00bbff'],
    glowScale: 7,
    desc: 'Zamrzlá pevnost pohřbená v naprosté tmě. Tři Pohlcovače Světla drží planetu v temnotě — dokud jeden po druhém nepadnou.',
    diff: '★★★★☆',
    diffColor: '#00ddff',
    reward: '1 200 CR',
    type: 'GLACIAL DRIFT',
    mapIndex: 2,
    missionComponent: 'glacies-drift',
    hasRings: false,
  },
  {
    name: 'ANOMÁLIE',
    color: '#9b30ff',
    emissive: '#2d0050',
    size: 38,
    radius: 38,
    worldPos: { x: 800, y: -600, z: -5800 },
    position: { x: 800, y: -600, z: -5800 },
    orbitRadius: 200,
    gltfModel: ANOMALY_MODEL_URL,
    glowColors: ['#ff00cc', '#6600cc'],
    glowScale: 11,
    desc: 'Zkažená kosmická trhlina. Srdce Anomálie čeká tam, kde stál Velký Maják. Obklopeno Stínem a zkázou.',
    diff: '★★★★★',
    diffColor: '#ff0055',
    reward: '2 500 CR',
    type: 'BOSS CORRIDOR',
    mapIndex: 3,
    hasRings: false,
  },
]

export const MAPS = [
  {
    name: 'Atmosféra Zephyru',
    bgColor: '#0a0820',
    fogColor: '#3311aa',
    fogNear: 30,
    fogFar: 120,
    speed: 35,
    enemyRate: 1.0,
    asteroidRate: 1.5,
    mineRate: 0.2,
    duration: 45,
  },
  {
    name: 'Rudý Kaňon',
    bgColor: '#280a0a',
    fogColor: '#662200',
    fogNear: 25,
    fogFar: 100,
    speed: 50,
    enemyRate: 2.0,
    asteroidRate: 1.5,
    mineRate: 0.8,
    duration: 45,
  },
  {
    name: 'Zamrzlý Kaňon',
    bgColor: '#020810',
    fogColor: '#001833',
    fogNear: 22,
    fogFar: 100,
    speed: 42,
    enemyRate: 1.6,
    asteroidRate: 0.8,
    mineRate: 0.5,
    duration: 45,
  },
  {
    name: 'Jádro Prázdnoty',
    bgColor: '#0f051a',
    fogColor: '#330066',
    fogNear: 20,
    fogFar: 90,
    speed: 65,
    enemyRate: 0,
    asteroidRate: 1.2,
    mineRate: 1.5,
    duration: 45,
  },
]

export const GAME_CONDITIONS = {
  MISSION_WON_ON_PLANET: 'mission-won-on-planet',
}

export function missionWonOnPlanetCondition(planetIndex) {
  return `${GAME_CONDITIONS.MISSION_WON_ON_PLANET}:${Number(planetIndex)}`
}

const LANTERN_BRIGHTNESS_MAX = 1.0
const LANTERN_BRIGHTNESS_MIN = 0.0
const LANTERN_SHARD_REWARD = 0.33

export const gameState = {
  completedPlanets: new Set(),
  conditions: new Set(),
  score: 0,
  galaxyTravel: null,
  unlockedShipSkins: new Set(SHIP_SKINS.filter((skin) => skin.unlockedByDefault).map((skin) => skin.id)),
  selectedShipSkinId: DEFAULT_SHIP_SKIN_ID,
  selectedCharacterId: DEFAULT_CHARACTER_ID,
  visitedStations: new Set(),
  lanternBrightness: LANTERN_BRIGHTNESS_MAX,
  _lanternSubscribers: new Set(),

  completeMission(planetIndex, score = 0) {
    const normalizedIndex = Number(planetIndex)
    if (!Number.isInteger(normalizedIndex) || !PLANETS[normalizedIndex]) return false

    this.completedPlanets.add(normalizedIndex)
    this.conditions.add(missionWonOnPlanetCondition(normalizedIndex))
    this.score += Number(score) || 0
    return true
  },

  isMissionWonOnPlanet(planetIndex) {
    const normalizedIndex = Number(planetIndex)
    if (!Number.isInteger(normalizedIndex) || !PLANETS[normalizedIndex]) return false

    return this.conditions.has(missionWonOnPlanetCondition(normalizedIndex))
  },

  isCompleted(planetIndex) {
    return this.isMissionWonOnPlanet(planetIndex)
  },

  hasCondition(condition, params = {}) {
    if (condition === GAME_CONDITIONS.MISSION_WON_ON_PLANET) {
      return this.isMissionWonOnPlanet(params.planetIndex)
    }
    return this.conditions.has(condition)
  },

  getWonMissionCount() {
    return this.completedPlanets.size
  },

  visitStation(stationId) {
    if (!STATIONS.some((station) => station.id === stationId)) return false
    this.visitedStations.add(stationId)
    return true
  },

  unlockShipSkin(skinId) {
    if (!SHIP_SKINS.some((skin) => skin.id === skinId)) return false
    this.unlockedShipSkins.add(skinId)
    return true
  },

  isShipSkinUnlocked(skinId) {
    return this.unlockedShipSkins.has(skinId)
  },

  selectShipSkin(skinId) {
    if (!this.isShipSkinUnlocked(skinId)) return false
    this.selectedShipSkinId = skinId
    return true
  },

  getSelectedShipSkin() {
    return SHIP_SKINS.find((skin) => skin.id === this.selectedShipSkinId) || SHIP_SKINS[0]
  },

  selectCharacter(characterId) {
    if (!CHARACTERS.some((character) => character.id === characterId)) return false
    this.selectedCharacterId = characterId
    return true
  },

  getSelectedCharacter() {
    return CHARACTERS.find((character) => character.id === this.selectedCharacterId) || CHARACTERS[0]
  },

  getLanternBrightness() {
    return this.lanternBrightness
  },

  setLanternBrightness(value) {
    const next = Math.max(LANTERN_BRIGHTNESS_MIN, Math.min(LANTERN_BRIGHTNESS_MAX, Number(value) || 0))
    if (next === this.lanternBrightness) return
    this.lanternBrightness = next
    this._notifyLanternChange()
  },

  resetLanternBrightness() {
    this.setLanternBrightness(LANTERN_BRIGHTNESS_MAX)
  },

  damageLantern(amount) {
    const dmg = Math.max(0, Number(amount) || 0)
    this.setLanternBrightness(this.lanternBrightness - dmg)
  },

  restoreLantern(amount) {
    const restore = Math.max(0, Number(amount) || 0)
    this.setLanternBrightness(this.lanternBrightness + restore)
  },

  rewardLanternShard() {
    this.restoreLantern(LANTERN_SHARD_REWARD)
  },

  isLanternDepleted() {
    return this.lanternBrightness <= LANTERN_BRIGHTNESS_MIN
  },

  subscribeToLanternBrightness(callback) {
    if (typeof callback !== 'function') return () => {}
    this._lanternSubscribers.add(callback)
    return () => this._lanternSubscribers.delete(callback)
  },

  _notifyLanternChange() {
    this._lanternSubscribers.forEach((cb) => {
      try { cb(this.lanternBrightness) } catch (err) { console.warn('[lantern] subscriber error', err) }
    })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lantern-brightness-changed', { detail: this.lanternBrightness }))
    }
  },
}

export function getPlanet(index) {
  return PLANETS[index] || PLANETS[0]
}

export function getMap(index) {
  return MAPS[index] || MAPS[0]
}
