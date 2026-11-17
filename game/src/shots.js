// Screenshot staging: ?shot=cover|street|mission|combat&seed=N puts the
// game into a composed, deterministic scene — a chase, a street, a timed
// run, a shootout — so the four screenshots each show a different system
// of the game at its best. The driver waits for window.__shotReady.

import { PLACES } from './config.js';

function putPlayerInCar(game, kind, color, x, z, heading) {
  const car = game.playerCar;
  car.place(x, z, heading);
  car.hp = 100;
  game.player.enterCar(car, game.worldCallbacks);
  car.model.group.visible = true;
  return car;
}

function spawnChase(game, count) {
  const p = game.player.inCar ? game.player.inCar : game.player;
  for (let i = 0; i < count; i++) {
    game.police.spawnPoliceCar(p.x, p.z);
    const c = game.police.cars[game.police.cars.length - 1];
    // Pull the fresh unit in close behind the player for the frame.
    const back = 10 + i * 6;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    c.x = p.x - fx * back + (i % 2 ? 4 : -4);
    c.z = p.z - fz * back;
    c.heading = p.heading;
    c.speed = 24;
  }
}

export function setupShot(game, name) {
  const g = game;
  g.clockMinutes = 17 * 60 + 40; // golden hour for every shot
  g.suppressToasts = true;

  if (name === 'cover') {
    // The money shot: a sports car mid-chase, three stars, two PBPD units
    // on the bumper, the Harbor Run timer running.
    putPlayerInCar(g, 'sports', 0xc0392b, 0, -40, Math.PI);
    g.missions.index = 2;
    g.missions.stepIndex = 0;
    g.missions.active = true;
    g.missions.stepTimer = 20;
    g.police.heat = 110;
    g.cash = 2450;
    spawnChase(g, 2);
    const car = g.player.inCar;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    return {
      camera: {
        pos: { x: car.x - fx * 11, y: 4.5, z: car.z - fz * 11 },
        look: { x: car.x + fx * 14, y: 1.2, z: car.z + fz * 14 },
      },
      autoFire: false,
    };
  }

  if (name === 'street') {
    // On foot beside a parked car, pedestrians and traffic going by.
    g.player.place(-2.2, -58, Math.PI * 0.75);
    g.player.armed = false;
    g.cash = 150;
    g.missions.active = false;
    g.missions.storyDone = true; // free-roam objective line, no fare spawns
    // Park the player's own car out of frame; the parked car at (-4.6,-60)
    // is the one Rico is standing beside.
    const car = g.playerCar;
    car.active = false;
    car.place(0, -170, 0);
    return {
      camera: {
        pos: { x: 6, y: 3.6, z: -46 },
        look: { x: -3, y: 1.2, z: -59 },
      },
      autoFire: false,
    };
  }

  if (name === 'mission') {
    // Harbor Run: flat out east toward the containers, 45 seconds left.
    putPlayerInCar(g, 'sedan', 0x2980b9, 60, 0, Math.PI / 2);
    g.player.inCar.speed = 26;
    g.missions.index = 2;
    g.missions.stepIndex = 0;
    g.missions.active = true;
    g.missions.stepTimer = 30;
    g.cash = 900;
    const car = g.player.inCar;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    return {
      camera: {
        pos: { x: car.x - fx * 10, y: 4, z: car.z - fz * 10 },
        look: { x: car.x + fx * 16, y: 1, z: car.z + fz * 16 },
      },
      autoFire: false,
    };
  }

  if (name === 'combat') {
    // The Big Score: Rico outside the bank, guards up, pistol out.
    g.missions.index = 4;
    g.missions.stepIndex = 1;
    g.missions.active = true;
    g.missions.spawnGuards();
    g.player.place(23, -6, Math.PI);
    g.player.armed = true;
    g.player.ammo = 12;
    g.police.heat = 60;
    g.cash = 1200;
    g.playerCar.place(10, -14, Math.PI / 2);
    return {
      camera: {
        pos: { x: 30, y: 3.4, z: 2 },
        look: { x: 20, y: 1.4, z: -22 },
      },
      autoFire: true,
    };
  }

  return { camera: null, autoFire: false };
}

export const SHOT_NAMES = ['cover', 'street', 'mission', 'combat'];
