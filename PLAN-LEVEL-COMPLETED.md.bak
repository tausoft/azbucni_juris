# PLAN: Enhanced End Screen — Card Flip + Confetti + Emoji Reveal

**Status:** PLANNED (Not Yet Implemented)  
**Phase:** WORD_COMPLETE end-screen enhancement  
**Created:** 2026-10-15  

---

## Goal

Replace the current static end-screen overlay for WORD_COMPLETE with an animated sequence featuring:
1. A confetti burst celebration effect
2. A card flip animation revealing the completed word with a relevant **image or emoji fallback**
3. A delayed "tap/click anywhere or press Space" prompt for navigation to the next word

---

## Architecture Overview

```
endScreen.js (enhanced)
├── Confetti particle system
├── Card flip animation engine
├── Image loader (preloads word images asynchronously)
├── Emoji lookup table (tier/category → emoji mapping)
└── State machine: IDLE → CONFETTI → FLIP_IN → REVEAL → WAIT_PROMPT → AWAIT_INPUT

wordEmojis.js (new module)
└── { tier, category } → emoji mapping + fallback defaults

wordImages.js (new module)
└── word → image path mapping (with lazy-load + ready-state tracking)

i18n/languages.js (extended)
└── New keys: wordComplete.tapPrompt, wordComplete.pressSpacePrompt
```

---

## Step-by-Step Breakdown

### Step 1 — Create `src/data/wordEmojis.js` (Emoji Lookup Table)

A small mapping file that assigns relevant emojis to words by tier + category. Uses a **hierarchical fallback**:

1. Exact word match → specific emoji
2. Category match → generic emoji for that category
3. Tier-based default
4. Ultimate fallback: U+1F31F (star)

#### Tier 1 (3-letter) examples:

| Word | Emoji | Fallback Category |
|------|-------|-------------------|
| ЗЕЦ | U+1F430 (rabbit) | animals → U+1F43E (paw) |
| ПАС | U+1F415 (dog) | animals → U+1F43E |
| ЦРВ | U+1F41B (bug) | animals → U+1F43E |
| ЛАВ | U+1F981 (lion) | animals → U+1F43E |
| ЈЕЖ | U+1F994 (hedgehog) | animals → U+1F43E |
| КАП | U+1F4A7 (droplet) | nature → U+1F33F (herb) |
| БОР | U+1F332 (pine) | nature → U+1F33F |
| НОЋ | U+1F319 (crescent moon) | nature → U+1F33F |
| ЛЕД | U+1F94E (snowflake) | nature → U+1F33F |
| САТ | U+23F0 (clock) | objects → U+1F527 (wrench) |
| НОЖ | U+1F52A (knife) | objects → U+1F527 |
| ЛУК | U+1F3F9 (bow) | objects → U+1F527 |

#### Tier 2 (4-letter) examples:

| Word | Emoji | Fallback Category |
|------|-------|-------------------|
| МРАВ | U+1F41C (ant) | animals → U+1F43E |
| РИБА | U+1F41F (fish) | animals → U+1F43E |
| ШУМА | U+1F332 (pine forest) | nature → U+1F33F |
| РЕКА | U+1F3DC (landmark) | nature → U+1F33F |
| КУЋА | U+1F3E0 (house) | objects → U+1F527 |

#### Tier 3 (5-letter) examples:

| Word | Emoji | Fallback Category |
|------|-------|-------------------|
| МАЧКА | U+1F431 (cat) | animals → U+1F43E |
| ЗМИЈА | U+1F40D (snake) | animals → U+1F43E |
| СУНЦЕ | U+2600 (sun) | nature → U+1F33F |
| КЊИГА | U+1F4DA (books) | objects → U+1F527 |

> **Design rationale:** Hardcoding ~30 emojis is lightweight and fast. No data migration needed on words.json. The file exports a getEmoji(tier, category, word) function.

---

### Step 1b — Create `src/data/wordImages.js` (Image Lookup Table with Preload Support)

A mapping file that assigns image asset paths to words, with built-in preload tracking:

