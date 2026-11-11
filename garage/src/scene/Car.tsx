import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { tabs } from '../data'
import { useStore, zones, type Part, type Zone } from '../store'

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

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.flipY = false
  t.anisotropy = 8
  return t
}

// Brake disc, drawn into the model's own UV layout: one quarter of the disc, centred on the
// bottom-right corner of the texture. Machined friction ring with cross-drilled holes.
function discTextures() {
  const S = 1024
  const cx = 0.977 * S
  const cy = 0.977 * S
  const ring = (g: CanvasRenderingContext2D, r0: number, r1: number, fill: string) => {
    g.beginPath()
    g.arc(cx, cy, r1 * S, 0, Math.PI * 2)
    g.arc(cx, cy, r0 * S, 0, Math.PI * 2, true)
    g.fillStyle = fill
    g.fill()
  }
  const holes = (g: CanvasRenderingContext2D, fill: string) => {
    g.fillStyle = fill
    for (let k = 0; k < 12; k++) {
      const a = Math.PI + ((k + 0.5) / 12) * (Math.PI / 2)
      for (const [r, da] of [[0.79, 0], [0.855, 0.035], [0.92, 0.07]]) {
        g.beginPath()
        g.arc(cx + Math.cos(a + da) * r * S, cy + Math.sin(a + da) * r * S, 0.011 * S, 0, Math.PI * 2)
        g.fill()
      }
    }
  }
  const map = canvas(S, S, (g) => {
    g.fillStyle = '#2b2c2e'
    g.fillRect(0, 0, S, S)
    ring(g, 0.6, 0.745, '#4a4c4f') // hat
    ring(g, 0.745, 0.985, '#c3c6ca') // friction ring
    // fine machining marks
    for (let r = 0.75; r < 0.98; r += 0.004) {
      g.beginPath()
      g.arc(cx, cy, r * S, 0, Math.PI * 2)
      g.strokeStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${0.05 + Math.random() * 0.12})`
      g.lineWidth = 1 + Math.random() * 2
      g.stroke()
    }
    ring(g, 0.972, 0.985, '#8d9093') // worn outer lip
    holes(g, '#111213')
  })
  // green = roughness, blue = metalness
  const orm = canvas(
    S,
    S,
    (g) => {
      g.fillStyle = 'rgb(0,200,120)'
      g.fillRect(0, 0, S, S)
      ring(g, 0.6, 0.745, 'rgb(0,150,230)')
      ring(g, 0.745, 0.985, 'rgb(0,70,255)')
      holes(g, 'rgb(0,230,60)')
    },
    false,
  )
  return { map, orm }
}

function glowTexture() {
  const t = canvas(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.2, 'rgba(255,255,255,0.55)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.12)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
  })
  return t
}

// Where a lamp cluster faces outwards on each side: the average of its most forward
// (dir = 1) or most rearward (dir = -1) vertices.
function lampPoints(meshes: THREE.Mesh[], dir: 1 | -1) {
  const pts: [THREE.Vector3[], THREE.Vector3[]] = [[], []]
  const v = new THREE.Vector3()
  for (const m of meshes) {
    const pos = m.geometry.getAttribute('position')
    for (let i = 0; i < pos.count; i += 3) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)
      if (Math.abs(v.x) > 0.3) pts[v.x > 0 ? 0 : 1].push(v.clone())
    }
  }
  return pts.map((side) => {
    side.sort((a, b) => dir * (b.z - a.z))
    const top = side.slice(0, Math.max(1, Math.floor(side.length / 5)))
    const c = top.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(top.length)
    c.z += dir * 0.04
    return c
  })
}

function rig(scene: THREE.Object3D) {
  const car = new THREE.Group()
  car.add(scene)

  // The export has no usable pivots or units, so everything is derived from bounds.
  const meshes: THREE.Mesh[] = []
  scene.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh))
  const named = (k: string) => meshes.filter((m) => m.name.includes(k))
  const matName = (m: THREE.Mesh) => (m.material as Mat).name ?? ''

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

  // --- Materials. The export carries one generic shading setup for everything, so each
  // surface type is rebuilt here.
  const paint = new THREE.MeshPhysicalMaterial({
    name: 'Paint',
    color: '#565a5f',
    metalness: 0.88,
    roughness: 0.36,
    clearcoat: 1,
    clearcoatRoughness: 0.025,
    envMapIntensity: 1.25,
  })
  const windows = new THREE.MeshPhysicalMaterial({
    name: 'Windows',
    color: '#0b1014',
    metalness: 0.2,
    roughness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    envMapIntensity: 1.6,
  })
  // Clear lens over the headlamps and the grille emblem
  const lens = new THREE.MeshPhysicalMaterial({
    name: 'Lens',
    color: '#ffffff',
    roughness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    envMapIntensity: 1.8,
  })
  const frit = new THREE.MeshStandardMaterial({ name: 'Frit', color: '#050506', roughness: 0.15, metalness: 0.3 })
  const redLens = new THREE.MeshPhysicalMaterial({
    name: 'RedLens',
    color: '#8f0a0c',
    emissive: '#ff1a0e',
    emissiveIntensity: 0,
    roughness: 0.05,
    clearcoat: 1,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  })
  const disc = discTextures()
  const discMat = new THREE.MeshStandardMaterial({ name: 'Disc', map: disc.map, roughnessMap: disc.orm, metalnessMap: disc.orm, roughness: 1, metalness: 1, envMapIntensity: 1.2 })
  const caliper = new THREE.MeshPhysicalMaterial({ name: 'Caliper', color: '#b1121d', roughness: 0.35, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 })
  const chrome = new THREE.MeshStandardMaterial({ name: 'Chrome', color: '#f4f5f6', metalness: 1, roughness: 0.04, envMapIntensity: 1.5 })
  const chromeDark = new THREE.MeshStandardMaterial({ name: 'ChromeDark', color: '#9a9da1', metalness: 1, roughness: 0.1, envMapIntensity: 1.3 })

  let lampMat: Mat | null = null
  for (const m of meshes) {
    const n = matName(m)
    const old = m.material as Mat
    if (n.includes('Paint')) m.material = paint
    else if (n.includes('Glass_Out_026')) m.material = windows
    else if (n.includes('Glass_Out_068')) m.material = redLens
    // The same "black glass" is the clear cover of the lamps and emblem, and the black
    // band printed round the windows.
    else if (n.includes('Glass_Out_074')) m.material = /SM_Light_F|SM_Bumper_F|SideMirror/.test(m.name) ? lens : frit
    else if (n.includes('Rim_Silver')) m.material = chrome
    else if (n.includes('Rim_Dark')) m.material = chromeDark
    else if (n.includes('Brake')) {
      // Discs are the thin round parts; everything else on that material is a caliper.
      const s = boxOf([m]).getSize(new THREE.Vector3())
      m.material = s.x < 0.09 && Math.abs(s.y - s.z) < 0.02 ? discMat : caliper
    } else {
      old.transparent = false
      old.depthWrite = true
      old.metalness = 0
      old.roughness = 0.7
      if (n.includes('Mirror')) {
        old.metalness = 1
        old.roughness = 0.03
      } else if (n.includes('Light')) {
        old.roughness = 0.2
        old.metalness = 0.4
        old.emissive.set('#ffffff')
        old.emissiveMap = old.map
        lampMat = old
      } else if (n.includes('Tyre')) {
        old.roughness = 0.88
        old.color.set('#8c8c8c')
      } else if (n.includes('Exhaust')) {
        // trim, grille and exhaust tips: a palette texture of black plastics and bright metal
        old.metalness = 0.75
        old.roughness = 0.28
        old.envMapIntensity = 1.3
      } else if (n.includes('Engine')) {
        old.metalness = 0.3
        old.roughness = 0.55
      }
      old.needsUpdate = true
    }
  }

  // --- Lamps: glow, beams and tail light spill, placed from the lamp geometry itself.
  const glow = glowTexture()
  const lampMeshes = (k: string) => meshes.filter((m) => m.name.includes(k) && matName(m).includes('Light'))
  const flare = (p: THREE.Vector3, color: THREE.ColorRepresentation, scale: number) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 }))
    s.position.copy(p)
    s.scale.setScalar(scale)
    car.add(s)
    return s.material
  }
  const flares: THREE.SpriteMaterial[] = []
  const beams: THREE.SpotLight[] = []
  const spill: THREE.PointLight[] = []
  for (const p of lampPoints(lampMeshes('SM_Light_F'), 1)) {
    flares.push(flare(p, new THREE.Color(2.4, 2.5, 2.8), 0.5))
    const beam = new THREE.SpotLight('#dfe8ff', 0, 16, 0.55, 1, 1.6)
    beam.position.copy(p)
    beam.target.position.set(p.x * 1.25, -0.4, p.z + 7)
    car.add(beam, beam.target)
    beams.push(beam)
  }
  for (const p of lampPoints([...lampMeshes('SM_Light_B'), ...lampMeshes('SK_Trunk')], -1)) {
    flares.push(flare(p, new THREE.Color(2.6, 0.12, 0.08), 0.42))
    const l = new THREE.PointLight('#ff2010', 0, 3.2, 2)
    l.position.set(p.x, p.y, p.z - 0.25)
    car.add(l)
    spill.push(l)
  }

  // --- Hinged panels
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

  // --- Wheels: one pivot per tyre, collecting the rim and brake that sit inside it.
  const wheelsRoot = new THREE.Group()
  const tyres = named('polySurface').filter((m) => matName(m).includes('Tyre'))
  const extras = [...named('WorkEmotion_Rim'), ...meshes.filter((m) => m.material === discMat || m.material === caliper)]
  const wheels = tyres.map((t) => {
    const centre = c([t])
    const p = new THREE.Group()
    p.name = 'wheel'
    p.position.copy(centre)
    wheelsRoot.add(p)
    p.updateMatrixWorld(true)
    p.attach(t)
    extras.filter((e) => e.parent !== p && c([e]).distanceTo(centre) < 0.45).forEach((e) => p.attach(e))
    return { pivot: p, side: Math.sign(centre.x) }
  })

  return { car, wheelsRoot, pivots, wheels, lampMat: lampMat as Mat | null, redLens, flares, beams, spill }
}

function zoneOf(o: THREE.Object3D | null): Zone | null {
  for (; o; o = o.parent) if (o.name in zones) return o.name as Zone
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

    easing.damp(a, 'lights', s.lights ? 1 : 0, 0.12, dt)
    if (r.lampMat) r.lampMat.emissiveIntensity = 0.02 + a.lights * 3.2
    r.redLens.emissiveIntensity = a.lights * 1.4
    for (const f of r.flares) f.opacity = a.lights
    for (const b of r.beams) b.intensity = a.lights * 42
    for (const l of r.spill) l.intensity = a.lights * 2.2
  })

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const zone = zoneOf(e.object)
    const hint = zone ? `${zones[zone].name[0].toUpperCase()}${zones[zone].name.slice(1)} — click for ${tabs.find((t) => t.id === zones[zone].tab)!.label}` : null
    if (useStore.getState().hint !== hint) useStore.getState().set({ hint })
    document.body.style.cursor = zone ? 'pointer' : 'grab'
  }
  const onOut = () => {
    useStore.getState().set({ hint: null })
    document.body.style.cursor = ''
  }
  // A click only counts if the pointer did not travel: dragging turns the car instead.
  const onDown = (e: ThreeEvent<PointerEvent>) => (down.current = [e.clientX, e.clientY])
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const zone = zoneOf(e.object)
    if (!zone || Math.hypot(e.clientX - down.current[0], e.clientY - down.current[1]) > 6) return
    e.stopPropagation()
    if (zone === 'wheel') useStore.getState().set({ tab: zones.wheel.tab })
    else useStore.getState().toggle(zone)
  }

  return (
    <group onPointerMove={onMove} onPointerOut={onOut} onPointerDown={onDown} onClick={onClick}>
      <primitive object={r.car} />
      <primitive object={r.wheelsRoot} />
    </group>
  )
}

useGLTF.preload(MODEL, false, true)
