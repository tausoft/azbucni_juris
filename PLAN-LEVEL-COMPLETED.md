# PLAN: Enhanced End Screen — CSS Frame Overlay + Word/Emoji Reveal

**Status:** PLANNED (Not Yet Implemented)  
**Phase:** WORD_COMPLETE end-screen enhancement  
**Created:** 2026-10-15  
**Revised:** 2026-10-21 — Refactored from Canvas-based to CSS DOM overlay approach

---

## Goal

Replace the current static end-screen overlay for WORD_COMPLETE with an animated **CSS-stacked DOM overlay** featuring:
1. A castle-wall frame reveal animation (4 PNG layers composited via CSS stacking context)
2. A word image or emoji fallback displayed inside the frame's central cutout area
3. A delayed "tap/click anywhere or press Space" prompt for navigation to the next word

---

## Architecture Overview

```
endScreen.js (enhanced)
├── DOM overlay manager (create/remove fixed-position container)
├── Frame layer stacker (positions 4 PNG layers via CSS absolute + z-index)
├── CSS animation controller (frame-in, word-reveal keyframes)
├── Word/emoji renderer (background-image or <img> inside frame center)
└── State machine: IDLE → FRAME_IN → WORD_REVEAL → WAIT_PROMPT → AWAIT_INPUT

wordEmojis.js (new module)
└── { tier, category } → emoji mapping + fallback defaults (unchanged)

wordImages.js (new module)
└── word → image path mapping (with lazy-load + ready-state tracking; renders as CSS background-image or <img> inside frame center)

i18n/languages.js (extended)
└── New keys: wordComplete.tapPrompt, wordComplete.pressSpacePrompt (unchanged)
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
  'ЗЕЦ':   { sr_cyr: '/dist/assets/images/words/bunny.png',   tier: 1 },
  'ПАС':   { sr_cyr: '/dist/assets/images/words/dog.png',   tier: 1 },
  'ЦРВ':   { sr_cyr: '/dist/assets/images/words/worm.png',   tier: 1 },
  'ЛАВ':   { sr_cyr: '/dist/assets/images/words/lion.png',   tier: 1 },
  'ЈЕЖ':   { sr_cyr: '/dist/assets/images/words/hedgedog.png',   tier: 1 },
  'КОС':   { sr_cyr: '/dist/assets/images/words/blackbird.png',   tier: 1 },
  'КИТ':   { sr_cyr: '/dist/assets/images/words/whale.png',   tier: 1 },
  'ЈАК':   { sr_cyr: '/dist/assets/images/words/yak.png',   tier: 1 },
  'ГНУ':   { sr_cyr: '/dist/assets/images/words/gnu.png',   tier: 1 },
  'КОЊ':   { sr_cyr: '/dist/assets/images/words/horse.png',   tier: 1 },
  'БИК':   { sr_cyr: '/dist/assets/images/words/bull.png',   tier: 1 },
  'РАК':   { sr_cyr: '/dist/assets/images/words/crab.png',   tier: 1 },
  'ПУЖ':   { sr_cyr: '/dist/assets/images/words/snale.png',   tier: 1 },
  'КАП':   { sr_cyr: '/dist/assets/images/words/drop.png',   tier: 1 },
  'АДА':   { sr_cyr: '/dist/assets/images/words/eyot.png',   tier: 1 },
  'БОР':   { sr_cyr: '/dist/assets/images/words/pine.png',   tier: 1 },
  'ГАЈ':   { sr_cyr: '/dist/assets/images/words/grove.png',   tier: 1 },
  'КРШ':   { sr_cyr: '/dist/assets/images/words/rocks.png',   tier: 1 },
  'ДАН':   { sr_cyr: '/dist/assets/images/words/day.png',   tier: 1 },
  'НОЋ':   { sr_cyr: '/dist/assets/images/words/night.png',   tier: 1 },
  'ЖИР':   { sr_cyr: '/dist/assets/images/words/accorn.png',   tier: 1 },
  'ВИР':   { sr_cyr: '/dist/assets/images/words/whirlpool.png',   tier: 1 },
  'ЛУК':   { sr_cyr: '/dist/assets/images/words/onion.png',   tier: 1 },
  'ЛЕД':   { sr_cyr: '/dist/assets/images/words/ice.png',   tier: 1 },
  'САТ':   { sr_cyr: '/dist/assets/images/words/clock.png',   tier: 1 },
  'СТО':   { sr_cyr: '/dist/assets/images/words/table.png',   tier: 1 },
  'ТОП':   { sr_cyr: '/dist/assets/images/words/canon.png',   tier: 1 },
  'ЗИД':   { sr_cyr: '/dist/assets/images/words/wall.png',   tier: 1 },
  'ЧЕП':   { sr_cyr: '/dist/assets/images/words/bottlecap.png',   tier: 1 },
  'ТУШ':   { sr_cyr: '/dist/assets/images/words/shower_head.png',   tier: 1 },
  'ШАЛ':   { sr_cyr: '/dist/assets/images/words/scarf.png',   tier: 1 },
  'ЏАК':   { sr_cyr: '/dist/assets/images/words/sack.png',   tier: 1 },
  'МАЧ':   { sr_cyr: '/dist/assets/images/words/sword.png',   tier: 1 },
  'ЂАК':   { sr_cyr: '/dist/assets/images/words/student.png',   tier: 1 },
  'ПЕЋ':   { sr_cyr: '/dist/assets/images/words/stove.png',   tier: 1 },
  'ТРН':   { sr_cyr: '/dist/assets/images/words/thorn.png',   tier: 1 },
  'НОЖ':   { sr_cyr: '/dist/assets/images/words/knife.png',   tier: 1 },

  // Tier 2 (4-letter)
  'МРАВ':  { sr_cyr: '/dist/assets/images/words/ant.png',  tier: 2 },
  'РИБА':  { sr_cyr: '/dist/assets/images/words/fish.png',  tier: 2 },
  'ЖАБА':  { sr_cyr: '/dist/assets/images/words/frog.png',  tier: 2 },
  'СРНА':  { sr_cyr: '/dist/assets/images/words/roe.png',  tier: 2 },
  'СЛОН':  { sr_cyr: '/dist/assets/images/words/elephant.png',  tier: 2 },
  'ЛАНЕ':  { sr_cyr: '/dist/assets/images/words/fawn.png',  tier: 2 },
  'ШУМА':  { sr_cyr: '/dist/assets/images/words/forest.png',  tier: 2 },
  'РЕКА':  { sr_cyr: '/dist/assets/images/words/river.png',  tier: 2 },
  'ГОРА':  { sr_cyr: '/dist/assets/images/words/woodland.png',  tier: 2 },
  'МРАК':  { sr_cyr: '/dist/assets/images/words/dark.png',  tier: 2 },
  'ДРВО':  { sr_cyr: '/dist/assets/images/words/tree.png',  tier: 2 },
  'ВИЛА':  { sr_cyr: '/dist/assets/images/words/fairy.png',  tier: 2 },
  'РУЖА':  { sr_cyr: '/dist/assets/images/words/rose.png',  tier: 2 },
  'ЛЕТО':  { sr_cyr: '/dist/assets/images/words/summer.png',  tier: 2 },
  'ТУГА':  { sr_cyr: '/dist/assets/images/words/sadness.png',  tier: 2 },
  'КЉУЧ':  { sr_cyr: '/dist/assets/images/words/key.png',  tier: 2 },
  'КУЋА':  { sr_cyr: '/dist/assets/images/words/house.png',  tier: 2 },
  'ИГЛА':  { sr_cyr: '/dist/assets/images/words/needle.png',  tier: 2 },
  'ШТАП':  { sr_cyr: '/dist/assets/images/words/stick.png',  tier: 2 },
  'ШТИТ':  { sr_cyr: '/dist/assets/images/words/shield.png',  tier: 2 },
  'ШЛЕМ':  { sr_cyr: '/dist/assets/images/words/helmet.png',  tier: 2 },
  'ШРАФ':  { sr_cyr: '/dist/assets/images/words/screw.png',  tier: 2 },
  'КАДА':  { sr_cyr: '/dist/assets/images/words/bathtub.png',  tier: 2 },
  'МОСТ':  { sr_cyr: '/dist/assets/images/words/bridge.png',  tier: 2 },

  // Tier 3 (5-letter)
  'МАЧКА':  { sr_cyr: '/dist/assets/images/words/cat.png', tier: 3 },
  'ЗМИЈА':  { sr_cyr: '/dist/assets/images/words/snake.png', tier: 3 },
  'ЈЕЛЕН':  { sr_cyr: '/dist/assets/images/words/deer.png', tier: 3 },
  'КРАВА':  { sr_cyr: '/dist/assets/images/words/cow.png', tier: 3 },
  'ЈЕСЕН':  { sr_cyr: '/dist/assets/images/words/autumn.png', tier: 3 },
  'ПЛАЖА':  { sr_cyr: '/dist/assets/images/words/beach.png', tier: 3 },
  'СТЕНА':  { sr_cyr: '/dist/assets/images/words/boulder.png', tier: 3 },
  'ЉУБАВ':  { sr_cyr: '/dist/assets/images/words/love.png', tier: 3 },
  'СРЕЋА':  { sr_cyr: '/dist/assets/images/words/happiness.png', tier: 3 },
  'СУНЦЕ':  { sr_cyr: '/dist/assets/images/words/sun.png', tier: 3 },
  'ПОТОК':  { sr_cyr: '/dist/assets/images/words/stream.png', tier: 3 },
  'КОРЕН':  { sr_cyr: '/dist/assets/images/words/root.png', tier: 3 },
  'КЊИГА':  { sr_cyr: '/dist/assets/images/words/book.png', tier: 3 },
  'ЛАМПА':  { sr_cyr: '/dist/assets/images/words/lamp.png', tier: 3 },
  'ШЕРПА':  { sr_cyr: '/dist/assets/images/words/cooking_pot.png', tier: 3 },
  'ЕКСЕР':  { sr_cyr: '/dist/assets/images/words/nail.png', tier: 3 },
  'КАМИН':  { sr_cyr: '/dist/assets/images/words/fireplace.png', tier: 3 },
  'РАНАЦ':  { sr_cyr: '/dist/assets/images/words/school_bag.png', tier: 3 },
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

### Step 2 — Create `src/effects/frameOverlay.css` (CSS Frame Animation Styles)

Replaces the previous `confetti.js` + `cardFlip.js` Canvas approach with **GPU-accelerated CSS keyframes**:

```css
/* ========== Overlay Container ========== */
.frame-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  pointer-events: auto;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}
.frame-overlay.active {
  opacity: 1;
  visibility: visible;
}

