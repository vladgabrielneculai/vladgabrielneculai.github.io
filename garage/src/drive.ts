// "Drive into the city": the Mazda reverses out through the garage door, swings onto the
// street and drives off; the screen fades to black and a contact form opens. Closing the
// form brings the car back down the street and into the garage.
//
// Distances in metres, in the garage floor plane: x across, z along (the car normally sits
// at the origin facing +z; the door is behind it at z = -13; the near lane runs along
// z = -15.45). The motion follows a simple car model: the rear axle rolls along a path whose
// curvature only ever changes gradually (as a driver winds the wheel on and off), the front
// wheels are steered to exactly that curvature, and speed changes smoothly.
import { rattle, starter } from './sound'
import { OPEN_TIME, useStore } from './store'

export const WHEELBASE = 2.735
export const REAR = 1.5 // the car's origin sits this far ahead of its rear axle
const LANE = -15.45 // near-lane centre (Japan drives on the left: this lane runs west)
const LOCK = 1 / 4.6 // tightest curvature used: a 4.6 m turning radius
const WIND = 2.2 // metres over which the wheel is wound on, and off again
const STEP = 0.02 // path sample spacing

// ---- the reverse manoeuvre, sampled along the rear axle's path

type Sample = { x: number; z: number; yaw: number; k: number }

// Back out straight for `straight` metres, then round 90° (curvature ramps up, holds, ramps
// down), ending facing west.
function trace(straight: number) {
  const hold = Math.PI / 2 / LOCK - WIND
  const total = straight + 2 * WIND + hold
  const out: Sample[] = []
  let x = 0
  let z = -REAR
  let yaw = 0
  for (let i = 0; i * STEP <= total + 1e-9; i++) {
    const a = i * STEP - straight
    const k = a <= 0 ? 0 : a < WIND ? (LOCK * a) / WIND : a < WIND + hold ? LOCK : Math.max(0, LOCK * (1 - (a - WIND - hold) / WIND))
    out.push({ x, z, yaw, k })
    // reversing: the axle moves against its heading, and the heading turns against the curvature
    x -= Math.sin(yaw) * STEP
    z -= Math.cos(yaw) * STEP
    yaw -= k * STEP
  }
  return out
}
// The straight is chosen so the turn ends with the car centred in the near lane.
const PATH = (() => {
  const turn = trace(0)
  const drop = turn[turn.length - 1].z - turn[0].z // how far back the turn itself carries it
  return trace(Math.max(0, -REAR + drop - LANE))
})()
const LENGTH = (PATH.length - 1) * STEP

function along(s: number) {
  const f = Math.min(PATH.length - 1, Math.max(0, s / STEP))
  const i = Math.floor(f)
  const a = PATH[i]
  const b = PATH[Math.min(PATH.length - 1, i + 1)]
  const t = f - i
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: a.yaw + (b.yaw - a.yaw) * t, k: a.k + (b.k - a.k) * t }
}

// ---- speed: smooth (sinusoidal) acceleration up to a cruising speed and back down to rest

function profile(distance: number, vmax: number, ramp: number) {
  const v = Math.min(vmax, distance / ramp)
  const cruise = (distance - v * ramp) / v
  const time = 2 * ramp + cruise
  const up = (t: number) => v * (t / 2 - (ramp / (2 * Math.PI)) * Math.sin((Math.PI * t) / ramp))
  const vUp = (t: number) => (v * (1 - Math.cos((Math.PI * t) / ramp))) / 2
  return {
    time,
    s: (t: number) => (t <= 0 ? 0 : t < ramp ? up(t) : t < ramp + cruise ? (v * ramp) / 2 + v * (t - ramp) : t < time ? distance - up(time - t) : distance),
    v: (t: number) => (t <= 0 || t >= time ? 0 : t < ramp ? vUp(t) : t < ramp + cruise ? v : vUp(time - t)),
  }
}
const OUT = profile(LENGTH, 2.4, 2.3) // reversing out
const IN = profile(LENGTH, 2.6, 2.3) // driving back in
// Pulling away westward: the throttle comes in smoothly, up to 43 km/h.
const TOP = 12
const RAMP = 4.2
const RUN = (TOP * RAMP) / 2
const GONE = RUN + 12 // far enough down the street to be out of sight
const PULL = RAMP + 12 / TOP
// Coming back from the east end, braking smoothly to a stop where it left.
const BACK = 26
const T_BACK = 4.6
const FADE_AT = -6.5 // once the car is past the left side of the doorway, fade to black

