// ============================================================
// main.js — Application Bootstrap
// ============================================================

import { GameState } from './engine/constants.js';
import gameManager from './engine/state.js';
import { startGameLoop, renderFrame } from './engine/gameLoop.js';
import { initPlayer, setDirection, stopPlayer } from './engine/player.js';
import { initAudioEngine } from './audio/soundEffects.js';
import { t, setLanguage } from './i18n/languages.js';
import { onMenuStartClick } from './components/menu.js';
import { onThemeSelectClick } from './components/themeSelect.js';
import { onEndScreenClick } from './components/endScreen.js';
import { isStartButtonHit } from './components/menu.js';
import { isKnightCardHit, isPrincessCardHit } from './components/themeSelect.js';
import { isEndScreenButtonHit } from './components/endScreen.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

/**
 * Set canvas dimensions to window size.
 */
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

/**
 * Bootstrap: initialize canvas, language, audio, and start the game loop.
 */
export function bootstrapApp() {
  // Initialize language from preferences
  const savedLang = gameManager.getLanguage();
  setLanguage(savedLang);

  // Resize canvas to full screen
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Initialize audio (will activate on first user gesture)
  initAudioEngine();

  // Initialize player with initial theme
  initPlayer(canvas.width, canvas.height);

  // Start the game loop
  startGameLoop(canvas, ctx);

  // Handle keyboard input for menu navigation AND player movement
  window.addEventListener('keydown', handleKeyboardInput);
  window.addEventListener('keyup', handleKeyUp);

  // Handle touch/mouse for buttons AND mobile player movement
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('touchstart', handleCanvasTouch, { passive: false });
  canvas.addEventListener('touchmove', handleCanvasTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleCanvasTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', handleCanvasTouchEnd, { passive: false });

  console.log(`🎮 ${t('menu.title')} — ${t('hud.score')}: ${gameManager.getScore()}`);
}

/**
 * Handle keyboard input for menu navigation AND player movement.
 */
function handleKeyboardInput(e) {
  const state = gameManager.getCurrentState();

  // Menu navigation
  if (state === GameState.MENU && e.key === 'Enter') {
    onMenuStartClick();
  } else if (state === GameState.THEME_SELECT && e.key === 'Enter') {
    onThemeSelectClick(gameManager.getTheme());
  } else if ((state === GameState.WORD_COMPLETE || state === GameState.GAME_OVER) && e.key === 'Enter') {
    onEndScreenClick();
  }

  // Player movement (left/right arrows or A/D keys)
  if (state === GameState.PLAYING) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      setDirection(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      setDirection(1);
    }
  }

  // Prevent scrolling on game keys
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
    e.preventDefault();
  }
}

/**
 * Handle keyup events — stop player movement when directional keys released.
 */
function handleKeyUp(e) {
  const state = gameManager.getCurrentState();
  if (state === GameState.PLAYING) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
        e.key === 'a' || e.key === 'A' ||
        e.key === 'd' || e.key === 'D') {
      stopPlayer();
    }
  }
}

/**
 * Handle canvas click for button interactions.
 */
function handleCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  handleInput(x, y);
}

/**
 * Handle canvas touchstart for mobile button interactions.
 */
function handleCanvasTouch(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  handleInput(x, y);
}

/**
 * Handle canvas touchmove for mobile player movement during gameplay.
 */
function handleCanvasTouchMove(e) {
  e.preventDefault();
  const state = gameManager.getCurrentState();
  if (state !== GameState.PLAYING) return;

  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;

  // Use a threshold to determine movement direction
  if (!handleCanvasTouchMove._lastX) {
    handleCanvasTouchMove._lastX = x;
    return;
  }

  const diff = x - handleCanvasTouchMove._lastX;
  if (Math.abs(diff) > 10) {
    setDirection(diff > 0 ? 1 : -1);
    handleCanvasTouchMove._lastX = x;
  }
}

/**
 * Handle canvas touchend — stop player movement when finger lifts.
 */
function handleCanvasTouchEnd(e) {
  e.preventDefault();
  handleCanvasTouchMove._lastX = null;
  stopPlayer();
}

/**
 * Dispatch input (mouse/touch) to current screen handler.
 */
function handleInput(x, y) {
  const state = gameManager.getCurrentState();

  switch (state) {
    case GameState.MENU:
      if (isStartButtonHit(x, y)) {
        onMenuStartClick();
      }
      break;

    case GameState.THEME_SELECT:
      if (isKnightCardHit(x, y)) {
        onThemeSelectClick('knight');
      } else if (isPrincessCardHit(x, y)) {
        onThemeSelectClick('princess');
      }
      break;

    case GameState.PLAYING:
      // Touch movement handled via touchmove in handleCanvasTouchMove
      break;

    case GameState.WORD_COMPLETE:
    case GameState.GAME_OVER:
      if (isEndScreenButtonHit(x, y)) {
        onEndScreenClick();
      }
      break;
  }
}

// Start the application
bootstrapApp();
