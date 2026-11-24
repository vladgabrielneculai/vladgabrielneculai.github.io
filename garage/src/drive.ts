// "Take it into the city": the Mazda reverses out through the garage door, swings onto the
// street, and drives off; the Contact panel opens while it is out. When the visitor moves on,
// it comes back down the street and drives in nose first, the way you park.
//
// The path is in the car's ground plane: x across the garage, z along it (the car normally
// sits at the origin facing +z; the door is behind it at z = -13). Distances in metres.
import { starter } from './sound'
import { useStore } from './store'

const STRAIGHT = 10.85 // reverse straight back until the rear is past the door
const RADIUS = 4.6 // then reverse round onto the near lane, ending facing west
const ARC = (RADIUS * Math.PI) / 2
const BACK = STRAIGHT + ARC
const AWAY = 25 // drive west until well past the end of the painted street
const KERB = 0.12 // the road is this much lower than the garage floor and pavement
const STEER = 0.5 // front wheel angle on the arc, radians

const T_REVERSE = 7 // seconds for the whole reverse manoeuvre
const T_SHIFT = 0.7 // stopped, into first gear
const T_DRIVE = 3.6 // pulling away down the street
const T_ARRIVE = 3.2 // coming back down the street
const T_PARK = 7 // driving back in

export type Phase = 'home' | 'starting' | 'waiting' | 'reverse' | 'shift' | 'drive' | 'away' | 'arrive' | 'settle' | 'park'

export const drive = {
  phase: 'home' as Phase,
  t: 0, // seconds into the current phase
  // pose: position, heading (0 = facing +z, as parked), front wheel angle, speed along the
  // car's own forward axis (negative when reversing) and acceleration
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  steer: 0,
  speed: 0,
  accel: 0,
  roll: 0, // metres rolled, for the wheels
  started: false, // the engine was off and this started it
  street: false, // set by the street: a passing car is going by
}

// The car is on the move (or about to be): not parked, and not out of sight down the street.
export const driving = () => drive.phase !== 'home' && drive.phase !== 'away'

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
// Smooth start and stop over 0..1, and its slope.
const ease = (u: number) => u * u * (3 - 2 * u)
const easeSlope = (u: number) => 6 * u * (1 - u)

// Where the car is after `s` metres of the reverse manoeuvre.
function reversePose(s: number) {
  if (s <= STRAIGHT) return { x: 0, z: -s, yaw: 0, steer: STEER * ease(clamp01((s - STRAIGHT + 1.2) / 1.5)) }
  const a = s - STRAIGHT
  return {
    x: RADIUS * (1 - Math.cos(a / RADIUS)),
    z: -STRAIGHT - RADIUS * Math.sin(a / RADIUS),
    yaw: -a / RADIUS,
    steer: STEER * (1 - ease(clamp01((a - ARC + 1.2) / 1.2))),
  }
}
const END = reversePose(BACK) // stopped on the street, facing west

// Ask for the drive out. Ignored unless the car is parked.
export function leave() {
  const s = useStore.getState()
  if (drive.phase !== 'home') return
  drive.started = !s.engine
  if (!s.engine) starter(0.85)
  s.set({ out: true, engine: true, lights: true, rev: false, open: { hood: false, trunk: false, doorFL: false, doorFR: false, doorBL: false, doorBR: false } })
  go('starting')
}

function go(p: Phase) {
  drive.phase = p
  drive.t = 0
}

// ?drive=out,3.5 or ?drive=in,2 holds the drive that many seconds into the way out or back
// (used for captures).
const HOLD = (() => {
  const v = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('drive') : null
  if (!v) return null
  const [way, at] = v.split(',')
  return { phases: way === 'in' ? ([['arrive', T_ARRIVE], ['settle', 0.6], ['park', T_PARK]] as const) : ([['reverse', T_REVERSE], ['shift', T_SHIFT], ['drive', T_DRIVE]] as const), at: Number(at) || 0 }
})()

// Advance the drive by dt seconds. Called once per frame by the car.
export function step(dt: number) {
  const st = useStore.getState()
  if (HOLD) {
    let at = HOLD.at
    for (const [phase, length] of HOLD.phases) {
      if (at <= length || phase === HOLD.phases[2][0]) {
        drive.phase = phase
        drive.t = Math.min(at, length - 1e-3)
        break
      }
      at -= length
    }
    dt = 0
    if (!st.shutter) st.set({ shutter: true })
  }
  drive.t += dt
  const t = drive.t
  const before = drive.speed
  switch (drive.phase) {
    case 'home':
      drive.speed = 0
      break
    case 'away':
      drive.speed = 0
      if (st.tab !== 'contact') go('arrive')
      break
    case 'starting':
      // give the engine time to catch, then wait for any passing car
      if (t > (drive.started ? 1.8 : 0.4)) go(drive.street ? 'waiting' : 'reverse')
      break
    case 'waiting':
      if (!drive.street) go('reverse')
      break
    case 'reverse': {
      const u = clamp01(t / T_REVERSE)
      Object.assign(drive, reversePose(BACK * ease(u)))
      drive.speed = (-BACK * easeSlope(u)) / T_REVERSE
      if (u >= 1) go('shift')
      break
    }
    case 'shift':
      Object.assign(drive, END, { steer: STEER * (1 - ease(clamp01(t / T_SHIFT))) })
      drive.speed = 0
      if (t > T_SHIFT) go('drive')
      break
    case 'drive': {
      const u = clamp01(t / T_DRIVE)
      Object.assign(drive, END, { steer: 0, x: END.x - AWAY * u * u })
      drive.speed = (2 * AWAY * u) / T_DRIVE
      if (u >= 1) {
        go('away')
        st.set({ tab: 'contact' })
      }
      break
    }
    case 'arrive': {
      // back from the other end of the street, slowing to a stop where it left
      const u = clamp01(t / T_ARRIVE)
      Object.assign(drive, END, { steer: 0, x: END.x + AWAY * (1 - u) * (1 - u) })
      drive.speed = (2 * AWAY * (1 - u)) / T_ARRIVE
      if (u >= 1) go('settle')
      break
    }
    case 'settle':
      // wheels turned in, ready to pull into the garage
      Object.assign(drive, END, { steer: STEER * ease(clamp01(t / 0.6)) })
      drive.speed = 0
      if (t > 0.6) go('park')
      break
    case 'park': {
      // the reverse manoeuvre played backwards: forwards off the street and into the bay
      const u = clamp01(t / T_PARK)
      Object.assign(drive, reversePose(BACK * (1 - ease(u))))
      drive.speed = (BACK * easeSlope(u)) / T_PARK
      if (u >= 1) {
        Object.assign(drive, { x: 0, z: 0, yaw: 0, steer: 0, speed: 0 })
        go('home')
        st.set(drive.started ? { out: false, engine: false } : { out: false })
      }
      break
    }
  }
  drive.accel = (drive.speed - before) / Math.max(dt, 1e-3)
  drive.roll += drive.speed * dt
  // drop off the kerb onto the road as the car leaves the pavement
  drive.y = -KERB * ease(clamp01((-13.7 - drive.z) / 1.2))
}