export type Phase = 'home' | 'starting' | 'waiting' | 'reverse' | 'shift' | 'drive' | 'away' | 'arrive' | 'park'

export const drive = {
  phase: 'home' as Phase,
  t: 0, // seconds into the current phase
  // the car's pose: origin position, heading (0 = facing +z, as parked), path curvature,
  // front-wheel angle, speed along its own forward axis (negative in reverse), acceleration
  x: 0,
  y: 0, // height of the ground under the car (set by the car from its four wheels)
  z: 0,
  yaw: 0,
  k: 0,
  steer: 0,
  speed: 0,
  accel: 0,
  roll: 0, // metres rolled, for turning the wheels
  cam: 0, // 0..1: where along its rail the camera watching the drive should be
  s: 0, // metres along the reverse manoeuvre's path (its full length once out on the street)
  started: false, // the engine was off and the drive started it
  instant: false, // reduced motion: no drive, just the form
  faded: false, // this drive has already faded to black and opened the form
  street: false, // set by the street while a passing car goes by
  closeUp: false, // set by the camera while it films the drive from out on the pavement (phones)
}

// The car is on the move (or about to be): not parked, and not away behind the black screen.
export const driving = () => drive.phase !== 'home' && drive.phase !== 'away'

// Place the car from its rear axle's point on the path.
function onPath(s: number) {
  const p = along(s)
  drive.x = p.x + Math.sin(p.yaw) * REAR
  drive.z = p.z + Math.cos(p.yaw) * REAR
  drive.yaw = p.yaw
  drive.k = p.k
  drive.s = s
}
onPath(LENGTH)
const END = { x: drive.x, z: drive.z, yaw: drive.yaw } // stopped in the lane, facing west
onPath(0)

// Along the street from where it stopped (positive: east).
function onStreet(dx: number) {
  Object.assign(drive, END, { x: END.x + dx, k: 0, s: LENGTH })
}

function go(p: Phase) {
  drive.phase = p
  drive.t = 0
}

// The visitor asked for the drive. Ignored unless the car is parked.
export function leave() {
  const s = useStore.getState()
  if (drive.phase !== 'home') return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    drive.instant = true
    s.set({ out: true, cinema: true, contactForm: true })
    go('away')
    return
  }
  drive.instant = false
  drive.faded = false
  drive.started = !s.engine
  if (!s.engine) starter(0.85)
  // the door rolls up first if it is down
  if (!s.shutter) rattle(OPEN_TIME)
  s.set({ shutter: true, out: true, cinema: true, engine: true, lights: true, rev: false, adjust: false, open: { hood: false, trunk: false, doorFL: false, doorFR: false, doorBL: false, doorBR: false } })
  go('starting')
}

// ?drive=out,3.5 or ?drive=in,2 holds the drive that many seconds into the way out or back
// (used for captures).
const HOLD = (() => {
  const v = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('drive') : null
  if (!v) return null
  const [way, at] = v.split(',')
  const phases: [Phase, number][] = way === 'in' ? [['arrive', T_BACK], ['park', IN.time]] : [['reverse', OUT.time], ['shift', 0.8], ['drive', PULL]]
  return { phases, at: Number(at) || 0 }
})()

