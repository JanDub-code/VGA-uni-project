export const damp = (current, target, speed, dt) => current + (target - current) * (1 - Math.exp(-speed * dt))
export const easeInOut = (value) => value * value * (3 - 2 * value)

export function createEntity(tag, attrs = {}, parent) {
  const el = document.createElement(tag)
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value))
  if (parent) parent.appendChild(el)
  return el
}
