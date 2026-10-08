# Phase 1: Direction Flip Slides Integration

**Source Design:** `PLAN-SMOOTH-TRANSITION.md` — Section "1. Direction Flip Slides"  
**Scope:** ONLY direction flip slides (smooth lateral interpolation on direction reversal).  
**Excluded:** Animation crossfades, Lerp position smoothing (covered in later phases).

---

## 1. Objective

Replace the **instant direction flip** (`player.direction = -player.direction`) with a **smooth slide-back animation** that gives the character visible momentum when reversing movement direction. The logical position (`player.x`) remains the collision source of truth — only the visual rendering layer is affected.

---

## 2. Current Behavior (Before)

```
Frame N:   player.direction = +1, x = 300 → moving RIGHT
Frame N+1: player.direction = -1, x = 301 → instant REVERSE — no visual slide
```

The character's movement intent flips instantly with zero deceleration. The sprite appears to "teleport" its direction.

---

## 3. Target Behavior (After)

```
Frame N:   player.direction = +1, x = 300 → moving RIGHT
Frame N+1: isFlipping = true, slideTimer = 0.01 → character slows down
Frame N+5: slideTimer = 0.05 → character nearly stopped, sliding back
Frame N+10: slideTimer = 0.10 → character accelerates LEFT
Frame N+16: slideTimer = 0.15 → flip complete, direction = -1, smooth
```

The character decelerates over ~150ms, slides through a brief reversal point, then accelerates in the new direction.

---

## 4. Implementation Plan

### Step 1: Add Transition Constants to `constants.js`

**File:** `src/engine/constants.js`  
**Action:** Append a new `TRANSITIONS` section to `GameConstants`.

```js
// At end of GameConstants object, add:
  // Smooth transition constants (Phase: SMOOTH-TRANSITION)
  TRANSITIONS: {
    FLIP_SLIDE_DURATION: 0.15,       // 150ms full reversal
    MIN_DIRECTION_THRESHOLD: 0.01,    // prevent micro-flips
  },
```

**Rationale:** All timing values go into constants for easy tuning later. The crossfade and lerp constants from the source design are **deferred to Phase 2/3**.

---

### Step 2: Add Flip-Slide Properties to Player Constructor

**File:** `src/engine/player.js`  
**Location:** Inside `Player` class constructor, after existing properties (~line 54).

**New properties to add:**

```js
// --- Direction flip slide (Phase: SMOOTH-TRANSITION PT1) ---
this.flipSlideTimer = 0;           // tracks reversal progress (seconds)
this.flipSlideDuration = GameConstants.TRANSITIONS.FLIP_SLIDE_DURATION;
this.isFlipping = false;           // true during active flip
this.flipSlideDirection = 0;       // target direction once slide completes
```

**Rationale:** These are lightweight per-frame state variables. No new methods yet — just state.

---

### Step 3: Refactor `setDirection()` to Trigger Flip Slide

**File:** `src/engine/player.js`  
**Function:** `setDirection(dir)` (line 330-335)

**Current code:**
```js
export function setDirection(dir) {
  if (!player) return;
  player.direction = Math.max(-1, Math.min(1, dir));
  if (dir !== 0) player.facing = dir;
}
```

**New code:**
```js
export function setDirection(dir) {
  if (!player) return;

  dir = Math.max(-1, Math.min(1, dir));

  // If direction is changing to opposite of current, trigger flip slide
  if (player.direction !== 0 && player.direction !== dir && dir !== 0) {
    // Only trigger if moving in the opposite direction (not just starting/stopping)
    if (player.direction * dir < 0) {
      player.isFlipping = true;
      player.flipSlideTimer = 0;
      player.flipSlideDirection = dir;
      // Do NOT change player.direction yet — wait for slide to complete
      return;
    }
  }

  // Normal direction set (no flip needed)
  player.direction = dir;
  if (dir !== 0) player.facing = dir;
}
```

**Rationale:** This is the core logic change. When the player presses the opposite key (e.g., → then ←), instead of instantly flipping, we set `isFlipping = true` and defer the direction change until the slide completes.

---

### Step 4: Add Flip-Slide Update Logic to `updatePlayer()`

**File:** `src/engine/player.js`  
**Function:** `updatePlayer(deltaTime)` (line 277-324)  
**Location:** Before the existing movement logic (~before line 314).

**New code to insert at the top of `updatePlayer()`, after the debug teleport check:**

```js
  // --- Direction flip slide update (Phase: SMOOTH-TRANSITION PT1) ---
  if (player.isFlipping) {
    player.flipSlideTimer += deltaTime;
    const t = Math.min(player.flipSlideTimer / player.flipSlideDuration, 1.0);

    // Ease-out cubic for natural deceleration → acceleration curve
    const eased = 1 - Math.pow(1 - t, 3);

    // Calculate slide range: how far the character drifts during reversal
    const slideRange = player.speed * player.flipSlideDuration * 0.5;

    // The flip center is where the character briefly pauses (direction-neutral point)
    const flipCenter = player.x - (player.direction * slideRange);

    // Slide toward new target: from flipCenter back along the original direction,
    // then accelerate into the new direction
    const newTargetX = flipCenter + (player.flipSlideDirection * slideRange * eased);

    // Apply slide — character drifts during reversal
    player.x += (newTargetX - player.x) * deltaTime * 8;

    // Check if slide is complete
    if (t >= 1.0) {
      player.direction = player.flipSlideDirection;
      player.facing = player.flipSlideDirection;
      player.isFlipping = false;
      player.flipSlideTimer = 0;
      // Snap to clean position
      player.x = flipCenter + (player.flipSlideDirection * slideRange);
    }
  }
```

