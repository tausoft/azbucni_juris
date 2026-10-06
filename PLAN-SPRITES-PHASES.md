# PLAN: Sprite System — Phased Development Roadmap

## Overview

Building on the **proof-of-concept** in `player.js` (static sprite render), this plan defines incremental phases to complete the full sprite system: correct positioning, movement, animation, theme switching, and integration.

---

## Phase 1 — Correct Position & Sizing

> **Goal:** Replace hardcoded `x=100, y=100` with canvas-relative sizing using existing `GameConstants`. Sprite renders at proper game position (bottom area, ~82% from top).

### Steps

- [ ] Restore `import { GameConstants } from './constants.js';` in `player.js`
- [ ] Update `initPlayer(canvasW, canvasH)` to:
  - Calculate `width = canvasW * GameConstants.PLAYER_WIDTH_RATIO` (6%)
  - Calculate `height = canvasH * GameConstants.PLAYER_HEIGHT_RATIO` (8%)
  - Set `x = canvasW / 2 - width / 2` (centered horizontally)
  - Set `y = canvasH * 0.82` (near bottom, matching original design)
- [ ] Store `canvasWidth`/`canvasHeight` as module-level variables for bounds checking
- [ ] Update `draw(ctx)` to scale sprite frame to calculated `width × height` instead of raw 211×240
- [ ] Update `getPlayerHitbox()` to return dynamic `{ width, height }` instead of fixed `60×60`
- [ ] Verify sprite renders centered at bottom with correct aspect ratio

### Dependencies
- None — standalone fix

---

## Phase 2 — Movement & Input

> **Goal:** Restore delta-time movement. Player responds to keyboard (arrows/WASD) and touch inputs. Clamped to canvas bounds.

### Steps

- [ ] Add `this.speed = canvasW * GameConstants.PLAYER_SPEED_RATIO` (30% of width/sec)
- [ ] Add `this.direction: 0` state (−1 left, 0 none, +1 right)
- [ ] Restore `updatePlayer(deltaTime)` with delta-time clamping logic
- [ ] Restore `setDirection(dir)` and `stopPlayer()` module-level functions
- [ ] Wire input in `main.js`:
  - Keyboard: `keydown`/`keyup` listeners for Arrow keys + WASD → call `setDirection()` / `stopPlayer()`
  - Touch: `touchstart`/`touchend` on canvas → set direction based on touch X relative to player center
- [ ] Verify smooth movement at any frame rate (delta-time based)

### Dependencies
- Phase 1 complete (player must exist at correct position first)

---

## Phase 3 — Animation System

> **Goal:** Replace static `knight-idle-1` render with a sprite animation system supporting idle, run, and victory states.

### Steps

- [ ] Add animation state to `Player` (currentFrame, animationTimer, frameIndex, fps)
- [ ] Define frame groups from JSON: `idle×4`, `run×6`, `victory×6`, `victory-idle×2`
- [ ] Implement `updateAnimation(deltaTime)` — advances frame index based on timer/fps, loops frames
- [ ] Update `draw(ctx)` to render current frame from animation group (not hardcoded key)
- [ ] Add `setCurrentAnimation(groupName)` method (e.g., `'run'` when direction ≠ 0)
- [ ] Verify smooth frame cycling for idle/run states

### Dependencies
- Phase 2 complete (need movement to trigger run animation)

---

## Phase 4 — Theme Switching (Princess)

> **Goal:** Load and render princess spritesheet when Princess theme is selected. Dual-theme asset management.

### Steps

- [ ] Add princess asset paths and holders (`princessJson`, `princessImage`)
- [ ] Extend `_loadAssets()` to also load princess assets (parallel fetch + Image)
- [ ] Add `this.theme` state — read from `gameManager.getTheme()` in `initPlayer`
- [ ] Update `draw(ctx)` to select correct JSON/image based on theme
- [ ] Add `switchTheme(newTheme)` method to swap active theme and update animation groups
- [ ] Verify both knight and princess sprites render correctly

### Dependencies
- Princess spritesheet assets must exist at `/sprites/princess/`
- Phase 3 complete (animation system must support both themes)

---

## Phase 5 — Victory & Game Integration

> **Goal:** Wire victory animation to game state transitions. Proper hitbox for collision detection during gameplay.

### Steps

- [ ] Add `triggerVictory()` logic: switch animation to `'victory'`, play once, then return to `'idle'`
- [ ] Wire `triggerVictory()` from `gameLoop.js` when word is complete
- [ ] Ensure hitbox (`getPlayerHitbox()`) matches current rendered sprite bounds (not animation frame)
- [ ] Verify collision detection works during victory animation
- [ ] Test full flow: spawn letters → catch them → word complete → victory animation → resume

### Dependencies
- Phase 4 complete (must support both themes for victory)
- `gameLoop.js` and `state.js` integration points

---

## Summary Table

| Phase | Focus | Risk Level | Est. Effort |
|-------|-------|------------|-------------|
| **1** | Position & sizing | Low | Small |
| **2** | Movement & input | Low-Medium | Medium |
| **3** | Animation system | Medium | Large |
| **4** | Theme switching | Medium | Medium |
| **5** | Victory & integration | Medium | Medium |

## Rollback Strategy

Each phase adds features without removing previous ones. If a phase fails, revert only that phase's changes in `player.js`.

## Notes

- All sprite frames are `211×240px` in the spritesheet — consistent sizing simplifies animation.
- Spritesheet has **no trimming** (`"trimmed": false`) — frame coordinates are exact pixel offsets.
- The JSON uses hash-based frame keys (not arrays), so frame lookup is by string key.
