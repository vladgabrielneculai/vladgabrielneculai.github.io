import { Bvh, OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as Controls } from 'three-stdlib'
import type { Tab } from '../data'
import { drive, driving } from '../drive'
import { INTRO_END, intro, useStore } from '../store'
import { Car } from './Car'
import { BAYS, Display } from './Display'
import { Garage } from './Garage'

// Where the car turns to for each tab: azimuth and elevation in degrees, distance in metres.
const VIEWS: Record<Tab, { az: number; el: number; r: number }> = {
  home: { az: 38, el: 9, r: 8.8 },
  about: { az: 78, el: 8, r: 8.4 },
  experience: { az: 148, el: 11, r: 8.4 },
  projects: { az: -42, el: 7, r: 7.4 },
  skills: { az: 12, el: 24, r: 8 },
  contact: { az: -152, el: 10, r: 8.4 }, // clear of the Impreza on its lift
}
const TARGET = new THREE.Vector3(0, 0.62, 0)
const MAX_R = 11.2

// How far the camera may orbit out along the horizontal direction (dx, dz) before it would
// enter a bay with a parked car: where the ray from the car first meets a bay rectangle.
function reach(dx: number, dz: number) {
  let best = Infinity
  for (const b of BAYS) {
    let near = 0
    let far = Infinity
    for (const [o, d, h] of [[b.x, dx, b.hx], [b.z, dz, b.hz]]) {
      if (Math.abs(d) < 1e-6) {
        if (Math.abs(o) > h) near = Infinity
        continue
      }
      const t1 = (o - h) / d
      const t2 = (o + h) / d
      near = Math.max(near, Math.min(t1, t2))
      far = Math.min(far, Math.max(t1, t2))
    }
    if (near <= far) best = Math.min(best, near)
  }
  return best
}