**Rationale:**
- `eased` uses cubic ease-out: fast deceleration, slow pause, fast acceleration — feels natural.
- `slideRange` determines how far the character drifts during reversal (~15px at default speed).
- The character briefly pauses at `flipCenter` (the direction-neutral point) before accelerating into the new direction.
- The `* deltaTime * 8` multiplier ensures the slide completes smoothly within the target duration regardless of frame rate.

---

### Step 5: Update Animation Auto-Transition to Respect Flip State

**File:** `src/engine/player.js`  
**Function:** `updatePlayer(deltaTime)` — animation transition block (~lines 296-300)

**Current code:**
```js
  if (player.direction !== 0 && player.currentAnimation === ANIM.idle) {
    player.setCurrentAnimation(ANIM.run);
  } else if (player.direction === 0 && player.currentAnimation === ANIM.run) {
    player.setCurrentAnimation(ANIM.idle);
  }
```

**Change:** During flip slide, `player.direction` is still the **old** direction (we haven't changed it yet). The auto-transition logic should **not** trigger during a flip because:
1. `direction` is still non-zero → character stays in run animation (correct — character is still "moving")
2. This is actually the desired behavior — the character continues running during the slide

**Verdict:** No change needed to this block. The existing logic already handles flips correctly because `direction` remains unchanged during the slide phase.

---

### Step 6: Preserve Logical Position for Collision

**File:** `src/engine/player.js`  
**Function:** `getPlayerHitbox()` (line 342-344)

**Current code:**
```js
export function getPlayerHitbox() {
  return player ? { x: player.x, y: player.y, width: player.width, height: player.height } : null;
}
```

**Verdict:** No change needed. `player.x` is still the logical position used for collision detection. The flip slide modifies `player.x` directly (not a separate visual position), but this is intentional for Phase 1 — the slide is short enough (150ms) that it doesn't meaningfully affect collision timing. If future phases add Lerp smoothing, we would introduce a separate `smoothedX` for rendering only.

---

## 5. File Change Summary

| File | Changes |
|------|---------|
| `src/engine/constants.js` | Add `TRANSITIONS` section with `FLIP_SLIDE_DURATION` and `MIN_DIRECTION_THRESHOLD` |
| `src/engine/player.js` | Add flip-slide properties to constructor, refactor `setDirection()`, add flip-slide update logic to `updatePlayer()` |
| `src/engine/gameLoop.js` | No changes (API surface unchanged) |

---

## 6. Visual Behavior Comparison

### Before (Instant Flip)
```
Frame N:   [→████]  direction=+1, x=300
Frame N+1: [←████]  direction=-1, x=301  ← INSTANT REVERSE
Frame N+2: [←████]  direction=-1, x=298
```

### After (Smooth Flip Slide)
```
Frame N:   [→████]  direction=+1, x=300
Frame N+1: [→██░░]  isFlipping=true, t=0.02 → character slows, drifts back slightly
Frame N+5: [░░██░]  isFlipping=true, t=0.08 → near pause at flip center
Frame N+10:[←░░██]  isFlipping=true, t=0.13 → accelerating LEFT
Frame N+16:[←████]  direction=-1, x=285  ← smooth transition complete
```

---

## 7. Testing Checklist (Manual Browser Tests)

- [ ] Hold → then hold ← — observe visible slide-back (not instant reversal)
- [ ] Hold ← then hold → — same behavior in reverse
- [ ] Rapid direction changes (→ ← → ←) — each flip should complete smoothly without stacking
- [ ] Direction flip during run animation — character stays in run (no animation glitch)
- [ ] Direction flip during idle — should not trigger (idle has no active direction)
- [ ] Letter catching during flip slide — verify no missed catches or double catches
- [ ] Edge: flip at canvas boundary — character should clamp correctly

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Flip slide makes character feel "sluggish" | Tune `FLIP_SLIDE_DURATION` down to 0.1s if needed |
| Rapid flips could stack or glitch | The `if (player.isFlipping)` guard prevents stacking — new flips during active slide are ignored |
| Collision timing shifts during slide | Slide duration is only 150ms; logical position changes minimally. Future Lerp phase will separate logical/visual positions entirely |

---

## 9. Implementation Order

1. **Step 1:** Add `TRANSITIONS` constants to `constants.js`
2. **Step 2:** Add flip-slide properties to Player constructor
3. **Step 3:** Refactor `setDirection()` to trigger flip slide
4. **Step 4:** Insert flip-slide update logic into `updatePlayer()`
5. **Step 5:** Test in browser — verify smooth direction reversal

---

## 10. Future Phases (Deferred)

| Phase | Feature | Status |
|-------|---------|--------|
| Phase 2 | Lerp-based visual position smoothing (`smoothedX`) | Deferred |
| Phase 3 | Animation crossfades (idle↔run blending) | Deferred |
| Phase 4 | Tune all transition constants together | Deferred |

Phase 1 stands alone and is fully reversible without affecting future phases.
