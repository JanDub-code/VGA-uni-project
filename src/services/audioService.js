import { assetUrl } from './assetPaths.js'

const ENGINE_LOOP_URL = assetUrl('sounds/spacecraft-engine-loop.mp3')
const MUSIC_TRACKS = {
  galaxy: assetUrl('sounds/singularity_action.mp3'),
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function damp(current, target, speed, dt) {
  return current + (target - current) * (1 - Math.exp(-speed * dt))
}

class AudioService {
  constructor() {
    // Engine
    this._engineAudio = null
    this._engineGain = null
    this._engineSource = null
    this._currentEngineGain = 0
    this._currentRate = 0.85

    // Music
    this._musicAudio = null
    this._musicGain = null
    this._musicSource = null
    this._currentMusicGain = 0
    this._currentMusicTrack = null

    // Context
    this._context = null
    this._unlocked = false
    this._unlockHandler = () => this.unlock()

    // Active tones for cleanup
    this._activeTones = new Set()

    // Unlock events
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this._unlockHandler, { once: true })
      window.addEventListener('keydown', this._unlockHandler, { once: true })
      window.addEventListener('touchstart', this._unlockHandler, { once: true, passive: true })
    }
  }

  // ─── Lifecycle / Cleanup ──────────────────────────────────────────────────

  /**
   * Fully dispose the service and release all resources.
   * Call this when the app unloads or before creating a new scene.
   */
  dispose() {
    this._stopEngineAudio()
    this._stopMusicAudio()
    this._disposeAllTones()

    // Reset state
    this._currentEngineGain = 0
    this._currentRate = 0.85
    this._currentMusicGain = 0
    this._currentMusicTrack = null
    this._unlocked = false

    // Close and nullify AudioContext
    if (this._context) {
      this._context.close().catch(() => {})
      this._context = null
    }

    // Remove listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this._unlockHandler)
      window.removeEventListener('keydown', this._unlockHandler)
      window.removeEventListener('touchstart', this._unlockHandler)
    }
  }

  /**
   * Stop all currently playing sounds (engine, music, and tones).
   * Call when switching scenes.
   */
  stopAll() {
    this._stopEngineAudio()
    this._stopMusicAudio()
    this._disposeAllTones()
  }

  // ─── Engine ───────────────────────────────────────────────────────────────

  updateShipEngine({ active, throttle = 0, speedPct = 0, dt = 1 / 60, mode = 'galaxy' } = {}) {
    const normalizedThrottle = clamp(throttle, 0, 1)
    const normalizedSpeed = clamp(speedPct, 0, 1)
    const moving = normalizedThrottle > 0.02 || normalizedSpeed > 0.04
    const shouldAudiblyPlay = active && moving

    if (shouldAudiblyPlay) {
      this.unlock()
      if (this._ensureEngine() && this._engineAudio?.paused) {
        this._engineAudio.play().catch(() => {})
      }
    }

    const baseGain = mode === 'mission' ? 0.025 : 0.018
    const throttleGain = mode === 'mission' ? 0.035 : 0.15
    const speedGain = mode === 'mission' ? 0.055 : 0.075
    const targetGain = shouldAudiblyPlay
      ? baseGain + normalizedThrottle * throttleGain + normalizedSpeed * speedGain
      : 0
    const targetRate = mode === 'mission'
      ? 0.82 + normalizedSpeed * 0.28 + normalizedThrottle * 0.12
      : 0.72 + normalizedThrottle * 0.46 + normalizedSpeed * 0.24

    this._currentEngineGain = damp(this._currentEngineGain, clamp(targetGain, 0, 0.24), 5.5, dt)
    this._currentRate = damp(this._currentRate, clamp(targetRate, 0.65, 1.45), 4.5, dt)

    if (this._engineGain && this._context) {
      this._engineGain.gain.setTargetAtTime(this._currentEngineGain, this._context.currentTime, 0.045)
    }
    if (this._engineAudio) {
      this._engineAudio.playbackRate = this._currentRate
    }
  }

  stopShipEngine(dt = 1 / 60) {
    this.updateShipEngine({ active: false, dt })
  }

  _ensureEngine() {
    if (!this._ensureContext()) return false
    if (this._engineAudio) return true

    this._engineAudio = new Audio(ENGINE_LOOP_URL)
    this._engineAudio.loop = true
    this._engineAudio.preload = 'auto'
    this._engineAudio.volume = 1
    this._engineAudio.playbackRate = this._currentRate

    this._engineGain = this._context.createGain()
    this._engineGain.gain.value = 0

    this._engineSource = this._context.createMediaElementSource(this._engineAudio)
    this._engineSource.connect(this._engineGain)
    this._engineGain.connect(this._context.destination)

    return true
  }

  _stopEngineAudio() {
    if (this._engineAudio) {
      this._engineAudio.pause()
      this._engineAudio.src = ''
      this._engineAudio = null
    }
    if (this._engineSource) {
      this._engineSource.disconnect()
      this._engineSource = null
    }
    if (this._engineGain) {
      this._engineGain.disconnect()
      this._engineGain = null
    }
    this._currentEngineGain = 0
  }

  // ─── Music ────────────────────────────────────────────────────────────────

  updateMusic({ track = 'galaxy', active = true, volume = 0.11, dt = 1 / 60 } = {}) {
    const targetGain = active ? clamp(volume, 0, 0.18) : 0

    if (active) {
      this.unlock()
      if (this._ensureMusic(track) && this._musicAudio?.paused) {
        this._musicAudio.play().catch(() => {})
      }
    }

    this._currentMusicGain = damp(this._currentMusicGain, targetGain, 2.8, dt)
    if (this._musicGain && this._context) {
      this._musicGain.gain.setTargetAtTime(this._currentMusicGain, this._context.currentTime, 0.09)
    }
  }

  stopMusic(dt = 1 / 60) {
    this.updateMusic({ active: false, dt })
  }

  _ensureMusic(trackName) {
    if (!this._ensureContext()) return false
    const url = MUSIC_TRACKS[trackName]
    if (!url) return false

    if (this._musicAudio && this._currentMusicTrack === trackName) return true

    // Clean up existing track before creating new one
    if (this._musicAudio) {
      this._musicAudio.pause()
      this._musicAudio.src = ''
      this._musicAudio = null
    }
    if (this._musicSource) {
      this._musicSource.disconnect()
      this._musicSource = null
    }
    if (this._musicGain) {
      this._musicGain.disconnect()
      this._musicGain = null
    }

    this._musicAudio = new Audio(url)
    this._musicAudio.loop = true
    this._musicAudio.preload = 'auto'
    this._musicAudio.volume = 1
    this._currentMusicTrack = trackName

    this._musicGain = this._context.createGain()
    this._musicGain.gain.value = 0

    this._musicSource = this._context.createMediaElementSource(this._musicAudio)
    this._musicSource.connect(this._musicGain)
    this._musicGain.connect(this._context.destination)

    return true
  }

  _stopMusicAudio() {
    if (this._musicAudio) {
      this._musicAudio.pause()
      this._musicAudio.src = ''
      this._musicAudio = null
    }
    if (this._musicSource) {
      this._musicSource.disconnect()
      this._musicSource = null
    }
    if (this._musicGain) {
      this._musicGain.disconnect()
      this._musicGain = null
    }
    this._currentMusicGain = 0
    this._currentMusicTrack = null
  }

  // ─── Tones / SFX ──────────────────────────────────────────────────────────

  playTone({ frequency = 440, endFrequency = frequency, duration = 0.12, volume = 0.08, type = 'sine' } = {}) {
    this.unlock()
    if (!this._ensureContext()) return

    const now = this._context.currentTime
    const oscillator = this._context.createOscillator()
    const gain = this._context.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(clamp(volume, 0.001, 0.2), now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    oscillator.connect(gain)
    gain.connect(this._context.destination)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.02)

    // Track for cleanup
    const toneRef = { oscillator, gain }
    this._activeTones.add(toneRef)

    oscillator.onended = () => {
      oscillator.disconnect()
      gain.disconnect()
      this._activeTones.delete(toneRef)
    }
  }

  _disposeAllTones() {
    for (const { oscillator, gain } of this._activeTones) {
      try {
        oscillator.stop()
        oscillator.disconnect()
        gain.disconnect()
      } catch (e) {
        // Ignore errors from already stopped/disposed nodes
      }
    }
    this._activeTones.clear()
  }

  // ─── Presets ──────────────────────────────────────────────────────────────

  playLaserShot() {
    this.playTone({ frequency: 980, endFrequency: 170, duration: 0.13, volume: 0.055, type: 'sawtooth' })
  }

  playSurfaceHit() {
    this.playTone({ frequency: 180, endFrequency: 80, duration: 0.09, volume: 0.045, type: 'square' })
  }

  playSurfaceKill() {
    this.playTone({ frequency: 120, endFrequency: 38, duration: 0.22, volume: 0.06, type: 'sawtooth' })
  }

  playSurfaceDamage() {
    this.playTone({ frequency: 90, endFrequency: 48, duration: 0.18, volume: 0.075, type: 'square' })
  }

  playSurfaceVictory() {
    this.playTone({ frequency: 520, endFrequency: 880, duration: 0.28, volume: 0.06, type: 'triangle' })
  }

  // ─── Context ─────────────────────────────────────────────────────────────

  unlock() {
    if (this._unlocked || !this._ensureContext()) return
    this._unlocked = true
    this._context?.resume?.()
  }

  _ensureContext() {
    if (!this._context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return false
      this._context = new AudioContextClass()
    }
    return true
  }
}

export const audioService = new AudioService()
