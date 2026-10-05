// ============================================================
// Scoring — points calculation and accumulation
// ============================================================

import gameManager from './state.js';
import { checkCollisions, getCurrentTargetWord, onWordComplete } from './letterSpawner.js';
import { revealNextLetter, getRevealedCount } from '../components/gameHUD.js';

let lastCollisionCheck = 0;
const COLLISION_CHECK_INTERVAL = 0.05; // Check collisions every 50ms

/**
 * Update scoring logic (called each frame).
 * Validates caught letters against the target word and advances progress only on matches.
 * FIX: Rewrote to address two critical bugs:
 *   1. Silent discard — previously only caughtLetters[0] was validated; remaining catches
 *      (including correct ones) were silently lost when a distractor was caught simultaneously.
 *      Now ALL caught letters are processed sequentially, advancing the revealed index each time.
 *   2. Cooldown dead zone — previously lastRevealTime was only set on success, creating a 300ms
 *      window where correct catches were ignored after a wrong catch. Removed the cooldown gate
 *      entirely; all caught letters are now processed regardless of timing.
 */
export function updateScoring(deltaTime) {
  lastCollisionCheck += deltaTime;

  if (lastCollisionCheck >= COLLISION_CHECK_INTERVAL) {
    lastCollisionCheck = 0;

    // Get caught letters from collision detection
    const caughtLetters = checkCollisions();

    // Nothing caught — nothing to process
    if (caughtLetters.length === 0) return;

    const targetWord = getCurrentTargetWord();
    if (!targetWord) return;

    // Process ALL caught letters sequentially, advancing revealedIndex for each match.
    // This fixes the "silent discard" bug where only the first catch was validated.
    for (const char of caughtLetters) {
      const revealed = getRevealedCount();
      const expectedChar = targetWord.word[revealed];

      if (char === expectedChar && revealed < targetWord.word.length) {
        // Correct letter — reveal it and advance progress
        revealNextLetter();

        // Check for word completion after successful match
        if (getRevealedCount() >= targetWord.word.length) {
          onWordComplete();
          return; // Word complete — stop processing further catches
        }
      }
      // If char !== expectedChar, it's a distractor — lives are already deducted
      // in checkCollisions(). We simply skip it here (no double penalty).
    }
  }
}

/**
 * Get current score.
 */
export function getScore() {
  return gameManager.getScore();
}