This plan introduces three complementary techniques to eliminate visual jitter and teleportation artifacts in the Azbučni Juriš player character:

1. **Direction Flip Slides** — Smooth lateral interpolation when `direction` flips between left/right
2. **Animation Crossfades** — Alpha-blend between two animation frames during state transitions (idle↔run, run→idle)
3. **Linear Interpolation (Lerp)** — Bridge the gap between input direction changes and visual position updates

These techniques transform the current **discrete/step** movement model into a **continuous/smooth** one without changing game logic correctness or collision detection accuracy.

---

## Current Behavior Analysis

### Problem 1: Instant Direction Flips
```js
// player.js line 314-323 — current discrete movement
if (player.direction === 0) return;
const moveAmount = player.speed * deltaTime * player.direction;
player.x += moveAmount;
```
When `direction` flips from `+1` to `-1`, the character **instantly** reverses. There is no momentum or slide — the sprite appears to "teleport" its movement intent.

### Problem 2: Abrupt Animation Switching
```js
// player.js line 296-300 — instant animation swap
if (player.direction !== 0 && player.currentAnimation === ANIM.idle) {
    player.setCurrentAnimation(ANIM.run);
} else if (player.direction === 0 && player.currentAnimation === ANIM.run) {
    player.setCurrentAnimation(ANIM.idle);
}
```
The `setCurrentAnimation()` method **resets** `frameIndex = 0` and `animationTimer = 0`. The character instantly snaps to the first frame of the new animation — no blending.

### Problem 3: Direct X Assignment (No Interpolation)
```js
player.x += moveAmount; // direct delta application
```
The player's visual position is always exactly at its logical position. There is no "lag" or "ease" that would make movement feel smoother to the eye.

---

## Proposed Architecture

### Three-Layer Rendering Model

```
┌─────────────────────────────────────────────┐
│  Layer 1: Logical Position (player.x)       │  ← Game logic, collision, physics
│  Layer 2: Smoothed Visual Position            │  ← Lerp-based interpolation
│  Layer 3: Crossfade Animation Blending        │  ← Alpha blend between frames
└─────────────────────────────────────────────┘
```

**Key Principle:** Logical position (`player.x`) remains the **source of truth** for collision detection. Visual rendering applies smoothing on top, without affecting game mechanics.

---

## Implementation Details

### 1. Direction Flip Slides (Smooth Reversal)

#### Concept
When `direction` flips from `+1` to `-1` (or vice versa), instead of instantly reversing movement, the character slides through a brief **deceleration phase** before accelerating in the new direction.

#### Changes to `Player` class:

```js
// New properties in constructor
this.smoothedX = this.x;       // Visual X (lerped toward logical X)
this.targetX = this.x;         // Logical target position
this.flipSlideTimer = 0;       // Tracks slide reversal progress
this.flipSlideDuration = 0.15; // 150ms for full reversal (configurable)
this.isFlipping = false;       // True during active flip

// New method
flipDirection(newDir) {
    if (newDir === 0 || newDir === this.direction) {
        this.direction = newDir;
        return;
    }

    // Only trigger slide if already moving in opposite direction
    if (this.direction !== 0 && this.direction !== newDir) {
        this.isFlipping = true;
        this.flipSlideTimer = 0;
        this.flipSlideDirection = newDir; // store target direction
        // Don't change direction yet — slide completes first
        return;
    }

    this.direction = newDir;
}
```

#### Update logic in `updatePlayer`:

```js
// During flip slide, smoothly interpolate X toward the reversal point
if (this.isFlipping) {
    this.flipSlideTimer += deltaTime;
    const t = Math.min(this.flipSlideTimer / this.flipSlideDuration, 1.0);

    // Ease-out cubic for natural deceleration/acceleration
    const eased = 1 - Math.pow(1 - t, 3);

    // Slide X toward the point where direction flips, then toward new target
    const slideRange = this.speed * this.flipSlideDuration * 0.5;
    const flipCenter = this.targetX - (this.direction * slideRange);
    const newTarget = flipCenter + (this.flipSlideDirection * slideRange * eased);

    this.smoothedX += (newTarget - this.smoothedX) * deltaTime * 8; // fast lerp

    if (t >= 1.0) {
        this.direction = this.flipSlideDirection;
        this.isFlipping = false;
        this.smoothedX = this.targetX; // snap to logical position
    }
}
```

