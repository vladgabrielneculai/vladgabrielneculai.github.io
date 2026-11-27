import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/manrope'
import './styles.css'
import { createRoot } from 'react-dom/client'
import { loadContent } from './data'

// /?edit opens the content editor; saving there needs the dev server or a GitHub token.
const editing = new URLSearchParams(location.search).has('edit')
// Fetch the app's code while the content downloads, not after. (Nothing reads the content
// while its modules load, only when they render.)
const app = editing ? import('./ui/Editor') : import('./App')
await loadContent()
const { default: Root } = await app

createRoot(document.getElementById('root')!).render(<Root />)
