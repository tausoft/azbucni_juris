// ============================================================
// Game HUD — target word, blank slots, score display
// ============================================================

import { t } from '../i18n/languages.js';
import gameManager from '../engine/state.js';
import { GameConstants, MinSizes } from '../engine/constants.js';

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
 * Render the word intro overlay — blurred background, centered word, prompt text.
 */
export function renderWordIntro(ctx, w, h) {
  const theme = gameManager.getTheme();

  // --- Draw blurred background ---
  ctx.save();
  ctx.filter = 'blur(8px)';

  if (theme === 'knight') {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1a5276');
    grad.addColorStop(1, '#2e86c1');
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#6c3483');
    grad.addColorStop(1, '#a569bd');
    ctx.fillStyle = grad;
  }
  ctx.fillRect(-20, -20, w + 40, h + 40);
  ctx.restore();

  // --- Darken overlay ---
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, w, h);

  // --- Centered target word (large) ---
  const wordFontSize = Math.max(48, w * 0.1);
  ctx.font = `bold ${wordFontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shadow for depth
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillText(currentWord || '', w / 2 + 3, h * 0.4 + 3);

  // Main text
  ctx.fillStyle = '#ffffff';
  ctx.fillText(currentWord || '', w / 2, h * 0.4);

  // --- Prompt text below (smaller) ---
  const promptText = t('hud.startPrompt');
  const promptFontSize = Math.max(MinSizes.UI_PROMPT, wordFontSize * 0.55);
  ctx.font = `${promptFontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText(promptText, w / 2, h * 0.4 + wordFontSize * 0.8);
}

/**
 * Render the game HUD (target word above slots, score display).
 */
export function renderGameHUD(ctx, w, h) {
  const hudHeight = h * GameConstants.HUD_HEIGHT_RATIO;
  const targetWordLabel = t('hud.targetWord');

  // HUD background bar
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(0, 0, w, hudHeight);

  // Score display (top-right)
  const scoreFontSize = Math.max(MinSizes.UI_SCORE, w * 0.025);
  ctx.font = `bold ${scoreFontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f1c40f';
  ctx.fillText(`${t('hud.score')}: ${gameManager.getScore()}`, w * 0.98, hudHeight * 0.12);

  // Lives display (top-left)
  const lives = gameManager.getLives();
  const livesText = `${t('hud.lives')}: ${'❤️'.repeat(lives)}${'🖤'.repeat(Math.max(0, GameConstants.MAX_LIVES - lives))}`;
  ctx.font = `bold ${scoreFontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(livesText, w * 0.02, hudHeight * 0.12);

  // --- Target word displayed above blank slots (top-right area of HUD) ---
  if (currentWord) {
    const wordFontSize = Math.max(MinSizes.UI_PROMPT, hudHeight * 0.28);
    ctx.font = `bold ${wordFontSize}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(currentWord, w * 0.98, hudHeight * 0.3);
    ctx.textBaseline = 'alphabetic';
  }

  // Word slots with blank/revealed letters
  const slotCount = currentWord ? currentWord.length : 0;
  const slotWidth = Math.min(w * 0.06, 50);
  const slotHeight = Math.max(36, hudHeight * 0.35);
  const slotGap = 6;
  const totalSlotsWidth = slotCount * slotWidth + (slotCount - 1) * slotGap;
  const startX = (w - totalSlotsWidth) / 2;
  const slotY = hudHeight * 0.55;

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

    // Letter text — minimum 36px for Cyrillic legibility (а/е, о/с, и/н must be distinguishable)
    const letterFontSize = Math.max(MinSizes.LETTER_FONT, slotWidth * 0.5);
    ctx.font = `bold ${letterFontSize}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isRevealed ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';
    ctx.fillText(isRevealed ? letter : '_', slotX + slotWidth / 2, slotY + slotHeight / 2);
  }
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