---

### 2. Animation Crossfades

#### Concept
When transitioning between animation groups (idle ↔ run), render both the **old frame** and **new frame** simultaneously with alpha blending. The crossfade duration is ~100ms, during which opacity shifts from 100% old → 100% new.

#### Changes to `Player` class:

```js
// New properties in constructor
this.crossfading = false;
this.crossfadeTimer = 0;
this.crossfadeDuration = 0.1; // 100ms crossfade
this.prevFrame = null;        // Previous frame data
this.prevGroup = null;        // Previous animation group name
this.prevAnimation = null;    // Previous animation name
```

#### Crossfade helper:

```js
/**
 * Begin a crossfade transition to a new animation group.
 */
crossfadeTo(newGroupName) {
    if (this.groups[newGroupName] && this.currentAnimation !== newGroupName) {
        // Save current state for blending
        const currentGroup = this.groups[this.currentAnimation];
        this.prevFrame = currentGroup[this.frameIndex];
        this.prevGroup = currentGroup;
        this.prevAnimation = this.currentAnimation;

        // Start new animation from frame 0
        this.currentAnimation = newGroupName;
        this.frameIndex = 0;
        this.animationTimer = 0;

        // Enable crossfade
        this.crossfading = true;
        this.crossfadeTimer = 0;
    }
}

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

/**
 * Get crossfade alpha (0.0 = all old, 1.0 = all new).
 */
getCrossfadeAlpha() {
    if (!this.crossfading) return 1.0;
    const t = this.crossfadeTimer / this.crossfadeDuration;
    // Ease-in-out for smooth blend
    return t * t * (3 - 2 * t); // smoothstep
}
```

#### Modified `draw()` method:

```js
draw(ctx) {
    if (!this.isReady || !this._framesBuilt) {
        ctx.fillStyle = '#3498db';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        return;
    }

    const currentGroup = this.groups[this.currentAnimation];
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
}

/**
 * Internal: draw a single frame with direction flip support.
 */
_drawSingleFrame(ctx, frame, group) {
    if (this.facing === -1) {
        const pivotX = this.smoothedX + this.width;
        ctx.save();
        ctx.translate(pivotX, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(
            this.image,
            frame.x, frame.y, frame.w, frame.h,
            0, this.y, this.width, this.height,
        );
        ctx.restore();
    } else {
        ctx.drawImage(
            this.image,
            frame.x, frame.y, frame.w, frame.h,
            this.smoothedX, this.y, this.width, this.height,
        );
    }
}
```

---

### 3. Linear Interpolation (Lerp) for Visual Position

#### Concept
The **visual** position (`smoothedX`) lags slightly behind the **logical** position (`targetX`). This creates a natural "weight" to the character's movement — it feels like the sprite has mass and momentum.

#### Changes:

```js
// In constructor
this.x = 100;                    // Logical X (collision source of truth)
this.smoothedX = 100;            // Visual X (rendered position)
this.lerpFactor = 12.0;          // Lerp speed — higher = tighter tracking

// In updatePlayer, replace direct x assignment:
if (player.direction !== 0 && !player.isFlipping) {
    const moveAmount = player.speed * deltaTime * player.direction;
    player.x += moveAmount;        // Update logical position

    // Clamp logical position
    const halfW = player.width / 2;
    player.x = Math.max(halfW, Math.min(canvasWidth - halfW, player.x));

    // Lerp visual position toward logical position
    player.smoothedX += (player.x - player.smoothedX) *
                        Math.min(player.lerpFactor * deltaTime, 1.0);
}
```

#### Why `lerpFactor = 12.0`?
- At 60fps, this gives ~83% tracking per frame — tight enough that the visual position is nearly identical to logical position during continuous movement
- During direction flips, the lag creates a natural "drift" effect (the sprite continues briefly in its old direction before settling)
- Higher values (15-20) make it feel snappier; lower values (6-8) make it feel more "slippery"

---

## Integration Points

### Modified Files

| File | Changes |
|------|---------|
| `src/engine/player.js` | Add smooth transition properties, update `updatePlayer()`, refactor `draw()` with crossfade support |
| `src/engine/constants.js` | Add `TRANSITION_SLIDE_DURATION`, `ANIMATION_CROSSFADE_DURATION`, `LERP_FACTOR` to `GameConstants` |
| `src/engine/gameLoop.js` | No changes needed (API surface unchanged) |
| `src/engine/state.js` | No changes needed |

