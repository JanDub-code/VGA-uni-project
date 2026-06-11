import { gameState } from '../services/gameState.js'

export function createMenuDisplayScene(scene) {
  const root = document.createElement('a-entity')
  root.dataset.gameRoot = 'true'

  const cam = document.createElement('a-entity')
  cam.setAttribute('camera', 'fov: 62; active: true')
  cam.setAttribute('position', '0 0.5 4')
  cam.setAttribute('rotation', '-6 0 0')
  root.appendChild(cam)

  const ambLight = document.createElement('a-light')
  ambLight.setAttribute('type', 'ambient')
  ambLight.setAttribute('color', '#1e2d45')
  ambLight.setAttribute('intensity', '1.2')
  root.appendChild(ambLight)

  const planetLight = document.createElement('a-light')
  planetLight.setAttribute('type', 'directional')
  planetLight.setAttribute('color', '#7755dd')
  planetLight.setAttribute('intensity', '3.5')
  planetLight.setAttribute('position', '0 18 -200')
  root.appendChild(planetLight)

  const planetRim = document.createElement('a-light')
  planetRim.setAttribute('type', 'directional')
  planetRim.setAttribute('color', '#4488ff')
  planetRim.setAttribute('intensity', '1.6')
  planetRim.setAttribute('position', '-4 12 -180')
  root.appendChild(planetRim)

  const bounceLight = document.createElement('a-light')
  bounceLight.setAttribute('type', 'directional')
  bounceLight.setAttribute('color', '#aa6633')
  bounceLight.setAttribute('intensity', '0.7')
  bounceLight.setAttribute('position', '0 -2 6')
  root.appendChild(bounceLight)

  const starfield = document.createElement('a-entity')
  starfield.setAttribute('lk-menu-starfield', '')
  root.appendChild(starfield)

  const bgPlanet = document.createElement('a-entity')
  bgPlanet.setAttribute('lk-menu-bg-planet', 'radius: 44')
  bgPlanet.setAttribute('position', '0 18 -200')
  root.appendChild(bgPlanet)

  const planetEnv = document.createElement('a-entity')
  planetEnv.setAttribute('gltf-model', 'url(/models/environments/planet-env.glb)')
  planetEnv.setAttribute('position', '0 -5 -10')
  planetEnv.setAttribute('scale', '0.55 0.55 0.55')
  root.appendChild(planetEnv)

  const platform = document.createElement('a-entity')
  platform.setAttribute('gltf-model', 'url(/models/environments/platform.glb)')
  platform.setAttribute('position', '0 -5 -10')
  platform.setAttribute('scale', '0.55 0.55 0.55')
  root.appendChild(platform)

  const shipPivot = document.createElement('a-entity')
  shipPivot.setAttribute('position', '0 -2.5 -10')
  shipPivot.setAttribute('scale', '1.2 1.2 1.2')
  shipPivot.setAttribute('animation__hover', 'property: position; from: 0 -2.5 -10; to: 0 -2.1 -10; dur: 4000; dir: alternate; loop: true; easing: easeInOutSine')
  root.appendChild(shipPivot)

  const ship = document.createElement('a-entity')
  ship.setAttribute('lk-ship-model', `flame: false; size: 7.2; modelUrl: ${gameState.getSelectedShipSkin().modelUrl}`)
  ship.setAttribute('rotation', '0 215 0')
  shipPivot.appendChild(ship)

  scene.appendChild(root)
  return {
    root,
    shipEl: shipPivot,
    dispose() {
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