```js
// Image path structure — relative to project root or public directory
export const wordImages = {
  // Tier 1 (3-letter)
  'ЗЕЦ':   { sr_cyr: '/assets/images/words/zec.png',    tier: 1 },
  'ПАС':   { sr_cyr: '/assets/images/words/pas.png',    tier: 1 },
  'ЛАВ':   { sr_cyr: '/assets/images/words/lav.png',    tier: 1 },
  'ЈЕЖ':   { sr_cyr: '/assets/images/words/jez.png',    tier: 1 },
  'КАП':   { sr_cyr: '/assets/images/words/kap.png',    tier: 1 },
  'БОР':   { sr_cyr: '/assets/images/words/bor.png',    tier: 1 },
  'НОЋ':   { sr_cyr: '/assets/images/words/noc.png',    tier: 1 },
  'ЛЕД':   { sr_cyr: '/assets/images/words/led.png',    tier: 1 },
  'САТ':   { sr_cyr: '/assets/images/words/sat.png',    tier: 1 },
  'НОЖ':   { sr_cyr: '/assets/images/words/noz.png',    tier: 1 },
  'ЛУК':   { sr_cyr: '/assets/images/words/luk.png',    tier: 1 },

  // Tier 2 (4-letter)
  'МРАВ':  { sr_cyr: '/assets/images/words/mrav.png',   tier: 2 },
  'РИБА':  { sr_cyr: '/assets/images/words/riba.png',   tier: 2 },
  'ШУМА':  { sr_cyr: '/assets/images/suma.png',         tier: 2 },
  'РЕКА':  { sr_cyr: '/assets/images/words/reka.png',   tier: 2 },
  'КУЋА':  { sr_cyr: '/assets/images/words/kuca.png',   tier: 2 },

  // Tier 3 (5-letter)
  'МАЧКА': { sr_cyr: '/assets/images/words/macka.png',  tier: 3 },
  'ЗМИЈА': { sr_cyr: '/assets/images/words/zmija.png',  tier: 3 },
  'СУНЦЕ': { sr_cyr: '/assets/images/words/sunce.png',  tier: 3 },
  'КЊИГА': { sr_cyr: '/assets/images/words/knjiga.png', tier: 3 },

  // ... extend as assets are created
};

// Preload manager — tracks which images have finished loading
const imageCache = new Map();   // path → HTMLImageElement | null (null = failed)
const preloadPromises = new Map(); // path → Promise<boolean>

export function preloadWordImages(wordList) {
  // Accepts an array of words to preload
  const paths = wordList
    .map(w => wordImages[w]?.sr_cyr)
    .filter(Boolean);

  return Promise.allSettled(
    paths.map(path => {
      if (preloadPromises.has(path)) return preloadPromises.get(path);
      
      const p = new Promise(resolve => {
        const img = new Image();
        img.onload = () => { imageCache.set(path, img); resolve(true); };
        img.onerror = () => { imageCache.set(path, null); resolve(false); };
        img.src = path; // triggers loading
      });
      
      preloadPromises.set(path, p);
      return p;
    })
  );
}

export function getWordImage(word) {
  const entry = wordImages[word];
  if (!entry) return null;
  
  const img = imageCache.get(entry.sr_cyr);
  if (img instanceof HTMLImageElement) return img; // ready to draw
  return null; // not loaded yet or failed → fallback to emoji
}

export function isWordImageReady(word) {
  const entry = wordImages[word];
  if (!entry) return false;
  return imageCache.has(entry.sr_cyr) && imageCache.get(entry.sr_cyr) !== null;
}

// Fallback: returns null for every word (emoji mode) until images are added
export const getEmoji = () => null; // placeholder — real getEmoji is in wordEmojis.js
```

#### Image asset conventions:
- **Format:** PNG (transparent background recommended) or SVG
- **Naming:** lowercase Latin transcription of the Serbian Cyrillic word (e.g., `macka.png` for МАЧКА)
- **Size:** 256×256px base (scales down on card; no upscaling)
- **Directory structure:**
  ```
  assets/
    images/
      words/
        zec.png
        pas.png
        macka.png
        ...
  ```
- **Fallback behavior:** If an image fails to load or isn't mapped, the card flip falls back to rendering the emoji (from `wordEmojis.js`).

#### Preload strategy:
1. **On game boot / level start:** Call `preloadWordImages()` with all words in the current tier/category set.
2. **On WORD_COMPLETE trigger:** If the word's image is already cached, draw it immediately. If not yet loaded, show emoji first and swap to image once ready (crossfade transition).
3. **No blocking:** Uses `Promise.allSettled` — a single failed load won't block others.

> **Design rationale:** Image mapping is opt-in. Words without images gracefully fall back to emojis. Preloading is decoupled from the animation so it never stalls the end-screen reveal.

---

### Step 2 — Create `src/effects/confetti.js` (Confetti Particle System)

A self-contained particle system for the celebration burst:

