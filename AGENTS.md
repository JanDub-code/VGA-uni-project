# Lightkeeper AI Reference

## Project
- Browser 3D arcade game: Czech sci-fi flight map + planet missions (corridor shooter, tower defense, surface exploration).
- Stack: plain JS ES modules, Vite, A-Frame 1.7 CDN, Ammo.js via `aframe-physics-system`, `AFRAME.THREE`. No React/TS/npm runtime deps.
- `index.html` loads A-Frame, aframe-extras, Ammo, aframe-physics from CDNs, then `/main.js`.
- Commands: `npm run dev`, `npm run build`, `npm run preview`. Vite 8 requires Node `^20.19.0 || >=22.12.0`.

## Folder Structure
```
src/
  services/     — framework-independent JS singletons (no A-Frame dep)
  scenes/       — large A-Frame components, one per game mode
    galaxy/     — galaxy sub-controllers (hangar)
  components/   — small reusable A-Frame components + model registrations
    models/     — JS component registrations only; GLBs live in public/models/
  ui/           — HTML shell + view renderers (appShell, characterSelect, mainHeroCard)
public/         — static assets served as-is
  models/
    ships/      — Spaceship variants (spaceship.glb, spaceship-2.glb, spaceship-3.glb)
    planets/    — Planet GLBs (earth.glb, magma.glb, orbion.glb, earth-map.glb)
    stations/   — space-station.glb
    objects/    — asteroid.glb, asteroid-group.glb
    enemies/    — alien-green-spaceship.glb
    characters/ — david.glb, ivo.glb
    environments/ — planet-env.glb, platform.glb
  img/          — gamepad-lowpoly.png, david.png, ivo.png
  sounds/       — spacecraft-engine-loop.mp3, singularity_action.mp3
```

## Source Map
- `main.js`: thin state machine (~320 lines). Imports all components, wires events, owns `<a-scene>`, switches UI modes (`main`/`character`/`galaxy`/`mission`), manages `activeRoot` swaps, ship drag-rotation on main menu. No HTML template here.
- `src/ui/appShell.js`: exports `buildAppShell()` — the full `#app` HTML string injected by `main.js` on startup. Contains `#main-menu`, `#character-select-ui`, `#galaxy-ui`, `#mission-ui`, `#system-menu`. The in-game pilot menu is the visible gamepad reference panel.
- `src/ui/characterSelectView.js`: exports `buildCharacterSelectShell()` (HTML) and `renderCharacterSelectView(opts)` — renders character cards, stats, dots.
- `src/ui/mainHeroCard.js`: exports `buildMainHeroCard()` (HTML) and `renderMainHeroCard(character)` — updates selected hero panel on main menu.
- `src/scenes/menuDisplayScene.js`: exports `createMenuDisplayScene(scene)` → `{ root, shipEl }`. 3D backdrop for main-menu (camera, lights, terrain, ship pivot, starfield, background planet).
- `src/scenes/characterDisplayScene.js`: exports `createCharacterDisplayScene(scene, character)` → `{ root, characterEl }`. 3D backdrop for character select (camera, lights, starfield, terrain, platform, character model with auto-scaling).
- `style.css`: all UI/HUD/menu/mobile/responsive styles. Orbitron loaded from Google Fonts. Scoped under `#main-menu`, `#character-select-ui`, `#galaxy-ui`, `#mission-ui`.

