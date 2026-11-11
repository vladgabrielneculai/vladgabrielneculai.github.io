import { Bvh, Environment, Lightformer, OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as Controls } from 'three-stdlib'
import type { Tab } from '../data'
import { useStore } from '../store'
import { Car } from './Car'

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

// Soft studio shadow: one painted texture instead of re-rendering the car from below every
// frame. A broad pool under the body plus a tighter, darker contact patch at each tyre.
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
      grad.addColorStop(0, `rgba(12,14,18,${a})`)
      grad.addColorStop(0.55, `rgba(12,14,18,${a * 0.55})`)
      grad.addColorStop(1, 'rgba(12,14,18,0)')
      g.fillStyle = grad
      g.fillRect(-1, -1, 2, 2)
      g.restore()
    }
    blob(128, 256, 112, 232, 0.6)
    // texture v runs front (top) to rear (bottom); wheel centres measured from the model
    for (const [x, y] of [[57, 136], [199, 136], [59, 387], [197, 387]]) blob(x, y, 30, 42, 0.5)
    return new THREE.CanvasTexture(c)
  }, [])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]} scale={[2.9, 5.6, 1]} renderOrder={-1}>
      <planeGeometry />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function Rig() {
  const { camera, size } = useThree()
  const cam = camera as THREE.PerspectiveCamera
  const tab = useStore((s) => s.tab)
  const controls = useRef<Controls>(null)
  const moving = useRef(true)
  const off = useRef({ x: 0, y: 0 })
  const sph = useMemo(() => new THREE.Spherical(), [])
  const rel = useMemo(() => new THREE.Vector3(), [])
  const portrait = size.width / size.height < 0.9

  useEffect(() => {
    moving.current = true
  }, [tab, portrait])

  useFrame((_, dt) => {
    // Keep the car clear of the copy: right of the headline on the home screen, left of the
    // content panel otherwise, and up on phones.
    const panel = tab !== 'home'
    easing.damp(off.current, 'x', portrait ? 0 : size.width * (panel ? 0.17 : -0.19), 0.3, dt)
    easing.damp(off.current, 'y', portrait ? size.height * (panel ? 0.24 : 0.08) : 0, 0.3, dt)
    cam.setViewOffset(size.width, size.height, off.current.x, off.current.y, size.width, size.height)

    if (!moving.current) return
    const v = VIEWS[tab]
    const goal = { theta: (v.az * Math.PI) / 180, phi: ((90 - v.el) * Math.PI) / 180, radius: v.r * (portrait ? 2.3 : 1) }
    sph.setFromVector3(rel.copy(cam.position).sub(TARGET))
    // Turn the short way round.
    goal.theta = sph.theta + Math.atan2(Math.sin(goal.theta - sph.theta), Math.cos(goal.theta - sph.theta))
    easing.damp(sph, 'theta', goal.theta, 0.45, dt)
    easing.damp(sph, 'phi', goal.phi, 0.45, dt)
    easing.damp(sph, 'radius', goal.radius, 0.45, dt)
    cam.position.setFromSpherical(sph).add(TARGET)
    cam.lookAt(TARGET)
    if (Math.abs(sph.theta - goal.theta) + Math.abs(sph.phi - goal.phi) + Math.abs(sph.radius - goal.radius) < 0.002) moving.current = false
  })

  return (
    <OrbitControls
      ref={controls as never}
      target={TARGET}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      minDistance={4.5}
      maxDistance={portrait ? 21 : 10.5}
      minPolarAngle={0.5}
      maxPolarAngle={Math.PI / 2 - 0.03}
      onStart={() => (moving.current = false)}
    />
  )
}

export function Scene() {
  // ?dpr=2 pins the resolution (used for captures); otherwise it adapts to the device.
  const pinned = Number(new URLSearchParams(location.search).get('dpr')) || 0
  const [dpr, setDpr] = useState(pinned || Math.min(2, window.devicePixelRatio))
  return (
    <Canvas dpr={dpr} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} camera={{ fov: 30, near: 0.1, far: 80, position: [7.5, 2.6, 8.5] }}>
      {!pinned && <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(1, d - 0.25))} onIncline={() => setDpr((d) => Math.min(2, d + 0.25))} />}

      {/* Photo-studio lighting: a bright room with one big overhead softbox and long side strips. */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#d3d6da']} />
        <Lightformer form="rect" intensity={6} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[4.5, 11, 1]} />
        <Lightformer form="rect" intensity={10} position={[-6, 1.1, 0]} rotation-y={Math.PI / 2} scale={[14, 1.1, 1]} />
        <Lightformer form="rect" intensity={10} position={[6, 1.1, 0]} rotation-y={-Math.PI / 2} scale={[14, 1.1, 1]} />
        <Lightformer form="rect" intensity={3} position={[0, 2, 8]} rotation-y={Math.PI} scale={[9, 2, 1]} />
        <Lightformer form="rect" intensity={3} position={[0, 2, -8]} scale={[9, 2, 1]} />
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
          <planeGeometry args={[40, 40]} />
          <meshBasicMaterial color="#34373c" />
        </mesh>
      </Environment>
      <directionalLight position={[3, 6, 4]} intensity={0.6} />

      <Suspense fallback={null}>
        <Bvh firstHitOnly>
          <Car />
        </Bvh>
        <GroundShadow />
      </Suspense>
      <Rig />
    </Canvas>
  )
}
