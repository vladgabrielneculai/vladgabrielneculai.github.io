import { Bvh, OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
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

function Rig() {
  const { camera, size } = useThree()
  const cam = camera as THREE.PerspectiveCamera
  const tab = useStore((s) => s.tab)
  const ready = useStore((s) => s.ready)
  const controls = useRef(null)
  const moving = useRef(true)
  const off = useRef({ x: 0, y: 0 })
  const sph = useMemo(() => new THREE.Spherical(), [])
  const rel = useMemo(() => new THREE.Vector3(), [])
  const portrait = size.width / size.height < 0.9
  // ?cam=x,y,z,tx,ty,tz pins the camera (used for close-up captures).
  const pinned = useMemo(() => new URLSearchParams(location.search).get('cam')?.split(',').map(Number), [])
  // ?intro=1.8 holds the opening sequence at that second.
  const frozen = useMemo(() => {
    const v = new URLSearchParams(location.search).get('intro')
    return v === null ? null : Number(v)
  }, [])

  useEffect(() => {
    moving.current = true
  }, [tab, portrait])

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
    easing.damp(off.current, 'y', portrait ? size.height * (panel ? 0.24 : 0.08) : 0, 0.3, dt)
    cam.fov = portrait ? 50 : 30
    cam.setViewOffset(size.width, size.height, off.current.x, off.current.y, size.width, size.height)

    if (!moving.current) return
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
    if (!playing && Math.abs(sph.theta - goal.theta) + Math.abs(sph.phi - goal.phi) + Math.abs(sph.radius - goal.radius) < 0.002) moving.current = false
  })

  return (
    <OrbitControls
      ref={controls}
      enabled={!pinned}
      target={TARGET}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      minDistance={4.5}
      maxDistance={11.2}
      minPolarAngle={0.5}
      maxPolarAngle={Math.PI / 2 - 0.03}
      onStart={() => (moving.current = false)}
    />
  )
}

export function Scene() {
  // ?dpr=2 pins the resolution (used for captures); otherwise it adapts to the device.
  const pinned = Number(new URLSearchParams(location.search).get('dpr')) || 0
  const [dpr, setDpr] = useState(pinned || Math.min(1.75, window.devicePixelRatio))
  return (
    <Canvas dpr={dpr} gl={{ antialias: true, powerPreference: 'high-performance', toneMappingExposure: 0.82 }} camera={{ fov: 30, near: 0.1, far: 80, position: [0.6, 0.5, 11.2] }}>
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
