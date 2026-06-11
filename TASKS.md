## Stav po auditu 2026-06-09

Posledni commity dotahly hlavne Ignis redesign, sopku/lava shader a zakladni polish. `BUGS.md` uz v repu neni, byl smazany v commitu `702eb59`; pracovni checklist je ted tady.

Priorita do zitra: sjednotit Light system v `corridorRun`, dodelat finalni Anomalii a napojit jednoduche outro.

## 1. Light system (prerekvizita pro Anomalii a outro)

Herni identita Lightkeeperu stoji na tom, ze jas = zdravi = progres. Cast uz je hotova v `gameState.js`, ale `corridorRun` stale pouziva stare zivoty.

- [x] Pridat `lanternBrightness` (0.0-1.0) do `gameState.js`
- [x] Pridat API `resetLanternBrightness`, `damageLantern`, `restoreLantern`, `isLanternDepleted`
- [x] Glacies pouziva `lanternBrightness` pro poskozeni lodi a game over
- [ ] `corridorRun` pri startu nastavi `lanternBrightness = 1.0`
- [ ] `corridorRun` pri zasahu snizi `lanternBrightness` misto `lives`
- [ ] Smrt v `corridorRun` = `lanternBrightness <= 0`
- [ ] HUD v `corridorRun` zobrazuje jas Lucerny misto srdicek, nebo aspon vedle nich
- [ ] Lod v `corridorRun` vizualne reaguje na `lanternBrightness` (emissivita/barva/intenzita svetla)

## 4. Mise 3: Glacies - veze ve tme

Glacies je funkcne rozpracovana a vetsina checklistu je hotova. Zbyva hlavne finalni polish a pripadne doladeni intenzit podle pocitu ze hry.

- [x] Mise startuje ve velmi nizkem osvetleni, hlavni zdroj svetla je lodni lucerna
- [x] Spawn 3 Pohlcovacu Svetla
- [x] Pohlcovace maji ochranu/drony a aktivni bojove chovani
- [x] Zniceni kazdeho Pohlcovace posune svetelnou fazi planety
- [x] Po zniceni vsech tri se spusti vyrazny victory/wow moment
- [x] HUD/radar ukazuje smer a stav vezi
- [ ] Zkontrolovat v playtestu, jestli startovni tma neni prilis svetla nebo prilis tmava
- [ ] Pripadne doladit zakladni osvetleni a faze podle posledniho pocitu ze hry
- [ ] Pridat/zesilit fresnel efekt na ledovych povrsich, pokud nebude stihat Anomalie/outro

## 5. Mise 4: Srdce Anomalie - finalni boss

Boss framework v `corridorRun.js` uz existuje a faze utoku jsou nacate. Ted je potreba hlavne sjednotit ho s Light systemem a udelat z nej jasne finalni set piece.

- [x] Boss stav `BOSS` v `corridorRun.js`
- [x] Boss HP, HUD a vitezstvi po zniceni
- [x] Zakladni boss strely a faze utoku
- [ ] Zasah hrace snizuje `lanternBrightness`, ne `lives`
- [ ] Faze 2/3 vizualne zvyraznit (rychlejsi/tezsi pattern je uz zakladne pritomny, potrebuje polish)
- [ ] Vytahnout vizual bosse: pulzujici fialova koule + distortion/glitch efekt
- [ ] Boss intro: kratky dramaticky nastup pri prechodu do `BOSS`
- [ ] Po vitezstvi nad Anomalii spustit outro sekvenci misto bezneho konce mise

## 6. Vizuální polish per level

- [x] Ignis: Volcano model + animovany lava shader
- [ ] Zephyr: plynovy obr nebo vyraznejsi pozadi
- [ ] Glacies: fresnel/cyan highlight na ledu
- [ ] Anomalie: distortion/glitch efekt na bossovi
- [ ] Lod: emissivita reaguje na `lanternBrightness` napric misemi

## 7. Outro sekvence

Galaxy mapa uz ma centralni majak, svetelne proudy a planety reagujici na dokoncene mise. Zbyva z toho udelat finalni rezii po porazce Anomalie.

- [ ] Po porazce Anomalie prejit do finalni galaxy map animace
- [ ] Vsechny planety se postupne rozsviti
- [ ] Centralni Majak se vyrazne zazehne
- [ ] Obrazovka "Galaxie zachranena" s celkovym skore
- [ ] Tlacitko zpet do menu / na mapu

## 8. Audio

Audio je nizsi priorita nez Light system, Anomalie a outro. Minimum do zitra je boss/victory feedback, zbytek muze byt polish.

- [ ] Boss intro zvuk/hudba pri prechodu do stavu `BOSS`
- [ ] SFX pro finalni zasah a porazku Anomalie
- [ ] SFX pro zniceni veze v Glacies zkontrolovat v playtestu
- [ ] Ambient smycka per mapa
- [ ] Hudba reaguje na `lanternBrightness` pri nizkem jasu
