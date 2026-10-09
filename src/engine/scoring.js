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
 *
 * NEW: checkCollisions() now returns structured objects { char, result } where result is:
 *   - 'perfect'    — exact needed character caught (advance progress)
 *   - 'valid-later' — letter exists in word but not needed yet (no penalty, no progress)
 *   - 'wrong'      — distractor caught (life lost, no progress)
 */
export function updateScoring(deltaTime) {
  lastCollisionCheck += deltaTime;

  if (lastCollisionCheck >= COLLISION_CHECK_INTERVAL) {
    lastCollisionCheck = 0;

    // Get caught letters from collision detection (now returns { char, result } objects)
    const caughtLetters = checkCollisions();

    // Nothing caught — nothing to process
    if (caughtLetters.length === 0) return;

    const targetWord = getCurrentTargetWord();
    if (!targetWord) return;

    // Process ALL caught letters sequentially, advancing revealedIndex for each 'perfect' match.
    // This fixes the "silent discard" bug where only the first catch was validated.
    for (const { char, result } of caughtLetters) {
      const revealed = getRevealedCount();
      const expectedChar = targetWord.word[revealed];

      if (result === 'perfect' && char === expectedChar && revealed < targetWord.word.length) {
        // Correct letter — reveal it and advance progress
        revealNextLetter();

        // Log successful progress
        console.log(
          `[SCORE] char="${char}" result="perfect" revealedIndex=${revealed} → ${revealed + 1} score=${gameManager.getScore()}`
        );

        // Check for word completion after successful match
        if (getRevealedCount() >= targetWord.word.length) {
          onWordComplete();
          return; // Word complete — stop processing further catches
        }
      } else if (result === 'valid-later') {
        // Valid letter but not needed yet — no penalty, no progress
        console.log(
          `[SCORE] char="${char}" result="valid-later" (letter exists in word but not needed yet)`
        );
      }
      // If result === 'wrong', it's a distractor — lives are already deducted
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