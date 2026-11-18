// Mara's five-mission story arc plus side fares. A mission is a small state
// machine: reach a beacon, survive a timer, or clear the bank guards. The
// beacon is one reused column of light; the HUD reads the objective each frame.
import * as THREE from 'three';
import { CFG, MISSIONS, DIALOGUE } from './config.js';

// Where the Old Town package waits, and where the Harbor Run buyer stands.
const ALLEY = { x: -88, z: 44 };
const HARBOR_POINT = { x: 166, z: 66 };
// Bay Bank front: the guards stand south of the tower, the vault behind it.
const BANK_FRONT = { x: 66, z: -66 };
const BANK_VAULT = { x: 66, z: -70 };

const BEACON_YELLOW = 0xffc832;
const BEACON_GREEN = 0x39d353;

function makeGuardMesh() {
  const group = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d5f, roughness: 0.8 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), skin);
  head.position.y = 1.62;
  group.add(head);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), suit);
  torso.position.y = 1.05;
  group.add(torso);
  const legGeo = new THREE.BoxGeometry(0.26, 0.72, 0.28);
  for (const s of [0.17, -0.17]) {
    const leg = new THREE.Mesh(legGeo, suit);
    leg.position.set(s, 0.36, 0);
    group.add(leg);
  }
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.16, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.4 }),
  );
  gun.position.set(0.4, 1.1, 0.3);
  group.add(gun);
  return group;
}

export class MissionSystem {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;
    this.stage = 0;
    this.timer = 0;
    this.heatTimer = 0;
    this.done = false;
    this.guards = [];
    this.fare = null;
    this.faresDone = 0;
    this.fareCooldown = 20;

