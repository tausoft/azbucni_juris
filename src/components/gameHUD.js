// ============================================================
// Game HUD — target word, blank slots, score display
// ============================================================

import { t } from '../i18n/languages.js';
import gameManager from '../engine/state.js';
import { GameConstants } from '../engine/constants.js';

let currentWord = null;
let revealedIndex = 0;

/**
 * Initialize HUD with a target word.
 */
export function initHUD(wordData) {
  currentWord = wordData.word;
  revealedIndex = 0;
}

/**
 * Reveal the next letter in the word.
 */
export function revealNextLetter() {
  if (currentWord && revealedIndex < currentWord.length) {
    revealedIndex++;
  }
  return revealedIndex;
}

/**
 * Reset revealed letters (for new word).
 */
export function resetRevealed() {
  revealedIndex = 0;
}

/**
 * Get the number of revealed letters.
 */
export function getRevealedCount() {
  return revealedIndex;
}

/**
 * Render the game HUD (target word with blank slots, score).
 */
export function renderGameHUD(ctx, w, h) {
  const hudHeight = h * GameConstants.HUD_HEIGHT_RATIO;
  const targetWord = t('hud.targetWord');

  // HUD background bar
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, w, hudHeight);

  // Target word label
  const labelFontSize = Math.max(16, w * 0.025);
  ctx.font = `bold ${labelFontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(targetWord, w * 0.02, h * 0.04);

  // Word slots with blank/revealed letters
  const slotCount = currentWord ? currentWord.length : 0;
  const slotWidth = Math.min(w * 0.08, 60);
  const slotHeight = Math.max(40, h * 0.05);
  const slotGap = 8;
  const totalSlotsWidth = slotCount * slotWidth + (slotCount - 1) * slotGap;
  const startX = (w - totalSlotsWidth) / 2;
  const slotY = h * 0.1;

  for (let i = 0; i < slotCount; i++) {
    const slotX = startX + i * (slotWidth + slotGap);
    const isRevealed = i < revealedIndex;
    const letter = currentWord ? currentWord[i] : '_';

    // Slot background
    ctx.fillStyle = isRevealed ? GameConstants.COLORS.correctSlot : GameConstants.COLORS.emptySlot;
    roundRect(ctx, slotX, slotY, slotWidth, slotHeight, 8);
    ctx.fill();

    // Slot border
    ctx.strokeStyle = GameConstants.COLORS.slotBorder;
    ctx.lineWidth = 2;
    roundRect(ctx, slotX, slotY, slotWidth, slotHeight, 8);
    ctx.stroke();

    // Letter text
    const letterFontSize = Math.max(20, slotWidth * 0.55);
    ctx.font = `bold ${letterFontSize}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isRevealed ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';
    ctx.fillText(isRevealed ? letter : '_', slotX + slotWidth / 2, slotY + slotHeight / 2);
  }

  // Score display (top-right)
  const score = gameManager.getScore();
  const scoreText = `${t('hud.score')}: ${score}`;
  ctx.font = `bold ${labelFontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f1c40f';
  ctx.fillText(scoreText, w * 0.98, h * 0.04);

  // Lives display (top-left, below label)
  const lives = gameManager.getLives();
  const livesText = `${t('hud.lives')}: ${'❤️'.repeat(lives)}${'🖤'.repeat(Math.max(0, GameConstants.MAX_LIVES - lives))}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(livesText, w * 0.02, h * 0.08);
}

/**
 * Helper: draw a rounded rectangle.
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
