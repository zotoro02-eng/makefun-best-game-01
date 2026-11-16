// Lumen Harvest — the game itself: state machine, waves, spawning,
// collisions, scoring and the combo. Rendering lives in render.js; this
// file owns what happens, never what it looks like.
//
// States: title -> playing -> victory | gameover, with paused over playing.
// The loop: collect light motes and blast gloom mites to build a combo and
// a score; clear waves 1..7, then defeat the Gloom Maw on wave 8 to win.
// Lose all 3 hull and the run ends.

import {
  ARENA, BETWEEN_WAVES, BANNER_TIME, BOSS, COMBO, FINAL_WAVE,
  MOTES, OVERCHARGE_TIME, PICKUP_DROP, PLAYER, SHAKE, WAVE_BONUS,
} from './config.js';
import { createRng, edgePoint, innerPoint, pick } from './random.js';
import {
  createBullet, createEnemy, createEnemyShot, createMote, createPickup,
  createPlayer, updateBullet, updateEnemy, updateMote, updatePickup,
} from './entities.js';

export const BEST_KEY = 'lumen-harvest-best';

export function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(score) {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Storage unavailable (private mode, sandbox): the run still counts.
  }
}

// Wave composition: how many of each mite a wave spawns. Wave 8 is the
// boss wave and is built separately.
function wavePlan(wave) {
  return {
    drifter: 3 + wave,
    darter: wave >= 2 ? Math.floor(wave / 2) + 1 : 0,
    spitter: wave >= 3 ? Math.floor((wave - 1) / 2) : 0,
  };
}

export class World {
  constructor(sound, particles) {
    this.sound = sound;
    this.particles = particles;
    this.rng = createRng((Date.now() ^ 0x9e3779b9) >>> 0);
    this.state = 'title'; // title | playing | paused | victory | gameover
    this.time = 0; // seconds since the run started (playing only)
    this.best = loadBest();
    this.resetRun();
  }

  resetRun() {
    const cx = (ARENA.left + ARENA.right) / 2;
    const cy = (ARENA.top + ARENA.bottom) / 2;
    this.player = createPlayer(cx, cy);
    this.enemies = [];
    this.bullets = [];
    this.enemyShots = [];
    this.motes = [];
    this.pickups = [];
    this.score = 0;
    this.kills = 0;
    this.motesCollected = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.wave = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.moteTimer = 0.6;
    this.betweenTimer = 0;
    this.waitingBetween = false; // true while the breather runs between waves
    this.banner = '';
    this.bannerTimer = 0;
    this.bossSpawned = false;
    this.boss = null;
    this.victoryStats = null;
    this.gameOverStats = null;
    this.newBest = false;
    this.particles.clear();
  }

  startRun(seed) {
    if (seed !== undefined) this.rng = createRng(seed);
    this.resetRun();
    this.state = 'playing';
    this.nextWave();
  }

  nextWave() {
    this.wave += 1;
    this.spawnQueue = [];
    if (this.wave === FINAL_WAVE) {
      this.bossSpawned = true;
      const p = edgePoint(this.rng, ARENA, 70);
      this.boss = createEnemy('boss', p.x, p.y, this.rng);
      this.enemies.push(this.boss);
      this.banner = 'WAVE 8 — THE GLOOM MAW';
      this.sound.bossRoar();
    } else {
      const plan = wavePlan(this.wave);
      for (const [kind, count] of Object.entries(plan)) {
        for (let i = 0; i < count; i++) this.spawnQueue.push(kind);
      }
      // Shuffle the queue so the wave never arrives in kind order.
      for (let i = this.spawnQueue.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
      }
      this.banner = `WAVE ${this.wave}`;
      this.sound.waveHorn();
    }
    this.bannerTimer = BANNER_TIME;
    this.spawnTimer = 0.4;
  }

  addScore(base, x, y, label) {
    const multiplier = Math.min(1 + Math.floor(this.combo / COMBO.step), COMBO.maxMultiplier);
    const gained = base * multiplier;
    this.score += gained;
    if (x !== undefined) {
      this.particles.floatText(x, y, `+${gained}`, multiplier > 1 ? '#ffd76a' : '#eaf2ff', multiplier > 1 ? 20 : 16);
      if (label) this.particles.floatText(x, y + 22, label, '#9fb2d8', 13);
    }
    return gained;
  }

