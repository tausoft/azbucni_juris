# Azbučni Juriš — Phased Development Plan

## Overview

**Azbučni Juriš** (Азбучни Јуриш) is a 2D educational web game for children in Serbia and the Balkan region, teaching Cyrillic alphabet recognition and spelling through a "catching game" mechanic. A target word appears at the top of the screen with blank letter slots; Cyrillic letters fall from above, and the player moves a character left/right to catch the correct letters in sequence.

This plan breaks development into **12 granular phases**, each self-contained and small enough for AI-assisted implementation without exceeding token limits. Early phases use basic 2D Canvas shapes; sprite assets are introduced in Phase 9. The architecture supports multi-language (i18n) from Day 1 with Serbian Cyrillic (`sr_cyr`) as the default.

**Tech stack:** Vanilla HTML5 Canvas + CSS3 + ES6+ JavaScript, Vite dev server, Web Audio API for sound effects.
**Target browsers:** Modern Chrome, Firefox, Safari (last 2 major versions).
**Input support:** Desktop keyboard (arrow keys / A-D) + mouse/touch drag.

---

## Types

### Game State Enum
```js
// src/engine/constants.js
const GameState = {
  MENU: 'menu',
  THEME_SELECT: 'theme_select',
  WORD_INTRO: 'word_intro',
  PLAYING: 'playing',
  WORD_COMPLETE: 'word_complete',
  GAME_OVER: 'game_over',
};
```

### Theme Enum
```js
// src/engine/constants.js
const Theme = {
  KNIGHT: 'knight',     // Boys - blue rectangle character
  PRINCESS: 'princess', // Girls - pink circle character
};
```

### Difficulty Tier
```js
// src/data/words.json schema
{
  "tier": 1,           // 3-letter words
  "category": "animals",
  "words": ["ЗЕЦ", "МАЧ", "СОБА"]
}
```

### Player Object
```js
{
  x: number,           // Canvas X position (pixels)
  y: number,           // Canvas Y position (fixed near bottom)
  width: number,       // Hitbox width
  height: number,      // Hitbox height
  speed: number,       // Pixels per frame
  theme: Theme,        // KNIGHT or PRINCESS
  caughtLetters: string[],  // Letters currently held
}
```

### FallingLetter Object
```js
{
  char: string,        // Cyrillic character
  x: number,           // Canvas X position (randomized spawn)
  y: number,           // Canvas Y position (starts at top)
  width: number,       // Hitbox width (circle diameter)
  height: number,      // Hitbox height (circle diameter)
  speed: number,       // Pixels per frame (falls downward)
  isCorrect: boolean,  // Is this letter needed next?
  caught: boolean,     // Has it been caught?
}
```

### Translation Dictionary Type
```js
{
  [key: string]: {
    sr_cyr: string,
    sr_lat: string,
    en: string,
  }
}
```

---

## Files

### New Files to Create

| File Path | Purpose |
|-----------|---------|
| `package.json` | npm project manifest (dependencies: vite, sirv) |
| `vite.config.js` | Vite configuration for dev server |
| `index.html` | Entry HTML file with canvas element |
| `src/styles.css` | CSS reset, full-screen canvas styling |
| `src/main.js` | Application bootstrap: loads i18n, initializes game loop, starts first frame |
| `src/engine/constants.js` | Enums (GameState, Theme), game constants (speeds, dimensions) |
| `src/engine/state.js` | Global game state management (current state, theme selection, language) |
| `src/i18n/languages.js` | Centralized translation dictionary for all UI strings |
| `src/data/words.json` | Cyrillic word database with difficulty tiers and categories |
| `src/audio/soundEffects.js` | Web Audio API wrapper for catch/correct/wrong/win/lose beeps |
| `src/components/menu.js` | Main menu screen rendering (title, start button) |
| `src/components/themeSelect.js` | Theme selection screen (Knight vs Princess) |
| `src/components/gameHUD.js` | In-game HUD: target word display, blank slots, score, progress bar |
| `src/engine/player.js` | Player movement, input handling (keyboard + touch), hitbox |
| `src/engine/letterSpawner.js` | Letter spawning logic, letter pool generation, correct/wrong letter ratio |
| `src/engine/collision.js` | Circle-rectangle collision detection between player and falling letters |
| `src/engine/gameLoop.js` | Core requestAnimationFrame loop: update → render cycle |
| `src/engine/scoring.js` | Score tracking, word completion detection, win/lose conditions |
| `src/components/endScreen.js` | Word complete / game over screen rendering |

