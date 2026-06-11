# 🌟 Lightkeeper

> 3D arkádový simulátor letu ve webovém prohlížeči
>
> *"Galaxie usíná. Stín se valí dovnitř. Jsi poslední Strážce."*

---

## Aktuální stav implementace

- Runtime stack v tomto repozitáři: **A-Frame 1.7 (CDN) + plain JavaScript (ES moduly) + Vite**.
- Aktuální aplikace nepoužívá TypeScript build ani samostatný npm runtime `three`.
- Část README níže popisuje cílovou/aspirační architekturu; pro reálný stav kódu ber jako zdroj pravdy `package.json` + `src/`.

---

## 📋 Obsah

- [O aplikaci](#-o-aplikaci)
- [Příběh a svět](#-příběh-a-svět)
- [Herní mechaniky](#-herní-mechaniky)
- [Levely](#-levely)
- [Vizuální styl](#-vizuální-styl)
- [Technologický stack](#-technologický-stack)
- [Klíčové technické prvky](#-klíčové-technické-prvky)
- [Ovládání](#-ovládání)
- [Audio a hudba](#-audio-a-hudba)
- [Nápady na rozšíření](#-nápady-na-rozšíření)
- [Struktura projektu](#-struktura-projektu)
- [Zdroje a nástroje](#-zdroje-a-nástroje)

---

## 🎮 O aplikaci

**Lightkeeper** je 3D arkádový simulátor letu běžící přímo v prohlížeči. Hráč prolétá vesmírem na malé obratné lodi, navštěvuje čtyři stylizované planety a plní na každé z nich unikátní herní úkol — let skrz prstence, sběr krystalů, boj proti věžím, finální souboj s bossem.

| | |
|---|---|
| **Typ hry** | 3D arkádový flight simulator |
| **Platforma** | Web (prohlížeč, desktop primárně) |
| **Hlavní technologie** | A-Frame 1.7 (CDN) + plain JavaScript (ES moduly) |
| **Vizuální styl** | Clean Sci-Fi / Low-Poly / Neon |
| **Primární vstup** | 8BitDo Ultimate 2C Wired controller + klávesnice |

---

## 📖 Příběh a svět

Ve středu galaxie po **deset tisíc let** zářil **Velký Maják** — kolosální umělé slunce, postavené dávnou civilizací, jejíž jméno už nikdo nezná. Jeho světlo udržovalo bezpečné cesty mezi hvězdami, pohánělo lodě v okrajových sektorech a drželo v šachu **Stín na hranicích galaxie**.

Po staletí nad Majákem bděl řád **Strážců** — pilotů, jejichž **Lucerny** nesly drobné jiskry jeho světla.

Pak přišla **Anomálie**. Vynořila se z hloubky vesmíru, kam Majákovo světlo nikdy nedosáhlo. Zaútočila na jádro Majáku a roztříštila ho na úlomky čisté energie, které se rozprchly napříč galaxií. Strážci padli jeden po druhém, jak se snažili úlomky nalézt.

Galaxie usíná. Stín se valí dovnitř.

Jsi **poslední Strážce**. Tvá Lucerna je téměř prázdná. Najdi úlomky. Znovu zažehni Maják. Postav se Anomálii.

### Klíčové entity

| Entita | Význam |
|---|---|
| **Velký Maják** | Kolosální umělé slunce ve středu galaxie. Dávný artefakt zaniklé civilizace. Roztříštěn Anomálií. |
| **Strážce** *(Lightkeeper)* | Hráč. Poslední z dávného řádu pilotů, kteří bděli nad Majákem. |
| **Lucerna** | Loď Strážce. Malá, obratná. Její jádro nese drobnou jiskru ze Světla Majáku. S každým nasbíraným úlomkem září silněji. |
| **Úlomky** | Roztříštěné kusy jádra Majáku. Každý dopadl na jinou planetu. Cíl mise. |
| **Anomálie** | Neznámá entita z hluboké tmy. Antagonista. |
| **Stín** | Temnota, která se rozlévá galaxií, jak Majákovo světlo slábne. Manifestace Anomálie. |

---

## 🕹 Herní mechaniky

### Let ve 3D prostoru
Loď se pohybuje v plném 3D prostoru s plynulou fyzikou. Rotace přes pitch, yaw a roll (kniplování), akcelerace dopředu, brzdění. Inerce — rychlost se nemění skokově.

### Sběr úlomků
Každá planeta obsahuje úlomky Majáku. Úlomky mohou být rozptýlené (Ignis), ukryté za překážkami (Glacies) nebo získatelné skrze průlet checkpointy (Zephyr).

### Střelba
Lucerna má palubní zbraň — **paprsky Světla**. Používají se pro ničení nepřátel (stínové drony na Ignisu, věže na Glaciesu) a proti bossovi.

### Light system (hlavní designový prvek)
Jas Lucerny roste s počtem nasbíraných úlomků. Funguje zároveň jako:
- **Progress bar** — hráč vizuálně vidí, kolik už má
- **Health bar** — zásahy jas ubírají
- **Tematická ozvěna** — úlomky = Světlo, takže sbírání je i obnova Lucerny

### Dynamický svět
Levely se postupně mění podle akcí hráče:
- **Glacies** začíná v temnotě. Každá zničená věž část planety rozsvítí.
- **Finále** končí zážehnutím Majáku — celá galaxie v outro scéně se rozzáří.
- **Hudba** reaguje na stav světa (tlumená v intru → plnější s každým úlomkem).

---

## 🪐 Levely

### 🪐 Level 1 — Zephyr (Obyvatelná planeta)

**Latinsky:** *zephyrus* = západní vítr, jemný vánek

**Lore:** První úlomek dopadl na obyvatelnou planetu Zephyr, svět podobný Zemi, kde je možný jednoduchý život. Jeho energie se rozptýlila do **světelných prstenců** v oku obrovského hurikánu. Strážce musí prstenci proletět, aby energii sesbíral zpět do Lucerny.

**Mechanika:** Let na čas skrz urychlovací prstence (checkpointy). Každý průlet vrátí část záře úlomku do Lucerny.

**Vizuál:** Pastelové barvy plynného obra (světle modrá, růžová, fialová), pohybující se vrstvy mraků, chromatic aberration při zrychlení.

---

### 🌋 Level 2 — Ignis (Vulkanická kolonie)

**Latinsky:** *ignis* = oheň

**Lore:** Druhý úlomek dopadl na sopečnou planetu Ignis a roztříštil se na **světelné krystaly** zapadlé mezi rozžhavenými krátery. Místní těžební drony — kdysi obyčejné stroje, teď nakažené Stínem — pokládají krystaly za poklad a brutálně je střeží.

**Mechanika:** Sběr krystalů + vyhýbání/ničení stínových dronů. Krystaly **doslova svítí** v temných slujích — slouží jako majáčky v krajině.

**Vizuál:** Dramatický kontrast — temná sopečná krajina, oranžová animovaná láva, bílo-zlaté zářící krystaly, emisivní bloom.

---

### ❄️ Level 3 — Glacies (Zamrzlá pevnost)

**Latinsky:** *glacies* = led

**Lore:** Třetí úlomek je zamrzlý hluboko pod ledem. Stín kolem něj postavil tři **Pohlcovače Světla** — temné věže, které aktivně **vysávají záři** ze všeho v okolí. Dokud stojí, planeta je v naprosté tmě.

**Mechanika:** Najdi a znič tři Pohlcovače ve zmrzlých kaňonech. Pozor — palbu opětují. Hra začíná v děsivé tmě (jen reflektor Lucerny). Každý zničený Pohlcovač **postupně rozsvítí planetu** — barvy se vrací, led začne lesknout.

**Vizuál:** Klíčový "wow moment" hry — zničíš poslední věž a planeta se rozzáří. Fresnel efekty na ledu, dynamický ambient.

---

### 🖤 Level 4 — Srdce Anomálie (Final boss)

**Lore:** S kompletní Lucernou plnou úlomků se Strážce vrací do středu galaxie. Tam, kde dříve zářil Velký Maják, teď rotuje **Srdce Anomálie** — temná pulzující entita, zhmotnění Stínu v místě, kde stál Maják.

**Mechanika:** Boss fight v naprosté tmě. Strážce září jako jediný zdroj světla v aréně. Anomálie se ho snaží **zhasnout** — každý zásah ti ubere jas. Když máš málo energie, jsi téměř neviditelný.

Po vítězství tvá Lucerna **uvolní všechny úlomky**, ty splynou v prostoru, kde stál Maják — a **Velký Maják se znovu zažehne**. Galaxie se rozzáří.

**Vizuál:** Nejtemnější část hry → nejjasnější finále. Distortion shader, chromatic aberration, vícefázový boss.

---

## 🎨 Vizuální styl

**Aestetika:** Clean Sci-Fi / Low-Poly — hladké tvary, **žádné** drsné, špinavé sci-fi. Neonová paleta a přátelský vizuál.

- **Modely:** low-poly primitiva nebo jednoduché `.glb` modely, flat materiály bez složitých textur. Důraz na osvětlení v shaderu.
- **Prostředí:** zakřivená `Sphere` pod lodí (efekt Malého prince) nebo rovina s procedurálně generovanou texturou.
- **Svícení:** Phongův model + emisivní materiály pro neonové prvky + **bloom postprocessing**.
- **Klíčový motiv:** kontrast Světla a Stínu. Temné levely se s každým úlomkem postupně rozsvěcují.

### Color palette

| Barva | Hex | Použití |
|---|---|---|
| **Lantern Gold** | `#FFD700` / `#FFF4B0` | Záře Lucerny, paprsky Světla, Maják |
| **Zephyr Pink** | `#FF6FB5` | Plynný obr, atmosféra |
| **Ignis Orange** | `#FF6B1A` / `#FF3300` | Láva, Ignis emisivní |
| **Glacies Cyan** | `#7DF9FF` / `#0099CC` | Led, Glacies |
| **Anomaly Purple** | `#9B30FF` / `#4B0082` | Anomálie, Stín |
| **Deep Space** | `#0A0A1F` | Pozadí, vesmír |

### Typografie

- **Headings / Logo:** Orbitron — futuristický, hranatý
- **Body / HUD:** Rajdhani nebo Exo 2 — čitelný, sci-fi feel

---

## 🛠 Technologický stack

### Jádro

| Technologie | Verze | Role |
|---|---|---|
| **Three.js** | r160+ | WebGL 2 renderer, scene graph, GLTF loader |
| **TypeScript** | 5.x | Typová bezpečnost |
| **Vite** | 5.x | Build tool, dev server s HMR shaderů |

### Renderování a efekty

| Knihovna | Role |
|---|---|
| **`postprocessing`** (Vanruesc) | Bloom, chromatic aberration, vignette, noise |
| **GSAP** | Animace kamery, UI, boss patterny, postupné rozsvěcování |

### Audio

| Knihovna | Role |
|---|---|
| **howler.js** | 2D hudba, UI zvuky, cross-fade mezi tracky |
| **Three.js PositionalAudio** | 3D spatial SFX (motory dronů, lasery) |

### Vstupy

| Technologie | Role |
|---|---|
| **Web Gamepad API** (nativní) | 8BitDo Ultimate 2C — X-Input mode, bez driverů |
| **Keyboard Events** (nativní) | WASD, Shift, Space fallback |

### State a utility

| Knihovna | Role |
|---|---|
| **Zustand** | Globální herní stav (úlomky, jas Lucerny, level progress) |
| **lil-gui** | Debug panel (vývojový režim) |
| **Stats.js** | FPS counter (vývojový režim) |

### Proč Three.js a ne raw WebGL

Three.js poskytuje scene graph, render loop, GLTF loader a `ShaderMaterial` wrapper — infrastrukturu, která nepřidává žádnou herní logiku, ale šetří týdny práce. Vlastní kód se soustředí na **herní prvky**: flight model, kameru, kolize, shadery, AI.

### Proč Three.js a ne Babylon.js

- Menší bundle (~150 KB vs. ~1 MB)
- Větší komunita a příklady
- Méně "game engine magic" — explicit je lepší pro náš case

**Velikost bundle:** cca 250–300 kB gzipped.

---

## ⚙️ Klíčové technické prvky

### 1. Transformace lodi
- Rotace přes **quaterniony** (`THREE.Quaternion`) — pitch, yaw, roll
- Forward vektor z quaternionu pro pohyb: `forward = quaternion.applyToVector3(0,0,-1)`
- Banking — při zatáčení se loď nakloní
- Inerce

### 2. Chase Camera
Vlastní třída (ne `OrbitControls`). Obsahuje:
- Damping (lerp pozice i rotace) pro plynulý pohyb
- Collision avoidance
- Volitelně FPV/cockpit pohled

### 3. Kolize
- **Bounding Spheres** (sphere-sphere, ray-sphere)
- Broad-phase přes spatial hash grid pro výkon s mnoha objekty
- Trigger zóny pro checkpointy a sběr úlomků

### 4. Shadery (GLSL)
Vlastní fragment a vertex shadery pro specifické efekty:

- `beacon.frag` — Velký Maják, pulzující koule s emisivním jádrem a runovými prstenci (intro/outro)
- `lantern.frag` — záře Lucerny, intenzita podle počtu úlomků
- `lava.frag` — animovaná láva přes `u_time`, noise, gradient (Ignis)
- `ice.frag` — fresnel efekt, lesklý povrch (Glacies)
- `gasGiant.frag` — vrstvené animované pruhy atmosféry (Zephyr)
- `shield.frag` — hexagonální pattern + fresnel (boss štít)
- `anomaly.frag` — distortion, chromatic aberration ve fragmentu (finální boss)
- `shadow.frag` — temná amorfní masa pro Stínové entity

### 5. Postprocessing pipeline
- **Bloom** — reaguje na jas Lucerny přes uniform
- **Chromatic aberration** — sílí při zrychlení
- **Vignette** — filmový look
- **Film grain** — maskuje low-poly hrany

### 6. Light as gameplay
Klíčová designová myšlenka — světlo je **gameplay element**, ne jen estetika:

| Prvek | Jak se mění |
|---|---|
| Hra startuje v polotmě | Galaxie hasne |
| Lucerna září silněji s úlomky | Uniform `u_lanternBrightness` |
| Health = jas | Žádný health bar, vidíš to na lodi |
| Lasery = paprsky Světla | Žluto-bílé, bloom |
| Levely se rozjasňují | Glacies: zničení věží. Finále: zažehnutí Majáku. |
| Hudba | Temná v intru → plnější s úlomky |

---

## 🎮 Ovládání

### Primární: 8BitDo Ultimate 2C Wired

Ovladač má **X-Input / D-Input mód** a v prohlížeči se hlásí jako standardní gamepad přes Web Gamepad API — žádné drivery, žádné knihovny třetích stran. Mapping `"standard"` garantuje konzistentní indexy.

**Využité vlastnosti:**
- **Hall effect analogové sticky** — plynulý pitch/yaw bez driftu
- **Hall effect triggery (L2/R2)** — analogový throttle (čím víc stisknu, tím rychleji letím)
- **1000 Hz polling** — nízká latence
- **Rumble** přes Gamepad API → haptická odezva při nárazech, sběru, střelbě

**Mapování:**

| Akce | Tlačítko (Xbox layout) | Gamepad API index |
|---|---|---|
| Pitch / Yaw | Levý stick | `axes[0]`, `axes[1]` |
| Roll | Pravý stick X | `axes[2]` |
| Throttle vpřed | RT (R2) | `buttons[7].value` |
| Brzda | LT (L2) | `buttons[6].value` |
| Střelba | A | `buttons[0]` |
| Boost | RB (R1) | `buttons[5]` |
| Přepnout kameru | Y | `buttons[3]` |
| Pauza | Start | `buttons[9]` |
| Landing / Interact | X | `buttons[2]` |

**Implementace:**
- Pollování `navigator.getGamepads()` každý frame v game loopu
- Dead zone na levém sticku (cca 0.15)
- Zpracování analogových triggerů přes `.value` (0.0–1.0)
- Detekce připojení přes `gamepadconnected` / `gamepaddisconnected` eventy

### Sekundární: Klávesnice + myš

| Akce | Klávesa |
|---|---|
| Pitch / Yaw | WASD nebo myš |
| Roll | Q / E |
| Throttle | Shift |
| Brzda | Ctrl |
| Střelba | Space / LMB |
| Boost | levý Shift (double-tap) |
| Přepnout kameru | C |
| Pauza | Esc |
| Landing / Interact | F |

### Architektura vstupu

Interní `InputManager` sjednocuje oba typy vstupů do jediného `InputState`:

```ts
interface InputState {
  pitch: number;      // -1 to 1
  yaw: number;        // -1 to 1
  roll: number;       // -1 to 1
  throttle: number;   // 0 to 1
  brake: number;      // 0 to 1
  fire: boolean;
  boost: boolean;
}
```

Herní logika čte jen tento stav — nezajímá ji, odkud data přišla.

---

## 🎵 Audio a hudba

### Hudba per level (tematická)

Každá planeta má **vlastní hudební téma** zrcadlící atmosféru. Hudba se **mění podle stavu světla** — temný level začíná tlumeně, s každým úlomkem se přidávají harmonie.

| Level | Hudební styl |
|---|---|
| **Menu / Intro** | Ambientní synthwave, pomalý pulz jako tlukoucí, hroucené srdce Majáku |
| **Zephyr** | Dreamy ambient, pady, jemná arpeggia, vítr |
| **Ignis** | Rytmický dark synthwave, industrial perkuse |
| **Glacies** | Minimalistický ambient, crystal pady, postupně se rozjasňující |
| **Anomálie** | Orchestrální + glitchy synth, build-up, triumphální outro |
| **Outro** | Triumph, plný orchestrální chorál, světlé tóny |

### 3D spatial audio (SFX)

| Zvuk | Typ |
|---|---|
| Motor Lucerny | Looping, volume podle throttle |
| Laser výstřel | One-shot |
| Exploze | One-shot, lowpass filtr podle vzdálenosti |
| Stínový dron | Looping, positional, šepot/syčení |
| Sběr úlomku | Harmonický akord stoupající podle čísla úlomku |
| Checkpoint průlet | Pitch shift nahoru |
| Zhasnutí Pohlcovače | "Rozsvěcovací" zvuk |
| Boss breathing / hum | Looping, low frequency |
| UI clicks | 2D (bez pozice) |

### Mixing

- Master / Music / SFX volume sliders v menu
- Ducking — při klíčových momentech ztlumit hudbu na 30 %
- Cross-fade mezi levely — 2 sekundy fade-out, fade-in

---

## 💡 Nápady na rozšíření

Další levely drží latinskou konvenci pojmenování:

### 🌊 Aqua (Oceánský svět)
Úlomek pod hladinou. Vertex displacement pro vlny (Gerstner waves), refrakční shader.

### 🏜️ Arenis (Pouštní ruiny)
Aktivace sloupů ve správném pořadí. Dynamické stíny, texture scrolling písek.

### 🌿 Silva (Živá biosféra)
Rostliny reagují na světlo Lucerny. Shader-based plant animation, volumetrická mlha.

### 🕳️ Tenebrae (Stealth — sektor temnoty)
Proplížit se kolem senzorů Anomálie. Spotlight shader, frustum-based detekce.

### 🪞 Vortex (Asteroidový labyrint)
Laser se musí odrazit od zrcadlových asteroidů na cíl za překážkou. Reflection vectors, puzzle mechanika.

### 🌀 Aether (Červí díra)
Rychlý tunelový let mezi úrovněmi. Procedurální tunel, chromatic aberration, motion blur.

### 👻 Nox (Duchová loď)
Interiérová exploration obří opuštěné lodi. Interiérové lighting, navigation mesh.

---

## 📁 Struktura projektu

```
lightkeeper/
├── public/
│   ├── models/              # .glb modely podle typu
│   │   ├── characters/      # postavy
│   │   ├── environments/    # platformy a scénické pozadí
│   │   ├── objects/         # asteroidy a drobné objekty
│   │   ├── planets/         # planety
│   │   ├── ships/           # hráčské i nepřátelské lodě
│   │   └── stations/        # vesmírné stanice
│   ├── textures/            # difuze, normály, HDRI skyboxy
│   └── audio/               # SFX, hudba per level
├── src/
│   ├── main.ts              # entry point, init Three.js, game loop
│   ├── engine/              # reusable, framework-like
│   │   ├── Game.ts              # main loop, level manager
│   │   ├── Loader.ts            # GLTF loading, progress UI
│   │   ├── Input.ts             # keyboard, Gamepad API (8BitDo)
│   │   ├── Audio.ts             # howler + Three.js PositionalAudio
│   │   ├── Postprocess.ts       # bloom (reaguje na lanternBrightness)
│   │   └── Debug.ts             # lil-gui, stats.js
│   ├── player/
│   │   ├── Lantern.ts           # loď Strážce, flight model, quaterniony
│   │   ├── ChaseCamera.ts       # vlastní kamera
│   │   └── Weapons.ts           # paprsky Světla, cooldown
│   ├── physics/
│   │   ├── Collider.ts          # bounding sphere
│   │   ├── SpatialHash.ts       # broad-phase
│   │   └── Raycast.ts           # ray-sphere intersection
│   ├── entities/
│   │   ├── ShadowDrone.ts       # AI Stínových dronů
│   │   ├── LightAbsorber.ts     # Pohlcovač Světla (Glacies)
│   │   ├── Checkpoint.ts        # urychlovací prstenec (Zephyr)
│   │   ├── Shard.ts             # úlomek Majáku
│   │   ├── Crystal.ts           # světelný krystal (Ignis)
│   │   └── Anomaly.ts           # final boss
│   ├── levels/
│   │   ├── Level.ts             # abstract base
│   │   ├── Zephyr.ts
│   │   ├── Ignis.ts
│   │   ├── Glacies.ts
│   │   └── AnomalyHeart.ts      # finále
│   ├── shaders/             # GLSL soubory, importované přes ?raw
│   │   ├── beacon.vert / .frag
│   │   ├── lantern.vert / .frag
│   │   ├── lava.vert / .frag
│   │   ├── ice.vert / .frag
│   │   ├── gasGiant.vert / .frag
│   │   ├── shield.vert / .frag
│   │   ├── anomaly.vert / .frag
│   │   └── shadow.vert / .frag
│   ├── ui/
│   │   ├── HUD.tsx              # HTML overlay (počet úlomků, kompas)
│   │   ├── Menu.tsx
│   │   └── LoadingScreen.tsx
│   └── state/
│       └── gameStore.ts         # Zustand store (shards, lanternBrightness)
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── DESIGN.md                # Design workflow + AI nástroje pro assety
```

---

## 📚 Zdroje a nástroje

### 🎨 3D modely (Low-Poly, CC0)
- **[Kenney.nl — Space Kit](https://kenney.nl/assets/space-kit)** — free CC0 ⭐
- **[Sketchfab — Low Poly Space](https://sketchfab.com/tags/lowpoly-space)**
- **[PolyPizza](https://poly.pizza/)**
- **[Quaternius](https://quaternius.com/)**

### 🤖 AI nástroje pro generování grafiky
- **[Blockade Labs — Skybox AI](https://skybox.blockadelabs.com/)** — 360° HDRI skyboxy ⭐
- **[Leonardo.ai](https://leonardo.ai/)** — textury planet, UI ikony, concept art
- **[Luma AI](https://lumalabs.ai/)** / **[Tripo](https://www.tripo3d.ai)** — text/image-to-3D

> 📄 Pro detailní AI workflow viz **[DESIGN.md](./DESIGN.md)**

### 🌈 Design
- **[Color Hunt — Neon](https://colorhunt.co/palettes/neon)**
- **[Google Fonts — Orbitron](https://fonts.google.com/specimen/Orbitron)**

### 📐 Výuka Three.js a WebGL
- **[Three.js Manual](https://threejs.org/manual/)** — oficiální dokumentace
- **[Discover Three.js](https://discoverthreejs.com/)** — free online kniha
- **[Three.js Journey](https://threejs-journey.com/)** — Bruno Simon (placený kurz)
- **[The Book of Shaders](https://thebookofshaders.com/)** ⭐ — pro GLSL
- **[LearnOpenGL](https://learnopengl.com/)** — matice, kamera, lighting
- **[WebGL Fundamentals](https://webglfundamentals.org/)**
- **[ShaderToy](https://www.shadertoy.com/)** — inspirace pro vlastní shadery

### 🎵 Audio
- **[Pixabay Music](https://pixabay.com/music/)** — free ambient
- **[Freesound.org](https://freesound.org/)** — CC licencované SFX
- **[jsfxr](https://sfxr.me/)** — 8-bit SFX generátor

### 🔍 Inspirace
- **[simone-dev.com/space](https://2025.simone-dev.com/space)** — referenční projekt
- **[Bruno Simon portfolio](https://bruno-simon.com/)**
- **[Three.js Examples](https://threejs.org/examples/)**

---

## 📄 Licence

Assety třetích stran dle jejich licencí (CC0, CC-BY, MIT). Viz `CREDITS.md`.
