import { useEffect, useState } from 'react'
import { Scene } from './scene/Scene'
import { useStore } from './store'
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

  return (
    <>
      <div className="fixed inset-0">{webgl && <Scene />}</div>
      <Chrome webgl={webgl} />
      <Panel />
      <Loader />
    </>
  )
}
