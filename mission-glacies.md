# Mise 3: Glacies

**Status:** Prvni hratelna kostra implementovana
**Typ:** Glacial Drift / aréna nad ledem / zniceni vezi
**Planeta:** GLACIES
**Role v kampani:** Treti ulomek Majaku
**Cil dokumentu:** Popsat, co nova scena dela, jak se zapoji do soucasne aplikace a jak ma byt rozdelena do souboru.

## Aktualni implementace

Prvni verze je zapojena jako samostatna A-Frame komponenta `glacies-drift` ve slozce `src/scenes/glaciesDrift/`.

Hotovo:

- GLACIES uz nepouziva fallback `corridor-run`, ale vlastni `missionComponent: 'glacies-drift'`.
- `main.js` importuje novou scenu a spousti ji pri startu mise na GLACIES.
- Scena pouziva aktualne vybrany skin lodi pres `gameState.getSelectedShipSkin().modelUrl`.
- Existuje drift pohyb s velocity vektorem, treni, reverzni tah, boost a zakladni kamera nad lodi.
- Arena obsahuje ledovou plochu, praskliny, nove modely `ice_rock` a `ice_crystal*`.
- Jsou vytvorene tri Pohlcovace Svetla s modelem `darkTower.glb`.
- Je zapojen `defending_drone.glb` jako orbitujici obranny dron okolo vezi.
- Funguje zakladni strelba mysi, zasah vezi/dronu, enemy projektily, damage lodi, game over a victory po zniceni tri vezi.
- HUD obsahuje rychlost, drift, boost, cil mise, radar a input panel.

Zatim zjednodusene:

- Droni zatim hlavne hlidkuji a vizualne doplnuji vez; samostatnou agresivni AI lze dodelat v dalsi fazi.
- Kolize jsou vlastni kruhove testy, ne Ammo fyzika.
- Svetelne faze uz meni mlhu a ambient, ale finalni wow efekt po treti vezi je jeste minimalni.
- Destrukce vezi zatim jen skryje model a spusti pulse, nema vlastni rozpad/animaci.

---

## 1. Co bude minihra delat

Glacies bude samostatna planetarni minihra, ne dalsi varianta `corridor-run`. Hrac pilotuje aktualne vybranou lod nad zamrzlou arénou s minimalnim trenim. Viditelnost je zamerne omezena temnotou a ostrym kuzelem svetla z lodni Lucerny.

Hlavni cil mise:

1. Najit tri Pohlcovace Svetla.
2. Prezit obranu vezi a dronu.
3. Znicit vsechny tri veze.
4. Postupne obnovit svetlo planety.

Kazda znicena vez meni stav cele areny: ustoupi mlha, zvedne se ambientni svetlo a led ziska vice cyan odlesku. Mise konci po zniceni treti veze standardnim eventem `mission-ended`, aby se planeta oznacila jako dokoncena v `gameState`.

---

## 2. Soucasny stav aplikace

Aktualni runtime ma tyto typy misi:

- `zephyr-surface`: samostatna slozka `src/scenes/zephyrSurface/`, third-person povrchova mise.
- `ignis-defense`: jeden vetsi soubor `src/scenes/ignisDefense.js`, obranna minihra.
- `corridor-run`: obecny letovy shooter pouzivany jako fallback.

GLACIES ted nema vlastni `missionComponent`, proto v `main.js` spadne do fallbacku `corridor-run` podle `mapIndex: 2`. Nova implementace ma tento stav nahradit vlastni komponentou.

Planovane zapojeni:

- Vytvorit `src/scenes/glaciesDrift/`.
- Registrovat komponentu `glacies-drift`.
- Importovat ji v `main.js`.
- V `PLANETS[]` pro GLACIES pridat `missionComponent: 'glacies-drift'`.
- V `showMission()` pridat vetev pro `glacies-drift`, podobne jako `zephyr-surface`.

---

## 3. Navrzena struktura souboru

```text
src/scenes/glaciesDrift/
  index.js              # A-Frame registrace komponenty glacies-drift, lifecycle, orchestrace
  constants.js          # Balanc, barvy, rozmisteni vezi, fyzika, HUD texty
  utils.js              # createEntity, clamp, damp, vektorove a disposal helpery
  arenaMethods.js       # Ledova plocha, skaly, prekazky, background, spawn layout
  movementMethods.js    # Glacial Drift fyzika lodi, boost, drift, vstupy
  lightingMethods.js    # Reflektor Lucerny, mlha, ambient faze, rozsviceni planety
  towerMethods.js       # Pohlcovace Svetla: spawn, HP, aggro, utoky, destrukce
  droneMethods.js       # Obranni droni okolo vezi, aktivace svetlem, pohyb a utoky
  projectileMethods.js  # Strelba hrace, strely vezi/dronu, lifetime, kolize
  collisionMethods.js   # Kolize se skalami, odrazy, damage, hit radiusy
  hudMethods.js         # Telemetrie, radar, cil mise, input panel, victory/game-over UI
```