```js
export class ConfettiBurst {
  constructor(ctx, w, h, count = 80)
    // Creates a burst from center of canvas
    // Particles: colored rectangles + circles
    // Lifespan: ~2.5 seconds with gravity + fade-out
    // Auto-cleanup when all particles dead
  
  update(dt) { /* update all particles */ }
  draw(ctx) { /* render all alive particles */ }
  get isDead() { /* true when all particles spent */ }
}
```

#### Particle specs:
- **Count:** 80 particles (center burst)
- **Colors:** ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e67e22', '#ff69b4']
- **Spread:** Random angle 0-2pi, velocity 200-500 px/s
- **Gravity:** 200 px/s^2 downward
- **Rotation:** Random spin for rectangular pieces
- **Lifespan:** 2.0-2.8s (randomized per particle)
- **Fade:** Alpha goes from 1 to 0 over last 30% of lifespan

---

### Step 3 — Create `src/effects/cardFlip.js` (Card Flip Animation)

A card flip animation using canvas transforms:

```js
export class CardFlip {
  constructor(ctx, w, h, word, emoji, image = null)
    // Card dimensions: ~60% canvas width x auto height
    // Position: centered vertically at ~45% of canvas
    // image: HTMLImageElement (from wordImages.js) or null → emoji fallback
    
  update(dt) {
    // Phase 1 (0-0.4s): Slide in from right with scale 0 to 1
    // Phase 2 (0.4-0.8s): Flip X-axis 0 deg to 360 deg (the "reveal")
    // Phase 3 (0.8-1.6s): Hold revealed state (image or emoji + word text visible)
    // Phase 4 (1.6-2.0s): Fade out to transparent
  }
  
  draw(ctx) { /* render card with current transform */ }
  get isDead() { /* true when animation fully complete */ }
  get revealPhase() { /* 'slide-in' | 'flip' | 'hold' | 'fade' | 'done' */ }
}
```

