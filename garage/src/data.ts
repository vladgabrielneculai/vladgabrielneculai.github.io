// All portfolio content lives here so copy can be updated without touching the scene.
// Facts are carried over from the previous site — update them here.

export const profile = {
  name: 'Vlad Gabriel Neculai',
  role: 'Software Developer Engineer',
  tagline: 'I write clean, reliable software — and spend my weekends around modified cars. This one is mine.',
  location: 'Bucharest, Romania',
  email: 'vladneculaigabriel@gmail.com',
  links: [
    { label: 'GitHub', href: 'https://github.com/vladgabrielneculai' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/vlad-gabriel-n-0108a917b' },
    { label: 'Instagram', href: 'https://www.instagram.com/_vlad_gabriel_/' },
  ],
  about: [
    'I am a developer who likes clean, efficient code that solves real problems — and I am always looking for the next technology to take apart and learn.',
    'I do my best work in a team: sharing ideas, keeping everyone aligned, and shipping on time. Away from the keyboard you will find me at car meets or driving my Mazda3.',
  ],
  specs: [
    ['Base', 'Bucharest, Romania'],
    ['Degree', 'BSc Computer & Information Technology'],
    ['Now', 'MSc Management, Innovation & Technology of Collaborative Systems'],
    ['School', 'Politehnica Bucharest · FILS (French section)'],
    ['Status', 'Open to collaborations'],
  ] as [string, string][],
  languages: [
    ['Romanian', 'Native'],
    ['English', 'Fluent'],
    ['French', 'Advanced'],
    ['German', 'Basic'],
  ] as [string, string][],
}

export type LogEntry = { when: string; title: string; org: string; kind: 'work' | 'edu'; notes: string[] }

export const history: LogEntry[] = [
  {
    when: '2024 — now',
    title: 'MSc, Management, Innovation & Technology of Collaborative Systems',
    org: 'Politehnica Bucharest · FILS',
    kind: 'edu',
    notes: [],
  },
  {
    when: '02/2023 — now',
    title: 'Application Support Analyst',
    org: 'Groupe Société Générale Romania',
    kind: 'work',
    notes: [
      'On-call production support and incident tracking',
      'Maintained runbooks, procedures and technical manuals',
      'Kept systems compliant with local and international regulation',
    ],
  },
  {
    when: '05/2022 — now',
    title: 'Programming Analyst',
    org: 'Școala Gimnazială Grigore Tocilescu',
    kind: 'work',
    notes: ['Ran the school network; diagnosed and fixed software and hardware faults'],
  },
  {
    when: '09/2021 — 06/2022',
    title: 'ICT Teacher',
    org: 'Școala Gimnazială Grigore Tocilescu',
    kind: 'work',
    notes: ['Taught informatics to 11–14 year olds; assessed and tracked progress'],
  },
  {
    when: '2020 — 2024',
    title: 'BSc, Computer & Information Technology',
    org: 'Politehnica Bucharest · FILS',
    kind: 'edu',
    notes: [],
  },
]

export type Build = { name: string; kind: string; year: string; blurb: string; tags: string[]; href?: string }

export const builds: Build[] = [
  {
    name: 'RevvedUp',
    kind: 'Android app · Bachelor thesis',
    year: '2024',
    blurb:
      'An app for the Romanian car-enthusiast scene. It recommends meets and events to owners using a recommendation algorithm I designed myself.',
    tags: ['Android', 'Recommender', 'Car scene'],
    href: 'https://github.com/vladgabrielneculai/RevvedUp',
  },
  {
    name: 'TechnoHub',
    kind: 'Web shop · University project',
    year: '2023',
    blurb: 'A storefront with product selection, quantities, cart and order placement, backed by a PL/SQL database.',
    tags: ['PHP', 'HTML/CSS', 'PL/SQL'],
    href: 'https://github.com/vladgabrielneculai/technohub.github.io',
  },
  {
    name: 'This portfolio',
    kind: 'Personal site',
    year: '2026',
    blurb: 'A real-time 3D model of my own car that you can turn, open and adjust in the browser.',
    tags: ['React', 'Three.js', 'TypeScript'],
  },
]

// level is 0–10 (carried over from the percentages on the previous site)
export const skills: { name: string; level: number; group: string }[] = [
  { name: 'Java', level: 10, group: 'Languages' },
  { name: 'Rust', level: 5, group: 'Languages' },
  { name: 'PHP', level: 5, group: 'Languages' },
  { name: 'MySQL', level: 8, group: 'Databases' },
  { name: 'PL/SQL', level: 8, group: 'Databases' },
  { name: 'HTML', level: 9, group: 'Web' },
  { name: 'CSS', level: 7.5, group: 'Web' },
  { name: 'JavaScript', level: 3, group: 'Web' },
]

export const tabs = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'experience', label: 'Experience' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
  { id: 'contact', label: 'Contact' },
] as const

export type Tab = (typeof tabs)[number]['id']