### Services
- `src/services/gameState.js`: source of truth for `CHARACTERS` (David, Ivo), `PLANETS` (4 planets in diamond around Beacon), `MAPS` (4 map presets), `STATIONS` (3 dockable stations), `SHIP_SKINS` (3 skins). Tracks `completedPlanets`, `conditions`, `score`, `galaxyTravel` return position, `selectedCharacterId`, `selectedShipSkinId`, `visitedStations`, `unlockedShipSkins`. No persistence; reload resets.
- `src/services/audioService.js`: singleton — Web Audio gain nodes around HTML audio. Galaxy music: `/sounds/singularity_action.mp3`, ship engine: `/sounds/spacecraft-engine-loop.mp3`.
- `src/services/gamepadService.js`: singleton — `init()` once (done in `main.js`). In component tick: `gp = getPad()`, `gpState = update(this.keys, gp)`. Mutates `this.keys` with directional state, returns `{ fire, fireJustPressed, pauseJustPressed, backJustPressed, forwardThrottle, reverseThrottle }`. Left stick + D-pad hat for movement, RT/LT axes for throttle, shoulder buttons for brake. Defaults in `DEFAULT_CONFIG`/`DEFAULT_LAYOUT`. Debug via `gamepadService.debug = true`.
- `src/services/gamepadNavService.js`: singleton UI navigation with own RAF loop. Layer-stack model: `push`/`replace` on open, `remove(id)`/`pop()` on close, `clear()` on gameplay entry. Top layer receives D-pad/stick input; B0 clicks focused element, B1 calls `onBack`. `linear: true` for vertical button stacks. CSS class `gamepad-focus`.
- `src/services/motionDynamics.js`: tiny shared helpers (`springValue`, `expSmoothingFactor`) for visual motion smoothing; no A-Frame dep.

### Scenes (game modes)
- `src/scenes/galaxyTravel.js`: A-Frame component `galaxy-travel`. Free-flight galaxy map, starfield, nebulae, GLB debris with weighted random sizes + compound spin/tumbling rotation, planet orbit detection, station docking, mission panel, station panel, hangar preview, target card, compass markers, beacon (golden icosahedron + 3 rings + glow at `{0,0,-3000}`), light streams per planet (activate on mission win). Ship visual attitude uses spring-smoothed roll/pitch/yaw from velocity. `W/S` RCS vertical strafe with cyan RCS thruster animation. `remove()` saves `gameState.galaxyTravel` (worldPos/velocity/yaw/pitch) for return positioning.
- `src/scenes/galaxy/hangarController.js`: controller used by `galaxy-travel` for station hangar UI, ship-skin list, camera-attached 3D ship preview, skin selection/step/apply.
- `src/scenes/corridorRun.js`: A-Frame component `corridor-run`. 3D Space-Invaders-style mission (GLACIES, ANOMÁLIE). State machine: `MENU→PLAYING→BOSS→VICTORY` or `GAME_OVER`. Player movement/fire, spawns, GLB asteroid/enemy/boss/mine/powerup models, scoring, lives, HUD, mobile controls. Ship uses dt-smoothed movement + spring-smoothed roll/pitch/yaw from frame-to-frame velocity. `P` key / gamepad pause button toggles pause. Dispatches `mission-ended` on victory.
- `src/scenes/ignisDefense.js`: A-Frame component `ignis-defense`. IGNIS-only tower defense / 3D Space Invaders variant: fixed cannon on volcanic surface, aim on sky plane, destroy enemy formations and falling bombs before they hit the planetary shield. 4 waves. Reuses mission HUD, lives, pause/game-over/victory overlays, mobile fire button, gamepad fire. Dispatches `mission-ended` on victory.
- `src/scenes/zephyrSurface.js`: A-Frame component `zephyr-surface`. ZEPHYR-only surface exploration. Third-person character walking (WASD/arrows), animated character model with Idle/Walk clips, fitted planet surface GLB. "ZPET NA ORBITU" button dispatches `return-map`. No mission-ended dispatch (free-roam, not completable).

### Components
- `src/components/menu-starfield.js`, `menu-terrain.js`, `menu-bg-planet.js`: reusable A-Frame components for menu 3D backdrops.
- `src/components/models/lightkeeper-*.js`: registered A-Frame model components. `lightkeeper-ship.js` accepts `modelUrl` for hangar-selected ship skins, builds exhaust plumes + RCS thrusters.

## Runtime Flow

### Startup
`main.js` imports all component registrations, injects DOM via `buildAppShell()`, calls `showMainMenu()`. Main menu shows planet list, hero card, START button.

