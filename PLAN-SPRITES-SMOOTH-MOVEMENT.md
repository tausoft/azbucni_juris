# PLAN: Smooth Movement — Direction Flip Slide + Animation Crossfade + Lerp Velocity

> **Date:** 2026-10-08  
> **Phase:** Pre-sprite polish (post Phase 3)  
> **Target file:** `src/engine/player.js`  
> **Dependencies:** None — purely internal to the Player class

---

## 1. Problem Statement

Currently, the player character exhibits three jarring visual behaviors:

| Issue | Current Behavior | Why it feels bad |
|-------|-----------------|------------------|
| **Instant start/stop** | `x += direction * speed * dt` — velocity is binary (0 or max) | No inertia; character "teleports" into motion |
| **Instant flip** | `ctx.scale(-1, 1)` toggles immediately on direction change | Sprite teleports horizontally; no visual continuity |
| **Instant animation switch** | `setCurrentAnimation()` resets frameIndex to 0 instantly | Frame jump between idle↔run; looks like a glitch |

---

## 2. Solution Overview

Three interlocking systems that work together:

```
┌─────────────────────────────────────────────────────────────┐
│                    PLAYER MOVEMENT PIPELINE                  │
│                                                             │
│  Input (direction: -1 / 0 / +1)                            │
│       │                                                     │
│       ▼                                                     │
│  ┌───────────────────────────────────────────────┐         │
│  │              LERP VELOCITY SMOOTHING           │         │
│  │                                               │         │
│  │  velocity += (targetVelocity - velocity)      │         │
│  │            * lerpFactor(dt, smoothing)        │         │
│  │                                               │         │
│  │  x += velocity * dt                           │         │
│  └───────────────────────────────────────────────┘         │
│       │                                                     │
│       ▼                                                     │
│  ┌───────────────────────────────────────────────┐         │
│  │              DIRECTION FLIP SLIDE              │         │
│  │                                               │         │
│  │  flipT interpolates from -1 → +1 (or reverse) │         │
│  │  as velocity passes through zero               │         │
│  │  visualX = x + (flipT * slideOffset)          │         │
│  └───────────────────────────────────────────────┘         │
│       │                                                     │
│       ▼                                                     │
│  ┌───────────────────────────────────────────────┐         │
│  │           ANIMATION CROSSFADE                  │         │
│  │                                               │         │
│  │  capture oldFrameIndex + newFrameIndex        │         │
│  │  lerp between them over crossfadeDuration      │         │
│  └───────────────────────────────────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Feature Details

### 3A. Linear Interpolation (Lerp) Velocity Smoothing

**Goal:** Replace instant velocity with a smoothly approaching velocity state.

#### Math

Use frame-rate independent exponential decay:

```javascript
lerpFactor = 1 - Math.pow(smoothingConstant, deltaTime)
velocity += (targetVelocity - velocity) * lerpFactor
x += velocity * deltaTime
```

This converges to ~99.9% of target in 1 second — frame-rate independent.

#### Parameters

| Constant | Default | Tunable Range | Effect |
|----------|---------|---------------|--------|
| `PLAYER_SMOOTHING_FACTOR` | `6.0` | `2.0 – 15.0` | Higher = snappier, Lower = more slidey |
| `PLAYER_FLIP_SPEED` | `4.0` | `2.0 – 8.0` | How fast flip animation completes (1/FLIP_SPEED sec) |
| `PLAYER_SLIDE_OFFSET_RATIO` | `0.5` | `0.3 – 0.7` | How far sprite visually slides during flip (% of width) |

#### Behavior

- Direction `+1 → 0`: velocity decelerates to 0 over ~0.33s
- Direction `0 → +1`: velocity accelerates to max over ~0.33s
- Direction `+1 → -1`: velocity decelerates through 0, then accelerates in reverse — **this is the flip slide window**

---

### 3B. Direction Flip Slide

**Goal:** When the player reverses direction, visually slide the sprite in place before flipping (like Mario/Sonic), instead of an instant teleport.

#### Mechanism

Track a `flipT` value that interpolates from `-1` to `+1` during the reversal window:

```javascript
// Detect reversal in setDirection():
const isReversal = player.direction !== 0 && dir !== 0 
                   && Math.sign(dir) !== Math.sign(player.direction);
if (isReversal) player._pendingFlip = true;

// In updatePlayer(), when velocity nears zero:
if (player._pendingFlip && Math.abs(player.velocity) < player.speed * 0.1) {
  player.flipProgress = 0;
  player.flipAnchorX = player.x + (player.width * 0.5);
  player.flipT = -player.facing;   // start at opposite facing
  player._pendingFlip = false;
}

