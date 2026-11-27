import { create } from 'zustand'
import type { Tab } from './data'

export type Part = 'hood' | 'trunk' | 'doorFL' | 'doorFR' | 'doorBL' | 'doorBR'
export type Zone = Part | 'wheel'
export type Weather = 'rain' | 'clear' | 'snow' | 'sakura'
export const WEATHERS: [Weather, string][] = [
  ['rain', 'Rain'],
  ['clear', 'Clear'],
  ['snow', 'Snow'],
  ['sakura', 'Sakura'],
]
export const OPEN_TIME = 2.3 // seconds for the garage door to roll fully up or down

// Each clickable area of the car, what to call it, and the tab it leads to.
export const zones: Record<Zone, { name: string; tab: Tab | null }> = {
  hood: { name: 'bonnet', tab: 'skills' },
  wheel: { name: 'wheels', tab: 'projects' },
  doorFL: { name: 'door', tab: 'about' },
  // only the driver's door leads somewhere; the others just open
  doorFR: { name: 'door', tab: null },
  doorBL: { name: 'door', tab: null },
  doorBR: { name: 'door', tab: null },
  trunk: { name: 'boot', tab: 'experience' },
}

type State = {
  ready: boolean
  intro: boolean // opening sequence still playing
  tab: Tab
  drop: number // 0..1 ride-height drop
  camber: number // 0..1 negative camber
  lights: boolean
  open: Record<Part, boolean>
  adjust: boolean // adjust popover open
  lite: boolean // lighter rendering: no mirrored floor. Phones start in it; slow machines fall back to it.
  sheet: 'peek' | 'half' | 'tall' // phones: how far up the content sheet is
  shutter: boolean // garage door rolled up onto the street
  flash: number // performance.now() of the last headlamp flash, 0 for none
  engine: boolean // the Mazda's engine is running
  rev: boolean // throttle held down
  sound: boolean // all sound on or muted
  doorUp: boolean // the shutter is all the way up
  out: boolean // the Mazda has gone out for a drive (see drive.ts)
  cinema: boolean // the drive is playing: every other control is hidden
  contactForm: boolean // the black screen with the contact form
  dark: boolean // the screen is fully black: the 3D scene can stop drawing
  weather: Weather // what is falling on the street outside
  story: boolean // phone layout: the garage on top, every section in one scroll below
  live: boolean // the 3D garage has been started (phones wait for a tap, to save data)
  tilt: boolean // phones: tilting the phone turns the garage a little
  set: (p: Partial<State>) => void
  toggle: (part: Part) => void
}

// Opening sequence: dark garage, headlamps, ceiling strips striking one by one, camera gliding in.
// Skipped for visitors who ask for reduced motion.
export const INTRO_END = 4.6
const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
export const intro = { t: still ? INTRO_END : 0, lit: still }
export function skipIntro() {
  if (intro.t >= INTRO_END) return
  intro.t = INTRO_END
  intro.lit = true
  useStore.getState().set({ intro: false, lights: true })
}

export const PHONE = '(max-width: 767.98px)'
const phone = typeof matchMedia !== 'undefined' && matchMedia(PHONE).matches

export const useStore = create<State>((set) => ({
  ready: false,
  intro: !still,
  tab: 'home',
  drop: 0.4,
  camber: 0.3,
  lights: still,
  open: { hood: false, trunk: false, doorFL: false, doorFR: false, doorBL: false, doorBR: false },
  adjust: false,
  lite: typeof location !== 'undefined' && (new URLSearchParams(location.search).has('lite') || innerWidth < 768 || matchMedia('(pointer: coarse)').matches),
  sheet: 'half',
  shutter: false,
  flash: 0,
  engine: false,
  rev: false,
  sound: true,
  doorUp: false,
  out: false,
  cinema: false,
  contactForm: false,
  dark: false,
  // ?weather=snow picks the weather (used for captures)
  weather: ((w) => (WEATHERS.some(([k]) => k === w) ? (w as Weather) : 'rain'))(typeof location !== 'undefined' ? new URLSearchParams(location.search).get('weather') : null),
  story: phone,
  live: !phone || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('live')),
  // Android needs no permission for the tilt sensor; iPhones ask, so there it starts off
  tilt: phone && typeof DeviceOrientationEvent !== 'undefined' && !('requestPermission' in DeviceOrientationEvent),
  set: (p) => set(p),
  // Clicking a panel opens it and jumps to its tab; clicking again closes it.
  toggle: (part) => set((s) => (s.open[part] ? { open: { ...s.open, [part]: false } } : { open: { ...s.open, [part]: true }, tab: zones[part].tab ?? s.tab })),
}))
