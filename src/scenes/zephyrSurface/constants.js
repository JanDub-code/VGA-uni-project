export const SURFACE_MODEL_URL = '/models/planets/earth-map.glb'
export const ZOMBIE_MODEL_URL = '/models/enemies/Zombie.glb'
export const BEACON_MODEL_URL = '/models/objects/Torch.glb'
export const DAY_SKY_COLOR = '#145599'
export const NIGHT_SKY_COLOR = '#06162c'
export const SUN_COLOR = '#fff2b8'
export const SUN_LIGHT_COLOR = '#ffe7a8'
export const DAY_SECONDS = 30
export const DUSK_SECONDS = 12
export const NIGHT_SECONDS = 75
export const DAWN_SECONDS = 12
export const DAY_NIGHT_CYCLE_SECONDS = DAY_SECONDS + DUSK_SECONDS + NIGHT_SECONDS + DAWN_SECONDS
export const NIGHT_WARNING_SECONDS = 15
export const CHARACTER_HEIGHT = 0.3
export const CHARACTER_POSITION = { x: -3.0, y: 1.52, z: -0.45 }
export const THIRD_PERSON_CAMERA_OFFSET = { x: 0.65, y: 0.38, z: 0 }
export const THIRD_PERSON_ROTATION = { x: -22, y: 90, z: 0 }
export const CHARACTER_BASE_YAW = -90
export const WALK_SPEED = 0.72
export const RUN_SPEED = 1.15
export const ARMED_WALK_SPEED = 0.46
export const ARMED_RUN_SPEED = 0.82
export const TURN_SPEED = 105
export const WALK_CLIP = 'Walk'
export const IDLE_CLIP = 'Idle'
export const RIFLE_IDLE_CLIP = 'RifleIdle'
export const RIFLE_AIMING_CLIP = 'RifleAiming'
export const RIFLE_RUN_CLIP = 'RifleRun'
export const RIFLE_BACKWARD_CLIP = 'RifleBackward'
export const GRAB_RIFLE_CLIP = 'GrabRifle'
export const PUT_BACK_RIFLE_CLIP = 'PutBackRifle'
export const FIRE_RIFLE_WALK_CLIP = 'FiringRifleWalk'
export const PUNCH_LEFT_CLIP = 'PunchingLeft'
export const PUNCH_RIGHT_CLIP = 'PunchingRight'
export const RUN_CLIP = 'Running'
export const RUN_BACKWARD_CLIP = 'RunningBakward'
export const JUMP_CLIP = 'Jump'
export const LASER_COLOR = '#d000ff'
export const LASER_DURATION_MS = 520
export const LASER_BOLT_LENGTH = 0.34
export const LASER_BOLT_RADIUS = 0.005
export const LASER_BOLT_SPEED = 4.2
export const LASER_MUZZLE_OFFSET = { forward: 0.147, right: 0, up: 0.01 }
export const LASER_RETICLE_FORWARD_OFFSET = 1.35
export const LASER_RETICLE_RADIUS = 0.055
export const FIRE_COOLDOWN_MS = 340
export const JUMP_FALLBACK_MS = 760
export const JUMP_LAND_BLEND_MS = 140
export const AIM_BEFORE_FIRE_MS = 460
export const GRAVITY = 3.8
export const JUMP_VELOCITY = 1.35
export const CHARACTER_GROUND_OFFSET = CHARACTER_HEIGHT
export const GROUND_RAY_HEIGHT = 4
export const GROUND_RAY_DEPTH = 8
export const CHARACTER_COLLISION_RADIUS = 0.13
export const COLLISION_MIN_HEIGHT = 0.22
export const COLLISION_MIN_SIZE = 0.08
export const COLLISION_MAX_FLATNESS = 0.32
export const TREE_COLLIDER_PADDING = 0.02
export const ROCK_COLLIDER_PADDING = 0.02
export const OBSTACLE_TOP_STAND_TOLERANCE = 0.06
export const OBSTACLE_TOP_GROUND_TOLERANCE = 0.09
export const COLLISION_PUSH_EPSILON = 0.006
export const WATER_SURFACE_TOLERANCE = 0.08
export const WATER_SINK_ACCELERATION = 2.4
export const WATER_SINK_MAX_SPEED = 0.85
export const ZOMBIE_HEIGHT = 0.288
export const ZOMBIE_ROOT_GROUND_OFFSET = 0
export const ZOMBIE_HEALTH = 2
export const ZOMBIE_SPEED = 0.34
export const ZOMBIE_ATTACK_RANGE = 0.27
export const ZOMBIE_ATTACK_COOLDOWN = 1.2
export const ZOMBIE_SPAWN_DROP_HEIGHT = 0.9
export const ZOMBIE_SPAWN_INTERVAL = 3.2
export const ZOMBIE_MAX_ALIVE = 8
export const ZOMBIE_HIT_RADIUS = 0.22
export const ZOMBIE_ROOT_Y_TOLERANCE = 0.055
export const ZOMBIE_INVALID_GROUND_MAX_SECONDS = 0.35
export const ZOMBIE_KILL_SCORE = 100
export const DAY_BEACON_COUNTS = [1, 2, 3]
export const DAY_BEACON_HEIGHT = 0.9
export const DAY_BEACON_INTERACTION_RADIUS = 0.62
export const DAY_BEACON_SLOW_RADIUS = 1.35
export const DAY_BEACON_SAFE_RADIUS = 1.55
export const DAY_BEACON_LIGHT_RADIUS = 2.6
export const DAY_BEACON_SLOW_MULTIPLIER = 0.58
export const DAY_BEACON_SCORE = 50
export const NIGHT_CONFIGS = [
  { spawnInterval: 3.6, maxAlive: 5, zombieSpeed: 0.3, spawnMinDistance: 5.2, spawnMaxDistance: 7.2, survivalBonus: 400 },
  { spawnInterval: 2.8, maxAlive: 7, zombieSpeed: 0.36, spawnMinDistance: 4.2, spawnMaxDistance: 6.3, survivalBonus: 700 },
  { spawnInterval: 2.2, maxAlive: 9, zombieSpeed: 0.43, spawnMinDistance: 3.3, spawnMaxDistance: 5.4, survivalBonus: 1200 },
]
export const DAY_BRIEFINGS = [
  {
    kicker: 'DEN 1 / PRISTANI',
    title: 'Zmapuj povrch',
    summary: 'Prvni svetlo je klidne. Najdi a aktivuj prvni svetelny majak, aby v noci vytvoril zpomalovaci pole.',
    threat: 'Pomala vlna, nizky pocet cilu.',
    objective: 'Aktivuj 1 majak a nauc se nejkratsi ustupovou trasu od pristani.',
    advice: 'Pouzij Q u majaku. Drz se mimo vodu a vytahni zbran jeste pred setmenim.',
  },
  {
    kicker: 'DEN 2 / SLABY SIGNAL',
    title: 'Vlna zrychluje',
    summary: 'Po prvni noci znas teren, ale dalsi utok bude hustsi. Propoj dva majaky a priprav bojovou pozici s dobrym vyhledem.',
    threat: 'Vice cilu, kratsi pauzy mezi spawnem.',
    objective: 'Aktivuj 2 majaky a vyber si misto, kde te zombie nezatlaci ke skalam nebo vode.',
    advice: 'Bojuj v dosahu aktivniho majaku; jeho aura zpomaluje zombie.',
  },
  {
    kicker: 'DEN 3 / POSLEDNI OKNO',
    title: 'Vydrz do svitani',
    summary: 'Posledni den je finalni priprava. Rozsirit svetelnou sit je nejlepsi sance, jak prezit zaverecnou noc.',
    threat: 'Nejrychlejsi nepratele a nejvyssi limit aktivnich zombie.',
    objective: 'Aktivuj 3 majaky a vytvor si trasu mezi jejich zpomalovacimi poli.',
    advice: 'Kdyz se vlna zhusti, ustupuj od majaku k majaku a cisti nejblizsi cil.',
  },
]
export const MAX_NIGHTS = NIGHT_CONFIGS.length
export const SCORE_POPUP_DURATION_MS = 950
export const ZOMBIE_CLIPS = {
  idle: 'Idle',
  walk: 'Walk',
  attack: 'Punch',
  hit: 'HitReact',
  death: 'Death',
}
export const ZOMBIE_ROOT_MOTION_CLIPS = new Set(['Walk', 'Run', 'Run_Attack'])
export const ROOT_MOTION_CLIPS = new Set([
  'Walk',
  'Running',
  'RunningBakward',
  'RunBackwardAiming',
  'FiringRifleWalk',
  'FiringRifle',
  'RifleRun',
  'RifleBackward',
  'Jump',
])
export const SURFACE_CONTROL_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyR',
  'KeyF',
  'KeyQ',
  'KeyZ',
  'Space',
  'ShiftLeft',
  'ShiftRight',
])
