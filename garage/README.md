# Portfolio v2 — interactive Mazda3

Single-screen portfolio built around a real-time 3D model of my Mazda3 (Machine Grey, chrome Work Emotion wheels) in a garage. It opens with a short sequence: dark garage, headlamps on, ceiling lights striking one by one. Any click or key skips it; it is skipped automatically for visitors who prefer reduced motion.

- Drag to turn the car.
- Click the bonnet, the driver's door, a wheel or the boot to open Skills, About me, Projects or Experience. The other doors just open.
- Tabs turn the car and open a content panel. On phones: a bottom navigation bar and a sheet; swipe its header down to tuck it away and play with the car, up to read more.
- About me puts you in the driver's seat. To get out, click the driver's door to open it, then click the garage outside; or use "Leave the car".
- The editor's Profile section takes a profile picture; it is stored inside `content.json`. About me puts you in the driver's seat; drag to look around.
- "Adjust the car": ride height, wheel camber, lights.

## Stack

React 19 · TypeScript · Vite · Three.js via React Three Fiber + drei · Tailwind CSS 4 · Zustand.

## Run

```bash
npm install
npm run dev
```

## Edit the content

All text is in `public/content.json`, fetched when the page opens. Two ways to edit it with the form at `/?edit`:

**On the live site (admin).** Open <https://vladgabrielneculai.github.io/?edit>. It asks for a GitHub personal access token: create a *fine-grained* token (GitHub → Settings → Developer settings → Personal access tokens), repository access limited to this repository, permission *Contents: Read and write*. **Save** commits `content.json` to `main`; the live site follows in about a minute. The token is kept only in that browser (Sign out removes it) and is sent only to GitHub. Anyone can open the page, but nothing can be saved without a token that has write access.

**Locally.** With `npm run dev` running, open <http://localhost:5173/?edit>. No token needed; **Save** writes `public/content.json`. Then publish as below.

## Publish

`npm run publish-site` builds the site and copies it to the repository root, which GitHub Pages serves. Commit and push to `main` afterwards.

## Where things live

- `public/content.json` — all text content (profile, experience, projects, skills).
- `src/store.ts` — `zones`: which part of the car leads to which tab.
- `src/scene/Car.tsx` — loads the model, finds hinges, wheels and lamps from part bounds, builds paint, glass, brake and lamp materials.
- `src/scene/Garage.tsx` — the room, its lights and the timing of the opening sequence.
- `src/scene/Props.tsx` — garage furniture (tool chest, workbench, racks, drums).
- `src/scene/Jdm.tsx` — the Japanese tuner-garage set: two-post lifts, wheel wall, vending machine, neon sign, posters. All artwork is drawn in code.
- `src/assets/garage-jp.woff2` — a small subset of Noto Sans JP Black (SIL Open Font License 1.1) for the Japanese lettering.
- `src/scene/Scene.tsx` — camera views per tab, opening-sequence clock, ground shadow.
- `src/ui/` — headline, tabs, content panel, adjust popover.
- `public/models/mazda3.glb` — the car, converted from FBX and compressed (Meshopt + WebP, ~3.6 MB).
