// Lumen Harvest — every pixel the game draws. The renderer reads the
// world and the particles and paints the frame: the night-garden backdrop,
// the ship, the mites, the motes, the HUD and the title / pause / victory /
// game-over screens. It never changes game state.

import { ARENA, BANNER_TIME, COMBO, FINAL_WAVE, PALETTE, PLAYER, VIEW } from './config.js';
import { createRng, range } from './random.js';

const FONT = '"Trebuchet MS", Verdana, sans-serif';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // A fixed starfield, seeded once so the backdrop never flickers.
    const rng = createRng(20261116);
    this.stars = [];
    for (let i = 0; i < 130; i++) {
      this.stars.push({
        x: range(rng, 0, VIEW.width),
        y: range(rng, 0, VIEW.height),
        radius: range(rng, 0.6, 2),
        twinkle: range(rng, 0, Math.PI * 2),
        speed: range(rng, 0.6, 2.2),
      });
    }
  }

  // ------------------------------------------------------------ backdrop

  drawBackground(ctx, time) {
    const gradient = ctx.createRadialGradient(
      VIEW.width / 2, VIEW.height / 2, 80,
      VIEW.width / 2, VIEW.height / 2, 760,
    );
    gradient.addColorStop(0, PALETTE.background);
    gradient.addColorStop(1, PALETTE.backgroundEdge);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    // Faint dot grid, for depth and for reading the ship's speed.
    ctx.fillStyle = PALETTE.grid;
    for (let x = 40; x < VIEW.width; x += 64) {
      for (let y = 40; y < VIEW.height; y += 64) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // Twinkling stars.
    for (const star of this.stars) {
      const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * star.speed + star.twinkle));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#cfe0ff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // The arena border: a soft glowing frame.
    ctx.strokeStyle = 'rgba(127, 231, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ARENA.left, ARENA.top, ARENA.right - ARENA.left, ARENA.bottom - ARENA.top);
  }

  // ------------------------------------------------------------ entities

  drawMote(ctx, mote, time) {
    const pulse = 1 + 0.18 * Math.sin(time * 3 + mote.phase);
    const fade = mote.lifetime < 3 ? Math.max(0, mote.lifetime / 3) : 1;
    const glow = ctx.createRadialGradient(mote.x, mote.y, 0, mote.x, mote.y, 26 * pulse);
    glow.addColorStop(0, 'rgba(255, 215, 106, 0.85)');
    glow.addColorStop(0.4, 'rgba(255, 215, 106, 0.28)');
    glow.addColorStop(1, 'rgba(255, 215, 106, 0)');
    ctx.globalAlpha = fade;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, 26 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.moteCore;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, 5 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawPlayer(ctx, player, time) {
    const blink = time < player.invulnUntil && Math.floor(time * 14) % 2 === 0;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (blink) ctx.globalAlpha = 0.35;

    // Glow.
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 46);
    glow.addColorStop(0, 'rgba(127, 231, 255, 0.5)');
    glow.addColorStop(1, 'rgba(127, 231, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.fill();

    // Shield ring.
    if (player.shield) {
      ctx.strokeStyle = PALETTE.shield;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(time * 5);
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = blink ? 0.35 : 1;
    }

    // The lantern ship: a hull triangle with a bright core, aimed at the mouse.
    ctx.rotate(player.angle);
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -11);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 11);
    ctx.closePath();
    ctx.fill();
    // Engine flame, flickering.
    const flame = 8 + Math.sin(time * 31) * 3 + (player.dashTimer > 0 ? 10 : 0);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(-12, -5);
    ctx.lineTo(-12 - flame, 0);
    ctx.lineTo(-12, 5);
    ctx.closePath();
    ctx.fill();
    // Core lamp.
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(4, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Overcharge arc above the ship.
    if (time < player.overchargeUntil) {
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ((player.overchargeUntil - time) / 8));
      ctx.stroke();
    }
  }

  drawEnemy(ctx, enemy, time) {
    const scale = Math.min(1, enemy.spawnAge / 0.35);
    const radius = enemy.radius * scale;
    if (radius <= 0.5) return;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    const flash = enemy.flash > 0;
    const body = flash ? '#ffffff' : enemy.kind === 'drifter' ? PALETTE.drifter
      : enemy.kind === 'darter' ? PALETTE.darter
      : enemy.kind === 'spitter' ? PALETTE.spitter : PALETTE.boss;

    if (enemy.kind === 'drifter') {
      // A spiky blob, slowly rotating.
      ctx.rotate(time * 0.8 + enemy.wobble);
      ctx.fillStyle = body;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? radius : radius * 0.62;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a1245';
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'darter') {
      // A dart, pointed along its motion.
      ctx.rotate(enemy.angle);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(radius + 6, 0);
      ctx.lineTo(-radius, -radius * 0.8);
      ctx.lineTo(-radius * 0.4, 0);
      ctx.lineTo(-radius, radius * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(radius * 0.3, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'spitter') {
      // A diamond with a pulsing mouth.
      ctx.rotate(enemy.angle);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(0, radius * 0.85);
      ctx.lineTo(-radius, 0);
      ctx.lineTo(0, -radius * 0.85);
      ctx.closePath();
      ctx.fill();
      const mouth = 4 + Math.sin(time * 6 + enemy.wobble) * 2;
      ctx.fillStyle = '#12351a';
      ctx.beginPath();
      ctx.arc(radius * 0.35, 0, mouth, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // The Gloom Maw: a big ringed maw with teeth and a burning core.
      const pulse = 1 + 0.05 * Math.sin(time * 4);
      ctx.scale(pulse, pulse);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius + 26);
      glow.addColorStop(0, 'rgba(255, 93, 93, 0.4)');
      glow.addColorStop(1, 'rgba(255, 93, 93, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      // Teeth ring.
      ctx.fillStyle = '#fff3c4';
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + time * 0.25;
        const tx = Math.cos(a) * radius * 0.72;
        const ty = Math.sin(a) * radius * 0.72;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(a + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.lineTo(0, 12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // Burning core.
      ctx.fillStyle = '#1a0505';
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.45 * (0.7 + 0.3 * Math.sin(time * 7)), 0, Math.PI * 2);
      ctx.fill();
      // Health bar above the boss.
      ctx.restore();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(enemy.x - 70, enemy.y - radius - 26, 140, 9);
      ctx.fillStyle = PALETTE.boss;
      ctx.fillRect(enemy.x - 70, enemy.y - radius - 26, 140 * Math.max(0, enemy.hp / enemy.maxHp), 9);
      return;
    }
    ctx.restore();
  }

  drawBullet(ctx, bullet) {
    ctx.fillStyle = PALETTE.bullet;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(174, 243, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius + 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEnemyShot(ctx, shot, time) {
    const pulse = 1 + 0.2 * Math.sin(time * 8);
    ctx.fillStyle = PALETTE.enemyShot;
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 157, 92, 0.3)';
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.radius * pulse + 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPickup(ctx, pickup, time) {
    const bob = Math.sin(time * 4 + pickup.x) * 3;
    const y = pickup.y + bob;
    const blink = pickup.lifetime - pickup.age < 2 ? (Math.floor(time * 8) % 2 === 0 ? 0.35 : 1) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.translate(pickup.x, y);
    if (pickup.kind === 'shield') {
      ctx.strokeStyle = PALETTE.shield;
      ctx.fillStyle = 'rgba(110, 198, 255, 0.25)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PALETTE.shield;
      ctx.font = `700 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', 0, 1);
    } else if (pickup.kind === 'heart') {
      ctx.fillStyle = PALETTE.heart;
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.bezierCurveTo(-14, -2, -9, -12, 0, -5);
      ctx.bezierCurveTo(9, -12, 14, -2, 0, 10);
      ctx.fill();
    } else {
      // Overcharge: a lightning bolt in a ring.
      ctx.strokeStyle = PALETTE.overcharge;
      ctx.fillStyle = 'rgba(255, 224, 102, 0.2)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PALETTE.overcharge;
      ctx.beginPath();
      ctx.moveTo(2, -10);
      ctx.lineTo(-5, 2);
      ctx.lineTo(0, 2);
      ctx.lineTo(-2, 10);
      ctx.lineTo(5, -2);
      ctx.lineTo(0, -2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ HUD

  drawHeart(ctx, x, y, filled, size = 9) {
    ctx.fillStyle = filled ? PALETTE.heart : 'rgba(255, 107, 129, 0.25)';
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.7);
    ctx.bezierCurveTo(x - size * 1.4, y - size * 0.2, x - size * 0.9, y - size * 1.2, x, y - size * 0.5);
    ctx.bezierCurveTo(x + size * 0.9, y - size * 1.2, x + size * 1.4, y - size * 0.2, x, y + size * 0.7);
    ctx.fill();
  }

  drawHud(ctx, world) {
    const player = world.player;
    ctx.textBaseline = 'alphabetic';

    // Score, big and left.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(`SCORE  ${world.score.toLocaleString('en-US')}`, 28, 44);
    ctx.font = `400 15px ${FONT}`;
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText(`BEST  ${world.best.toLocaleString('en-US')}`, 28, 66);

    // Wave, centred.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(world.wave >= FINAL_WAVE ? 'FINAL WAVE' : `WAVE ${world.wave} / ${FINAL_WAVE}`, VIEW.width / 2, 40);
    const remaining = world.enemies.length + world.spawnQueue.length;
    ctx.font = `400 14px ${FONT}`;
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText(remaining > 0 ? `${remaining} mite${remaining === 1 ? '' : 's'} left` : 'clear!', VIEW.width / 2, 62);

    // Hull hearts, right.
    ctx.textAlign = 'right';
    for (let i = 0; i < PLAYER.maxHull; i++) {
      this.drawHeart(ctx, VIEW.width - 40 - i * 30, 30, i < player.hull);
    }
    if (player.shield) {
      ctx.fillStyle = PALETTE.shield;
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText('SHIELD', VIEW.width - 40, 66);
    }

    // Combo bar, under the score.
    if (world.combo > 1) {
      const multiplier = Math.min(1 + Math.floor(world.combo / COMBO.step), COMBO.maxMultiplier);
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `700 20px ${FONT}`;
      ctx.fillText(`COMBO x${multiplier}  (${world.combo})`, 28, 96);
      ctx.fillStyle = 'rgba(255, 215, 106, 0.25)';
      ctx.fillRect(28, 104, 160, 6);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(28, 104, 160 * Math.max(0, world.comboTimer / COMBO.window), 6);
    }

    // Dash cooldown, bottom left.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = `400 14px ${FONT}`;
    const dashReady = player.dashCooldown <= 0;
    ctx.fillText(dashReady ? 'DASH ready  [Shift]' : 'DASH …', 28, VIEW.height - 16);
    if (!dashReady) {
      ctx.fillStyle = 'rgba(127, 231, 255, 0.3)';
      ctx.fillRect(28, VIEW.height - 12, 90 * (1 - player.dashCooldown / 1.5), 4);
    }

    // Controls hint, bottom right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText('WASD move · Mouse aim · Click / Space fire · Shift dash · P pause · M mute', VIEW.width - 28, VIEW.height - 16);
  }

  drawBanner(ctx, world) {
    if (world.bannerTimer <= 0 || !world.banner) return;
    const alpha = Math.min(1, world.bannerTimer / 0.5, (BANNER_TIME - world.bannerTimer) / 0.2 + 0.4);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `700 44px ${FONT}`;
    ctx.fillText(world.banner, VIEW.width / 2, 190);
    ctx.restore();
  }

  // ------------------------------------------------------------ screens

  drawTitle(ctx, world, time) {
    this.drawOverlay(ctx, 0.45);
    const cx = VIEW.width / 2;
    const bob = Math.sin(time * 1.4) * 6;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `700 76px ${FONT}`;
    ctx.fillText('LUMEN HARVEST', cx, 218 + bob);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `400 24px ${FONT}`;
    ctx.fillText('Gather the light. Blast the gloom. Survive all 8 waves.', cx, 262 + bob);

    ctx.fillStyle = PALETTE.textDim;
    ctx.font = `400 18px ${FONT}`;
    ctx.fillText('WASD / arrows — move      Mouse — aim      Click or Space — fire', cx, 330);
    ctx.fillText('Shift — dash through danger      P — pause      M — mute', cx, 358);
    ctx.fillText('Motes feed your combo. Mites drop shields, hull and overcharge.', cx, 386);
    ctx.fillText('Clear wave 8 and defeat the Gloom Maw to win.', cx, 414);

    const pulse = 0.78 + 0.22 * Math.sin(time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.player;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText('CLICK OR PRESS ENTER TO PLAY', cx, 490);
    ctx.globalAlpha = 1;

    if (world.best > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `700 20px ${FONT}`;
      ctx.fillText(`BEST SCORE  ${world.best.toLocaleString('en-US')}`, cx, 540);
    }
  }

  drawPaused(ctx) {
    this.drawOverlay(ctx, 0.55);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 52px ${FONT}`;
    ctx.fillText('PAUSED', VIEW.width / 2, 330);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = `400 20px ${FONT}`;
    ctx.fillText('P or Esc to resume · R to restart', VIEW.width / 2, 372);
  }

  drawStats(ctx, rows, y) {
    ctx.textAlign = 'center';
    ctx.font = `400 20px ${FONT}`;
    ctx.fillStyle = PALETTE.textDim;
    for (const [label, value] of rows) {
      ctx.fillText(`${label}   ${value}`, VIEW.width / 2, y);
      y += 32;
    }
    return y;
  }

  drawVictory(ctx, world, time) {
    this.drawOverlay(ctx, 0.5);
    const stats = world.victoryStats;
    const cx = VIEW.width / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `700 64px ${FONT}`;
    ctx.fillText('THE GARDEN SHINES', cx, 210);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `400 24px ${FONT}`;
    ctx.fillText('The Gloom Maw is gone. Every mote is yours.', cx, 254);
    const y = this.drawStats(ctx, [
      ['SCORE', stats.score.toLocaleString('en-US') + (world.newBest ? '  ★ NEW BEST' : '')],
      ['TIME', `${Math.floor(stats.time / 60)}:${String(Math.floor(stats.time % 60)).padStart(2, '0')}`],
      ['MITES BLASTED', String(stats.kills)],
      ['MOTES GATHERED', String(stats.motes)],
      ['ACCURACY', `${stats.accuracy}%`],
    ], 316);
    const pulse = 0.78 + 0.22 * Math.sin(time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.player;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText('PRESS R OR CLICK TO PLAY AGAIN', cx, y + 44);
    ctx.globalAlpha = 1;
  }

  drawGameOver(ctx, world, time) {
    this.drawOverlay(ctx, 0.55);
    const stats = world.gameOverStats;
    const cx = VIEW.width / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b81';
    ctx.font = `700 64px ${FONT}`;
    ctx.fillText('THE LIGHT FADES', cx, 210);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `400 24px ${FONT}`;
    ctx.fillText(`The gloom took your lantern on wave ${stats.wave}.`, cx, 254);
    const y = this.drawStats(ctx, [
      ['SCORE', stats.score.toLocaleString('en-US') + (world.newBest ? '  ★ NEW BEST' : '')],
      ['BEST', world.best.toLocaleString('en-US')],
      ['WAVE REACHED', `${stats.wave} / ${FINAL_WAVE}`],
      ['MITES BLASTED', String(stats.kills)],
      ['MOTES GATHERED', String(stats.motes)],
      ['ACCURACY', `${stats.accuracy}%`],
    ], 316);
    const pulse = 0.78 + 0.22 * Math.sin(time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.player;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText('PRESS R OR CLICK TO TRY AGAIN', cx, y + 44);
    ctx.globalAlpha = 1;
  }

  drawOverlay(ctx, alpha) {
    ctx.fillStyle = `rgba(5, 7, 15, ${alpha})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  // Hurt vignette: a red edge that flares right after a hit.
  drawHurtFlash(ctx, world, time) {
    const since = time - (world.player.invulnUntil - 1.3);
    if (since < 0 || since > 0.5) return;
    const alpha = 0.35 * (1 - since / 0.5);
    const gradient = ctx.createRadialGradient(
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.42,
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.75,
    );
    gradient.addColorStop(0, 'rgba(255, 60, 60, 0)');
    gradient.addColorStop(1, `rgba(255, 60, 60, ${alpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  // ------------------------------------------------------------ frame

  render(world, particles, time) {
    const ctx = this.ctx;
    const shake = particles.shakeOffset(time);
    ctx.save();
    ctx.translate(shake.x, shake.y);
    this.drawBackground(ctx, time);

    for (const mote of world.motes) this.drawMote(ctx, mote, time);
    for (const pickup of world.pickups) this.drawPickup(ctx, pickup, time);
    for (const enemy of world.enemies) this.drawEnemy(ctx, enemy, time);
    for (const bullet of world.bullets) this.drawBullet(ctx, bullet);
    for (const shot of world.enemyShots) this.drawEnemyShot(ctx, shot, time);
    if (world.player.alive) this.drawPlayer(ctx, world.player, time);

    particles.draw(ctx);
    ctx.restore();

    // HUD and screens sit outside the shake so text stays readable.
    if (world.state === 'playing' || world.state === 'paused') {
      this.drawHud(ctx, world);
      this.drawBanner(ctx, world);
      this.drawHurtFlash(ctx, world, time);
    }
    if (world.state === 'title') this.drawTitle(ctx, world, time);
    if (world.state === 'paused') this.drawPaused(ctx);
    if (world.state === 'victory') this.drawVictory(ctx, world, time);
    if (world.state === 'gameover') this.drawGameOver(ctx, world, time);
  }
}
