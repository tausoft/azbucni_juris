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

    // --- Direction flip slide (Phase: SMOOTH-TRANSITION PT1) ---
    this.flipSlideTimer = 0;                       // tracks reversal progress (seconds)
    this.flipSlideDuration = GameConstants.TRANSITIONS.FLIP_SLIDE_DURATION;
    this.isFlipping = false;                       // true during active flip
    this.flipSlideDirection = 0;                   // target direction once slide completes

    // Animation state (Phase 3)
    this.currentAnimation = ANIM.idle;   // active animation group name
    this.frameIndex = 0;              // current frame within the active group
    this.animationTimer = 0;          // accumulated time since last frame advance
    this.groups = {};                 // parsed frame groups: { idle: [...], run: [...], ... }
    this._framesBuilt = false;        // guard — true once _buildFrameGroups() completes
    this._victoryTriggered = false;   // one-shot flag for victory animation sequence

    // --- Animation crossfade (Phase: SMOOTH-TRANSITION PT2) ---
    this.crossfading = false;           // true during active crossfade
    this.crossfadeTimer = 0;            // elapsed time in current crossfade (seconds)
    this.crossfadeDuration = GameConstants.TRANSITIONS.ANIMATION_CROSSFADE_DURATION;
    this.prevFrame = null;              // previous animation frame data for blending
    this.prevGroup = null;              // previous animation group name
    this.prevAnimation = null;          // previous animation name (for debug/logging)

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
   * If the new group differs from the current one, triggers a crossfade.
   */
  setCurrentAnimation(name) {
    if (!this.groups[name]) {
      console.warn(`Player: Unknown animation group '${name}'`);
      return;
    }

    // If same animation, just reset (used for victory loop re-trigger)
    if (name === this.currentAnimation) {
      this.frameIndex = 0;
      this.animationTimer = 0;
      return;
    }

    // Trigger crossfade to new animation group
    this.crossfadeTo(name);
  }

  /**
   * Start a crossfade from the current frame to a new animation group.
   * Saves the previous frame for alpha-blended rendering during transition.
   */
  crossfadeTo(newGroupName) {
    if (this.crossfading) return; // Already crossfading — skip

    // Save the current frame for blending
    const currentGroup = this.groups[this.currentAnimation];
    if (currentGroup && currentGroup[this.frameIndex]) {
      this.prevFrame = currentGroup[this.frameIndex];
      this.prevGroup = this.currentAnimation;
      this.prevAnimation = newGroupName;
    }

    // Start the new animation
    this.currentAnimation = newGroupName;
    this.frameIndex = 0;
    this.animationTimer = 0;

    // Enable crossfade
    this.crossfading = true;
    this.crossfadeTimer = 0;
  }

  /**
   * Update the crossfade timer. Returns true when crossfade is complete.
   */
  updateCrossfade(deltaTime) {
    if (!this.crossfading) return false;

    this.crossfadeTimer += deltaTime;
    if (this.crossfadeTimer >= this.crossfadeDuration) {
      // Crossfade complete — clean up state
      this.crossfading = false;
      this.crossfadeTimer = 0;
      this.prevFrame = null;
      this.prevGroup = null;
      this.prevAnimation = null;
      return true;
    }
    return false;
  }

  /**
   * Get the eased alpha value for crossfade blending.
   * Uses smoothstep (t² × (3 - 2t)) for natural-feeling transition.
   */
  getCrossfadeAlpha() {
    if (!this.crossfading) return 0;
    const t = Math.min(this.crossfadeTimer / this.crossfadeDuration, 1.0);
    // Smoothstep easing
    return t * t * (3 - 2 * t);
  }

  /**
   * Draw a single frame at the player's position.
   * Handles flip-horizontal via canvas transform when facing left.
   */
  _drawSingleFrame(ctx, frame) {
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
      ctx.restore();
    } else {
      ctx.drawImage(
        this.image,
        frame.x, frame.y, frame.w, frame.h, // source
        this.x, this.y, this.width, this.height, // dest
      );
    }
  }

  /**
   * Draw method called every frame by the game loop.
   * Renders the active animation frame at the player's current position.
   * During crossfade, blends old and new frames via globalAlpha.
   */
  draw(ctx) {
    if (!this.isReady || !this._framesBuilt) {
      // Fallback: draw a blue rectangle so we know the render loop is running
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

    // --- Crossfade rendering: blend old and new frames ---
    if (this.crossfading && this.prevFrame) {
      const alpha = this.getCrossfadeAlpha();
      const invAlpha = 1.0 - alpha;

      // Draw previous frame (fading out)
      ctx.globalAlpha = invAlpha;
      this._drawSingleFrame(ctx, this.prevFrame);

      // Draw current frame (fading in)
      ctx.globalAlpha = alpha;
      this._drawSingleFrame(ctx, frame);

      // Reset globalAlpha to avoid affecting subsequent draws (HUD, letters, etc.)
      ctx.globalAlpha = 1.0;
    } else {
      // Normal rendering — single frame
      this._drawSingleFrame(ctx, frame);
    }

    // --- Debug overlay: draw logical hitbox as green wireframe ---
    // Must be OUTSIDE any alpha changes so it appears at the correct screen position.
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

  // --- Direction flip slide update (Phase: SMOOTH-TRANSITION PT1) ---
  if (player.isFlipping) {
    player.flipSlideTimer += deltaTime;
    const t = Math.min(player.flipSlideTimer / player.flipSlideDuration, 1.0);

    // Ease-out cubic for natural deceleration → acceleration curve
    const eased = 1 - Math.pow(1 - t, 3);

    // Calculate slide range: how far the character drifts during reversal
    const slideRange = player.speed * player.flipSlideDuration * 0.5;

    // The flip center is where the character briefly pauses (direction-neutral point)
    const flipCenter = player.x - (player.direction * slideRange);

    // Slide toward new target: from flipCenter back along the original direction,
    // then accelerate into the new direction
    const newTargetX = flipCenter + (player.flipSlideDirection * slideRange * eased);

    // Apply slide — character drifts during reversal
    player.x += (newTargetX - player.x) * deltaTime * 8;

    // Check if slide is complete
    if (t >= 1.0) {
      player.direction = player.flipSlideDirection;
      player.facing = player.flipSlideDirection;
      player.isFlipping = false;
      player.flipSlideTimer = 0;
      // Snap to clean position
      player.x = flipCenter + (player.flipSlideDirection * slideRange);
    }
  }

  // Always update animation (even when stationary — idle loops)
  player.updateAnimation(deltaTime);

  // Update crossfade timer (if active)
  player.updateCrossfade(deltaTime);

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

  dir = Math.max(-1, Math.min(1, dir));

  // If direction is changing to opposite of current, trigger flip slide
  if (player.direction !== 0 && player.direction !== dir && dir !== 0) {
    // Only trigger if moving in the opposite direction (not just starting/stopping)
    if (player.direction * dir < 0) {
      player.isFlipping = true;
      player.flipSlideTimer = 0;
      player.flipSlideDirection = dir;
      // Do NOT change player.direction yet — wait for slide to complete
      return;
    }
  }

  // Normal direction set (no flip needed)
  player.direction = dir;
  if (dir !== 0) player.facing = dir;
}

export function stopPlayer() {
  if (!player) return;
  player.direction = 0;
}

export function getPlayerHitbox() {
  return player ? { x: player.x, y: player.y, width: player.width, height: player.height } : null;
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
