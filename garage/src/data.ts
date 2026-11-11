// All portfolio text lives in content.json. Edit it by hand, or run `npm run dev`
// and open http://localhost:5173/?edit for a form that saves straight to that file.
import content from './content.json'

export type Content = typeof content
export const { profile, experience, projects, skills } = content

export const tabs = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About me' },
  { id: 'experience', label: 'Experience' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
  { id: 'contact', label: 'Contact' },
] as const

export type Tab = (typeof tabs)[number]['id']
