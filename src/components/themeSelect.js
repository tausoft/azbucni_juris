// ============================================================
// Theme Selection Screen — Knight vs Princess choice
// ============================================================

import { t } from '../i18n/languages.js';
import gameManager from '../engine/state.js';
import { GameState, Theme } from '../engine/constants.js';
import { playBeep } from '../audio/soundEffects.js';
import { initNewWord } from '../engine/letterSpawner.js';

/**
 * Render the theme selection screen.
 */
export function renderThemeSelect(ctx, w, h) {
  const title = t('theme.selectTitle');
  const knightLabel = t('theme.knightLabel');
  const princessLabel = t('theme.princessLabel');

  // Title
  const fontSize = Math.max(28, w * 0.045);
  ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, w / 2, h * 0.15);

  // Knight option (left side)
  const cardWidth = Math.min(w * 0.35, 180);
  const cardHeight = Math.min(h * 0.4, 250);
  const cardX1 = (w - cardWidth * 2 - 40) / 2;
  const cardY = h * 0.3;

  drawThemeCard(ctx, cardX1, cardY, cardWidth, cardHeight, Theme.KNIGHT, knightLabel);

  // Princess option (right side)
  const cardX2 = cardX1 + cardWidth + 40;
  drawThemeCard(ctx, cardX2, cardY, cardWidth, cardHeight, Theme.PRINCESS, princessLabel);

  // Store button bounds for click detection
  themeButtonBounds = {
    knight: { x: cardX1, y: cardY, width: cardWidth, height: cardHeight },
    princess: { x: cardX2, y: cardY, width: cardWidth, height: cardHeight },
  };
}

/**
 * Draw a single theme option card.
 */
function drawThemeCard(ctx, x, y, w, h, theme, label) {
  const isSelected = gameManager.getTheme() === theme;

  // Card background
  ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();

  // Card border
  ctx.strokeStyle = isSelected ? '#f1c40f' : 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = isSelected ? 4 : 2;
  roundRect(ctx, x, y, w, h, 16);
  ctx.stroke();

  // Draw character preview
  const charSize = Math.min(w, h) * 0.35;
  const cx = x + w / 2;
  const cy = y + h * 0.4;

  if (theme === Theme.KNIGHT) {
    drawKnightCharacter(ctx, cx - charSize / 2, cy - charSize / 2, charSize, charSize);
  } else {
    drawPrincessCharacter(ctx, cx, cy, charSize / 2);
  }

  // Label
  const labelFontSize = Math.max(18, w * 0.08);
  ctx.font = `bold ${labelFontSize}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, y + h * 0.82);
}

/**
 * Draw a knight character preview (blue rectangle with armor details).
 */
export function drawKnightCharacter(ctx, x, y, w, h) {
  ctx.fillStyle = '#3498db';
  ctx.fillRect(x, y, w, h);

  // White border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);

  // Visor slit
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + w * 0.25, y + h * 0.3, w * 0.5, h * 0.12);

  // Shield
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(x + w * 0.15, y + h * 0.55, w * 0.7, h * 0.35);
}

/**
 * Draw a princess character preview (pink circle with crown).
 */
export function drawPrincessCharacter(ctx, cx, cy, radius) {
  // Crown
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.6, cy - radius);
  ctx.lineTo(cx - radius * 0.3, cy - radius - radius * 0.35);
  ctx.lineTo(cx, cy - radius - radius * 0.15);
  ctx.lineTo(cx + radius * 0.3, cy - radius - radius * 0.35);
  ctx.lineTo(cx + radius * 0.6, cy - radius);
  ctx.closePath();
  ctx.fillStyle = '#f1c40f';
  ctx.fill();

  // Circle body
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#e91e90';
  ctx.fill();

  // White border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();
}

/**
 * Check if a point hits the knight card.
 */
export function isKnightCardHit(x, y) {
  if (!themeButtonBounds) return false;
  const b = themeButtonBounds.knight;
  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
}

/**
 * Check if a point hits the princess card.
 */
export function isPrincessCardHit(x, y) {
  if (!themeButtonBounds) return false;
  const b = themeButtonBounds.princess;
  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
}

/**
 * Handle theme selection click.
 */
export function onThemeSelectClick(theme) {
  playBeep('catch');
  gameManager.setTheme(theme);
  gameManager.resetGame();
  initNewWord();
  gameManager.transitionTo(GameState.WORD_INTRO);
}

let themeButtonBounds = null;

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
