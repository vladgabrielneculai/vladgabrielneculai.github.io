import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { partLabel, useStore, type Part } from '../store'

const MODEL = `${import.meta.env.BASE_URL}models/mazda3.glb`

const LENGTH = 4.46 // metres, Mazda3 BP hatchback
const MAX_DROP = 0.045 // metres
const MAX_CAMBER = 0.105 // radians (6°)

// Open angle and hinge axis per moving panel. After normalising, the car faces +z and y is up.
const OPEN: Record<Part, { axis: 'x' | 'y'; angle: number }> = {
  hood: { axis: 'x', angle: -0.85 },
  trunk: { axis: 'x', angle: 1.15 },
  doorFL: { axis: 'y', angle: 1 },
  doorFR: { axis: 'y', angle: 1 },
  doorBL: { axis: 'y', angle: 0.95 },
  doorBR: { axis: 'y', angle: 0.95 },
}
const KEYS: Record<Part, string> = {
  hood: 'SK_Hood',
  trunk: 'SK_Trunk',
  doorFL: 'SK_Door_FL',
  doorFR: 'SK_Door_FR',
  doorBL: 'SK_Door_BL',
  doorBR: 'SK_Door_BR',
}

type Mat = THREE.MeshStandardMaterial

function boxOf(list: THREE.Object3D[]) {
  const b = new THREE.Box3()
  list.forEach((o) => b.expandByObject(o))
  return b
}

function rig(scene: THREE.Object3D) {
  const car = new THREE.Group()
  car.add(scene)

  // The export has no usable pivots or units, so everything is derived from bounds.
  const meshes: THREE.Mesh[] = []
  scene.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh))
  const named = (k: string) => meshes.filter((m) => m.name.includes(k))

  scene.updateMatrixWorld(true)
  let box = boxOf([scene])
  const size = box.getSize(new THREE.Vector3())
  if (size.x > size.z) scene.rotation.y = Math.PI / 2
  scene.scale.multiplyScalar(LENGTH / Math.max(size.x, size.z))
  scene.updateMatrixWorld(true)
  const c = (l: THREE.Object3D[]) => boxOf(l).getCenter(new THREE.Vector3())
  if (c(named(KEYS.hood)).z < c(named(KEYS.trunk)).z) scene.rotation.y += Math.PI
  scene.updateMatrixWorld(true)
  box = boxOf([scene])
  const mid = box.getCenter(new THREE.Vector3())
  scene.position.set(-mid.x, -box.min.y, -mid.z)
  scene.updateMatrixWorld(true)

  // Hinged panels
  const pivots = {} as Record<Part, THREE.Group>
  for (const part of Object.keys(KEYS) as Part[]) {
    const list = named(KEYS[part])
    const b = boxOf(list)
    const p = new THREE.Group()
    p.name = part
    if (part === 'hood') p.position.set(0, b.max.y - 0.04, b.min.z + 0.03)
    else if (part === 'trunk') p.position.set(0, b.max.y - 0.03, b.max.z - 0.05)
    else {
      const side = Math.sign(b.getCenter(new THREE.Vector3()).x)
      p.position.set(side * (Math.max(Math.abs(b.min.x), Math.abs(b.max.x)) - 0.06), 0, b.max.z - 0.04)
      p.userData.side = side
    }
    car.add(p)
    p.updateMatrixWorld(true)
    list.forEach((m) => p.attach(m))
    pivots[part] = p
  }

  // Wheels: one pivot per tyre, collecting the rim and brake that sit inside it.
  const wheelsRoot = new THREE.Group()
  const tyres = named('polySurface').filter((m) => (m.material as Mat).name.includes('Tyre'))
  const extras = [...named('WorkEmotion_Rim'), ...meshes.filter((m) => (m.material as Mat).name?.includes('Brake'))]
  const wheels = tyres.map((t) => {
    const centre = c([t])
    const p = new THREE.Group()
    p.position.copy(centre)
    wheelsRoot.add(p)
    p.updateMatrixWorld(true)
    p.attach(t)
    extras.filter((e) => e.parent !== p && c([e]).distanceTo(centre) < 0.45).forEach((e) => p.attach(e))
    return { pivot: p, side: Math.sign(centre.x) }
  })

  // Materials: the export carries one generic shading setup for everything.
  const mats = new Set<Mat>()
  meshes.forEach((m) => (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x as Mat)))
  const lamps: Mat[] = []
  mats.forEach((m) => {
    const n = m.name
    m.transparent = false
    m.depthWrite = true
    m.metalness = 0
    m.roughness = 0.7
    if (n.includes('Paint')) {
      const p = m as THREE.MeshPhysicalMaterial
      p.color.set('#3f4144')
      p.metalness = 0.9
      p.roughness = 0.26
      p.clearcoat = 1
      p.clearcoatRoughness = 0.05
      p.envMapIntensity = 1.6
    } else if (n.includes('Glass_Out_026')) {
      m.color.set('#10161b')
      m.transparent = true
      m.opacity = 0.55
      m.metalness = 1
      m.roughness = 0.05
      m.depthWrite = false
    } else if (n.includes('Glass_Out')) {
      m.metalness = 0.6
      m.roughness = 0.15
    } else if (n.includes('Rim_Silver')) {
      m.metalness = 1
      m.roughness = 0.22
    } else if (n.includes('Rim_Dark')) {
      m.metalness = 0.9
      m.roughness = 0.4
    } else if (n.includes('Mirror')) {
      m.metalness = 1
      m.roughness = 0.03
    } else if (n.includes('Light')) {
      m.roughness = 0.25
      m.emissive.set('#ffffff')
      m.emissiveMap = m.map
      lamps.push(m)
    } else if (n.includes('Tyre')) {
      m.roughness = 0.9
    } else if (n.includes('Brake') || n.includes('Exhaust')) {
      m.metalness = 0.6
      m.roughness = 0.45
    }
    m.needsUpdate = true
  })

  return { car, wheelsRoot, pivots, wheels, lamps }
}

