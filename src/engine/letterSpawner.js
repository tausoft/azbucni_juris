// ============================================================
// LetterSpawner — falling letter circles, collision detection
// ============================================================

import { GameConstants, GameState } from './constants.js';
import gameManager from './state.js';
import { getPlayerHitbox } from './player.js';
import { initHUD, revealNextLetter, resetRevealed } from '../components/gameHUD.js';
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

  // Spawn new letters periodically
  spawnTimer += deltaTime * 1000;
  if (spawnTimer >= GameConstants.SPAWN_INTERVAL_MS && poolIndex < letterPool.length) {
    spawnLetter();
    spawnTimer = 0;
  }

  // Check if word is complete (guard against re-entry)
  if (!wordCompleted && currentTargetWord && revealNextLetter() >= currentTargetWord.word.length) {
    onWordComplete();
  }
}

/**
 * Spawn a single falling letter.
 */
function spawnLetter() {
  if (poolIndex >= letterPool.length) return;

  const canvasWidth = window.innerWidth;
  const letterData = letterPool[poolIndex];
  const radius = Math.max(20, canvasWidth * GameConstants.LETTER_RADIUS_RATIO);

  fallingLetters.push({
    x: Math.random() * (canvasWidth - radius * 2) + radius,
    y: -radius * 2,
    radius,
    char: letterData.char,
    isCorrect: letterData.isCorrect,
  });

  poolIndex++;
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
  if (!hitbox) return false;

  let caughtAny = false;

  for (let i = fallingLetters.length - 1; i >= 0; i--) {
    const letter = fallingLetters[i];
    const dx = letter.x - (hitbox.x + hitbox.width / 2);
    const dy = letter.y - (hitbox.y + hitbox.height / 2);
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < letter.radius + Math.min(hitbox.width, hitbox.height) / 2) {
      // Collision detected
      if (letter.isCorrect) {
        playBeep('catch');
        caughtAny = true;
      } else {
        playBeep('miss');
        gameManager.loseLife();
        if (gameManager.getLives() <= 0) {
          onGameOver();
        }
      }

      // Remove letter from pool
      fallingLetters.splice(i, 1);
    }
  }

  return caughtAny;
}

/**
 * Handle word completion.
 */
function onWordComplete() {
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
  gameManager.transitionTo('game_over');
}

/**
 * Get the current target word for HUD display.
 */
export function getCurrentTargetWord() {
  return currentTargetWord;
}
