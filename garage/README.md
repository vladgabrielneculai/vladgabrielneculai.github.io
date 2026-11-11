# Portfolio v2 — interactive Mazda3

Single-screen portfolio built around a real-time 3D model of my Mazda3 (Machine Grey, Work Emotion wheels).

- Drag to turn the car; click a door, the bonnet or the boot to open it.
- Tabs (About, Experience, Projects, Skills, Contact) turn the car and open a content panel.
- "Adjust the car": ride height, wheel camber, lights.

## Stack

React 19 · TypeScript · Vite · Three.js via React Three Fiber + drei · Tailwind CSS 4 · Zustand.

## Run

```bash
npm install
npm run dev
```

## Edit the content

With `npm run dev` running, open <http://localhost:5173/?edit>. The form edits your profile, experience, projects and skills, and **Save** writes `src/content.json`. Commit and push to publish. The editor exists only in development; it is not in the built site. You can also edit `src/content.json` by hand.

`npm run build` type-checks and writes a static site to `dist/` (relative paths, so it can be served from any folder).

## Where things live

- `src/content.json` — all text content (profile, experience, projects, skills).
- `src/store.ts` — `zones`: which part of the car leads to which tab.
- `src/scene/Car.tsx` — loads the model, finds hinges and wheels from part bounds, applies materials.
- `src/scene/Scene.tsx` — studio lighting, camera views per tab, ground shadow.
- `src/ui/` — headline, tabs, content panel, adjust popover.
- `public/models/mazda3.glb` — the car, converted from FBX and compressed (Meshopt + WebP, ~3.6 MB).