### Files to Delete or Move


---

## Functions

### Phase 1 — Project Scaffolding

| Function | File | Purpose |
|----------|------|---------|
| `bootstrapApp()` | `src/main.js` | Entry point: creates canvas, sets dimensions, calls `initGame()` |
| `(none)` | `package.json` | Define `vite`, `sirv` as dev dependencies |
| `(none)` | `index.html` | Single `<canvas id="game">` element, loads `src/main.js` as module |

### Phase 2 — i18n System

| Function | File | Purpose |
|----------|------|---------|
| `loadTranslations()` | `src/i18n/languages.js` | Returns the full translation dictionary object (hardcoded for Phase 2) |
| `t(key)` | `src/i18n/languages.js` | Translation lookup: takes a key string, returns localized string based on `currentLanguage` |
| `setLanguage(lang)` | `src/i18n/languages.js` | Setter for `currentLanguage` global state (sr_cyr → sr_lat → en) |
| `getAvailableLanguages()` | `src/i18n/languages.js` | Returns array of supported language keys |

**Translation dictionary keys to define:**
```
menu.title, menu.startButton, theme.selectTitle, theme.knightLabel, theme.princessLabel,
hud.targetWord, hud.score, hud.lives, wordComplete.win, gameOver.lose, gameOver.retryButton,
language.switchLang, game.pause
```

### Phase 3 — Word Database

| Function | File | Purpose |
|----------|------|---------|
| `loadWords()` | `src/data/words.json` | Static JSON data (no function needed; imported as module) |
| `getRandomWord(tier)` | `src/data/words.js` | Picks a random word from the given difficulty tier |
| `getWordCategories()` | `src/data/words.js` | Returns list of available categories |

**Initial word list (20-30 words, tiers 1-3):**

Tier 1 (3 letters): ЗЕЦ, МАЧ, СОБА, ЛОВ, РБА, КЉУ
Tier 2 (4 letters): ПАС, КУЋ, ВОЗ, ШУМА, ДРАГА, СРЕЋ
Tier 3 (5 letters): ЦВИЈЕ, ВЕЛИК, МАЧКА, ЗВЕЗД, ЈЕСЕН

### Phase 4 — Game State Machine

| Function | File | Purpose |
|----------|------|---------|
| `transitionTo(newState)` | `src/engine/state.js` | Transitions between GameState values, triggers screen-specific init |
| `getCurrentState()` | `src/engine/state.js` | Returns current game state |
| `setTheme(theme)` | `src/engine/state.js` | Stores player's theme choice (KNIGHT / PRINCESS) |
| `getTheme()` | `src/engine/state.js` | Retrieves current theme |

### Phase 5 — Core Game Loop & Canvas Rendering

| Function | File | Purpose |
|----------|------|---------|
| `initCanvas()` | `src/main.js` | Creates canvas element, sets width/height to window size, handles resize |
| `startGameLoop()` | `src/engine/gameLoop.js` | Calls `requestAnimationFrame(updateFrame)` recursively |
| `updateFrame(deltaTime)` | `src/engine/gameLoop.js` | Main update: delegates to state-specific handlers |
| `renderFrame()` | `src/engine/gameLoop.js` | Main render: clears canvas, draws current screen |
| `drawBackground()` | `src/engine/gameLoop.js` | Draws solid color background (phase-appropriate gradient) |
| `handleKeyboardInput(e)` | `src/engine/player.js` | Maps arrow keys / A-D to player movement direction |
| `handleTouchInput(e)` | `src/engine/player.js` | Maps touch X position to player lateral movement |

### Phase 6 — Catching Mechanics

| Function | File | Purpose |
|----------|------|---------|
| `spawnLetterPool(targetWord)` | `src/engine/letterSpawner.js` | Generates letter pool: correct letters + distractors (ratio ~1:3) |
| `updateFallingLetters(deltaTime)` | `src/engine/letterSpawner.js` | Updates Y position of all active falling letters, removes off-screen ones |
| `checkCollision(player, letter)` | `src/engine/collision.js` | Circle-rectangle overlap test between player hitbox and letter bounding circle |
| `onLetterCaught(letter)` | `src/engine/scoring.js` | Processes a caught letter: checks if it matches the next required character |
| `updateTargetDisplay()` | `src/components/gameHUD.js` | Fills in revealed letter slots on the HUD |
| `generateDistractorLetters()` | `src/engine/letterSpawner.js` | Randomly picks Cyrillic letters NOT needed for the current word |

