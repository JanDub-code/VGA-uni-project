// Gamepad UI navigation — independent RAF loop, separate from gameplay input.
//
// Layer stack model: each "screen" pushes a Layer when it opens and removes it when it closes.
// Only the top layer is active. B0 = confirm (click focused element), B1 = back (pop layer).
//
// Navigation is spatial: the joystick/D-pad direction snaps focus to the nearest button
// in that direction based on getBoundingClientRect — works for any layout (vertical, horizontal, grid).
//
// Layer config: { id, elements: () => Element[], onBack?: () => void }
// Usage:
//   gamepadNavService.push({ id: 'pause', elements: () => [...], onBack: () => resume() })
//   gamepadNavService.remove('pause')   // when closed programmatically
//   gamepadNavService.replace(config)   // same-level transition (e.g., pause → game-over)
//   gamepadNavService.clear()           // entering gameplay with no active menus

const DEFAULT_CONFIG = {
  hatAxis: 9,
  hatNeutralThreshold: 2.0,
  stickX: 0,
  stickY: 1,
  navDeadzone: 0.35,
  repeatDelay: 300,
  repeatRate: 180,
  confirmButton: 0,
  backButton: 1,
  systemMenuButton: 12,
}

let CONFIG = { ...DEFAULT_CONFIG }

function normalizeHat(v, threshold) {
  if (v > threshold) return { up: false, right: false, down: false, left: false }
  return {
    up:    v < -0.5  || (v > 0.85 && v < threshold),
    right: v > -0.9  && v < 0.0,
    down:  v > -0.2  && v < 0.65,
    left:  v > 0.3   && v < threshold,
  }
}

// Returns the dominant direction from a stick or hat, or null if below deadzone.
function stickDir(x, y) {
  if (Math.abs(x) < CONFIG.navDeadzone && Math.abs(y) < CONFIG.navDeadzone) return null
  return Math.abs(x) >= Math.abs(y)
    ? (x < 0 ? 'left' : 'right')
    : (y < 0 ? 'up'   : 'down')
}

// Finds the nearest focusable element in the given direction using screen positions.
// Scores candidates by: primary_distance - 0.4 * perpendicular_distance.
// Returns the best candidate or null if none qualifies.
function findNearest(current, candidates, dir) {
  const cr = current.getBoundingClientRect()
  const cx = cr.left + cr.width  / 2
  const cy = cr.top  + cr.height / 2

  let best = null
  let bestScore = 0  // must beat 0 to qualify

  for (const el of candidates) {
    if (el === current) continue
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) continue  // invisible / not rendered
    const ex = r.left + r.width  / 2
    const ey = r.top  + r.height / 2
    const dx = ex - cx
    const dy = ey - cy

    let primary, perp
    switch (dir) {
      case 'up':    primary = -dy; perp = Math.abs(dx); break
      case 'down':  primary =  dy; perp = Math.abs(dx); break
      case 'left':  primary = -dx; perp = Math.abs(dy); break
      case 'right': primary =  dx; perp = Math.abs(dy); break
      default: continue
    }

    if (primary <= 0) continue  // not in this direction
    const score = primary - perp * 0.4
    if (score > bestScore) { bestScore = score; best = el }
  }

  return best
}

