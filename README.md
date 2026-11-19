# Palmera Bay: Sunset Heat

A top-down open-city crime game for the make.fun **gta6-01** competition
("Make GTA 6"), built from scratch in plain JavaScript with no libraries
and no network requests. Everything — the city, the people, the cars,
the story, the art and the sound — is original.

## The game

You are **Rico Marín**, a driver-for-hire in **Palmera Bay**, a sun-soaked
waterfront city at golden hour. Steal cars, outrun the Palmera Bay PD,
and run five story jobs for fixer **Vera Solano** (and one sunset tour
for Tommy Waves):

1. **Sunset Pickup** ($400) — move a package from Vera's garage to the pier.
2. **Hot Wheels** ($900) — steal a Sunset GT off Marina Row, deliver it to the chop shop.
3. **Beach Run** ($750) — collect three tourists along the boardwalk before the tour leaves.
4. **Heat Wave** ($1,400) — shake a three-star tail, then run a package to the north gate.
5. **The Big Score** ($3,500) — hit the Bay Bank and vanish to the safehouse.

## Systems

- **Open city** — a procedural grid city with roads, buildings, parks,
  plazas, a beach, a pier and a lighthouse, all generated from a seed.
- **Driving** — arcade car physics with drift, skid marks and damage;
  steal any parked or traffic car (hold E), police cruisers included in
  the chase, not in the garage.
- **On foot** — walk/run, mouse-aim pistol combat, punching, and getting
  in and out of cars.
- **Wanted system** — 0–5 stars. Crimes raise the heat; police cruisers
  and foot cops hunt you; staying unseen cools it down. Get caught on
  foot and you are busted.
- **Traffic & pedestrians** — cars cruise the roads, walkers stroll the
  sidewalks and the beachfront, and both react to gunfire and speeding cars.
- **HUD & minimap** — cash, health, car health, wanted stars, mission
  objective with a live marker, and a minimap with police and objective blips.
- **Sound** — fully synthesised WebAudio: engine hum, sirens, gunshots,
  crashes and a lazy sunset-drive music loop. No audio files.
- **Save** — cash, completed jobs and best stats persist in localStorage.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk / drive |
| Shift | Run on foot |
| Mouse | Aim |
| Click | Shoot pistol |
| F | Punch |
| E (hold) | Steal / enter car, E again to get out |
| Tab | Job board |
| P | Pause |
| M | Mute |
| R | Restart after busted / wasted |

## Run it

Serve `game/` with any static server and open `index.html`:

```sh
node serve.ts
# then open http://localhost:8080
```

Or, from the repository root, build the submission dossier:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

```
game/
  index.html        page shell + menu overlay
  style.css         page and menu styling
  src/
    main.js         game loop, camera, input, combat, wiring
    config.js       tuning, palette, mission definitions
    city.js         procedural city generation + minimap
    random.js       seeded RNG + math helpers
    player.js       on-foot movement, aiming, shooting
    vehicles.js     car physics, traffic AI, parked cars
    pedestrians.js  walkers, tourists, fleeing
    police.js       wanted stars, cruisers, foot cops, busts
    missions.js     five-job story chain
    hud.js          HUD, minimap, screens
    audio.js        synthesised WebAudio sound + music
    effects.js      particles, skid marks, shockwaves
    save.js         localStorage progress
    shots.js        ?shot= staging for screenshots
main.ts             hands game/ + screenshots/ to /output with a dossier
serve.ts            tiny static server for local play
vendor/
  makefun-game.ts   the kit's dossier library, unchanged
```

## License

MIT — see `LICENSE`.
