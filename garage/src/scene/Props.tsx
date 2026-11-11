// Garage furniture, modelled from primitives: bevelled panels, separate drawer fronts and
// handles, real material values. Everything is placed against the walls, clear of the car.
import { RoundedBox } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

type V3 = [number, number, number]

function texture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function useMaterials() {
  return useMemo(() => {
    const wood = texture(512, 256, (g) => {
      g.fillStyle = '#9a6a3c'
      g.fillRect(0, 0, 512, 256)
      // planks and grain
      for (let p = 0; p < 4; p++) {
        g.fillStyle = `rgba(${p % 2 ? 60 : 255},${p % 2 ? 30 : 220},${p % 2 ? 0 : 170},0.06)`
        g.fillRect(0, p * 64, 512, 64)
        g.fillStyle = 'rgba(40,20,5,0.5)'
        g.fillRect(0, p * 64, 512, 1.5)
      }
      for (let i = 0; i < 420; i++) {
        g.strokeStyle = `rgba(60,30,8,${0.04 + Math.random() * 0.12})`
        g.lineWidth = 0.6 + Math.random()
        const y = Math.random() * 256
        g.beginPath()
        g.moveTo(0, y)
        g.bezierCurveTo(170, y + Math.random() * 6 - 3, 340, y + Math.random() * 6 - 3, 512, y + Math.random() * 4 - 2)
        g.stroke()
      }
    })
    // Pegboard with a set of hand tools hanging on it
    const pegboard = texture(1024, 512, (g) => {
      g.fillStyle = '#cdbfa3'
      g.fillRect(0, 0, 1024, 512)
      g.fillStyle = 'rgba(40,30,15,0.55)'
      for (let y = 16; y < 512; y += 32) for (let x = 16; x < 1024; x += 32) g.fillRect(x - 2, y - 2, 4, 4)
      const steel = '#9da1a6'
      const spanner = (x: number, len: number) => {
        g.fillStyle = 'rgba(0,0,0,0.25)'
        g.fillRect(x + 4, 74, 12, len)
        g.fillStyle = steel
        g.fillRect(x, 70, 12, len)
        g.beginPath()
        g.arc(x + 6, 70, 13, 0, Math.PI * 2)
        g.arc(x + 6, 70 + len, 11, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#cdbfa3'
        g.beginPath()
        g.arc(x + 6, 66, 6, 0, Math.PI * 2)
        g.fill()
      }
      ;[230, 210, 190, 172, 156, 140, 126].forEach((len, i) => spanner(60 + i * 46, len))
      const driver = (x: number, colour: string) => {
        g.fillStyle = steel
        g.fillRect(x + 7, 180, 5, 150)
        g.fillStyle = colour
        g.beginPath()
        g.roundRect(x, 70, 19, 116, 8)
        g.fill()
      }
      ;['#b1121d', '#b1121d', '#1f1f21', '#1f1f21', '#d4a11c', '#d4a11c'].forEach((col, i) => driver(430 + i * 40, col))
      // hammer
      g.fillStyle = '#7a5230'
      g.fillRect(712, 96, 18, 250)
      g.fillStyle = '#3a3c40'
      g.fillRect(684, 70, 86, 36)
      // hand saw
      g.fillStyle = steel
      g.beginPath()
      g.moveTo(800, 90)
      g.lineTo(990, 130)
      g.lineTo(990, 160)
      g.lineTo(800, 190)
      g.fill()
      g.fillStyle = '#7a5230'
      g.beginPath()
      g.roundRect(786, 78, 54, 124, 14)
      g.fill()
      // pliers and tape below
      g.fillStyle = '#b1121d'
      g.fillRect(90, 380, 12, 90)
      g.fillRect(118, 380, 12, 90)
      g.fillStyle = steel
      g.fillRect(96, 340, 28, 50)
      g.fillStyle = '#d4a11c'
      g.beginPath()
      g.arc(240, 420, 38, 0, Math.PI * 2)
      g.fill()
    })
    const label = (bg: string, fg: string, text: string) =>
      texture(256, 128, (g) => {
        g.fillStyle = bg
        g.fillRect(0, 0, 256, 128)
        g.fillStyle = fg
        g.fillRect(0, 44, 256, 44)
        g.fillStyle = bg
        g.font = '700 30px system-ui, sans-serif'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(text, 128, 67)
      })
    const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p)
    return {
      red: new THREE.MeshPhysicalMaterial({ color: '#9c0e17', metalness: 0.55, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12 }),
      alu: std({ color: '#c9ccd0', metalness: 1, roughness: 0.28 }),
      steel: std({ color: '#5b5f64', metalness: 0.9, roughness: 0.45 }),
      darkSteel: std({ color: '#26282b', metalness: 0.7, roughness: 0.5 }),
      rubber: std({ color: '#111112', roughness: 0.9 }),
      plastic: std({ color: '#22262b', roughness: 0.55 }),
      crateBlue: std({ color: '#1f3f66', roughness: 0.5 }),
      crateGrey: std({ color: '#6a6e73', roughness: 0.55 }),
      card: std({ color: '#a98459', roughness: 0.95 }),
      wood: std({ map: wood, roughness: 0.6 }),
      pegboard: std({ map: pegboard, roughness: 0.85 }),
      drum: new THREE.MeshPhysicalMaterial({ color: '#1c3d6b', metalness: 0.7, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
      oilYellow: std({ map: label('#d9a514', '#151515', '5W-30'), roughness: 0.4 }),
      oilBlack: std({ map: label('#17181a', '#b1121d', 'OIL'), roughness: 0.35 }),
      extinguisher: new THREE.MeshPhysicalMaterial({ color: '#b3101b', metalness: 0.4, roughness: 0.3, clearcoat: 1 }),
      shadow: new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        map: texture(128, 128, (g) => {
          const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
          grad.addColorStop(0, 'rgba(0,0,0,0.75)')
          grad.addColorStop(0.7, 'rgba(0,0,0,0.4)')
          grad.addColorStop(1, 'rgba(0,0,0,0)')
          g.fillStyle = grad
          g.fillRect(0, 0, 128, 128)
        }),
      }),
    }
  }, [])
}
type Mats = ReturnType<typeof useMaterials>

