// Palmera Bay: Sunset Heat — tuning, palette and shared constants.
// Every number the rest of the game balances against lives here so a
// single edit re-tunes driving, police, missions and the economy together.

export const WORLD = {
  width: 3600,
  height: 2800,
  block: 420, // distance between road centre lines
  roadWidth: 92,
  beachY: 2440, // everything south of this line is sand and sea
  seaY: 2620,
};

export const PALETTE = {
  skyTop: '#2b1d5e',
  skyMid: '#b8457c',
  skyLow: '#ff9a5c',
  sunCore: '#ffd166',
  sunGlow: '#ff7b54',
  asphalt: '#2e2a33',
  asphaltEdge: '#4a4450',
  laneDash: '#e8d27a',
  sidewalk: '#8a7f8d',
  grass: '#3f7d4e',
  sand: '#e8c98a',
  sea: '#1d6f8e',
  seaDeep: '#155a75',
  buildingRoof: '#6b4a5e',
  buildingRoof2: '#7d5a6b',
  buildingRoof3: '#4f3d5a',
  neonPink: '#ff5da2',
  neonCyan: '#37e0d8',
  neonGold: '#ffc857',
  hudBg: 'rgba(12, 8, 24, 0.72)',
  hudText: '#fff3e0',
  hudAccent: '#ffb347',
};

export const PLAYER = {
  walkSpeed: 205,
  runSpeed: 305,
  radius: 13,
  maxHealth: 100,
  pistolDamage: 34,
  pistolRange: 460,
  pistolRate: 0.22, // seconds between shots
  pistolAmmoMax: 48,
  punchDamage: 12,
  punchRange: 34,
};

export const CAR = {
  accel: 430,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steerRate: 2.9,
  grip: 3.4,
  drag: 0.55,
  radius: 26,
  stealTime: 0.9, // seconds holding E beside a parked car
};

export const TRAFFIC = {
  count: 22,
  cruiseSpeed: 150,
  cruiseSpeedFast: 210,
  spawnMargin: 700,
};

export const PEDS = {
  count: 42,
  walkSpeed: 46,
  fleeSpeed: 165,
};

export const POLICE = {
  maxStars: 5,
  decayDelay: 9, // seconds unseen before a star decays
  spawnInterval: [2.6, 2.1, 1.7, 1.4, 1.1], // per star level
  maxUnits: [0, 2, 4, 6, 8, 10],
  pursuitSpeed: 520,
  ramDamage: 9,
  bustRadius: 30,
  bustTime: 2.2, // seconds pinned beside the player on foot to bust
  sightRange: 640,
};

export const MISSIONS = [
  {
    id: 'sunset-pickup',
    name: 'Sunset Pickup',
    giver: 'Vera Solano',
    brief: 'Vera needs a package moved from her garage to the pier before the tide turns. Drive there, grab it, bring it back to the water.',
    payout: 400,
    steps: [
      { kind: 'goto', label: 'Drive to Vera\u2019s garage', x: 630, y: 630 },
      { kind: 'pickup', label: 'Pick up the package', x: 630, y: 630 },
      { kind: 'goto', label: 'Deliver to the old pier', x: 3300, y: 2520 },
    ],
  },
  {
    id: 'hot-wheels',
    name: 'Hot Wheels',
    giver: 'Vera Solano',
    brief: 'A Sunset GT is parked on Marina Row. Take it. The owner will call the cops, so bring it to the chop shop fast.',
    payout: 900,
    steps: [
      { kind: 'steal', label: 'Steal the Sunset GT on Marina Row', x: 1470, y: 1050 },
      { kind: 'deliver-car', label: 'Deliver the GT to the chop shop', x: 2730, y: 1890 },
    ],
  },
  {
    id: 'beach-run',
    name: 'Beach Run',
    giver: 'Tommy Waves',
    brief: 'Three tourists are waiting along the boardwalk and the sunset tour leaves in four minutes. Collect them all, then drop them at the lighthouse.',
    payout: 750,
    timeLimit: 240,
    steps: [
      { kind: 'pickup', label: 'Pick up tourist 1 — boardwalk', x: 1050, y: 2520 },
      { kind: 'pickup', label: 'Pick up tourist 2 — surf shack', x: 1890, y: 2520 },
      { kind: 'pickup', label: 'Pick up tourist 3 — pier cafe', x: 2730, y: 2520 },
      { kind: 'goto', label: 'Drop them at the lighthouse', x: 3400, y: 2350 },
    ],
  },
  {
    id: 'heat-wave',
    name: 'Heat Wave',
    giver: 'Vera Solano',
    brief: 'The heat is on. Shake a three-star tail, then run the package across town to the north gate. No shortcuts through the cops.',
    payout: 1400,
    steps: [
      { kind: 'evade', label: 'Lose the cops — drop to zero stars', x: 0, y: 0 },
      { kind: 'goto', label: 'Deliver the package to the north gate', x: 1890, y: 210 },
    ],
  },
  {
    id: 'the-big-score',
    name: 'The Big Score',
    giver: 'Vera Solano',
    brief: 'One job, one night: hit the Bay Bank on Coral Avenue, grab the cash, and vanish to the safehouse while the whole city chases you.',
    payout: 3500,
    steps: [
      { kind: 'goto', label: 'Reach the Bay Bank', x: 2310, y: 1050 },
      { kind: 'rob', label: 'Hold up the bank — stay inside the vault ring', x: 2310, y: 1050 },
      { kind: 'goto', label: 'Escape to the safehouse', x: 420, y: 2100 },
    ],
  },
];

export const ECONOMY = {
  startCash: 120,
  pedHitFine: 0,
  carTheftStars: 1,
  pedHitStars: 1,
  shootStars: 2,
  killCopStars: 2,
  hospitalFee: 150,
  impoundFee: 0,
};

export const SAVE_KEY = 'palmera-bay-sunset-heat-save-v1';