// Each frame during flip:
player.flipProgress += deltaTime * PLAYER_FLIP_SPEED;
const t = Math.min(player.flipProgress, 1.0);
const eased = easeInOutQuad(t);
player.flipT = lerp(-player.facing, player.facing, eased);

if (t >= 1.0) {
  player.facing = player.direction;
  player.flipT = player.facing;
  player.flipProgress = -1;   // reset
}
```

#### Visual Slide Offset

During the flip, apply a horizontal offset so the sprite's **right edge** stays visually anchored:

```javascript
const drawX = isFlipping
  ? player.flipAnchorX - (player.flipT * player.width * SLIDE_OFFSET_RATIO)
  : player.x;
```

**Visual result:**
```
Frame 0:   [sprite facing right] at anchorX + slideOffset
Frame N/2: [sprite centered, stretched] at anchorX
Frame End: [sprite facing left] at anchorX - slideOffset
```

The character appears to "slide" in the original direction, pause, then slide back while flipping — exactly like classic platformers.

---

### 3C. Animation Crossfade

**Goal:** Smoothly blend between animation states (idle↔run) instead of instantly jumping to frame 0 of the new state.

#### Mechanism

Capture the current frame index when a transition starts, then blend between old and new frame indices:

```javascript
// Detect movement state change in updatePlayer():
const wasMoving = player.currentAnimation !== ANIM.idle && player.currentAnimation !== ANIM.victoryIdle;
const isMoving = player.direction !== 0;

if (wasMoving !== isMoving && player.crossfadeState === 'none') {
  const oldGroup = wasMoving ? ANIM.run : ANIM.idle;
  const newGroup = isMoving ? ANIM.run : ANIM.idle;

  player.crossfadeState = 'active';
  player.crossfadeProgress = 0;
  player.crossfadeOldGroup = oldGroup;
  player.crossfadeNewGroup = newGroup;
  player.crossfadeOldFrameIndex = player.frameIndex;
  player.crossfadeNewFrameIndex = 
    Math.round((player.frameIndex / player.groups[oldGroup].length) 
               * player.groups[newGroup].length);
}

// Each frame during crossfade:
player.crossfadeProgress += deltaTime / PLAYER_CROSSFADE_DURATION;
const blendT = easeInOutQuad(Math.min(player.crossfadeProgress, 1.0));

// Blend percentages (handles different frame counts between groups)
const oldGroup = player.groups[player.crossfadeOldGroup];
const newGroup = player.groups[player.crossfadeNewGroup];
const oldProgress = player.crossfadeOldFrameIndex / oldGroup.length;
const newProgress = player.crossfadeNewFrameIndex / newGroup.length;
const blendedProgress = lerp(oldProgress, newProgress, blendT);
const displayFrameIndex = Math.round(blendedProgress * newGroup.length);

player._displayFrameIndex = clamp(displayFrameIndex, 0, newGroup.length - 1);

if (player.crossfadeProgress >= 1.0) {
  player.currentAnimation = player.crossfadeNewGroup;
  player.frameIndex = player.crossfadeNewFrameIndex;
  player.animationTimer = 0;
  player.crossfadeState = 'none';
  delete player._displayFrameIndex;
}
```

#### Parameters

| Constant | Default | Tunable Range | Effect |
|----------|---------|---------------|--------|
| `PLAYER_CROSSFADE_DURATION` | `0.15s` | `0.08 – 0.30s` | Duration of the blend |

#### Visual Result

```
idle (4 frames) → run (6 frames) transition:
  t=0.00:  frame 3 of idle (last idle frame)
  t=0.05:  frame 2 of idle (still mostly idle)
  t=0.10:  frame 0 of run (halfway — first run frame)
  t=0.15:  frame 1 of run (mostly run)
  t=0.20+: frame 3 of run (fully run, crossfade complete)
```

---

## 4. Implementation Plan — Step by Step

### Step 1: Add Constants

**File:** `src/engine/constants.js` — add to `GameConstants` object

```javascript
// Smooth movement constants (Phase 3.5)
PLAYER_SMOOTHING_FACTOR: 6.0,      // velocity lerp speed (higher = snappier)
PLAYER_FLIP_SPEED: 4.0,            // flip animation speed (1/FLIP_SPEED sec duration)
PLAYER_SLIDE_OFFSET_RATIO: 0.5,    // slide distance as % of sprite width
PLAYER_CROSSFADE_DURATION: 0.15,   // seconds to blend between animations
```

### Step 2: Add Player State Properties

**File:** `src/engine/player.js` — add to `Player` constructor (after existing state, before `_hasDrawnOnce`)

```javascript
// --- Smooth movement state (Phase 3.5) ---
this.velocity = 0;              // current smoothed velocity (-speed to +speed)
this.targetVelocity = 0;        // desired velocity from input direction

