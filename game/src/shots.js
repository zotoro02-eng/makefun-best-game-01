// Lumen Harvest — deterministic screenshot scenes. With ?shot=<scene> in
// the URL the game builds one fixed scene from a seeded generator, renders
// it, and sets window.__shotReady so a screenshot tool knows the frame is
// done. No wall clock, no input: the same scene renders the same pixels
// every time. Scenes: title, play, victory, gameover.

import { ARENA, FINAL_WAVE } from './config.js';
import { createRng, innerPoint } from './random.js';
import { createEnemy, createMote, createPickup } from './entities.js';

const SEED = 20261116;

function scatterMotes(world, count) {
  for (let i = 0; i < count; i++) {
    const p = innerPoint(world.rng, ARENA, world.player, 120);
    world.motes.push(createMote(p.x, p.y, world.rng));
  }
}

function scatterEnemies(world, plan) {
  for (const [kind, count] of Object.entries(plan)) {
    for (let i = 0; i < count; i++) {
      const p = innerPoint(world.rng, ARENA, world.player, 220);
      const enemy = createEnemy(kind, p.x, p.y, world.rng);
      enemy.spawnAge = 1; // fully scaled in
      world.enemies.push(enemy);
    }
  }
}

// One simulated tick of the world with a frozen input (no movement, no
// firing): lets motes drift, enemies settle and particles bloom so the
// scene reads as a game in progress, not a still life.
function idleTick(world, dt, steps) {
  const frozen = {
    moveVector: () => ({ x: 0, y: 0 }),
    mouse: { x: world.player.x, y: world.player.y - 120 },
    firing: false,
    dashQueued: false,
  };
  for (let i = 0; i < steps; i++) {
    world.time += dt;
    world.updatePlaying(dt, frozen);
  }
}

export function applyShotScene(world, scene) {
  world.rng = createRng(SEED);
  const player = world.player;
  player.x = (ARENA.left + ARENA.right) / 2;
  player.y = (ARENA.top + ARENA.bottom) / 2 + 40;

  if (scene === 'title') {
    world.state = 'title';
    scatterMotes(world, 8);
    return;
  }

  if (scene === 'play') {
    world.state = 'playing';
    world.wave = 4;
    world.score = 2840;
    world.combo = 12;
    world.comboTimer = 2.0;
    world.best = 5200;
    world.banner = 'WAVE 4';
    world.bannerTimer = 1.2;
    scatterMotes(world, 9);
    scatterEnemies(world, { drifter: 4, darter: 2, spitter: 2 });
    world.pickups.push(createPickup('shield', player.x - 150, player.y + 90));
    world.pickups.push(createPickup('heart', player.x + 180, player.y - 60));
    // A few player bullets mid-flight, aimed up-right.
    const rng = createRng(SEED + 7);
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 3 + (rng() - 0.5) * 0.3;
      world.bullets.push({
        x: player.x + Math.cos(a) * (60 + i * 55),
        y: player.y + Math.sin(a) * (60 + i * 55),
        vx: Math.cos(a) * 560,
        vy: Math.sin(a) * 560,
        radius: 5,
        life: 1,
        friendly: true,
      });
    }
    world.particles.burst(player.x + 120, player.y - 80, { count: 14, color: '#b388ff', speed: 180 });
    idleTick(world, 1 / 60, 45);
    return;
  }

  if (scene === 'victory') {
    world.state = 'victory';
    world.wave = FINAL_WAVE;
    world.score = 12480;
    world.best = 12480;
    world.newBest = true;
    world.victoryStats = {
      score: 12480,
      time: 386,
      kills: 74,
      motes: 58,
      accuracy: 71,
    };
    scatterMotes(world, 10);
    world.particles.burst(player.x, player.y - 60, { count: 50, color: '#ffd76a', speed: 320, size: 4, life: 1 });
    world.particles.burst(player.x - 200, player.y + 40, { count: 30, color: '#7fe7ff', speed: 260, size: 4, life: 1 });
    return;
  }

  if (scene === 'gameover') {
    world.state = 'gameover';
    world.wave = 6;
    world.score = 7310;
    world.best = 9200;
    world.newBest = false;
    world.player.alive = false;
    world.gameOverStats = {
      score: 7310,
      wave: 6,
      kills: 51,
      motes: 34,
      accuracy: 64,
    };
    scatterMotes(world, 6);
    scatterEnemies(world, { drifter: 3, darter: 2 });
    world.particles.burst(player.x, player.y, { count: 40, color: '#7fe7ff', speed: 280, size: 4, life: 1 });
    return;
  }

  // Unknown scene: fall back to the title.
  world.state = 'title';
  scatterMotes(world, 8);
}
