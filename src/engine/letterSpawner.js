// ============================================================
// LetterSpawner — falling letter circles, collision detection
// ============================================================

import { GameConstants, GameState } from './constants.js';
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
    spawnLetter();
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
 * a target letter or a distractor, replacing the static DISTRACTOR_RATIO pool approach.
 */
function spawnLetter() {
  const canvasWidth = window.innerWidth;

  // Decide whether to spawn a target letter or a distractor
  const isTarget = Math.random() < GameConstants.TARGET_LETTER_CHANCE;
  const revealed = getRevealedCount();
  const word = currentTargetWord?.word;

  let char, isCorrect;

  if (isTarget && word && revealed < word.length) {
    // Spawn the next unrevealed target letter
    char = word[revealed];
    isCorrect = true;
  } else {
    // Spawn a distractor
    const allLetters = getDistractorLetters();
    char = allLetters[Math.floor(Math.random() * allLetters.length)];
    isCorrect = false;
  }

  const radius = Math.max(20, canvasWidth * GameConstants.LETTER_RADIUS_RATIO);

  fallingLetters.push({
    x: Math.random() * (canvasWidth - radius * 2) + radius,
    y: -radius * 2,
    radius,
    char,
    isCorrect,
  });
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
 */
export function checkCollisions() {
  const hitbox = getPlayerHitbox();
  if (!hitbox) return [];

  let caughtLetters = [];

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
      if (letter.isCorrect) {
        playBeep('catch');
        caughtLetters.push(letter.char);
      } else {
        playBeep('miss');
        gameManager.loseLife();
        if (gameManager.getLives() <= 0) {
          onGameOver();
        }
      }

      // Remove letter from pool immediately to prevent re-triggering
      fallingLetters.splice(i, 1);
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