    // Beacon: a column of light marking the current objective.
    const geo = new THREE.CylinderGeometry(2.6, 2.6, 34, 18, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: BEACON_YELLOW,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.y = 17;
    this.beacon.visible = false;
    scene.add(this.beacon);

    const ringGeo = new THREE.RingGeometry(2.2, 3.4, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: BEACON_YELLOW,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.12;
    this.ring.visible = false;
    scene.add(this.ring);
  }

  get current() { return MISSIONS[this.index]; }

  startMission(G, index) {
    this.index = index;
    this.stage = 0;
    this.timer = 0;
    this.heatTimer = 0;
    this.clearGuards();
    const m = MISSIONS[index];
    G.hud.showDialogue(m.brief);
    G.hud.toast(`Mission: ${m.name}`);
    if (index === 2) this.timer = CFG.harborRunTime;
    if (index === 3) G.police.addHeat(50);
    if (index === 4) {
      this.spawnGuards(G);
      this.stage = 1;
    }
    G.audio.jingle();
  }

  spawnGuards(G) {
    const bank = G.city.landmarks.bank;
    // All three stand south of the bank's front face (z -55) — never inside
    // the tower volume, or the third guard is hidden behind it.
    const spots = [
      { x: bank.x - 10, z: bank.z + 12 },
      { x: bank.x + 8, z: bank.z + 14 },
      { x: bank.x + 2, z: bank.z + 16 },
    ];
    for (const s of spots) {
      const mesh = makeGuardMesh();
      mesh.position.set(s.x, 0, s.z);
      this.scene.add(mesh);
      this.guards.push({
        mesh,
        pos: new THREE.Vector3(s.x, 0, s.z),
        hp: 100,
        dead: false,
        down: false,
        fireTimer: 1,
      });
    }
  }

  clearGuards() {
    for (const g of this.guards) this.scene.remove(g.mesh);
    this.guards = [];
  }

  aliveGuards() { return this.guards.filter((g) => !g.dead); }

  completeMission(G) {
    const m = MISSIONS[this.index];
    G.cash += m.reward;
    G.audio.jingle();
    G.hud.toast(`Mission complete: ${m.name}  +$${m.reward}`);
    G.hud.showDialogue(DIALOGUE.missionDone[this.index % DIALOGUE.missionDone.length]);
    this.beacon.visible = false;
    this.ring.visible = false;
    this.clearGuards();
    this.index++;
    if (this.index >= MISSIONS.length) {
      this.done = true;
      G.hud.showDialogue('Mara: That is the whole story, Rico. Palmera Bay is yours now — free roam, fares, whatever you want.');
      G.hud.toast('STORY COMPLETE — free roam!');
      G.saveGame();
      return;
    }
    this.startMission(G, this.index);
    G.saveGame();
  }

  failMission(G, reason) {
    G.hud.toast(reason);
    G.hud.showDialogue('Mara: That did not work. Shake it off — we run it again.');
    this.startMission(G, this.index);
  }

  objective() {
    if (this.done) {
      return {
        text: 'Free roam — fares pay $45 a ride',
        target: this.fare ? this.fare.pickup : null,
        timeLeft: null,
      };
    }
    switch (this.index) {
      case 0:
        return { text: 'Steal a car', target: null, timeLeft: null };
      case 1:
        return { text: 'Pick up the package in the alley', target: ALLEY, timeLeft: null };
      case 2:
        return { text: 'Reach the harbor beacon', target: HARBOR_POINT, timeLeft: Math.ceil(this.timer) };
      case 3:
        return {
          text: `Survive at 3 stars (${Math.ceil(this.heatTimer)}/${CFG.heatWaveTime}s)`,
          target: null,
          timeLeft: null,
        };
      case 4: {
        if (this.stage === 1) {
          return { text: 'Get to Bay Bank', target: BANK_FRONT, timeLeft: null };
        }
        if (this.stage === 2) {
          return { text: `Clear the guards (${this.aliveGuards().length} left)`, target: BANK_FRONT, timeLeft: null };
        }
        return { text: 'Grab the $5,000 from the vault', target: BANK_VAULT, timeLeft: null };
      }
      default:
        return { text: '', target: null, timeLeft: null };
    }
  }

  maybeOfferFare(G) {
    if (this.index < 2 || this.done) return;
    if (this.fare) return;
    this.fareCooldown -= 1 / 60;
    if (this.fareCooldown > 0) return;
    this.fareCooldown = 45;
    const px = (Math.floor(Math.random() * 7) - 3) * CFG.roadSpacing;
    const pz = (Math.floor(Math.random() * 7) - 3) * CFG.roadSpacing;
    this.fare = {
      pickup: { x: px + 10, z: pz },
      dest: {
        x: (Math.floor(Math.random() * 7) - 3) * CFG.roadSpacing,
        z: (Math.floor(Math.random() * 7) - 3) * CFG.roadSpacing,
      },
      aboard: false,
    };
    G.hud.toast('Fare available — pick up the passenger (green beacon)');
  }

  update(dt, G) {
    const player = G.player;
    const pPos = player.inCar ? player.inCar.pos : player.pos;
    const obj = this.objective();

    // The beacon follows the current objective target.
    if (obj.target) {
      this.beacon.visible = true;
      this.ring.visible = true;
      this.beacon.position.set(obj.target.x, 17, obj.target.z);
      this.ring.position.set(obj.target.x, 0.12, obj.target.z);
      this.beacon.material.opacity = 0.28 + Math.sin(G.time * 4) * 0.1;
      this.ring.scale.setScalar(1 + Math.sin(G.time * 4) * 0.08);
    } else if (!this.fare) {
      this.beacon.visible = false;
      this.ring.visible = false;
    }

    if (this.done) {
      this.updateFare(dt, G, pPos);
      return;
    }

    switch (this.index) {
      case 0:
        if (player.inCar) this.completeMission(G);
        break;
      case 1: {
        const d = Math.hypot(pPos.x - ALLEY.x, pPos.z - ALLEY.z);
        if (d < 5) {
          G.audio.pickup();
          this.completeMission(G);
        }
        break;
      }
      case 2: {
        this.timer -= dt;
        const d = Math.hypot(pPos.x - HARBOR_POINT.x, pPos.z - HARBOR_POINT.z);
        if (d < 7) this.completeMission(G);
        else if (this.timer <= 0) this.failMission(G, 'Harbor Run failed — the buyer left.');
        break;
      }
      case 3: {
        // Heat Wave keeps the pressure on: never let the wanted level fall
        // below the 3-star floor while the mission runs.
        G.police.heat = Math.max(G.police.heat, 45);
        if (G.police.wanted >= 3) {
          this.heatTimer += dt;
          if (this.heatTimer >= CFG.heatWaveTime) this.completeMission(G);
        }
        break;
      }
      case 4: {
        if (this.stage === 1) {
          const d = Math.hypot(pPos.x - BANK_FRONT.x, pPos.z - BANK_FRONT.z);
          if (d < 14) {
            this.stage = 2;
            G.hud.showDialogue('Guard: Hey! Nobody moves! Take them down, Rico!');
          }
        } else if (this.stage === 2) {
          if (this.aliveGuards().length === 0) {
            this.stage = 3;
            G.hud.toast('Vault open — grab the cash!');
          }
        } else if (this.stage === 3) {
          const d = Math.hypot(pPos.x - BANK_VAULT.x, pPos.z - BANK_VAULT.z);
          if (d < 5) this.completeMission(G);
        }
        // Guards shoot at Rico when he is close.
        for (const g of this.aliveGuards()) {
          const d = Math.hypot(g.pos.x - pPos.x, g.pos.z - pPos.z);
          if (d < 34) {
            g.fireTimer -= dt;
            g.mesh.lookAt(pPos.x, 1.4, pPos.z);
            if (g.fireTimer <= 0) {
              g.fireTimer = 1.3;
              G.effects.burst(new THREE.Vector3(g.pos.x, 1.4, g.pos.z), 2, 0xffd76a, 3, 1, 0.25);
              if (!player.inCar && Math.random() < 0.55) {
                if (player.takeDamage(8, G.effects)) G.events.push('wasted');
              } else if (player.inCar && Math.random() < 0.3) {
                player.inCar.hp -= 4;
              }
              G.audio.shot();
            }
          }
        }
        break;
      }
      default:
        break;
    }
    this.updateFare(dt, G, pPos);
  }

  updateFare(dt, G, pPos) {
    this.maybeOfferFare(G);
    if (!this.fare) return;
    const point = this.fare.aboard ? this.fare.dest : this.fare.pickup;
    // The story beacon takes priority over the fare beacon.
    if (!this.done && this.objective().target) return;
    this.beacon.visible = true;
    this.ring.visible = true;
    this.beacon.material.color.setHex(BEACON_GREEN);
    this.beacon.position.set(point.x, 17, point.z);
    this.ring.position.set(point.x, 0.12, point.z);
    const d = Math.hypot(pPos.x - point.x, pPos.z - point.z);
    if (d < 5) {
      if (!this.fare.aboard) {
        this.fare.aboard = true;
        G.hud.toast('Passenger aboard — drive to the marker');
        G.audio.pickup();
      } else {
        G.cash += CFG.fareReward;
        this.faresDone++;
        G.hud.toast(`Fare complete  +$${CFG.fareReward}`);
        G.hud.showDialogue(DIALOGUE.fareDone);
        G.audio.jingle();
        this.fare = null;
        this.beacon.material.color.setHex(BEACON_YELLOW);
        G.saveGame();
      }
    }
  }
}