// Soft contact shadow so a prop sits on the floor instead of floating over it.
function Shadow({ m, size }: { m: Mats; size: [number, number] }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]} scale={[size[0], size[1], 1]} material={m.shadow}>
      <planeGeometry />
    </mesh>
  )
}

function Drawers({ m, w, h, n, z, y0 }: { m: Mats; w: number; h: number; n: number; z: number; y0: number }) {
  const dh = h / n
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} position={[0, y0 + dh * (i + 0.5), z]}>
          <RoundedBox args={[w, dh - 0.012, 0.022]} radius={0.006} smoothness={2} material={m.red} />
          <mesh position={[0, dh / 2 - 0.022, 0.02]} material={m.alu}>
            <boxGeometry args={[w - 0.04, 0.016, 0.022]} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function ToolChest({ m, position }: { m: Mats; position: V3 }) {
  return (
    <group position={position}>
      <Shadow m={m} size={[2.3, 1.2]} />
      {/* castors */}
      {[-0.7, 0.7].flatMap((x) =>
        [-0.22, 0.22].map((z) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh position={[0, 0.05, 0]} rotation-z={Math.PI / 2} material={m.rubber}>
              <cylinderGeometry args={[0.05, 0.05, 0.035, 20]} />
            </mesh>
            <mesh position={[0, 0.1, 0]} material={m.darkSteel}>
              <boxGeometry args={[0.07, 0.03, 0.09]} />
            </mesh>
          </group>
        )),
      )}
      {/* roll cabinet */}
      <RoundedBox args={[1.62, 0.86, 0.6]} radius={0.018} smoothness={3} position={[0, 0.55, 0]} material={m.red} />
      <Drawers m={m} w={1.52} h={0.8} n={5} z={0.305} y0={0.15} />
      <mesh position={[0, 0.988, 0]} material={m.rubber}>
        <boxGeometry args={[1.6, 0.012, 0.58]} />
      </mesh>
      <mesh position={[0.86, 0.72, 0]} rotation-x={Math.PI / 2} material={m.alu}>
        <capsuleGeometry args={[0.014, 0.34, 4, 12]} />
      </mesh>
      {/* top chest */}
      <RoundedBox args={[1.56, 0.46, 0.5]} radius={0.016} smoothness={3} position={[0, 1.226, -0.04]} material={m.red} />
      <Drawers m={m} w={1.46} h={0.3} n={3} z={0.216} y0={1.01} />
      <mesh position={[0, 1.39, 0.212]} material={m.alu}>
        <boxGeometry args={[0.16, 0.035, 0.012]} />
      </mesh>
    </group>
  )
}

