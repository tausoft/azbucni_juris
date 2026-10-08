# Phase 2: Animation Crossfades Integration

**Source Design:** `PLAN-SMOOTH-TRANSITION.md` — Section "2. Animation Crossfades"  
**Scope:** ONLY animation crossfades (alpha-blend between two animation frames during state transitions idle↔run).  
**Excluded:** Lerp position smoothing, direction flip slides (covered in Phase 1 / PT1).

---

## 1. Objective

Replace the **instant animation swap** (`setCurrentAnimation()` resets frameIndex=0, animationTimer=0) with an **alpha-blended crossfade** that renders both the old and new frames simultaneously during state transitions idle↔run. The crossfade duration is ~100ms, during which opacity shifts from 100% old → 100% new.

---

## 2. Current Behavior (Before)

### Problem: Abrupt Animation Switching

**File:** `src/engine/player.js` — lines 334-338 (`updatePlayer` auto-transition logic):

```js
// Instant animation swap — no blending
if (player.direction !== 0 && player.currentAnimation === ANIM.idle) {
    player.setCurrentAnimation(ANIM.run);  // frameIndex=0, timer=0 — INSTANT!
} else if (player.direction === 0 && player.currentAnimation === ANIM.run) {
    player.setCurrentAnimation(ANIM.idle); // same instant swap
}
```

**File:** `src/engine/player.js` — lines 173-182 (`setCurrentAnimation` method):

```js
setCurrentAnimation(name) {
    if (!this.groups[name]) {
        console.warn(`Player: Unknown animation group '${name}'`);
        return;
    }
    this.currentAnimation = name;
    this.frameIndex = 0;        // ← resets immediately
    this.animationTimer = 0;    // ← resets immediately
}
```

### Visual Artifacts

```
Frame N:   [idle-frame-3]  alpha=1.0, facing right
Frame N+1: [run-frame-1]   alpha=1.0 — INSTANT SWAP! Looks jarring
Frame N+2: [run-frame-2]   alpha=1.0
```

The character instantly snaps to the first frame of the new animation — no blending, no transition.

---

## 3. Target Behavior (After)

```
Frame N:   [idle-frame-3]  alpha=1.0 (old), alpha=0.0 (new)
Frame N+1: [idle-frame-3]  alpha=0.7 + [run-frame-1] alpha=0.3 — crossfading
Frame N+2: [idle-frame-0]  alpha=0.4 + [run-frame-2] alpha=0.6 — crossfading
Frame N+3: [idle-frame-1]  alpha=0.0 + [run-frame-3] alpha=1.0 — transition complete
Frame N+4: [run-frame-4]   alpha=1.0 (new animation fully active)
```

---

## 4. Implementation Plan

### Step 1: Add Crossfade Constants to `constants.js`

**File:** `src/engine/constants.js`  
**Action:** Extend the existing `TRANSITIONS` section with crossfade constant.

```js
// Existing TRANSITIONS section (lines 62-66) — ADD this line:
TRANSITIONS: {
  FLIP_SLIDE_DURATION: 0.15,
  MIN_DIRECTION_THRESHOLD: 0.01,
  ANIMATION_CROSSFADE_DURATION: 0.1,   // ← NEW: 100ms crossfade
},
```

**Rationale:** Keeps all transition timing values centralized for easy tuning. The value `0.1` (100ms) balances smoothness with responsiveness — long enough to see the blend, short enough not to feel laggy.

---

### Step 2: Add Crossfade State Properties to Player Constructor

**File:** `src/engine/player.js`  
**Location:** Inside `Player` class constructor (~line 52, after `_victoryTriggered`).

**New properties to add:**

```js
// --- Animation crossfade (Phase: SMOOTH-TRANSITION PT2) ---
this.crossfading = false;          // true during active crossfade
this.crossfadeTimer = 0;           // elapsed time in current crossfade (seconds)
this.crossfadeDuration = GameConstants.TRANSITIONS.ANIMATION_CROSSFADE_DURATION;
this.prevFrame = null;             // previous animation frame data for blending
this.prevGroup = null;             // previous animation group name
this.prevAnimation = null;         // previous animation name (for debug/logging)
```

