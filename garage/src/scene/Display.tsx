import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

// The other cars in the garage. Both models are by Ddiaz Design on Sketchfab, CC BY-NC-SA 4.0
// (credited in the Contact panel and in public/models/CREDITS.md).
export const BASE = `${import.meta.env.BASE_URL}models/`

// Lift arm height for the car that is up in the air, shared with the lift drawn in Jdm.tsx.
export const LIFT_UP = 1.2
// Top of the rubber pads above the carriage height (see Lift in Jdm.tsx).
const PAD_TOP = 0.125

type Spec = {
  file: string
  length: number // metres, bumper to bumper
  position: [number, number, number] // bay centre on the floor
  rotation: number // about y; 0 faces the front of the garage
  lift?: { height: number; sill: number } // raised on a lift: arm height and the car's sill height
  paint?: string // respray, sRGB
}

export const DISPLAY: Spec[] = [
  // 2006 Impreza WRX STI, up on the left lift, in WR Blue on its gold wheels.
  { file: 'impreza-sti.glb', length: 4.465, position: [-6.4, 0, -5], rotation: 0, lift: { height: LIFT_UP, sill: 0.2 }, paint: '#1c3f94' },
  // 2015 MX-5 (ND) parked in the right bay, in its Soul Red.
  { file: 'mx5.glb', length: 3.915, position: [6.4, 0, -5], rotation: 0 },
]

// Floor area the orbiting camera must stay out of around each parked car: the car plus the
// lift posts either side of it, with some room to spare.
export const BAYS = DISPLAY.map((s) => ({ x: s.position[0], z: s.position[2], hx: 1.75, hz: s.length / 2 + 0.15 }))

// Sketchfab exports glass as transmissive, which costs a second render of the whole scene
// every frame, and gives every part the physical shader's extra layers. Plain alpha and the
// standard shader look the same at this distance. Opaque parts that were exported as blended
// become cut-outs so they sort correctly.
// Returns a copy of the model at real size, wheels on the ground, centred, facing +z, with its
// own paint materials so each copy can be resprayed.
export function dress(scene: THREE.Object3D, length: number, colour?: string, wheels = false) {
  const root = scene.clone(true)
  const done = new Map<THREE.Material, THREE.Material>()
  const paints: THREE.MeshPhysicalMaterial[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const fix = (m: THREE.Material) => {
      const hit = done.get(m)
      if (hit) return hit
      const src = m as THREE.MeshPhysicalMaterial
      const paint = /CarPaint(Normal)?_Max/.test(src.name)
      // Only the paint keeps its clear coat; everything else gets the cheaper standard shader.
      const c = paint ? src.clone() : new THREE.MeshStandardMaterial().copy(src)
      const glass = src.transmission > 0 || /Glass_Window|LightGlass|SoftPlastic/.test(c.name)
      if (glass) {
        c.transparent = true
        c.depthWrite = false
        c.opacity = Math.max(c.opacity, /Clear/.test(c.name) ? 0.28 : /Window|SoftPlastic/.test(c.name) ? 0.38 : 0.55)
        c.roughness = Math.min(c.roughness, 0.05)
      } else if (c.transparent) {
        c.transparent = false
        c.alphaTest = 0.5
        c.depthWrite = true
      }
      if (paint && c instanceof THREE.MeshPhysicalMaterial) {
        if (colour) c.color.set(colour)
        paints.push(c)
        c.transmission = 0
        c.clearcoat = 1
        c.clearcoatRoughness = 0.04
      }
      c.envMapIntensity = 1
      done.set(m, c)
      return c
    }
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(fix) : fix(mesh.material)
  })

  const box = new THREE.Box3().setFromObject(root)
  root.scale.multiplyScalar(length / (box.max.z - box.min.z))
  box.setFromObject(root)
  const c = box.getCenter(new THREE.Vector3())
  root.position.sub(new THREE.Vector3(c.x, box.min.y, c.z))
  const car = new THREE.Group()
  car.add(root)
  return { car, paints, wheels: wheels ? splitWheels(car) : [] }
}