function partOf(o: THREE.Object3D | null): Part | null {
  for (; o; o = o.parent) if (o.name in KEYS) return o.name as Part
  return null
}

export function Car() {
  const { scene } = useGLTF(MODEL, false, true)
  const r = useMemo(() => rig(scene), [scene])
  const v = useRef({ drop: 0, camber: 0, lights: 0 })
  const down = useRef<[number, number]>([0, 0])

  useEffect(() => {
    useStore.getState().set({ ready: true })
  }, [])

  useFrame((_, dt) => {
    const s = useStore.getState()
    const a = v.current
    for (const part of Object.keys(OPEN) as Part[]) {
      const p = r.pivots[part]
      const { axis, angle } = OPEN[part]
      const sign = axis === 'y' ? -(p.userData.side as number) : 1
      easing.damp(p.rotation, axis, s.open[part] ? sign * angle : 0, 0.3, dt)
    }
    easing.damp(a, 'drop', s.drop * MAX_DROP, 0.2, dt)
    easing.damp(a, 'camber', s.camber * MAX_CAMBER, 0.2, dt)
    r.car.position.y = -a.drop
    // Negative camber: the top of each wheel leans in towards the body.
    for (const w of r.wheels) w.pivot.rotation.z = w.side * a.camber
    easing.damp(a, 'lights', s.lights ? 1 : 0, 0.15, dt)
    for (const m of r.lamps) m.emissiveIntensity = a.lights * 1.6
  })

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const part = partOf(e.object)
    const hint = part ? `Click to open or close the ${partLabel[part]}` : null
    if (useStore.getState().hint !== hint) useStore.getState().set({ hint })
    document.body.style.cursor = part ? 'pointer' : 'grab'
  }
  const onOut = () => {
    useStore.getState().set({ hint: null })
    document.body.style.cursor = ''
  }
  // A click only counts if the pointer did not travel: dragging turns the car instead.
  const onDown = (e: ThreeEvent<PointerEvent>) => (down.current = [e.clientX, e.clientY])
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const part = partOf(e.object)
    if (!part || Math.hypot(e.clientX - down.current[0], e.clientY - down.current[1]) > 6) return
    e.stopPropagation()
    useStore.getState().toggle(part)
  }

  return (
    <group onPointerMove={onMove} onPointerOut={onOut} onPointerDown={onDown} onClick={onClick}>
      <primitive object={r.car} />
      <primitive object={r.wheelsRoot} />
    </group>
  )
}

useGLTF.preload(MODEL, false, true)
