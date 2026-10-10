// ============================================================
// Menu Screen — title and start button rendering
// ============================================================

import { t } from '../i18n/languages.js';
import gameManager from '../engine/state.js';
import { GameState, MinSizes } from '../engine/constants.js';
import { playBeep } from '../audio/soundEffects.js';

/**
 * Render the main menu screen.
 */
export function renderMenu(ctx, w, h) {
  const title = t('menu.title');
  const buttonText = t('menu.startButton');

  // Title text
  const fontSize = Math.max(36, w * 0.06);
  ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Title shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillText(title, w / 2 + 3, h * 0.35 + 3);

  // Title text
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, w / 2, h * 0.35);

  // Start button
  const btnWidth = Math.min(w * 0.4, 200);
  const btnHeight = Math.max(48, h * 0.06);
  const btnX = (w - btnWidth) / 2;
  const btnY = h * 0.55;

  // Button background
  ctx.fillStyle = '#27ae60';
  roundRect(ctx, btnX, btnY, btnWidth, btnHeight, 12);
  ctx.fill();

  // Button border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  roundRect(ctx, btnX, btnY, btnWidth, btnHeight, 12);
  ctx.stroke();

  // Button text — Cyrillic legibility floor of 22px
  const btnFontSize = Math.max(MinSizes.UI_BUTTON, btnWidth * 0.08);
  ctx.font = `bold ${btnFontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(buttonText, w / 2, btnY + btnHeight / 2);

  // Store button bounds for click detection
  menuButtonBounds = { x: btnX, y: btnY, width: btnWidth, height: btnHeight };
}

/**
 * Check if a point is inside the start button.
 */
export function isStartButtonHit(x, y) {
  if (!menuButtonBounds) return false;
  return (
    x >= menuButtonBounds.x &&
    x <= menuButtonBounds.x + menuButtonBounds.width &&
    y >= menuButtonBounds.y &&
    y <= menuButtonBounds.y + menuButtonBounds.height
  );
}

/**
 * Handle start button click.
 */
export function onMenuStartClick() {
  playBeep('catch');
  gameManager.transitionTo(GameState.THEME_SELECT);
}

let menuButtonBounds = null;

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
