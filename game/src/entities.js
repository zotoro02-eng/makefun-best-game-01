// Lumen Harvest — entity factories and per-entity updates. An entity is a
// plain object; the world owns the arrays and the rules, this file owns
// what each thing is and how it moves.

import { ARENA, BOSS, ENEMIES, PLAYER, SPITTER } from './config.js';

// ---------------------------------------------------------------- player

export function createPlayer(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    angle: -Math.PI / 2, // aim direction, from the mouse
    radius: PLAYER.radius,
    hull: PLAYER.maxHull,
    shield: false,
    overchargeUntil: 0,
    fireTimer: 0,
    dashTimer: 0, // >0 while the dash burst is active
    dashCooldown: 0,
    invulnUntil: 0,
    alive: true,
  };
}

// ---------------------------------------------------------------- enemies

export function createEnemy(kind, x, y, rng) {
  const spec = ENEMIES[kind];
  const base = {
    kind, x, y,
    vx: 0, vy: 0,
    hp: spec.hp,
    maxHp: spec.hp,
    radius: spec.radius,
    speed: spec.speed,
    score: spec.score,
    angle: 0,
    wobble: rng() * Math.PI * 2, // phase for the drift wobble
    shootTimer: kind === 'spitter' ? 1.2 + rng() * 1.2 : 0,
    lungeTimer: kind === 'darter' ? 1 + rng() : 0,
    lunging: 0,
    flash: 0, // white hit-flash timer
    spawnAge: 0, // scales in over 0.35 s so spawns never pop in
  };
  if (kind === 'boss') {
    base.burstTimer = 2;
    base.escortTimer = 4;
    base.phase = 1;
  }
  return base;
}

function chase(enemy, target, speed, dt) {
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  enemy.vx = (dx / dist) * speed;
  enemy.vy = (dy / dist) * speed;
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.angle = Math.atan2(dy, dx);
}

// Drifter: slow chase with a sideways sine wobble.
// Darter: stalks, then lunges in a straight line.
// Spitter: keeps its distance and fires.
// Boss: slow chase, radial bursts, calls escorts.
export function updateEnemy(enemy, player, dt, time, fireEnemyShot) {
  enemy.spawnAge += dt;
  enemy.flash = Math.max(0, enemy.flash - dt);
  const scale = Math.min(1, enemy.spawnAge / 0.35);
  if (enemy.kind === 'drifter') {
    const wobble = Math.sin(time * 2.2 + enemy.wobble) * 46;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const px = -dy / dist;
    const py = dx / dist;
    enemy.x += ((dx / dist) * enemy.speed + px * wobble * 0.4) * dt * scale;
    enemy.y += ((dy / dist) * enemy.speed + py * wobble * 0.4) * dt * scale;
    enemy.angle = Math.atan2(dy, dx);
  } else if (enemy.kind === 'darter') {
    enemy.lungeTimer -= dt;
    if (enemy.lunging > 0) {
      enemy.lunging -= dt;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
    } else if (enemy.lungeTimer <= 0) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      enemy.vx = (dx / dist) * 330;
      enemy.vy = (dy / dist) * 330;
      enemy.angle = Math.atan2(dy, dx);
      enemy.lunging = 0.42;
      enemy.lungeTimer = 1.6 + Math.random() * 0.9;
    } else {
      chase(enemy, player, enemy.speed, dt);
    }
  } else if (enemy.kind === 'spitter') {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Drift toward a comfortable firing range of ~300 px.
    const want = dist > 330 ? 1 : dist < 240 ? -1 : 0;
    enemy.x += ((dx / dist) * enemy.speed * want) * dt * scale;
    enemy.y += ((dy / dist) * enemy.speed * want) * dt * scale;
    enemy.angle = Math.atan2(dy, dx);
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && dist < 560) {
      enemy.shootTimer = SPITTER.shotInterval;
      fireEnemyShot(enemy.x, enemy.y, Math.atan2(dy, dx));
    }
  } else if (enemy.kind === 'boss') {
    chase(enemy, player, enemy.speed, dt * scale);
    if (enemy.hp <= enemy.maxHp * 0.5 && enemy.phase === 1) {
      enemy.phase = 2;
      enemy.speed = 62;
    }
    enemy.burstTimer -= dt;
    if (enemy.burstTimer <= 0) {
      enemy.burstTimer = BOSS.burstInterval;
      fireEnemyShot(enemy.x, enemy.y, 'radial', BOSS.burstCount);
    }
    enemy.escortTimer -= dt;
  }
  // Enemies never leave the arena by more than a little.
  enemy.x = Math.max(ARENA.left - 60, Math.min(ARENA.right + 60, enemy.x));
  enemy.y = Math.max(ARENA.top - 60, Math.min(ARENA.bottom + 60, enemy.y));
}

// ---------------------------------------------------------------- bullets

export function createBullet(x, y, angle, speed) {
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: PLAYER.bulletRadius,
    life: 1.1, // seconds before it fades mid-flight
    friendly: true,
  };
}

export function createEnemyShot(x, y, angle, speed = SPITTER.shotSpeed) {
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: SPITTER.shotRadius,
    life: 6,
    friendly: false,
  };
}

export function updateBullet(bullet, dt) {
  bullet.x += bullet.vx * dt;
  bullet.y += bullet.vy * dt;
  bullet.life -= dt;
}

// ---------------------------------------------------------------- motes

export function createMote(x, y, rng) {
  return {
    x, y,
    vx: (rng() - 0.5) * 24,
    vy: (rng() - 0.5) * 24,
    radius: 9,
    age: 0,
    lifetime: 14,
    phase: rng() * Math.PI * 2,
  };
}

export function updateMote(mote, player, dt, time) {
  mote.age += dt;
  const dx = player.x - mote.x;
  const dy = player.y - mote.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (dist < PLAYER.magnetRadius) {
    // Magnet: pulled toward the ship, faster the closer it gets.
    const pull = 420 * (1 - dist / PLAYER.magnetRadius) + 60;
    mote.vx += (dx / dist) * pull * dt;
    mote.vy += (dy / dist) * pull * dt;
  }
  mote.vx *= 1 - 1.4 * dt;
  mote.vy *= 1 - 1.4 * dt;
  mote.x += mote.vx * dt + Math.sin(time * 1.7 + mote.phase) * 6 * dt;
  mote.y += mote.vy * dt + Math.cos(time * 1.3 + mote.phase) * 6 * dt;
}

// ---------------------------------------------------------------- pickups

export function createPickup(kind, x, y) {
  return { kind, x, y, radius: 14, age: 0, lifetime: 10 };
}

export function updatePickup(pickup, dt) {
  pickup.age += dt;
  pickup.y += Math.sin(pickup.age * 3) * 8 * dt;
}
