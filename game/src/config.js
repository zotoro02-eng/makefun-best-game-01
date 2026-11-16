// Lumen Harvest — tuning constants. Every number that shapes how the game
// feels lives here, so balancing is one file, not a hunt through the code.

export const VIEW = { width: 1280, height: 720 };

// The playfield is the whole view with a soft margin the player cannot cross.
export const ARENA = { left: 24, top: 84, right: 1256, bottom: 696 };

export const PLAYER = {
  radius: 15,
  speed: 265, // px per second
  fireInterval: 0.14, // seconds between shots
  bulletSpeed: 560,
  bulletRadius: 5,
  maxHull: 3,
  dashSpeed: 720,
  dashTime: 0.16, // seconds the dash burst lasts
  dashCooldown: 1.5, // seconds before the next dash
  dashInvuln: 0.34, // seconds of invulnerability a dash grants
  hurtInvuln: 1.3, // seconds of invulnerability after taking a hit
  magnetRadius: 110, // motes inside this drift toward the ship
  collectRadius: 30, // motes inside this are collected
};

export const MOTES = {
  spawnInterval: 1.15, // seconds between mote spawns
  maxOnField: 11,
  lifetime: 14, // seconds before a mote fades away
  baseValue: 10,
};

// Combo: every collect or kill inside the window adds one to the combo.
// The multiplier grows one step per 5 combo, up to x8.
export const COMBO = { window: 2.6, step: 5, maxMultiplier: 8 };

export const ENEMIES = {
  drifter: { hp: 1, speed: 62, radius: 17, score: 50, touch: 1 },
  darter: { hp: 1, speed: 150, radius: 13, score: 80, touch: 1 },
  spitter: { hp: 2, speed: 52, radius: 18, score: 120, touch: 1 },
  boss: { hp: 70, speed: 42, radius: 52, score: 2000, touch: 1 },
};

export const SPITTER = { shotInterval: 2.4, shotSpeed: 150, shotRadius: 7 };
export const BOSS = { burstInterval: 3.2, burstCount: 12, escortInterval: 6 };

// Waves 1..8. Each wave's spawn list is built from these counts; wave 8 is
// the boss wave (the Gloom Maw plus escorts). Clearing wave 8 wins the game.
export const FINAL_WAVE = 8;
export const WAVE_BONUS = 250; // score for clearing a wave

// Pickups drop from slain enemies: shield 12%, heart 7%, overcharge 10%.
// A heart only heals when the hull is not already full.
export const PICKUP_DROP = { shield: 0.12, heart: 0.07, overcharge: 0.1 };
export const OVERCHARGE_TIME = 8; // seconds of doubled fire rate

// How long the between-wave breather and the wave banner last.
export const BETWEEN_WAVES = 2.6;
export const BANNER_TIME = 2.2;

// Juice: screen shake trauma added by events, decaying every frame.
export const SHAKE = { hit: 0.55, kill: 0.16, bossKill: 1.0, dash: 0.08 };

export const PALETTE = {
  background: '#0a0e1a',
  backgroundEdge: '#05070f',
  grid: 'rgba(120, 160, 255, 0.05)',
  mote: '#ffd76a',
  moteCore: '#fff3c4',
  player: '#7fe7ff',
  playerCore: '#e8fbff',
  bullet: '#aef3ff',
  drifter: '#b388ff',
  darter: '#ff7ab8',
  spitter: '#8dff9e',
  boss: '#ff5d5d',
  enemyShot: '#ff9d5c',
  shield: '#6ec6ff',
  heart: '#ff6b81',
  overcharge: '#ffe066',
  text: '#eaf2ff',
  textDim: '#9fb2d8',
  gold: '#ffd76a',
};