function Bottle({ m, position, mat, h = 0.24 }: { m: Mats; position: V3; mat: THREE.Material; h?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, h / 2, 0]} material={mat}>
        <cylinderGeometry args={[0.05, 0.055, h, 24]} />
      </mesh>
      <mesh position={[0, h + 0.02, 0]} material={m.plastic}>
        <cylinderGeometry args={[0.02, 0.03, 0.045, 16]} />
      </mesh>
    </group>
  )
}

function Workbench({ m, position }: { m: Mats; position: V3 }) {
  const W = 2.5
  return (
    <group position={position}>
      <Shadow m={m} size={[3.2, 1.4]} />
      <RoundedBox args={[W, 0.06, 0.78]} radius={0.012} smoothness={2} position={[0, 0.92, 0]} material={m.wood} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (W / 2 - 0.06), 0.445, sz * 0.33]} material={m.darkSteel}>
            <boxGeometry args={[0.05, 0.89, 0.05]} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.2, 0]} material={m.steel}>
        <boxGeometry args={[W - 0.14, 0.025, 0.66]} />
      </mesh>
      <mesh position={[0, 0.86, 0.34]} material={m.darkSteel}>
        <boxGeometry args={[W - 0.14, 0.05, 0.03]} />
      </mesh>
      {/* under the bench */}
      <RoundedBox args={[0.56, 0.3, 0.4]} radius={0.02} position={[-0.8, 0.365, 0]} material={m.crateBlue} />
      <RoundedBox args={[0.56, 0.3, 0.4]} radius={0.02} position={[-0.18, 0.365, 0.02]} material={m.crateGrey} />
      <RoundedBox args={[0.5, 0.36, 0.42]} radius={0.008} position={[0.75, 0.395, -0.02]} rotation-y={0.12} material={m.card} />
      {/* on the bench */}
      <group position={[-0.85, 0.95, -0.05]} rotation-y={0.2}>
        <RoundedBox args={[0.5, 0.2, 0.24]} radius={0.02} position={[0, 0.1, 0]} material={m.red} />
        <mesh position={[0, 0.235, 0]} rotation-z={Math.PI / 2} material={m.darkSteel}>
          <capsuleGeometry args={[0.012, 0.2, 4, 10]} />
        </mesh>
      </group>
      <Bottle m={m} position={[0.5, 0.95, -0.18]} mat={m.oilYellow} />
      <Bottle m={m} position={[0.66, 0.95, -0.1]} mat={m.oilYellow} />
      <Bottle m={m} position={[0.84, 0.95, -0.2]} mat={m.oilBlack} h={0.2} />
      {/* pegboard and a strip light over it, fixed to the wall behind */}
      <mesh position={[0, 1.72, -0.375]} material={m.pegboard}>
        <planeGeometry args={[W, 1.25]} />
      </mesh>
      <mesh position={[0, 1.72, -0.385]} material={m.darkSteel}>
        <boxGeometry args={[W + 0.06, 1.31, 0.02]} />
      </mesh>
    </group>
  )
}

