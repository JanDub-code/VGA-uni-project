const IDLE_CLIP = 'Idle'
const SELECT_CLIP = 'HipHop'
const SELECT_DANCE_MS = 2600
const SELECT_DANCE_BY_CHARACTER = {
  david: {
    clip: SELECT_CLIP,
    repetitions: 3,
    durationMs: 21300,
  },
  ivo: {
    clip: 'Shuffling',
    repetitions: 3,
    durationMs: 22600,
  },
}
const WEAPON_NODE_PATTERN = /^LaserGun/i

function hideCharacterWeapons(object) {
  object.traverse((child) => {
    if (!WEAPON_NODE_PATTERN.test(child.name || '')) return
    child.visible = false
    child.traverse?.((weaponChild) => {
      weaponChild.visible = false
    })
  })
}

export function createCharacterDisplayScene(scene, character) {
  const root = document.createElement('a-entity')
  root.dataset.gameRoot = 'true'
  let activeModel = null
  let activeLoadToken = 0
  let danceTimeout = null

  const cam = document.createElement('a-entity')
  cam.setAttribute('camera', 'fov: 54; active: true')
  cam.setAttribute('position', '0 1.35 5.8')
  cam.setAttribute('rotation', '-7 0 0')
  root.appendChild(cam)

  const ambient = document.createElement('a-light')
  ambient.setAttribute('type', 'ambient')
  ambient.setAttribute('color', '#2a2630')
  ambient.setAttribute('intensity', '0.88')
  root.appendChild(ambient)

  const key = document.createElement('a-light')
  key.setAttribute('type', 'directional')
  key.setAttribute('color', '#ffe8c2')
  key.setAttribute('intensity', '2.25')
  key.setAttribute('position', '-3.5 5.8 4.5')
  root.appendChild(key)

  const overhead = document.createElement('a-light')
  overhead.setAttribute('type', 'spot')
  overhead.setAttribute('color', '#fff1d6')
  overhead.setAttribute('intensity', '2.1')
  overhead.setAttribute('distance', '12')
  overhead.setAttribute('angle', '42')
  overhead.setAttribute('penumbra', '0.6')
  overhead.setAttribute('position', '0 4.4 1.4')
  overhead.setAttribute('rotation', '-72 0 0')
  root.appendChild(overhead)

  const rim = document.createElement('a-light')
  rim.setAttribute('type', 'point')
  rim.setAttribute('color', character.accentColor)
  rim.setAttribute('intensity', '4.6')
  rim.setAttribute('distance', '14')
  rim.setAttribute('position', '2.8 2.6 0.6')
  root.appendChild(rim)

  const backdrop = document.createElement('a-image')
  backdrop.setAttribute('position', '0 0.15 -12.8')
  backdrop.setAttribute('width', '46')
  backdrop.setAttribute('height', '36.8')
  backdrop.setAttribute('material', 'src: /img/hangar.png; shader: flat; transparent: true; opacity: 1; side: double')
  root.appendChild(backdrop)

  const platform = document.createElement('a-entity')
  platform.setAttribute('gltf-model', 'url(/models/environments/platform.glb)')
  platform.setAttribute('position', '0 -1.82 -2.6')
  platform.setAttribute('scale', '0.42 0.42 0.42')
  root.appendChild(platform)

  const stageShadow = document.createElement('a-circle')
  stageShadow.setAttribute('position', '0 -1.18 -2.6')
  stageShadow.setAttribute('rotation', '-90 0 0')
  stageShadow.setAttribute('scale', '1.45 0.42 1')
  stageShadow.setAttribute('geometry', 'primitive: circle; radius: 1.08; segments: 96')
  stageShadow.setAttribute('material', 'color: #02050a; shader: flat; transparent: true; opacity: 0.34; depthWrite: false')
  root.appendChild(stageShadow)

  const ring = document.createElement('a-ring')
  ring.setAttribute('position', '0 -1.15 -2.6')
  ring.setAttribute('rotation', '-90 0 0')
  ring.setAttribute('geometry', 'primitive: ring; radiusInner: 0.72; radiusOuter: 0.8; segmentsTheta: 96')
  ring.setAttribute('material', `color: ${character.accentColor}; emissive: ${character.accentColor}; emissiveIntensity: 1.4; transparent: true; opacity: 0.9; shader: flat`)
  root.appendChild(ring)

  const pivot = document.createElement('a-entity')
  pivot.setAttribute('position', '0 -1.14 -2.6')
  pivot.setAttribute('rotation', '0 -18 0')
  root.appendChild(pivot)

  const setCharacterClip = (model, clip, loop = 'repeat', repetitions = null) => {
    if (!model) return
    const repetitionsValue = Number.isFinite(repetitions) ? `; repetitions: ${repetitions}` : ''
    model.setAttribute('animation-mixer', `clip: ${clip}; loop: ${loop}${repetitionsValue}; crossFadeDuration: 0.25`)
  }

  const getSelectionDance = (nextCharacter) => SELECT_DANCE_BY_CHARACTER[nextCharacter.id] || {
    clip: SELECT_CLIP,
    repetitions: 1,
    durationMs: SELECT_DANCE_MS,
  }

  const playSelectionDance = (model, nextCharacter) => {
    if (!model) return
    const dance = getSelectionDance(nextCharacter)
    const loop = dance.repetitions > 1 ? 'repeat' : 'once'
    window.clearTimeout(danceTimeout)
    setCharacterClip(model, dance.clip, loop, dance.repetitions)
    danceTimeout = window.setTimeout(() => {
      if (model === activeModel) setCharacterClip(model, IDLE_CLIP)
    }, dance.durationMs)
  }

  const fitCharacterModel = (object) => {
    const T = AFRAME.THREE

    const oldParent = object.parent
    object.parent = null
    object.updateMatrixWorld(true)

    const box = new T.Box3().setFromObject(object)
    const size = new T.Vector3()
    const center = new T.Vector3()
    box.getSize(size)
    box.getCenter(center)

    const maxHeight = size.y || Math.max(size.x, size.z, 1)

    object.parent = oldParent

    object.scale.multiplyScalar(4.1 / maxHeight)
    object.updateMatrixWorld(true)

    const fittedBox = new T.Box3().setFromObject(object)
    fittedBox.getCenter(center)
    if (object.parent) {
      object.parent.worldToLocal(center)
    }
    object.position.sub(center)
    object.position.y += 1.95

    object.traverse((child) => {
      if (!child.isMesh || !child.material) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => {
        material.roughness = Math.max(material.roughness ?? 0.55, 0.5)
        material.metalness = Math.min(material.metalness ?? 0.35, 0.45)
      })
    })
  }

  const setCharacter = (nextCharacter, { celebrate = false } = {}) => {
    activeLoadToken += 1
    const loadToken = activeLoadToken

    window.clearTimeout(danceTimeout)
    if (activeModel?.parentNode) {
      activeModel.parentNode.removeChild(activeModel)
    }

    rim.setAttribute('color', nextCharacter.accentColor)
    rim.setAttribute('intensity', '4.6')
    rim.setAttribute('distance', '14')
    ring.setAttribute('material', `color: ${nextCharacter.accentColor}; emissive: ${nextCharacter.accentColor}; emissiveIntensity: 1.4; transparent: true; opacity: 0.9; shader: flat`)

    const model = document.createElement('a-entity')
    activeModel = model
    model.setAttribute('gltf-model', `url(${nextCharacter.modelUrl})`)
    model.setAttribute('position', '0 0 0')
    model.setAttribute('rotation', '0 0 0')
    model.setAttribute('animation-mixer', `clip: ${IDLE_CLIP}; loop: repeat; crossFadeDuration: 0.25`)
    pivot.appendChild(model)

    model.addEventListener('model-loaded', (event) => {
      if (loadToken !== activeLoadToken) return
      fitCharacterModel(event.detail.model)
      hideCharacterWeapons(event.detail.model)
      if (celebrate) {
        playSelectionDance(model, nextCharacter)
      } else {
        setCharacterClip(model, IDLE_CLIP)
      }
    }, { once: true })
  }

  setCharacter(character)

  scene.appendChild(root)
  return {
    root,
    characterEl: pivot,
    setCharacter,
    dispose() {
      window.clearTimeout(danceTimeout)
      activeLoadToken += 1
      if (activeModel?.parentNode) {
        activeModel.parentNode.removeChild(activeModel)
        activeModel = null
      }
      if (root.object3D) {
        root.object3D.traverse((node) => {
          if (node.isMesh) {
            node.geometry?.dispose()
            if (Array.isArray(node.material)) {
              node.material.forEach((m) => m.dispose())
            } else {
              node.material?.dispose()
            }
          }
        })
      }
      if (root.parentNode) root.parentNode.removeChild(root)
    },
  }
}
