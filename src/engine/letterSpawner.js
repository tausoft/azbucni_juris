// ============================================================
// LetterSpawner — falling letter circles, collision detection
// ============================================================

import { GameConstants, GameState, MinSizes } from './constants.js';
import gameManager from './state.js';
import { getPlayerHitbox } from './player.js';
import { initHUD, revealNextLetter, resetRevealed, getRevealedCount } from '../components/gameHUD.js';
import { playBeep } from '../audio/soundEffects.js';
import { getRandomWord, getDistractorLetters } from '../data/words.js';

let fallingLetters = [];
let currentTargetWord = null;
let spawnTimer = 0;
let poolIndex = 0;
let letterPool = [];
let wordCompleted = false; // guard against re-entry during WORD_COMPLETE state

/**
 * Initialize a new word and generate the letter pool.
 */
export function initNewWord() {
  const tier = gameManager.getCurrentTier();
  const wordData = getRandomWord(tier);
  currentTargetWord = wordData;

  // Initialize HUD with this word
  initHUD(wordData);
  resetRevealed();

  // Generate letter pool: correct letters + distractors
  generateLetterPool(wordData.word);

  // Clear existing falling letters
  fallingLetters = [];
  spawnTimer = 0;
  poolIndex = 0;
  wordCompleted = false; // reset completion guard for new word
}

/**
 * Generate a pool of letters for the current word.
 */
function generateLetterPool(word) {
  letterPool = [];

  // Add each correct letter (with duplicates for repeated letters)
  const letterCounts = {};
  for (const char of word) {
    letterCounts[char] = (letterCounts[char] || 0) + 1;
  }

  for (const [char, count] of Object.entries(letterCounts)) {
    for (let i = 0; i < count; i++) {
      letterPool.push({ char, isCorrect: true });
    }
  }

  // Add distractor letters
  const distCount = Math.max(3, word.length * GameConstants.DISTRACTOR_RATIO);
  const allLetters = getDistractorLetters();
  for (let i = 0; i < distCount; i++) {
    const randomChar = allLetters[Math.floor(Math.random() * allLetters.length)];
    letterPool.push({ char: randomChar, isCorrect: false });
  }

  // Shuffle pool
  for (let i = letterPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letterPool[i], letterPool[j]] = [letterPool[j], letterPool[i]];
  }

  poolIndex = 0;
}

/**
 * Regenerate the full letter pool for the current word.
 * Preserves any correct letters already revealed (via getRevealedCount()),
 * and regenerates only the remaining unrevealed correct letters plus fresh distractors.
 */
function regenerateLetterPool() {
  const revealed = getRevealedCount();
  const word = currentTargetWord.word;
  letterPool = [];

  // Add remaining correct letters (those not yet revealed)
  for (let i = revealed; i < word.length; i++) {
    letterPool.push({ char: word[i], isCorrect: true });
  }

  // Add fresh distractors
  const distCount = Math.max(3, word.length * GameConstants.DISTRACTOR_RATIO);
  const allLetters = getDistractorLetters();
  for (let i = 0; i < distCount; i++) {
    const randomChar = allLetters[Math.floor(Math.random() * allLetters.length)];
    letterPool.push({ char: randomChar, isCorrect: false });
  }

  // Shuffle pool
  for (let i = letterPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letterPool[i], letterPool[j]] = [letterPool[j], letterPool[i]];
  }

  poolIndex = 0;
}

/**
 * Update falling letters — move them down and spawn new ones.
 */
export function updateFallingLetters(deltaTime) {
  const canvasHeight = window.innerHeight;
  const speedMultiplier = gameManager.getCurrentTier() * 0.5 + 0.5;
  const baseSpeed = (canvasHeight * GameConstants.LETTER_BASE_SPEED_RATIO) * speedMultiplier;

  // Move letters down
  for (let i = fallingLetters.length - 1; i >= 0; i--) {
    const letter = fallingLetters[i];
    letter.y += baseSpeed * deltaTime;

    // Remove if off-screen
    if (letter.y > canvasHeight + letter.radius) {
      fallingLetters.splice(i, 1);
    }
  }

  // Spawn new letters periodically; regenerate pool when exhausted
  spawnTimer += deltaTime * 1000;
  if (spawnTimer >= GameConstants.SPAWN_INTERVAL_MS) {
    const canvasWidth = window.innerWidth;
    spawnLetter(canvasWidth);
    spawnTimer = 0;
  }

  // Note: Word completion is now driven by catching correct letters in order,
  // not by unconditional frame-based advancement. The win guard remains here
  // to prevent re-entry if onWordComplete() is triggered from elsewhere.
  // (No action needed — wordCompleted flag prevents double-trigger.)
}

/**
 * Spawn a single falling letter.
 * Uses TARGET_LETTER_CHANCE (0.0–1.0) for runtime decision on whether to spawn
 * a target letter or a distractor.
 *
 * NEW LOGIC: When spawning a target letter, randomly pick from UNREVEALED word
 * characters (not always the next needed one). This preserves challenge by allowing
 * players to catch future target letters — they won't lose lives, but progress
 * only advances when the exact next character is caught.
 */
