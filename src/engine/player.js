// ============================================================
// Player — sprite animation system with idle/run/victory states
// Purpose: Delta-time driven animation using spritesheet + map.json
// ============================================================

import { GameConstants } from './constants.js';

// --- Animation name prefixes (matches JSON key format) ---
const ANIM = {
  idle:     'knight-idle',
  run:      'knight-run',
  victory:  'knight-victory',
  victoryIdle: 'knight-victory-idle',
};

// --- Animation frame rates (frames per second) ---
const ANIMATION_FRAMES_PER_SECOND = {
  [ANIM.idle]:     4,           // 0.25s per frame — relaxed breathing
  [ANIM.run]:      8,            // 0.125s per frame — energetic running
  [ANIM.victory]:  6,            // ~0.167s per frame — celebratory pace
  [ANIM.victoryIdle]: 3,         // ~0.33s per frame — slow post-victory breathing
};

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
    this.facing = 1;          // 1 = right, -1 = left — persists after stop

    // Animation state (Phase 3)
    this.currentAnimation = ANIM.idle;   // active animation group name
    this.frameIndex = 0;              // current frame within the active group
    this.animationTimer = 0;          // accumulated time since last frame advance
    this.groups = {};                 // parsed frame groups: { idle: [...], run: [...], ... }
    this._framesBuilt = false;        // guard — true once _buildFrameGroups() completes
    this._victoryTriggered = false;   // one-shot flag for victory animation sequence

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
        // Build frame groups from JSON immediately
        this._buildFrameGroups();
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
   * Parse map.json frames into grouped arrays keyed by animation name.
   * Called once after JSON is loaded.
   */
  _buildFrameGroups() {
    if (this._framesBuilt || !this.json) return;

    const groups = {};
    for (const [key, value] of Object.entries(this.json.frames)) {
      const match = key.match(/^(.+)-(\d+)$/);
      if (!match) continue;

      const [, groupName, frameNumStr] = match;
      const frameNum = parseInt(frameNumStr, 10);

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push({
        x: value.frame.x,
        y: value.frame.y,
        w: value.frame.w,
        h: value.frame.h,
        key: key,
        order: frameNum,
      });
    }

    // Sort each group by frame number (JSON key ordering is not guaranteed)
    for (const group of Object.values(groups)) {
      group.sort((a, b) => a.order - b.order);
    }

    this.groups = groups;
    this._framesBuilt = true;
    console.log('Player: Frame groups built:', Object.keys(this.groups));
  }

  /**
   * Update animation timer and advance frame index based on elapsed time.
   */
  updateAnimation(deltaTime) {
    if (!this._framesBuilt || !this.groups[this.currentAnimation]) return;

    const fps = ANIMATION_FRAMES_PER_SECOND[this.currentAnimation];
    if (fps === undefined) return;

    const frameDuration = 1 / fps; // seconds per frame

    this.animationTimer += deltaTime;

    while (this.animationTimer >= frameDuration) {
      this.animationTimer -= frameDuration;
      this.frameIndex++;

      const group = this.groups[this.currentAnimation];
      if (this.frameIndex >= group.length) {
        this.frameIndex = 0; // Loop back to start
      }
    }
  }

  /**
   * Switch to a named animation group and reset timer/frameIndex.
   */
  setCurrentAnimation(name) {
    if (!this.groups[name]) {
      console.warn(`Player: Unknown animation group '${name}'`);
      return;
    }

    this.currentAnimation = name;
    this.frameIndex = 0;
    this.animationTimer = 0;
  }

  /**
   * Draw method called every frame by the game loop.
   * Renders the active animation frame at the player's current position.
   */
  draw(ctx) {
    if (!this.isReady) {
      // Fallback: draw a blue rectangle so we know the render loop is running
      ctx.fillStyle = '#3498db';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      return;
    }

    if (!this._framesBuilt) {
      // JSON not loaded yet — blue rectangle fallback
      ctx.fillStyle = '#3498db';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      return;
    }

    const group = this.groups[this.currentAnimation];
    if (!group || !group[this.frameIndex]) {
      // Safety fallback — unknown animation or missing frame
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      return;
    }
    const frame = group[this.frameIndex];

    this._lastFacing = this.facing;

    if (this.facing === -1) {
      // Flip horizontally when facing left
      const pivotX = this.x + this.width;

      ctx.save();
      ctx.translate(pivotX, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(
        this.image,
        frame.x, frame.y, frame.w, frame.h, // source
        0, this.y, this.width, this.height, // dest (extends left from flipped origin)
      );
      ctx.restore();                       // ← restore BEFORE any debug overlay
    } else {
      ctx.drawImage(
        this.image,
        frame.x, frame.y, frame.w, frame.h, // source
        this.x, this.y, this.width, this.height, // dest
      );
    }

    // --- Debug overlay: draw logical hitbox as green wireframe ---
    // Must be OUTSIDE the flipped context so it appears at the correct screen position.
    if (typeof DEBUG_DRAW_HITBOX !== 'undefined' && DEBUG_DRAW_HITBOX) {
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
  }
}

// --- Module-level canvas dimensions (for bounds checking in future phases) ---
let canvasWidth = 0;
let canvasHeight = 0;

// --- Debug: track position deltas between frames (fires only on teleport events) ---
let _lastPlayerX = null;
const TELEPORT_THRESHOLD = 10; // px — log only when change exceeds this

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

  _lastPlayerX = null; // reset delta tracker
  return player;
}