// Advance the drive by dt seconds. Called once per frame by the car.
export function step(dt: number) {
  const st = useStore.getState()
  dt = Math.min(dt, 1 / 20) // a slow frame must not make the car jump
  if (HOLD) {
    let at = HOLD.at
    for (const [i, [phase, length]] of HOLD.phases.entries()) {
      if (at <= length || i === HOLD.phases.length - 1) {
        drive.phase = phase
        drive.t = Math.min(at, length - 1e-3)
        break
      }
      at -= length
    }
    dt = 0
    if (!st.shutter || !st.cinema) st.set({ shutter: true, out: true, cinema: true })
  }
  drive.t += dt
  const t = drive.t
  const before = drive.speed
  switch (drive.phase) {
    case 'home':
      drive.speed = 0
      drive.cam = 0
      break
    case 'starting':
      // let the engine catch and the door roll up, then wait for any passing car to clear
      drive.speed = 0
      if (t > (drive.started ? 1.9 : 0.5) && st.doorUp) go(drive.street ? 'waiting' : 'reverse')
      break
    case 'waiting':
      if (!drive.street) go('reverse')
      break
    case 'reverse': {
      const s = OUT.s(t)
      onPath(s)
      drive.speed = -OUT.v(t)
      drive.cam = 0.62 * (s / LENGTH)
      if (t >= OUT.time) go('shift')
      break
    }
    case 'shift':
      // stopped in the lane: into first
      onPath(LENGTH)
      drive.speed = 0
      if (t > 0.8) go('drive')
      break
    case 'drive': {
      // pull away westward; the throttle comes in smoothly, then holds
      const v = t < RAMP ? (TOP * (1 - Math.cos((Math.PI * t) / RAMP))) / 2 : TOP
      const dist = t < RAMP ? TOP * (t / 2 - (RAMP / (2 * Math.PI)) * Math.sin((Math.PI * t) / RAMP)) : RUN + TOP * (t - RAMP)
      onStreet(-dist)
      drive.speed = v
      drive.cam = 0.62 + 0.38 * Math.min(1, dist / 14)
      if (!HOLD && drive.x < FADE_AT && !drive.faded) {
        drive.faded = true
        st.set({ contactForm: true })
      }
      // gone, or the form was closed before the car got there: either way it comes back
      if (dist > GONE || (drive.faded && !st.contactForm)) go('away')
      break
    }
    case 'away':
      drive.speed = 0
      if (!st.contactForm) {
        if (drive.instant) {
          go('home')
          st.set({ out: false, cinema: false })
        } else go('arrive')
      }
      break
    case 'arrive': {
      // back from the east end of the street, braking smoothly to a stop where it left
      const u = Math.min(1, t / T_BACK)
      onStreet(BACK * (1 - u) ** 3)
      drive.speed = ((3 * BACK) / T_BACK) * (1 - u) ** 2
      drive.cam = 1
      if (u >= 1) go('park')
      break
    }
    case 'park': {
      // the reverse manoeuvre in reverse: forwards off the street and into the bay
      const s = LENGTH - IN.s(t)
      onPath(s)
      drive.speed = IN.v(t)
      drive.cam = 0.62 * (s / LENGTH) + 0.38 * Math.max(0, 1 - IN.s(t) / 4)
      if (t >= IN.time) {
        onPath(0)
        drive.speed = 0
        go('home')
        st.set(drive.started ? { out: false, cinema: false, engine: false } : { out: false, cinema: false })
      }
      break
    }
  }
  drive.steer = Math.atan(drive.k * WHEELBASE)
  drive.accel = dt > 0 ? (drive.speed - before) / dt : 0
  drive.roll += drive.speed * dt
}

// Ground height under a point: garage floor and pavements at 0, the road a kerb lower. The
// step is rounded over 20 cm, the way a tyre rolls off it.
const KERB = 0.12
const smooth = (v: number) => {
  const c = Math.min(1, Math.max(0, v))
  return c * c * (3 - 2 * c)
}
export function ground(z: number) {
  return -KERB * (smooth((-14.2 + 0.1 - z) / 0.2) - smooth((-19.2 + 0.1 - z) / 0.2))
}
