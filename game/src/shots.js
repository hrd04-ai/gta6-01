// Screenshot staging: ?shot=cover|street|mission|combat&seed=N puts the
// game into a composed, deterministic scene — a chase, a street, a timed
// run, a shootout — so the four screenshots each show a different system
// of the game at its best. The driver waits for window.__shotReady.

import { PLACES } from './config.js';
import { createCarModel } from './vehicles.js';

function putPlayerInCar(game, kind, color, x, z, heading) {
  const car = game.playerCar;
  // The ride for the shot: swap the model to the requested kind and colour.
  game.scene.remove(car.model.group);
  car.model = createCarModel(kind, color);
  car.kind = kind;
  car.color = color;
  game.scene.add(car.model.group);
  car.place(x, z, heading);
  car.hp = 100;
  game.player.enterCar(car, game.worldCallbacks);
  car.model.group.visible = true;
  return car;
}

function spawnChase(game, count) {
  const p = game.player.inCar ? game.player.inCar : game.player;
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const rx = -Math.cos(p.heading), rz = Math.sin(p.heading); // right vector
  // Both units ahead of the player, flanking the road: clearly in frame,
  // reading as a chase with the road ahead blocked. Held still for the shot.
  const spots = [
    { ahead: 14, side: -5 },
    { ahead: 19, side: 6 },
  ];
  for (let i = 0; i < count; i++) {
    game.police.spawnPoliceCar(p.x, p.z);
    const c = game.police.cars[game.police.cars.length - 1];
    const s = spots[i % spots.length];
    c.x = p.x + fx * s.ahead + rx * s.side;
    c.z = p.z + fz * s.ahead + rz * s.side;
    c.heading = p.heading;
    c.speed = 0;
    c.hold = true;
    c.model.group.position.set(c.x, 0, c.z);
    c.model.group.rotation.y = c.heading;
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
    return {
      camera: { follow: true, back: 11, height: 4.5, lookAhead: 14, lookHeight: 1.2 },
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
    return {
      camera: { follow: true, back: 10, height: 4, lookAhead: 16, lookHeight: 1 },
      autoFire: false,
    };
  }

  if (name === 'combat') {
    // The Big Score: Rico outside the bank, guards on the south plaza,
    // pistol out. Camera from the south-east so the player, the guards
    // and the tower all read in one frame.
    g.missions.index = 4;
    g.missions.stepIndex = 1;
    g.missions.active = true;
    g.missions.spawnGuards();
    g.player.place(23, -2, Math.PI);
    g.player.armed = true;
    g.player.ammo = 12;
    g.police.heat = 60;
    g.cash = 1200;
    g.playerCar.place(10, -14, Math.PI / 2);
    return {
      camera: {
        pos: { x: 34, y: 4, z: 10 },
        look: { x: 20, y: 1.5, z: -18 },
      },
      autoFire: true,
    };
  }

  return { camera: null, autoFire: false };
}

export const SHOT_NAMES = ['cover', 'street', 'mission', 'combat'];