this.flipT = 1;                 // current visual flip scale (-1 to +1)
this.flipProgress = -1;         // -1 = no flip, 0–1 = in progress
this.flipAnchorX = 0;           // anchor position during flip slide

this.crossfadeState = 'none';   // 'none' | 'active'
this.crossfadeProgress = 0;     // 0–1 progress of current crossfade
this.crossfadeOldGroup = null;  // name of animation we're leaving
this.crossfadeNewGroup = null;  // name of animation we're entering
this.crossfadeOldFrameIndex = 0;// frame index in old group at transition start
this.crossfadeNewFrameIndex = 0;// proportional frame index in new group
```

### Step 3: Add Helper Functions (module level, before Player class)

**File:** `src/engine/player.js` — add at top of file

```javascript
// --- Easing functions ---
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// --- Clamp helper ---
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
```

### Step 4: Refactor `setDirection()` — Detect Reversal

**File:** `src/engine/player.js` — modify the module-level `setDirection` function

```javascript
export function setDirection(dir) {
  if (!player) return;

  // Detect reversal: new direction has opposite sign AND we're currently moving
  const isReversal = player.direction !== 0 && dir !== 0 
                     && Math.sign(dir) !== Math.sign(player.direction);

  if (isReversal) {
    player._pendingFlip = true;   // flip will start when velocity nears zero
  }

  player.direction = dir;
}
```

### Step 5: Refactor `updatePlayer()` — Velocity + Flip + Crossfade

**File:** `src/engine/player.js` — replace the existing function body

The refactored function replaces the current instant-velocity logic with:

```javascript
export function updatePlayer(deltaTime) {
  if (!player) return;

  // --- Debug: detect teleportation (existing, unchanged) ---
  if (_lastPlayerX !== null && Math.abs(player.x - _lastPlayerX) > TELEPORT_THRESHOLD) {
    console.group('🚨 TELEPORT DETECTED');
    console.log('Delta:', player.x - _lastPlayerX);
    console.groupEnd();
  }
  _lastPlayerX = player.x;

  // --- Always update animation (idle loops, etc.) ---
  player.updateAnimation(deltaTime);

  // --- Track movement state for crossfade detection ---
  const wasMoving = player.currentAnimation !== ANIM.idle && player.currentAnimation !== ANIM.victoryIdle;
  const isMoving = player.direction !== 0;

  // --- Auto-transition idle ↔ run based on movement direction ---
  if (isMoving && player.currentAnimation === ANIM.idle) {
    player.setCurrentAnimation(ANIM.run);
  } else if (!isMoving && player.currentAnimation === ANIM.run) {
    player.setCurrentAnimation(ANIM.idle);
  }

  // --- TARGET VELOCITY from direction input ---
  player.targetVelocity = player.direction * player.speed;

  // --- LERP VELOCITY SMOOTHING ---
  const lerpFactor = 1 - Math.pow(GameConstants.PLAYER_SMOOTHING_FACTOR, deltaTime);
  player.velocity += (player.targetVelocity - player.velocity) * lerpFactor;

  // Snap to zero when very close (prevents micro-drift)
  if (Math.abs(player.velocity) < 0.5) {
    player.velocity = 0;
  }

  // --- DIRECTION FLIP SLIDE ---
  const isFlipping = player.flipProgress >= 0;

  // Detect reversal: velocity crossed zero in opposite direction
  if (player._pendingFlip && Math.abs(player.velocity) < player.speed * 0.1) {
    player.flipProgress = 0;
    player.flipAnchorX = player.x + (player.width * GameConstants.PLAYER_SLIDE_OFFSET_RATIO);
    player.flipT = -player.facing;   // start at opposite facing
    player._pendingFlip = false;
  }

  if (isFlipping) {
    player.flipProgress += deltaTime * GameConstants.PLAYER_FLIP_SPEED;
    const t = Math.min(player.flipProgress, 1.0);
    const eased = easeInOutQuad(t);
    player.flipT = lerp(-player.facing, player.facing, eased);

    if (t >= 1.0) {
      player.facing = player.direction;
      player.flipT = player.facing;
      player.flipProgress = -1;   // reset
    }
  }

  // --- POSITION UPDATE (use smoothed velocity) ---
  player.x += player.velocity * deltaTime;

  // Clamp to canvas bounds
  const halfW = player.width / 2;
  player.x = Math.max(halfW, Math.min(canvasWidth - halfW, player.x));

  // --- ANIMATION CROSSFADE ---
  if (player.crossfadeState === 'active') {
    player.crossfadeProgress += deltaTime / GameConstants.PLAYER_CROSSFADE_DURATION;
    const blendT = easeInOutQuad(Math.min(player.crossfadeProgress, 1.0));

    // Blend frame indices proportionally (handles different group sizes)
    const oldGroup = player.groups[player.crossfadeOldGroup];
    const newGroup = player.groups[player.crossfadeNewGroup];
    const oldProgress = player.crossfadeOldFrameIndex / oldGroup.length;
    const newProgress = player.crossfadeNewFrameIndex / newGroup.length;
    const blendedProgress = lerp(oldProgress, newProgress, blendT);
    const displayFrameIndex = Math.round(blendedProgress * newGroup.length);

    player._displayFrameIndex = clamp(displayFrameIndex, 0, newGroup.length - 1);

    if (player.crossfadeProgress >= 1.0) {
      player.currentAnimation = player.crossfadeNewGroup;
      player.frameIndex = player.crossfadeNewFrameIndex;
      player.animationTimer = 0;
      player.crossfadeState = 'none';
      delete player._displayFrameIndex;
    }
  } else if (wasMoving !== isMoving) {
    // Movement state changed — start crossfade
    const oldGroup = wasMoving ? ANIM.run : ANIM.idle;
    const newGroup = isMoving ? ANIM.run : ANIM.idle;

    player.crossfadeState = 'active';
    player.crossfadeProgress = 0;
    player.crossfadeOldGroup = oldGroup;
    player.crossfadeNewGroup = newGroup;
    player.crossfadeOldFrameIndex = player.frameIndex;
    player.crossfadeNewFrameIndex = Math.round(
      (player.frameIndex / player.groups[oldGroup].length) * player.groups[newGroup].length
    );
  }

  // --- Handle victory animation completion (unchanged) ---
  if (player._victoryTriggered) {
    if (player.currentAnimation === ANIM.victory && player.frameIndex === 0 && player.animationTimer < 0.1) {
      player.setCurrentAnimation(ANIM.victoryIdle);
    } else if (player.currentAnimation === ANIM.victoryIdle && player.frameIndex === 0 && player.animationTimer < 0.1) {
      player._victoryTriggered = false;
      player.setCurrentAnimation(ANIM.idle);
    }
  }
}
```

### Step 6: Refactor `draw()` — Flip + Crossfade Rendering

**File:** `src/engine/player.js` — replace the draw method body

```javascript
draw(ctx) {
  if (!this.isReady || !this._framesBuilt) {
    ctx.fillStyle = this.currentAnimation === ANIM.idle ? '#3498db' : '#e74c3c';
    ctx.fillRect(this.x, this.y, this.width, this.height);
    return;
  }

  const group = this.groups[this.currentAnimation];
  const frameIdx = this._displayFrameIndex ?? this.frameIndex; // crossfade override
  const frame = group[frameIdx];

  if (!frame) {
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(this.x, this.y, this.width, this.height);
    return;
  }

  // --- DETERMINE DRAW POSITION (with flip slide offset) ---
  const isFlipping = this.flipProgress >= 0;
  const drawX = isFlipping
    ? this.flipAnchorX - (this.flipT * this.width * GameConstants.PLAYER_SLIDE_OFFSET_RATIO)
    : this.x;

  // --- DRAW WITH INTERPOLATED FLIP ---
  if (this.flipT < -0.1) {
    // Facing left — interpolate flip scale from -1 toward +1
    const pivotX = drawX + this.width;
    ctx.save();
    ctx.translate(pivotX, 0);
    ctx.scale(this.flipT, 1);   // interpolates from -1 to +1 during flip
    ctx.drawImage(
      this.image,
      frame.x, frame.y, frame.w, frame.h, // source
      0, this.y, this.width, this.height,  // dest (extends left from flipped origin)
    );
    ctx.restore();
  } else if (this.flipT > 0.1) {
    // Facing right — normal draw (use interpolated x during flip)
    ctx.drawImage(
      this.image,
      frame.x, frame.y, frame.w, frame.h, // source
      drawX, this.y, this.width, this.height, // dest
    );
  } else {
    // Facing forward/neutral — draw without scale flip (transition moment)
    ctx.drawImage(
      this.image,
      frame.x, frame.y, frame.w, frame.h, // source
      drawX, this.y, this.width, this.height, // dest
    );
  }

  // --- Debug overlay (unchanged) ---
  if (typeof DEBUG_DRAW_HITBOX !== 'undefined' && DEBUG_DRAW_HITBOX) {
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, this.y, this.width, this.height);
  }
}
```

---

## 5. File Changes Summary

| File | Changes |
|------|---------|
| `src/engine/constants.js` | Add 4 new constants to `GameConstants` |
| `src/engine/player.js` | Add helper functions, add state properties, refactor `setDirection()`, refactor `updatePlayer()`, refactor `draw()` |
| **No other files** | All changes are internal to the Player class |

---

## 6. Tuning Guide

After implementation, test these scenarios and adjust constants:

| Scenario | Symptom | Adjustment |
|----------|---------|------------|
| Character feels "sluggish" | Too much delay between input and movement | Increase `PLAYER_SMOOTHING_FACTOR` (try 8–10) |
| Character feels "floaty" | Movement doesn't stop when releasing key | Increase `PLAYER_SMOOTHING_FACTOR` or decrease `CROSSFADE_DURATION` |
| Flip slide too long/short | Visual slide doesn't match expected feel | Adjust `FLIP_SPEED` (higher = faster flip) |
| Crossfade too visible/jarring | Animation blend is noticeable | Increase `CROSSFADE_DURATION` (try 0.2–0.25s) |
| Flip interrupts crossfade | Flip and crossfade fight each other | Ensure flip completes before crossfade starts |

---

## 7. Edge Cases & Guardrails

1. **Rapid direction changes:** The `flipProgress >= 0` guard prevents overlapping flips. Only one flip can be active at a time.
2. **Crossfade during victory:** Crossfade should be disabled during `victory`/`victory-idle` states (check `player._victoryTriggered`).
3. **Very small deltaTime (144Hz+ monitors):** The `Math.pow(smoothing, dt)` formula is frame-rate independent — no issues expected.
4. **Very large deltaTime (tab switch):** Cap `deltaTime` at `0.1` (100ms) in `gameLoop.js` to prevent velocity overshoot.
5. **Sprite dimensions change:** `SLIDE_OFFSET_PX` is ratio-based (`spriteWidth * 0.5`) — adapts to any canvas size automatically.

---

## 8. Expected Visual Result

```
BEFORE (instant):                          AFTER (smooth):

  [→run] ← instant → [←run]                [→run] → slide → [↔blend] → flip → [←run]
     ↑                    ↑                    ↑              ↑              ↑         ↑
   frame0               frame0               frame3        frame0       frame3    frame0
   idle→run           run→idle             blend          blend      idle→run  idle→run
   
  Start: instant jump to full speed        Start: accelerates over ~0.33s
  Stop: instant halt                       Stop: decelerates over ~0.33s  
  Flip: instant teleport                   Flip: slides in place, pauses, flips
  Anim: frame jumps                        Anim: smooth blend between states
