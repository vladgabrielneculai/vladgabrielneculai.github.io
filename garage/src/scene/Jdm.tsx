// What makes it a Japanese tuner garage: two-post lifts, a wall of wheels, a drinks vending
// machine, shop signs and posters. All artwork is original and drawn here.
import { RoundedBox } from '@react-three/drei'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import jpFont from '../assets/garage-jp.woff2?url'

type V3 = [number, number, number]
type G = CanvasRenderingContext2D

const JP = 'GarageJP' // Noto Sans JP Black, cut down to the glyphs used below
const LATIN = '"Manrope Variable", system-ui, sans-serif'
const RED = '#b1121d'

// Wheel wall on the right-hand side: Car.tsx hangs copies of the car's own wheels here.
export const WHEEL_WALL = { z0: -9.6, dz: 0.78, count: 5, rails: [0.5, 1.36], inset: 0.17 }

function texture(w: number, h: number, draw: (g: G) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
  return t
}

const text = (g: G, s: string, x: number, y: number, font: string, fill: string, align: CanvasTextAlign = 'center') => {
  g.font = font
  g.fillStyle = fill
  g.textAlign = align
  g.textBaseline = 'middle'
  g.fillText(s, x, y)
}

// --- Posters (512 x 724, A-series proportions)
const POSTERS: ((g: G) => void)[] = [
  // Touge: a mountain road under a red sun
  (g) => {
    g.fillStyle = '#efe9dc'
    g.fillRect(0, 0, 512, 724)
    g.fillStyle = RED
    g.beginPath()
    g.arc(256, 250, 120, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#15171a'
    g.beginPath()
    g.moveTo(0, 430)
    g.lineTo(120, 300)
    g.lineTo(215, 395)
    g.lineTo(330, 250)
    g.lineTo(512, 440)
    g.lineTo(512, 724)
    g.lineTo(0, 724)
    g.fill()
    g.strokeStyle = '#efe9dc'
    g.lineWidth = 16
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(256, 724)
    g.bezierCurveTo(120, 640, 400, 600, 300, 540)
    g.bezierCurveTo(220, 495, 330, 470, 318, 440)
    g.stroke()
    text(g, '峠', 256, 96, `150px ${JP}`, '#15171a')
    text(g, 'TOUGE', 256, 668, `800 54px ${LATIN}`, '#efe9dc')
  },
  // Hashiriya: bold type on red
  (g) => {
    g.fillStyle = RED
    g.fillRect(0, 0, 512, 724)
    g.fillStyle = '#0d0e10'
    g.fillRect(0, 470, 512, 254)
    text(g, '走', 256, 130, `210px ${JP}`, '#fff')
    text(g, 'り屋', 256, 350, `190px ${JP}`, '#fff')
    text(g, 'HASHIRIYA', 256, 560, `800 62px ${LATIN}`, '#fff')
    text(g, 'STREET · CIRCUIT · TOUGE', 256, 632, `700 24px ${LATIN}`, RED)
  },
  // Wangan: night expressway
  (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 724)
    sky.addColorStop(0, '#05070d')
    sky.addColorStop(0.6, '#15203a')
    sky.addColorStop(1, '#3a1c2e')
    g.fillStyle = sky
    g.fillRect(0, 0, 512, 724)
    // skyline
    g.fillStyle = '#0a0d14'
    let x = 0
    for (const [w, h] of [[50, 150], [34, 230], [60, 120], [40, 270], [56, 180], [30, 320], [64, 140], [44, 210], [58, 160], [76, 240]]) {
      g.fillRect(x, 470 - h, w - 4, h)
      g.fillStyle = 'rgba(255,214,120,0.75)'
      for (let wy = 470 - h + 14; wy < 456; wy += 22) for (let wx = x + 7; wx < x + w - 12; wx += 13) if ((wx * 7 + wy * 3) % 5 < 2) g.fillRect(wx, wy, 5, 8)
      g.fillStyle = '#0a0d14'
      x += w
    }
    // road with light trails converging on the horizon
    g.fillStyle = '#07080c'
    g.fillRect(0, 470, 512, 254)
    for (const [x0, col] of [[-80, '#ff3b30'], [40, '#ff3b30'], [470, '#fff4d6'], [600, '#fff4d6']] as [number, string][]) {
      g.strokeStyle = col
      g.lineWidth = 5
      g.shadowColor = col
      g.shadowBlur = 18
      g.beginPath()
      g.moveTo(x0, 724)
      g.lineTo(256, 472)
      g.stroke()
    }
    g.shadowBlur = 0
    text(g, '湾岸', 256, 120, `150px ${JP}`, '#fff')
    text(g, 'WANGAN MIDNIGHT RUN', 256, 232, `800 30px ${LATIN}`, '#ff5c63')
  },
  // Tachometer
  (g) => {
    g.fillStyle = '#0d0e10'
    g.fillRect(0, 0, 512, 724)
    const cx = 256
    const cy = 330
    for (let i = 0; i <= 90; i++) {
      const a = Math.PI * 0.75 + (i / 90) * Math.PI * 1.5
      const major = i % 10 === 0
      g.strokeStyle = i >= 75 ? RED : '#f2f2f2'
      g.lineWidth = major ? 7 : 2.5
      g.beginPath()
      g.moveTo(cx + Math.cos(a) * (major ? 168 : 182), cy + Math.sin(a) * (major ? 168 : 182))
      g.lineTo(cx + Math.cos(a) * 200, cy + Math.sin(a) * 200)
      g.stroke()
      if (major) text(g, String(i / 10), cx + Math.cos(a) * 136, cy + Math.sin(a) * 136, `800 40px ${LATIN}`, i >= 75 ? RED : '#f2f2f2')
    }
    const needle = Math.PI * 0.75 + (86 / 90) * Math.PI * 1.5
    g.strokeStyle = RED
    g.lineWidth = 9
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(cx, cy)
    g.lineTo(cx + Math.cos(needle) * 176, cy + Math.sin(needle) * 176)
    g.stroke()
    g.fillStyle = '#f2f2f2'
    g.beginPath()
    g.arc(cx, cy, 20, 0, Math.PI * 2)
    g.fill()
    text(g, '×1000 RPM', cx, cy + 92, `700 22px ${LATIN}`, '#8a8d92')
    text(g, '魂', 256, 610, `110px ${JP}`, '#f2f2f2')
    text(g, 'SOUL OF THE MACHINE', 256, 690, `700 22px ${LATIN}`, '#8a8d92')
  },
  // Shuto expressway sign
  (g) => {
    g.fillStyle = '#0f6b3c'
    g.fillRect(0, 0, 512, 724)
    g.strokeStyle = '#fff'
    g.lineWidth = 10
    g.strokeRect(22, 22, 468, 680)
    text(g, '首都高', 256, 150, `120px ${JP}`, '#fff')
    text(g, 'SHUTO EXPRESSWAY', 256, 250, `800 32px ${LATIN}`, '#fff')
    g.fillStyle = '#fff'
    g.fillRect(60, 300, 392, 6)
    // loop route diagram
    g.lineWidth = 22
    g.strokeStyle = '#fff'
    g.beginPath()
    g.ellipse(256, 470, 130, 96, 0, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = RED
    g.beginPath()
    g.arc(256, 374, 30, 0, Math.PI * 2)
    g.fill()
    text(g, 'C1', 256, 376, `800 30px ${LATIN}`, '#fff')
    text(g, '東京', 256, 470, `76px ${JP}`, '#fff')
    text(g, 'TOKYO  ·  INNER LOOP', 256, 640, `800 28px ${LATIN}`, '#fff')
  },
  // Made in Japan
  (g) => {
    g.fillStyle = '#f4f1ea'
    g.fillRect(0, 0, 512, 724)
    g.fillStyle = '#15171a'
    g.fillRect(0, 0, 512, 150)
    text(g, 'JDM', 256, 82, `800 120px ${LATIN}`, '#f4f1ea')
    g.fillStyle = RED
    g.beginPath()
    g.arc(256, 372, 150, 0, Math.PI * 2)
    g.fill()
    text(g, '日本製', 256, 372, `96px ${JP}`, '#fff')
    text(g, 'JAPANESE DOMESTIC MARKET', 256, 590, `800 27px ${LATIN}`, '#15171a')
    text(g, 'BUILT, NOT BOUGHT', 256, 640, `700 24px ${LATIN}`, RED)
  },
]

function useArt(ready: boolean) {
  return useMemo(() => {
    if (!ready) return null
    const posters = POSTERS.map((draw) => texture(512, 724, draw))
    // Neon shop sign: glowing tube lettering on black
    const neon = texture(2048, 360, (g) => {
      g.fillStyle = '#060607'
      g.fillRect(0, 0, 2048, 360)
      const tube = (s: string, x: number, font: string, glow: string) => {
        g.font = font
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.shadowColor = glow
        for (const blur of [70, 34, 12]) {
          g.shadowBlur = blur
          g.fillStyle = glow
          g.fillText(s, x, 190)
        }
        g.shadowBlur = 0
        g.fillStyle = '#fff4f2'
        g.fillText(s, x, 190)
      }
      tube('ガレージ', 520, `210px ${JP}`, '#ff2a2a')
      tube('VGN', 1480, `800 250px ${LATIN}`, '#eaf3ff')
    })
    // "Safety first": the banner every Japanese workshop hangs up
    const safety = texture(1024, 256, (g) => {
      g.fillStyle = '#f6f6f2'
      g.fillRect(0, 0, 1024, 256)
      g.fillStyle = '#12833f'
      g.fillRect(0, 0, 1024, 18)
      g.fillRect(0, 238, 1024, 18)
      g.fillRect(96, 68, 44, 120)
      g.fillRect(58, 106, 120, 44)
      text(g, '安全第一', 590, 132, `150px ${JP}`, '#12833f')
    })
    // Number plates, Japanese format, fictional registrations
    const plate = (region: string, cls: string, kana: string, num: string) =>
      texture(512, 256, (g) => {
        g.fillStyle = '#f7f7f4'
        g.beginPath()
        g.roundRect(0, 0, 512, 256, 18)
        g.fill()
        g.strokeStyle = '#0d5a34'
        g.lineWidth = 8
        g.beginPath()
        g.roundRect(8, 8, 496, 240, 14)
        g.stroke()
        text(g, `${region} ${cls}`, 256, 62, `58px ${JP}`, '#0d5a34')
        text(g, kana, 70, 168, `64px ${JP}`, '#0d5a34')
        text(g, num, 300, 168, `800 124px ${LATIN}`, '#0d5a34')
      })
    // Vending machine front
    const vending = texture(512, 940, (g) => {
      g.fillStyle = '#e9ecef'
      g.fillRect(0, 0, 512, 940)
      g.fillStyle = '#0c1117'
      g.fillRect(28, 28, 456, 470)
      const cans = ['#d8232a', '#f2f2f2', '#1565c0', '#f4b400', '#2e7d32', '#6a1b9a', '#ef6c00', '#00838f']
      for (let r = 0; r < 3; r++) {
        g.fillStyle = '#1a222c'
        g.fillRect(28, 28 + r * 156 + 124, 456, 32)
        for (let c = 0; c < 6; c++) {
          const x = 52 + c * 71
          const y = 44 + r * 156
          const col = cans[(r * 3 + c * 5) % cans.length]
          g.fillStyle = col
          g.beginPath()
          g.roundRect(x, y, 46, 104, 9)
          g.fill()
          g.fillStyle = 'rgba(255,255,255,0.85)'
          g.fillRect(x, y + 36, 46, 26)
          g.fillStyle = 'rgba(255,255,255,0.35)'
          g.fillRect(x + 5, y + 6, 6, 92)
          // price and button: blue = cold, red = hot
          g.fillStyle = r === 2 ? '#d8232a' : '#1565c0'
          g.fillRect(x + 4, y + 128, 38, 20)
          text(g, r === 2 ? '１３０' : '１２０', x + 23, y + 139, `13px ${JP}`, '#fff')
        }
      }
      g.fillStyle = '#1565c0'
      g.fillRect(28, 512, 220, 46)
      text(g, 'つめた〜い', 138, 536, `30px ${JP}`, '#fff')
      g.fillStyle = '#d8232a'
      g.fillRect(264, 512, 220, 46)
      text(g, 'あったか〜い', 374, 536, `30px ${JP}`, '#fff')
      // coin slot, note slot, change tray
      g.fillStyle = '#c3c8ce'
      g.fillRect(330, 580, 154, 150)
      g.fillStyle = '#20262d'
      g.fillRect(350, 600, 60, 12)
      g.fillRect(350, 632, 110, 26)
      g.fillRect(350, 684, 110, 30)
      text(g, 'のみもの', 170, 630, `62px ${JP}`, RED)
      text(g, 'DRINKS', 170, 694, `800 36px ${LATIN}`, '#20262d')
      // delivery flap
      g.fillStyle = '#20262d'
      g.beginPath()
      g.roundRect(60, 770, 392, 120, 12)
      g.fill()
      g.fillStyle = '#39424d'
      g.fillRect(76, 786, 360, 88)
    })
    // What the vending machine actually lights up: its display window and buttons
    const vendingGlow = texture(512, 940, (g) => {
      g.fillStyle = '#000'
      g.fillRect(0, 0, 512, 940)
      g.drawImage(vending.image as HTMLCanvasElement, 28, 28, 456, 530, 28, 28, 456, 530)
    })
    const hazard = texture(64, 256, (g) => {
      g.fillStyle = '#f4c20d'
      g.fillRect(0, 0, 64, 256)
      g.fillStyle = '#111'
      for (let y = -64; y < 256; y += 64) {
        g.beginPath()
        g.moveTo(0, y + 32)
        g.lineTo(64, y)
        g.lineTo(64, y + 32)
        g.lineTo(0, y + 64)
        g.fill()
      }
    })
    const shadow = texture(128, 128, (g) => {
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
      grad.addColorStop(0, 'rgba(0,0,0,0.75)')
      grad.addColorStop(0.7, 'rgba(0,0,0,0.4)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 128, 128)
    })
    const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p)
    // Anything printed and stuck to a surface is drawn slightly towards the camera, so it
    // can never flicker against what it is stuck to.
    const decal = (map: THREE.Texture, extra: THREE.MeshStandardMaterialParameters = {}) => std({ map, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, ...extra })
    return {
      posters: posters.map((p) => decal(p)),
      neon: new THREE.MeshBasicMaterial({ map: neon, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
      safety: decal(safety, { roughness: 0.7 }),
      plates: [plate('品川', '330', 'さ', '86-23'), plate('横浜', '500', 'た', '34-00'), plate('東京', '301', 'み', '・7 20')].map((p) => decal(p, { roughness: 0.35, metalness: 0.3 })),
      vending: decal(vending, { emissive: '#ffffff', emissiveMap: vendingGlow, emissiveIntensity: 1.25, roughness: 0.3 }),
      hazard: decal(hazard),
      frame: std({ color: '#0e0f11', roughness: 0.5, metalness: 0.4 }),
      liftPaint: new THREE.MeshPhysicalMaterial({ color: '#1d4f91', roughness: 0.42, metalness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
      steel: std({ color: '#3a3d42', roughness: 0.45, metalness: 0.85 }),
      bright: std({ color: '#c9ccd0', roughness: 0.3, metalness: 1 }),
      rubber: std({ color: '#101011', roughness: 0.92 }),
      white: new THREE.MeshPhysicalMaterial({ color: '#eef0f2', roughness: 0.35, metalness: 0.2, clearcoat: 0.8 }),
      cone: std({ color: '#f25c05', roughness: 0.6 }),
      band: std({ color: '#f4f4f4', roughness: 0.4 }),
      shadow: new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false, toneMapped: false }),
    }
  }, [ready])
}
type Art = NonNullable<ReturnType<typeof useArt>>

function Shadow({ a, size }: { a: Art; size: [number, number] }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]} scale={[size[0], size[1], 1]} material={a.shadow}>
      <planeGeometry />
    </mesh>
  )
}

