# Portfolio v2 — interactive Mazda3

Single-screen portfolio built around a real-time 3D model of my Mazda3 (Machine Grey, chrome Work Emotion wheels) in a garage. It opens with a short sequence: dark garage, headlamps on, ceiling lights striking one by one. Any click or key skips it; it is skipped automatically for visitors who prefer reduced motion.

- Drag to turn the car.
- Click the bonnet, a door, a wheel or the boot to open Skills, About me, Projects or Experience.
- Tabs turn the car and open a content panel.
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

## Publish

`npm run publish-site` builds the site and copies it to the repository root, which GitHub Pages serves. Commit and push to `main` afterwards.

## Where things live

- `src/content.json` — all text content (profile, experience, projects, skills).
- `src/store.ts` — `zones`: which part of the car leads to which tab.
- `src/scene/Car.tsx` — loads the model, finds hinges, wheels and lamps from part bounds, builds paint, glass, brake and lamp materials.
- `src/scene/Garage.tsx` — the room, its lights and the timing of the opening sequence.
- `src/scene/Scene.tsx` — camera views per tab, opening-sequence clock, ground shadow.
- `src/ui/` — headline, tabs, content panel, adjust popover.
- `public/models/mazda3.glb` — the car, converted from FBX and compressed (Meshopt + WebP, ~3.6 MB).
