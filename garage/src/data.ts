// All portfolio text lives in public/content.json and is fetched when the page opens, so it
// can change without rebuilding the site. Edit it at /?edit (see README) or by hand.

export type Content = {
  profile: {
    name: string
    photo: string // data URL of the profile picture, or empty
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
  projects: { name: string; type: string; year: string; blurb: string; tags: string[]; href: string }[]
  skills: { name: string; level: number; group: string }[]
}

export let content: Content
export let profile: Content['profile']
export let experience: Content['experience']
export let projects: Content['projects']
export let skills: Content['skills']

// What one new entry of each list looks like. The editor uses these for "+ Add", and
// loading uses them to complete entries that are missing fields.
export const templates: Record<string, unknown> = {
  about: '',
  notes: '',
  tags: '',
  links: { label: '', href: '' },
  specs: { label: '', value: '' },
  languages: { name: '', level: '' },
  experience: { when: '', title: '', org: '', kind: 'work', notes: [] },
  projects: { name: '', type: '', year: '', blurb: '', tags: [], href: '' },
  skills: { name: '', level: 5, group: '' },
}

// Makes every list entry match its template, so one malformed entry cannot break a panel.
// A bare string becomes an entry with that string in its first field; empty ones are dropped.
function repair(list: unknown, key: string): never[] {
  const shape = templates[key]
  if (!Array.isArray(list)) return []
  if (typeof shape !== 'object' || shape === null) return list.filter((x) => typeof x === 'string') as never[]
  const first = Object.keys(shape)[0]
  return list
    .filter((x) => x !== '' && x != null)
    .map((x) => {
      const entry = { ...structuredClone(shape), ...(typeof x === 'object' ? x : { [first]: String(x) }) } as Record<string, unknown>
      for (const [k, v] of Object.entries(shape)) if (Array.isArray(v)) entry[k] = repair(entry[k], k)
      return entry
    }) as never[]
}

// Must finish before any component that reads the exports above is imported.
export async function loadContent() {
  const res = await fetch(`${import.meta.env.BASE_URL}content.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`content.json: ${res.status}`)
  const raw = await res.json()
  content = {
    profile: { ...raw.profile, photo: typeof raw.profile?.photo === 'string' ? raw.profile.photo : '', about: repair(raw.profile?.about, 'about'), links: repair(raw.profile?.links, 'links'), specs: repair(raw.profile?.specs, 'specs'), languages: repair(raw.profile?.languages, 'languages') },
    experience: repair(raw.experience, 'experience'),
    // "kind" was the old name of a project's type; it now belongs to experience only.
    projects: repair(raw.projects, 'projects').map(({ kind, ...p }: Record<string, string>) => ({ ...p, type: p.type || kind || '' })) as never[],
    skills: repair(raw.skills, 'skills'),
  }
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