  bumpCombo() {
    this.combo += 1;
    this.comboTimer = COMBO.window;
  }

  spawnMote() {
    const p = innerPoint(this.rng, ARENA, this.player, 160);
    this.motes.push(createMote(p.x, p.y, this.rng));
  }

  maybeDropPickup(x, y) {
    const roll = this.rng();
    if (roll < PICKUP_DROP.shield) this.pickups.push(createPickup('shield', x, y));
    else if (roll < PICKUP_DROP.shield + PICKUP_DROP.heart) this.pickups.push(createPickup('heart', x, y));
    else if (roll < PICKUP_DROP.shield + PICKUP_DROP.heart + PICKUP_DROP.overcharge) {
      this.pickups.push(createPickup('overcharge', x, y));
    }
  }

  killEnemy(enemy, index) {
    this.enemies.splice(index, 1);
    this.kills += 1;
    this.bumpCombo();
    const isBoss = enemy.kind === 'boss';
    this.addScore(enemy.score, enemy.x, enemy.y, isBoss ? 'THE GLOOM MAW FALLS' : null);
    const color = enemy.kind === 'drifter' ? '#b388ff' : enemy.kind === 'darter' ? '#ff7ab8' : enemy.kind === 'spitter' ? '#8dff9e' : '#ff5d5d';
    this.particles.burst(enemy.x, enemy.y, { count: isBoss ? 60 : 18, color, speed: isBoss ? 320 : 200, size: 4 });
    this.particles.ring(enemy.x, enemy.y, color, isBoss ? 120 : 46);
    this.particles.addShake(isBoss ? SHAKE.bossKill : SHAKE.kill);
    this.sound.enemyPop();
    if (!isBoss) this.maybeDropPickup(enemy.x, enemy.y);
    if (isBoss) this.winRun();
  }

  hurtPlayer() {
    const now = this.time;
    if (now < this.player.invulnUntil) return;
    if (this.player.shield) {
      this.player.shield = false;
      this.player.invulnUntil = now + 1;
      this.particles.ring(this.player.x, this.player.y, '#6ec6ff', 60);
      this.particles.burst(this.player.x, this.player.y, { count: 16, color: '#6ec6ff', speed: 220 });
      this.particles.floatText(this.player.x, this.player.y - 34, 'SHIELD!', '#6ec6ff', 18);
      this.sound.pickup();
      return;
    }
    this.player.hull -= 1;
    this.player.invulnUntil = now + PLAYER.hurtInvuln;
    this.combo = 0;
    this.comboTimer = 0;
    this.particles.burst(this.player.x, this.player.y, { count: 26, color: '#ff6b81', speed: 260 });
    this.particles.addShake(SHAKE.hit);
    this.sound.hurt();
    if (this.player.hull <= 0) this.loseRun();
  }

  winRun() {
    this.state = 'victory';
    this.score += WAVE_BONUS;
    const finalScore = this.score;
    this.newBest = finalScore > this.best;
    if (this.newBest) {
      this.best = finalScore;
      saveBest(finalScore);
    }
    this.victoryStats = {
      score: finalScore,
      time: this.time,
      kills: this.kills,
      motes: this.motesCollected,
      accuracy: this.shotsFired === 0 ? 100 : Math.round((this.shotsHit / this.shotsFired) * 100),
    };
    this.sound.victory();
    this.particles.burst(this.player.x, this.player.y, { count: 80, color: '#ffd76a', speed: 360, size: 4, life: 1 });
  }

  loseRun() {
    this.state = 'gameover';
    this.player.alive = false;
    const finalScore = this.score;
    this.newBest = finalScore > this.best;
    if (this.newBest) {
      this.best = finalScore;
      saveBest(finalScore);
    }
    this.gameOverStats = {
      score: finalScore,
      wave: this.wave,
      kills: this.kills,
      motes: this.motesCollected,
      accuracy: this.shotsFired === 0 ? 100 : Math.round((this.shotsHit / this.shotsFired) * 100),
    };
    this.particles.burst(this.player.x, this.player.y, { count: 60, color: '#7fe7ff', speed: 300, size: 4, life: 1 });
    this.sound.gameOver();
  }

