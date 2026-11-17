// Palmera Bay: Sunset Heat — tuning, palettes and world constants.
// Every number that shapes how the city feels lives here, so the rest of
// the game can stay readable.

export const CONFIG = {
  title: 'PALMERA BAY',
  subtitle: 'SUNSET HEAT',
  seed: 20261117,

  world: {
    // Road centre lines, metres. 7 avenues x 7 streets, block pitch 46.
    lines: [-138, -92, -46, 0, 46, 92, 138],
    roadWidth: 12,
    blockPitch: 46,
    groundSize: 360, // ground plane covers -180..180
    waterZ: 158, // south edge: the bay begins here
    harborX: 158, // east edge: the container harbor begins here
  },

  sun: {
    // Golden hour: low warm sun from the west, long shadows.
    azimuthDeg: 245,
    elevationDeg: 22,
    color: 0xffb066,
    intensity: 2.6,
    skyTop: 0x7fb2e5,
    skyHorizon: 0xffc98a,
    fogColor: 0xf2b98a,
    fogNear: 120,
    fogFar: 420,
  },

  player: {
    walkSpeed: 5.2,
    runSpeed: 9.0,
    accel: 42,
    friction: 26,
    radius: 0.55,
    health: 100,
    punchDamage: 18,
    punchRange: 1.9,
    punchArcDeg: 70,
    pistolDamage: 34,
    pistolRange: 55,
    magSize: 12,
    reloadSeconds: 1.4,
    jumpSpeed: 7.5,
  },

  car: {
    accel: 16,
    brake: 30,
    reverseAccel: 10,
    maxSpeed: 34, // ~122 km/h
    maxReverse: 9,
    steerMax: 0.55,
    grip: 6.5,
    handbrakeGrip: 2.2,
    drag: 0.35,
    radius: 2.2,
    health: 100,
    enterRange: 3.4,
  },

  traffic: {
    count: 16,
    speedMin: 7,
    speedMax: 11.5,
    followGap: 9,
    lightStopDistance: 7,
  },

  pedestrians: {
    count: 26,
    walkSpeedMin: 1.1,
    walkSpeedMax: 1.9,
    fleeSpeed: 4.2,
  },

  police: {
    maxCars: 4,
    maxCops: 5,
    chaseSpeed: 30,
    ramDamage: 6,
    bustSeconds: 2.2,
    loseDistance: 95,
    decaySeconds: 7,
    spawnDistance: 70,
  },

  wanted: {
    // Heat points per crime; stars are heat thresholds.
    stealCar: 25,
    hitPedestrian: 30,
    hitCop: 40,
    shoot: 20,
    speedingNearCop: 8,
    starThresholds: [0, 25, 60, 110, 175, 260],
  },

  money: {
    startCash: 150,
    bustFine: 0.15, // fraction of cash lost when busted
    garageRepair: 80,
    garageClean: 200,
    fareMin: 60,
    fareMax: 160,
  },

  palette: {
    building: [
      0xe8d8c0, 0xd9b48f, 0xc98d6b, 0x9fb8c8, 0x7fa8b8,
      0xe5c9a8, 0xb8c4a8, 0xd98a7a, 0x8fa8c8, 0xf0e0c8,
    ],
    glass: [0x5a7a94, 0x6a8aa4, 0x4a6a84, 0x7a9ab4],
    car: [
      0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0xecf0f1,
      0x2c3e50, 0xe67e22, 0x8e44ad, 0x16a085, 0xbdc3c7,
    ],
    pedShirt: [
      0xe74c3c, 0x3498db, 0xf39c12, 0x2ecc71, 0x9b59b6,
      0x1abc9c, 0xfd79a8, 0xffeaa7, 0x74b9ff, 0xff7675,
    ],
    palmTrunk: 0x8a6a4a,
    palmLeaf: 0x3f9e4d,
  },

  districts: [
    'Old Marina', 'Canal Row', 'Palm Court', 'The Strip', 'Little Havana',
    'Harbor East', 'Sunset Plaza', 'Coral Quarter', 'Bayview', 'Downtown',
  ],
};

// Named places the story and the HUD point at. Positions are world metres.
// Block centres sit on the 46 m grid (lines at -138..138); roads run along
// the lines, so these points are block centres or waterfront markers.
export const PLACES = {
  spawn: { x: 0, z: -110, label: 'Sunset Marina' },
  marina: { x: 0, z: 150, label: 'Sunset Marina' },
  alley: { x: -23, z: 23, label: 'Canal Row Alley' },
  drop: { x: 23, z: 115, label: 'The Drop' },
  harbor: { x: 152, z: 0, label: 'Harbor East' },
  bank: { x: 23, z: -23, label: 'Palmera Trust Bank' },
  safehouse: { x: -69, z: 69, label: 'Safehouse' },
  garage: { x: 69, z: 23, label: 'Spray & Save' },
  policeStation: { x: -23, z: -69, label: 'PBPD Station' },
  hospital: { x: 69, z: -69, label: 'St. Coral Hospital' },
  plaza: { x: 23, z: 23, label: 'Sunset Plaza' },
};
