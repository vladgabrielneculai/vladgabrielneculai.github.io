// What the visitor sees around "Drive into the city": letterbox bars while the car drives
// out, then a fade to black with a contact form in the middle. Closing the form fades back
// in and the car comes home.
import { useEffect, useRef, useState } from 'react'
import { profile } from '../data'
import { useStore } from '../store'

function ContactForm({ close }: { close: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const t = setTimeout(() => first.current?.focus(), 950)
    return () => clearTimeout(t)
  }, [])

  // The site has no server, so the message goes out through the visitor's own email app,
  // already addressed and written.
  const send = (e: React.FormEvent) => {
    e.preventDefault()
    const subject = `Hello from your portfolio — ${name}`
    const body = `${message}\n\n— ${name}${email ? ` (${email})` : ''}`
    location.href = `mailto:${profile.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setSent(true)
  }

  const field = 'mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20'
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="away-title" className="away-card">
      <button className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-xl text-ink/50 transition hover:bg-ink/5 hover:text-ink" onClick={close} aria-label="Close and drive back to the garage">
        ×
      </button>
      <p className="label">Contact</p>
      <h2 id="away-title" className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
        Let’s talk
      </h2>
      {sent ? (
        <div className="mt-4">
          <p className="leading-relaxed text-ink/75">Your email app should have opened with the message ready to send. If it didn’t, write to me directly:</p>
          <a href={`mailto:${profile.email}`} className="btn mt-4 w-full break-all">
            {profile.email}
          </a>
          <button className="btn btn-quiet mt-2 w-full" onClick={close}>
            Back to the garage
          </button>
        </div>
      ) : (
        <form className="mt-4" onSubmit={send}>
          <label className="block text-sm font-semibold text-ink/80">
            Name
            <input ref={first} className={field} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
          <label className="mt-3 block text-sm font-semibold text-ink/80">
            Email
            <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="mt-3 block text-sm font-semibold text-ink/80">
            Message
            <textarea className={`${field} h-28 resize-none`} value={message} onChange={(e) => setMessage(e.target.value)} required />
          </label>
          <button type="submit" className="btn mt-4 w-full">
            Send message
          </button>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {profile.links.slice(0, 3).map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="btn btn-quiet !px-2">
                {l.label}
              </a>
            ))}
          </div>
          <button type="button" className="mt-4 w-full text-center text-sm font-semibold text-ink/55 transition hover:text-ink" onClick={close}>
            ← Back to the garage
          </button>
        </form>
      )}
    </div>
  )
}

export function Away() {
  const cinema = useStore((s) => s.cinema)
  const form = useStore((s) => s.contactForm)
  const set = useStore((s) => s.set)

  // Hide every other control while the drive plays.
  useEffect(() => {
    document.documentElement.classList.toggle('cinema', cinema)
  }, [cinema])

  // Once the screen is fully black, the 3D scene can stop drawing.
  useEffect(() => {
    if (!form) return
    const t = setTimeout(() => set({ dark: true }), 1000)
    return () => clearTimeout(t)
  }, [form, set])

  useEffect(() => {
    if (!form) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && set({ contactForm: false, dark: false })
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [form, set])

  return (
    <>
      <div aria-hidden className={`letterbox letterbox-top ${cinema && !form ? 'letterbox-on' : ''}`} />
      <div aria-hidden className={`letterbox letterbox-bottom ${cinema && !form ? 'letterbox-on' : ''}`} />
      <div className={`away ${form ? 'away-on' : ''}`} inert={!form}>
        {form && <ContactForm close={() => set({ contactForm: false, dark: false })} />}
      </div>
    </>
  )
}