export function updatePlayer(deltaTime) {
  if (!player) return;

  // --- Debug: detect teleportation (fires only when change > threshold) ---
  if (_lastPlayerX !== null && Math.abs(player.x - _lastPlayerX) > TELEPORT_THRESHOLD) {
    console.group('🚨 TELEPORT DETECTED — position jumped!');
    console.log('Previous frame X:', _lastPlayerX);
    console.log('Current frame X: ', player.x);
    console.log('Delta:           ', player.x - _lastPlayerX, 'px');
    console.log('Direction:       ', player.direction);
    console.log('Animation:       ', player.currentAnimation);
    console.groupEnd();
  }
  _lastPlayerX = player.x;

  // Always update animation (even when stationary — idle loops)
  player.updateAnimation(deltaTime);

  // Auto-transition idle ↔ run based on movement direction
  if (player.direction !== 0 && player.currentAnimation === ANIM.idle) {
    player.setCurrentAnimation(ANIM.run);
  } else if (player.direction === 0 && player.currentAnimation === ANIM.run) {
    player.setCurrentAnimation(ANIM.idle);
  }

  // Handle victory animation completion
  if (player._victoryTriggered) {
    if (player.currentAnimation === ANIM.victory && player.frameIndex === 0 && player.animationTimer < 0.1) {
      // Victory looped back — transition to victory-idle
      player.setCurrentAnimation(ANIM.victoryIdle);
    } else if (player.currentAnimation === ANIM.victoryIdle && player.frameIndex === 0 && player.animationTimer < 0.1) {
      // Victory-idle looped back — return to idle
      player._victoryTriggered = false;
      player.setCurrentAnimation(ANIM.idle);
    }
  }

  // Movement (only when direction set)
  if (player.direction === 0) return;

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
  if (dir !== 0) player.facing = dir;
}

export function stopPlayer() {
  if (!player) return;
  player.direction = 0;
}

export function getPlayerHitbox() {
  if (!player) return null;

  // Use the stored canvas-relative dimensions (set in initPlayer) as the hitbox.
  // This ensures the collision hitbox always matches what's drawn on screen:
  //   width  = canvasW * PLAYER_WIDTH_RATIO  (6% of canvas width)
  //   height = canvasH * PLAYER_HEIGHT_RATIO  (8% of canvas height)
  // The hitbox must match the sprite's DESTINATION dimensions in drawImage(),
  // not the source frame dimensions (211×240), which get stretched to fit.
  return {
    x: player.x,
    y: player.y,
    width: canvasWidth * GameConstants.PLAYER_WIDTH_RATIO,
    height: canvasHeight * GameConstants.PLAYER_HEIGHT_RATIO,
  };
}

// --- Debug accessor (used by gameLoop.js when DEBUG_DRAW_HITBOX is enabled) ---
export function getDebugPlayerX() {
  return player ? player.x : null;
}

// --- Victory trigger (Phase 3: one-shot animation sequence) ---
export function triggerVictory() {
  if (!player) return;
  
  player._victoryTriggered = true;
  player.setCurrentAnimation(ANIM.victory);
  console.log('Player: Victory animation triggered!');
}
