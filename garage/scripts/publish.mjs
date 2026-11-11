// Copies the built site (garage/dist) to the repository root, which is what
// GitHub Pages serves at https://vladgabrielneculai.github.io/.
// Run with `npm run publish-site`, then commit and push.
import { cpSync, existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const root = fileURLToPath(new URL('../../', import.meta.url))
if (!existsSync(dist + 'index.html')) throw new Error('No build found. Run `npm run build` first.')

// Only ever touches these four generated paths at the root.
for (const name of ['assets', 'models', 'index.html', 'favicon.png']) {
  rmSync(root + name, { recursive: true, force: true })
  cpSync(dist + name, root + name, { recursive: true })
}
console.log('Site copied to the repository root. Commit and push to publish.')