**Rationale:** These are lightweight per-frame state variables. `prevFrame` stores the actual frame object (with x, y, w, h coordinates), while `prevGroup` and `prevAnimation` track which group it came from. No new methods yet — just state.

---

### Step 3: Add Crossfade Helper Methods to Player Class

**File:** `src/engine/player.js`  
**Location:** Inside `Player` class, after `setCurrentAnimation()` method (~line 182).

#### 3a. `crossfadeTo(newGroupName)` — Begin a crossfade transition

```js
/**
 * Begin a crossfade transition to a new animation group.
 * Saves the current frame for alpha-blending during the transition.
 */
crossfadeTo(newGroupName) {
    if (!this.groups[newGroupName] || this.currentAnimation === newGroupName) {
        return; // Skip if group invalid or already active
    }

    const currentGroup = this.groups[this.currentAnimation];
    const currentFrame = currentGroup ? currentGroup[this.frameIndex] : null;

    if (!currentFrame) return; // Safety: no valid frame to crossfade from

    // Save current state for blending
    this.prevFrame = currentFrame;
    this.prevGroup = this.currentAnimation;
    this.prevAnimation = this.currentAnimation;

    // Start new animation from frame 0
    this.currentAnimation = newGroupName;
    this.frameIndex = 0;
    this.animationTimer = 0;

    // Enable crossfade
    this.crossfading = true;
    this.crossfadeTimer = 0;
}
```

#### 3b. `updateCrossfade(deltaTime)` — Update crossfade timer

```js
/**
 * Update crossfade timer. Returns true if crossfade is complete.
 */
updateCrossfade(deltaTime) {
    if (!this.crossfading) return true;

    this.crossfadeTimer += deltaTime;
    const t = Math.min(this.crossfadeTimer / this.crossfadeDuration, 1.0);

    // Crossfade complete?
    if (t >= 1.0) {
        this.crossfading = false;
        this.prevFrame = null;
        this.prevGroup = null;
        this.prevAnimation = null;
        return true;
    }

    return false;
}
```

#### 3c. `getCrossfadeAlpha()` — Get crossfade alpha value

```js
/**
 * Get crossfade alpha (0.0 = all old, 1.0 = all new).
 * Uses smoothstep easing for natural blend curve.
 */
getCrossfadeAlpha() {
    if (!this.crossfading) return 1.0;
    const t = this.crossfadeTimer / this.crossfadeDuration;
    // smoothstep easing: t² × (3 - 2t) — smooth acceleration/deceleration
    return t * t * (3 - 2 * t);
}
```

**Rationale:** Three focused methods keep the crossfade logic modular and testable. `crossfadeTo()` is the public entry point (replaces `setCurrentAnimation()` for transitions), while `updateCrossfade()` and `getCrossfadeAlpha()` are helpers used during update/draw cycles. The smoothstep easing function (`t² × (3-2t)`) provides a more natural blend curve than linear interpolation.
---

### Step 4: Refactor `setCurrentAnimation()` to Use Crossfade

**File:** `src/engine/player.js`  
**Function:** `setCurrentAnimation(name)` (~line 173)

**Current code:**

```js
setCurrentAnimation(name) {
    if (!this.groups[name]) {
        console.warn(`Player: Unknown animation group '${name}'`);
        return;
    }
    this.currentAnimation = name;
    this.frameIndex = 0;
    this.animationTimer = 0;
}
```

**New code:**

```js
setCurrentAnimation(name) {
    if (!this.groups[name]) {
        console.warn(`Player: Unknown animation group '${name}'`);
        return;
    }

    // If we're already in this animation, just reset timer (e.g., victory loop)
    if (this.currentAnimation === name && !this.crossfading) {
        this.frameIndex = 0;
        this.animationTimer = 0;
        return;
    }

    // Use crossfade for transitions between different animation groups
    if (!this.crossfading) {
        this.crossfadeTo(name);
    } else {
        // During active crossfade, just update target
        this.currentAnimation = name;
        this.frameIndex = 0;
        this.animationTimer = 0;
    }
}
```

**Rationale:** `setCurrentAnimation()` remains the public API (no signature changes), but internally delegates to `crossfadeTo()` for smooth transitions. The guard against re-triggering during active crossfade prevents animation stacking bugs.

---

### Step 5: Refactor `draw()` to Support Crossfade Rendering

