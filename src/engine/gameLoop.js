// ============================================================
// Core Game Loop — requestAnimationFrame update/render cycle
// ============================================================

import { GameState } from './constants.js';
import gameManager from './state.js';
import { renderMenu } from '../components/menu.js';
import { renderThemeSelect } from '../components/themeSelect.js';
import { renderGameHUD, renderWordIntro } from '../components/gameHUD.js';
import { renderEndScreen } from '../components/endScreen.js';
import { updatePlayer, drawPlayer } from './player.js';
import { updateFallingLetters, drawFallingLetters } from './letterSpawner.js';
import { updateScoring } from './scoring.js';

let animationId = null;
let lastTime = 0;

/**
 * Start the game loop with requestAnimationFrame.
 */
export function startGameLoop(canvas, ctx) {
  // Capture canvas and ctx in closure scope for inner functions
  const _canvas = canvas;
  const _ctx = ctx;

  lastTime = performance.now();

  /**
   * Main game loop — update then render each frame.
   */
  function gameLoop(timestamp) {
    const deltaTime = (timestamp - lastTime) / 1000; // seconds
    lastTime = timestamp;

    const state = gameManager.getCurrentState();

    // Update based on current state
    switch (state) {
      case GameState.PLAYING:
        updatePlayer(deltaTime);
        updateFallingLetters(deltaTime);
        updateScoring(deltaTime);
        break;
    }

    // Render current screen
    renderFrame(_ctx, _canvas, state);

    animationId = requestAnimationFrame(gameLoop);
  }

  animationId = requestAnimationFrame(gameLoop);
}

/**
 * Render the current game screen.
 */
export function renderFrame(ctx, canvas, state) {
  const w = canvas.width;
  const h = canvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, w, h);

  // Draw themed background
  drawBackground(ctx, w, h);

  switch (state) {
    case GameState.MENU:
      renderMenu(ctx, w, h);
      break;

    case GameState.THEME_SELECT:
      renderThemeSelect(ctx, w, h);
      break;

    case GameState.WORD_INTRO:
      renderWordIntro(ctx, w, h);
      break;

    case GameState.PLAYING:
      drawPlayer(ctx);
      drawFallingLetters(ctx);
      renderGameHUD(ctx, w, h);
      break;

    case GameState.WORD_COMPLETE:
      drawPlayer(ctx);
      drawFallingLetters(ctx);
      renderEndScreen(ctx, w, h, 'win');
      break;

    case GameState.GAME_OVER:
      renderEndScreen(ctx, w, h, 'lose');
      break;

    default:
      break;
  }
}

/**
 * Draw themed background gradient.
 */
function drawBackground(ctx, w, h) {
  const theme = gameManager.getTheme();
  let topColor, bottomColor;

  if (theme === 'knight') {
    topColor = '#1a5276';
    bottomColor = '#2e86c1';
  } else {
    topColor = '#6c3483';
    bottomColor = '#a569bd';
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Stop the game loop (for cleanup).
 */
export function stopGameLoop() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}
