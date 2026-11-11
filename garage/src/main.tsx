import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/manrope'
import './styles.css'
import { createRoot } from 'react-dom/client'

// /?edit opens the local content editor, in development only.
const editing = import.meta.env.DEV && new URLSearchParams(location.search).has('edit')
const { default: Root } = editing ? await import('./ui/Editor') : await import('./App')

createRoot(document.getElementById('root')!).render(<Root />)
