[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/hrd04-ai/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/hrd04-ai/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Make GTA 6 — An Open-World Crime Game in the Browser

An original open-world crime game in the spirit of GTA 6, built as a free,
open-source browser game. Explore a living city on foot or by car, steal
vehicles, dodge the police, take on missions, and climb the ranks of the
underworld — all inside a desktop browser, with no install and no network
connection needed.

This entry was built for the make.fun bounty — see the competition page at
https://make.fun/bounty/gta6-01.

## Play it

The game is a set of static files under `game/`. It runs fully **offline** in a
desktop browser: every library is vendored under `game/`, and the game makes no
network requests at all.

1. Serve the `game/` directory with any static file server (for example
   `npx serve game`, `python3 -m http.server` from inside `game/`, or your
   favourite equivalent).
2. Open `index.html` in a desktop browser.
3. Alternatively, open `game/index.html` directly from disk.

Keyboard and mouse are all you need: move, drive, fight, and navigate the menus
with standard keys, and use the mouse for aiming and menu interaction.

## What is in the game

- **A city to explore** — drive and walk through a living city with traffic,
  pedestrians, and places worth visiting.
- **Cars worth stealing** — hop into vehicles around the city, drive them,
  and make your getaway.
- **A wanted system** — cause trouble and the police come after you. Lose the
  heat or outrun the chase.
- **Missions and a story** — a story arc with missions that take you across the
  city and deeper into the underworld.
- **Combat** — fists and more, on foot and from behind the wheel.
- **HUD with a minimap** — health, wanted level, and a live minimap keep you
  oriented at a glance.
- **Start and save** — start a fresh run or pick up where you left off.
- **Sound and polish** — original sound effects and music, plus the small
  touches (effects, menus, feedback) that make a city feel alive.

## Controls

The game is played with keyboard and mouse in a desktop browser.

| Action | Control |
| --- | --- |
| Move on foot | WASD / arrow keys |
| Enter / exit a vehicle | E |
| Drive | WASD / arrow keys |
| Sprint | Shift |
| Attack / aim | Mouse |
| Interact | E |
| Pause / menu | Esc |

The in-game start screen and on-screen hints explain the exact keys before you
play, so the table above is a quick reference — the game itself is the final
word. A desktop browser with a real keyboard and mouse is recommended; touch
devices are not supported.

## Project structure

```text
game/
  index.html        # entry point — open this in a desktop browser
  src/
    audio.ts        # original sound and music
    city.ts         # the city, traffic and pedestrians
    config.ts       # tuning and configuration
    effects.ts      # visual effects and polish
    hud.ts          # HUD and minimap
    main.ts         # game loop and wiring
    missions.ts     # missions and story
    ...             # more gameplay modules
screenshots/        # gameplay screenshots
main.ts             # Node 22 program: hands in game/ + screenshots/ and writes dossier.json
serve.ts            # static file server helper
vendor/
  makefun-game.ts   # vendored make.fun game support code
LICENSE             # MIT
```

## Development

`main.ts` is a Node 22 program (run it with `node` / `tsx` as appropriate for
your setup). It gathers the game and its screenshots and writes the submission
dossier:

- hands in the `game/` directory (the playable game),
- hands in the `screenshots/` directory,
- writes `dossier.json` describing the submission.

`serve.ts` provides a simple static server for local playtesting.

## Originality

Everything in this project is the entrant's own work: the city, the characters,
the vehicles, the names, the story, the art, the sound, and the music. It is an
original game inspired by the open-world crime genre — no Rockstar Games name,
logo, character, map, or asset is used anywhere in it.

## License

MIT — see `LICENSE` for the full text.
