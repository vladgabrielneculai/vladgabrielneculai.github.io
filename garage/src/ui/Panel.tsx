import { experience, profile, projects, skills, tabs, type Tab } from '../data'
import { useStore } from '../store'

function About() {
  return (
    <>
      {profile.about.map((p) => (
        <p key={p} className="mb-3 leading-relaxed text-ink/75">
          {p}
        </p>
      ))}
      <dl className="mt-5 border-t border-line text-sm">
        {profile.specs.map((s) => (
          <div key={s.label} className="flex gap-4 border-b border-line py-2.5">
            <dt className="label w-16 shrink-0 pt-0.5">{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 flex flex-wrap gap-2 text-xs">
        {profile.languages.map((l) => (
          <li key={l.name} className="rounded-full border border-line px-3 py-1.5 text-ink/60">
            <span className="font-semibold text-ink">{l.name}</span> · {l.level}
          </li>
        ))}
      </ul>
    </>
  )
}

function Experience() {
  return (
    <ol className="relative border-l border-line pl-5">
      {experience.map((h) => (
        <li key={h.when + h.title} className="relative mb-5 last:mb-0">
          <span className={`absolute -left-[1.56rem] top-1.5 h-2 w-2 rounded-full ${h.kind === 'work' ? 'bg-accent' : 'border-2 border-accent bg-white'}`} />
          <p className="label">
            {h.when} · {h.kind === 'work' ? 'Work' : 'Education'}
          </p>
          <h3 className="mt-1 text-[15px] font-bold leading-snug">{h.title}</h3>
          <p className="text-sm text-ink/60">{h.org}</p>
          {h.notes.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[13px] text-ink/70 marker:text-accent">
              {h.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}

function Projects() {
  return (
    <ul className="space-y-3">
      {projects.map((b) => (
        <li key={b.name} className="rounded-xl border border-line p-4">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-base font-extrabold tracking-tight">{b.name}</h3>
            <span className="label">{b.year}</span>
          </div>
          {b.type && <p className="label mt-0.5 !text-accent">{b.type}</p>}
          {b.blurb && <p className="mt-2 text-sm leading-relaxed text-ink/70">{b.blurb}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-ink/60">
            {b.tags.map((t) => (
              <span key={t} className="rounded-full bg-ink/6 px-2.5 py-1">
                {t}
              </span>
            ))}
            {b.href && (
              <a href={b.href} target="_blank" rel="noreferrer" className="ml-auto font-semibold text-accent hover:underline">
                View code ↗
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

function Skills() {
  const groups = [...new Set(skills.map((s) => s.group))]
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g}>
          <p className="label mb-2">{g}</p>
          <ul className="space-y-2.5">
            {skills
              .filter((s) => s.group === g)
              .map((s) => (
                <li key={s.name} className="flex items-center gap-4 text-sm">
                  <span className="w-24 shrink-0 font-semibold">{s.name}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/8" role="img" aria-label={`${s.level} out of 10`}>
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${s.level * 10}%` }} />
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}
      <p className="text-xs text-ink/45">Self-assessed.</p>
    </div>
  )
}

function Contact() {
  return (
    <>
      <p className="mb-5 leading-relaxed text-ink/75">Have a project, a role, or a car meet worth driving to? Write to me — I reply quickly.</p>
      <a href={`mailto:${profile.email}`} className="btn w-full break-all">
        {profile.email}
      </a>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {profile.links.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="btn btn-quiet">
            {l.label}
          </a>
        ))}
      </div>
      <p className="mt-6 text-xs text-ink/45">Based in {profile.location}.</p>
    </>
  )
}

const BODY: Record<Exclude<Tab, 'home'>, () => React.JSX.Element> = { about: About, experience: Experience, projects: Projects, skills: Skills, contact: Contact }

export function Panel() {
  const tab = useStore((s) => s.tab)
  const set = useStore((s) => s.set)
  const open = tab !== 'home'
  const Body = open ? BODY[tab] : null
  return (
    <section className={`panel ${open ? 'panel-open' : ''}`} aria-hidden={!open} inert={!open} aria-labelledby="panel-h">
      {Body && (
        <div key={tab} className="panel-body">
          <div className="mb-5 flex items-center justify-between">
            <h2 id="panel-h" className="text-2xl font-extrabold tracking-tight">
              {tabs.find((t) => t.id === tab)!.label}
            </h2>
            <button className="grid h-9 w-9 place-items-center rounded-full text-xl text-ink/50 hover:bg-ink/6 hover:text-ink" onClick={() => set({ tab: 'home' })} aria-label="Close">
              ×
            </button>
          </div>
          <Body />
        </div>
      )}
    </section>
  )
}