// The models come with all four wheels merged into a few meshes per material, so to make them
// turn, the wheel triangles are sorted by corner into four new meshes, each hung on a pivot at
// its hub. Brake calipers stay put. Works in the dressed car's space: x across, z along.
const ROLLING = /Tyre|Tire_Disk|Wheel1A|Rim/
function splitWheels(car: THREE.Group) {
  car.updateMatrixWorld(true)
  const meshes: THREE.Mesh[] = []
  car.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && !Array.isArray(m.material) && ROLLING.test(m.material.name) && !/Brake/.test(m.material.name)) meshes.push(m)
  })
  const corner = (p: THREE.Vector3) => (p.x > 0 ? 1 : 0) + (p.z > 0 ? 2 : 0)
  const v = new THREE.Vector3()

  // hub centre and radius of each wheel, from the extent of its parts
  const boxes = [0, 1, 2, 3].map(() => new THREE.Box3())
  for (const m of meshes) {
    const pos = m.geometry.attributes.position
    for (let i = 0; i < pos.count; i++) boxes[corner(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld))].expandByPoint(v)
  }
  if (boxes.some((b) => b.isEmpty())) return []
  const hubs = boxes.map((b) => {
    const pivot = new THREE.Group()
    pivot.position.copy(b.getCenter(new THREE.Vector3()))
    car.add(pivot)
    return { pivot, radius: (b.max.y - b.min.y) / 2 }
  })

  const n = new THREE.Vector3()
  const normalMatrix = new THREE.Matrix3()
  for (const m of meshes) {
    const g = m.geometry
    const pos = g.attributes.position
    const nor = g.attributes.normal
    const uv = g.attributes.uv
    normalMatrix.getNormalMatrix(m.matrixWorld)
    const out = hubs.map(() => ({ p: [] as number[], n: [] as number[], t: [] as number[] }))
    const count = g.index ? g.index.count : pos.count
    const tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
    for (let i = 0; i < count; i += 3) {
      const ids = [0, 1, 2].map((k) => (g.index ? g.index.getX(i + k) : i + k))
      ids.forEach((id, k) => tri[k].fromBufferAttribute(pos, id).applyMatrix4(m.matrixWorld))
      const w = corner(v.copy(tri[0]).add(tri[1]).add(tri[2]).divideScalar(3))
      const hub = hubs[w].pivot.position
      ids.forEach((id, k) => {
        out[w].p.push(tri[k].x - hub.x, tri[k].y - hub.y, tri[k].z - hub.z)
        if (nor) {
          n.fromBufferAttribute(nor, id).applyMatrix3(normalMatrix).normalize()
          out[w].n.push(n.x, n.y, n.z)
        }
        if (uv) out[w].t.push(uv.getX(id), uv.getY(id))
      })
    }
    out.forEach((o, w) => {
      if (!o.p.length) return
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3))
      if (o.n.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(o.n, 3))
      if (o.t.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(o.t, 2))
      hubs[w].pivot.add(new THREE.Mesh(geo, m.material))
    })
    m.removeFromParent()
  }
  return hubs
}

function prepare(scene: THREE.Object3D, spec: Spec) {
  const root = dress(scene, spec.length, spec.paint).car
  const out = new THREE.Group()
  out.add(root)
  out.position.set(...spec.position)
  if (spec.lift) out.position.y += spec.lift.height + PAD_TOP - spec.lift.sill
  out.rotation.y = spec.rotation
  // Nothing here moves: work out the matrices once.
  out.traverse((o) => {
    o.updateMatrix()
    o.matrixAutoUpdate = false
  })
  out.updateMatrixWorld(true)
  return out
}

function Parked({ spec }: { spec: Spec }) {
  const { scene } = useGLTF(BASE + spec.file, false, true)
  const car = useMemo(() => prepare(scene, spec), [scene, spec])
  return <primitive object={car} />
}

export function Display() {
  return (
    <>
      {DISPLAY.map((s) => (
        <Parked key={s.file} spec={s} />
      ))}
    </>
  )
}
