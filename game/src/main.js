// Lumen Harvest — bootstrap and the game loop. A fixed 1/60 s step keeps
// the simulation identical on any display; rendering happens every
// animation frame. The loop also owns the menu keys (start, pause,
// restart, mute) so the world never reads the keyboard itself.

import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { Particles } from './particles.js';
import { Renderer } from './render.js';
import { World } from './world.js';
import { applyShotScene } from './shots.js';

const STEP = 1 / 60;

const canvas = document.getElementById('game');
const input = new Input(canvas);
const sound = new SoundBank();
const particles = new Particles();
const renderer = new Renderer(canvas);
const world = new World(sound, particles);

// Screenshot scenes (?shot=title|play|victory|gameover): build the fixed
// scene, render it once, and tell the screenshot tool the frame is ready.
const shotScene = new URLSearchParams(window.location.search).get('shot');
if (shotScene) {
  applyShotScene(world, shotScene);
  renderer.render(world, particles, 1.6);
  window.__shotReady = true;
}

function startGame() {
  sound.unlock();
  sound.startPad();
  world.startRun();
  input.clearPresses();
}

function handleMenuKeys() {
  if (input.consume('KeyM')) sound.setMuted(!sound.muted);

  if (world.state === 'title') {
    if (input.consume('Enter') || input.consume('Space') || input.mouse.down) {
      startGame();
    }
    return;
  }

  if (world.state === 'playing') {
    if (input.consume('KeyP') || input.consume('Escape')) {
      world.state = 'paused';
      input.clearPresses();
    }
    return;
  }

  if (world.state === 'paused') {
    if (input.consume('KeyP') || input.consume('Escape')) {
      world.state = 'playing';
      input.clearPresses();
    } else if (input.consume('KeyR')) {
      startGame();
    }
    return;
  }

  // victory / gameover
  if (input.consume('KeyR') || input.consume('Enter') || input.mouse.down) {
    startGame();
  }
}

// The title screen also starts on any click anywhere on the page.
window.addEventListener('mousedown', () => sound.unlock(), { once: true });
window.addEventListener('keydown', () => sound.unlock(), { once: true });

let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);

  // Screenshot mode: the scene is frozen; render the same frame forever.
  if (shotScene) {
    renderer.render(world, particles, 1.6);
    return;
  }

  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;

  handleMenuKeys();

  if (world.state === 'playing' || world.state === 'title') {
    accumulator += elapsed;
    while (accumulator >= STEP) {
      world.update(STEP, input);
      particles.update(STEP);
      accumulator -= STEP;
    }
  } else {
    // Paused and end screens: only the particles keep moving.
    particles.update(elapsed);
  }

  renderer.render(world, particles, now / 1000);
}

requestAnimationFrame(frame);