**File:** `src/engine/player.js`  
**Function:** `draw(ctx)` (~line 188)

#### 5a. Extract `_drawSingleFrame()` helper

First, extract the existing draw logic into a reusable private method:

```js
/**
 * Internal: draw a single frame with direction flip support.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} frame — {x, y, w, h} from spritesheet
 * @param {Array} group — the animation group array (unused but kept for extensibility)
 */
_drawSingleFrame(ctx, frame, group) {
    if (this.facing === -1) {
        // Flip horizontally when facing left
        const pivotX = this.x + this.width;
        ctx.save();
        ctx.translate(pivotX, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(
            this.image,
            frame.x, frame.y, frame.w, frame.h, // source
            0, this.y, this.width, this.height, // dest (extends left from flipped origin)
        );
        ctx.restore();
    } else {
        ctx.drawImage(
            this.image,
            frame.x, frame.y, frame.w, frame.h, // source
            this.x, this.y, this.width, this.height, // dest
        );
    }
}
```

#### 5b. Refactor `draw()` to use crossfade

**Current code (lines 188-242):**

```js
draw(ctx) {
    if (!this.isReady || !this._framesBuilt) {
        ctx.fillStyle = '#3498db';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        return;
    }

    const group = this.groups[this.currentAnimation];
    if (!group || !group[this.frameIndex]) {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        return;
    }
    const frame = group[this.frameIndex];

    // ... existing draw logic (facing flip) ...
}
```

**New code:**

```js
draw(ctx) {
    if (!this.isReady || !this._framesBuilt) {
        ctx.fillStyle = '#3498db';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        return;
    }

    const currentGroup = this.groups[this.currentAnimation];
    if (!currentGroup || !currentGroup[this.frameIndex]) {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        return;
    }
    const currentFrame = currentGroup[this.frameIndex];

    // --- Crossfade rendering ---
    if (this.crossfading && this.prevFrame && this.prevGroup) {
        const alpha = this.getCrossfadeAlpha();

        // Draw previous frame (fading out)
        ctx.globalAlpha = 1.0 - alpha;
        this._drawSingleFrame(ctx, this.prevFrame, this.prevGroup);

        // Draw current frame (fading in)
        ctx.globalAlpha = alpha;
        this._drawSingleFrame(ctx, currentFrame, currentGroup);

        ctx.globalAlpha = 1.0; // Reset
    } else {
        // Normal single-frame render
        this._drawSingleFrame(ctx, currentFrame, currentGroup);
    }

    // --- Debug overlay: draw logical hitbox as green wireframe ---
    if (typeof DEBUG_DRAW_HITBOX !== 'undefined' && DEBUG_DRAW_HITBOX) {
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
}
```

**Rationale:** The crossfade rendering draws both frames with `globalAlpha` blending. The previous frame renders at `1-alpha` opacity (fading out), and the current frame renders at `alpha` opacity (fading in). The `_drawSingleFrame()` helper eliminates code duplication from the original `draw()` method. The debug overlay remains outside any alpha state changes.

---

### Step 6: Integrate Crossfade Update into updatePlayer()

**File:** src/engine/player.js  
**Function:** updatePlayer(deltaTime) (~line 290)

#### 6a. Add crossfade update call

Insert after the flip-slide logic (~line 328, before the animation auto-transition):

```js
// --- Crossfade update (Phase: SMOOTH-TRANSITION PT2) ---
if (player.crossfading) {
    player.updateCrossfade(deltaTime);
}
```

#### 6b. Replace instant animation switching with crossfade

**Current code (lines 334-338):**

```js
// Auto-transition idle to run based on movement direction
if (player.direction !== 0 && player.currentAnimation === ANIM.idle) {
    player.setCurrentAnimation(ANIM.run);
} else if (player.direction === 0 && player.currentAnimation === ANIM.run) {
    player.setCurrentAnimation(ANIM.idle);
}
```

**New code:**

```js
// Auto-transition idle to run based on movement direction (with crossfade)
    player.setCurrentAnimation(ANIM.run);
    player.setCurrentAnimation(ANIM.idle);
}
```


---

## 5. File Change Summary

