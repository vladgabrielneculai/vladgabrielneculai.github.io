// The garage door: a roller shutter with a painted mural that rolls up onto a night street.
// The street is painted, not modelled: a shop-front backdrop, the road, the weather (rain,
// a clear night, snow or cherry blossom), and now and then a car's headlamps sweeping past.
// All artwork is original and drawn here.
import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { drive } from '../drive'
import { makeEngine, rain, rattle, type Engine } from '../sound'
import { OPEN_TIME, useStore, type Weather } from '../store'
import { BASE, dress } from './Display'
import { JP, LATIN, RED, text, texture, useFonts } from './Jdm'

type G = CanvasRenderingContext2D
type Room = { x: number; z: number; h: number }

// Door opening in the back wall, centred on x = 0.
export const OPENING = { w: 6.4, h: 3.2 }

// Street layout, measured outward from the back wall (z = -room.z).
const WIDTH = 28 // painted width of the street, x from -14 to 14
const NEAR = 1.2 // pavement outside the door
const ROAD = 5 // two narrow lanes
const FAR = 1.2 // pavement in front of the shops
const KERB = 0.12 // road sits this far below the pavements
const FACADE_H = 14
// Japan drives on the left: seen from the garage, westbound traffic (towards -x) uses the near
// lane, eastbound the far one. z is measured out from the wall.
const LANES = [
  { z: NEAR + 1.25, dir: -1 },
  { z: NEAR + 3.75, dir: 1 },
]

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function glow(g: G, x: number, y: number, r: number, color: string, a = 1) {
  g.save()
  g.globalCompositeOperation = 'lighter'
  g.globalAlpha = a
  const grad = g.createRadialGradient(x, y, 0, x, y, r)
  grad.addColorStop(0, color)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(x - r, y - r, r * 2, r * 2)
  g.restore()
}

// ---------------------------------------------------------------- the mural on the shutter

// Cartoon of the Mazda3 doing a burnout, drawn on a 1024 x 512 board.
function wheel(g: G, x: number, y: number, spinning: boolean) {
  g.fillStyle = '#101113'
  g.strokeStyle = '#040405'
  g.lineWidth = 5
  g.beginPath()
  g.arc(x, y, 50, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  g.strokeStyle = '#26282c'
  g.lineWidth = 3
  g.beginPath()
  g.arc(x, y, 43, 0, Math.PI * 2)
  g.stroke()
  const rim = g.createRadialGradient(x - 8, y - 10, 4, x, y, 36)
  rim.addColorStop(0, '#f4f6f7')
  rim.addColorStop(1, '#8c939a')
  g.fillStyle = rim
  g.beginPath()
  g.arc(x, y, 35, 0, Math.PI * 2)
  g.fill()
  // red caliper behind the spokes
  g.strokeStyle = '#c0151f'
  g.lineWidth = 10
  g.beginPath()
  g.arc(x, y, 25, -0.9, 0.2)
  g.stroke()
  if (spinning) {
    // a blur of rings and spin arcs instead of spokes
    g.strokeStyle = 'rgba(70,74,80,0.55)'
    for (const r of [12, 19, 27]) {
      g.lineWidth = 3
      g.beginPath()
      g.arc(x, y, r, 0, Math.PI * 2)
      g.stroke()
    }
    g.strokeStyle = 'rgba(255,255,255,0.8)'
    g.lineWidth = 2.5
    for (const [r, a] of [[31, 0.3], [22, 2.2], [31, 3.9], [16, 4.9]]) {
      g.beginPath()
      g.arc(x, y, r, a, a + 1.1)
      g.stroke()
    }
  } else {
    g.fillStyle = '#3b3f45'
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2
      g.beginPath()
      g.moveTo(x + Math.cos(a - 0.1) * 10, y + Math.sin(a - 0.1) * 10)
      g.lineTo(x + Math.cos(a - 0.17) * 33, y + Math.sin(a - 0.17) * 33)
      g.lineTo(x + Math.cos(a + 0.17) * 33, y + Math.sin(a + 0.17) * 33)
      g.lineTo(x + Math.cos(a + 0.1) * 10, y + Math.sin(a + 0.1) * 10)
      g.fill()
    }
  }
  g.fillStyle = '#d7dbdf'
  g.strokeStyle = '#2a2d31'
  g.lineWidth = 2
  g.beginPath()
  g.arc(x, y, 7, 0, Math.PI * 2)
  g.fill()
  g.stroke()
}

function puff(g: G, x: number, y: number, r: number) {
  g.fillStyle = '#eceef1'
  g.strokeStyle = '#1b1c1f'
  g.lineWidth = 3.5
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  g.fillStyle = 'rgba(160,166,174,0.35)'
  g.beginPath()
  g.arc(x + r * 0.16, y + r * 0.22, r * 0.72, 0, Math.PI * 2)
  g.fill()
}

