// ============================================================
// Player — character movement, input handling, hitbox
// ============================================================

import { Theme, GameConstants } from './constants.js';
import gameManager from './state.js';

let player = null;

/**
 * Initialize the player object.
 */
export function initPlayer(canvasW, canvasH) {
  // Store canvas dimensions into module-level variables for bounds checking in updatePlayer()
  canvasWidth = canvasW;
  canvasHeight = canvasH;

  const wRatio = GameConstants.PLAYER_WIDTH_RATIO;
  const hRatio = GameConstants.PLAYER_HEIGHT_RATIO;
  const speedRatio = GameConstants.PLAYER_SPEED_RATIO;

  player = {
    x: canvasW / 2 - (canvasW * wRatio) / 2,
    y: canvasH * 0.82, // near bottom
    width: canvasW * wRatio,
    height: canvasH * hRatio,
    speed: (canvasW * speedRatio), // pixels per second
    theme: gameManager.getTheme(),
    caughtLetters: [],
    direction: 0, // -1 = left, 0 = none, 1 = right
  };

  return player;
}

/**
 * Update player position based on input direction.
 */
export function updatePlayer(deltaTime) {
  if (!player) return;

  const newX = player.x + player.direction * player.speed * deltaTime;
  const maxX = canvasWidth - player.width;

  // Clamp to canvas bounds
  player.x = Math.max(0, Math.min(newX, maxX));
}

/**
 * Set movement direction.
 */
export function setDirection(dir) {
  if (player) {
    player.direction = dir;
  }
}

/**
 * Stop player movement.
 */
export function stopPlayer() {
  if (player) {
    player.direction = 0;
  }
}

/**
 * Draw the player character on canvas.
 */
export function drawPlayer(ctx) {
  if (!player) return;

  const theme = player.theme || gameManager.getTheme();

  if (theme === Theme.KNIGHT) {
    // Blue rectangle for Knight
    ctx.fillStyle = '#3498db';
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // White border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(player.x, player.y, player.width, player.height);

    // Visor slit
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      player.x + player.width * 0.3,
      player.y + player.height * 0.3,
      player.width * 0.4,
      player.height * 0.1
    );
  } else {
    // Pink circle for Princess
    const cx = player.x + player.width / 2;
    const cy = player.y + player.height / 2;
    const radius = Math.min(player.width, player.height) / 2;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#e91e90';
    ctx.fill();

    // Crown detail (triangle atop circle)
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.4, cy - radius);
    ctx.lineTo(cx, cy - radius - radius * 0.3);
    ctx.lineTo(cx + radius * 0.4, cy - radius);
    ctx.closePath();
    ctx.fillStyle = '#f1c40f';
    ctx.fill();

    // White border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Get player hitbox for collision detection.
 */
export function getPlayerHitbox() {
  if (!player) return null;
  return {
    x: player.x,
    y: player.y,
    width: player.width,
    height: player.height,
  };
}

// Store canvas dimensions for bounds checking
let canvasWidth = 0;
let canvasHeight = 0;
