# Palmera Bay: Sunset Heat

An original open-world crime game that runs offline in a desktop browser
from static files — a make.fun gta6-01 entry.

Rico Vega, a courier with no wheels and no patience, works five jobs for
Mara across Palmera Bay: steal a car, run a package, beat a harbor
deadline, survive a city-wide manhunt, and rob Palmera Trust Bank. Between
jobs the city stays alive — traffic, pedestrians, the PBPD and its wanted
stars, fares for cash, and a garage that will fix your ride and your
reputation, for a price.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

WASD move / drive · Shift sprint · mouse drag to look, wheel to zoom ·
E steal / enter / exit a car · F punch · click shoot (once the pistol is
unlocked) · Space handbrake · R reload · M mute · Esc pause. Progress
saves to the browser automatically.

## Structure

- `main.ts` — the entry program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` (Node 22, stdlib only).
- `game/index.html` — the page: canvas, HUD, menus, import map for three.js.
- `game/src/` — the game, one job per file:
  - `config.js` — tuning, palettes, named places
  - `city.js` — the procedural city: roads, towers, marina, harbor
  - `vehicles.js` — car models, traffic AI, arcade driving
  - `pedestrians.js` — crowds and the player character
  - `player.js` — on-foot movement and combat
  - `police.js` — wanted stars, pursuit cars, foot cops, busting
  - `missions.js` — the five-job story, guards, fares
  - `effects.js` — particles, explosions, screen shake
  - `hud.js` — readouts, toasts, live minimap
  - `audio.js` — synthesized sound: engine, sirens, music
  - `save.js` — localStorage saves
  - `shots.js` — deterministic screenshot scenes (`?shot=cover|street|mission|combat`)
  - `main.js` — bootstrap, camera, input, game loop
- `game/vendor/three/` — three.js r187, vendored minified build.
- `screenshots/` — four real renders of the game.

## License

MIT. Everything in this repository is original — its city, characters,
vehicles, names, story, art and sounds belong to no other game.
