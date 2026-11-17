# Palmera Bay: Sunset Heat

An original open-world crime game in the spirit of GTA 6, running offline in
a desktop browser from static files. Built for the make.fun gta6-01 bounty.

## The game

Rico Vega arrives in Palmera Bay, a sun-soaked coastal city of 7×7 road
blocks, a southern bay with docks and boats, and an eastern container harbor.
Mara, his fixer, hands him five jobs: steal a car, pick up a package in the
Old Town alley, run a timed 75-second Harbor Run, survive 60 seconds at 3
stars, and rob the Bay Bank of $5,000 past three armed guards. Between jobs,
side fares pay $45 a ride and the garage on 5th Ave repairs cars ($80) and
cleans wanted levels ($200).

- **On foot:** camera-relative WASD, sprint, punch (F), pistol with a
  12-round magazine (1 to draw, click to shoot, R to reload)
- **Driving:** arcade physics with handbrake slides, 16 traffic cars that
  obey lights and queue, 14 parked cars to steal (press E)
- **Police:** 0–5 wanted stars, pursuit cars that ram, foot cops that chase
  and bust, heat that cools when Rico behaves
- **City:** ~360 procedural buildings, palms, lamps, billboards, a plaza
  fountain, bank tower, safehouse, garage, police station and hospital
- **HUD:** stars, cash, health, speed, weapon, objective with timer and
  distance, live 2D minimap, dialogue from Mara, toasts
- **Sound:** fully synthesized WebAudio — engine, sirens, gunshots, a bass
  groove; no audio files
- **Save:** autosaves after every mission; continue from the title screen

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to `/output` and writes
`/output/dossier.json` with the vendored make.fun library.

## Tech

three.js r187 (vendored as `game/vendor/three/three.module.min.js`), plain ES
modules, no build step, no network requests. Screenshots are real renders of
the game in headless Chromium, staged through `?shot=cover|street|mission|combat`.
