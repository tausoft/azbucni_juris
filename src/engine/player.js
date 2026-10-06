// ============================================================
// Player — minimal sprite loader and single-frame renderer
// Purpose: Test asset loading and static rendering only.
// No animation, physics, or game states yet.
// ============================================================

class Player {
  constructor() {
    // Asset paths (Vite-served from /public/)
    this.jsonPath = '/sprites/knight/map.json';
    this.imagePath = '/sprites/knight/spritesheet.png';

    // State
    this.isReady = false;
    this.x = 100;
    this.y = 100;

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
      ctx.fillRect(this.x, this.y, 60, 60);
      return;
    }

    // Extract first frame from JSON hash
    const f = this.json.frames["knight-idle-1"].frame;

    // Render the sprite frame at player position (scale to fit)
    ctx.drawImage(this.image, f.x, f.y, f.w, f.h, this.x, this.y, f.w, f.h);

    // Log exactly once
    if (!this._hasDrawnOnce) {
      console.log("Player: Successfully drawing static sprite frame!");
      this._hasDrawnOnce = true;
    }
  }
}

// --- Module-level API (mirrors existing gameLoop.js imports) ---
let player = null;

export function initPlayer(canvasW, canvasH) {
  player = new Player();
  return player;
}

export function updatePlayer() {
  // No-op: no physics or movement in this minimal version
}

export function drawPlayer(ctx) {
  if (player) player.draw(ctx);
}

export function setDirection() {
  // No-op: no movement yet
}

export function stopPlayer() {
  // No-op: no movement yet
}

export function getPlayerHitbox() {
  return player ? { x: player.x, y: player.y, width: 60, height: 60 } : null;
}

// Victory trigger stub (no-op for now)
export function triggerVictory() {
  // No-op
}