Volitelne pozdeji:

```text
src/scenes/glaciesDrift/
  radarMethods.js       # Pokud radar naroste a bude lepsi ho oddelit od HUDu
  audioMethods.js       # Pokud se prida samostatny hudebni/SFX flow pro Glacies
  debugMethods.js       # Debug kresleni collideru, radiusu a target markeru
```

Proc tato struktura:

- Kopiruje smer `zephyrSurface`, kde `index.js` sklada mensi method mixiny.
- Udrzuje jednu A-Frame komponentu, ale rozbije logiku do citelnych oblasti.
- Umoznuje stavet arenu postupne: nejdriv pohyb a svetlo, potom veze, potom drony a polish.

---

## 4. Hlavni komponenta

Komponenta:

```js
AFRAME.registerComponent('glacies-drift', {
  schema: {
    planetIndex: { type: 'int', default: 2 },
    autoStart: { type: 'boolean', default: true },
  },
})
```

Zodpovednosti `index.js`:

- Nacist `planet = getPlanet(this.data.planetIndex)`.
- Nacist aktualni lod pres `gameState.getSelectedShipSkin().modelUrl`.
- Vytvorit `mission-camera`.
- Vytvorit lod s `lk-ship-model`.
- Inicializovat stav mise.
- Volat metody z jednotlivych souboru.
- Posilat `mission-ended` po vitezstvi.
- Uklidit listenery, timeouty, entity, geometrie a materialy v `remove()`.

Zakladni stav:

```js
this.state = 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER'
this.towersDestroyed = 0
this.score = 0
this.shipHealth = 3
this.velocity = new THREE.Vector3()
this.shipYaw = 0
this.driftEnergy = 1
this.boostEnergy = 1
this.lightPhase = 0 // 0, 1, 2, 3 podle poctu znicenych vezi
```

---

## 5. Level struktura

Glacies je jedna arena se tremi fazemi, ne tri samostatne mapy. Faze se meni podle poctu znicenych vezi.

### Faze 0: Tma

- Stav: `0/3` vezi zniceno.
- Viditelnost je velmi nizka.
- Hrac se orientuje hlavne podle reflektoru a radaru.
- Ambientni svetlo temer nulove.
- Droni zustavaji vetsinou pasivni, dokud je nezasahne kuzel svetla nebo se hrac nedostane moc blizko.

### Faze 1: Prvni zlom

- Stav: `1/3` vezi znicena.
- Mlha ustoupi na stredni kratkou vzdalenost.
- Ambient Deep Ice Blue se zvedne priblizne na `0.2`.
- Vice viditelne praskliny v ledu.
- Dalsi veze mohou spustit agresivnejsi utoky.

### Faze 2: Led se probouzi

- Stav: `2/3` vezi zniceny.
- Ambient stoupne priblizne na `0.5`.
- Cyan odlesky jsou zretelne i mimo kuzel Lucerny.
- Droni mohou letat dal od vezi a vytvaret tlak na hrace.

### Faze 3: Obnovene svetlo

- Stav: `3/3` vezi zniceny.
- Mlha se odtahne na okraj areny.
- Arena se rozsviti cyan svetlem.
- Reflektor lodi muze ztratit dulezitost nebo se automaticky ztlumit.
- Spusti se victory flow a `mission-ended`.

---

## 6. Pohyb: Glacial Drift

Pohyb je nejdulezitejsi rozdil proti `corridor-run`. Lod neni na kolejich. Chova se jako vznasedlo na ledu.

Ovládani:

- `W`: tah dopredu podle aktualniho smeru nosu lodi.
- `S`: reverzni tah / aktivni brzda.
- `A/D`: rotace lodi kolem osy Y.
- `Shift`: drift rezim, snizi stabilizaci a treni skoro na nulu.
- `Space`: boost, kratky impulz dopredu.
- Leve tlacitko mysi: strelba.
- Gamepad: levy stick rotace/pohyb, RT strelba, shoulder/face podle existujiciho mapovani po overeni.

Dulezita pravidla:

- Rotace nemeni okamzite vektor pohybu.
- Lod muze letet bokem nebo pozpatku.
- Tazna sila postupne meni `velocity`.
- Treni je male, pri driftu jeste mensi.
- Boost prida kratky impuls a spotrebuje energii.