### Public API Surface (unchanged)

All existing exports remain compatible:

```js
// These function signatures do NOT change:
initPlayer(canvasW, canvasH)    // returns Player instance
updatePlayer(deltaTime)          // internal smoothing only
drawPlayer(ctx)                  // renders smoothed/crossfaded sprite
setDirection(dir)                // now triggers slide instead of instant flip
stopPlayer()                     // same behavior
getPlayerHitbox()                // still returns logical position for collision
triggerVictory()                 // unchanged — uses existing animation system
```

### Collision Detection Impact

**No impact.** The `getPlayerHitbox()` function continues to return the **logical** `player.x` position, not `smoothedX`. This means:
- Collision detection remains frame-perfect
- Falling letter matching uses exact game state
- Only the visual layer is smoothed

---

## Configuration Constants (to add to `GameConstants`)

```js
// In constants.js — new section
TRANSITIONS: {
    FLIP_SLIDE_DURATION: 0.15,      // 150ms for full direction reversal
    ANIMATION_CROSSFADE_DURATION: 0.1, // 100ms idle↔run crossfade
    LERP_FACTOR: 12.0,               // Visual position tracking speed
    MIN_DIRECTION_THRESHOLD: 0.01,   // Prevent micro-flips from triggering slide
},
```

---

## Visual Behavior Summary

### Before (Current)
```
Frame N:  [████]  (idle frame 1, facing right)
Frame N+1: [████] (run frame 1, facing left — INSTANT swap!)
Frame N+2: [████] (run frame 2, facing left)
```
→ The character instantly swaps from idle to run and flips direction. Looks jarring.

### After (Smoothed)
```
Frame N:  [████]  (idle frame 1, alpha=1.0, facing right)
Frame N+1: [░░██] (idle frame 1 @ alpha=0.7 + run frame 1 @ alpha=0.3, crossfading)
Frame N+2: [ ██░] (idle frame 2 @ alpha=0.4 + run frame 2 @ alpha=0.6, crossfading)
Frame N+3: [████] (run frame 3, alpha=1.0, facing left — fully transitioned)
```
→ The character blends between states naturally. Direction flip includes a brief slide-back.

---

## Testing Strategy

### Unit Tests (manual, via browser console)
1. **Direction flip test:** Hold → then hold ← — observe smooth slide reversal
2. **Animation crossfade test:** Toggle movement on/off rapidly — observe frame blending
3. **Lerp tracking test:** Move at full speed, stop suddenly — observe visual position settling
4. **Collision integrity test:** Catch letters during transitions — verify no missed catches

### Visual Acceptance Criteria
- [ ] Direction flip produces visible slide-back (not instant reversal)
- [ ] Animation swap (idle↔run) shows smooth frame blending (~100ms)
- [ ] Character feels "weighted" — not floaty, not rigid
- [ ] No visual pop, jitter, or tearing during transitions
- [ ] Collision detection still works perfectly during all transition states

---

## Implementation Order

1. **Step 1:** Add lerp-based position smoothing (foundation layer)
2. **Step 2:** Add direction flip slide (builds on lerp)
3. **Step 3:** Add animation crossfade (independent rendering layer)
4. **Step 4:** Tune transition constants for feel
5. **Step 5:** Test all three techniques together

Each step is self-contained and reversible without affecting the others.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Crossfade causes visual ghosting on low-end devices | Use `globalAlpha` sparingly; fallback to single-frame if FPS drops below 30 |
| Lerp lag makes character feel unresponsive | Cap lerp lag at max 4px; use `Math.min(factor * dt, 1.0)` for frame-rate independence |
| Flip slide breaks collision timing | Slide only affects visual X; logical X updates normally — no collision impact |
| Crossfade breaks animation rhythm | Crossfade duration is short enough (100ms) that it doesn't disrupt perceived animation speed |

---

## Future Extensions (Out of Scope for This Phase)

- **Trail effect:** Render semi-transparent "ghost" frames behind the character during fast movement
- **Squash & stretch:** Scale sprite slightly during direction flip peaks
- **Animation blending:** Blend between idle/run frames based on movement speed (not just binary state)
- **Spring-based physics:** Replace lerp with damped spring for more natural overshoot/oscillation