| File | Changes |
|------|---------|
| src/engine/constants.js | Add ANIMATION_CROSSFADE_DURATION: 0.1 to TRANSITIONS |
| src/engine/player.js | Add crossfade state properties, add crossfadeTo/updateCrossfade/getCrossfadeAlpha methods, refactor setCurrentAnimation(), extract _drawSingleFrame() helper, refactor draw() with crossfade rendering, integrate crossfade update into updatePlayer() |
| src/engine/gameLoop.js | No changes (API surface unchanged) |

---

## 6. Public API Surface (Unchanged)

All existing exports remain compatible:

```js
// These function signatures do NOT change:
initPlayer(canvasW, canvasH)    // returns Player instance (with new crossfade state)
updatePlayer(deltaTime)         // internally calls updateCrossfade()
drawPlayer(ctx)                 // renders crossfaded sprite
setCurrentAnimation(name)       // now triggers crossfade instead of instant swap
triggerVictory()                // unchanged - uses existing animation system
```

---

## 7. Visual Behavior Comparison

### Before (Instant Swap)

```
Frame N:   [XXXX]  idle-frame-3, alpha=1.0, facing right
Frame N+1: [XXXX]  run-frame-1, alpha=1.0 - INSTANT SWAP! Jarring
Frame N+2: [XXXX]  run-frame-2, alpha=1.0
```

### After (Smooth Crossfade)

```
Frame N:   [XXXX]  idle-frame-3, alpha=1.0 (old) + 0.0 (new)
Frame N+1: [.XXX]  idle-frame-3 @ 0.7 + run-frame-1 @ 0.3 - crossfading
Frame N+2: [ XX.]  idle-frame-0 @ 0.4 + run-frame-2 @ 0.6 - crossfading
Frame N+3: [XXXX]  run-frame-3, alpha=1.0 (new fully active)
```

---

## 8. Testing Checklist (Manual Browser Tests)

- [ ] Hold right arrow to start running - observe smooth idle-to-run crossfade (~100ms blend visible)
- [ ] Release to stop - observe smooth run-to-idle crossfade
- [ ] Rapid movement toggle (hold/release/hold/release) - verify no double-crossfade or animation glitch
- [ ] Direction flip during crossfade - verify both flip slide and crossfade work together without conflict
- [ ] Letter catching during crossfade - verify no missed catches or visual artifacts
- [ ] Victory animation trigger - verify it still works (victory uses setCurrentAnimation internally)
- [ ] Edge: switch animations while crossfade is mid-progress - should not restart or glitch

---

## 9. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Crossfade causes visual ghosting on low-end devices | globalAlpha blending is GPU-accelerated in modern browsers; fallback to single-frame if FPS drops below 30 |
| Crossfade makes animation feel slow | Duration of 100ms is short enough that it does not disrupt perceived animation speed; tune down to 0.075s if needed |
| globalAlpha state leaks to other renderers | Always reset ctx.globalAlpha = 1.0 after crossfade draw; the refactored draw() method handles this |

---

## 10. Implementation Order

1. **Step 1:** Add ANIMATION_CROSSFADE_DURATION constant to constants.js
2. **Step 2:** Add crossfade state properties to Player constructor
3. **Step 3:** Add crossfadeTo(), updateCrossfade(), getCrossfadeAlpha() methods
4. **Step 4:** Refactor setCurrentAnimation() to delegate to crossfadeTo()
5. **Step 5:** Extract _drawSingleFrame() helper and refactor draw() with crossfade rendering
7. **Step 7:** Test in browser - verify smooth idle-to-run animation blending

---

## 11. Future Phases (Deferred)

| Phase | Feature | Status |
|-------|---------|--------|
| Phase 1 | Direction flip slides | Completed (PT1) |
| Phase 2 | Animation crossfades | This phase |
| Phase 3 | Lerp-based visual position smoothing (smoothedX) | Deferred |
| Phase 4 | Tune all transition constants together | Deferred |

---

## 12. Integration with Phase 1 (Flip Slides) - No Conflicts

The crossfade system is independent of the flip-slide system:

- **Flip slides** affect player.x (position reversal)
- **Crossfades** affect rendering only (alpha blending between frames)
- Both use isFlipping and crossfading boolean guards to prevent stacking
- The refactored _drawSingleFrame() helper supports both facing === -1 flip AND crossfade alpha simultaneously

No conflicts expected - the two systems operate on different layers of the rendering pipeline.