  fireEnemyShot(x, y, angleOrRadial, count) {
    if (angleOrRadial === 'radial') {
      const n = count ?? BOSS.burstCount;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + this.rng() * 0.2;
        this.enemyShots.push(createEnemyShot(x, y, a, 130));
      }
      this.sound.tone({ type: 'sawtooth', from: 220, to: 90, duration: 0.25, volume: 0.1 });
    } else {
      this.enemyShots.push(createEnemyShot(x, y, angleOrRadial));
    }
  }

  updatePlaying(dt, input) {
    this.time += dt;
    const player = this.player;
    const now = this.time;

    // --- combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // --- movement
    const move = input.moveVector();
    const dashing = player.dashTimer > 0;
    const speed = dashing ? PLAYER.dashSpeed : PLAYER.speed;
    player.vx = move.x * speed;
    player.vy = move.y * speed;
    player.x = Math.max(ARENA.left, Math.min(ARENA.right, player.x + player.vx * dt));
    player.y = Math.max(ARENA.top, Math.min(ARENA.bottom, player.y + player.vy * dt));
    player.angle = Math.atan2(input.mouse.y - player.y, input.mouse.x - player.x);
    if (dashing) {
      player.dashTimer -= dt;
      this.particles.trail(player.x, player.y, '#7fe7ff', 4);
    }
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);

    // --- dash
    if (input.dashQueued && player.dashCooldown <= 0 && (move.x !== 0 || move.y !== 0)) {
      player.dashTimer = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
      player.invulnUntil = Math.max(player.invulnUntil, now + PLAYER.dashInvuln);
      this.particles.addShake(SHAKE.dash);
      this.sound.dash();
    }

    // --- firing
    player.fireTimer -= dt;
    const interval = PLAYER.fireInterval * (now < player.overchargeUntil ? 0.5 : 1);
    if (input.firing && player.fireTimer <= 0) {
      player.fireTimer = interval;
      const spread = 0.05;
      const a = player.angle + (this.rng() - 0.5) * spread;
      const nx = player.x + Math.cos(player.angle) * 22;
      const ny = player.y + Math.sin(player.angle) * 22;
      this.bullets.push(createBullet(nx, ny, a, PLAYER.bulletSpeed));
      this.shotsFired += 1;
      this.particles.trail(nx, ny, '#aef3ff', 2);
      this.sound.shoot();
    }

    // --- wave spawning
    if (!this.waitingBetween && this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 0.55;
        const kind = this.spawnQueue.shift();
        const p = edgePoint(this.rng, ARENA);
        this.enemies.push(createEnemy(kind, p.x, p.y, this.rng));
      }
    }

    // --- mote spawning
    this.moteTimer -= dt;
    if (this.moteTimer <= 0 && this.motes.length < MOTES.maxOnField) {
      this.moteTimer = MOTES.spawnInterval;
      this.spawnMote();
    }

    // --- enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      updateEnemy(enemy, player, dt, now, (x, y, a, c) => this.fireEnemyShot(x, y, a, c));
      if (enemy.kind === 'boss' && enemy.escortTimer <= 0 && this.wave === FINAL_WAVE) {
        enemy.escortTimer = BOSS.escortInterval;
        const kind = pick(this.rng, ['drifter', 'darter']);
        const p = edgePoint(this.rng, ARENA);
        this.enemies.push(createEnemy(kind, p.x, p.y, this.rng));
      }
    }

    // --- bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      updateBullet(bullet, dt);
      if (bullet.life <= 0 || bullet.x < 0 || bullet.x > 1280 || bullet.y < 0 || bullet.y > 720) {
        this.bullets.splice(i, 1);
        continue;
      }
      let consumed = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        const r = bullet.radius + enemy.radius;
        if (dx * dx + dy * dy < r * r) {
          enemy.hp -= 1;
          enemy.flash = 0.12;
          this.shotsHit += 1;
          this.particles.sparkle(bullet.x, bullet.y, '#aef3ff');
          this.bullets.splice(i, 1);
          consumed = true;
          if (enemy.hp <= 0) this.killEnemy(enemy, j);
          break;
        }
      }
      if (consumed) continue;
    }

    // --- enemy shots
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const shot = this.enemyShots[i];
      updateBullet(shot, dt);
      if (shot.life <= 0 || shot.x < 0 || shot.x > 1280 || shot.y < 0 || shot.y > 720) {
        this.enemyShots.splice(i, 1);
        continue;
      }
      const dx = shot.x - player.x;
      const dy = shot.y - player.y;
      const r = shot.radius + player.radius - 4;
      if (dx * dx + dy * dy < r * r && this.state === 'playing') {
        this.enemyShots.splice(i, 1);
        this.hurtPlayer();
      }
    }

    // --- enemy touch damage
    if (this.state === 'playing') {
      for (const enemy of this.enemies) {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const r = enemy.radius + player.radius - 4;
        if (dx * dx + dy * dy < r * r) {
          this.hurtPlayer();
          break;
        }
      }
    }

    // --- motes
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const mote = this.motes[i];
      updateMote(mote, player, dt, now);
      mote.lifetime -= dt;
      const dx = mote.x - player.x;
      const dy = mote.y - player.y;
      if (dx * dx + dy * dy < PLAYER.collectRadius * PLAYER.collectRadius) {
        this.motes.splice(i, 1);
        this.motesCollected += 1;
        this.bumpCombo();
        this.addScore(MOTES.baseValue, mote.x, mote.y);
        this.particles.burst(mote.x, mote.y, { count: 8, color: '#ffd76a', speed: 120, size: 2.5 });
        this.sound.collect(this.combo);
      } else if (mote.lifetime <= 0) {
        this.motes.splice(i, 1);
      }
    }

    // --- pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      updatePickup(pickup, dt);
      const dx = pickup.x - player.x;
      const dy = pickup.y - player.y;
      const r = pickup.radius + player.radius;
      if (dx * dx + dy * dy < r * r) {
        this.pickups.splice(i, 1);
        if (pickup.kind === 'shield') {
          player.shield = true;
          this.particles.floatText(player.x, player.y - 34, 'SHIELD UP', '#6ec6ff', 18);
        } else if (pickup.kind === 'heart') {
          if (player.hull < PLAYER.maxHull) player.hull += 1;
          else this.addScore(100, player.x, player.y - 20, 'HULL FULL +100');
          this.particles.floatText(player.x, player.y - 34, '+1 HULL', '#ff6b81', 18);
        } else if (pickup.kind === 'overcharge') {
          player.overchargeUntil = now + OVERCHARGE_TIME;
          this.particles.floatText(player.x, player.y - 34, 'OVERCHARGE!', '#ffe066', 18);
        }
        this.particles.ring(pickup.x, pickup.y, '#ffffff', 34);
        this.sound.pickup();
      } else if (pickup.age > pickup.lifetime) {
        this.pickups.splice(i, 1);
      }
    }

    // --- wave clear?
    if (
      this.state === 'playing' &&
      !this.waitingBetween &&
      this.spawnQueue.length === 0 &&
      this.enemies.length === 0 &&
      this.wave < FINAL_WAVE
    ) {
      this.score += WAVE_BONUS;
      this.banner = `WAVE ${this.wave} CLEAR  +${WAVE_BONUS}`;
      this.bannerTimer = BANNER_TIME;
      this.betweenTimer = BETWEEN_WAVES;
      this.waitingBetween = true;
    }

    // --- between waves
    if (this.betweenTimer > 0) {
      this.betweenTimer -= dt;
      if (this.betweenTimer <= 0 && this.state === 'playing') {
        this.waitingBetween = false;
        this.nextWave();
      }
    }

    if (this.bannerTimer > 0) this.bannerTimer -= dt;
  }

  update(dt, input) {
    if (this.state === 'title') {
      // The title screen idles with drifting motes behind it.
      this.moteTimer -= dt;
      if (this.moteTimer <= 0 && this.motes.length < 8) {
        this.moteTimer = 1;
        const p = innerPoint(this.rng, ARENA, null);
        this.motes.push(createMote(p.x, p.y, this.rng));
      }
      for (const mote of this.motes) {
        mote.age += dt;
        mote.x += mote.vx * dt;
        mote.y += mote.vy * dt;
        // Bounce off the arena so the backdrop never empties out.
        if (mote.x < ARENA.left || mote.x > ARENA.right) mote.vx *= -1;
        if (mote.y < ARENA.top || mote.y > ARENA.bottom) mote.vy *= -1;
        mote.x = Math.max(ARENA.left, Math.min(ARENA.right, mote.x));
        mote.y = Math.max(ARENA.top, Math.min(ARENA.bottom, mote.y));
      }
      return;
    }
    if (this.state === 'paused') return;
    if (this.state === 'playing') {
      this.updatePlaying(dt, input);
      return;
    }
    // victory / gameover: particles keep drifting, the world rests.
  }
}
