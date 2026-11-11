import { create } from 'zustand'
import type { Tab } from './data'

export type Part = 'hood' | 'trunk' | 'doorFL' | 'doorFR' | 'doorBL' | 'doorBR'

export const partLabel: Record<Part, string> = {
  hood: 'bonnet',
  trunk: 'boot',
  doorFL: 'front door',
  doorFR: 'front door',
  doorBL: 'rear door',
  doorBR: 'rear door',
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
  toggle: (part) => set((s) => ({ open: { ...s.open, [part]: !s.open[part] } })),
}))
