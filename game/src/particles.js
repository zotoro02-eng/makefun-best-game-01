// Lumen Harvest — particles, floating score text and screen shake. The
// juice layer: every explosion, sparkle, muzzle flash and "+50" lives
// here, kept apart from the game logic so the world never draws itself.

export class Particles {
  constructor() {
    this.list = [];
    this.texts = [];
    this.trauma = 0; // 0..1; shake strength is trauma squared
  }

  addShake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  // Current shake offset in pixels (call once per frame, after update).
  shakeOffset(time) {
    const strength = this.trauma * this.trauma * 14;
    return {
      x: Math.sin(time * 61.7) * strength,
      y: Math.cos(time * 53.3) * strength,
    };
  }

  burst(x, y, { count = 14, color = '#ffd76a', speed = 180, size = 3, life = 0.6, gravity = 0 }) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.list.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: life * (0.6 + Math.random() * 0.6),
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color,
        gravity,
        drag: 2.2,
      });
    }
  }

  ring(x, y, color, maxRadius = 46) {
    this.list.push({
      x, y, vx: 0, vy: 0, life: 0.45, maxLife: 0.45,
      size: maxRadius, color, ring: true, gravity: 0, drag: 0,
    });
  }

  sparkle(x, y, color = '#ffe9a8') {
    this.list.push({
      x, y,
      vx: (Math.random() - 0.5) * 40,
      vy: -30 - Math.random() * 40,
      life: 0.5, maxLife: 0.5,
      size: 2 + Math.random() * 2,
      color, gravity: 0, drag: 0.5,
    });
  }

  trail(x, y, color, size = 3) {
    this.list.push({
      x, y, vx: 0, vy: 0, life: 0.28, maxLife: 0.28,
      size, color, gravity: 0, drag: 0,
    });
  }

  floatText(x, y, text, color = '#ffffff', size = 18) {
    this.texts.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
  }

  update(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      const drag = Math.max(0, 1 - p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.ring) {
        const progress = 1 - alpha;
        ctx.globalAlpha = alpha * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * progress + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const alpha = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = alpha;
      ctx.font = `700 ${t.size}px "Trebuchet MS", Verdana, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.list.length = 0;
    this.texts.length = 0;
    this.trauma = 0;
  }
}