### Phase 7 — Audio System

| Function | File | Purpose |
|----------|------|---------|
| `initAudioContext()` | `src/audio/soundEffects.js` | Creates AudioContext on first user gesture (required by browsers) |
| `playBeep(type)` | `src/audio/soundEffects.js` | Plays a tone: `'catch'`, `'correct'`, `'wrong'`, `'win'`, `'lose'` |
| `createTone(freq, duration, type)` | `src/audio/soundEffects.js` | Internal helper: generates oscillator tone |

**Frequency mapping:**
- `catch`: 440 Hz, 80ms, sine
- `correct`: 660 Hz, 120ms, sine
- `wrong`: 220 Hz, 200ms, sawtooth
- `win`: ascending arpeggio (440→550→660→880 Hz, 150ms each)
- `lose`: descending tone (440→220 Hz, 300ms, sawtooth)

### Phase 8 — Visual Polish & Difficulty Scaling

| Function | File | Purpose |
|----------|------|---------|
| `updateDifficultyTier()` | `src/engine/scoring.js` | Advances word difficulty tier after N correct words |
| `calculateScore()` | `src/engine/scoring.js` | Computes score based on speed + accuracy |
| `drawProgressBar()` | `src/components/gameHUD.js` | Draws progress bar showing word completion percentage |
| `renderPlayerShape()` | `src/engine/player.js` | Draws blue rectangle (Knight) or pink circle (Princess) at player position |
| `renderFallingLetter(letter)` | `src/engine/letterSpawner.js` | Draws letter inside a colored circle on canvas |

### Phase 9 — Theme Customization Rendering

| Function | File | Purpose |
|----------|------|---------|
| `drawKnightCharacter(x, y, w, h)` | `src/components/themeSelect.js` | Renders blue rectangle with simple armor details (white border, visor slit) |
| `drawPrincessCharacter(x, y, radius)` | `src/components/themeSelect.js` | Renders pink circle with crown detail (triangle atop circle) |
| `drawCastleBackground()` | `src/engine/gameLoop.js` | Draws medieval castle silhouette background (dark gray shapes) |
| `drawKingdomBackground()` | `src/engine/gameLoop.js` | Draws magical kingdom background (purple/blue gradient, stars) |

### Phase 10 — Sprite Assets (Future)

| Function | File | Purpose |
|----------|------|---------|
| `loadSprite(name, src)` | `src/assets/sprites.js` | Loads an image and caches it in a sprite map |
| `drawSprite(spriteName, x, y, w, h)` | `src/assets/sprites.js` | Draws loaded sprite instead of shape |

### Phase 11 — Advanced Features (Future)

| Function | File | Purpose |
|----------|------|---------|
| `spawnObstacle()` | `src/engine/obstacles.js` | Spawns falling enemy shapes (red triangles, bombs) |
| `updateLives()` | `src/engine/scoring.js` | Decrements lives on obstacle collision; triggers game over at 0 |
| `spawnHeartPickup()` | `src/engine/obstacles.js` | Spawns heart-shaped pickups that restore a life |

### Phase 12 — Polish & Deployment

| Function | File | Purpose |
|----------|------|---------|
| `buildProduction()` | (npm script) | `vite build` for production bundle |
| `deploy()` | (npm script) | Deploy to GitHub Pages / Netlify / Vercel |


---

## Classes

### GameStateManager
**File:** `src/engine/state.js`

Manages the full game lifecycle: screen transitions, persistence of theme/language choices.

**Key methods:**
- `constructor()` — Initializes default state (MENU, sr_cyr language, KNIGHT theme)
- `transitionTo(newState)` — Handles state changes, calls appropriate init/render hooks
- `getCurrentState()` — Returns current GameState value
- `setTheme(theme)` / `getTheme()` — Theme getter/setter
- `savePreferences()` / `loadPreferences()` — localStorage persistence for language/theme

