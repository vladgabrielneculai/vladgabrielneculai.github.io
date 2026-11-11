// Local content editor. Only exists under `npm run dev` (open /?edit); it is not part of
// the published site. Saving writes src/content.json through the dev server.
import { useState } from 'react'
import content from '../content.json'
import type { Content } from '../data'

type Json = string | number | Json[] | { [k: string]: Json }

const LONG = new Set(['tagline', 'blurb', 'about', 'notes'])
const title = (k: string) => k[0].toUpperCase() + k.slice(1)

// An empty copy of a value, used when adding a list item.
function blank(v: Json, key = ''): Json {
  if (key === 'kind') return 'work'
  if (typeof v === 'string') return ''
  if (typeof v === 'number') return 0
  if (Array.isArray(v)) return []
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blank(x, k)]))
}

function Field({ name, value, onChange, parent = '' }: { name: string; value: Json; onChange: (v: Json) => void; parent?: string }) {
  if (Array.isArray(value)) {
    const move = (i: number, d: number) => {
      const next = [...value]
      ;[next[i], next[i + d]] = [next[i + d], next[i]]
      onChange(next)
    }
    return (
      <fieldset className="ed-list">
        <legend>{title(name)}</legend>
        {value.map((item, i) => (
          <div key={i} className="ed-item">
            <div className="flex-1">
              <Field name={`${i + 1}`} parent={name} value={item} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} />
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <button className="ed-mini" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                ↑
              </button>
              <button className="ed-mini" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                ↓
              </button>
              <button className="ed-mini text-accent" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove">
                ×
              </button>
            </div>
          </div>
        ))}
        <button className="btn btn-quiet !py-1.5 !text-xs" onClick={() => onChange([...value, value.length ? blank(value[0]) : ''])}>
          + Add
        </button>
      </fieldset>
    )
  }
  if (typeof value === 'object') {
    return (
      <div className="grid gap-2">
        {Object.entries(value).map(([k, v]) => (
          <Field key={k} name={k} value={v} onChange={(x) => onChange({ ...value, [k]: x })} />
        ))}
      </div>
    )
  }
  const label = /^\d+$/.test(name) ? `${title(parent)} ${name}` : title(name)
  return (
    <label className="ed-field">
      <span>{label}</span>
      {name === 'kind' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="work">Work</option>
          <option value="edu">Education</option>
        </select>
      ) : typeof value === 'number' ? (
        <input type="number" min={0} max={10} step={0.5} value={value} onChange={(e) => onChange(+e.target.value)} />
      ) : LONG.has(name) || LONG.has(parent) ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}

export default function Editor() {
  const [data, setData] = useState<Content>(content)
  const [status, setStatus] = useState('')
  const sections = Object.keys(data) as (keyof Content)[]
  const [section, setSection] = useState<keyof Content>(sections[0])

  const save = async () => {
    setStatus('Saving…')
    try {
      const res = await fetch('/__content', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
      setStatus(res.ok ? 'Saved to src/content.json' : `Not saved: ${await res.text()}`)
    } catch (e) {
      setStatus(`Not saved: ${String(e)}`)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-paper">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-white/90 px-5 py-3 backdrop-blur">
        <h1 className="mr-auto text-lg font-extrabold tracking-tight">Edit content</h1>
        <span className="text-sm text-ink/60" role="status">
          {status}
        </span>
        <a className="btn btn-quiet" href="./">
          View site
        </a>
        <button className="btn" onClick={save}>
          Save
        </button>
      </header>
      <div className="mx-auto max-w-3xl p-5">
        <nav className="tabs !static mb-5 !translate-0 w-fit" aria-label="Sections">
          {sections.map((s) => (
            <button key={s} className={s === section ? 'tab tab-on' : 'tab'} onClick={() => setSection(s)}>
              {title(s)}
            </button>
          ))}
        </nav>
        <Field name={section} value={data[section] as Json} onChange={(v) => setData({ ...data, [section]: v } as Content)} />
        <p className="mt-6 text-xs text-ink/50">Skill level is 0–10. Leave a project's Href empty to hide its link. Changes go live on the site only after you commit and push.</p>
      </div>
    </div>
  )
}
