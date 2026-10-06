// ============================================================
// Player — minimal sprite loader and single-frame renderer
// Purpose: Test asset loading and static rendering only.
// No animation, physics, or game states yet.
// ============================================================

import { GameConstants } from './constants.js';

class Player {
  constructor() {
    // Asset paths (Vite-served from /public/)
    this.jsonPath = '/sprites/knight/map.json';
    this.imagePath = '/sprites/knight/spritesheet.png';

    // State
    this.isReady = false;
    this.x = 100;
    this.y = 100;

    // Movement state (Phase 2)
    this.speed = 0;           // px/sec — set in initPlayer()
    this.direction = 0;       // -1 left, 0 none, +1 right

    // Loaded assets (populated asynchronously)
    this.json = null;
    this.image = null;

    // Draw once flag
    this._hasDrawnOnce = false;

    // Kick off async loading
    this._loadAssets();
  }

  /**
   * Fetch JSON map and load spritesheet image in parallel.
   * Set isReady when BOTH complete.
   */
  _loadAssets() {
    let jsonLoaded = false;
    let imageLoaded = false;

    const checkReady = () => {
      if (jsonLoaded && imageLoaded) {
        this.isReady = true;
      }
    };

    // --- Fetch JSON ---
    console.log("Player: Fetching JSON from /sprites/knight/map.json...");

    fetch(this.jsonPath)
      .then((response) => response.json())
      .then((data) => {
        this.json = data;
        console.log("Player: JSON loaded:", this.json);
        jsonLoaded = true;
        checkReady();
      })
      .catch((err) => {
        console.error("Player: Failed to load JSON:", err);
      });

    // --- Load Image ---
    const img = new Image();
    img.onload = () => {
      this.image = img;
      console.log("Player: Image loaded successfully");
      imageLoaded = true;
      checkReady();
    };
    img.onerror = (err) => {
      console.error("Player: Failed to load image:", err);
    };
    img.src = this.imagePath;
  }

  /**
   * Draw method called every frame by the game loop.
   */
  draw(ctx) {
    if (!this.isReady) {
      // Fallback: draw a blue rectangle so we know the render loop is running
      ctx.fillStyle = '#3498db';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      return;
    }

    // Extract first frame from JSON hash
    const f = this.json.frames["knight-idle-1"].frame;

    // Render the sprite frame at player position, scaled to calculated width × height
    ctx.drawImage(this.image, f.x, f.y, f.w, f.h, this.x, this.y, this.width, this.height);

    // Log exactly once
    if (!this._hasDrawnOnce) {
      console.log("Player: Successfully drawing static sprite frame!");
      console.log(`  Position: (${this.x.toFixed(1)}, ${this.y.toFixed(1)})`);
      console.log(`  Size: ${this.width.toFixed(1)} × ${this.height.toFixed(1)} px`);
      this._hasDrawnOnce = true;
    }
  }
}

// --- Module-level canvas dimensions (for bounds checking in future phases) ---
let canvasWidth = 0;
let canvasHeight = 0;

// --- Module-level API (mirrors existing gameLoop.js imports) ---
let player = null;

export function initPlayer(canvasW, canvasH) {
  // Store canvas dimensions for bounds checking (Phase 2+)
  canvasWidth = canvasW;
  canvasHeight = canvasH;

  // Calculate sprite dimensions from GameConstants ratios
  const spriteWidth = canvasW * GameConstants.PLAYER_WIDTH_RATIO;   // 6% of canvas width
  const spriteHeight = canvasH * GameConstants.PLAYER_HEIGHT_RATIO;  // 8% of canvas height

  // Center horizontally, position near bottom (~82% from top)
  const spriteX = canvasW / 2 - spriteWidth / 2;
  const spriteY = canvasH * 0.82;

  // Initialize player with calculated dimensions
  player = new Player();
  player.x = spriteX;
  player.y = spriteY;
  player.width = spriteWidth;
  player.height = spriteHeight;

  // Set movement speed (Phase 2)
  player.speed = canvasW * GameConstants.PLAYER_SPEED_RATIO;   // 30% of canvas width per sec

  return player;
}

export function updatePlayer(deltaTime) {
  if (!player || player.direction === 0) return;

  // Delta-time movement: speed (px/sec) × time elapsed (sec)
  const moveAmount = player.speed * deltaTime * player.direction;
  player.x += moveAmount;

  // Clamp to canvas bounds (keep sprite fully inside)
  const halfW = player.width / 2;
  player.x = Math.max(halfW, Math.min(canvasWidth - halfW, player.x));
}

export function drawPlayer(ctx) {
  if (player) player.draw(ctx);
}

export function setDirection(dir) {
  if (!player) return;
  // Clamp to [-1, +1] range
  player.direction = Math.max(-1, Math.min(1, dir));
}

export function stopPlayer() {
  if (!player) return;
  player.direction = 0;
}

export function getPlayerHitbox() {
  return player ? { x: player.x, y: player.y, width: player.width, height: player.height } : null;
}

// Victory trigger stub (no-op for now)
export function triggerVictory() {
  // No-op
}
