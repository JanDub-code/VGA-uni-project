export const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
export const damp = (current, target, speed, dt) => current + (target - current) * (1 - Math.exp(-speed * dt))

export function createEntity(tag, attrs = {}, parent) {
  const el = document.createElement(tag)
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value))
  if (parent) parent.appendChild(el)
  return el
}

export function seededRandom(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}
