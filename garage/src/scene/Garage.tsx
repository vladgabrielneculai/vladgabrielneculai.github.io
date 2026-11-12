import { Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { intro } from '../store'
import { Props } from './Props'

export const ROOM = { x: 12, z: 13, h: 4.2 }
const BARS = [-8, -4, 0, 4, 8] // ceiling light strips, back to front

// How bright ceiling strip i is, t seconds into the intro: off, a flicker as the tube
// strikes, then steady.
export function barLevel(i: number, t: number) {
  const on = 1.3 + i * 0.34
  if (t < on) return 0
  if (t < on + 0.07) return 1
  if (t < on + 0.16) return 0.12
  return 1
}

function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat: [number, number] = [1, 1]) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  t.anisotropy = 8
  return t
}

// Fine speckle so large flat surfaces do not read as plain colour.
function grain(g: CanvasRenderingContext2D, w: number, h: number, n: number, a: number) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${Math.random() * a})`
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2)
  }
}

function useTextures() {
  return useMemo(() => {
    // Painted concrete wall: darker dado, a red pinstripe, cast-panel seams.
    const wall = (repeat: number) =>
      tex(
        1024,
        512,
        (g) => {
          g.fillStyle = '#b9bcbf'
          g.fillRect(0, 0, 1024, 512)
          g.fillStyle = '#4c4f53'
          g.fillRect(0, 372, 1024, 140)
          g.fillStyle = '#b1121d'
          g.fillRect(0, 362, 1024, 10)
          grain(g, 1024, 512, 26000, 0.05)
          g.strokeStyle = 'rgba(0,0,0,0.16)'
          g.lineWidth = 2
          for (const x of [0, 512]) {
            g.beginPath()
            g.moveTo(x + 1, 0)
            g.lineTo(x + 1, 362)
            g.stroke()
          }
          g.beginPath()
          g.moveTo(0, 181)
          g.lineTo(1024, 181)
          g.stroke()
        },
        [repeat, 1],
      )
    // Sectional garage door: four ribbed panels.
    const door = tex(512, 512, (g) => {
      g.fillStyle = '#d4d6d8'
      g.fillRect(0, 0, 512, 512)
      for (let p = 0; p < 4; p++) {
        for (let r = 0; r < 4; r++) {
          const y = p * 128 + r * 32
          const grad = g.createLinearGradient(0, y, 0, y + 32)
          grad.addColorStop(0, 'rgba(255,255,255,0.35)')
          grad.addColorStop(0.75, 'rgba(0,0,0,0.05)')
          grad.addColorStop(1, 'rgba(0,0,0,0.28)')
          g.fillStyle = grad
          g.fillRect(0, y, 512, 32)
        }
        g.fillStyle = 'rgba(0,0,0,0.5)'
        g.fillRect(0, p * 128 + 125, 512, 3)
      }
      grain(g, 512, 512, 5000, 0.04)
    })
    return { side: wall(6), end: wall(5.5), door }
  }, [])
}

function Bar({ i, z }: { i: number; z: number }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null!)
  const light = useRef<THREE.PointLight>(null!)
  useFrame(() => {
    const k = barLevel(i, intro.t)
    mat.current.color.setScalar(0.03 + k * 3.2)
    light.current.intensity = k * 15
  })
  return (
    <group position={[0, ROOM.h - 0.06, z]}>
      <mesh>
        <boxGeometry args={[9.5, 0.05, 0.2]} />
        <meshBasicMaterial ref={mat} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[9.7, 0.05, 0.34]} />
        <meshStandardMaterial color="#1c1d1f" roughness={0.6} />
      </mesh>
      <pointLight ref={light} position={[0, -0.4, 0]} distance={17} decay={1.5} color="#f3f6ff" />
    </group>
  )
}

export function Garage() {
  const t = useTextures()
  useFrame(({ scene }) => {
    // The image-based light follows the strips as they come on.
    scene.environmentIntensity = 0.015 + (BARS.reduce((s, _, i) => s + barLevel(i, intro.t), 0) / BARS.length) * 0.985
  })

  return (
    <>
      <color attach="background" args={['#070809']} />

      {/* What the paint and chrome reflect: the same room, drawn once. */}
      <Environment resolution={512} frames={1}>
        <color attach="background" args={['#3a3c3f']} />
        {BARS.map((z) => (
          <Lightformer key={z} form="rect" intensity={11} color="#f3f6ff" position={[0, ROOM.h, z]} rotation-x={Math.PI / 2} scale={[9.5, 0.34, 1]} />
        ))}
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
          <planeGeometry args={[ROOM.x * 2, ROOM.z * 2]} />
          <meshBasicMaterial color="#26282a" />
        </mesh>
        {[
          [0, -ROOM.z, 0, ROOM.x * 2],
          [0, ROOM.z, Math.PI, ROOM.x * 2],
          [-ROOM.x, 0, Math.PI / 2, ROOM.z * 2],
          [ROOM.x, 0, -Math.PI / 2, ROOM.z * 2],
        ].map(([x, z, r, w], i) => (
          <mesh key={i} position={[x, ROOM.h / 2, z]} rotation-y={r}>
            <planeGeometry args={[w, ROOM.h]} />
            <meshBasicMaterial color="#777a7e" />
          </mesh>
        ))}
        <mesh rotation-x={Math.PI / 2} position={[0, ROOM.h + 0.02, 0]}>
          <planeGeometry args={[ROOM.x * 2, ROOM.z * 2]} />
          <meshBasicMaterial color="#141516" />
        </mesh>
      </Environment>

      {/* Sealed concrete floor with a soft sheen */}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[ROOM.x * 2, ROOM.z * 2]} />
        <MeshReflectorMaterial resolution={innerWidth < 768 ? 512 : 1024} blur={[380, 110]} mixBlur={1} mixStrength={5} roughness={0.62} depthScale={0.9} minDepthThreshold={0.5} maxDepthThreshold={1.3} color="#3d4043" metalness={0.25} mirror={0} />
      </mesh>
      {/* Bay markings */}
      {[
        [-1.75, 0.6, 0.09, 6.4],
        [1.75, 0.6, 0.09, 6.4],
        [0, -2.6, 3.59, 0.09],
      ].map(([x, z, w, d], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.003, z]}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color="#e9eaeb" roughness={0.7} />
        </mesh>
      ))}

      {/* Walls and ceiling */}
      <mesh position={[0, ROOM.h / 2, -ROOM.z]}>
        <planeGeometry args={[ROOM.x * 2, ROOM.h]} />
        <meshStandardMaterial map={t.end} roughness={0.9} />
      </mesh>
      <mesh position={[0, ROOM.h / 2, ROOM.z]} rotation-y={Math.PI}>
        <planeGeometry args={[ROOM.x * 2, ROOM.h]} />
        <meshStandardMaterial map={t.end} roughness={0.9} />
      </mesh>
      <mesh position={[-ROOM.x, ROOM.h / 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[ROOM.z * 2, ROOM.h]} />
        <meshStandardMaterial map={t.side} roughness={0.9} />
      </mesh>
      <mesh position={[ROOM.x, ROOM.h / 2, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[ROOM.z * 2, ROOM.h]} />
        <meshStandardMaterial map={t.side} roughness={0.9} />
      </mesh>
      <mesh position={[0, ROOM.h, 0]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[ROOM.x * 2, ROOM.z * 2]} />
        <meshStandardMaterial color="#2a2c2e" roughness={0.95} />
      </mesh>
      {BARS.map((z, i) => (
        <Bar key={z} i={i} z={z} />
      ))}

      {/* Garage door behind the car */}
      <group position={[0, 0, -ROOM.z + 0.05]}>
        <mesh position={[0, 1.6, 0]}>
          <planeGeometry args={[6.4, 3.2]} />
          <meshStandardMaterial map={t.door} roughness={0.5} metalness={0.3} />
        </mesh>
        {[
          [-3.3, 1.65, 0.2, 3.3],
          [3.3, 1.65, 0.2, 3.3],
          [0, 3.3, 6.8, 0.2],
        ].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, 0.03]}>
            <boxGeometry args={[w, h, 0.1]} />
            <meshStandardMaterial color="#2b2d30" roughness={0.6} />
          </mesh>
        ))}
      </group>

      <Props room={ROOM} />

      <hemisphereLight args={['#ffffff', '#3a3c40', 0.12]} />
    </>
  )
}
