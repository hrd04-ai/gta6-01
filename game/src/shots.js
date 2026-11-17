// Staged screenshot states: ?shot=cover|street|mission|combat&seed=7.
// Each one puts Rico, the police, a mission and the camera into a readable,
// action-filled frame before the first render, then FREEZES the simulation so
// the composed frame cannot drive away or crash before the capture. Every
// staged position sits on a road (road lines are multiples of 44), never
// inside a block, and the camera is snapped to a clear sightline down it.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCarMesh } from './vehicles.js';

function putPlayerInCar(G, x, z, heading, speed, color = 0xc22e2e) {
  const mesh = makeCarMesh(color);
  G.scene.add(mesh);
  const car = { mesh, pos: new THREE.Vector3(x, 0, z), heading, speed, hp: 100, color, kind: 'player' };
  mesh.position.copy(car.pos);
  mesh.rotation.y = -heading + Math.PI / 2;
  G.player.inCar = car;
  G.player.mesh.visible = false;
  return car;
}

function addPursuitBehind(G, car, count, gap) {
  // Flank the player car: slightly behind and to each side, so the units read
  // as a chase without sitting between the camera and the player.
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const back = gap * (1 + Math.floor(i / 2));
    const bx = car.pos.x - Math.cos(car.heading) * back + Math.sin(car.heading) * side * 6;
    const bz = car.pos.z + Math.sin(car.heading) * back + Math.cos(car.heading) * side * 6;
    const p = G.police.spawnPursuitNear(new THREE.Vector3(bx, 0, bz));
    p.pos.set(bx, 0, bz);
    p.heading = car.heading;
    p.speed = car.speed * 0.9;
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = -car.heading + Math.PI / 2;
  }
}

// Place the camera at a fixed spot looking at the focus; no lerping, so the
// first rendered frame is already the composed shot. lookAhead shifts the
// look target past the focus along the view direction (used for aiming shots,
// mirroring updateCamera's armed look-ahead).
function snapCamera(G, fx, fz, yaw, dist, height, lookAhead = 0) {
  G.cameraYaw = yaw;
  const cx = fx - Math.sin(yaw) * dist;
  const cz = fz - Math.cos(yaw) * dist;
  G.camera.position.set(cx, height, cz);
  G.camera.lookAt(fx + Math.sin(yaw) * lookAhead, 1.6, fz + Math.cos(yaw) * lookAhead);
}

export function stageShot(G, name) {
  const P = G.player;
  if (name === 'cover') {
    // Red sports car racing north up 1st Avenue, two PD units on its tail,
    // 3 stars, Harbor Run ticking. Car sits ON road x=0; camera looks north
    // down the clear corridor.
    G.missions.index = 2;
    G.missions.timer = 54;
    const car = putPlayerInCar(G, -4, 40, Math.PI / 2, 26);
    G.police.heat = 50;
    G.police.wanted = 3;
    addPursuitBehind(G, car, 2, 14);
    snapCamera(G, -4, 40, Math.PI, 15, 7);
    G.hud.toast('HARBOR RUN — 54s to the buyer');
  } else if (name === 'street') {
    // Rico on foot on the plaza, fountain behind him, palms and a green
    // light, traffic rolling past on the avenue behind him.
    P.pos.set(-22, 0, -8);
    P.heading = Math.PI / 2;
    P.armed = false;
    P.mesh.position.copy(P.pos);
    P.mesh.rotation.y = -P.heading + Math.PI / 2;
    G.missions.index = 1;
    snapCamera(G, -22, -8, Math.PI, 11, 5);
  } else if (name === 'mission') {
    // Blue sedan running east on 5th Avenue toward the harbor beacon.
    G.missions.index = 2;
    G.missions.timer = 44;
    const car = putPlayerInCar(G, 44, 44, 0, 24, 0x2e5ec2);
    G.police.heat = 0;
    G.police.wanted = 0;
    snapCamera(G, 44, 44, Math.PI / 2, 17, 6.5);
  } else if (name === 'combat') {
    // Bank shootout: Rico on the road outside Bay Bank, pistol out, three
    // guards ahead on the plaza, crosshair live.
    G.missions.index = 4;
    G.missions.stage = 2;
    G.missions.spawnGuards(G);
    P.pos.set(66, 0, -46);
    P.heading = Math.PI;
    P.armed = true;
    P.ammo = 12;
    P.mesh.position.copy(P.pos);
    P.mesh.rotation.y = -P.heading + Math.PI / 2;
    G.police.heat = 20;
    G.police.wanted = 1;
    snapCamera(G, 66, -46, Math.PI, 10, 4.5, 6);
    G.cameraPitch = 0.12;
    G.hud.setCrosshair(true);
  }
  // Freeze the world: nothing moves, crashes or decays before the capture.
  G.frozen = true;
  // Refresh HUD text immediately so the first frame already shows it.
  G.hud.update(G);
}

export function shotList() {
  return ['cover', 'street', 'mission', 'combat'];
}

export { CFG };