### Player
**File:** `src/engine/player.js`

Represents the player character on screen.

**Key methods:**
- `constructor(x, y, theme)` — Initializes position, dimensions, theme
- `moveLeft(deltaTime)` — Moves player left by speed × deltaTime
- `moveRight(deltaTime)` — Moves player right by speed × deltaTime
- `update(deltaTime)` — Applies movement, clamps to canvas bounds
- `getHitbox()` — Returns {x, y, width, height} for collision detection
- `draw(ctx)` — Renders the character shape (blue rect or pink circle)

### LetterSpawner
**File:** `src/engine/letterSpawner.js`

Manages the falling letter pool.

**Key methods:**
- `constructor(targetWord, difficultyTier)` — Initializes spawn logic for a given word
- `generatePool()` — Creates array of FallingLetter objects (correct + distractors)
- `update(deltaTime)` — Moves all letters downward, removes off-screen ones
- `getNextRequiredChar()` — Returns the next character the player needs to catch
- `getActiveLetters()` — Returns currently visible (not caught, not off-screen) letters

### CollisionDetector
**File:** `src/engine/collision.js`

Handles all hitbox overlap calculations.

**Key methods:**
- `circleToRect(cx, cy, radius, rx, ry, rw, rh)` — Circle-to-rectangle collision test
- `checkPlayerLetterCollision(player, letter)` — Convenience wrapper for player-letter checks

### ScoringEngine
**File:** `src/engine/scoring.js`

Manages score, word progress, and win/lose conditions.

**Key methods:**
- `constructor(targetWord)` — Initializes with target word
- `processCaughtLetter(char)` — Validates caught letter against next required character
- `getProgress()` — Returns {correctIndex, totalLetters, percentage}
- `isWordComplete()` — Boolean: all letters caught in correct order?
- `addScore(points)` — Adds points (bonus for speed)
- `getScore()` — Returns current score
- `getDifficultyTier()` — Returns current difficulty tier based on progress

### AudioEngine
**File:** `src/audio/soundEffects.js`

Wraps Web Audio API for game sound effects.

**Key methods:**
- `constructor()` — Initializes AudioContext (lazy, on first play call)
- `play(type)` — Dispatches to correct tone generator
- `_createOscillator(freq, duration, waveform)` — Internal helper


---

## Dependencies

### npm Dependencies

```json
{
  "devDependencies": {
    "vite": "^5.0.0",
    "sirv-cli": "^3.0.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "sirv dist --cors --single"
  }
}
```

### No external production dependencies. Pure vanilla JS only.


---

## Testing

### Manual Testing Strategy (no test framework for Phase 1-8)

| Test Area | How to Verify |
|-----------|---------------|
| Canvas rendering | Open in browser; verify full-screen canvas, no scrollbars |
| i18n system | Switch language via debug key (e.g., `L`); verify all UI text updates |
| Player movement | Arrow keys + mouse drag both move character smoothly |
| Touch input | Test on mobile/tablet; character follows finger position |
| Letter catching | Catch correct letters in order; word slots fill progressively |
| Wrong letter handling | Catching wrong letter plays beep, no slot fills, visual feedback |
| Word completion | Completing word triggers win screen with score |
| Difficulty scaling | After 3 words, tier advances; new words are longer/harder |
| Audio | All five sound types play correctly on user gesture |
| Theme selection | Knight/Princess render different shapes on their respective screens |
| Responsive resize | Resize browser window; canvas and game objects adapt |

### Automated Testing (Phase 12+)

- Add `vitest` for unit testing: collision detection logic, scoring calculations, translation lookup.
- No E2E testing required for Phase 1-8.


---

## Implementation Order

Follow this exact sequence. Each phase must produce a **working, playable increment** before proceeding.

### Phase 1: Project Scaffolding (~30 min)
1. Create `package.json` with vite + sirv dependencies
2. Create `vite.config.js` (basic config, dev server on port 5173)
3. Create `index.html` with full-screen canvas element and module script tag
4. Create `src/styles.css` (CSS reset, canvas {display:block; width:100vw; height:100vh})
5. Verify: `npm run dev` starts a working page with a blank full-screen canvas