function toonCar(g: G) {
  const RX = 548 // rear wheel
  const FX = 836 // front wheel
  const WY = 402
  // tyre marks laid down behind the rear wheel
  g.strokeStyle = 'rgba(5,5,6,0.85)'
  g.lineCap = 'round'
  for (const dy of [0, 12]) {
    g.lineWidth = 9
    g.beginPath()
    g.moveTo(RX - 10, 452 + dy * 0.3)
    g.bezierCurveTo(400, 458 + dy, 240, 446 + dy, 40, 466 + dy)
    g.stroke()
  }
  // smoke billowing back from the rear tyre, biggest (furthest) first
  const rand = rng(7)
  const puffs: [number, number, number][] = []
  for (let i = 0; i < 34; i++) {
    const t = Math.pow(i / 33, 0.85)
    // the cloud grows and lifts as it drifts back, and spreads out vertically
    const spread = 20 + t * 120
    puffs.push([530 - t * 500 + (rand() - 0.5) * 60, 436 - t * 120 + (rand() - 0.5) * spread, 16 + t * 64 + rand() * 18])
  }
  for (const [x, y, r] of puffs.reverse()) puff(g, x, y, r)

  g.save()
  // nose up a touch: all the weight is on the spinning rear wheels
  g.translate(700, 452)
  g.rotate(-0.035)
  g.translate(-700, -452)

  // body
  const arc = 0.543 // where the arch meets the sill line
  g.beginPath()
  g.moveTo(486, 430)
  g.lineTo(476, 400)
  g.quadraticCurveTo(468, 352, 486, 318)
  g.lineTo(500, 292)
  g.lineTo(522, 290)
  g.quadraticCurveTo(600, 248, 690, 250)
  g.quadraticCurveTo(735, 254, 772, 306)
  g.quadraticCurveTo(850, 314, 900, 336)
  g.quadraticCurveTo(924, 348, 926, 372)
  g.lineTo(922, 412)
  g.quadraticCurveTo(918, 430, 900, 432)
  g.arc(FX, WY, 58, arc, Math.PI - arc, true)
  g.arc(RX, WY, 58, arc, Math.PI - arc, true)
  g.closePath()
  const body = g.createLinearGradient(0, 250, 0, 432)
  body.addColorStop(0, '#6a7178')
  body.addColorStop(0.45, '#33373c')
  body.addColorStop(1, '#141518')
  g.fillStyle = body
  g.fill()
  g.strokeStyle = '#050506'
  g.lineWidth = 6
  g.lineJoin = 'round'
  g.stroke()

  // glasshouse, thick C-pillar, pillars
  g.beginPath()
  g.moveTo(522, 302)
  g.quadraticCurveTo(598, 262, 688, 262)
  g.quadraticCurveTo(726, 266, 758, 310)
  g.lineTo(540, 318)
  g.closePath()
  const glass = g.createLinearGradient(0, 262, 0, 318)
  glass.addColorStop(0, '#2c3d52')
  glass.addColorStop(1, '#0f1620')
  g.fillStyle = glass
  g.fill()
  g.save()
  g.clip()
  g.fillStyle = 'rgba(255,255,255,0.28)'
  for (const x of [600, 690]) {
    g.beginPath()
    g.moveTo(x, 260)
    g.lineTo(x + 26, 260)
    g.lineTo(x - 14, 320)
    g.lineTo(x - 40, 320)
    g.fill()
  }
  g.restore()
  g.strokeStyle = '#050506'
  g.lineWidth = 5
  g.stroke()
  g.fillStyle = '#4a5057'
  g.beginPath()
  g.moveTo(527, 300)
  g.lineTo(580, 275)
  g.lineTo(594, 317)
  g.lineTo(540, 318)
  g.closePath()
  g.fill()
  g.lineWidth = 4
  g.stroke()
  g.lineWidth = 8
  g.beginPath()
  g.moveTo(668, 263)
  g.lineTo(662, 315)
  g.stroke()

  // shoulder highlight, door shut lines, handles, sill
  g.strokeStyle = 'rgba(255,255,255,0.55)'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(505, 330)
  g.quadraticCurveTo(700, 322, 884, 343)
  g.stroke()
  g.strokeStyle = 'rgba(5,5,6,0.7)'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(664, 318)
  g.lineTo(668, 424)
  g.moveTo(770, 318)
  g.quadraticCurveTo(782, 380, 778, 424)
  g.stroke()
  g.fillStyle = '#0c0d0f'
  g.fillRect(612, 342, 22, 5)
  g.fillRect(712, 340, 22, 5)
  g.fillRect(606, 424, 170, 8)
  // mirror
  g.fillStyle = '#3c4147'
  g.strokeStyle = '#050506'
  g.lineWidth = 3
  g.beginPath()
  g.ellipse(762, 318, 15, 9, -0.2, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  // headlamp and its beam, grille, tail lamp
  g.save()
  g.globalCompositeOperation = 'lighter'
  const beam = g.createLinearGradient(916, 0, 1024, 0)
  beam.addColorStop(0, 'rgba(255,250,225,0.55)')
  beam.addColorStop(1, 'rgba(255,250,225,0)')
  g.fillStyle = beam
  g.beginPath()
  g.moveTo(914, 352)
  g.lineTo(1030, 300)
  g.lineTo(1030, 420)
  g.closePath()
  g.fill()
  g.restore()
  g.fillStyle = '#f3f9ff'
  g.strokeStyle = '#050506'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(870, 341)
  g.lineTo(913, 352)
  g.lineTo(917, 363)
  g.lineTo(878, 357)
  g.closePath()
  g.fill()
  g.stroke()
  g.fillStyle = '#0a0a0b'
  g.beginPath()
  g.moveTo(904, 372)
  g.lineTo(923, 376)
  g.lineTo(921, 410)
  g.lineTo(900, 406)
  g.closePath()
  g.fill()
  g.fillStyle = '#e0222c'
  g.beginPath()
  g.moveTo(478, 330)
  g.lineTo(501, 322)
  g.lineTo(503, 337)
  g.lineTo(480, 345)
  g.closePath()
  g.fill()
  g.stroke()
  glow(g, 490, 334, 30, 'rgba(255,40,40,0.8)', 0.7)
  // a lick of flame from the exhaust
  g.fillStyle = '#ffb21f'
  g.strokeStyle = '#050506'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(486, 420)
  g.quadraticCurveTo(470, 404, 440, 416)
  g.quadraticCurveTo(462, 420, 446, 432)
  g.quadraticCurveTo(470, 434, 486, 428)
  g.closePath()
  g.fill()
  g.stroke()
  g.fillStyle = '#fff3b0'
  g.beginPath()
  g.ellipse(474, 423, 10, 4, 0, 0, Math.PI * 2)
  g.fill()

  wheel(g, RX, WY, true)
  wheel(g, FX, WY, false)
  g.restore()

  // fresh smoke in front of the rear tyre
  for (const [x, y, r] of [[592, 448, 18], [528, 446, 30], [566, 452, 22]] as const) puff(g, x, y, r)
}

function mural(g: G) {
  g.scale(2, 2) // drawn at 1024 x 512, stored at twice that
  g.fillStyle = '#16181d'
  g.fillRect(0, 0, 1024, 512)
  // rising-sun burst behind the lettering
  const cx = 300
  const cy = 205
  g.fillStyle = 'rgba(177,18,29,0.24)'
  for (let i = 0; i < 24; i += 2) {
    const a0 = (i / 24) * Math.PI * 2
    const a1 = ((i + 1) / 24) * Math.PI * 2
    g.beginPath()
    g.moveTo(cx, cy)
    g.lineTo(cx + Math.cos(a0) * 1200, cy + Math.sin(a0) * 1200)
    g.lineTo(cx + Math.cos(a1) * 1200, cy + Math.sin(a1) * 1200)
    g.closePath()
    g.fill()
  }
  const sun = g.createRadialGradient(cx - 30, cy - 40, 10, cx, cy, 140)
  sun.addColorStop(0, '#e4313b')
  sun.addColorStop(1, '#9c0f19')
  g.fillStyle = sun
  g.beginPath()
  g.arc(cx, cy, 138, 0, Math.PI * 2)
  g.fill()
  // tarmac along the bottom
  g.fillStyle = '#0d0e11'
  g.fillRect(0, 452, 1024, 60)

  toonCar(g)

  // lettering: VGN in chunky sticker style, a ribbon, and the sound effect
  g.save()
  g.translate(cx, cy - 6)
  g.transform(1, 0, -0.2, 1, 0, 0)
  g.font = `800 196px ${LATIN}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.fillStyle = '#4d060c'
  g.fillText('VGN', 9, 9)
  g.lineWidth = 18
  g.strokeStyle = '#0b0b0d'
  g.strokeText('VGN', 0, 0)
  const fill = g.createLinearGradient(0, -80, 0, 80)
  fill.addColorStop(0, '#ffffff')
  fill.addColorStop(1, '#cfd4da')
  g.fillStyle = fill
  g.fillText('VGN', 0, 0)
  g.restore()
  g.fillStyle = '#0b0b0d'
  g.beginPath()
  g.moveTo(160, 298)
  g.lineTo(458, 298)
  g.lineTo(444, 338)
  g.lineTo(146, 338)
  g.closePath()
  g.fill()
  text(g, 'GARAGE', 236, 319, `800 24px ${LATIN}`, '#ffffff')
  text(g, 'ガレージ', 372, 319, `26px ${JP}`, RED)
  g.save()
  g.translate(770, 150)
  g.rotate(-0.16)
  g.font = `72px ${JP}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.lineWidth = 10
  g.strokeStyle = '#0b0b0d'
  g.strokeText('ブォォン!', 0, 0)
  g.fillStyle = '#ffd23f'
  g.fillText('ブォォン!', 0, 0)
  g.restore()
  // 走り屋 down the right-hand edge
  for (const [i, ch] of [...'走り屋'].entries()) {
    g.font = `70px ${JP}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineWidth = 8
    g.strokeStyle = '#0b0b0d'
    g.strokeText(ch, 968, 96 + i * 80)
    g.fillStyle = RED
    g.fillText(ch, 968, 96 + i * 80)
  }

  // the shutter's ribs show through the paint
  for (let y = 0; y < 512; y += 16) {
    const s = g.createLinearGradient(0, y, 0, y + 16)
    s.addColorStop(0, 'rgba(255,255,255,0.10)')
    s.addColorStop(0.5, 'rgba(255,255,255,0)')
    s.addColorStop(0.85, 'rgba(0,0,0,0.12)')
    s.addColorStop(1, 'rgba(0,0,0,0.42)')
    g.fillStyle = s
    g.fillRect(0, y, 1024, 16)
  }
  // weathering
  const dirt = g.createLinearGradient(0, 400, 0, 512)
  dirt.addColorStop(0, 'rgba(20,16,12,0)')
  dirt.addColorStop(1, 'rgba(20,16,12,0.45)')
  g.fillStyle = dirt
  g.fillRect(0, 400, 1024, 112)
  const rand = rng(3)
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${rand() > 0.5 ? 255 : 0},${rand() > 0.5 ? 255 : 0},${rand() > 0.5 ? 255 : 0},${rand() * 0.05})`
    g.fillRect(rand() * 1024, rand() * 512, 1 + rand(), 1 + rand())
  }
}

// ---------------------------------------------------------------- the street

const FW = 2560
const FH = 1280
const PX = FW / WIDTH // facade pixels per metre
const fx = (x: number) => (x + WIDTH / 2) * PX
const fy = (h: number) => FH - h * PX

// Lit things along the shop fronts, also used for their reflections in the wet road:
// x in metres, colour, strength, width in metres.
const LIGHTS: [number, string, number, number][] = [
  [-10.95, '#33ff99', 0.7, 0.5], // pharmacy cross
  [-12.2, '#dff2ec', 0.5, 2.2], // pharmacy window
  [-10.2, '#ff3b30', 0.7, 0.4], // izakaya lanterns
  [-9.3, '#ff3b30', 0.7, 0.4],
  [-7.2, '#ff3b30', 0.7, 0.4],
  [-8.2, '#ffb560', 0.6, 1.4], // izakaya door
  [-4.1, '#ffc070', 0.75, 3.4], // ramen shop
  [-5.4, '#ff3b30', 0.6, 0.4],
  [-2.1, '#ff3b30', 0.6, 0.4],
  [-0.35, '#eaf4ff', 0.6, 0.6], // vending machines
  [0.35, '#ffe0e0', 0.6, 0.6],
  [3.5, '#f4fbff', 0.9, 4.8], // convenience store
  [9.6, '#4f8dff', 0.6, 0.6], // parking sign
  [10.6, '#ff3d9a', 0.6, 0.4], // karaoke
  [12.2, '#d65cff', 0.6, 1.2], // bar
]

function windows(g: G, x0: number, x1: number, h0: number, h1: number, rand: () => number) {
  for (let h = h0; h + 1.3 < h1; h += 3) {
    for (let x = x0 + 0.5; x + 1.2 < x1; x += 2.1) {
      const lit = rand() < 0.55
      const X = fx(x)
      const Y = fy(h + 1.3)
      const w = 1.15 * PX
      const hh = 1.25 * PX
      if (lit) {
        const warm = rand() < 0.75
        const grad = g.createLinearGradient(0, Y, 0, Y + hh)
        grad.addColorStop(0, warm ? '#f3c479' : '#bcd6ff')
        grad.addColorStop(1, warm ? '#a8662c' : '#5b7bb0')
        g.fillStyle = grad
        g.fillRect(X, Y, w, hh)
        // blinds
        g.fillStyle = 'rgba(40,24,12,0.35)'
        const slats = (rand() * 10) | 0
        for (let k = 0; k < slats; k++) g.fillRect(X, Y + k * 6, w, 3)
      } else {
        g.fillStyle = '#0b0f17'
        g.fillRect(X, Y, w, hh)
        g.fillStyle = 'rgba(120,140,190,0.12)'
        g.fillRect(X, Y, w, hh * 0.3)
      }
      g.fillStyle = '#060608'
      g.fillRect(X - 3, Y + hh, w + 6, 5)
      // an air-conditioning unit beside some windows
      if (rand() < 0.35 && x + 1.9 < x1) {
        g.fillStyle = '#8b8f94'
        g.fillRect(X + w + 6, Y + hh - 40, 52, 38)
        g.strokeStyle = '#3c3f43'
        g.lineWidth = 2
        g.beginPath()
        g.arc(X + w + 32, Y + hh - 21, 13, 0, Math.PI * 2)
        g.stroke()
      }
    }
  }
}

function building(g: G, x0: number, x1: number, h: number, color: string, rand: () => number, upperFrom = 3.4) {
  const grad = g.createLinearGradient(0, fy(h), 0, FH)
  grad.addColorStop(0, '#0c0c10')
  grad.addColorStop(1, color)
  g.fillStyle = grad
  g.fillRect(fx(x0), fy(h), (x1 - x0) * PX, h * PX)
  g.fillStyle = 'rgba(255,255,255,0.08)'
  g.fillRect(fx(x0), fy(h), (x1 - x0) * PX, 6)
  windows(g, x0, x1, upperFrom, h - 0.4, rand)
}

function lantern(g: G, x: number, h: number, label?: string) {
  const X = fx(x)
  const Y = fy(h)
  glow(g, X, Y, 90, 'rgba(255,70,40,0.9)', 0.55)
  const body = g.createRadialGradient(X - 6, Y - 8, 4, X, Y, 34)
  body.addColorStop(0, '#ff8a6a')
  body.addColorStop(1, '#c2121c')
  g.fillStyle = body
  g.beginPath()
  g.ellipse(X, Y, 25, 33, 0, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(90,0,0,0.5)'
  g.lineWidth = 1.5
  for (let k = -24; k <= 24; k += 7) {
    const w = Math.sqrt(1 - (k / 33) ** 2) * 25
    g.beginPath()
    g.moveTo(X - w, Y + k)
    g.lineTo(X + w, Y + k)
    g.stroke()
  }
  g.fillStyle = '#16110e'
  g.fillRect(X - 14, Y - 38, 28, 8)
  g.fillRect(X - 14, Y + 30, 28, 8)
  if (label) text(g, label, X, Y + 2, `26px ${JP}`, '#1a0a08')
}

function verticalSign(g: G, x: number, top: number, bottom: number, label: string, bg: string, fg: string, neon?: string) {
  const X = fx(x)
  const w = 0.55 * PX
  const Y0 = fy(top)
  const Y1 = fy(bottom)
  if (neon) glow(g, X, (Y0 + Y1) / 2, (Y1 - Y0) * 0.75, neon, 0.35)
  g.fillStyle = bg
  g.fillRect(X - w / 2, Y0, w, Y1 - Y0)
  g.strokeStyle = 'rgba(0,0,0,0.6)'
  g.lineWidth = 4
  g.strokeRect(X - w / 2, Y0, w, Y1 - Y0)
  const chars = [...label]
  const step = (Y1 - Y0) / chars.length
  const size = Math.min(step * 0.78, w * 0.8)
  chars.forEach((c, i) => {
    g.save()
    if (neon) {
      g.shadowColor = neon
      g.shadowBlur = 18
    }
    text(g, c, X, Y0 + step * (i + 0.5), `${size}px ${JP}`, fg)
    g.restore()
  })
}

function vending(g: G, x0: number, body: string, rand: () => number) {
  const X = fx(x0)
  const w = 0.7 * PX
  const Y = fy(1.83)
  const h = 1.83 * PX
  glow(g, X + w / 2, Y + h * 0.4, 130, 'rgba(220,235,255,0.9)', 0.35)
  g.fillStyle = body
  g.fillRect(X, Y, w, h)
  const win = g.createLinearGradient(0, Y + 10, 0, Y + h * 0.55)
  win.addColorStop(0, '#ffffff')
  win.addColorStop(1, '#cfe3f5')
  g.fillStyle = win
  g.fillRect(X + 5, Y + 8, w - 10, h * 0.52)
  const cans = ['#d7262f', '#1f62c9', '#f2b21b', '#2aa84a', '#ffffff', '#7b3fbf', '#e86a1c', '#1a1a1a']
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 5; c++) {
      g.fillStyle = cans[(rand() * cans.length) | 0]
      g.fillRect(X + 9 + c * ((w - 18) / 5), Y + 14 + r * 22, (w - 18) / 5 - 3, 15)
    }
  g.fillStyle = '#20242a'
  g.fillRect(X + 8, Y + h * 0.7, w - 16, 18)
  g.fillStyle = 'rgba(0,0,0,0.25)'
  g.fillRect(X + w - 6, Y, 6, h)
}

function facade(g: G) {
  const rand = rng(11)
  // sky with the city's glow low down
  const sky = g.createLinearGradient(0, 0, 0, FH)
  sky.addColorStop(0, '#05070e')
  sky.addColorStop(0.55, '#141127')
  sky.addColorStop(1, '#2b1a2d')
  g.fillStyle = sky
  g.fillRect(0, 0, FW, FH)
  glow(g, FW * 0.3, fy(9), 700, 'rgba(255,120,90,0.35)', 0.5)
  glow(g, FW * 0.75, fy(10), 800, 'rgba(160,80,255,0.3)', 0.5)

  // distant towers
  for (let x = -14; x < 14; ) {
    const w = 1.6 + rand() * 2.8
    const h = 9 + rand() * 4.8
    g.fillStyle = rand() < 0.5 ? '#0b0d15' : '#0e1019'
    g.fillRect(fx(x), fy(h), w * PX, h * PX)
    for (let yy = h - 0.6; yy > 6; yy -= 0.55)
      for (let xx = x + 0.2; xx < x + w - 0.3; xx += 0.42)
        if (rand() < 0.16) {
          g.fillStyle = rand() < 0.7 ? 'rgba(247,198,109,0.75)' : 'rgba(160,195,255,0.7)'
          g.fillRect(fx(xx), fy(yy), 9, 11)
        }
    if (h > 13) glow(g, fx(x + w / 2), fy(h) - 6, 18, 'rgba(255,30,30,1)', 0.9)
    x += w + 0.1
  }

  // buildings behind the car park
  building(g, 6.2, 10.4, 8, '#14161c', rand, 1.2)

  // pharmacy, with a karaoke sign upstairs
  building(g, -14, -10.7, 9, '#1c1b20', rand)
  {
    const g0 = fy(2.6)
    const glass = g.createLinearGradient(0, g0, 0, FH)
    glass.addColorStop(0, '#f2fbf7')
    glass.addColorStop(1, '#a9cfc2')
    g.fillStyle = glass
    g.fillRect(fx(-13.7), g0, 2.6 * PX, 2.6 * PX)
    g.fillStyle = 'rgba(40,90,70,0.45)'
    for (let s = 0.4; s < 2.3; s += 0.45) g.fillRect(fx(-13.6), fy(s), 2.4 * PX, 6)
    g.fillStyle = '#1c8a4e'
    g.fillRect(fx(-13.9), fy(3.05), 3.1 * PX, 0.45 * PX)
    text(g, '薬局', fx(-12.35), fy(2.83), `34px ${JP}`, '#ffffff')
    // the green cross, lit
    const X = fx(-10.95)
    const Y = fy(4.3)
    glow(g, X, Y, 110, 'rgba(60,255,150,0.9)', 0.55)
    g.fillStyle = '#3cff98'
    g.fillRect(X - 12, Y - 34, 24, 68)
    g.fillRect(X - 34, Y - 12, 68, 24)
    verticalSign(g, -11.15, 8.2, 5.4, 'カラオケ', '#160812', '#ff9ccc', 'rgba(255,61,154,1)')
  }

  // izakaya
  building(g, -10.7, -6.4, 6.8, '#151114', rand)
  {
    g.fillStyle = '#0b0809'
    g.fillRect(fx(-10.7), fy(3.05), 4.3 * PX, 0.4 * PX)
    // frosted window
    const w = g.createLinearGradient(0, fy(2.1), 0, fy(0.7))
    w.addColorStop(0, '#e7b77a')
    w.addColorStop(1, '#8a5326')
    g.fillStyle = w
    g.fillRect(fx(-10.4), fy(2.1), 1.4 * PX, 1.4 * PX)
    // sliding door with a lattice
    const d = g.createLinearGradient(0, fy(2.25), 0, FH)
    d.addColorStop(0, '#ffcb80')
    d.addColorStop(1, '#b86b2c')
    g.fillStyle = d
    g.fillRect(fx(-8.9), fy(2.25), 1.5 * PX, 2.25 * PX)
    g.strokeStyle = 'rgba(40,22,10,0.85)'
    g.lineWidth = 4
    for (let x = -8.9; x <= -7.39; x += 0.25) {
      g.beginPath()
      g.moveTo(fx(x), fy(2.25))
      g.lineTo(fx(x), FH)
      g.stroke()
    }
    for (let h = 0.2; h < 2.25; h += 0.3) {
      g.beginPath()
      g.moveTo(fx(-8.9), fy(h))
      g.lineTo(fx(-7.4), fy(h))
      g.stroke()
    }
    // short noren over the door
    g.fillStyle = '#1b2442'
    for (let i = 0; i < 3; i++) g.fillRect(fx(-8.92 + i * 0.51), fy(2.25), 0.48 * PX, 0.5 * PX)
    text(g, '酒', fx(-8.15), fy(2.0), `40px ${JP}`, '#ffffff')
    for (const x of [-10.2, -9.3, -7.2]) lantern(g, x, 2.72, '酒')
    verticalSign(g, -6.75, 6.1, 3.4, '居酒屋', '#b1121d', '#ffffff')
  }

  // ramen shop
  building(g, -6.4, -1.8, 7.2, '#2b1f18', rand)
  {
    // timber boarding on the ground floor
    g.strokeStyle = 'rgba(0,0,0,0.35)'
    g.lineWidth = 2
    for (let x = -6.4; x < -1.8; x += 0.18) {
      g.beginPath()
      g.moveTo(fx(x), fy(3.4))
      g.lineTo(fx(x), FH)
      g.stroke()
    }
    g.fillStyle = '#0c0b0b'
    g.fillRect(fx(-6.2), fy(3.45), 4.2 * PX, 0.65 * PX)
    g.strokeStyle = '#c9a24a'
    g.lineWidth = 3
    g.strokeRect(fx(-6.1), fy(3.38), 4.0 * PX, 0.51 * PX)
    text(g, 'ラーメン', fx(-4.1), fy(3.12), `46px ${JP}`, '#f3e3b5')
    // the bright interior: counter, stools and two customers
    const inside = g.createLinearGradient(0, fy(2.4), 0, FH)
    inside.addColorStop(0, '#ffe0a0')
    inside.addColorStop(1, '#c9813c')
    g.fillStyle = inside
    g.fillRect(fx(-5.95), fy(2.4), 3.7 * PX, 2.4 * PX)
    g.fillStyle = '#5a3418'
    g.fillRect(fx(-5.95), fy(1.05), 3.7 * PX, 0.12 * PX)
    g.fillStyle = 'rgba(70,40,20,0.85)'
    for (const x of [-5.4, -4.6, -3.8, -3.0]) g.fillRect(fx(x), fy(0.75), 0.3 * PX, 0.75 * PX)
    g.fillStyle = '#2a170c'
    for (const x of [-4.6, -3.0]) {
      g.beginPath()
      g.arc(fx(x + 0.15), fy(1.55), 18, 0, Math.PI * 2)
      g.fill()
      g.beginPath()
      g.ellipse(fx(x + 0.15), fy(1.12), 30, 34, 0, Math.PI, Math.PI * 2)
      g.fill()
    }
    glow(g, fx(-4.1), fy(1.4), 260, 'rgba(255,190,110,0.8)', 0.35)
    // noren across the doorway
    for (const [i, c] of [...'中華そば'].entries()) {
      g.fillStyle = '#1b2547'
      g.fillRect(fx(-5.95 + i * 0.93), fy(2.4), 0.88 * PX, 0.72 * PX)
      text(g, c, fx(-5.95 + i * 0.93 + 0.44), fy(2.02), `52px ${JP}`, '#ffffff')
    }
    lantern(g, -5.4, 2.5)
    lantern(g, -2.1, 2.5)
  }

  // alley with two vending machines at its mouth
  {
    const a = g.createLinearGradient(fx(-1.8), 0, fx(0.8), 0)
    a.addColorStop(0, '#030306')
    a.addColorStop(0.5, '#0b0a12')
    a.addColorStop(1, '#030306')
    g.fillStyle = a
    g.fillRect(fx(-1.8), fy(9), 2.6 * PX, 9 * PX)
    glow(g, fx(-0.3), fy(2.6), 60, 'rgba(255,170,90,0.9)', 0.5)
    vending(g, -0.7, '#f1f3f4', rand)
    vending(g, 0.0, '#c8202a', rand)
  }

  // convenience store
  building(g, 0.8, 6.2, 10.2, '#23262c', rand)
  {
    const glass = g.createLinearGradient(0, fy(2.6), 0, FH)
    glass.addColorStop(0, '#ffffff')
    glass.addColorStop(1, '#dbe7ee')
    g.fillStyle = glass
    g.fillRect(fx(0.95), fy(2.6), 5.1 * PX, 2.6 * PX)
    // shelves full of goods
    const goods = ['#d84b3c', '#3a7bd5', '#f2c230', '#48a868', '#e57fb0', '#ffffff', '#ff8c2a']
    for (let s = 0.35; s < 2.0; s += 0.42) {
      g.fillStyle = '#9aa6ad'
      g.fillRect(fx(1.1), fy(s), 4.8 * PX, 5)
      for (let x = 1.12; x < 5.9; x += 0.09) {
        g.fillStyle = goods[(rand() * goods.length) | 0]
        const hh = 0.06 + rand() * 0.1
        g.fillRect(fx(x), fy(s + hh), 0.07 * PX, hh * PX)
      }
    }
    g.fillStyle = '#3a4248'
    for (let x = 0.95; x <= 6.06; x += 1.02) g.fillRect(fx(x) - 3, fy(2.6), 6, 2.6 * PX)
    glow(g, fx(3.5), fy(1.3), 420, 'rgba(240,250,255,0.9)', 0.3)
    // fascia: white with teal and orange stripes
    g.fillStyle = '#f7f9fa'
    g.fillRect(fx(0.85), fy(3.25), 5.3 * PX, 0.65 * PX)
    g.fillStyle = '#16a39a'
    g.fillRect(fx(0.85), fy(3.25), 5.3 * PX, 10)
    g.fillStyle = '#f39a1e'
    g.fillRect(fx(0.85), fy(3.25) + 14, 5.3 * PX, 8)
    g.fillStyle = '#16a39a'
    g.fillRect(fx(0.85), fy(2.6) - 10, 5.3 * PX, 10)
    text(g, 'コンビニ', fx(2.6), fy(2.88), `40px ${JP}`, '#0f6f69')
    text(g, '24H', fx(5.3), fy(2.88), `800 40px ${LATIN}`, '#f39a1e')
    glow(g, fx(3.5), fy(2.9), 300, 'rgba(255,255,255,0.8)', 0.18)
  }

  // car park: low wall and its sign
  {
    g.fillStyle = '#25272c'
    g.fillRect(fx(6.2), fy(0.9), 4.2 * PX, 0.9 * PX)
    g.fillStyle = 'rgba(255,255,255,0.07)'
    g.fillRect(fx(6.2), fy(0.9), 4.2 * PX, 5)
    g.fillStyle = '#2d3035'
    g.fillRect(fx(9.6) - 5, fy(4.2), 10, 4.2 * PX)
    const X = fx(9.6)
    const Y = fy(4.4)
    glow(g, X, Y, 120, 'rgba(80,140,255,0.9)', 0.45)
    g.fillStyle = '#1f5fbf'
    g.fillRect(X - 38, Y - 38, 76, 76)
    g.strokeStyle = '#ffffff'
    g.lineWidth = 4
    g.strokeRect(X - 32, Y - 32, 64, 64)
    text(g, 'P', X, Y + 2, `800 56px ${LATIN}`, '#ffffff')
    g.fillStyle = '#ffffff'
    g.fillRect(X - 60, Y + 46, 120, 34)
    text(g, '駐車場', X, Y + 63, `24px ${JP}`, '#1f5fbf')
  }

  // bar on the corner
  building(g, 10.4, 14, 11, '#19161d', rand)
  {
    g.fillStyle = '#0a090c'
    g.fillRect(fx(10.6), fy(2.6), 3.2 * PX, 2.6 * PX)
    glow(g, fx(12.2), fy(2.0), 200, 'rgba(214,92,255,0.9)', 0.35)
    g.save()
    g.shadowColor = '#d65cff'
    g.shadowBlur = 24
    text(g, 'BAR', fx(12.2), fy(2.0), `800 64px ${LATIN}`, '#f2c9ff')
    g.restore()
    g.fillStyle = '#3a1b44'
    g.fillRect(fx(11.8), fy(1.4), 0.8 * PX, 1.4 * PX)
    verticalSign(g, 10.6, 8.6, 4.2, 'カラオケ', '#12060e', '#ff9ccc', 'rgba(255,61,154,1)')
  }
}

const RW = 2048
const RH = 512
// Road: the canvas top is the far kerb, the bottom the near one.
function roadBase(g: G, wet: boolean) {
  const rx = (x: number) => (x + WIDTH / 2) * (RW / WIDTH)
  g.fillStyle = '#0c0e12'
  g.fillRect(0, 0, RW, RH)
  const rand = rng(5)
  for (let i = 0; i < 30000; i++) {
    g.fillStyle = `rgba(255,255,255,${rand() * 0.045})`
    g.fillRect(rand() * RW, rand() * RH, 1.5, 1.5)
  }
  // standing water: slightly darker, glassier patches
  for (let i = 0; i < (wet ? 14 : 0); i++) {
    g.fillStyle = 'rgba(0,0,0,0.25)'
    g.beginPath()
    g.ellipse(rand() * RW, rand() * RH, 80 + rand() * 220, 20 + rand() * 50, 0, 0, Math.PI * 2)
    g.fill()
  }
  // the shop lights smeared towards the viewer by the wet surface; dry, just a glow
  smear(g, wet ? 0.55 : 0.16, wet ? 0.95 : 0.4)
  // markings: white edge lines and a dashed centre line
  const mz = (fromFar: number) => fromFar * (RH / ROAD)
  g.fillStyle = 'rgba(225,228,232,0.6)'
  g.fillRect(0, mz(0.25), RW, mz(0.15))
  g.fillRect(0, mz(ROAD - 0.4), RW, mz(0.15))
  g.fillStyle = 'rgba(225,228,232,0.72)'
  for (let x = -14; x < 14; x += 6) g.fillRect(rx(x), mz(ROAD / 2 - 0.075), (3 * RW) / WIDTH, mz(0.15))
  // a manhole cover in the near lane
  const mx = rx(2.6)
  const my = mz(3.9)
  g.fillStyle = '#1b1d21'
  g.beginPath()
  g.ellipse(mx, my, 44, 32, 0, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(160,165,170,0.35)'
  g.lineWidth = 2
  for (const r of [40, 28, 14]) {
    g.beginPath()
    g.ellipse(mx, my, r, r * 0.72, 0, 0, Math.PI * 2)
    g.stroke()
  }
}

function smear(g: G, alpha: number, length: number) {
  const rx = (x: number) => (x + WIDTH / 2) * (RW / WIDTH)
  g.save()
  g.globalCompositeOperation = 'lighter'
  g.filter = 'blur(10px)'
  for (const [x, c, a, w] of LIGHTS) {
    const grad = g.createLinearGradient(0, 0, 0, RH * length)
    grad.addColorStop(0, c)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.globalAlpha = a * alpha
    g.fillStyle = grad
    g.fillRect(rx(x) - (w * RW) / WIDTH / 2, 0, (w * RW) / WIDTH, RH * length)
  }
  g.restore()
}

// A layer of snow, thin and grey where tyres have pressed it into slush along `tracks` (px).
function snow(g: G, w: number, h: number, tracks: number[] = [], track = 0) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const s = c.getContext('2d')!
  s.fillStyle = 'rgba(200,207,224,0.94)'
  s.fillRect(0, 0, w, h)
  const rand = rng(17)
  for (let i = 0; i < (w * h) / 40; i++) {
    s.fillStyle = rand() < 0.5 ? `rgba(255,255,255,${rand() * 0.45})` : `rgba(120,130,155,${rand() * 0.22})`
    s.fillRect(rand() * w, rand() * h, 2, 2)
  }
  s.globalCompositeOperation = 'destination-out'
  s.filter = 'blur(4px)'
  for (const y of tracks)
    for (let x = 0; x < w; x += 16) {
      s.fillStyle = `rgba(0,0,0,${0.7 + rand() * 0.2})`
      s.fillRect(x, y - track / 2 + Math.sin(x / 140 + y) * 3, 18, track)
    }
  g.drawImage(c, 0, 0)
}

// Fallen cherry petals, gathered along the kerbs when `kerbs` is set.
function petals(g: G, w: number, h: number, n: number, size: number, kerbs = false) {
  const rand = rng(31)
  for (let i = 0; i < n; i++) {
    const v = rand()
    const y = kerbs ? (rand() < 0.5 ? v * v : 1 - v * v) * h : v * h
    g.save()
    g.translate(rand() * w, y)
    g.rotate(rand() * Math.PI)
    g.fillStyle = `rgba(${245 + rand() * 10},${150 + rand() * 50},${178 + rand() * 35},${0.5 + rand() * 0.45})`
    g.beginPath()
    g.ellipse(0, 0, size * (1 + rand() * 0.8), size * (0.6 + rand() * 0.4), 0, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
}

function road(g: G, weather: Weather) {
  roadBase(g, weather === 'rain')
  const mz = (fromFar: number) => fromFar * (RH / ROAD)
  if (weather === 'snow') {
    // two wheel tracks down each lane
    const tracks = LANES.flatMap((l) => [l.z - NEAR - 0.72, l.z - NEAR + 0.72]).map((z) => mz(ROAD - z))
    snow(g, RW, RH, tracks, mz(0.34))
    smear(g, 0.22, 0.5)
  }
  if (weather === 'sakura') petals(g, RW, RH, 1800, 3, true)
}

function pavement(g: G, w: number, h: number, base: string, lit: (x: number) => number, weather: Weather = 'rain') {
  pavementBase(g, w, h, base, lit)
  if (weather === 'snow') {
    snow(g, w, h)
    for (let x = 0; x < w; x += 4) {
      const k = lit((x / w - 0.5) * WIDTH)
      if (k > 0.01) {
        g.fillStyle = `rgba(255,206,150,${Math.min(0.4, k * 0.8)})`
        g.fillRect(x, 0, 4, h)
      }
    }
  }
  if (weather === 'sakura') petals(g, w, h, 700, 1.6)
}

function pavementBase(g: G, w: number, h: number, base: string, lit: (x: number) => number) {
  g.fillStyle = base
  g.fillRect(0, 0, w, h)
  const rand = rng(9)
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = `rgba(255,255,255,${rand() * 0.05})`
    g.fillRect(rand() * w, rand() * h, 1.5, 1.5)
  }
  // light falling on it, then the paving joints
  for (let x = 0; x < w; x += 4) {
    const k = lit((x / w - 0.5) * WIDTH)
    if (k > 0.01) {
      g.fillStyle = `rgba(255,214,160,${Math.min(0.5, k)})`
      g.fillRect(x, 0, 4, h)
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.35)'
  const step = (w / WIDTH) * 0.3
  for (let x = 0; x < w; x += step) g.fillRect(x, 0, 1.5, h)
  for (let y = 0; y < h; y += step) g.fillRect(0, y, w, 1.5)
}

// Utility poles, a street lamp and overhead wires, drawn on a transparent sheet.
const POLE_H = 10.5
function poles(g: G) {
  const P = 2048 / WIDTH
  const H = POLE_H * P
  const px = (x: number) => (x + WIDTH / 2) * P
  const py = (h: number) => H - h * P
  const wire = (x0: number, h0: number, x1: number, h1: number, sag: number) => {
    g.beginPath()
    g.moveTo(px(x0), py(h0))
    g.quadraticCurveTo((px(x0) + px(x1)) / 2, (py(h0) + py(h1)) / 2 + sag * P, px(x1), py(h1))
    g.stroke()
  }
  g.strokeStyle = 'rgba(6,6,8,0.95)'
  g.lineWidth = 3
  for (const [h, s] of [[8.6, 0.9], [8.2, 1.1], [7.7, 0.8]]) {
    wire(-16, h + 0.4, -6, h, s)
    wire(-6, h, 8.2, h, s * 1.4)
    wire(8.2, h, 16, h + 0.6, s)
  }
  g.lineWidth = 2
  wire(-6, 7.2, -3.2, 6.2, 0.4)
  wire(8.2, 7.0, 5.6, 6.9, 0.3)
  for (const x of [-6, 8.2]) {
    const grad = g.createLinearGradient(px(x) - 12, 0, px(x) + 12, 0)
    grad.addColorStop(0, '#55585d')
    grad.addColorStop(1, '#2a2c30')
    g.fillStyle = grad
    g.fillRect(px(x) - 12, py(9.4), 24, 9.4 * P)
    g.fillStyle = '#1a1b1e'
    g.fillRect(px(x) - 40, py(8.75), 80, 6)
    g.fillRect(px(x) - 34, py(7.85), 68, 6)
    // yellow-and-black guard sleeve at the foot
    for (let k = 0; k < 6; k++) {
      g.fillStyle = k % 2 ? '#141414' : '#e2b31f'
      g.fillRect(px(x) - 13, py(2) + k * 0.33 * P, 26, 0.33 * P)
    }
  }
  // transformer on the right-hand pole
  g.fillStyle = '#6c7075'
  g.fillRect(px(8.2) + 14, py(7.4), 34, 70)
  // street lamp on the left-hand pole, leaning out over the road
  g.strokeStyle = '#2a2c30'
  g.lineWidth = 6
  g.beginPath()
  g.moveTo(px(-6), py(6.2))
  g.quadraticCurveTo(px(-5.4), py(6.6), px(-4.9), py(6.5))
  g.stroke()
  g.fillStyle = '#d9e4ec'
  g.fillRect(px(-5.1), py(6.5), 34, 8)
  glow(g, px(-4.85), py(6.45), 70, 'rgba(220,235,255,1)', 0.8)
  // a blue address plate
  g.fillStyle = '#1e4fa3'
  g.fillRect(px(-6) - 14, py(3.1), 28, 0.9 * P)
  for (const [i, c] of [...'一丁目'].entries()) text(g, c, px(-6), py(3.0) + 10 + i * 18, `15px ${JP}`, '#ffffff')
}

function radial(rgb: string, size = 128) {
  return texture(size, size, (g) => {
    const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    r.addColorStop(0, `rgba(${rgb},1)`)
    r.addColorStop(0.2, `rgba(${rgb},0.5)`)
    r.addColorStop(1, `rgba(${rgb},0)`)
    g.fillStyle = r
    g.fillRect(0, 0, size, size)
  })
}

const rainVertex = /* glsl */ `
  attribute float tip;
  uniform float time;
  varying float vTip;
  void main() {
    vec3 p = position;
    p.y = mod(p.y - time * 8.5, 7.2) - 0.12 + tip * 0.32;
    p.x += tip * 0.04;
    vTip = tip;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`
const rainFragment = /* glsl */ `
  varying float vTip;
  uniform float opacity;
  void main() {
    gl_FragColor = vec4(vec3(0.72, 0.78, 0.92), opacity * vTip);
  }
`
// Rings spreading where drops hit the road.
const rippleFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float time;
  uniform vec2 size;
  uniform float opacity;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 p = vUv * size / 0.55;
    vec2 cell = floor(p);
    float a = 0.0;
    for (int i = -1; i <= 1; i++)
      for (int j = -1; j <= 1; j++) {
        vec2 c = cell + vec2(float(i), float(j));
        float h = hash(c);
        vec2 centre = c + vec2(hash(c + 3.1), hash(c + 7.7));
        float t = fract(time * (0.7 + h * 0.6) + h * 10.0);
        float d = length(p - centre);
        float ring = smoothstep(0.05, 0.0, abs(d - t * 0.55));
        a += ring * (1.0 - t);
      }
    gl_FragColor = vec4(vec3(0.75, 0.8, 0.9), a * opacity);
  }
`
// Snowflakes and cherry petals: points drifting down, swaying, petals tumbling as they fall.
const flakeVertex = /* glsl */ `
  attribute float seed;
  uniform float time;
  uniform float speed;
  uniform float sway;
  uniform float size;
  uniform float scale;
  varying float vSeed;
  varying float vSpin;
  void main() {
    vec3 p = position;
    p.y = mod(p.y - time * speed * (0.7 + 0.6 * seed), 7.2) - 0.05;
    p.x += sin(time * (0.5 + seed) + seed * 40.0) * sway;
    p.z += cos(time * (0.4 + seed * 0.5) + seed * 20.0) * sway * 0.5;
    vSeed = seed;
    vSpin = time * (1.0 + seed * 2.0) + seed * 30.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = min(48.0, size * (0.6 + 0.8 * seed) * scale / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`
const flakeFragment = /* glsl */ `
  uniform float petal;
  uniform float opacity;
  varying float vSeed;
  varying float vSpin;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (petal < 0.5) {
      float a = smoothstep(0.5, 0.12, length(c));
      gl_FragColor = vec4(0.86, 0.89, 0.97, a * opacity);
      return;
    }
    float cs = cos(vSpin), sn = sin(vSpin);
    c = mat2(cs, -sn, sn, cs) * c;
    c.x /= 0.3 + 0.7 * abs(sin(vSpin * 0.6)); // tumbling: seen edge-on now and then
    float e = length(c * vec2(1.0, 1.8));
    float a = smoothstep(0.44, 0.36, e) * smoothstep(0.02, 0.1, length(c - vec2(0.0, 0.27)));
    vec3 col = mix(vec3(1.0, 0.8, 0.87), vec3(0.97, 0.58, 0.72), vSeed) * (0.8 + 0.4 * (0.5 - c.y));
    gl_FragColor = vec4(col * 0.9, a * opacity);
  }
`
// How each kind of weather falls: count, metres per second, sway, size in metres.
const FALL = {
  snow: { n: 1400, speed: 0.9, sway: 0.22, size: 0.05, petal: 0, opacity: 0.9 },
  sakura: { n: 360, speed: 0.6, sway: 0.55, size: 0.1, petal: 1, opacity: 0.95 },
}

const plainVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

// ---------------------------------------------------------------- scene

function useArt(ready: boolean, lite: boolean) {
  return useMemo(() => {
    if (!ready) return null
    const door = texture(2048, 1024, mural)
    const front = texture(FW, FH, facade)
    const wires = texture(2048, Math.round(POLE_H * (2048 / WIDTH)), poles)
    const head = radial('255,246,220')
    const tail = radial('255,40,30')
    // light pool a car's headlamps throw on the road ahead
    const pool = texture(256, 128, (g) => {
      g.setTransform(1, 0, 0, 0.5, 0, 0)
      const r = g.createRadialGradient(128, 128, 0, 128, 128, 128)
      r.addColorStop(0, 'rgba(255,240,210,0.9)')
      r.addColorStop(1, 'rgba(255,240,210,0)')
      g.fillStyle = r
      g.fillRect(0, 0, 256, 256)
    })
    // a lamp's reflection stretched across the wet road towards the viewer
    const streak = texture(32, 256, (g) => {
      const v = g.createLinearGradient(0, 0, 0, 256)
      v.addColorStop(0, 'rgba(255,255,255,0.9)')
      v.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = v
      g.fillRect(0, 0, 32, 256)
      const h = g.createLinearGradient(0, 0, 32, 0)
      h.addColorStop(0, 'rgba(0,0,0,1)')
      h.addColorStop(0.5, 'rgba(0,0,0,0)')
      h.addColorStop(1, 'rgba(0,0,0,1)')
      g.globalCompositeOperation = 'destination-out'
      g.fillStyle = h
      g.fillRect(0, 0, 32, 256)
    })
    // light from the street on the garage floor just inside the door (top edge = door side)
    const spill = texture(256, 256, (g) => {
      const v = g.createLinearGradient(0, 0, 0, 256)
      v.addColorStop(0, 'rgba(140,150,255,0.9)')
      v.addColorStop(0.35, 'rgba(190,120,220,0.35)')
      v.addColorStop(1, 'rgba(190,120,220,0)')
      g.fillStyle = v
      g.fillRect(0, 0, 256, 256)
      const h = g.createLinearGradient(0, 0, 256, 0)
      h.addColorStop(0, 'rgba(0,0,0,1)')
      h.addColorStop(0.2, 'rgba(0,0,0,0)')
      h.addColorStop(0.8, 'rgba(0,0,0,0)')
      h.addColorStop(1, 'rgba(0,0,0,1)')
      g.globalCompositeOperation = 'destination-out'
      g.fillStyle = h
      g.fillRect(0, 0, 256, 256)
    })

    // Rain: each drop is a short line whose head is brighter than its tail.
    const drops = lite ? 700 : 1500
    const pos = new Float32Array(drops * 6)
    const tip = new Float32Array(drops * 2)
    const rand = rng(21)
    const depth = NEAR + ROAD + FAR - 0.2
    for (let i = 0; i < drops; i++) {
      const x = (rand() - 0.5) * WIDTH
      const y = rand() * 7.2
      const z = -(0.15 + rand() * depth)
      pos.set([x, y, z, x, y, z], i * 6)
      tip.set([0, 1], i * 2)
    }
    const rainGeo = new THREE.BufferGeometry()
    rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    rainGeo.setAttribute('tip', new THREE.BufferAttribute(tip, 1))
    const rain = new THREE.ShaderMaterial({
      vertexShader: rainVertex,
      fragmentShader: rainFragment,
      uniforms: { time: { value: 0 }, opacity: { value: 0.5 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const ripples = new THREE.ShaderMaterial({
      vertexShader: plainVertex,
      fragmentShader: rippleFragment,
      uniforms: { time: { value: 0 }, size: { value: new THREE.Vector2(WIDTH, ROAD) }, opacity: { value: 0.32 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    // Snow and petals share one set of points; each weather draws as many as it needs.
    const most = Math.max(FALL.snow.n, FALL.sakura.n)
    const fpos = new Float32Array(most * 3)
    const seed = new Float32Array(most)
    for (let i = 0; i < most; i++) {
      fpos.set([(rand() - 0.5) * WIDTH, rand() * 7.2, -(0.15 + rand() * depth)], i * 3)
      seed[i] = rand()
    }
    const flakeGeo = new THREE.BufferGeometry()
    flakeGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3))
    flakeGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 1))
    const flakes = new THREE.ShaderMaterial({
      vertexShader: flakeVertex,
      fragmentShader: flakeFragment,
      uniforms: Object.fromEntries(['time', 'speed', 'sway', 'size', 'scale', 'petal', 'opacity'].map((k) => [k, { value: 0 }])),
      transparent: true,
      depthWrite: false,
    })
    return { door, front, wires, head, tail, pool, streak, spill, rainGeo, rain, ripples, flakeGeo, flakes }
  }, [ready, lite])
}

// The ground outside, painted for the weather: repainted when the weather changes.
function useGround(ready: boolean, weather: Weather) {
  const ground = useMemo(() => {
    if (!ready) return null
    return {
      tarmac: texture(RW, RH, (g) => road(g, weather)),
      near: texture(1024, 48, (g) =>
        pavement(g, 1024, 48, '#2a2c31', (x) => 0.45 * Math.exp(-((x / 2.6) ** 2)) + 0.25 * Math.exp(-(((x + 4.9) / 1.2) ** 2)), weather),
      ),
      far: texture(1024, 48, (g) =>
        pavement(g, 1024, 48, '#26242a', (x) => LIGHTS.reduce((s, [lx, , a, w]) => s + a * 0.35 * Math.exp(-(((x - lx) / (w * 0.7 + 0.4)) ** 2)), 0), weather),
      ),
    }
  }, [ready, weather])
  useEffect(
    () => () => {
      if (ground) for (const t of Object.values(ground)) t.dispose()
    },
    [ground],
  )
  return ground
}

const unlit = { toneMapped: false } as const
const glowy = { toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide } as const

// How strongly the road mirrors lamps and how loud tyres hiss on it.
const WET: Record<Weather, number> = { rain: 1, clear: 0.25, snow: 0.4, sakura: 0.25 }

// The cars that drive past: the two models from the side bays, picked at random and in a
// random colour each time. Lamp heights and half-widths are in metres.
const MODELS = [
  { file: 'impreza-sti.glb', length: 4.465, head: 0.66, tail: 0.86, side: 0.6 },
  { file: 'mx5.glb', length: 3.915, head: 0.6, tail: 0.72, side: 0.6 },
]
const PAINTS = [
  '#1c3f94', // WR blue
  '#9b0d17', // deep red
  '#efefea', // pearl white
  '#0c0d0f', // black
  '#b9bec4', // silver
  '#e3ad00', // yellow
  '#d4521c', // orange
  '#123d2a', // racing green
  '#3d2468', // midnight purple
  '#4f565d', // gunmetal
]
type Traffic = { x: number; lane: number; model: number; colour: string; id: number; wait: number; live: boolean }
type Art = NonNullable<ReturnType<typeof useArt>>

const SPEED = 8.5 // m/s, about 30 km/h

function Cars({ a, traffic, door, wall }: { a: Art; traffic: React.RefObject<Traffic>; door: React.RefObject<{ up: number }>; wall: number }) {
  const sti = useGLTF(BASE + MODELS[0].file, false, true)
  const mx5 = useGLTF(BASE + MODELS[1].file, false, true)
  const cars = useMemo(
    () =>
      [sti.scene, mx5.scene].map((scene, i) => {
        const d = dress(scene, MODELS[i].length, undefined, true)
        // Out in the night street the garage's reflections should barely reach them.
        d.car.traverse((o) => {
          const m = (o as THREE.Mesh).material
          for (const x of Array.isArray(m) ? m : m ? [m] : []) (x as THREE.MeshStandardMaterial).envMapIntensity = 0.35
        })
        d.car.visible = false
        return d
      }),
    [sti.scene, mx5.scene],
  )
  const body = useRef<THREE.Group>(null)
  const lights = useRef<THREE.Group>(null)
  const parts = useRef<Record<string, THREE.Object3D | null>>({})
  const last = useRef(-1)
  const voice = useRef<Engine | null>(null)
  useEffect(() => () => voice.current?.stop(), [])

  useFrame((_, dt) => {
    const tr = traffic.current
    const p = parts.current
    if (!body.current || !lights.current || !tr) return
    body.current.visible = lights.current.visible = tr.live
    // Engine and tyres on the wet road, louder as the car nears the door, panned with it,
    // with a touch of Doppler. Muffled to nothing as the shutter comes down.
    voice.current ??= makeEngine()
    if (!tr.live) {
      voice.current?.set(0, 0, 0)
      return
    }
    {
      const lane = LANES[tr.lane]
      const d = Math.hypot(tr.x, lane.z + 6) // the listener stands about 6 m inside the door
      const away = (lane.dir * SPEED * tr.x) / d // m/s, positive when moving away
      const level = (door.current?.up ?? 0) / (1 + (d / 7) ** 2)
      const hiss = WET[useStore.getState().weather]
      voice.current?.set((tr.model ? 2600 : 2300) * (343 / (343 + away)), 0.35, level * 1.6, tr.x / 9, tr.model ? 0 : 1, level * 1.4 * hiss)
      // wheels roll with the road
      for (const w of cars[tr.model].wheels) w.pivot.rotation.x += (SPEED * dt) / w.radius
    }
    const m = MODELS[tr.model]
    const lane = LANES[tr.lane]
    if (last.current !== tr.id) {
      // a new car: show the right model, respray it, and put its lamps where its lamps are
      last.current = tr.id
      cars.forEach((c, i) => (c.car.visible = i === tr.model))
      for (const paint of cars[tr.model].paints) paint.color.set(tr.colour)
      const f = m.length / 2 - 0.1
      p.headNear?.position.set(f, m.head - KERB, m.side + 0.15)
      p.headFar?.position.set(f, m.head - KERB, -m.side)
      p.tailNear?.position.set(-f, m.tail - KERB, m.side + 0.15)
      p.tailFar?.position.set(-f, m.tail - KERB, -m.side)
      p.pool?.position.setX(f + 3.2)
      p.streakHead?.position.setX(f)
      p.streakTail?.position.setX(-f)
      // the models face +z: turn them to face the way they drive
      body.current.rotation.y = (lane.dir * Math.PI) / 2
      lights.current.scale.x = lane.dir
    }
    body.current.position.set(tr.x, -KERB, wall - lane.z)
    lights.current.position.set(tr.x, 0, wall - lane.z)
  })

  const wet = WET[useStore((s) => s.weather)]
  const keep = (k: string) => (o: THREE.Object3D | null) => {
    parts.current[k] = o
  }
  return (
    <>
      <group ref={body}>
        {cars.map((c, i) => (
          <primitive key={i} object={c.car} />
        ))}
      </group>
      <group ref={lights} visible={false}>
        <sprite ref={keep('headNear')} scale={[1.2, 1.2, 1]}>
          <spriteMaterial map={a.head} {...glowy} />
        </sprite>
        <sprite ref={keep('headFar')} scale={[1.2, 1.2, 1]}>
          <spriteMaterial map={a.head} {...glowy} />
        </sprite>
        <sprite ref={keep('tailNear')} scale={[0.6, 0.6, 1]}>
          <spriteMaterial map={a.tail} {...glowy} />
        </sprite>
        <sprite ref={keep('tailFar')} scale={[0.6, 0.6, 1]}>
          <spriteMaterial map={a.tail} {...glowy} />
        </sprite>
        <mesh ref={keep('pool')} rotation-x={-Math.PI / 2} position={[5.4, -KERB + 0.01, 0]}>
          <planeGeometry args={[6.5, 2.6]} />
          <meshBasicMaterial map={a.pool} opacity={0.55} {...glowy} />
        </mesh>
        <mesh ref={keep('streakHead')} rotation-x={-Math.PI / 2} position={[2.15, -KERB + 0.012, 1.4]}>
          <planeGeometry args={[0.6, 2.6]} />
          <meshBasicMaterial map={a.streak} opacity={0.5 * wet} color="#fff1d6" {...glowy} />
        </mesh>
        <mesh ref={keep('streakTail')} rotation-x={-Math.PI / 2} position={[-2.15, -KERB + 0.012, 1.4]}>
          <planeGeometry args={[0.4, 2.2]} />
          <meshBasicMaterial map={a.streak} opacity={0.45 * wet} color="#ff3020" {...glowy} />
        </mesh>
      </group>
    </>
  )
}

export function Street({ room }: { room: Room }) {
  const ready = useFonts()
  const lite = useStore((s) => s.lite)
  const a = useArt(ready, lite)
  const weather = useStore((s) => s.weather)
  const ground = useGround(ready, weather)

  const k = useRef({ t: 0, up: 0, flashed: true }) // t: 0 shut .. 1 fully up; up: t eased
  const door = useRef<THREE.Mesh>(null)
  const bar = useRef<THREE.Group>(null)
  const street = useRef<THREE.Group>(null)
  const spill = useRef<THREE.MeshBasicMaterial>(null)
  const sweep = useRef<THREE.MeshBasicMaterial>(null)
  const sweepMesh = useRef<THREE.Mesh>(null)
  const traffic = useRef<Traffic>({ x: 0, lane: 0, model: 0, colour: PAINTS[0], id: 0, wait: 1.5, live: false })
  // (The passing cars load with the parked ones, the same two models; they only drive by
  // while the door is open, since the street is only updated then.)
  // ?car=x,lane,model,paint holds a passing car in place (used for captures).
  const pinned = useMemo(() => new URLSearchParams(location.search).get('car')?.split(',').map(Number), [])
  const down = useRef<[number, number]>([0, 0])
  const wall = -room.z

  useFrame((state, dt) => {
    if (!a || !door.current || !bar.current || !street.current || !spill.current || !sweep.current || !sweepMesh.current) return
    const s = useStore.getState()
    const st = k.current
    st.t = s.shutter ? Math.min(1, st.t + dt / OPEN_TIME) : Math.max(0, st.t - dt / OPEN_TIME)
    // The headlamps say hello once the door is all the way up.
    if (!s.shutter) st.flashed = false
    else if (st.t === 1 && !st.flashed) {
      st.flashed = true
      s.set({ flash: performance.now() })
    }
    if ((st.t === 1) !== s.doorUp) s.set({ doorUp: st.t === 1 })
    const up = st.t * st.t * (3 - 2 * st.t) // eases in and out like a motor starting and stopping
    const left = Math.max(0.0001, 1 - up)
    door.current.scale.y = left
    door.current.position.y = OPENING.h - (OPENING.h * left) / 2
    door.current.visible = up < 0.999
    a.door.repeat.y = left
    bar.current.position.y = OPENING.h * up
    street.current.visible = st.t > 0
    spill.current.opacity = up * 0.3
    // rain heard through the doorway, as far as it is open
    if (up > 0 || st.up > 0) rain(s.weather === 'rain' ? up : 0)
    st.up = up
    if (!street.current.visible) {
      sweep.current.opacity = 0
      return
    }

    const time = performance.now() / 1000
    a.rain.uniforms.time.value = time
    a.ripples.uniforms.time.value = time
    const fall = s.weather === 'snow' || s.weather === 'sakura' ? FALL[s.weather] : null
    if (fall) {
      const u = a.flakes.uniforms
      u.time.value = time
      for (const key of ['speed', 'sway', 'size', 'petal', 'opacity'] as const) u[key].value = fall[key]
      const cam = state.camera as THREE.PerspectiveCamera
      u.scale.value = (state.size.height * state.gl.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2))
      a.flakeGeo.setDrawRange(0, lite ? fall.n / 2 : fall.n)
    }

    // Every so often a car goes by.
    const tr = traffic.current
    if (pinned) {
      if (!tr.live) Object.assign(tr, { live: true, x: pinned[0], lane: pinned[1] ? 1 : 0, model: pinned[2] ? 1 : 0, colour: PAINTS[pinned[3] || 0], id: tr.id + 1 })
    } else if (!tr.live) {
      // no traffic while the Mazda is out on the street
      if (drive.phase === 'home') tr.wait -= dt
      if (tr.wait <= 0) {
        // a random car, in a random colour, in a random lane
        tr.live = true
        tr.id++
        tr.lane = Math.random() < 0.5 ? 0 : 1
        tr.model = Math.floor(Math.random() * MODELS.length)
        tr.colour = PAINTS[Math.floor(Math.random() * PAINTS.length)]
        tr.x = -LANES[tr.lane].dir * (WIDTH / 2 + 4)
      }
    } else {
      tr.x += LANES[tr.lane].dir * dt * SPEED
      if (Math.abs(tr.x) > WIDTH / 2 + 4) {
        tr.live = false
        tr.wait = 3 + Math.random() * 6
      }
    }
    drive.street = tr.live
    // ... and its headlamps sweep across the garage floor.
    const near = tr.live ? Math.exp(-(((tr.x + LANES[tr.lane].dir * 3) / 4) ** 2)) : 0
    sweep.current.opacity = up * near * 0.4
    sweepMesh.current.position.x = THREE.MathUtils.clamp(tr.x * 0.35, -3, 3)
  })

  if (!a || !ground) return null

  const onDown = (e: ThreeEvent<PointerEvent>) => (down.current = [e.clientX, e.clientY])
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (Math.hypot(e.clientX - down.current[0], e.clientY - down.current[1]) > 6) return
    e.stopPropagation()
    const s = useStore.getState()
    // From the driver's seat, a tap out here means "get out", as anywhere else outside the car.
    if (s.tab === 'about') {
      if (s.open.doorFL && drive.phase === 'home') s.set({ tab: 'home' })
      return
    }
    if (drive.phase !== 'home') return // the door stays up while the car is out
    s.set({ shutter: !s.shutter })
    rattle(OPEN_TIME)
  }
  const pointer = (on: boolean) => () => {
    document.body.style.cursor = on ? 'pointer' : ''
  }

  const roadZ = wall - NEAR - ROAD / 2
  const farZ = wall - NEAR - ROAD - FAR / 2
  const facadeZ = wall - NEAR - ROAD - FAR

  return (
    <>
      {/* the shutter, its bottom rail, the drum housing and the guides */}
      <group position={[0, 0, wall + 0.05]}>
        <mesh ref={door} position={[0, OPENING.h / 2, 0]}>
          <planeGeometry args={[OPENING.w, OPENING.h]} />
          <meshStandardMaterial map={a.door} roughness={0.55} metalness={0.25} />
        </mesh>
        <group ref={bar}>
          <mesh position={[0, 0.035, 0.02]}>
            <boxGeometry args={[OPENING.w, 0.07, 0.06]} />
            <meshStandardMaterial color="#8e9398" roughness={0.35} metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.11, 0.05]}>
            <boxGeometry args={[0.36, 0.035, 0.05]} />
            <meshStandardMaterial color="#2a2c2f" roughness={0.5} metalness={0.6} />
          </mesh>
        </group>
        <mesh position={[0, OPENING.h + 0.085, 0.1]}>
          <boxGeometry args={[OPENING.w + 0.4, 0.17, 0.26]} />
          <meshStandardMaterial color="#2b2d30" roughness={0.6} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * (OPENING.w / 2 + 0.1), (OPENING.h + 0.1) / 2, -0.12]}>
            <boxGeometry args={[0.2, OPENING.h + 0.1, 0.36]} />
            <meshStandardMaterial color="#2b2d30" roughness={0.6} />
          </mesh>
        ))}
        {/* lintel: gives the wall its thickness over the opening */}
        <mesh position={[0, OPENING.h + 0.125, -0.19]}>
          <boxGeometry args={[OPENING.w + 0.4, 0.25, 0.26]} />
          <meshStandardMaterial color="#2b2d30" roughness={0.6} />
        </mesh>
        {/* what you click: the whole opening, open or shut */}
        <mesh position={[0, OPENING.h / 2, 0.06]} onPointerDown={onDown} onClick={onClick} onPointerOver={pointer(true)} onPointerOut={pointer(false)}>
          <planeGeometry args={[OPENING.w, OPENING.h]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>

      {/* street light on the garage floor, and the passing headlamps */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, wall + 1.6]} renderOrder={2}>
        <planeGeometry args={[OPENING.w + 1.6, 3.2]} />
        <meshBasicMaterial ref={spill} map={a.spill} opacity={0} {...glowy} />
      </mesh>
      <mesh ref={sweepMesh} rotation-x={-Math.PI / 2} position={[0, 0.006, wall + 1.8]} renderOrder={2}>
        <planeGeometry args={[3.2, 3.6]} />
        <meshBasicMaterial ref={sweep} map={a.pool} opacity={0} color="#fff2dc" {...glowy} />
      </mesh>

      <group ref={street} visible={false}>
        <mesh position={[0, FACADE_H / 2, facadeZ]}>
          <planeGeometry args={[WIDTH, FACADE_H]} />
          <meshBasicMaterial map={a.front} {...unlit} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0, wall - NEAR / 2]}>
          <planeGeometry args={[WIDTH, NEAR]} />
          <meshBasicMaterial map={ground.near} {...unlit} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, -KERB, roadZ]}>
          <planeGeometry args={[WIDTH, ROAD]} />
          <meshBasicMaterial map={ground.tarmac} {...unlit} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, -KERB + 0.004, roadZ]} material={a.ripples} visible={weather === 'rain'}>
          <planeGeometry args={[WIDTH, ROAD]} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position={[0, 0, farZ]}>
          <planeGeometry args={[WIDTH, FAR]} />
          <meshBasicMaterial map={ground.far} {...unlit} />
        </mesh>
        {/* the far kerb's face, seen from the garage */}
        <mesh position={[0, -KERB / 2, wall - NEAR - ROAD]}>
          <planeGeometry args={[WIDTH, KERB]} />
          <meshBasicMaterial color="#3a3c41" {...unlit} />
        </mesh>
        <mesh position={[0, POLE_H / 2, wall - NEAR + 0.05]}>
          <planeGeometry args={[WIDTH, POLE_H]} />
          <meshBasicMaterial map={a.wires} transparent alphaTest={0.02} depthWrite={false} {...unlit} />
        </mesh>
        <lineSegments geometry={a.rainGeo} material={a.rain} position={[0, 0, wall]} frustumCulled={false} visible={weather === 'rain'} />
        <points geometry={a.flakeGeo} material={a.flakes} position={[0, 0, wall]} frustumCulled={false} visible={weather === 'snow' || weather === 'sakura'} />

        <Suspense fallback={null}>
          <Cars a={a} traffic={traffic} door={k} wall={wall} />
        </Suspense>
      </group>
    </>
  )
}