### Mode transitions
| Event | Handler | Action |
|-------|---------|--------|
| `#mainStartButton` click | — | `showGalaxy()` |
| `#mmHeroPanel` click | — | `showCharacterSelect()` |
| `#characterStartButton` click | — | `showGalaxy()` |
| `#characterBackButton` click | — | `showMainMenu()` |
| `return-map` | `showGalaxy()` | Back to galaxy from any mode |
| `return-main-menu` | `showMainMenu()` | Back to main menu from mission/game-over |
| `launch-mission` | `launchMissionWithWarp(planetIndex)` | Warp overlay → `showMission(planetIndex)` |
| `start-mission` | `showMission(planetIndex)` | Direct mission start (no warp) |
| `mission-ended` | Update `gameState.completeMission()` | Record victory |

### Galaxy mode
Creates `<a-entity data-game-root galaxy-travel>`. Free-flight with ship controls. Reaching planet orbit opens `#mission-panel`; the panel shows mission status from `gameState.isMissionWonOnPlanet(index)`. Launch button dispatches `launch-mission`. Reaching station dock range opens `#station-panel`; dock button triggers `dockStation()` → hangar flow.

### Mission mode
`showMission(planetIndex)` selects component by `planet.missionComponent`:
- `'ignis-defense'` → creates `<a-entity ignis-defense>` (IGNIS, index 1)
- `'zephyr-surface'` → creates `<a-entity zephyr-surface>` (ZEPHYR, index 0)
- else → creates `<a-entity corridor-run>` (GLACIES index 2, ANOMÁLIE index 3)

All create with `autoStart: true`. `resetMissionUi(false)` hides all menus. `activateMissionCamera()` switches to mission camera. Gameplay starts immediately.

### Mission end flows
- **Victory**: `endMission(true)` → dispatches `mission-ended` → `gameState.completeMission()` → shows `#victoryMenu`. Buttons: "HRÁT ZNOVU" (restart), "ULOŽIT A NA MAPU" (return-map).
- **Game Over**: `endMission(false)` → shows `#gameOverMenu`. Buttons: "ZKUSIT ZNOVU" (restart), "ZPĚT NA MAPU" (return-map), "HLAVNÍ MENU" (return-main-menu).
- **Pause → Quit**: `togglePause()` → `#pauseMenu`. "UKONČIT" dispatches `return-map`.
- **Restart**: `restartGame()` → `gamepadNavService.clear()` → `startGame()` (fresh state, same planet).

### Zephyr surface
Third-person walk. WASD/arrows move character. "ZPET NA ORBITU" dispatches `return-map`. No pause, no system-menu freeze, no mission-ended.

### Character select flow
Main menu hero card → `showCharacterSelect()` → `setUiMode('character')` → `characterDisplayScene`. Renders character cards, clicking selects character (updates 3D model + UI). "ZAHÁJIT CESTU" → galaxy. "ZPĚT" → main menu.

## Data Contracts
- `CHARACTERS[]`: `id`, `name`, `role`, `portraitUrl`, `modelUrl`, `accentColor`, `stats[{label,value,color}]`, `desc`. David (pilot/obránce), Ivo (inženýr/průzkumník).
- `PLANETS[]`: ZEPHYR (index 0, zephyr-surface, povrchový průzkum), IGNIS (1, ignis-defense), GLACIES (2, corridor-run), ANOMÁLIE (3, corridor-run boss). Fields: `name`, `color`, `size/radius`, `worldPos`, `orbitRadius`, `gltfModel`|`geomType`, `glowColors`, `desc`, `diff`, `type`, `mapIndex`, `missionComponent`, `hasRings`.
- `MAPS[]`: 4 difficulty presets — `name`, `bgColor`, `fogColor`/`near`/`far`, `speed`, `enemyRate`, `asteroidRate`, `mineRate`, `duration` (45s each).
- `STATIONS[]`: 3 dockable targets — DOK STRÁŽCŮ ALFA (hangár, rewardSkin: keeper-scout), ARCHIV MAJÁKU (archiv, rewardSkin: keeper-relic), ZTRACENÉ RELÉ (relé). Fields: `id`, `name`, `type`, `worldPos`, `dockRadius`, `model`, `color`, `desc`, `rewardSkinId`.
- `SHIP_SKINS[]`: 3 skins — keeper-default (unlocked), keeper-scout (station reward), keeper-relic (station reward). Fields: `id`, `name`, `modelUrl`, `desc`, `accentColor`, `unlockedByDefault`.
- `gameState.galaxyTravel`: saves current world position/velocity/yaw/pitch when leaving galaxy mode, restores on return.
- Corridor states: `MENU`, `PLAYING`, `BOSS`, `PAUSED`, `GAME_OVER`, `VICTORY`.
- Ignis defense states: `MENU`, `PLAYING`, `PAUSED`, `GAME_OVER`, `VICTORY`.
- Zephyr surface: stateless (always active).
- Galaxy coordinates are virtual `worldPos`; objects render relative to ship position (offset from camera). Preserve this model.

