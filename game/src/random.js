// Lumen Harvest — a small seeded random number generator (mulberry32) and
// the helpers the game uses for spawns, drops and wobble. Seeded so a
// screenshot scene or a replay can be rebuilt exactly from one number;
// gameplay itself runs on a seed drawn from the clock at start.

export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A float in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// An integer in [min, max] inclusive.
export function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// One element of an array, uniformly.
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// A random angle in radians.
export function angle(rng) {
  return rng() * Math.PI * 2;
}

// A point on the arena's edge, for spawning enemies just out of sight.
export function edgePoint(rng, arena, margin = 30) {
  const side = Math.floor(rng() * 4);
  if (side === 0) return { x: range(rng, arena.left, arena.right), y: arena.top - margin };
  if (side === 1) return { x: range(rng, arena.left, arena.right), y: arena.bottom + margin };
  if (side === 2) return { x: arena.left - margin, y: range(rng, arena.top, arena.bottom) };
  return { x: arena.right + margin, y: range(rng, arena.top, arena.bottom) };
}

// A point inside the arena, away from a given point by at least `away` px.
export function innerPoint(rng, arena, awayFrom, away = 180) {
  for (let tries = 0; tries < 20; tries++) {
    const p = {
      x: range(rng, arena.left + 40, arena.right - 40),
      y: range(rng, arena.top + 40, arena.bottom - 40),
    };
    if (!awayFrom) return p;
    const dx = p.x - awayFrom.x;
    const dy = p.y - awayFrom.y;
    if (dx * dx + dy * dy >= away * away) return p;
  }
  return { x: (arena.left + arena.right) / 2, y: (arena.top + arena.bottom) / 2 };
}
