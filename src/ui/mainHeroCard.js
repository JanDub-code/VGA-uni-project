export function buildMainHeroCard() {
  return `
    <button class="mm-hero-panel" id="mmHeroPanel" type="button" aria-label="Vybrat hrdinu">
      <div class="mm-hero-kicker">VYBRANÝ HRDINA</div>
      <div class="mm-hero-content">
        <img class="mm-hero-portrait" id="mmHeroPortrait" src="/img/david.png" alt="Vybraný hrdina" />
        <div class="mm-hero-copy">
          <div class="mm-hero-name" id="mmHeroName">DAVID</div>
          <div class="mm-hero-role" id="mmHeroRole">Pilot / Obránce</div>
          <div class="mm-hero-action">Klikni pro výběr <span>&rarr;</span></div>
        </div>
      </div>
    </button>
  `
}

export function renderMainHeroCard(character) {
  const portrait = document.getElementById('mmHeroPortrait')
  const name = document.getElementById('mmHeroName')
  const role = document.getElementById('mmHeroRole')

  if (portrait) {
    portrait.src = character.portraitUrl
    portrait.alt = character.name
  }
  if (name) name.textContent = character.name
  if (role) role.textContent = character.role
}