/* ========== Frame Layer Stack ========== */
.frame-layer {
  position: absolute;
  inset: 0;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  will-change: transform, opacity;
}

/* z-index stacking order (outer → inner): */
.frame-layer--wall   { z-index: 1; }        /* Background_0: outer wall silhouette */
.frame-layer--bg     { z-index: 2; }        /* Background: main background fill */
.frame-layer--detail { z-index: 3; }        /* Layer3: inner detail patterns */
.frame-layer--center { z-index: 4; }        /* Background_0: center display area */
.frame-layer--border { z-index: 5; }        /* Background_1: primary border frame */

/* ========== Content Zone (inside frame cutout) ========== */
.frame-content {
  position: absolute;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: var(--cutout-width, 60vw);
  height: var(--cutout-height, 50vh);
  padding: 1rem;
}

.frame-word {
  font-size: clamp(2rem, 6vw, 4rem);
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0,0,0,0.6);
  letter-spacing: 0.15em;
}

.frame-image {
  max-width: var(--cutout-width, 60vw);
  max-height: var(--cutout-height, 30vh);
  object-fit: contain;
  margin-bottom: 0.5rem;
}

.frame-emoji {
  font-size: clamp(4rem, 12vw, 8rem);
  line-height: 1;
  margin-bottom: 0.5rem;
}

