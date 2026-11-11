// All portfolio text lives in public/content.json and is fetched when the page opens, so it
// can change without rebuilding the site. Edit it at /?edit (see README) or by hand.

export type Content = {
  profile: {
    name: string
    role: string
    tagline: string
    location: string
    email: string
    about: string[]
    links: { label: string; href: string }[]
    specs: { label: string; value: string }[]
    languages: { name: string; level: string }[]
  }
  experience: { when: string; title: string; org: string; kind: string; notes: string[] }[]
  projects: { name: string; kind: string; year: string; blurb: string; tags: string[]; href: string }[]
  skills: { name: string; level: number; group: string }[]
}

export let content: Content
export let profile: Content['profile']
export let experience: Content['experience']
export let projects: Content['projects']
export let skills: Content['skills']

// Must finish before any component that reads the exports above is imported.
export async function loadContent() {
  const res = await fetch(`${import.meta.env.BASE_URL}content.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`content.json: ${res.status}`)
  content = await res.json()
  ;({ profile, experience, projects, skills } = content)
}

export const tabs = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About me' },
  { id: 'experience', label: 'Experience' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
  { id: 'contact', label: 'Contact' },
] as const

export type Tab = (typeof tabs)[number]['id']