### Phase 2: i18n System (~30 min)
6. Create `src/i18n/languages.js` with full translation dictionary (sr_cyr/sr_lat/en for all keys listed above)
7. Implement `t(key)`, `setLanguage(lang)`, `getAvailableLanguages()` functions
8. Set default language to `sr_cyr`
9. Verify: calling `t('menu.title')` returns Serbian Cyrillic text

### Phase 3: Word Database (~30 min)
10. Create `src/data/words.json` with tiered word data (20-30 words across 3 tiers)
11. Create `src/data/words.js` with `loadWords()`, `getRandomWord(tier)`, `getWordCategories()` helpers
12. Verify: `getRandomWord(1)` returns a 3-letter Serbian Cyrillic word

### Phase 4: Game State Machine (~45 min)
13. Create `src/engine/constants.js` with GameState and Theme enums
14. Create `src/engine/state.js` with GameStateManager class (transitionTo, getCurrentState, theme/language getters/setters)
15. Wire state transitions: MENU → THEME_SELECT → PLAYING → WORD_COMPLETE / GAME_OVER
16. Verify: pressing "Start" on menu transitions to theme select screen

### Phase 5: Core Game Loop & Canvas Rendering (~1 hour)
17. Create `src/main.js` with `bootstrapApp()` — canvas setup, state init, game loop start
18. Create `src/engine/gameLoop.js` with `startGameLoop()`, `updateFrame()`, `renderFrame()`
19. Implement `drawBackground()` with solid gradient colors (blue for knight, purple for princess)
20. Create `src/engine/player.js` with Player class — movement via keyboard (arrow keys/A-D) and touch
21. Create `src/components/menu.js` — renders title ("АЗБУЧНИ ЈУРИШ") and "ПОЧНИ" button on canvas
22. Verify: player character (blue rectangle) moves left/right with arrow keys; background renders

### Phase 6: Catching Mechanics (~1.5 hours)
23. Create `src/engine/letterSpawner.js` with LetterSpawner class — pool generation, letter falling logic
24. Create `src/engine/collision.js` with CollisionDetector class — circle-to-rectangle collision
25. Create `src/engine/scoring.js` with ScoringEngine class — word progress tracking, score calculation
26. Create `src/components/gameHUD.js` — renders target word with blank slots, score display
27. Wire letter catching: correct letters fill slots; wrong letters trigger visual feedback (red flash)
28. Verify: catching letters in order completes the word; HUD updates correctly

### Phase 7: Audio System (~30 min)
29. Create `src/audio/soundEffects.js` with AudioEngine class — Web Audio API wrapper
30. Implement all five sound types (catch, correct, wrong, win, lose)
31. Wire audio to game events in scoring.js and letterSpawner.js
32. Verify: all sounds play on their respective game events

### Phase 8: Visual Polish & Difficulty Scaling (~45 min)
33. Implement difficulty tier advancement after N words (default: 3)
34. Add score calculation with speed bonus
35. Add progress bar to HUD
36. Render player shape based on selected theme (blue rect vs pink circle)
37. Verify: difficulty scales automatically; score updates in real-time

### Phase 9: Theme Customization Rendering (~1 hour)
38. Enhance knight rendering: add armor details (white border, visor slit, shield)
39. Enhance princess rendering: add crown detail (triangle atop circle), dress shape
40. Add themed backgrounds: castle silhouette (knight) / magical kingdom gradient + stars (princess)
41. Verify: theme selection produces visually distinct gameplay experiences

### Phase 10: Sprite Assets (~1 hour, future)
42. Create `src/assets/sprites.js` with loadSprite/drawSprite functions
43. Replace shape rendering with actual 2D sprite images (Knight on horse, Princess on pony)
44. Update all player/background rendering to use sprites
45. Verify: sprites render correctly at all screen sizes

### Phase 11: Advanced Features (~2 hours, future)
46. Create `src/engine/obstacles.js` with obstacle spawning (enemies, hearts)
47. Implement lives system (3 hearts displayed on HUD)
48. Add obstacle collision detection and life decrement
49. Verify: obstacles fall correctly; lives decrease on collision; game over at 0 lives

### Phase 12: Polish & Deployment (~1 hour)
50. Add `vitest` for unit testing (collision, scoring, i18n)
51. Run `vite build` for production bundle
52. Add deployment scripts for GitHub Pages / Netlify
53. Final responsive testing on mobile/tablet/desktop
54. Verify: production build works; all tests pass

