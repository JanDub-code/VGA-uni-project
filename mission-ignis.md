# Mise 2: Ignis

**Status:** Hratelna samostatna minihra  
**Typ:** Orbitalni obrana / 3D Space Invaders  
**Role v kampani:** Druhy ulomek Majaku

## Zamer

Ignis uz neni dalsi corridor-run. Hrac stoji v obrane sopecne kolonie a ovlada pevnostni svetelny kanon namireny z povrchu planety do vesmiru. Nad horizontem prileta formace lodi Stinu, ktere shazuji bomby na planetarni stit.

## Herni smycka

- Mirit vezi ve 2D ploše oblohy: `A/D` nebo sipky vlevo/vpravo, `W/S` nebo sipky nahoru/dolu.
- Strilet svetelne paprsky: `SPACE`, mobilni tlacitko palby nebo gamepad fire.
- Nicit nepratelske lode pro skore.
- Sestrelovat bomby drive, nez dopadnou na povrch.
- Kazdy dopad bomby ubere jeden segment planetarniho stitu.
- Mise konci vyhrou po vycisteni vsech vln, prohrou po ztrate stitu.

## Vizuální směr

- Kamera je pevne za obrannou vezi a mira nad lávový horizont.
- Povrch ma tmave low-poly krátery, lávové průrvy a oranžovou zář.
- Nepřátelé zůstávají čisté neonové tvary, aby byli čitelní proti vesmíru.
- HUD místo power-upů ukazuje štít a postup vln.

## Barevné opory

- Ignis Orange: `#FF6B1A`
- Lava Red: `#FF3300`
- Lantern Gold: `#FFD700`
- Deep Space: `#050206`

## Implementace

- Scéna: `src/scenes/ignisDefense.js`
- Routing: `PLANETS[IGNIS].missionComponent = 'ignis-defense'`
- Výhra dispatchuje standardní `mission-ended`, takže se používá stejný progress systém jako u ostatních misí.
