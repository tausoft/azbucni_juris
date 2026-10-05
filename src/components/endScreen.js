// ============================================================
// End Screen — win / game over overlay
// ============================================================

import { t } from '../i18n/languages.js';
import gameManager from '../engine/state.js';
import { GameState } from '../engine/constants.js';
import { playBeep } from '../audio/soundEffects.js';
import { initNewWord } from '../engine/letterSpawner.js';
import { resetRevealed } from '../components/gameHUD.js';

let endScreenType = null;

/**
 * Render the end screen (win or lose).
 */
export function renderEndScreen(ctx, w, h, type) {
  endScreenType = type;

  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, w, h);

  const message = type === 'win' ? t('wordComplete.win') : t('gameOver.lose');
  const buttonText = type === 'win' ? t('wordComplete.nextButton') : t('gameOver.retryButton');

  // Message text
  const fontSize = Math.max(28, w * 0.045);
  ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = type === 'win' ? '#2ecc71' : '#e74c3c';
  ctx.fillText(message, w / 2, h * 0.4);

  // Score display
  const scoreText = `${t('hud.score')}: ${gameManager.getScore()}`;
  ctx.font = `${fontSize * 0.8}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = '#f1c40f';
  ctx.fillText(scoreText, w / 2, h * 0.5);

  // Button
  const btnWidth = Math.min(w * 0.4, 200);
  const btnHeight = Math.max(48, h * 0.06);
  const btnX = (w - btnWidth) / 2;
  const btnY = h * 0.6;

  ctx.fillStyle = '#3498db';
  roundRect(ctx, btnX, btnY, btnWidth, btnHeight, 12);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  roundRect(ctx, btnX, btnY, btnWidth, btnHeight, 12);
  ctx.stroke();

  const btnFontSize = Math.max(20, btnWidth * 0.08);
  ctx.font = `bold ${btnFontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(buttonText, w / 2, btnY + btnHeight / 2);

  // Store button bounds
  endScreenButtonBounds = { x: btnX, y: btnY, width: btnWidth, height: btnHeight };
}

/**
 * Check if a point hits the end screen button.
 */
export function isEndScreenButtonHit(x, y) {
  if (!endScreenButtonBounds) return false;
  const b = endScreenButtonBounds;
  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
}

/**
 * Handle end screen button click.
 */
export function onEndScreenClick() {
  playBeep('catch');
  if (endScreenType === 'win') {
    // Reset revealed state for the new word (initNewWord handles this, but be explicit)
    resetRevealed();
    // Start next word before transitioning to PLAYING
    initNewWord();
    gameManager.transitionTo(GameState.PLAYING);
  } else {
    gameManager.resetGame();
    initNewWord();
    gameManager.transitionTo(GameState.PLAYING);
  }
}

let endScreenButtonBounds = null;

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
