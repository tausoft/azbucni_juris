// ============================================================
// GameStateManager — manages game lifecycle & preferences
// ============================================================

import { GameState, Theme, GameConstants } from './constants.js';
import { stopPlayer } from './player.js';

class GameStateManager {
  constructor() {
    this.currentState = GameState.MENU;
    this.theme = this.loadPreference('theme') || Theme.KNIGHT;
    this.language = this.loadPreference('language') || 'sr_cyr';
    this.score = 0;
    this.lives = 3;
    this.currentTier = 1;
    this.wordsCompleted = 0;
    this.onStateChange = null; // callback for screen transitions
  }

  getCurrentState() {
    return this.currentState;
  }

  transitionTo(newState) {
    const prev = this.currentState;

    // Stop player movement when leaving PLAYING state (Bug #1 fix)
    if (prev === GameState.PLAYING &&
        (newState === GameState.WORD_COMPLETE || newState === GameState.GAME_OVER)) {
      stopPlayer();
    }

    this.currentState = newState;
    if (this.onStateChange) {
      this.onStateChange(newState, prev);
    }
  }

  setTheme(theme) {
    this.theme = theme;
    this.savePreference('theme', theme);
  }

  getTheme() {
    return this.theme;
  }

  setLanguage(lang) {
    this.language = lang;
    this.savePreference('language', lang);
  }

  getLanguage() {
    return this.language;
  }

  addScore(points) {
    this.score += points;
  }

  getScore() {
    return this.score;
  }

  incrementLives() {
    this.lives = Math.min(this.lives + 1, 3);
  }

  loseLife() {
    this.lives = Math.max(this.lives - 1, 0);
  }

  getLives() {
    return this.lives;
  }

  advanceTier() {
    this.currentTier = Math.min(this.currentTier + 1, 3);
  }

  getCurrentTier() {
    return this.currentTier;
  }

  recordWordComplete() {
    this.wordsCompleted++;
    if (this.wordsCompleted % GameConstants.WORDS_TO_ADVANCE_TIER === 0) {
      this.advanceTier();
    }
  }

  getWordsCompleted() {
    return this.wordsCompleted;
  }

  resetGame() {
    this.score = 0;
    this.lives = 3;
    this.currentTier = 1;
    this.wordsCompleted = 0;
  }

  savePreference(key, value) {
    try {
      localStorage.setItem(`azbucni_${key}`, value);
    } catch (_) { /* ignore */ }
  }

  loadPreference(key) {
    try {
      return localStorage.getItem(`azbucni_${key}`);
    } catch (_) {
      return null;
    }
  }
}

// Singleton instance
const gameManager = new GameStateManager();
export default gameManager;
