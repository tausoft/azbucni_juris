// ============================================================
// Scoring — points calculation and accumulation
// ============================================================

import gameManager from './state.js';
import { checkCollisions } from './letterSpawner.js';

let lastCollisionCheck = 0;
const COLLISION_CHECK_INTERVAL = 0.05; // Check collisions every 50ms

/**
 * Update scoring logic (called each frame).
 */
export function updateScoring(deltaTime) {
  lastCollisionCheck += deltaTime;

  if (lastCollisionCheck >= COLLISION_CHECK_INTERVAL) {
    lastCollisionCheck = 0;
    checkCollisions();
  }
}

/**
 * Get current score.
 */
export function getScore() {
  return gameManager.getScore();
}
