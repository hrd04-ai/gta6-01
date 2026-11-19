// Screenshot staging for Palmera Bay: Sunset Heat.
// The game reads ?shot=<name> from the URL and stages a scene before
// the first frame: a cover chase, a street walk, a mission in progress
// or a combat standoff. The headless screenshot run waits for
// window.__palmeraShot.ready, then captures the canvas. Nothing here
// runs during normal play — no query param, no staging.

export const SHOT_NAMES = ['cover', 'street', 'mission', 'combat'];

export function shotFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    const name = q.get('shot');
    return SHOT_NAMES.includes(name) ? name : null;
  } catch {
    return null;
  }
}

// game is the Game instance from main.js; the staging functions only
// move the player, set the wanted level and start a mission through
// the game's own public methods, so a staged shot is a real game state.
export function stageShot(game, name) {
  const { player, city, police, missions, cars } = game;
  const place = (x, y) => {
    player.reset(x, y);
    game.cameraSnap(x, y);
  };

  if (name === 'cover') {
    // Sunset GT tearing down the beachfront road, cops behind, sun low.
    const gt = cars.find((c) => c.model === 'Sunset GT') ?? cars[0];
    if (gt) {
      gt.x = 1500;
      gt.y = 2370;
      gt.angle = 0;
      gt.kind = 'player';
      gt.driver = 'player';
      player.inCar = gt;
      player.x = gt.x;
      player.y = gt.y;
      gt.speed = 420;
    }
    place(1500, 2370);
    police.crime(2, 'screenshot');
    game.spawnChasePack(3);
  } else if (name === 'street') {
    // On foot in the downtown grid, traffic passing, pedestrians about.
    place(1470, 1050);
    player.aimAngle = Math.PI / 4;
  } else if (name === 'mission') {
    // Mission 1 in progress: drive to the pier, marker and HUD live.
    place(1050, 1470);
    const def = missions.defs[0];
    missions.start(def, game.missionContext());
    missions.active.stepIndex = 2; // final leg: deliver to the pier
    const gt = cars.find((c) => c.model === 'Sunset GT') ?? cars[0];
    if (gt) {
      gt.x = 1050;
      gt.y = 1470;
      gt.angle = Math.PI / 2;
      gt.kind = 'player';
      gt.driver = 'player';
      player.inCar = gt;
      player.x = gt.x;
      player.y = gt.y;
      gt.speed = 300;
    }
  } else if (name === 'combat') {
    // Three-star standoff on Coral Avenue: foot cops closing in.
    place(2310, 1050);
    player.ammo = 48;
    player.aimAngle = -Math.PI / 3;
    police.crime(3, 'screenshot');
    game.spawnChasePack(2);
    game.spawnFootCops(3, 2310, 1050);
  }

  game.state = 'playing';
  game.hud.showMessage('', 0);
  window.__palmeraShot = { name, ready: true, at: Date.now() };
  return true;
}