function spawnLetter(canvasWidth) {
  const revealed = getRevealedCount();
  const word = currentTargetWord?.word;

  // Decide whether to spawn a target letter or a distractor
  // Compute radius first so both branches share the same value
  const radius = Math.max(MinSizes.LETTER_FONT / 0.8, canvasWidth * GameConstants.LETTER_RADIUS_RATIO);

  if (Math.random() < GameConstants.TARGET_LETTER_CHANCE && word && revealed < word.length) {
    // Target spawn — pick ANY unrevealed character from the word
    const unrevealedChars = [];
    for (let i = revealed; i < word.length; i++) {
      unrevealedChars.push(word[i]);
    }

    const char = unrevealedChars[Math.floor(Math.random() * unrevealedChars.length)];


    fallingLetters.push({
      x: Math.random() * (canvasWidth - radius * 2) + radius,
      y: -radius * 2,
      radius,
      char,
    });

    console.log(
      `[SPAWN] char="${char}" targetWord="${word}" revealedIndex=${revealed}`
    );
  } else {
    // Distractor spawn — pick from Cyrillic alphabet minus current word chars
    const allLetters = getDistractorLetters();
    const char = allLetters[Math.floor(Math.random() * allLetters.length)];


    fallingLetters.push({
      x: Math.random() * (canvasWidth - radius * 2) + radius,
      y: -radius * 2,
      radius,
      char,
    });

    console.log(
      `[SPAWN] char="${char}" targetWord="${word}" revealedIndex=${revealed}`
    );
  }
}

/**
 * Draw all falling letters on canvas.
 */
export function drawFallingLetters(ctx) {
  for (const letter of fallingLetters) {
    // Circle background
    ctx.beginPath();
    ctx.arc(letter.x, letter.y, letter.radius, 0, Math.PI * 2);
    ctx.fillStyle = GameConstants.COLORS.letterCircle;
    ctx.fill();

    // Circle border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Letter text
    const fontSize = letter.radius * 0.8;
    ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = GameConstants.COLORS.letterText;
    ctx.fillText(letter.char, letter.x, letter.y);
  }
}

/**
 * Check for collisions between player and falling letters.
 * Returns an array of structured result objects with a 'result' field:
 *   - { char, result: 'perfect' }     — exact needed character caught
 *   - { char, result: 'valid-later' } — letter exists in word but not needed yet
 *   - { char, result: 'wrong' }        — distractor caught (life lost)
 *
 * FIX: Classification is now done DYNAMICALLY at collision time using the CURRENT
 * game state (revealedIndex), NOT from stale spawn-time flags. This ensures that
 * a letter falling for multiple frames is correctly classified even if revealedIndex
 * changes between when it was spawned and when it's caught.
 */
export function checkCollisions() {
  const hitbox = getPlayerHitbox();
  if (!hitbox) return [];

  // Get current game state — classification uses THIS, not spawn-time data
  const targetWord = getCurrentTargetWord();
  const revealed = getRevealedCount();
  const expectedChar = targetWord?.word[revealed];

  const caughtLetters = [];

  for (let i = fallingLetters.length - 1; i >= 0; i--) {
    const letter = fallingLetters[i];

    // Tight circle-to-rectangle bounding-box overlap test.
    // FIX: Old code used inflated circle-to-circle distance:
    //   distance < letter.radius + Math.min(hitbox.width, hitbox.height) / 2
    // which created a ~90px detection radius (54px hitbox inflation + 36px letter).
    // New approach finds closest point on the rectangle to circle center and checks
    // if that distance is less than the letter radius — collision only at actual overlap.
    const closestX = Math.max(hitbox.x, Math.min(letter.x, hitbox.x + hitbox.width));
    const closestY = Math.max(hitbox.y, Math.min(letter.y, hitbox.y + hitbox.height));

    const dx = letter.x - closestX;
    const dy = letter.y - closestY;
    const distanceSquared = dx * dx + dy * dy;

    if (distanceSquared < letter.radius * letter.radius) {
      // Collision detected (tight bounding-box overlap)
      let result;

      // DYNAMIC classification against CURRENT game state, not spawn-time flags
      if (expectedChar && letter.char === expectedChar) {
        // ✅ Perfect catch — matches the character currently needed
        result = 'perfect';
        playBeep('catch');
      } else if (targetWord && targetWord.word.includes(letter.char)) {
        // ⏳ Valid letter — exists in word but not the current needed one
        result = 'valid-later';
        playBeep('catch'); // still a satisfying sound, just no progress
      } else {
        // ❌ Distractor — lose life
        result = 'wrong';
        playBeep('miss');
        gameManager.loseLife();
        if (gameManager.getLives() <= 0) {
          onGameOver();
        }
      }

      caughtLetters.push({ char: letter.char, result });

      // Remove letter from falling letters immediately to prevent re-triggering
      fallingLetters.splice(i, 1);

      // Log collision details
      console.log(
        `[CATCH] char="${letter.char}" result="${result}" revealedIndex=${revealed} expected="${expectedChar}" hitbox={x:${letter.x.toFixed(0)},y:${letter.y.toFixed(0)},r:${letter.radius}} vs player={x:${hitbox.x.toFixed(0)},y:${hitbox.y.toFixed(0)},w:${hitbox.width.toFixed(0)},h:${hitbox.height.toFixed(0)}}`
      );
    }
  }

  return caughtLetters;
}

/**
 * Handle word completion.
 */
export function onWordComplete() {
  // Prevent re-entry if already completed
  if (wordCompleted) return;
  wordCompleted = true;

  const score = currentTargetWord.word.length * 10;
  gameManager.addScore(score);
  gameManager.recordWordComplete();
  playBeep('win');

  // Transition to WORD_COMPLETE state — end screen will be rendered by gameLoop
  gameManager.transitionTo(GameState.WORD_COMPLETE);
}

/**
 * Handle game over.
 */
function onGameOver() {
  playBeep('lose');
  gameManager.transitionTo(GameState.GAME_OVER);
}

/**
 * Get the current target word for HUD display.
 */
export function getCurrentTargetWord() {
  return currentTargetWord;
}
