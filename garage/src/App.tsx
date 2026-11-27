import { useEffect, useState } from 'react'
import { Scene } from './scene/Scene'
import { PHONE, skipIntro, useStore } from './store'
import { Away } from './ui/Away'
import { Chrome, Loader } from './ui/Chrome'
import { Panel } from './ui/Panel'
import { Story } from './ui/Story'

function hasWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

export default function App() {
  const [webgl] = useState(hasWebGL)

  useEffect(() => {
    // Without WebGL the page is still a complete, readable CV.
    if (!webgl) useStore.getState().set({ ready: true })
  }, [webgl])

  useEffect(() => {
    // Any click or key press skips the opening sequence.
    window.addEventListener('pointerdown', skipIntro)
    window.addEventListener('keydown', skipIntro)
    return () => {
      window.removeEventListener('pointerdown', skipIntro)
      window.removeEventListener('keydown', skipIntro)
    }
  }, [])
  // Phones get their own layout; turning a phone sideways (or widening a window) swaps it.
  useEffect(() => {
    const m = matchMedia(PHONE)
    const swap = () => useStore.getState().set(m.matches ? { story: true, adjust: false } : { story: false, live: true, adjust: false })
    m.addEventListener('change', swap)
    return () => m.removeEventListener('change', swap)
  }, [])
  const playing = useStore((s) => s.intro) && webgl
  const story = useStore((s) => s.story)
  const live = useStore((s) => s.live)

  return (
    <>
      <div className={story ? 'stage' : 'fixed inset-0'}>{webgl && live && <Scene />}</div>
      {story ? (
        <Story webgl={webgl} />
      ) : (
        <div className={`ui ${playing ? 'ui-hidden' : ''}`}>
          <Chrome webgl={webgl} />
          <Panel />
        </div>
      )}
      {webgl && <Away />}
      {!story && <Loader />}
    </>
  )
}
