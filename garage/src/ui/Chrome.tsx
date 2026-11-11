import { useProgress } from '@react-three/drei'
import { profile, tabs } from '../data'
import { useStore } from '../store'

export function Loader() {
  const ready = useStore((s) => s.ready)
  const { progress } = useProgress()
  return (
    <div className={`fixed inset-0 z-50 grid place-items-center bg-paper transition-opacity duration-700 ${ready ? 'pointer-events-none opacity-0' : ''}`} aria-hidden={ready}>
      <div className="w-56 text-xs text-ink/55">
        <div className="mb-2 flex justify-between">
          <span>Loading the car</span>
          <span className="font-semibold text-accent">{Math.round(progress)}%</span>
        </div>
        <div className="h-0.5 rounded bg-ink/10">
          <div className="h-full rounded bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  )
}

function Adjust() {
  const s = useStore()
  return (
    <div className="fixed bottom-[4.6rem] left-3 z-30 md:bottom-6 md:left-8">
      <div
        aria-hidden={!s.adjust}
        inert={!s.adjust}
        className={`mb-2 w-64 rounded-2xl border border-line bg-white/90 p-4 text-sm shadow-xl backdrop-blur transition-all duration-200 ${
          s.adjust ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
        }`}
      >
        <label className="mb-3 block">
          <span className="mb-1.5 flex justify-between">
            <span>Ride height</span>
            <span className="label">−{Math.round(s.drop * 45)} mm</span>
          </span>
          <input type="range" min={0} max={1} step={0.01} value={s.drop} onChange={(e) => s.set({ drop: +e.target.value })} />
        </label>
        <label className="mb-3 block">
          <span className="mb-1.5 flex justify-between">
            <span>Wheel camber</span>
            <span className="label">−{(s.camber * 6).toFixed(1)}°</span>
          </span>
          <input type="range" min={0} max={1} step={0.01} value={s.camber} onChange={(e) => s.set({ camber: +e.target.value })} />
        </label>
        <button role="switch" aria-checked={s.lights} onClick={() => s.set({ lights: !s.lights })} className="flex w-full items-center justify-between">
          <span>Lights</span>
          <span className={`relative h-5 w-9 rounded-full transition-colors ${s.lights ? 'bg-accent' : 'bg-ink/15'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${s.lights ? 'left-[1.1rem]' : 'left-0.5'}`} />
          </span>
        </button>
      </div>
      <button className="btn btn-quiet shadow-sm" onClick={() => s.set({ adjust: !s.adjust })} aria-expanded={s.adjust}>
        {s.adjust ? 'Done' : 'Adjust the car'}
      </button>
    </div>
  )
}

export function Chrome({ webgl }: { webgl: boolean }) {
  const tab = useStore((s) => s.tab)
  const hint = useStore((s) => s.hint)
  const set = useStore((s) => s.set)
  const home = tab === 'home'

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between p-4 md:px-8 md:py-6">
        <div className={`transition-opacity duration-300 ${home ? 'opacity-0' : ''}`}>
          <p className="font-extrabold tracking-tight">{profile.name}</p>
          <p className="text-xs text-ink/55">{profile.role}</p>
        </div>
        <nav className="pointer-events-auto hidden gap-5 text-sm font-semibold md:flex" aria-label="Profiles">
          {profile.links.slice(0, 2).map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="text-ink/60 hover:text-accent">
              {l.label} ↗
            </a>
          ))}
        </nav>
      </header>

      {/* Home headline */}
      <div aria-hidden={!home} inert={!home} className={`intro ${home ? '' : 'pointer-events-none translate-y-3 opacity-0'}`}>
        <p className="label !text-accent">{profile.role}</p>
        <h1 className="mt-2 text-[clamp(2.1rem,6vw,5rem)] font-extrabold leading-[0.95] tracking-[-0.04em]">
          Vlad Gabriel
          <br />
          Neculai
        </h1>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-ink/65 md:text-base">{profile.tagline}</p>
        <button className="btn mt-5" onClick={() => set({ tab: 'about' })}>
          About me
        </button>
      </div>

      <div role="status" className={`hint ${hint || (home && webgl) ? 'opacity-100' : 'opacity-0'}`}>
        {hint ?? 'Drag to turn the car · click the bonnet, a door, a wheel or the boot'}
      </div>

      <nav className="tabs" aria-label="Sections">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => set({ tab: t.id })} aria-current={t.id === tab} className={t.id === tab ? 'tab tab-on' : 'tab'}>
            {t.label}
          </button>
        ))}
      </nav>

      {webgl && <Adjust />}
    </>
  )
}