```

---

## 9. Implementation Order

1. **Add constants** to `constants.js`
2. **Add helper functions** (`easeInOutQuad`, `lerp`, `clamp`) to `player.js`
3. **Add state properties** to Player constructor
4. **Refactor `setDirection()`** to detect reversal
5. **Refactor `updatePlayer()`** — velocity smoothing + flip slide logic
6. **Refactor `draw()`** — interpolated flip rendering
7. **Add animation crossfade** logic to `updatePlayer()`
8. **Test all scenarios** and tune constants

---

## 10. Review Checklist

- [ ] Constants added to `constants.js` with JSDoc comments
- [ ] Helper functions (`easeInOutQuad`, `lerp`, `clamp`) at module level
- [ ] State properties added to Player constructor (grouped, commented)
- [ ] `setDirection()` detects reversal correctly (handles edge case of dir=0)
- [ ] Velocity smoothing uses `Math.pow(smoothing, dt)` for frame-rate independence
- [ ] Flip slide anchors on sprite's right edge during reversal
- [ ] Crossfade uses percentage-based blending (not raw frame indices)
- [ ] Crossfade disabled during victory/victory-idle states
- [ ] Flip guard (`flipProgress >= 0`) prevents overlapping flips
- [ ] `draw()` uses `_displayFrameIndex ?? frameIndex` for crossfade override
- [ ] `draw()` handles flipT near zero (neutral/forward-facing moment)
- [ ] Debug hitbox overlay preserved and unchanged
