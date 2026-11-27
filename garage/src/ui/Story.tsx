// The phone layout. The garage sits in the top part of the screen; every section scrolls by
// underneath it, and the camera follows along to the part of the car each section belongs to.
// The 3D garage only loads when the visitor asks for it, so the page is readable at once on a
// slow connection: until then a still of the garage stands in. The controls sit at the bottom,
// within reach of a thumb.
import { useProgress } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { profile, tabs, type Tab } from '../data'
import { leave } from '../drive'
import { buzz, unlock } from '../sound'
import { useStore } from '../store'
import { AdjustControls } from './Chrome'
import { BODY } from './Panel'

const SECTIONS = tabs.filter((t) => t.id !== 'home')

// The still shown in place of the garage before it loads, and over it while it loads.
function Poster({ webgl }: { webgl: boolean }) {
  const live = useStore((s) => s.live)
  const ready = useStore((s) => s.ready)
  const { progress } = useProgress()
  const gone = live && ready
  return (
    <div className={`poster ${gone ? 'poster-gone' : ''}`} aria-hidden={gone}>
      <img src={`${import.meta.env.BASE_URL}poster.webp`} alt="" className="poster-img" />
      {live && webgl && (
        <div className="absolute inset-x-8 bottom-6 text-xs text-white/70">
          <div className="mb-1.5 flex justify-between">
            <span>Opening the garage</span>
            <span className="font-semibold text-white">{Math.round(progress)}%</span>
          </div>
          <div className="h-0.5 rounded bg-white/20">
            <div className="h-full rounded bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

// Bottom bar: step into the garage, then adjust the car or drive it out.
function Dock({ webgl }: { webgl: boolean }) {
  const s = useStore()
  const start = () => {
    unlock()
    buzz(30)
    s.set({ live: true })
  }
  return (
    <>
      <div className={`drawer ${s.adjust ? 'drawer-open' : ''}`} aria-hidden={!s.adjust} inert={!s.adjust}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-lg font-extrabold tracking-tight">Adjust the car</p>
          <button className="grid h-9 w-9 place-items-center rounded-full text-xl text-ink/50" onClick={() => s.set({ adjust: false })} aria-label="Close">
            ×
          </button>
        </div>
        <AdjustControls />
      </div>
      <div className="dock">
        {!webgl ? null : !s.live ? (
          <button className="btn w-full !py-3.5 text-[15px]" onClick={start}>
            Step into the garage
          </button>
        ) : (
          <>
            <button className="btn btn-quiet shrink-0 !px-4 !py-3.5" onClick={() => s.set({ adjust: !s.adjust })} aria-expanded={s.adjust}>
              {s.adjust ? 'Done' : 'Adjust'}
            </button>
            <button
              className="btn flex-1 !py-2.5 leading-tight disabled:opacity-50"
              disabled={!s.ready || s.out}
              onClick={() => {
                unlock()
                buzz([40, 60, 40])
                leave()
              }}
            >
              <span className="block">
                <span className="block text-[15px] font-extrabold">Drive into the city →</span>
                <span className="block text-[11px] font-semibold text-white/75">and get in touch with me</span>
              </span>
            </button>
          </>
        )}
      </div>
    </>
  )
}

export function Story({ webgl }: { webgl: boolean }) {
  const tab = useStore((s) => s.tab)
  const set = useStore((s) => s.set)
  const scroller = useRef<HTMLElement>(null)
  const nav = useRef<HTMLElement>(null)
  const fromScroll = useRef<Tab>('home')
  const jumping = useRef(0)
  const [hint, setHint] = useState(true)

  // Scrolling picks the tab: the last section whose top has passed a third of the way up.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let frame = 0
    const read = () => {
      frame = 0
      if (el.scrollTop > 40) setHint(false)
      if (performance.now() < jumping.current) return
      const line = el.scrollTop + el.clientHeight / 3
      let at: Tab = 'home'
      for (const sec of el.querySelectorAll<HTMLElement>('[data-tab]')) if (sec.offsetTop <= line) at = sec.dataset.tab as Tab
      if (at !== useStore.getState().tab) {
        fromScroll.current = at
        set({ tab: at })
      }
    }
    const onScroll = () => (frame ||= requestAnimationFrame(read))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [set])

  // A tab chosen any other way (a tap on the car, the section chips) scrolls to its section.
  useEffect(() => {
    if (tab === fromScroll.current) return
    fromScroll.current = tab
    const el = scroller.current
    const sec = el?.querySelector<HTMLElement>(`[data-tab="${tab}"]`)
    if (!el || !sec) return
    jumping.current = performance.now() + 900 // let the smooth scroll land before reading it
    el.scrollTo({ top: tab === 'home' ? 0 : sec.offsetTop - (nav.current?.offsetHeight ?? 0) + 1, behavior: 'smooth' })
  }, [tab])

  return (
    <>
      <Poster webgl={webgl} />
      <main ref={scroller} className="story" aria-label="Vlad Gabriel Neculai">
        <section data-tab="home" className="px-5 pb-6 pt-6">
          <p className="label !text-accent">{profile.role}</p>
          <h1 className="mt-1.5 text-[2.5rem] font-extrabold leading-[0.95] tracking-[-0.04em]">
            Vlad Gabriel
            <br />
            Neculai
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink/70">{profile.tagline}</p>
          <p className={`label mt-5 transition-opacity duration-500 ${hint ? '' : 'opacity-0'}`}>Scroll to look around the car ↓</p>
        </section>
        <nav ref={nav} className="story-nav" aria-label="Sections">
          {SECTIONS.map((t) => (
            <button key={t.id} onClick={() => set({ tab: t.id })} aria-current={t.id === tab} className={`story-chip ${t.id === tab ? 'story-chip-on' : ''}`}>
              {t.label}
            </button>
          ))}
        </nav>
        {SECTIONS.map((t) => {
          const Body = BODY[t.id]
          return (
            <section key={t.id} data-tab={t.id} className="story-sec" aria-labelledby={`sec-${t.id}`}>
              <h2 id={`sec-${t.id}`} className="mb-4 text-2xl font-extrabold tracking-tight">
                {t.label}
              </h2>
              <Body />
            </section>
          )
        })}
      </main>
      <Dock webgl={webgl} />
    </>
  )
}