// Framed print on a wall. `rotation` turns it to face into the room.
function Framed({ a, mat, position, rotation = 0, w = 0.84, h = 1.19 }: { a: Art; mat: THREE.Material; position: V3; rotation?: number; w?: number; h?: number }) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh position={[0, 0, 0.012]} material={a.frame}>
        <boxGeometry args={[w + 0.05, h + 0.05, 0.024]} />
      </mesh>
      <mesh position={[0, 0, 0.03]} material={mat}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  )
}

// Two-post lift, arms lowered. `height` raises the carriages for a car on the lift.
function Lift({ a, position, height = 0.14 }: { a: Art; position: V3; height?: number }) {
  const span = 1.5 // post centre to bay centre
  return (
    <group position={position}>
      <Shadow a={a} size={[4.2, 2.2]} />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * span, 0, 0]}>
          <mesh position={[0, 0.012, 0]} material={a.steel}>
            <boxGeometry args={[0.56, 0.024, 0.62]} />
          </mesh>
          <RoundedBox args={[0.26, 2.86, 0.32]} radius={0.012} smoothness={2} position={[0, 1.45, 0]} material={a.liftPaint} />
          {/* caution stripes at hip height, facing the bay front */}
          <mesh position={[0, 1.15, 0.163]} material={a.hazard}>
            <planeGeometry args={[0.2, 0.5]} />
          </mesh>
          {/* carriage and the two swing arms it carries */}
          <group position={[-side * 0.17, height + 0.2, 0]}>
            <RoundedBox args={[0.14, 0.42, 0.36]} radius={0.01} smoothness={2} material={a.steel} />
            {[-1, 1].map((end) => (
              <group key={end} position={[-side * 0.05, -0.15, end * 0.12]} rotation-y={side * end * 0.62}>
                <mesh position={[-side * 0.5, 0, 0]} material={a.steel}>
                  <boxGeometry args={[1.0, 0.07, 0.1]} />
                </mesh>
                <mesh position={[-side * 0.96, 0.055, 0]} material={a.rubber}>
                  <cylinderGeometry args={[0.065, 0.065, 0.04, 20]} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      ))}
      {/* overhead beam with the hydraulic line */}
      <mesh position={[0, 2.94, 0]} material={a.liftPaint}>
        <boxGeometry args={[span * 2 + 0.26, 0.12, 0.16]} />
      </mesh>
      <mesh position={[0, 2.86, 0.03]} rotation-z={Math.PI / 2} material={a.rubber}>
        <cylinderGeometry args={[0.012, 0.012, span * 2 - 0.3, 8]} />
      </mesh>
      {/* power unit on the left post */}
      <group position={[-span - 0.24, 1.5, 0]}>
        <RoundedBox args={[0.2, 0.34, 0.24]} radius={0.015} smoothness={2} material={a.steel} />
        <mesh position={[0, -0.36, 0]} material={a.white}>
          <cylinderGeometry args={[0.085, 0.085, 0.36, 20]} />
        </mesh>
        <mesh position={[0, 0.24, 0.06]} rotation-x={0.5} material={a.bright}>
          <cylinderGeometry args={[0.009, 0.009, 0.22, 8]} />
        </mesh>
      </group>
    </group>
  )
}

