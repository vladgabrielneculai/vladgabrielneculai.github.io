// Content editor, opened at /?edit. Two ways to save:
//  - under `npm run dev`, straight to public/content.json through the dev server;
//  - on the live site, as a commit to the GitHub repository. That needs a personal access
//    token with write access to the repository, which is what makes someone an admin: the
//    page itself is public, but nothing can be saved without one.
import { useState } from 'react'
import { content, templates, type Content } from '../data'

const REPO = 'vladgabrielneculai/vladgabrielneculai.github.io'
const BRANCH = 'main'
// The live copy first, then the source copy, so a rebuild cannot bring old text back.
const FILES = ['content.json', 'garage/public/content.json']
const TOKEN_KEY = 'portfolio-admin-token'
const API = `https://api.github.com/repos/${REPO}`

const gh = (token: string, path: string, init?: RequestInit) =>
  fetch(API + path, { ...init, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' } })

function toBase64(text: string) {
  let bin = ''
  for (const byte of new TextEncoder().encode(text)) bin += String.fromCharCode(byte)
  return btoa(bin)
}

// Resolves to null when the token can write to the repository, otherwise to the reason.
async function checkToken(token: string) {
  const res = await gh(token, '')
  if (res.status === 401) return 'GitHub rejected this token.'
  if (!res.ok) return `GitHub answered ${res.status}. The token may not cover this repository.`
  const repo = await res.json()
  return repo.permissions?.push ? null : 'This token can read the repository but not write to it.'
}

async function commit(token: string, data: Content) {
  const body = JSON.stringify(data, null, 2) + '\n'
  for (const file of FILES) {
    const current = await gh(token, `/contents/${file}?ref=${BRANCH}`)
    if (!current.ok) throw new Error(`could not read ${file} (${current.status})`)
    const { sha } = await current.json()
    const put = await gh(token, `/contents/${file}`, {
      method: 'PUT',
      body: JSON.stringify({ message: 'Update portfolio content', content: toBase64(body), sha, branch: BRANCH }),
    })
    if (!put.ok) throw new Error(`could not save ${file} (${put.status})`)
  }
}

type Json = string | number | Json[] | { [k: string]: Json }

const LONG = new Set(['tagline', 'blurb', 'about', 'notes'])
const title = (k: string) => k[0].toUpperCase() + k.slice(1)

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
        <button className="btn btn-quiet !py-1.5 !text-xs" onClick={() => onChange([...value, structuredClone(templates[name] ?? '') as Json])}>
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

function SignIn({ onToken }: { onToken: (t: string) => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const problem = await checkToken(value.trim())
      if (problem) setError(problem)
      else onToken(value.trim())
    } catch {
      setError('Could not reach GitHub.')
    }
    setBusy(false)
  }
  return (
    <div className="grid h-full place-items-center overflow-y-auto bg-paper p-5">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
        <h1 className="text-xl font-extrabold tracking-tight">Admin sign-in</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/65">
          Editing this site needs a GitHub personal access token that can write to <span className="font-semibold text-ink">{REPO}</span>. It is kept only in this browser and sent
          only to GitHub.
        </p>
        <label className="ed-field mt-4">
          <span>Access token</span>
          <input type="password" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} placeholder="github_pat_…" required />
        </label>
        {error && (
          <p className="mt-2 text-sm text-accent" role="alert">
            {error}
          </p>
        )}
        <div className="mt-5 flex items-center gap-3">
          <button className="btn" disabled={busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <a className="text-sm font-semibold text-ink/60 hover:text-ink" href="./">
            Back to site
          </a>
        </div>
        <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink/50">
          Create one on GitHub: Settings → Developer settings → Personal access tokens → Fine-grained tokens. Repository access: only this repository. Permissions: Contents → Read and
          write.
        </p>
      </form>
    </div>
  )
}

export default function Editor() {
  const local = import.meta.env.DEV
  const [token, setToken] = useState(() => (local ? '' : (localStorage.getItem(TOKEN_KEY) ?? '')))
  const [data, setData] = useState<Content>(content)
  const [status, setStatus] = useState('')
  const sections = Object.keys(data) as (keyof Content)[]
  const [section, setSection] = useState<keyof Content>(sections[0])

  const save = async () => {
    setStatus('Saving…')
    try {
      if (local) {
        const res = await fetch('/__content', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
        setStatus(res.ok ? 'Saved to public/content.json' : `Not saved: ${await res.text()}`)
      } else {
        await commit(token, data)
        setStatus('Saved. The live site updates in about a minute.')
      }
    } catch (e) {
      setStatus(`Not saved: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
  }

  if (!local && !token)
    return (
      <SignIn
        onToken={(t) => {
          localStorage.setItem(TOKEN_KEY, t)
          setToken(t)
        }}
      />
    )

  return (
    <div className="h-full overflow-y-auto bg-paper">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-white/90 px-5 py-3 backdrop-blur">
        <h1 className="mr-auto text-lg font-extrabold tracking-tight">Edit content</h1>
        <span className="text-sm text-ink/60" role="status">
          {status}
        </span>
        {!local && (
          <button className="text-sm font-semibold text-ink/60 hover:text-ink" onClick={signOut}>
            Sign out
          </button>
        )}
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
        <p className="mt-6 text-xs text-ink/50">Skill level is 0–10. Leave a project's Href empty to hide its link. {local ? 'Saved changes go live after you run npm run publish-site, commit and push.' : 'Saving commits the change to GitHub; the live site follows in about a minute.'}</p>
      </div>
    </div>
  )
}
