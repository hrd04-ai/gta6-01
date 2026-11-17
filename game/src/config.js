// Palmera Bay — world constants, tuning and mission data.
// One source of truth for every system: city layout, vehicles, police, economy.
export const CFG = {
  // City layout: 7 roads each way, 44 units apart; blocks sit between roads.
  roadSpacing: 44,
  roadHalf: 7,
  roadCount: 7,
  blockSize: 30,
  worldHalf: 176,
  // Bay (south, +z) and harbor (east, +x).
  bayEdge: 154,
  harborEdge: 154,
  // Driving.
  carTopSpeed: 42, // units/s ~ 150 km/h at our scale
  carAccel: 26,
  carBrake: 46,
  carReverseSpeed: 14,
  carTurn: 1.9,
  carGrip: 6.5,
  trafficCount: 16,
  parkedCount: 14,
  pedCount: 26,
  // On foot.
  walkSpeed: 6,
  sprintSpeed: 10,
  punchRange: 2.4,
  punchDamage: 34,
  pistolDamage: 34,
  pistolMag: 12,
  pistolRange: 90,
  // Police.
  maxWanted: 5,
  heatDecay: 0.045, // wanted heat lost per second while clean
  bustRange: 2.2,
  copRunSpeed: 7.2,
  // Economy.
  repairCost: 80,
  cleanCost: 200,
  fareReward: 45,
  startCash: 120,
  // Missions.
  missionReward: [250, 400, 650, 900, 5000],
  harborRunTime: 75,
  heatWaveTime: 60,
  // Visuals.
  sunColor: 0xffe3b3,
  skyTop: 0x7fb4e8,
  skyBottom: 0xffd9a0,
  fogColor: 0xf2c98f,
  fogNear: 120,
  fogFar: 520,
  // Screenshots.
  shotSeed: 7,
};

export const DISTRICTS = [
  { name: 'Marina Row', color: 0x2e6f8e },
  { name: 'Old Town', color: 0x8e6f2e },
  { name: 'Downtown', color: 0x5a5f6e },
  { name: 'Harbor East', color: 0x6e3a2e },
  { name: 'Palms North', color: 0x2e8e5a },
];

// Mission script: name, Mara's briefing, objective text, reward.
export const MISSIONS = [
  {
    name: 'Hot Wheels',
    brief: 'Mara: Rico, you need wheels. Any car on the street is yours — walk up and take it.',
    objective: 'Steal a car',
    reward: 250,
  },
  {
    name: 'Alley Pickup',
    brief: 'Mara: A package is waiting in the alley behind the Old Town market. Drive over and grab it.',
    objective: 'Pick up the package in the alley',
    reward: 400,
  },
  {
    name: 'Harbor Run',
    brief: 'Mara: The buyer is at the east harbor and he does not wait. 75 seconds, Rico. Go!',
    objective: 'Reach the harbor beacon in time',
    reward: 650,
  },
  {
    name: 'Heat Wave',
    brief: 'Mara: Cops are all over you. Lose them or outlast them — survive 60 seconds at 3 stars.',
    objective: 'Survive 60 seconds at 3 stars',
    reward: 900,
  },
  {
    name: 'Bay Bank Job',
    brief: 'Mara: The big one. Bay Bank, three guards, one vault. Take the $5,000 and get out clean.',
    objective: 'Clear the bank guards and take the cash',
    reward: 5000,
  },
];

export const DIALOGUE = {
  missionDone: [
    'Mara: Clean work, Rico. Payment is in your pocket.',
    'Mara: You drive like the bay is on fire. I like it.',
    'Mara: Another one down. Palmera Bay is ours, little by little.',
  ],
  busted: 'The Palmera Bay PD has you. Bail posted — but it cost you.',
  wasted: 'Rico is down. The bay keeps moving without him.',
  fareDone: 'Passenger: Keep the change, kid. You drive alright.',
  garageRepair: 'Mechanic: Patched up. Good as new — well, almost.',
  garageClean: 'Fixer: Your plates are clean. The cops lost the scent.',
};

export const CAR_COLORS = [
  0xc22e2e, 0x2e5ec2, 0xd8b13a, 0x2ea36b, 0x7a3ec2,
  0xd86a1e, 0x222831, 0xe8e8e8, 0x1e9e9e, 0x8e2e5a,
];

export const PED_SHIRTS = [
  0xd95f4b, 0x4b8fd9, 0x7ed957, 0xe8c84b, 0xb06ad9,
  0xeeeeee, 0x333a44, 0xd94b8f, 0x4bd9c0, 0xe07b39,
];
