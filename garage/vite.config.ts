import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only: lets the /?edit page save src/content.json. Never part of a build.
function contentEditor(): Plugin {
  const file = fileURLToPath(new URL('./src/content.json', import.meta.url))
  return {
    name: 'content-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__content', (req, res) => {
        // Only the editor page itself may write: same-origin JSON POSTs.
        const sameOrigin = req.headers['sec-fetch-site'] === 'same-origin'
        const json = (req.headers['content-type'] ?? '').startsWith('application/json')
        if (req.method !== 'POST' || !sameOrigin || !json) {
          res.statusCode = 403
          return res.end('forbidden')
        }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          try {
            const data = JSON.parse(body)
            for (const key of ['profile', 'experience', 'projects', 'skills']) if (!(key in data)) throw new Error(`missing "${key}"`)
            writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
            res.end('ok')
          } catch (e) {
            res.statusCode = 400
            res.end(String(e))
          }
        })
      })
    },
  }
}

// Relative base so the build works from any sub-path (GitHub Pages root or /garage/).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), contentEditor()],
  build: { chunkSizeWarningLimit: 1400 },
})