function Rack({ m, position, rotation = 0 }: { m: Mats; position: V3; rotation?: number }) {
  const W = 1.9
  const D = 0.5
  const shelves = [0.12, 0.72, 1.32, 1.92]
  return (
    <group position={position} rotation-y={rotation}>
      <Shadow m={m} size={[2.5, 1.1]} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[(sx * W) / 2, 1.05, (sz * D) / 2]} material={m.steel}>
            <boxGeometry args={[0.045, 2.1, 0.045]} />
          </mesh>
        )),
      )}
      {shelves.map((y) => (
        <mesh key={y} position={[0, y, 0]} material={m.steel}>
          <boxGeometry args={[W, 0.03, D]} />
        </mesh>
      ))}
      <RoundedBox args={[0.6, 0.34, 0.42]} radius={0.02} position={[-0.55, 0.305, 0]} material={m.crateGrey} />
      <RoundedBox args={[0.6, 0.34, 0.42]} radius={0.02} position={[0.2, 0.305, 0]} material={m.crateBlue} />
      <RoundedBox args={[0.6, 0.34, 0.42]} radius={0.02} position={[-0.5, 0.905, 0]} material={m.crateBlue} />
      <RoundedBox args={[0.46, 0.3, 0.38]} radius={0.008} position={[0.3, 0.885, 0]} rotation-y={-0.1} material={m.card} />
      <Bottle m={m} position={[0.72, 0.735, 0.05]} mat={m.oilBlack} h={0.26} />
      <RoundedBox args={[0.46, 0.4, 0.4]} radius={0.008} position={[-0.6, 1.535, 0]} material={m.card} />
      <Bottle m={m} position={[0.0, 1.335, 0.04]} mat={m.oilYellow} />
      <Bottle m={m} position={[0.16, 1.335, -0.04]} mat={m.oilYellow} />
      <Bottle m={m} position={[0.34, 1.335, 0.05]} mat={m.oilBlack} h={0.2} />
      <RoundedBox args={[0.6, 0.3, 0.42]} radius={0.02} position={[0.45, 2.085, 0]} material={m.crateGrey} />
    </group>
  )
}

function Drum({ m, position }: { m: Mats; position: V3 }) {
  return (
    <group position={position}>
      <Shadow m={m} size={[1.1, 1.1]} />
      <mesh position={[0, 0.44, 0]} material={m.drum}>
        <cylinderGeometry args={[0.29, 0.29, 0.88, 40]} />
      </mesh>
      {[0.3, 0.58].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2} material={m.drum}>
          <torusGeometry args={[0.29, 0.012, 8, 40]} />
        </mesh>
      ))}
      {[0.006, 0.874].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2} material={m.drum}>
          <torusGeometry args={[0.292, 0.01, 8, 40]} />
        </mesh>
      ))}
      <mesh position={[0.14, 0.89, 0.05]} material={m.darkSteel}>
        <cylinderGeometry args={[0.035, 0.035, 0.02, 16]} />
      </mesh>
    </group>
  )
}

function Extinguisher({ m, position, rotation = 0 }: { m: Mats; position: V3; rotation?: number }) {
  return (
    <group position={position} rotation-y={rotation}>
      <mesh material={m.extinguisher}>
        <capsuleGeometry args={[0.075, 0.36, 6, 24]} />
      </mesh>
      <mesh position={[0, 0.29, 0]} material={m.darkSteel}>
        <cylinderGeometry args={[0.025, 0.035, 0.07, 14]} />
      </mesh>
      <mesh position={[0.05, 0.33, 0]} rotation-z={-0.5} material={m.darkSteel}>
        <boxGeometry args={[0.13, 0.018, 0.03]} />
      </mesh>
      <mesh position={[-0.09, 0.1, 0]} rotation-z={0.15} material={m.rubber}>
        <capsuleGeometry args={[0.012, 0.3, 4, 8]} />
      </mesh>
      <mesh position={[0, 0.02, -0.085]} material={m.darkSteel}>
        <boxGeometry args={[0.12, 0.3, 0.01]} />
      </mesh>
    </group>
  )
}

export function Props({ room }: { room: { x: number; z: number } }) {
  const m = useMaterials()
  return (
    <>
      {/* back wall, either side of the door */}
      <ToolChest m={m} position={[-7.2, 0, -room.z + 0.42]} />
      <Workbench m={m} position={[7.4, 0, -room.z + 0.46]} />
      <Extinguisher m={m} position={[4.1, 1.15, -room.z + 0.1]} />
      {/* side walls */}
      <Rack m={m} position={[-room.x + 0.36, 0, 5.2]} rotation={Math.PI / 2} />
      <Rack m={m} position={[room.x - 0.36, 0, 6]} rotation={-Math.PI / 2} />
      {/* front corners */}
      <Drum m={m} position={[room.x - 1.3, 0, room.z - 0.75]} />
      <Drum m={m} position={[room.x - 2.05, 0, room.z - 0.6]} />
      <Extinguisher m={m} position={[-3.2, 1.15, room.z - 0.1]} rotation={Math.PI} />
    </>
  )
}
