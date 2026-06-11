import { buildCharacterSelectShell } from './characterSelectView.js'
import { buildMainHeroCard } from './mainHeroCard.js'
import { assetUrl } from '../services/assetPaths.js'

export function buildAppShell({ showDebugControls = false } = {}) {
  return `
  <a-scene
    id="game-scene"
    background="color: #000508"
    renderer="antialias: true; colorManagement: true; shadowMapEnabled: true; shadowMapType: pcfsoft"
    shadow="enabled: true; type: pcfsoft; autoUpdate: true"
    vr-mode-ui="enabled: false"
    device-orientation-permission-ui="enabled: false"
  ></a-scene>

  <div id="main-menu" class="ui-layer">
    <div class="mm-topbar">
      <div class="mm-logo">
        <img class="mm-logo-icon" src="${assetUrl('favicon.svg')}" alt="LightKeeper logo" />
        <div class="mm-logo-name">Light<span class="mm-logo-accent">Keeper</span></div>
      </div>
      <div class="mm-topbar-actions">
        <button class="mm-icon-btn" id="mainSettingsButton" type="button">⚙ Nastavení</button>
      </div>
    </div>

    <div class="mm-layout">
      <div class="mm-panel mm-left-panel">
        <div class="mm-panel-title">PROZKOUMAT PLANETY</div>
        <div id="mmPlanetList" class="mm-planet-list"></div>
      </div>

      <div class="mm-center-zone"></div>

      <div class="mm-panel mm-right-panel">
        <div class="mm-gem-icon">◈</div>
        <div class="mm-panel-title mm-mission-label" id="mmMissionTitle">VAŠE MISE</div>
        <p class="mm-mission-desc" id="mmMissionDesc">Hvězdný Maják kdysi osvětloval nesčetné světy a přinášel energii i život napříč galaxií. Nyní je jeho jádro rozbité.<br><br>Jako LightKeeper procestujte hvězdy, nalezněte fragmenty a obnovte světlo.</p>
        <div class="mm-compass">✦</div>
      </div>

      ${buildMainHeroCard()}
    </div>

    <div class="mm-bottom">
      <div class="mm-bottom-actions">
        <button class="mm-start-btn" id="mainStartButton" type="button">
          ZAHÁJIT CESTU <span class="mm-arrow">→</span>
        </button>
        <div class="mm-debug-actions ${showDebugControls ? '' : 'hidden'}" id="mainDebugPlanetButtons" aria-label="Debug start planet">
          <button class="mm-debug-btn" type="button" data-planet-index="0">DEBUG: ZEPHYR</button>
          <button class="mm-debug-btn" type="button" data-planet-index="1">DEBUG: IGNIS</button>
          <button class="mm-debug-btn" type="button" data-planet-index="2">DEBUG: GLACIES</button>
          <button class="mm-debug-btn" type="button" data-planet-index="3">DEBUG: ANOMALIE</button>
        </div>
      </div>
    </div>
  </div>

  ${buildCharacterSelectShell()}

  <div id="galaxy-ui" class="ui-layer">
    <div id="damage-flash"></div>

    <div id="loader">
      <div class="loader-ring"></div>
      <div class="loader-text">INICIALIZACE NAVIGACE</div>
    </div>

    <div id="top-overlay">
      <!-- LEFT: sector info -->
      <div class="cb-left">
        <div class="sector-label">SEKTOR: AURORA-7</div>
        <div class="cb-heading" id="cb-heading">HDG 000°</div>
      </div>

      <!-- CENTRE: compass bar track -->
      <div class="cb-track-wrap">
        <div class="cb-track" id="cb-track">
          <!-- tick marks injected by CSS, planet markers injected by JS -->
          <div class="cb-ticks" aria-hidden="true">
            <span class="cb-tick major" style="left:0%">N</span>
            <span class="cb-tick" style="left:12.5%">NE</span>
            <span class="cb-tick major" style="left:25%">E</span>
            <span class="cb-tick" style="left:37.5%">SE</span>
            <span class="cb-tick major" style="left:50%">S</span>
            <span class="cb-tick" style="left:62.5%">SW</span>
            <span class="cb-tick major" style="left:75%">W</span>
            <span class="cb-tick" style="left:87.5%">NW</span>
          </div>
          <!-- planet markers built dynamically -->
          <div id="compass-markers"></div>
        </div>
        <!-- centre reticle -->
        <div class="cb-reticle" aria-hidden="true"></div>
      </div>

      <!-- RIGHT: nav-lock target card -->
      <div id="target-card">
        <div class="target-kicker">NAV LOCK</div>
        <div class="target-name" id="target-name">—</div>
        <div class="target-meta">
          <span id="target-status">Hledání</span>
          <span id="target-bearing">—</span>
        </div>
        <div class="target-bar">
          <div class="target-bar-fill" id="target-bar-fill"></div>
        </div>
      </div>
    </div>

    <div id="hud">
      <div class="hud-panel" id="hud-tl">
        <div class="hud-label">Rychlost</div>
        <div class="hud-value" id="speed-val">0</div>
        <div class="speed-bar-wrap">
          <div class="speed-bar-fill" id="speed-bar"></div>
        </div>
      </div>
      <div class="hud-panel" id="hud-tr">
        <div class="hud-label">Nejbližší planeta</div>
        <div class="hud-value" id="nearest-name">—</div>
        <div id="nearest-dist" class="hud-subvalue">—</div>
      </div>
    </div>

    <div id="approach-indicator">
      <span id="approach-text">ORBIT DOSAŽENA – PŘISTÁNÍ POVOLENO</span>
    </div>

    <div id="mission-panel">
      <div class="mp-planet-indicator">
        <div class="mp-planet-dot" id="mp-dot"></div>
        <div class="mp-orbit-badge" id="mp-status-badge">▸ MISE NESPLNĚNA</div>
      </div>
      <div class="mp-title" id="mp-title">PLANETA X</div>
      <p class="mp-desc" id="mp-desc">Popis mise bude zobrazen zde.</p>
      <div class="mp-stats" id="mp-stats"></div>
      <button class="launch-btn" id="launch-btn" type="button">⟶ ZAHÁJIT MISI</button>
    </div>

    <div id="station-panel">
      <div class="mp-planet-indicator">
        <div class="mp-planet-dot station-dot" id="sp-dot"></div>
        <div class="mp-orbit-badge station-open" id="sp-status-badge">DOKOVÁNÍ DOSTUPNÉ</div>
      </div>
      <div class="mp-title" id="sp-title">STANICE</div>
      <p class="mp-desc" id="sp-desc">Popis stanice bude zobrazen zde.</p>
      <div class="mp-stats" id="sp-stats"></div>
      <button class="launch-btn" id="dock-btn" type="button">PŘISTÁT</button>
    </div>

    <div id="hangar-panel" class="hidden" aria-modal="true" role="dialog">
      <div class="hangar-topbar">
        <div class="mm-logo">
          <img class="mm-logo-icon" src="${assetUrl('favicon.svg')}" alt="LightKeeper logo" />
          <div class="mm-logo-name">Hangár <span class="mm-logo-accent">Lucerny</span></div>
        </div>
        <button class="mm-icon-btn hangar-close" id="hangar-close-btn" type="button" aria-label="Zavřít hangár">ZAVŘÍT</button>
      </div>

      <div class="hangar-layout">
        <div class="mm-panel hangar-left-panel">
          <div class="mm-panel-title">VÝBĚR PLÁŠTĚ LODI</div>
          <div class="hangar-skin-list" id="hangar-skin-list"></div>
        </div>

        <div class="hangar-center-zone">
          <button class="hangar-cycle-btn" id="hangar-prev-btn" type="button" aria-label="Předchozí loď">&lt;</button>
          <div class="hangar-holo-readout">
            <div class="hangar-readout-kicker">PREVIEW / LUCERNA</div>
            <div id="hangar-preview-name">LUCERNA STRÁŽCE</div>
          </div>
          <button class="hangar-cycle-btn" id="hangar-next-btn" type="button" aria-label="Další loď">&gt;</button>
        </div>

        <div class="mm-panel mm-right-panel hangar-right-panel">
          <div class="mm-gem-icon">◈</div>
          <div class="mm-panel-title mm-mission-label" id="hangar-skin-title">LUCERNA STRÁŽCE</div>
          <div class="hangar-skin-role" id="hangar-skin-role">Vyvážený hlídkový plášť</div>
          <p class="mm-mission-desc" id="hangar-skin-desc">Vyberte lodní plášť.</p>
          <div class="hangar-specs" id="hangar-skin-specs"></div>
          <div class="hangar-lock-note" id="hangar-lock-note"></div>
          <div class="hangar-status" id="hangar-skin-status">AKTIVNÍ</div>
        </div>
      </div>

      <div class="hangar-bottom">
        <button class="mm-start-btn hangar-select-main-btn" id="hangar-select-btn" type="button">VYBRAT</button>
        <button class="mm-start-btn hangar-return-btn" id="hangar-return-btn" type="button">ZPĚT DO VESMÍRU</button>
      </div>
    </div>

    <div id="galaxy-mobile-controls" class="mobile-controls">
      <div class="joystick-base" id="galaxyJoystickBase">
        <div class="joystick-knob" id="galaxyJoystickKnob"></div>
      </div>
    </div>

    <div id="controls-hint">
      <span class="ch-key">A D</span> / <span class="ch-key">← →</span> otáčení<br>
      <span class="ch-key">W S</span> / <span class="ch-key">↑ ↓</span> výška<br>
      <span class="ch-key">SHIFT / CTRL</span> vpřed / vzad<br>
      <span class="ch-key">SPACE</span> brzda / stop<br>
      <span class="ch-key">ESC</span> zavřít panel
    </div>

    <div class="orbit-reached-fx" id="orbit-fx"></div>
  </div>

  <div id="mission-ui" class="ui-layer hidden">
    <div class="damage-flash" id="damageFlash"></div>

    <div id="mission-hud">
      <div class="hud-panel" id="hud-top-left">
        <div class="hud-label">Skóre</div>
        <div class="hud-value" id="scoreDisplay">0</div>
      </div>

      <div class="hud-panel" id="hud-top-right">
        <div class="hud-label">Životy</div>
        <div class="hearts" id="heartsDisplay">
          <div class="heart"></div>
          <div class="heart"></div>
          <div class="heart"></div>
        </div>
      </div>

      <div class="hud-panel" id="hud-bottom">
        <div class="progress-heat-row">
          <div class="powerup-row small">
            <div class="powerup-slot" id="shieldSlot"><div class="powerup-icon shield-icon">◐</div></div>
            <div class="powerup-slot" id="rapidSlot"><div class="powerup-icon rapid-icon">⚡</div></div>
            <div class="powerup-slot" id="scoreSlot"><div class="powerup-icon score-icon">★</div></div>
          </div>

          <div class="progress-wrap">
            <div class="hud-label">Mapa</div>
            <div class="mission-map-name" id="mapName">Modrá Mlhovina</div>
            <div class="progress-bar">
              <div class="progress-fill" id="mapProgress"></div>
            </div>
          </div>

          <div class="heat-wrap">
            <div class="hud-label">Tepelné jádro</div>
            <div class="heat-bar" id="ignisHeatBar"><div class="heat-fill" id="ignisHeatFill"></div></div>
            <div class="overheat-text hidden" id="ignisOverheatText">PŘEHŘÁTÍ</div>
          </div>
        </div>
      </div>

      <div id="boss-hud">
        <div class="boss-name" id="bossName">MINI-BOSS</div>
        <div class="boss-hp-bar">
          <div class="boss-hp-fill" id="bossHpFill"></div>
        </div>
      </div>
    </div>

    <div id="mission-mobile-controls" class="mobile-controls">
      <div class="joystick-base" id="missionJoystickBase">
        <div class="joystick-knob" id="missionJoystickKnob"></div>
      </div>
      <div class="fire-button" id="fireButton">●</div>
    </div>

    <div class="overlay" id="startMenu">
      <div class="menu-panel">
        <h1>CORRIDOR RUN</h1>
        <div class="subtitle">3D SPACE INVADERS</div>

        <button class="menu-button" id="startButton" type="button">START</button>
        <button class="menu-button map-button" id="startBackButton" type="button">GALAKTICKÁ MAPA</button>

        <div class="controls-info">
          <div class="controls-title">OVLÁDÁNÍ</div>
          <div class="controls-grid">
            <span class="key">LS / D-PAD</span><span>Hýbání / míření</span>
            <span class="key">A</span><span>Palba / potvrdit</span>
            <span class="key">R3</span><span>Pauza</span>
            <span class="key">LB / RB</span><span>Brzda</span>
          </div>
          <div class="controls-note">
            Přežij 3 vlny, poraz bosse a získej nejvyšší skóre!<br>
            Sbírej power-upy: Štít (modrý), Rapid Fire (červený), 2x Skóre (zlatý)
          </div>
        </div>
      </div>
    </div>

    <div class="overlay hidden" id="pauseMenu">
      <div class="menu-panel">
        <h1 class="small-title">PAUZA</h1>
        <button class="menu-button" id="resumeButton" type="button">POKRAČOVAT</button>
        <button class="menu-button" id="restartButton" type="button">RESTART</button>
        <button class="menu-button" id="quitButton" type="button">UKONČIT</button>
      </div>
    </div>

    <div class="overlay hidden" id="gameOverMenu">
      <div class="menu-panel">
        <h1 class="small-title game-over-title">KONEC HRY</h1>
        <div class="result-block">
          <div class="hud-label">FINÁLNÍ SKÓRE</div>
          <div class="final-score" id="finalScore">0</div>
        </div>
        <button class="menu-button" id="retryButton" type="button">ZKUSIT ZNOVU</button>
        <button class="menu-button danger-button" id="gameOverMapButton" type="button">ZPĚT NA MAPU</button>
        <button class="menu-button" id="mainMenuButton" type="button">HLAVNÍ MENU</button>
      </div>
    </div>

    <div class="overlay hidden" id="victoryMenu">
      <div class="menu-panel">
        <h1 class="small-title victory-title">VÍTĚZSTVÍ!</h1>
        <div class="victory-copy">Porazil jsi Jádro Prázdnoty!</div>
        <div class="result-block">
          <div class="hud-label">FINÁLNÍ SKÓRE</div>
          <div class="victory-score" id="victoryScore">0</div>
        </div>
        <button class="menu-button" id="victoryRetryButton" type="button">HRÁT ZNOVU</button>
        <button class="menu-button map-button" id="victoryMapButton" type="button">ULOŽIT A NA MAPU</button>
      </div>
    </div>
  </div>

  <div id="system-menu" class="hidden" aria-modal="true" role="dialog">
    <div class="system-menu-panel">
      <div class="system-menu-header">
        <div>
          <div class="system-kicker">SYS / MENU PILOTA</div>
          <h2>MENU PILOTA</h2>
        </div>
        <button class="system-icon-button" id="systemCloseButton" type="button" aria-label="Zavrit menu">X</button>
      </div>

      <div class="system-menu-body">
        <nav class="system-menu-nav" aria-label="Menu pilota">
          <button class="system-nav-button active" type="button" data-system-section="controls">OVLÁDÁNÍ</button>
          <button class="system-nav-button" id="systemSettingsButton" type="button" data-system-section="settings">NASTAVENÍ</button>
          <button class="system-nav-button" id="systemHomeButton" type="button">HLAVNÍ MENU</button>
          <button class="system-nav-button" id="systemReturnMapButton" type="button">MAPA</button>
        </nav>

        <div class="system-menu-content">
          <section class="system-content-panel controller-window" id="systemControlsPanel" aria-label="Prehled ovladani">
            <div class="controller-window-topline">
              <span>OVLADANI / GAMEPAD + KLAVESNICE</span>
              <span class="paired-badge">AKTIVNI</span>
            </div>

            <div class="control-mode-switch" role="tablist" aria-label="Typ ovladani">
              <button class="control-mode-button active" id="controlGamepadTab" type="button" data-control-mode="gamepad" role="tab" aria-selected="true" aria-controls="controlGamepadPanel">GAMEPAD</button>
              <button class="control-mode-button" id="controlKeyboardTab" type="button" data-control-mode="keyboard" role="tab" aria-selected="false" aria-controls="controlKeyboardPanel">KLAVESNICE</button>
            </div>

            <div class="control-mode-panel active" id="controlGamepadPanel" role="tabpanel" aria-labelledby="controlGamepadTab">
              <div class="controller-layout">
                <div class="controller-bindings left">
                  <div class="binding-row combat"><span>LB</span><strong>Brzda / L1</strong></div>
                  <div class="binding-row combat"><span>RB</span><strong>Brzda / R1</strong></div>
                  <div class="binding-row nav"><span>D-UP</span><strong>Nahoru</strong></div>
                  <div class="binding-row nav"><span>D-R</span><strong>Další volba</strong></div>
                  <div class="binding-row nav"><span>D-L</span><strong>Předchozí volba</strong></div>
                  <div class="binding-row nav"><span>D-DN</span><strong>Dolů</strong></div>
                </div>

                <div class="controller-diagram" aria-hidden="true">
                  <img src="${assetUrl('img/gamepad-lowpoly.png')}" alt="gamepad" class="controller-img" />
                </div>

                <div class="controller-bindings right">
                  <div class="binding-row combat"><span>A</span><strong>Palba / potvrdit</strong></div>
                  <div class="binding-row combat"><span>8BitDo</span><strong>Pauza</strong></div>
                  <div class="binding-row nav"><span>+</span><strong>Plus / zpět z menu</strong></div>
                  <div class="binding-row nav"><span>-</span><strong>Minus / volba</strong></div>
                  <div class="binding-row nav"><span>L3</span><strong>Stisk levého sticku</strong></div>
                  <div class="binding-row nav"><span>R3</span><strong>Stisk pravého sticku</strong></div>
                </div>
              </div>

              <div class="controller-lower-row">
                <div class="binding-row nav"><span>LS</span><strong>Pohyb / naklon</strong></div>
                <div class="binding-row combat"><span>RS</span><strong>Miri podle smeru lodi</strong></div>
              </div>
            </div>

            <div class="control-mode-panel" id="controlKeyboardPanel" role="tabpanel" aria-labelledby="controlKeyboardTab" hidden>
              <div class="keyboard-layout" aria-label="Prehled klavesnice">
                <div class="keyboard-group">
                  <h3>GALAXIE</h3>
                  <div class="binding-row nav"><span>WASD</span><strong>Let / zataceni</strong></div>
                  <div class="binding-row nav"><span>SHIFT</span><strong>Tah dopredu</strong></div>
                  <div class="binding-row nav"><span>CTRL</span><strong>Zpetny tah</strong></div>
                  <div class="binding-row combat"><span>SPACE</span><strong>Brzda</strong></div>
                </div>

                <div class="keyboard-group">
                  <h3>MISE</h3>
                  <div class="binding-row nav"><span>WASD</span><strong>Pohyb / mireni</strong></div>
                  <div class="binding-row nav"><span>SIPKY</span><strong>Alternativni pohyb</strong></div>
                  <div class="binding-row combat"><span>SPACE</span><strong>Strelba / boost podle mise</strong></div>
                  <div class="binding-row combat"><span>P</span><strong>Pauza mise</strong></div>
                </div>

                <div class="keyboard-group">
                  <h3>ZEPHYR</h3>
                  <div class="binding-row nav"><span>WASD</span><strong>Pohyb postavy</strong></div>
                  <div class="binding-row nav"><span>SHIFT</span><strong>Beh</strong></div>
                  <div class="binding-row combat"><span>F</span><strong>Utok / strelba</strong></div>
                  <div class="binding-row combat"><span>Q/R</span><strong>Majak / zbran</strong></div>
                </div>
              </div>
            </div>
          </section>

          <section class="system-content-panel settings-window hidden" id="systemSettingsPanel" aria-label="Nastaveni">
            <div class="controller-window-topline">
              <span>NASTAVENI / MAIN SCREEN</span>
              <span class="paired-badge">LOKALNI</span>
            </div>

            <div class="settings-toggle-row" id="systemDevModeRow">
              <div class="settings-toggle-copy">
                <strong>DEV MODE</strong>
                <span>Debug starty planet na hlavni obrazovce</span>
              </div>
              <button class="settings-switch-button" id="systemDevModeToggle" type="button" role="switch" aria-checked="${showDebugControls ? 'true' : 'false'}">
                <span class="settings-switch-track" aria-hidden="true">
                  <span class="settings-switch-thumb"></span>
                </span>
                <span class="settings-switch-state" id="systemDevModeState">${showDebugControls ? 'ZAPNUTO' : 'VYPNUTO'}</span>
              </button>
            </div>
          </section>
        </div>
      </div>

    </div>
  </div>
`
}