export const gamepadNavService = {
  _layers: [],        // navigation stack; top = active layer
  _prev: [],          // button states from previous frame
  _prevNavDir: null,  // direction active last frame (for just-pressed detection)
  _repeatDir: null,
  _repeatTimer: 0,
  _repeatPhase: 'none',
  _boundTick: null,
  _running: false,

  init() {
    const globalConfig = window.gamepadConfig?.nav
    if (globalConfig) this.setConfig(globalConfig)

    this._boundTick = (ts) => this._tick(ts)
    this._running = true
    requestAnimationFrame(this._boundTick)

    window.addEventListener('gamepadconnected', () => this._ensureRunning())
  },

  stop() {
    this._running = false
  },

  setConfig(nextConfig = {}) {
    CONFIG = { ...CONFIG, ...nextConfig }
  },

  // Push a new navigation layer on top of the stack.
  push(config) {
    const layer = { focusIdx: 0, ...config }
    this._layers.push(layer)
    this._applyFocus()
    this._ensureRunning()
  },

  // Replace the top layer (same-level transition, e.g., pause → game-over).
  replace(config) {
    this._clearFocus()
    if (this._layers.length) this._layers.pop()
    this.push(config)
  },

  // Pop the top layer and invoke its onBack callback.
  pop() {
    this._clearFocus()
    const layer = this._layers.pop()
    this._applyFocus()
    layer?.onBack?.()
  },

  // Remove a specific layer by id without calling onBack (closed programmatically).
  remove(id) {
    const i = this._lastIndexOf(id)
    if (i < 0) return
    this._layers.splice(i, 1)
    this._clearFocus()
    this._applyFocus()
  },

  // Clear all layers (entering gameplay with no menus).
  clear() {
    this._layers = []
    this._clearFocus()
  },

  // ── internals ──────────────────────────────────────────────────────────────

  _top() {
    return this._layers[this._layers.length - 1] ?? null
  },

  _els(layer) {
    return (typeof layer.elements === 'function' ? layer.elements() : layer.elements)
      .filter(Boolean)
  },

  _applyFocus() {
    const layer = this._top()
    if (!layer) return
    const els = this._els(layer)
    els.forEach((el, i) => el.classList.toggle('gamepad-focus', i === layer.focusIdx))
  },

  _clearFocus() {
    document.querySelectorAll('.gamepad-focus').forEach((el) => el.classList.remove('gamepad-focus'))
  },

  // Navigate spatially: snap focus to the nearest element in the given direction.
  _navigate(dir) {
    const layer = this._top()
    if (!layer) return
    const els = this._els(layer)
    if (!els.length) return

    if (layer.linear) {
      const nextIndex = dir === 'down' || dir === 'right'
        ? Math.min(layer.focusIdx + 1, els.length - 1)
        : dir === 'up' || dir === 'left'
          ? Math.max(layer.focusIdx - 1, 0)
          : layer.focusIdx
      if (nextIndex === layer.focusIdx) return
      layer.focusIdx = nextIndex
      this._clearFocus()
      this._applyFocus()
      return
    }

    const current = els[layer.focusIdx] ?? els[0]
    const best = findNearest(current, els, dir)
    if (!best) return

    layer.focusIdx = els.indexOf(best)
    this._clearFocus()
    this._applyFocus()
  },

  _lastIndexOf(id) {
    for (let i = this._layers.length - 1; i >= 0; i--) {
      if (this._layers[i].id === id) return i
    }
    return -1
  },

  _getPad() {
    if (typeof navigator.getGamepads !== 'function') return null
    for (const gp of navigator.getGamepads()) {
      if (gp?.connected) return gp
    }
    return null
  },

  _ensureRunning() {
    if (this._running) return
    this._running = true
    requestAnimationFrame(this._boundTick)
  },

  _tick(ts) {
    const gp    = this._getPad()
    const layer = this._top()

    if (gp) {
      const systemMenuJP = !!gp.buttons[CONFIG.systemMenuButton]?.pressed && !this._prev[CONFIG.systemMenuButton]
      if (systemMenuJP && ['main-menu', 'character-select', 'system-menu'].includes(layer?.id)) {
        window.dispatchEvent(new CustomEvent('gamepad-system-menu'))
      }
    }

    if (gp && layer) {
      const hat  = normalizeHat(gp.axes[CONFIG.hatAxis], CONFIG.hatNeutralThreshold)
      const sx   = gp.axes[CONFIG.stickX] ?? 0
      const sy   = gp.axes[CONFIG.stickY] ?? 0

      const confirmJP = !!gp.buttons[CONFIG.confirmButton]?.pressed && !this._prev[CONFIG.confirmButton]
      const backJP    = !!gp.buttons[CONFIG.backButton]?.pressed    && !this._prev[CONFIG.backButton]

      // Hat takes priority over stick; stick uses dominant axis
      const hatActive = hat.up ? 'up' : hat.down ? 'down' : hat.left ? 'left' : hat.right ? 'right' : null
      const navDir    = hatActive ?? stickDir(sx, sy)

      // Just-pressed: fires when direction changes from anything to a new direction
      const dirJP = navDir !== null && navDir !== this._prevNavDir

      // Key-repeat: resets when direction changes
      if (navDir !== this._repeatDir) {
        this._repeatDir   = navDir
        this._repeatTimer = ts
        this._repeatPhase = navDir ? 'delay' : 'none'
      }

      let repeatFired = false
      if (this._repeatDir && this._repeatPhase !== 'none') {
        const elapsed = ts - this._repeatTimer
        if (this._repeatPhase === 'delay' && elapsed > CONFIG.repeatDelay) {
          this._repeatPhase = 'repeat'
          this._repeatTimer = ts
          repeatFired = true
        } else if (this._repeatPhase === 'repeat' && elapsed > CONFIG.repeatRate) {
          this._repeatTimer = ts
          repeatFired = true
        }
      }

      if ((dirJP || repeatFired) && navDir) this._navigate(navDir)

      if (confirmJP) {
        const els = this._els(layer)
        els[layer.focusIdx]?.click()
      }
      if (backJP) this.pop()

      this._prevNavDir = navDir
    }

    if (gp) this._prev = gp.buttons.map((b) => b.pressed)

    if (!gp && !this._top()) {
      this._running = false
      return
    }

    if (this._running) requestAnimationFrame(this._boundTick)
  },
}
