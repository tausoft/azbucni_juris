# 📋 Azbučni Juriš — Codebase Analysis

---

## 1. Architecture Overview

The game follows a **modular, component-based architecture** built around an HTML5 Canvas with a `requestAnimationFrame` game loop. The project is structured into these key areas:

```
src/
├── main.js              — Bootstrap & input handling (keyboard/touch/mouse)
├── engine/
│   ├── constants.js     — GameState enum, Theme enum, GameConstants, MinSizes
│   ├── state.js         — GameStateManager (singleton: score, lives, theme, tier)
│   ├── gameLoop.js      — Core update/render cycle
│   ├── player.js        — Sprite animation system (idle/run/victory)
│   ├── letterSpawner.js — Falling letters, collision detection, word management
│   └── scoring.js       — Collision result processing & score accumulation
├── components/
│   ├── menu.js          — Main menu screen
│   ├── themeSelect.js   — Knight vs Princess character selection
│   ├── gameHUD.js       — Target word display, blank slots, score/lives HUD
│   └── endScreen.js     — Win/Game Over overlay
├── audio/
│   └── soundEffects.js  — Web Audio API synth (no external files)
├── i18n/
│   └── languages.js     — Centralized translation dictionary (sr_cyr, sr_lat, en)
└── data/
    ├── words.json       — Tiered word database (3 tiers: 3-5 letter words)
    └── words.js         — Word loading & random selection helpers
```

---

## 2. Core Systems Analysis

### Game State Machine
The game transitions through **6 states**:
1. **MENU** → Main title screen with Start button
2. **THEME_SELECT** → Choose Knight or Princess character
3. **WORD_INTRO** → Blurred overlay showing target word
4. **PLAYING** → Active gameplay (player moves, letters fall)
5. **WORD_COMPLETE** → Victory screen (word finished)
6. **GAME_OVER** → Loss screen (lives depleted)

**Strengths:** Clean state transitions via `GameStateManager.transitionTo()`. Guard flags prevent re-entry bugs (e.g., `wordCompleted` in letterSpawner).

### Player System
- Delta-time driven movement (px/sec × deltaTime)
- Sprite animation system with `map.json` + `spritesheet.png`
- States: idle, run, victory, victoryIdle
- Canvas-relative dimensions (`PLAYER_WIDTH_RATIO: 0.06`, `PLAYER_HEIGHT_RATIO: 0.08`)

**Potential Issue:** Player assets (`/sprites/knight/map.json`, `/sprites/knight/spritesheet.png`) are **not present in the codebase**. The player will fall back to a blue rectangle if assets fail to load, but this should be noted.

### Letter Spawning & Collision
- Letter pool generated per word: correct letters (with duplicates) + distractors
- `DISTRACTOR_RATIO: 3` (3 distractors per correct letter)
- Tight circle-to-rectangle collision detection (recently fixed from inflated distance)
- Three catch results: `'perfect'`, `'valid-later'`, `'wrong'`

**Strengths:** The collision fix (closest point on rectangle to circle center) eliminates the old ~90px false-positive detection radius. The "silent discard" bug was fixed by processing ALL caught letters sequentially.

### Scoring System
- Checks collisions every 50ms (`COLLISION_CHECK_INTERVAL`)
- Processes all caught letters per frame (not just first one)
- Score calculation: `word.length × 10` points per word
- Tier advancement every 3 words


## 3. Code Quality & Conventions

### ✅ Strengths
| Area | Observation |
|------|-------------|
| **i18n** | Fully centralized — no hardcoded strings in game logic |
| **Delta-time movement** | Frame-rate independent player speed |
| **Responsive design** | DPR-aware canvas sizing, `getBoundingClientRect()` sync |
| **Input handling** | Unified keyboard/touch/mouse with proper event guards |
| **Modularity** | Clean separation: engine, components, audio, i18n, data |
| **Debug tools** | `window.DEBUG_DRAW_HITBOX` toggle, teleport detection logs |
| **localStorage** | Theme/language preferences persisted across sessions |

