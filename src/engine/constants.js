// ============================================================
// Game Constants & Enums
// ============================================================

/** @enum {string} */
export const GameState = {
  MENU: 'menu',
  THEME_SELECT: 'theme_select',
  WORD_INTRO: 'word_intro',
  PLAYING: 'playing',
  WORD_COMPLETE: 'word_complete',
  GAME_OVER: 'game_over',
};

/** @enum {string} */
export const Theme = {
  KNIGHT: 'knight',
  PRINCESS: 'princess',
};

// Game dimensions (relative to canvas width)
export const GameConstants = {
  // Player
  PLAYER_WIDTH_RATIO: 0.06,    // 6% of canvas width
  PLAYER_HEIGHT_RATIO: 0.08,   // 8% of canvas height
  PLAYER_SPEED_RATIO: 0.3,     // 30% of canvas width per second

  // Falling letters
  LETTER_RADIUS_RATIO: 0.035,  // letter circle radius as % of canvas width
  LETTER_BASE_SPEED_RATIO: 0.12, // pixels per frame at 60fps, relative to height

  // Spawning
  SPAWN_INTERVAL_MS: 1200,     // ms between letter spawns
  LETTER_POOL_SIZE_RATIO: 0.4, // pool = targetWord length * this ratio (min 3)
  DISTRACTOR_RATIO: 3,         // for every 1 correct letter, 3 distractors
  TARGET_LETTER_CHANCE: 0.35,  // probability (0.0–1.0) that a spawned letter is a target letter (runtime spawn decision)

  // HUD
  HUD_HEIGHT_RATIO: 0.25,      // top HUD area as % of canvas height
  SCORE_POSITION_Y_RATIO: 0.03,

  // Difficulty
  WORDS_TO_ADVANCE_TIER: 3,    // words needed to advance difficulty tier

  // Lives
  MAX_LIVES: 3,

  // Colors (phase-appropriate)
  COLORS: {
    knightBgTop: '#1a5276',
    knightBgBottom: '#2e86c1',
    princessBgTop: '#6c3483',
    princessBgBottom: '#a569bd',
    letterCircle: '#f9e79f',
    letterText: '#1a1a2e',
    correctSlot: '#27ae60',
    wrongSlot: '#e74c3c',
    emptySlot: '#7f8c8d',
    slotBorder: '#ffffff',
  },
};
