# My Portfolio

Live at <https://vladgabrielneculai.github.io/>.

A single-screen portfolio built around an interactive 3D model of my Mazda3.

- `garage/` — source code (React, TypeScript, Vite, Three.js). See `garage/README.md`.
- `content.json` — the site's text. Edit it at <https://vladgabrielneculai.github.io/?edit> (needs a GitHub token, see `garage/README.md`).
- `index.html`, `assets/`, `models/`, `favicon.svg`, `apple-touch-icon.png` — the **built** site that GitHub Pages serves. Generated; do not edit by hand.

## Update the live site

```bash
cd garage
npm install
npm run dev            # edit content at http://localhost:5173/?edit
npm run publish-site   # build and copy the result to the repository root
```

Then commit and push to `main`.