### ⚠️ Areas for Improvement

#### A. JSON Import Syntax (Compatibility)
```js
// Line 5 of words.js
import wordsData from './words.json' assert { type: 'json' };
```
The `assert` syntax is deprecated in favor of `with`. Update to:
```js
import wordsData from './words.json' with { type: 'json' };
```

#### B. Missing Sprite Assets
The player system references `/sprites/knight/map.json` and `/sprites/knight/spritesheet.png`, but these files don't exist in the project. Either:
- Add placeholder assets for development, or
- Ensure graceful fallback to geometric shapes (blue rectangle) when `isReady === false`

#### C. Touch Movement Threshold
```js
// main.js line 164
if (Math.abs(diff) > 10) {
  setDirection(diff > 0 ? 1 : -1);
}
```
A fixed pixel threshold may feel inconsistent across devices with different screen sizes. Consider making it relative to canvas width:
```js
if (Math.abs(diff) > canvas.width * 0.02) { ... }
```

#### D. State Reset Inconsistency
When transitioning from `GAME_OVER` → `PLAYING`, `initNewWord()` is called but the letter pool isn't cleared before re-spawning. The `fallingLetters` array and `spawnTimer` are reset in `initNewWord()`, which is correct, but ensure `resetRevealed()` is always called in this path (it is in `endScreen.js`, so this is fine).

#### E. No Pause Functionality
The GameState enum has no `PAUSED` state, though the translation key `game.pause` exists. Consider adding pause support (especially for mobile).

---

## 4. Potential Bugs & Edge Cases

| Issue | Location | Severity | Description |
|-------|----------|----------|-------------|
| **Asset dependency** | `player.js:27-28` | Medium | Spritesheet/JSON not found → player draws nothing until loaded |
| **Touch threshold** | `main.js:164` | Low | Fixed 10px may feel inconsistent on different screens |
| **No pause** | Missing | Low | Translation key exists but no implementation |
| **JSON assert syntax** | `words.js:5` | Low | Deprecated; use `with` instead of `assert` |
| **DPR re-init timing** | `main.js:36,56` | Low | Player re-initialized twice on bootstrap (redundant) |

---

## 5. Recommendations

### Immediate Fixes
1. **Update JSON import syntax** to `with { type: 'json' }`
2. **Add sprite assets** or implement a guaranteed fallback draw when `!player.isReady`
3. **Make touch threshold responsive** (relative to canvas width)

### Medium-Term Enhancements
4. **Add pause state** — map `Escape`/`P` key to toggle pause overlay
5. **Add language switcher** in-game (translation key exists but no UI component)
6. **Add difficulty curve** — currently tier advancement is fixed at 3 words; consider variable speed increases

### Long-Term Architecture
7. **Consider a simple ECS (Entity-Component-System)** if adding more entity types (obstacles, power-ups, enemies)
8. **Extract `roundRect` helper** to a shared `utils.js` — it's duplicated across 4 component files
9. **Add unit tests** for collision detection, scoring logic, and word generation

---

## 6. Summary Scorecard

| Category | Rating | Notes |
|----------|--------|-------|
| **Architecture** | ⭐⭐⭐⭐☆ | Clean separation, good modularity |
| **i18n Implementation** | ⭐⭐⭐⭐⭐ | Perfect — fully centralized, scalable |
| **Input Handling** | ⭐⭐⭐⭐☆ | Comprehensive, minor threshold issue |
| **Collision System** | ⭐⭐⭐⭐⭐ | Tight, well-documented fix applied |
| **Code Quality** | ⭐⭐⭐⭐☆ | Clean naming, comments, delta-time |
| **Completeness** | ⭐⭐⭐☆☆ | Missing sprite assets, pause feature |

---

**Overall Assessment:** This is a well-structured, production-ready foundation for an educational letter-catching game. The core mechanics (collision, scoring, state machine) are solid and bug-fixed. The main gaps are asset completeness and a few minor compatibility issues. Ready for gameplay testing once sprites are added.