// Soft shadow under the car: one painted texture instead of re-rendering the car from below
// every frame. A broad pool under the body plus a tighter, darker contact patch at each tyre.
function GroundShadow() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 512
    const g = c.getContext('2d')!
    const blob = (x: number, y: number, rx: number, ry: number, a: number) => {
      g.save()
      g.translate(x, y)
      g.scale(rx, ry)
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1)
      grad.addColorStop(0, `rgba(0,0,0,${a})`)
      grad.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`)
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grad
      g.fillRect(-1, -1, 2, 2)
      g.restore()
    }
    blob(128, 256, 114, 236, 0.78)
    // texture v runs front (top) to rear (bottom); wheel centres measured from the model
    for (const [x, y] of [[57, 136], [199, 136], [59, 387], [197, 387]]) blob(x, y, 30, 42, 0.6)
    return new THREE.CanvasTexture(c)
  }, [])
  // it goes where the car goes
  const follow = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!follow.current) return
    follow.current.position.set(drive.x, drive.y, drive.z)
    follow.current.rotation.y = drive.yaw
  })
  return (
    <group ref={follow}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]} scale={[2.9, 5.6, 1]} renderOrder={1}>
        <planeGeometry />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

// Phones: tilting the phone left or right turns the garage a few degrees, like looking round
// the car. Only while the camera is parked outside it.
function Tilt({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const want = useRef(0)
  const tilt = useStore((s) => s.tilt)
  useEffect(() => {
    want.current = 0
    if (!tilt) return
    let level: number | null = null
    const on = (e: DeviceOrientationEvent) => {
      if (e.gamma == null) return
      // what counts as level drifts towards how the phone is held, so a new grip soon settles
      level = level === null ? e.gamma : level + (e.gamma - level) * 0.01
      want.current = THREE.MathUtils.clamp((e.gamma - level) / 25, -1, 1)
    }
    addEventListener('deviceorientation', on)
    return () => removeEventListener('deviceorientation', on)
  }, [tilt])
  useFrame((_, dt) => {
    if (!group.current) return
    const st = useStore.getState()
    const calm = st.tilt && st.tab !== 'about' && !st.cinema && !driving()
    easing.damp(group.current.rotation, 'y', calm ? want.current * 0.13 : 0, 0.3, dt)
  })
  return <group ref={group}>{children}</group>
}

// Before the garage is shown: every shader compiled and every texture on the GPU, including
// what is hidden for now (the street behind the shutter, the passing cars), so nothing
// stalls a frame the first time it appears. Then the loading screen lifts.
function Warmup() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    let cancelled = false
    // give the street a couple of frames to paint its textures and mount the passing cars
    const wait = (n: number) => new Promise<void>((done) => (n <= 0 ? done() : requestAnimationFrame(() => wait(n - 1).then(done))))
    ;(async () => {
      await wait(3)
      const hidden: THREE.Object3D[] = []
      scene.traverse((o) => {
        if (!o.visible) {
          hidden.push(o)
          o.visible = true
        }
        for (const m of [(o as THREE.Mesh).material].flat())
          if (m) for (const v of Object.values(m)) if (v instanceof THREE.Texture) gl.initTexture(v)
      })
      try {
        await gl.compileAsync(scene, camera)
      } catch {
        // compiling up front is only an optimisation
      }
      for (const o of hidden) o.visible = false
      await wait(2)
      if (!cancelled) useStore.getState().set({ ready: true })
    })()
    return () => {
      cancelled = true
    }
  }, [gl, scene, camera])
  return null
}

// Driver's seat (left-hand drive): where the camera sits for "About me", what it looks at,
// and the point outside the open door it passes through on the way in.
const HEAD = new THREE.Vector3(0.37, 1.15, -0.3)
const AHEAD = new THREE.Vector3(0.3, 0.97, 1.4)
const DOORWAY = new THREE.Vector3(2.4, 1.3, -0.55)
const REACH = 0.15
// The rail the camera rides while the car drives out: low in front of it, then towards the
// door. Phones stand further back to fit the narrow screen.
const RAIL = new THREE.CatmullRomCurve3([new THREE.Vector3(2.4, 1.05, 6.6), new THREE.Vector3(2.1, 1.2, 1.5), new THREE.Vector3(1.8, 1.3, -3.5), new THREE.Vector3(1.2, 1.45, -8)])
const RAIL_PHONE = new THREE.CatmullRomCurve3([new THREE.Vector3(2.2, 1.4, 10.5), new THREE.Vector3(1.9, 1.5, 4.5), new THREE.Vector3(1.6, 1.6, -1), new THREE.Vector3(1.1, 1.7, -6)])

function Rig() {
  const { camera, size } = useThree()
  const cam = camera as THREE.PerspectiveCamera
  const tab = useStore((s) => s.tab)
  const ready = useStore((s) => s.ready)
  const controls = useRef<Controls>(null)
  const moving = useRef(true)
  const stage = useRef(0) // getting in: 0 = walk to the door, 1 = sit down
  const leaving = useRef(false) // getting out through the driver's door
  const wasInside = useRef(false)
  const sheet = useStore((s) => s.sheet)
  const cinema = useStore((s) => s.cinema)
  const story = useStore((s) => s.story)
  // Bumped when the car is back from a drive, to set the camera off for the current tab again.
  const [lap, setLap] = useState(0)
  const wasDriving = useRef(false)
  const off = useRef({ x: 0, y: 0 })
  const sph = useMemo(() => new THREE.Spherical(), [])
  const rel = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => TARGET.clone(), [])
  const portrait = size.width / size.height < 0.9
  const inside = tab === 'about'
  // ?cam=x,y,z,tx,ty,tz pins the camera (used for close-up captures).
  const pinned = useMemo(() => new URLSearchParams(location.search).get('cam')?.split(',').map(Number), [])
  // ?intro=1.8 holds the opening sequence at that second.
  const frozen = useMemo(() => {
    const v = new URLSearchParams(location.search).get('intro')
    return v === null ? null : Number(v)
  }, [])

  const setDoor = (open: boolean) => {
    const s = useStore.getState()
    if (s.open.doorFL !== open) s.set({ open: { ...s.open, doorFL: open } })
  }

  // While the camera travels, the orbit limits are lifted so they cannot pull it back.
  useEffect(() => {
    const c = controls.current
    if (c) {
      c.enabled = false
      c.minDistance = 0.01
      c.maxDistance = 60
      c.minPolarAngle = 0.02
      c.maxPolarAngle = Math.PI - 0.02
      if (!inside) c.target.copy(TARGET)
    }
    moving.current = true
    stage.current = 0
    if (inside) {
      look.copy(TARGET)
      setDoor(true)
    } else if (wasInside.current) {
      // Leaving the seat: open the door and step out before going anywhere else.
      leaving.current = true
      look.copy(cam.position).add(cam.getWorldDirection(rel))
      setDoor(true)
    }
    wasInside.current = inside
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, lap])
  useEffect(() => {
    if (!inside) moving.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portrait])

  // While the pointer is dragging, stop hit-testing the car on every move: that work is
  // only needed for hovering and clicking, and it competes with drawing the next frame.
  const { gl, setEvents } = useThree()
  useEffect(() => {
    const el = gl.domElement
    let from: [number, number] | null = null
    const down = (e: PointerEvent) => (from = [e.clientX, e.clientY])
    const move = (e: PointerEvent) => {
      if (from && Math.hypot(e.clientX - from[0], e.clientY - from[1]) > 6) {
        from = null
        setEvents({ enabled: false })
      }
    }
    const up = () => {
      from = null
      setTimeout(() => setEvents({ enabled: true }), 0)
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [gl, setEvents])

  useFrame((_, dt) => {
    // Opening sequence: the clock starts once the car has loaded.
    if (frozen !== null) intro.t = frozen
    else if (ready && intro.t < INTRO_END) intro.t += dt
    const st = useStore.getState()
    if (intro.t > 0.5 && !intro.lit) {
      intro.lit = true
      st.set({ lights: true })
    }
    if (intro.t >= INTRO_END && st.intro) st.set({ intro: false })
    if (pinned) {
      cam.position.set(pinned[0], pinned[1], pinned[2])
      cam.lookAt(pinned[3], pinned[4], pinned[5])
      return
    }

    // Keep the car clear of the copy: right of the headline on the home screen, left of the
    // content panel otherwise, and up on phones.
    const panel = tab !== 'home' && !cinema
    const playing = intro.t < INTRO_END
    // (during the drive the car has the whole, centred frame)
    // (on phones the garage has a stage of its own above the page: nothing to keep clear of)
    easing.damp(off.current, 'x', story || portrait || playing || cinema ? 0 : size.width * (panel ? 0.17 : -0.19), playing ? 0.01 : 0.3, dt)
    // On phones the car sits above the sheet; with the sheet swiped down it gets the screen back.
    const lifted = panel && sheet !== 'peek'
    easing.damp(off.current, 'y', portrait && !cinema && !story ? size.height * (!lifted ? 0.14 : inside ? 0.3 : 0.27) : 0, 0.3, dt)
    // the phone stage is about square: a wider lens keeps the whole car in it
    cam.fov = portrait ? 50 : story ? (inside ? 58 : 40) : inside ? 42 : 30
    cam.setViewOffset(size.width, size.height, off.current.x, off.current.y, size.width, size.height)

    // While the car is on the move, the camera stands inside the garage and watches it go
    // out through the door (or come back in).
    if (driving()) {
      wasDriving.current = true
      if (controls.current) controls.current.enabled = false
      // The camera glides along a rail from in front of the car towards the door as the car
      // goes, keeping it in frame; once it is out on the street, the camera watches through
      // the doorway.
      const step = Math.min(dt, 1 / 20)
      easing.damp3(cam.position, (portrait ? RAIL_PHONE : RAIL).getPoint(drive.cam, rel), 0.55, step)
      rel.set(THREE.MathUtils.clamp(drive.x, -4.2, 4.2), 0.75 + drive.y, Math.max(drive.z, -16))
      easing.damp3(look, rel, 0.3, step)
      cam.lookAt(look)
      return
    }
    if (wasDriving.current) {
      wasDriving.current = false
      setLap((l) => l + 1)
    }

    const c = controls.current
    if (!moving.current) {
      // Orbiting freely: pull the outer limit in where a parked car is in the way.
      if (c && !inside) {
        rel.copy(cam.position).sub(TARGET)
        const h = Math.hypot(rel.x, rel.z)
        if (h > 1e-3) {
          const room = reach(rel.x / h, rel.z / h) - 0.1
          const s = h / rel.length() // sin of the polar angle: horizontal share of the radius
          c.maxDistance = Math.max(c.minDistance, Math.min(MAX_R, room / s))
        }
      }
      return
    }

    if (leaving.current) {
      easing.damp3(cam.position, DOORWAY, 0.35, dt)
      easing.damp3(look, TARGET, 0.35, dt)
      cam.lookAt(look)
      if (cam.position.distanceTo(DOORWAY) < 0.45) {
        leaving.current = false
        setDoor(false)
      }
      return
    }

    if (inside) {
      // Through the open driver's door and into the seat.
      const goal = stage.current === 0 ? DOORWAY : HEAD
      easing.damp3(cam.position, goal, 0.4, dt)
      easing.damp3(look, stage.current === 0 ? HEAD : AHEAD, 0.4, dt)
      cam.lookAt(look)
      const d = cam.position.distanceTo(goal)
      if (stage.current === 0 && d < 0.4) stage.current = 1
      else if (stage.current === 1 && d < 0.012) {
        moving.current = false
        setDoor(false)
        if (c) {
          // Seated: dragging now turns the head instead of orbiting the car.
          c.target.copy(HEAD).addScaledVector(rel.copy(AHEAD).sub(HEAD).normalize(), REACH)
          c.minDistance = c.maxDistance = REACH
          c.minPolarAngle = 0.95
          c.maxPolarAngle = 2.05
          c.enabled = true
          c.update()
        }
      }
      return
    }

    const v = VIEWS[tab]
    const goal = { theta: (v.az * Math.PI) / 180, phi: ((90 - v.el) * Math.PI) / 180, radius: v.r * (portrait ? 1.3 : 1) }
    sph.setFromVector3(rel.copy(cam.position).sub(TARGET))
    // Turn the short way round.
    goal.theta = sph.theta + Math.atan2(Math.sin(goal.theta - sph.theta), Math.cos(goal.theta - sph.theta))
    // During the opening the camera waits in the dark, then glides in as the lights come on.
    const smooth = playing ? (intro.t < 1.2 ? 30 : 1.1) : 0.45
    easing.damp(sph, 'theta', goal.theta, smooth, dt)
    easing.damp(sph, 'phi', goal.phi, smooth, dt)
    easing.damp(sph, 'radius', goal.radius, smooth, dt)
    cam.position.setFromSpherical(sph).add(TARGET)
    cam.lookAt(TARGET)
    if (!playing && Math.abs(sph.theta - goal.theta) + Math.abs(sph.phi - goal.phi) + Math.abs(sph.radius - goal.radius) < 0.002) {
      moving.current = false
      if (c) {
        c.minDistance = 4.5
        c.maxDistance = MAX_R
        c.minPolarAngle = 0.5
        c.maxPolarAngle = Math.PI / 2 - 0.03
        c.enabled = true
      }
    }
  })

  return <OrbitControls ref={controls as never} enabled={false} target={TARGET} enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.6} />
}

export function Scene() {
  const ready = useStore((s) => s.ready)
  // Behind the black screen of the contact form there is nothing to draw.
  const dark = useStore((s) => s.dark)
  // ?dpr=2 pins the resolution (used for captures); otherwise it adapts to the device.
  const pinned = Number(new URLSearchParams(location.search).get('dpr')) || 0
  const top = innerWidth < 768 ? 1.25 : 1.5
  const [dpr, setDpr] = useState(pinned || Math.min(top, window.devicePixelRatio))
  return (
    <Canvas
      // Seated with the driver's door open, a tap on the garage outside gets you out.
      // (Taps that land on the car itself never reach this.)
      onPointerMissed={() => {
        const s = useStore.getState()
        if (s.tab === 'about' && s.open.doorFL && drive.phase === 'home') s.set({ tab: 'home' })
      }}
      frameloop={dark ? 'never' : 'always'}
      dpr={dpr} gl={{ antialias: true, powerPreference: 'high-performance', toneMappingExposure: 0.82 }} camera={{ fov: 30, near: 0.04, far: 80, position: [0.6, 0.5, 11.2] }}>
      {/* Too slow: first render fewer pixels, then give up the mirrored floor. It never steps back
          up: changing resolution back and forth is itself a visible hitch. */}
      {/* (it only starts watching once the garage is on screen: the warm-up frames are slow) */}
      {!pinned && ready && (
        <PerformanceMonitor
          onDecline={() =>
            setDpr((d) => {
              if (d > 1) return d - 0.25
              useStore.getState().set({ lite: true })
              return d
            })
          }
        />
      )}
      <Tilt>
        {/* everything loads together, then warms up, behind the loading screen */}
        <Suspense fallback={null}>
          <Garage />
          <Bvh firstHitOnly>
            <Car />
          </Bvh>
          <GroundShadow />
          <Display />
          <Warmup />
        </Suspense>
      </Tilt>
      <Rig />
    </Canvas>
  )
}
