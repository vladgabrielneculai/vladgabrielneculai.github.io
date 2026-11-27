# Portfolio v2 — interactive Mazda3

Single-screen portfolio built around a real-time 3D model of my Mazda3 (Machine Grey, chrome Work Emotion wheels) in a garage. It opens with a short sequence: dark garage, headlamps on, ceiling lights striking one by one. Any click or key skips it; it is skipped automatically for visitors who prefer reduced motion.

- Drag to turn the car.
- Click the bonnet, the driver's door, a wheel or the boot to open Skills, About me, Projects or Experience. The other doors just open.
- Tabs turn the car and open a content panel.
- Phones (`src/ui/Story.tsx`) get their own layout: the garage on a stage at the top, every section in one scroll underneath it, and the camera follows the scroll to the part of the car each section belongs to. The 3D garage only loads after a tap on “Step into the garage” (a 35 KB still, `public/poster.webp`, stands in until then), so the page reads at once on a slow connection. The controls sit in a dock at the bottom: Adjust opens as a drawer, with a “Tilt the phone to look around” switch (iPhones ask permission first), and Android phones give a short vibration when the engine starts or revs. Add `?live` to start the garage straight away.
- About me puts you in the driver's seat. To get out, click the driver's door to open it, then click the garage outside; or use "Leave the car".
- The editor's Profile section takes a profile picture; it is stored inside `content.json`. About me puts you in the driver's seat; drag to look around.
- "Adjust the car": ride height, wheel camber, lights.

## Performance

The scene adapts to the machine. It starts at up to 1.5x pixel density (1.25x on phones) with a mirrored floor on desktop. If frames drop, it first lowers the pixel density, then replaces the mirror with a plain glossy floor, which halves the drawing work. Phones start without the mirror. Add `?lite` to the address to force the lighter mode.

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
- `src/drive.ts` — “Drive into the city”: a button sends the Mazda out. It rolls the garage door up if it is down, starts the engine, reverses out and round onto the street, drives off. Every other control hides while it plays, with letterbox bars and a camera rail following the car. Once the car is out of sight the screen fades to black and a contact form opens (`src/ui/Away.tsx`; it sends through the visitor's email app). Closing the form (×, Esc or “Back to the garage”) brings the car back down the street and into the garage nose first. Passing traffic waits while it is out. Add `?drive=out,3.5` or `?drive=in,2` to hold the drive at that second for captures.
- `src/sound.ts` — every sound, synthesised with the Web Audio API (nothing downloaded): the four-cylinder engine (your Mazda, and the passing cars with a flat-four burble for the Impreza), starter motor, rain (only when it is raining), the shutter, plus `buzz()` for phone vibration. Audio starts only after a click; the Sound switch in “Adjust the car” mutes it all.
- Engine controls are in “Adjust the car”: Engine starts it (starter, catch, idle shake), Hold to rev sends it to the limiter while the body rolls against the torque.
- `src/scene/Street.tsx` — the roller shutter in the back wall (mural of the Mazda doing a burnout) and the night street it rolls up onto: shop fronts, the road, the weather (rain, a clear night, snow with wheel tracks in it, or falling cherry blossom; picked under “Weather outside” in “Adjust the car”, which rolls the door up; `?weather=snow` for captures), passing cars (the Impreza and MX-5 models, picked at random and resprayed in a random colour each time; loaded only once the door has been opened), a synthesised motor-and-rattle sound. Click the door to open or close it. Add `?car=x,lane,model,paint` to hold a passing car in place for captures.
- `src/assets/garage-jp.woff2` — a small subset of Noto Sans JP Black (SIL Open Font License 1.1) for the Japanese lettering.
- `src/scene/Scene.tsx` — camera views per tab, opening-sequence clock, ground shadow.
- `src/ui/` — headline, tabs, content panel, adjust popover.
- `public/models/mazda3.glb` — the car, converted from FBX and compressed (Meshopt + WebP, ~3.6 MB).
- `public/models/impreza-sti.glb`, `public/models/mx5.glb` — the cars in the side bays (~1.1 MB each), loaded after the Mazda so they never delay the opening. CC BY-NC-SA 4.0, see `public/models/CREDITS.md`. Placement and lift height live in `src/scene/Display.tsx`.