#### Card design:
- **Background:** Semi-transparent white/cream card (rgba(255, 255, 255, 0.95))
- **Border:** Rounded corners (16px), gold border (#f1c40f, 4px)
- **Visual (priority order):**
  1. If `image` is a loaded HTMLImageElement → draw image centered (~60% of card height)
  2. Else if `emoji` is available → render large emoji text (~60% of card height)
  3. Else → placeholder icon (question mark circle)
- **Word text:** Below visual, bold, dark text — the completed word in Serbian Cyrillic
- **Shadow:** Soft drop shadow behind card
- **Flip technique:** Use ctx.save() / ctx.scale(-1, 1) with translation to simulate 3D flip on X-axis

---

### Step 4 — Enhance `src/components/endScreen.js` (Orchestrate Everything)

Replace the current simple overlay with a state machine:

```js
export function renderEndScreen(ctx, w, h, type) {
  endScreenType = type;
  
  if (type === 'win') {
    const targetWord = getCurrentTargetWord();
    const emoji = getEmoji(targetWord.tier, targetWord.category, targetWord.word);
    const image = getWordImage(targetWord.word); // may be null if not loaded
    
    // Initialize confetti + card flip on first call
    if (!confetti) confetti = new ConfettiBurst(ctx, w, h);
    if (!cardFlip && confettiPhase === 'burst') {
      cardFlip = new CardFlip(ctx, w, h, targetWord.word, emoji, image);
      confettiPhase = 'flip';
    }
    
    // Check for late-loading images during hold phase
    if (cardFlip.revealPhase === 'hold' && !image && isWordImageReady(targetWord.word)) {
      const readyImg = getWordImage(targetWord.word);
      cardFlip.setImage(readyImg); // swap emoji → image with crossfade
    }
    
    // Update & draw confetti
    confetti.update(dt);
    confetti.draw(ctx);
    
    // Update & draw card flip
    cardFlip.update(dt);
    cardFlip.draw(ctx);
    
    // After card fade complete show prompt
    if (cardFlip.isDead && !promptShown) {
      promptShown = true;
      promptStartTime = performance.now();
    }
    
    // Draw tap prompt if shown
    if (promptShown) drawTapPrompt(ctx, w, h);
  } else {
    // GAME_OVER — keep original simple overlay behavior
    renderSimpleEndScreen(ctx, w, h, 'lose');
  }
}
```

#### State machine for WORD_COMPLETE:
```
IDLE → CONFETTI_BURST (0.3s) → FLIP_ANIM (~2s total) → REVEAL_HOLD (2s) → WAIT_PROMPT (blink) → AWAIT_INPUT
```

---

### Step 5 — Extend `src/i18n/languages.js` (New i18n Keys)

Add to the wordComplete section:

```js
wordComplete: {
  win: { sr_cyr: 'Честитам! Реч је завршена!', ... },
  nextButton: { sr_cyr: 'НАРЕДНА', ... },
  
  tapPrompt: { 
    sr_cyr: 'Доприни било где или притисни SPACE за наставак', 
    sr_lat: 'Dopini bilo gde ili pritisni SPACE za nastavak', 
    en: 'Tap anywhere or press SPACE to continue' 
  },
  pressSpacePrompt: { 
    sr_cyr: 'ИЛИ притисни SPACE', 
    sr_lat: 'ILI pritisni SPACE', 
    en: 'OR press SPACE' 
  },
},
```

---

### Step 6 — Wire Up Input in `gameLoop.js`

Modify the input handling to recognize end-screen tap/click/space during WORD_COMPLETE:

```js
case GameState.WORD_COMPLETE:
  if (endScreenState === 'AWAIT_INPUT') {
    onEndScreenContinue();
  }
  break;

export function onEndScreenContinue() {
  playBeep('catch');
  resetRevealed();
  initNewWord();
  gameManager.transitionTo(GameState.PLAYING);
  
  confetti = null;
  cardFlip = null;
  promptShown = false;
}
```

---

### Step 7 — Animation Timing Diagram

```
Time (s)    Action                              Visual
────────    ──────                              ──────
0.00        WORD_COMPLETE triggered             Confetti burst from center
0.00-0.30   Confetti flying                     Background: game scene + dark overlay
0.30        Card begins sliding in              Card enters from right, scales up
0.40        Card flip begins                    3D X-axis rotation 0 deg to 360 deg
0.80        Flip complete word revealed         Emoji + word text visible on card
0.80-2.80   Hold phase                          Confetti fading out, card holds
2.80+       Prompt appears                      "Tap anywhere / Space" blinks
Anytime     Input received                      Transition to next word (PLAYING state)
```

**Total time to prompt:** ~3 seconds  
**Total animation duration:** ~2.5s (confetti + flip) + 2s hold = ~4.5s max before user can proceed

---

## Files Modified / Created

| Action | File | Purpose |
|--------|------|---------|
| Create | src/data/wordEmojis.js | Emoji lookup table by tier/category |
| Create | src/data/wordImages.js | Image path mapping with preload manager + ready-state tracking |
| Create | src/effects/confetti.js | Confetti particle system |
| Create | src/effects/cardFlip.js | Card flip animation class (image + emoji support) |
| Modify | src/components/endScreen.js | State machine orchestration, image preloading, prompt rendering |
| Modify | src/i18n/languages.js | Add tapPrompt, pressSpacePrompt keys |
| Modify | src/engine/gameLoop.js | Wire tap/click/space input during WORD_COMPLETE |

---

## Key Design Decisions

1. **Emoji fallback hierarchy** (exact → category → tier → star) ensures every word has a visual even if unmapped.
2. **Image-first, emoji-fallback rendering** on card flip: images are preferred when available; emojis and placeholder icons handle all missing cases.
3. **Opt-in image mapping**: `wordImages.js` is empty by default — the game works perfectly with only emojis until images are added.
4. **Graceful degradation at every layer**: failed preload → emoji swap; unmapped word → tier/category fallback → star; no loading errors block the animation.
5. **Confetti + card flip are independent classes** — easy to swap out or reuse elsewhere (e.g., on game start screen).
6. **No data migration on words.json** — emoji mapping and image mapping are external and additive.
7. **Tap anywhere for children's UX** — no small button to aim at; the whole canvas area is the trigger zone.
8. **Game OVER state unchanged** — only WORD_COMPLETE gets the enhanced treatment. Game over keeps the simple retry button.

---

## Estimated Complexity

- **Low risk, high visual impact.** All components are self-contained Canvas effects.
- ~300-400 lines of new code across 3 files (confetti, cardFlip, wordEmojis).
- ~150 lines for `wordImages.js` (mapping + preload manager — mostly data entries).
- ~100 lines of changes across 3 existing files (endScreen, languages, gameLoop).

---

## Blockers

None. All dependencies are within the existing codebase structure.

---

## Approval Checklist

- [ ] Plan reviewed and approved by stakeholder
- [ ] Emoji mapping scope finalized
- [ ] Image asset format & naming conventions confirmed
- [ ] Image preload strategy (when + which words) decided
- [ ] Animation timing confirmed
- [ ] Visual style aligned with project aesthetic
- [ ] Implementation ready to begin

---

**Next Step:** Awaiting implementation prompt from stakeholder. Do NOT proceed until explicitly instructed.
