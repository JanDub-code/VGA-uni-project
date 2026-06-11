const UI_ICONS = {
  shield: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.6-2.9 8.7-7 10c-4.1-1.3-7-5.4-7-10v-5l7-3z" />
      <path d="M9 12l2 2l4-4" />
    </svg>
  `,
  tool: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-5.8 5.8a2.1 2.1 0 0 0 3 3l5.8-5.8a4 4 0 0 0 5.4-5.4l-2.7 2.7l-3-3l2.7-2.7z" />
    </svg>
  `,
  rocket: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3-5a9 9 0 0 0 6-8a3 3 0 0 0-3-3a9 9 0 0 0-8 6a6 6 0 0 0-5 3z" />
      <path d="M7 17c-1.2.3-2.3 1.2-3 3c1.8-.7 2.7-1.8 3-3z" />
      <path d="M15 9h.01" />
    </svg>
  `,
  crosshair: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v3" />
      <path d="M12 17v3" />
      <path d="M4 12h3" />
      <path d="M17 12h3" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  `,
  bolt: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 2l-8 12h6l-1 8l9-13h-6v-7z" />
    </svg>
  `,
}

function uiIcon(name) {
  return UI_ICONS[name] || UI_ICONS.shield
}

function roleIcon(character) {
  return uiIcon(character.id === 'david' ? 'shield' : 'tool')
}

export function buildCharacterSelectShell() {
  return `
    <div id="character-select-ui" class="ui-layer hidden">
      <div class="cs-topbar">
        <div class="mm-logo">
          <img class="mm-logo-icon" src="/favicon.svg" alt="LightKeeper logo" />
          <div class="mm-logo-name">Light<span class="mm-logo-accent">Keeper</span></div>
        </div>
        <button class="mm-icon-btn" id="characterBackButton" type="button">ZPĚT</button>
      </div>

      <div class="cs-title-row">
        <div class="cs-title-line"></div>
        <h1>VYBER SVÉHO HRDINU</h1>
        <div class="cs-title-line right"></div>
      </div>

      <div class="cs-layout">
        <section class="cs-panel cs-list-panel">
          <div class="cs-panel-title">VYBER HRDINU</div>
          <div class="cs-character-list" id="characterSelectList"></div>
        </section>

        <div class="cs-stage-copy">
          <div class="cs-dots" id="characterSelectDots"></div>
        </div>

        <section class="cs-panel cs-detail-panel">
          <div class="cs-detail-head">
            <div class="cs-class-icon" id="characterClassIcon">${uiIcon('shield')}</div>
            <div>
              <div class="cs-detail-name" id="characterDetailName">DAVID</div>
              <div class="cs-detail-role" id="characterDetailRole">Pilot / Obránce</div>
            </div>
          </div>
          <div class="cs-stats" id="characterStats"></div>
          <p class="cs-desc" id="characterDesc"></p>
          <div class="cs-compass">&#10022;</div>
        </section>
      </div>

      <div class="cs-bottom">
        <button class="mm-start-btn" id="characterStartButton" type="button">
          ZAHÁJIT CESTU <span class="mm-arrow">&rarr;</span>
        </button>
      </div>
    </div>
  `
}

export function renderCharacterSelectView({ characters, selectedCharacter, onSelect }) {
  const list = document.getElementById('characterSelectList')
  const dots = document.getElementById('characterSelectDots')
  const name = document.getElementById('characterDetailName')
  const role = document.getElementById('characterDetailRole')
  const stats = document.getElementById('characterStats')
  const desc = document.getElementById('characterDesc')
  const classIcon = document.getElementById('characterClassIcon')

  if (list) {
    list.innerHTML = characters.map((character) => `
      <button
        class="cs-character-card${character.id === selectedCharacter.id ? ' selected' : ''}"
        type="button"
        data-character-id="${character.id}"
      >
        <div class="cs-card-portrait">
          <img src="${character.portraitUrl}" alt="${character.name}" />
        </div>
        <div>
          <div class="cs-card-name">${character.name}</div>
          <div class="cs-card-role">${character.role}</div>
          <div class="cs-card-icon">${roleIcon(character)}</div>
        </div>
      </button>
    `).join('')

    list.querySelectorAll('.cs-character-card').forEach((button) => {
      button.addEventListener('click', () => onSelect(button.dataset.characterId))
    })
  }

  if (dots) {
    dots.innerHTML = characters.map((character) => `
      <div class="cs-dot${character.id === selectedCharacter.id ? ' active' : ''}"></div>
    `).join('')
  }
  if (name) name.textContent = selectedCharacter.name
  if (role) role.textContent = selectedCharacter.role
  if (desc) desc.textContent = selectedCharacter.desc
  if (classIcon) classIcon.innerHTML = roleIcon(selectedCharacter)
  if (stats) {
    stats.innerHTML = selectedCharacter.stats.map((stat, index) => `
      <div class="cs-stat-row" style="color:${stat.color}">
        <div class="cs-stat-icon">${uiIcon(index === 0 ? 'rocket' : index === 1 ? 'crosshair' : 'bolt')}</div>
        <div class="cs-stat-label">${stat.label}</div>
        <div class="cs-stat-value">${stat.value}</div>
      </div>
    `).join('')
  }
}