/* ========== Keyframe Animations ========== */

/* Frame layers slide in from edges and settle */
@keyframes frame-in {
  0%   { transform: scale(1.15) rotate(2deg); opacity: 0; }
  60%  { transform: scale(0.97) rotate(-0.5deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
.frame-layer--wall   { animation: frame-in 0.6s ease-out both; }
.frame-layer--bg     { animation: frame-in 0.6s 0.05s ease-out both; }
.frame-layer--detail { animation: frame-in 0.6s 0.1s ease-out both; }
.frame-layer--center { animation: frame-in 0.6s 0.15s ease-out both; }
.frame-layer--border { animation: frame-in 0.6s 0.2s ease-out both; }

/* Word / emoji fades and scales up inside the frame */
@keyframes word-reveal {
  0%   { transform: translateY(12px) scale(0.85); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
.frame-word, .frame-image, .frame-emoji {
  animation: word-reveal 0.4s 0.5s ease-out both;
}

/* Prompt text blinks after animation completes */
@keyframes prompt-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.frame-prompt {
  position: absolute;
  bottom: 8vh;
  font-size: clamp(1rem, 3vw, 1.5rem);
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  animation: prompt-blink 1.2s ease-in-out infinite;
  animation-delay: 2.5s;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}
.frame-prompt.visible {
  opacity: 1;
  visibility: visible;
}

/* ========== CSS Particle Burst (replaces confetti.js) ========== */
.particle-burst {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 7;
  overflow: hidden;
}
.particle {
  position: absolute;
  width: var(--size, 8px);
  height: var(--size, 8px);
  background: var(--color, #e74c3c);
  border-radius: var(--radius, 50%);
  left: 50%;
  top: 50%;
  opacity: 0;
  animation: particle-fly var(--duration, 2s) var(--delay, 0s) ease-out both;
}
@keyframes particle-fly {
  0%   { transform: translate(-50%, -50%) translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) translate(var(--tx, 200px), var(--ty, -300px)) scale(0.3); opacity: 0; }
}
```

---

### Step 3 — Create `src/effects/frameOverlay.js` (DOM Overlay Manager)

Replaces the previous Canvas-based `confetti.js` + `cardFlip.js`:

```js
import { getEmoji, isWordImageReady } from '../data/wordEmojis.js';
import { getWordImage } from '../data/wordImages.js';

const PARTICLE_COLORS = [
  '#e74c3c', '#f1c40f', '#2ecc71', '#3498db',
  '#9b59b6', '#e67e22', '#ff69b4'
];

export class FrameOverlay {
  constructor() {
    this.el = null;
    this.particles = [];
    this.state = 'IDLE';
    this.promptShown = false;
  }

  // ---- Lifecycle ----

  create() {
    if (this.el) return this.el;

    const overlay = document.createElement('div');
    overlay.className = 'frame-overlay';
    overlay.innerHTML = `
      <div class="frame-layer frame-layer--wall" style="background-image:url('/assets/images/frames/Background_0.png')"></div>
      <div class="frame-layer frame-layer--bg" style="background-image:url('/assets/images/frames/Background.png')"></div>
      <div class="frame-layer frame-layer--detail" style="background-image:url('/assets/images/frames/Layer3.png')"></div>
      <div class="frame-layer frame-layer--center" style="background-image:url('/assets/images/frames/Background_0.png')"></div>
      <div class="frame-layer frame-layer--border" style="background-image:url('/assets/images/frames/Background_1.png')"></div>
      <div class="frame-content">
        <!-- word image or emoji injected here -->
      </div>
      <div class="frame-prompt"></div>
    `;

    // CSS particle burst (centered)
    const burst = document.createElement('div');
    burst.className = 'particle-burst';
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const angle = Math.random() * Math.PI * 2;
      const dist = 150 + Math.random() * 350;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      p.style.setProperty('--tx', `${tx}px`);
      p.style.setProperty('--ty', `${ty}px`);
      p.style.setProperty('--color', PARTICLE_COLORS[i % PARTICLE_COLORS.length]);
      p.style.setProperty('--size', `${4 + Math.random() * 8}px`);
      p.style.setProperty('--radius', Math.random() > 0.5 ? '50%' : '2px');
      p.style.setProperty('--duration', `${1.5 + Math.random() * 1}s`);
      p.style.setProperty('--delay', `${Math.random() * 0.3}s`);
      burst.appendChild(p);
    }
    overlay.appendChild(burst);

    document.body.appendChild(overlay);
    this.el = overlay;
    return overlay;
  }

  destroy() {
    if (this.el) {
      this.el.remove();
      this.el = null;
      this.state = 'IDLE';
      this.promptShown = false;
    }
  }

  // ---- Animation State Machine ----

  showWord(word, tier, category) {
    if (!this.el) this.create();

    const overlay = this.el;
    overlay.classList.add('active');
    this.state = 'FRAME_IN';

    // Populate content zone
    const content = overlay.querySelector('.frame-content');
    const emoji = getEmoji(tier, category, word);
    const img = getWordImage(word);

    if (img) {
      content.innerHTML = `<img class="frame-image" src="${img.sr_cyr}" alt="${word}">
                           <span class="frame-word">${word}</span>`;
    } else if (emoji) {
      content.innerHTML = `<span class="frame-emoji">${emoji}</span>
                           <span class="frame-word">${word}</span>`;
    } else {
      content.innerHTML = `<span class="frame-word">${word}</span>`;
    }

    // After frame animation (~0.7s), transition to word reveal
    setTimeout(() => {
      this.state = 'WORD_REVEAL';
      // CSS animations are already triggered on mount via class names
      // This timeout just marks the state for potential JS logic
    }, 700);

    // Show prompt after hold period (~2.5s)
    setTimeout(() => {
      if (!this.promptShown) {
        const prompt = overlay.querySelector('.frame-prompt');
        prompt.textContent = '🖱️ Tap anywhere / Space to continue';
        prompt.classList.add('visible');
        this.promptShown = true;
        this.state = 'WAIT_PROMPT';
      }
    }, 2500);
  }

  hide() {
    if (this.el) {
      this.el.classList.remove('active');
      setTimeout(() => this.destroy(), 300);
    }
  }

  isReadyForInput() {
    return this.state === 'WAIT_PROMPT';
  }
}
```

---

### Step 4 — Enhance `src/components/endScreen.js` (Orchestrate DOM Overlay)

Replace the current Canvas-based end-screen rendering with DOM overlay orchestration:

```js
import { FrameOverlay } from '../effects/frameOverlay.js';
import { getEmoji } from '../data/wordEmojis.js';
import { getWordImage } from '../data/wordImages.js';

let frameOverlay = null;
let endScreenType = null;

export function renderEndScreen(type) {
  endScreenType = type;

  if (type === 'win') {
    const targetWord = getCurrentTargetWord();
    const emoji = getEmoji(targetWord.tier, targetWord.category, targetWord.word);
    
    if (!frameOverlay) frameOverlay = new FrameOverlay();
    frameOverlay.showWord(targetWord.word, targetWord.tier, targetWord.category);
  } else {
    // GAME_OVER — keep original simple overlay behavior (Canvas-based)
    renderSimpleEndScreen(endScreenType);
  }
}

export function onEndScreenContinue() {
  if (frameOverlay?.isReadyForInput()) {
    playBeep('catch');
    frameOverlay.hide();
    frameOverlay = null;
    resetRevealed();
    initNewWord();
    gameManager.transitionTo(GameState.PLAYING);
  }
}

// Input handling — wire to canvas click/tap/space in gameLoop.js:
// if (endScreenType === 'win' && frameOverlay?.isReadyForInput()) {
//   onEndScreenContinue();
// }
```

---

### Step 5 — Wire Input Handling in `src/engine/gameLoop.js`

Add input listener for the DOM overlay state:

```js
// In the existing input handler (click/tap/space):
if (endScreenType === 'win' && frameOverlay?.isReadyForInput()) {
  onEndScreenContinue();
}
```

---

### Step 6 — Animation Timing Diagram

```
Time (s)    Action                              Visual
────────    ──────                              ──────
0.00        WORD_COMPLETE triggered             DOM overlay appears, frame layers begin sliding in
0.00-0.70   Frame layers animate (CSS keyframes) 5-layer castle wall composes
0.00-0.30   CSS particle burst                  60 particles fly from center (GPU-accelerated)
0.50        Word/emoji fades up inside frame    Scale + opacity transition
0.70        Frame fully settled                 All layers at scale(1), rotation(0)
0.70-2.50   Hold phase                          Confetti fading out, card holds
2.50+       Prompt appears                      "Tap anywhere / Space" blinks
Anytime     Input received                      Transition to next word (PLAYING state)
```

**Total time to prompt:** ~2.5 seconds  
**Total animation duration:** ~0.7s frame + 0.4s word reveal = ~1.1s active animation  
**Performance gain:** ~150 fewer JS lines, GPU-accelerated CSS transforms, no Canvas redraw loop

---

## Files Modified / Created

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/data/wordEmojis.js` | Emoji lookup table by tier/category (unchanged from original plan) |
| Create | `src/data/wordImages.js` | Image path mapping with preload manager + ready-state tracking (unchanged) |
| **Create** | **`src/effects/frameOverlay.css`** | **CSS keyframes, frame layer styles, particle burst styles (NEW)** |
| **Create** | **`src/effects/frameOverlay.js`** | **DOM overlay manager class (NEW)** |
| **Delete** | **`src/effects/confetti.js`** | **Replaced by CSS particle burst (DEPRECATED)** |
| **Delete** | **`src/effects/cardFlip.js`** | **Replaced by CSS frame overlay (DEPRECATED)** |
| Modify | `src/components/endScreen.js` | DOM overlay orchestration, state machine |
| Modify | `src/i18n/languages.js` | Add tapPrompt, pressSpacePrompt keys |
| Modify | `src/engine/gameLoop.js` | Wire click/tap/space input during WORD_COMPLETE |

---

## Key Design Decisions

1. **DOM overlay > Canvas redraw** — CSS stacking context handles layer compositing with zero JS per-frame cost. GPU-accelerated transforms ensure smooth 60fps on mobile.
2. **Frame asset stacking order (z-index):** `Background_0` (outer wall) → `Background` (fill) → `Layer3` (detail) → `Background_0` (center cutout) → `Background_1` (primary border).
3. **CSS particle burst replaces JS confetti** — 60 `<div>` particles with CSS custom properties (`--tx`, `--ty`, `--color`) for per-particle animation. No JS loop needed.
4. **Emoji/image fallback hierarchy unchanged** — exact word → category → tier → star (emoji); loaded image → emoji → placeholder (image).
5. **Opt-in image mapping** — `wordImages.js` is empty by default; the game works with only emojis until images are added.
6. **Graceful degradation at every layer** — failed preload → emoji swap; unmapped word → tier/category fallback → star; CSS animation failures degrade to instant display.
7. **No data migration on words.json** — emoji and image mapping are external and additive.
8. **Tap anywhere for children's UX** — no small button to aim at; the whole canvas/DOM area is the trigger zone.
9. **Game OVER state unchanged** — only WORD_COMPLETE gets the enhanced treatment. Game over keeps the simple retry button.

---

## Estimated Complexity

- **Low risk, high visual impact.** All components are self-contained DOM/CSS elements.
- ~200 lines of new CSS (`frameOverlay.css`) — keyframes, layer styles, particle burst.
- ~180 lines of new JS (`frameOverlay.js`) — DOM manager class.
- ~300 lines for `wordImages.js` (mapping + preload manager — mostly data entries).
- ~80 lines of changes across 2 existing files (endScreen, gameLoop).
- **Net reduction:** ~150 fewer lines total vs. original Canvas-based approach.

---

## Blockers

None. All dependencies are within the existing codebase structure. Frame assets already exist in `dist/assets/images/frames/`.

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
