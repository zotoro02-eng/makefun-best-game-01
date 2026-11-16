// Lumen Harvest — keyboard and mouse state. The game reads this, never
// raw DOM events: keys are a set of codes, the mouse is a position in
// canvas coordinates plus a held flag. Edge-triggered presses (start,
// restart, pause, dash, mute) are consumed once by the world.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // codes pressed since the last consume
    this.mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };
    this._onKeyDown = (event) => {
      const gameKeys = [
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
        'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight',
        'Enter', 'KeyR', 'KeyP', 'Escape', 'KeyM',
      ];
      if (gameKeys.includes(event.code)) event.preventDefault();
      if (!event.repeat) {
        this.keys.add(event.code);
        this.pressed.add(event.code);
      }
    };
    this._onKeyUp = (event) => {
      this.keys.delete(event.code);
    };
    this._onMouseMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
      this.mouse.y = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
    };
    this._onMouseDown = (event) => {
      if (event.button === 0) this.mouse.down = true;
      this._onMouseMove(event);
    };
    this._onMouseUp = (event) => {
      if (event.button === 0) this.mouse.down = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouse.down = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  // True while the code is held down.
  held(code) {
    return this.keys.has(code);
  }

  // True once for a press since the last call to consume(); use for
  // one-shot actions so holding the key does not repeat them.
  consume(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  // Movement vector from WASD / arrow keys, normalized.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.held('KeyA') || this.held('ArrowLeft')) x -= 1;
    if (this.held('KeyD') || this.held('ArrowRight')) x += 1;
    if (this.held('KeyW') || this.held('ArrowUp')) y -= 1;
    if (this.held('KeyS') || this.held('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  get firing() {
    return this.mouse.down || this.held('Space');
  }

  get dashQueued() {
    return this.consume('ShiftLeft') || this.consume('ShiftRight');
  }

  // Drop any presses queued while a menu was up, so a stray Enter does
  // not instantly restart the game.
  clearPresses() {
    this.pressed.clear();
  }
}
