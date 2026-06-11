/**
 * CharacterAnimator — direct Three.js AnimationMixer wrapper for GLTF characters.
 *
 * Solves three Mixamo-specific problems:
 *   1. Strips root motion (progressive forward/lateral Hips drift) from all clips
 *   2. Provides precise crossFade transitions via THREE.AnimationAction API
 *   3. Supports looping and one-shot (jump, weapon draw) playback
 *
 * Usage:
 *   const animator = new CharacterAnimator(gltfModel)
 *   animator.play('Idle')               // looping
 *   animator.play('Jump', { loop: false }) // one-shot
 *   animator.update(dt)                 // call every frame
 *   animator.dispose()                  // cleanup
 */

const ROOT_BONE_PATTERN = /Hips/i
const ROOT_MOTION_THRESHOLD = 0.5
const DEFAULT_CROSSFADE = 0.3

export class CharacterAnimator {
  constructor(model) {
    this.mixer = new AFRAME.THREE.AnimationMixer(model)
    this.actions = new Map()
    this.activeAction = null
    this.activeName = null

    const clips = model.animations || []
    clips.forEach((clip) => {
      stripClipRootMotion(clip)
      this.actions.set(clip.name, this.mixer.clipAction(clip))
    })
  }

  /**
   * Play a named animation clip with smooth crossfade from the current clip.
   * @param {string} name - Exact clip name (e.g. 'Walk', 'Idle', 'Jump')
   * @param {object} opts
   * @param {boolean} opts.loop - true for LoopRepeat, false for LoopOnce (default: true)
   * @param {number}  opts.crossFade - blend duration in seconds (default: 0.3)
   * @param {number}  opts.timeScale - playback speed multiplier (default: 1)
   */
  play(name, { loop = true, crossFade = DEFAULT_CROSSFADE, timeScale = 1 } = {}) {
    if (name === this.activeName) return

    const nextAction = this.actions.get(name)
    if (!nextAction) return

    const T = AFRAME.THREE

    nextAction.reset()
    nextAction.setLoop(loop ? T.LoopRepeat : T.LoopOnce, loop ? Infinity : 1)
    nextAction.clampWhenFinished = !loop
    nextAction.timeScale = timeScale
    nextAction.setEffectiveWeight(1)

    if (this.activeAction) {
      nextAction.crossFadeFrom(this.activeAction, crossFade, true)
    }

    nextAction.play()
    this.activeAction = nextAction
    this.activeName = name
  }

  /** Advance the mixer by dt seconds.  Call once per frame. */
  update(dt) {
    this.mixer.update(dt)
  }

  /** Stop all actions and release mixer resources. */
  dispose() {
    this.mixer.stopAllAction()
    this.actions.clear()
    this.activeAction = null
    this.activeName = null
  }
}

/**
 * Strip progressive forward / lateral root motion from the Hips position track.
 *
 * Mixamo bone-local axes for Hips:
 *   X = lateral sway   (small oscillation, loops perfectly → keep)
 *   Y = forward motion  (huge progressive drift → strip)
 *   Z = vertical height (bounce / jump arc → keep)
 *
 * We only strip an axis when |lastFrame − firstFrame| > threshold,
 * which targets progressive root motion while preserving natural oscillation.
 */
function stripClipRootMotion(clip) {
  const hipsTrack = clip.tracks.find(
    (t) => t.name.endsWith('.position') && ROOT_BONE_PATTERN.test(t.name),
  )
  if (!hipsTrack || hipsTrack.values.length < 6) return

  const v = hipsTrack.values
  const firstX = v[0]
  const lastX = v[v.length - 3]
  const firstY = v[1]
  const lastY = v[v.length - 2]

  // Strip progressive forward motion (Y in bone-local = world forward after parent transform)
  if (Math.abs(lastY - firstY) > ROOT_MOTION_THRESHOLD) {
    for (let i = 1; i < v.length; i += 3) {
      v[i] = firstY
    }
  }

  // Strip progressive lateral drift (X)
  if (Math.abs(lastX - firstX) > ROOT_MOTION_THRESHOLD) {
    for (let i = 0; i < v.length; i += 3) {
      v[i] = firstX
    }
  }
}
