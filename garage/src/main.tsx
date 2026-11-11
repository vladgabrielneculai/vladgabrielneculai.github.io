import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/manrope'
import './styles.css'
import { createRoot } from 'react-dom/client'
import { loadContent } from './data'

await loadContent()
// /?edit opens the content editor; saving there needs the dev server or a GitHub token.
const editing = new URLSearchParams(location.search).has('edit')
const { default: Root } = editing ? await import('./ui/Editor') : await import('./App')

createRoot(document.getElementById('root')!).render(<Root />)