Orientacni fyzika:

```js
const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, shipYaw)
if (throttle > 0) velocity.addScaledVector(forward, ACCELERATION * dt)
if (reverse > 0) velocity.addScaledVector(forward, -BRAKE_FORCE * dt)
velocity.multiplyScalar(Math.exp(-friction * dt))
ship.position.addScaledVector(velocity, dt)
```

---

## 7. Svetlo a atmosféra

Scena stoji na kontrastu temnoty a presnych zdroju svetla.

### Lucerna lodi

- `THREE.SpotLight` pripojeny k lodi.
- Smeruje pred lod.
- Viditelny kuzel na ledove zemi.
- Slouzi k navigaci, odhalovani dronu a citelnosti prekazek.

### Mlha

Scena pouzije linearni nebo exponencialni fog:

- Faze 0: blizky `near/far`, skoro cerno.
- Faze 1: mlha o krok dal.
- Faze 2: citelna arena.
- Faze 3: otevrena viditelnost.

### Led

Minimalni prvni verze:

- Velka low-poly plocha nebo kruh.
- Tmavy modry material.
- Praskliny jako jednoduche svetle linie nebo mesh segmenty.
- Cyan emissive linky zapinat podle faze.

Pozdejsi polish:

- Fresnel efekt.
- Jemne odlesky reflektoru.
- Lomene ledove kry a skaly.

---

## 8. Entity

### Lod hrace

- Pouziva `lk-ship-model`.
- Model URL bere z `gameState.getSelectedShipSkin().modelUrl`.
- Ma `SpotLight`, velocity vector, health, boost energy a drift energy.

### Pohlcovac Svetla

Stacionarni vez.

Vlastnosti:

- HP.
- Aggro radius.
- Průhledný HP ukazatel nad modelem.
- Emisivni fialove prvky.
- Ukazatel aktivniho targetu v HUDu/radaru.

Chovani:

- Pasivni z dalky.
- Po priblizeni nebo zasahu aktivuje utok.
- Strili energeticke koule nebo znaci exploze na ledu.
- Po zniceni zhasne, spusti rozsviceni faze a prida score.

### Obranni droni

- Hlídkuji okolo vezi.
- Male fialove body v radaru.
- Aktivace pri zasahu Lucernou nebo pri prilis male vzdalenosti.
- Hbitější nez vez, ale nizke HP.

### Ledove bloky

- Staticke prekazky.
- Pri narazu ve vysoke rychlosti ubiraji health.
- Odrazi lod opacnym smerem podle normaly kolize.

### Energie / boost krystaly

Volitelny prvek pro druhou iteraci:

- Oranzove body v radaru.
- Doplnuji boost energy.
- Nutí hrace riskovat jizdu mimo primou trasu k vezi.

---

## 9. Souboj

Strelba:

- Leve tlacitko mysi.
- Projektil leti ve smeru nosu lodi.
- Barva projektilu: Lantern Gold `#FFD700`.
- Projektil ma omezenou zivotnost.
- Mimo svetelny kuzel muze vizualne pohasnout.

Damage:

- Zasah veze snizi HP veze.
- Zasah dronu zrani nebo znici dron.
- Zasah hrace vezovou strelou odebere health.
- Naraz do ledu/skaly pri vysoke rychlosti odebere health a odrazi lod.

Game over:

- `shipHealth <= 0`.
- Zobrazit standardni `gameOverMenu` z `mission-ui`.
- Nabidnout restart a navrat na mapu.

Victory:

- `towersDestroyed >= 3`.
- Dispatch:

```js
window.dispatchEvent(new CustomEvent('mission-ended', {
  detail: { completed: true, planetIndex: this.data.planetIndex, score: this.score },
}))
```

---

## 10. HUD

HUD bude HTML/CSS vrstva uvnitr `#mission-ui`, podobne jako Zephyr surface pridava vlastni panel.

### Levy horni panel: telemetrie

- `RYCHLOST`: absolutni velikost `velocity`.
- `DRIFT`: segmentovy progress bar.
- Pozdeji mozno pridat teplotu stabilizatoru.

### Pravy horni panel: cil mise

- Nadpis `CIL MISE`.
- Text `Znic Pohlcovace Svetla`.
- Stav `0/3 vezi zniceno`, `1/3`, `2/3`, `3/3`.
- Oranzovy indikator pri zmene stavu.

### Levy dolni panel: radar

- Stred = lod.
- Smer sipky = rotace lodi.
- Fialove body = veze a droni.
- Oranzove body = prekazky nebo energie.
- Radar je kriticky, protoze hrac nevidi daleko pred sebe.

