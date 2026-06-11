const DEFAULT_CONFIG = {
  deadzone: 0.28,
  hatNeutralThreshold: 2.0,
  fireMode: 'button', // 'button' | 'trigger' | 'both'
  fireThreshold: 0.1,
  brakeButtons: [6, 7, 4, 5],
  pauseButtons: [11],
  systemMenuButtons: [12],
}

// 8BitDo Ultimate 2C Wired (Vendor 2dc8 / Product 301d) in D-input mode on macOS.
// mapping: "" (raw), 15 buttons (B0–B14), 10 axes (A0–A9).
const DEFAULT_LAYOUT = {
  leftX: 0, leftY: 1,
  rightX: 2, rightY: 5,
  // Triggers are axes, range -1 (rest) → +1 (full press). Convert via (v+1)/2 → 0..1.
  rtAxis: 3,
  ltAxis: 4,
  south: 0, east: 1, west: 2, north: 3,
  lb: 6, rb: 7,
  select: 8, start: 9,
  l3: 10, r3: 11,
  // D-pad is a hat switch on AXIS 9. Neutral = 3.285 (out of -1..+1 range).
  // Pressed values (clockwise from N): ≈ -1, -0.71, -0.43, -0.14, 0.14, 0.43, 0.71, 1.0
  hatAxis: 9,
}

let CONFIG = { ...DEFAULT_CONFIG }
let LAYOUT = { ...DEFAULT_LAYOUT }

function clone(value) {
  return Array.isArray(value) ? [...value] : { ...value }
}

function uniqueButtons(values) {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value >= 0))]
}

function normalizeHat(v, threshold) {
  if (v > threshold) return { up: false, right: false, down: false, left: false }
  return {
    up:    v < -0.5  || (v > 0.85 && v < threshold),
    right: v > -0.9  && v < 0.0,
    down:  v > -0.2  && v < 0.65,
    left:  v > 0.3   && v < threshold,
  }
}

function isPressed(gp, index) {
  return !!gp.buttons[index]?.pressed
}

function dead(v) {
  return Math.abs(v) < CONFIG.deadzone ? 0 : v
}

function btn(gp, i) {
  return isPressed(gp, i)
}

function triggerUnit(gp, axisIdx) {
  return ((gp.axes[axisIdx] ?? -1) + 1) / 2  // -1..+1 → 0..1
}

export const gamepadService = {
  connected: false,
  // Set to true in devtools (gamepadService.debug = true) to log all buttons and axes.
  debug: false,
  _prev: [],
  _lastLog: 0,

  init() {
    const globalConfig = window.gamepadConfig?.gameplay
    const globalLayout = window.gamepadConfig?.layout
    if (globalConfig) this.setConfig(globalConfig)
    if (globalLayout) this.setMapping(globalLayout)

    window.addEventListener('gamepadconnected', ({ gamepad: gp }) => {
      this.connected = true
      console.log(
        `[Gamepad] "${gp.id}" | mapping:"${gp.mapping}" | buttons:${gp.buttons.length} | axes:${gp.axes.length}`,
      )
    })
    window.addEventListener('gamepaddisconnected', ({ gamepad: gp }) => {
      this.connected = false
      this._prev = []
      console.log(`[Gamepad] disconnected: "${gp.id}"`)
    })
  },

  setConfig(nextConfig = {}) {
    CONFIG = { ...CONFIG, ...clone(nextConfig) }
  },

  setMapping(nextLayout = {}) {
    LAYOUT = { ...LAYOUT, ...clone(nextLayout) }
  },

  getPad() {
    for (const gp of navigator.getGamepads()) {
      if (gp?.connected) return gp
    }
    return null
  },

  // Mutates keys with directional state (left stick + D-pad hat).
  // Returns gameplay actions derived from the shared button/axis layout.
  // forwardThrottle = RT axis 0..1, reverseThrottle = LT axis 0..1.
  // Call every frame (even when paused) so _prev stays in sync.
  update(keys, gp) {
    const lx  = dead(gp.axes[LAYOUT.leftX] ?? 0)
    const ly  = dead(gp.axes[LAYOUT.leftY] ?? 0)
    const hat = normalizeHat(gp.axes[LAYOUT.hatAxis], CONFIG.hatNeutralThreshold)

    keys.arrowleft  = !!(lx < -CONFIG.deadzone || hat.left)
    keys.arrowright = !!(lx > CONFIG.deadzone  || hat.right)
    keys.arrowup    = !!(ly < -CONFIG.deadzone || hat.up)
    keys.arrowdown  = !!(ly > CONFIG.deadzone  || hat.down)

    // Shoulder buttons = brake in galaxy mode
    keys[' '] = CONFIG.brakeButtons.some((index) => isPressed(gp, index))

    const forwardThrottle = triggerUnit(gp, LAYOUT.rtAxis)
    const reverseThrottle = triggerUnit(gp, LAYOUT.ltAxis)

    const pauseJustPressed = CONFIG.pauseButtons.some((index) => isPressed(gp, index) && !this._prev[index])
    const systemMenuJustPressed = CONFIG.systemMenuButtons.some((index) => isPressed(gp, index) && !this._prev[index])
    const backJustPressed  = btn(gp, LAYOUT.east)  && !this._prev[LAYOUT.east]
    const westJustPressed  = btn(gp, LAYOUT.west)  && !this._prev[LAYOUT.west]
    const northJustPressed = btn(gp, LAYOUT.north) && !this._prev[LAYOUT.north]
    const leftShoulderPressed = btn(gp, LAYOUT.lb)
    const rightShoulderPressed = btn(gp, LAYOUT.rb)
    const leftShoulderJustPressed = leftShoulderPressed && !this._prev[LAYOUT.lb]
    const rightShoulderJustPressed = rightShoulderPressed && !this._prev[LAYOUT.rb]
    const shoulderPressed = CONFIG.brakeButtons.some((index) => isPressed(gp, index))
    const shoulderJustPressed = CONFIG.brakeButtons.some((index) => isPressed(gp, index) && !this._prev[index])
    const startPressed = btn(gp, LAYOUT.start)
    const startJustPressed = startPressed && !this._prev[LAYOUT.start]
    const triggerFired = forwardThrottle > CONFIG.fireThreshold
    const buttonFired = btn(gp, LAYOUT.south)
    const fireJustPressed = buttonFired && !this._prev[LAYOUT.south]
    const fire = CONFIG.fireMode === 'button'
      ? buttonFired
      : CONFIG.fireMode === 'trigger'
        ? triggerFired
        : buttonFired || triggerFired

    if (this.debug) this._logRaw(gp)
    this._prev = gp.buttons.map((b) => b.pressed)

    return {
      fire,
      fireJustPressed,
      pauseJustPressed,
      systemMenuJustPressed,
      startPressed,
      startJustPressed,
      backJustPressed,
      westJustPressed,
      northJustPressed,
      leftShoulderPressed,
      rightShoulderPressed,
      leftShoulderJustPressed,
      rightShoulderJustPressed,
      shoulderPressed,
      shoulderJustPressed,
      leftX: lx,
      leftY: ly,
      forwardThrottle,
      reverseThrottle,
    }
  },

  _logRaw(gp) {
    const now = Date.now()
    if (now - this._lastLog < 200) return  // max 5× per second
    this._lastLog = now
    const btns = gp.buttons.map((b, i) => `B${i}:${b.value.toFixed(2)}`).join('  ')
    const axes = [...gp.axes].map((v, i) => `A${i}:${v.toFixed(3)}`).join('  ')
    console.log('[GP btns]', btns)
    console.log('[GP axes]', axes)
  },
}
