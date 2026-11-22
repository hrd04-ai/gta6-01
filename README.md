[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/hrd04-ai/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/hrd04-ai/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Vice City Heat — An Open-World Crime Game

A playable open-world crime game inspired by the spirit of GTA 6, built as an
entry for the make.fun bounty: https://make.fun/bounty/gta6-01

Drop into a sun-soaked coastal city, steal cars, outrun the police, take on
missions, and build your reputation — all offline, straight from static files
in a desktop browser. No server, no install, no network connection needed.

## Play it

Open `game/index.html` in a desktop browser (Chrome or Firefox recommended).
Everything runs locally from the files under `game/` — just double-click the
file or serve the folder with any static file server.

## What's in the game

- **A living city** — explore streets, blocks, and waterfront districts on foot
  or behind the wheel.
- **Traffic and pedestrians** — cars flow through the streets and people walk
  the sidewalks, reacting to what happens around them.
- **Car stealing** — walk up to any parked or passing car and take it.
  Different cars handle differently.
- **Wanted system** — cause trouble and the police come after you. Wanted
  levels escalate the heat; break line of sight and lay low to cool off.
- **Missions and story** — a chain of story missions with objectives, plus
  side jobs to earn cash and raise your standing.
- **Combat** — fight on foot with melee and ranged attacks, take cover, and
  deal with rival crews and the law.
- **HUD with minimap** — health, cash, wanted stars, mission objectives, and a
  live minimap showing your position, targets, and nearby heat.
- **Start and save** — a start screen with a quick intro, and progress that
  saves in the browser so you can pick up where you left off.
- **Sound** — engine noise, sirens, gunfire, and ambient city audio, with a
  mute toggle.

## Controls

| Key / input | Action |
| ----------- | ------ |
| W / A / S / D or arrow keys | Move on foot, steer and drive in a car |
| E | Enter or exit a car; interact with people and objects |
| Shift | Sprint on foot |
| Mouse | Attack and aim |
| Esc | Pause the game and open the menu |

A few extra notes:

- Tap E near a mission marker to start the mission, and near a car door to
  steal the car.
- Sprinting drains stamina, so save it for escapes and chases.
- In the pause menu you can check your objectives, adjust sound, and save or
  quit.

## Project structure

- `game/` — the playable game (static files; start at `game/index.html`)
- `game/src/` — game modules in plain JavaScript:
  - `audio.js` — sound effects and ambience
  - `city.js` — city layout, traffic, and pedestrians
  - `config.js` — tuning, balance, and game constants
  - `effects.js` — particles, camera shake, and visual feedback
  - `hud.js` — HUD, minimap, and menus
  - `main.js` — game loop and wiring
  - `missions.js` — story missions and objectives
- `main.ts` — a Node 22 dossier program (run with `node main.ts`)
- `serve.ts` — a small static file server for local play
- `screenshots/` — screenshots of the game in action
- `vendor/makefun-game.ts` — make.fun game integration helper
- `LICENSE` — MIT license

## Originality note

This is an original fan-style project. It uses no Rockstar name, logo,
character, map, or asset. All code, art, audio, and text in this repository
were created for this entry, and any resemblance to real places or works is
purely coincidental.

## License

MIT — see `LICENSE` for the full text.