### Pravy dolni panel: input mapa

- `W/S`: zrychlit/zpomalit.
- `A/D`: otaceni.
- `Shift`: drift.
- `Space`: boost.
- Mys/RT: strelba.
- Aktivni inputy se kratce zvyrazni.

---

## 11. Minimalni implementacni etapy

### Etapa 1: Kostra scény

- Vytvorit `src/scenes/glaciesDrift/`.
- Vytvorit `index.js`, `constants.js`, `utils.js`.
- Registrovat `glacies-drift`.
- Pridat import do `main.js`.
- Pridat `missionComponent: 'glacies-drift'` do GLACIES.
- Spustit prazdnou arenu s kamerou, lodi a tmavym pozadim.

### Etapa 2: Pohyb a kamera

- Implementovat velocity-based drift pohyb.
- Napojit klavesnici.
- Pouzit vybranou lod z `gameState`.
- Pridat follow kameru nad/pred lod.
- Overit drift, boost, brzdeni, rotaci.

### Etapa 3: Svetlo a arena

- Pridat ledovou plochu.
- Pridat SpotLight Lucerny.
- Pridat mlhu a ambient faze.
- Pridat zakladni skaly/prekazky.

### Etapa 4: Veze

- Spawn 3 vezi.
- HP a strelba.
- Destrukce veze.
- Prechod light phase `0 -> 1 -> 2 -> 3`.
- Victory po treti vezi.

### Etapa 5: HUD a radar

- Telemetrie rychlosti.
- Drift/boost segmenty.
- Cil mise.
- Radar s relativni pozici vezi a dronu.
- Input mapa.

### Etapa 6: Droni a polish

- Droni kolem vezi.
- Aktivace svetlem.
- Dalsi typy utoku.
- Vizuální destrukce vezi.
- SFX a hudba.

---

## 12. Komponenty a assety, ktere budou potreba

### Pouzit existujici

- `lk-ship-model`: model hracovy lodi.
- `gameState.getSelectedShipSkin()`: aktualne vybrany skin lodi.
- `gamepadService`: jednotne cteni gamepadu.
- `gamepadNavService`: navigace ve victory/game-over menu.
- `audioService`: zaklad pro pozdejsi hudbu/SFX.
- `mission-ui`: existujici overlay vrstva.

### Vytvorit nove v ramci scény

- `glacies-drift` A-Frame komponenta.
- Model veze `public/models/objects/darkTower.glb`.
- Model dronu `public/models/objects/defending_drone.glb`.
- Proceduralni ledova arena v `arenaMethods.js`.
- HUD DOM vytvareny v `hudMethods.js`.

### Mozne samostatne reusable komponenty pozdeji

Pokud se ukaze, ze se budou hodit i jinde:

- `lk-glacies-tower-model`
- `lk-glacies-drone-model`
- `lk-ice-crack-field`
- `lk-radar-hud`

V prvni implementaci je ale lepsi zustat uvnitr `src/scenes/glaciesDrift/`, aby se nerozsiroval globalni component folder driv, nez bude jasne, co je opravdu znovupouzitelne.

---

## 13. Konstanty pro prvni verzi

```js
export const GLACIES_COLORS = {
  cyan: '#7DF9FF',
  deepIce: '#0099CC',
  anomalyPurple: '#7B2CFF',
  lanternGold: '#FFD700',
  darkness: '#02070D',
}

export const PHYSICS = {
  acceleration: 28,
  reverseAcceleration: 18,
  turnSpeed: 2.6,
  baseFriction: 0.55,
  driftFriction: 0.08,
  maxSpeed: 58,
  boostImpulse: 32,
  boostCooldown: 0.9,
}

export const TOWER_LAYOUT = [
  { x: -95, z: -130 },
  { x: 120, z: -95 },
  { x: 20, z: 145 },
]
```

Hodnoty jsou orientacni. Pri prvnim hratelnem prototypu se doladi podle pocitu z pohybu.

---

## 14. Otevrene otazky pred implementaci

- Ma byt arena ciste top-down/izometricka jako na obrazku, nebo vic third-person za lodi?
- Ma hrac narazet do prekazek fyzikalne pres vlastni kolizni matematiku, nebo chceme pouzit Ammo az v dalsi iteraci?
- Chceme v prvni verzi hned drony, nebo nejdrive pouze veze a prostredi?
- Ma byt strelba na mysi povinna, nebo musi byt stejne pohodlna i bez mysi jen na klavesnici/gamepadu?

Navrh pro prvni prototyp: top-down follow kamera, vlastni jednoduche kruhove kolize, nejdrive pouze tri veze, drony az ve druhe iteraci.