function Vending({ a, position, rotation = 0 }: { a: Art; position: V3; rotation?: number }) {
  return (
    <group position={position} rotation-y={rotation}>
      <Shadow a={a} size={[1.9, 1.7]} />
      <RoundedBox args={[1.0, 1.83, 0.76]} radius={0.025} smoothness={3} position={[0, 0.945, 0]} material={a.white} />
      <mesh position={[0, 0.945, 0.384]} material={a.vending}>
        <planeGeometry args={[0.94, 1.73]} />
      </mesh>
      <mesh position={[0, 0.015, 0]} material={a.frame}>
        <boxGeometry args={[0.96, 0.03, 0.72]} />
      </mesh>
    </group>
  )
}

function Cone({ a, position }: { a: Art; position: V3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.015, 0]} material={a.cone}>
        <boxGeometry args={[0.36, 0.03, 0.36]} />
      </mesh>
      <mesh position={[0, 0.3, 0]} material={a.cone}>
        <coneGeometry args={[0.13, 0.56, 28]} />
      </mesh>
      <mesh position={[0, 0.3, 0]} material={a.band}>
        <cylinderGeometry args={[0.068, 0.092, 0.1, 28, 1, true]} />
      </mesh>
    </group>
  )
}

// Two rows of rails for the wheel wall; the wheels themselves are placed by Car.tsx.
function WheelRails({ a, x }: { a: Art; x: number }) {
  const len = WHEEL_WALL.dz * (WHEEL_WALL.count - 1) + 0.9
  const zc = WHEEL_WALL.z0 + (WHEEL_WALL.dz * (WHEEL_WALL.count - 1)) / 2
  return (
    <group position={[x, 0, zc]}>
      {WHEEL_WALL.rails.map((y) => (
        <group key={y} position={[0, y, 0]}>
          {[-0.07, -0.27].map((dx) => (
            <mesh key={dx} position={[dx, 0, 0]} rotation-x={Math.PI / 2} material={a.bright}>
              <cylinderGeometry args={[0.018, 0.018, len, 12]} />
            </mesh>
          ))}
          {[-1, 0, 1].map((k) => (
            <mesh key={k} position={[-0.15, -0.03, (k * len) / 2.15]} material={a.steel}>
              <boxGeometry args={[0.3, 0.03, 0.04]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

export function Jdm({ room }: { room: { x: number; z: number; h: number } }) {
  // The signs need their fonts before they can be drawn.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const face = new FontFace(JP, `url(${jpFont})`)
    Promise.all([face.load().then((f) => document.fonts.add(f)), document.fonts.load(`800 40px ${LATIN}`)])
      .catch(() => undefined)
      .then(() => setReady(true))
  }, [])
  const a = useArt(ready)
  if (!a) return null
  const back = -room.z + 0.02
  const front = room.z - 0.02
  const left = -room.x + 0.02
  const right = room.x - 0.02

  return (
    <>
      {/* working bays either side of the car */}
      <Lift a={a} position={[-6.4, 0, -5]} />
      <Lift a={a} position={[6.4, 0, -5]} />

      {/* back wall: neon over the door, prints between the door and the benches */}
      <mesh position={[0, 3.78, back + 0.03]} material={a.neon}>
        <planeGeometry args={[4.1, 0.72]} />
      </mesh>
      <mesh position={[0, 3.78, back + 0.012]} material={a.frame}>
        <boxGeometry args={[4.2, 0.8, 0.024]} />
      </mesh>
      <Framed a={a} mat={a.posters[0]} position={[-4.6, 2.35, back]} />
      <Framed a={a} mat={a.posters[1]} position={[-10.1, 2.35, back]} />
      <Framed a={a} mat={a.posters[3]} position={[4.5, 2.35, back]} />

      {/* left wall: vending machine, prints, number plates */}
      <Vending a={a} position={[left + 0.42, 0, -9.6]} rotation={Math.PI / 2} />
      <Framed a={a} mat={a.posters[2]} position={[left, 2.35, -6.6]} rotation={Math.PI / 2} />
      <Framed a={a} mat={a.posters[5]} position={[left, 2.35, -5.3]} rotation={Math.PI / 2} />
      {a.plates.map((p, i) => (
        <Framed key={i} a={a} mat={p} position={[left, 2.75 - i * 0.26, -3.6]} rotation={Math.PI / 2} w={0.44} h={0.22} />
      ))}

      {/* right wall: wheel wall and the safety banner above it */}
      <WheelRails a={a} x={right} />
      <Framed a={a} mat={a.safety} position={[right, 2.9, -8.0]} rotation={-Math.PI / 2} w={2.4} h={0.6} />
      <Framed a={a} mat={a.posters[4]} position={[right, 2.35, -2.4]} rotation={-Math.PI / 2} />

      {/* front wall */}
      <Framed a={a} mat={a.posters[2]} position={[4.2, 2.35, front]} rotation={Math.PI} />
      <Framed a={a} mat={a.posters[0]} position={[5.4, 2.35, front]} rotation={Math.PI} />
      <Framed a={a} mat={a.posters[1]} position={[-6.2, 2.35, front]} rotation={Math.PI} />

      <Cone a={a} position={[-3.6, 0, -7.6]} />
      <Cone a={a} position={[-3.1, 0, -7.9]} />
      <Cone a={a} position={[3.4, 0, 8.2]} />
    </>
  )
}
