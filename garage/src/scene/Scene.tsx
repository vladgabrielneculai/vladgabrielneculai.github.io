import { Bvh, OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as Controls } from 'three-stdlib'
import type { Tab } from '../data'
import { INTRO_END, intro, useStore } from '../store'
import { Car } from './Car'
import { Garage } from './Garage'

// Where the car turns to for each tab: azimuth and elevation in degrees, distance in metres.
const VIEWS: Record<Tab, { az: number; el: number; r: number }> = {
  home: { az: 38, el: 9, r: 8.8 },
  about: { az: 78, el: 8, r: 8.4 },
  experience: { az: 148, el: 11, r: 8.4 },
  projects: { az: -42, el: 7, r: 7.4 },
  skills: { az: 12, el: 24, r: 8 },
  contact: { az: -140, el: 10, r: 8.4 },
}
const TARGET = new THREE.Vector3(0, 0.62, 0)

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
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]} scale={[2.9, 5.6, 1]} renderOrder={1}>
      <planeGeometry />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

// Driver's seat (left-hand drive): where the camera sits for "About me", what it looks at,
// and the point outside the open door it passes through on the way in.
const HEAD = new THREE.Vector3(0.37, 1.15, -0.3)
const AHEAD = new THREE.Vector3(0.3, 0.97, 1.4)
const DOORWAY = new THREE.Vector3(2.4, 1.3, -0.55)
const REACH = 0.15

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
  }, [tab])
  useEffect(() => {
    if (!inside) moving.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portrait])

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
    const panel = tab !== 'home'
    const playing = intro.t < INTRO_END
    easing.damp(off.current, 'x', portrait || playing ? 0 : size.width * (panel ? 0.17 : -0.19), playing ? 0.01 : 0.3, dt)
    // On phones the car sits above the sheet; with the sheet swiped down it gets the screen back.
    const lifted = panel && sheet !== 'peek'
    easing.damp(off.current, 'y', portrait ? size.height * (!lifted ? 0.14 : inside ? 0.3 : 0.27) : 0, 0.3, dt)
    cam.fov = portrait ? 50 : inside ? 42 : 30
    cam.setViewOffset(size.width, size.height, off.current.x, off.current.y, size.width, size.height)

    if (!moving.current) return
    const c = controls.current

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
        c.maxDistance = 11.2
        c.minPolarAngle = 0.5
        c.maxPolarAngle = Math.PI / 2 - 0.03
        c.enabled = true
      }
    }
  })

  return <OrbitControls ref={controls as never} enabled={false} target={TARGET} enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.6} />
}

export function Scene() {
  // ?dpr=2 pins the resolution (used for captures); otherwise it adapts to the device.
  const pinned = Number(new URLSearchParams(location.search).get('dpr')) || 0
  const [dpr, setDpr] = useState(pinned || Math.min(innerWidth < 768 ? 1.5 : 1.75, window.devicePixelRatio))
  return (
    <Canvas
      // Seated with the driver's door open, a tap on the garage outside gets you out.
      // (Taps that land on the car itself never reach this.)
      onPointerMissed={() => {
        const s = useStore.getState()
        if (s.tab === 'about' && s.open.doorFL) s.set({ tab: 'home' })
      }}
      dpr={dpr} gl={{ antialias: true, powerPreference: 'high-performance', toneMappingExposure: 0.82 }} camera={{ fov: 30, near: 0.04, far: 80, position: [0.6, 0.5, 11.2] }}>
      {!pinned && <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(0.9, d - 0.25))} onIncline={() => setDpr((d) => Math.min(1.75, d + 0.25))} />}
      <Suspense fallback={null}>
        <Garage />
        <Bvh firstHitOnly>
          <Car />
        </Bvh>
        <GroundShadow />
      </Suspense>
      <Rig />
    </Canvas>
  )
}
