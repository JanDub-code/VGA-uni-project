export function springValue(current, velocity, target, stiffness, damping, dt) {
  const force = (target - current) * stiffness
  const nextVelocity = (velocity + force * dt) * Math.exp(-damping * dt)
  return {
    value: current + nextVelocity * dt,
    velocity: nextVelocity,
  }
}

export function expSmoothingFactor(speed, dt) {
  return 1 - Math.exp(-speed * dt)
}
