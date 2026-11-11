import { useEffect, useState } from 'react'
import { Scene } from './scene/Scene'
import { skipIntro, useStore } from './store'
import { Chrome, Loader } from './ui/Chrome'
import { Panel } from './ui/Panel'

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
  const playing = useStore((s) => s.intro) && webgl

  return (
    <>
      <div className="fixed inset-0">{webgl && <Scene />}</div>
      <div className={`ui ${playing ? 'ui-hidden' : ''}`}>
        <Chrome webgl={webgl} />
        <Panel />
      </div>
      <Loader />
    </>
  )
}