## Controls
- **Global**: `Esc` opens/closes the pilot menu (`system-menu-toggle` event). Active components pause/ignore input via `systemMenuOpen` flag.
- **Galaxy**: `A/D` or arrows yaw, `W/S` or arrows RCS vertical strafe (reduced authority without main thrust), `Shift` forward, `Ctrl` reverse, `Space` brake.
- **Mission (corridor/ignis)**: `WASD` or arrows move in 2D plane, hold `Space` fire, `P` pauses.
- **Zephyr surface**: `WASD` or arrows walk character (3rd person).
- **Touch**: galaxy joystick; mission joystick + fire button.
- **Gamepad**: 8BitDo Ultimate 2C Wired (D-input). Left stick/D-pad for movement, RT/LT for throttle, shoulder buttons brake, B0 fire/confirm, B1 back, Start(+) pause.

## Gamepad (8BitDo Ultimate 2C Wired)
- **Hardware**: Vendor `2dc8` / Product `301d`. D-input mode on macOS. 15 buttons (B0–B14), 10 axes (A0–A9), mapping `""`.
- **Axes**: A0=leftX, A1=leftY, A2=rightX, A3=RT (−1→+1), A4=LT (−1→+1), A5=rightY, A9=D-pad hat.
- **Buttons**: B0=A (south/fire/confirm), B1=B (east/back), B2=X, B3=Y, B4=LB (brake), B5=RB (brake), B8=Select, B9=Start (pause), B10=L3, B11=R3.
- **Gameplay mapping** (`gamepadService`): A0/A1+hat=strafe, RB/LB=brake, A3=forwardThrottle, A4=reverseThrottle, B0=fire, B9/B11= pause.
- **UI nav** (`gamepadNavService`): A0/A1 or D-pad=spatial directional nav, B0=confirm, B1=back.
- **Debug**: `gamepadService.debug = true` → logs all buttons+axes at 5 Hz. Override via `window.gamepadConfig`.

## Coding Rules
- Plain JS modules + A-Frame components. No React/TS/npm runtime.
- Register A-Frame components by importing in `main.js`.
- Use `AFRAME.THREE`/`this.THREE`; avoid npm `three`.
- Prefer Ammo via `aframe-physics-system` for real physics; keep simple arcade checks manual when clearer.
- Shared game data in `src/services/gameState.js`; UI IDs/classes aligned with `main.js`, `appShell.js`, `style.css`.
- Clean up in component `remove()`: window/document listeners, timers, spawned DOM, THREE objects, geometries/materials/textures.
- Scope CSS under mode-specific IDs (`#main-menu`, `#character-select-ui`, `#galaxy-ui`, `#mission-ui`). UI layers default `pointer-events: none`; enable only on interactive controls.
- Do not edit `dist/` directly. Do not trust README planned deps over `package.json` + source.
- Keep visible UI text Czech unless changing an explicitly English label. Preserve neon/clean low-poly sci-fi visual.
- Verification: `npm run build` after code changes; smoke-test galaxy launch, mission start, shooting, pause, victory/map return for visual/gameplay changes.

## Known Gaps
- Zephyr surface has no `system-menu-toggle` listener (Escape opens system menu but game keeps running).
- Zephyr surface does not dispatch `mission-ended` (exploration-only, no win condition).
- Corridor-run `quitToMenu()` has an unreachable `!autoStart` branch (all missions launch with `autoStart: true`).
- Corridor-run `resetMissionUi(false)` called twice in `showMission()` (redundant, harmless).
- No direct path from galaxy to main menu (must go through a mission to reach main menu).
- Corridor-run "3 mapy" UI text is aspirational — only 1 map per mission is implemented.
