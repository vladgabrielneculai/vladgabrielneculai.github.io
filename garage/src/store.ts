import { create } from 'zustand'
import type { Tab } from './data'

export type Part = 'hood' | 'trunk' | 'doorFL' | 'doorFR' | 'doorBL' | 'doorBR'
export type Zone = Part | 'wheel'

// Each clickable area of the car, what to call it, and the tab it leads to.
export const zones: Record<Zone, { name: string; tab: Tab }> = {
  hood: { name: 'bonnet', tab: 'skills' },
  wheel: { name: 'wheels', tab: 'projects' },
  doorFL: { name: 'door', tab: 'about' },
  doorFR: { name: 'door', tab: 'about' },
  doorBL: { name: 'door', tab: 'about' },
  doorBR: { name: 'door', tab: 'about' },
  trunk: { name: 'boot', tab: 'experience' },
}

type State = {
  ready: boolean
  tab: Tab
  drop: number // 0..1 ride-height drop
  camber: number // 0..1 negative camber
  lights: boolean
  open: Record<Part, boolean>
  adjust: boolean // adjust popover open
  hint: string | null
  set: (p: Partial<State>) => void
  toggle: (part: Part) => void
}

export const useStore = create<State>((set) => ({
  ready: false,
  tab: 'home',
  drop: 0.4,
  camber: 0.3,
  lights: true,
  open: { hood: false, trunk: false, doorFL: false, doorFR: false, doorBL: false, doorBR: false },
  adjust: false,
  hint: null,
  set: (p) => set(p),
  // Clicking a panel opens it and jumps to its tab; clicking again closes it.
  toggle: (part) => set((s) => (s.open[part] ? { open: { ...s.open, [part]: false } } : { open: { ...s.open, [part]: true }, tab: zones[part].tab })),
}))
