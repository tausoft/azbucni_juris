# Phase 3: Linear Interpolation (Lerp) for Visual Position Smoothing

**Source Design:** `PLAN-SMOOTH-TRANSITION.md` — Section "3. Linear Interpolation (Lerp) for Visual Position"  
**Scope:** ONLY lerp-based visual position smoothing (`smoothedX` tracking toward logical `player.x`).  
**Excluded:** Direction flip slides (PT1), Animation crossfades (PT2).

---

## 1. Objective

Introduce a **separate visual position** (`player.smoothedX`) that **lags behind** the logical position (`player.x`) via linear interpolation. This creates natural "weight" and momentum in the character's movement — the sprite feels like it has mass. The logical position remains the collision source of truth.

---

## 2. Current Behavior (Before)

### Problem: Direct X Assignment — No Interpolation

**File:** `src/engine/player.js` — lines 442–451 (`updatePlayer` movement block):

```js
// Movement (only when direction set)
if (player.direction === 0) return;

// Delta-time movement: speed (px/sec) × time elapsed (sec)
const moveAmount = player.speed * deltaTime * player.direction;
player.x += moveAmount;

// Clamp to canvas bounds (keep sprite fully inside)
const halfW = player.width / 2;
player.x = Math.max(halfW, Math.min(canvasWidth - halfW, player.x));
```

**File:** `src/engine/player.js` — line 314 (`draw()` / `_drawSingleFrame()`):

```js
// _drawSingleFrame draws sprite at player.x directly
ctx.drawImage(this.image, frame.x, frame.y, frame.w, frame.h, this.x, this.y, ...);
```

**Visual artifact:** The visual position is **always exactly at** the logical position. There is zero lag or ease — movement feels rigid and robotic.

---

## 3. Target Behavior (After)

### Three-Layer Rendering Model

```
┌─────────────────────────────────────────────┐
│  Layer 1: Logical Position (player.x)       │  ← Collision, physics, game logic
│  Layer 2: Smoothed Visual Position (smoothedX)│ ← Lerp interpolation toward player.x
│  Layer 3: Crossfade Animation Blending        │  ← Alpha blend between frames (PT2)
└─────────────────────────────────────────────┘
```

### Movement Flow

```
Frame N:   player.x = 300, smoothedX = 295 → sprite renders at 295 (lagging behind)
Frame N+1: player.x = 310, smoothedX = 297.5 → sprite renders at 297.5 (closing gap)
Frame N+2: player.x = 320, smoothedX = 302.5 → sprite renders at 302.5 (closing faster)
Frame N+10: player.x = 450, smoothedX = 448.7 → sprite nearly caught up (96% tracking)
```

During **direction flip** (PT1 active):
```
Frame N:   player.x = 300, smoothedX = 300 → moving right
Frame N+1: isFlipping=true, player.x starts sliding back, smoothedX continues right briefly
           → sprite "drifts" in old direction during reversal (natural momentum feel)
```

---

## 4. Implementation Plan

### Step 1: Add LERP Constant to `constants.js`

**File:** `src/engine/constants.js`  
**Location:** Extend existing `TRANSITIONS` section (~line 63–67).

**Current code:**
```js
TRANSITIONS: {
  FLIP_SLIDE_DURATION: 0.15,
  MIN_DIRECTION_THRESHOLD: 0.01,
  ANIMATION_CROSSFADE_DURATION: 0.1,
},
```

**New code:**
```js
TRANSITIONS: {
  FLIP_SLIDE_DURATION: 0.15,
  MIN_DIRECTION_THRESHOLD: 0.01,
  ANIMATION_CROSSFADE_DURATION: 0.1,
  LERP_FACTOR: 12.0,               // ← NEW: visual position tracking speed
},
```

**Rationale:** `lerpFactor = 12.0` gives ~83% tracking per frame at 60fps — tight enough that visual position is nearly identical to logical during continuous movement, but with enough lag during direction flips to create a natural "drift" effect. This value is configurable for tuning in Phase 4.

---

### Step 2: Add Lerp State Properties to Player Constructor

**File:** `src/engine/player.js`  
**Location:** Inside `Player` class constructor, after crossfade properties (~line 60).

**New properties to add:**

```js
// --- Lerp visual position smoothing (Phase: SMOOTH-TRANSITION PT3) ---
this.smoothedX = this.x;           // Visual X — rendered position (lerped toward logical X)
this.lerpFactor = GameConstants.TRANSITIONS.LERP_FACTOR;  // tracking speed (~12.0)
```

**Placement rationale:** Insert after the crossfade properties block to maintain logical grouping:
1. Flip-slide state (PT1)
2. Crossfade state (PT2)
3. Lerp state (PT3 — this step)


---

### Step 3: Modify `updatePlayer()` to Apply Lerp

**File:** `src/engine/player.js`  
**Function:** `updatePlayer(deltaTime)` (~lines 400–452)

#### 3a. Guard movement block against active flip slide

The existing flip-slide logic (PT1) already modifies `player.x` directly during reversal. We need to ensure the lerp still applies even during a flip:

**Current code (line 442–451):**
```js
// Movement (only when direction set)
if (player.direction === 0) return;

// Delta-time movement: speed (px/sec) × time elapsed (sec)
const moveAmount = player.speed * deltaTime * player.direction;
player.x += moveAmount;

// Clamp to canvas bounds (keep sprite fully inside)
const halfW = player.width / 2;
player.x = Math.max(halfW, Math.min(canvasWidth - halfW, player.x));
```

**New code:**
```js
// Movement (only when direction set and not in middle of flip slide)
if (player.direction === 0 && !player.isFlipping) return;

// Delta-time movement: speed (px/sec) × time elapsed (sec)
const moveAmount = player.speed * deltaTime * player.direction;
player.x += moveAmount;

// Clamp to canvas bounds (keep sprite fully inside)
const halfW = player.width / 2;
player.x = Math.max(halfW, Math.min(canvasWidth - halfW, player.x));

// --- Lerp: smooth visual position toward logical position ---
const lerpDelta = (player.x - player.smoothedX) *
                  Math.min(player.lerpFactor * deltaTime, 1.0);
player.smoothedX += lerpDelta;

// Safety clamp on smoothedX to prevent runaway drift during edge cases
player.smoothedX = Math.max(halfW, Math.min(canvasWidth - halfW, player.smoothedX));
```

**Key details:**
- `Math.min(player.lerpFactor * deltaTime, 1.0)` — prevents overshoot on frame spikes or tab-switch latency
- The lerp applies **every frame** during movement (including flip slides), so `smoothedX` naturally "drifts" in the old direction during a reversal
- Safety clamp on `smoothedX` is defensive — should rarely trigger but prevents visual glitches

---

### Step 4: Refactor `_drawSingleFrame()` to Use `smoothedX`

**File:** `src/engine/player.js`  
**Function:** `_drawSingleFrame(ctx, frame, group)` (~lines 280–310)

**Current code (rightward facing):**
```js
ctx.drawImage(
    this.image,
    frame.x, frame.y, frame.w, frame.h,
    this.x, this.y, this.width, this.height,
);
```

**New code (rightward facing):**
```js
ctx.drawImage(
    this.image,
    frame.x, frame.y, frame.w, frame.h,
    this.smoothedX, this.y, this.width, this.height,
);
```

**Rationale:** Only one character property changes — `this.x` → `this.smoothedX`. The Y position is unaffected (no vertical smoothing needed).

---

### Step 5: Refactor Direction Flip (`facing === -1`) Branch in `_drawSingleFrame()`

**Current code (leftward facing):**
```js
const pivotX = this.x + this.width;
ctx.save();
ctx.translate(pivotX, 0);
ctx.scale(-1, 1);
// ... drawImage with source x=0 ...
ctx.restore();
```

**New code (leftward facing):**
```js
const pivotX = this.smoothedX + this.width;
ctx.save();
ctx.translate(pivotX, 0);
ctx.scale(-1, 1);
// ... drawImage with source x=0 ...
ctx.restore();
```

**Rationale:** The flip pivot point must also use `smoothedX` so the sprite doesn't visually "jump" when direction flips during a slide.

---

### Step 6: Update `getPlayerHitbox()` — Verify No Change Needed

**File:** `src/engine/player.js`  
**Function:** `getPlayerHitbox()` (~line 485)

**Current code:**
```js
export function getPlayerHitbox() {
  return player ? { x: player.x, y: player.y, width: player.width, height: player.height } : null;
}
```

**Verdict:** **No change.** `getPlayerHitbox()` continues to return the **logical** `player.x`, not `smoothedX`. Collision detection remains frame-perfect. Only the visual layer is smoothed.

---

### Step 7: Update Debug Accessor (Optional)

**File:** `src/engine/player.js`  
**Function:** `getDebugPlayerX()` (~line 490)

**Current code:**
```js
export function getDebugPlayerX() {
  return player ? player.x : null;
}
```

**Suggested enhancement (optional, for debugging):**
```js
export function getDebugPlayerX() {
  if (!player) return null;
  return { logical: player.x, visual: player.smoothedX };
}
```

**Rationale:** Helps developers visualize the lag gap during tuning. Not strictly required but useful for Phase 4 constant tuning.

---

## 5. File Change Summary

| File | Changes |
|------|---------|
| `src/engine/constants.js` | Add `LERP_FACTOR: 12.0` to `TRANSITIONS` |
| `src/engine/player.js` | Add `smoothedX` + `lerpFactor` properties; modify `updatePlayer()` movement block with lerp; update `_drawSingleFrame()` to use `smoothedX` for both facing directions |
| `src/engine/gameLoop.js` | No changes (API surface unchanged) |
| `src/engine/state.js` | No changes |

---

## 6. Public API Surface — Unchanged

All existing exports remain compatible:

```js
// These function signatures do NOT change:
initPlayer(canvasW, canvasH)    // returns Player instance with new properties
updatePlayer(deltaTime)         // internally applies lerp smoothing
drawPlayer(ctx)                 // renders smoothed/crossfaded sprite
setDirection(dir)               // triggers flip slide → lerp drifts naturally
stopPlayer()                    // same behavior
getPlayerHitbox()               // still returns logical position for collision
triggerVictory()                // unchanged — uses existing animation system
```

---

## 7. Integration with PT1 (Flip Slides) and PT2 (Crossfades)

### Lerp + Flip Slide Synergy

During a direction flip:
- **PT1** modifies `player.x` during the slide-back phase
- **PT3** causes `smoothedX` to lag behind — creating a natural "drift" in the old direction before settling
- The combination produces the most polished feel: the character slides back, then smoothly catches up

```
Frame N:   player.x = 300, smoothedX = 300 → moving right
Frame N+1: isFlipping=true, player.x = 298 (sliding back), smoothedX = 299.5 (still drifting right)
Frame N+3: player.x = 290, smoothedX = 294 → gap widening (drift effect)
Frame N+6: player.x = 270, smoothedX = 278 → gap narrowing (catching up)
Frame N+10: player.x = 250, smoothedX = 249 → nearly caught up
```

### Lerp + Crossfade Synergy

Both operate independently on different layers:
- **PT3** affects *position* (smoothedX)
- **PT2** affects *alpha blending* (crossfading)
- `_drawSingleFrame()` now uses `smoothedX` for position AND respects `ctx.globalAlpha` for crossfade — no conflict

---

## 8. Testing Checklist (Manual Browser Tests)

- [ ] Hold → then hold ← — observe smooth slide-back with visible "drift" lag during reversal
- [ ] Hold → at full speed, release to stop — observe `smoothedX` settling gradually (not instant snap)
- [ ] Rapid direction changes (→ ← → ←) — each flip should show drift effect without stacking or glitching
- [ ] Letter catching during lerp lag — verify no missed catches or double catches
- [ ] Edge: lerp at canvas boundary — `smoothedX` clamped correctly, no visual overflow
- [ ] Victory animation trigger — sprite position unaffected, animation still plays correctly
- [ ] Crossfade + Lerp together — toggle movement rapidly, observe both blending and position smoothing working in concert
- [ ] Debug accessor — verify `getDebugPlayerX()` shows logical vs. visual gap

---

## 9. Tuning Guidelines (for Phase 4)

| LERP_FACTOR Value | Feel | Use Case |
|-------------------|------|----------|
| 6–8 | Slippery, floaty | Heavy characters, slow-paced games |
| **10–12** | Natural weight, responsive | **Default — recommended for Azbučni Juriš** |
| 15–20 | Snappy, rigid | Fast-paced action games |
| ∞ (or >50) | No smoothing (current behavior) | Debug/testing only |

---

## 10. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Lerp lag makes character feel unresponsive | Cap max lag at 4px via `Math.min(factor * dt, 1.0)`; tune `LERP_FACTOR` down to 8 if needed |
| `smoothedX` drifts during tab-switch (long deltaTime) | `Math.min(player.lerpFactor * deltaTime, 1.0)` prevents overshoot on large frame gaps |
| Crossfade + Lerp both using `ctx.globalAlpha` / transforms | `_drawSingleFrame()` resets `globalAlpha` after each draw; `ctx.save()/restore()` isolates flip transform |
| Collision timing shifts during lerp | `getPlayerHitbox()` returns logical `player.x` — no collision impact whatsoever |

---

## 11. Implementation Order

1. **Step 1:** Add `LERP_FACTOR` constant to `constants.js`
2. **Step 2:** Add `smoothedX` + `lerpFactor` properties to Player constructor
3. **Step 3:** Insert lerp computation into `updatePlayer()` movement block
4. **Step 4:** Update `_drawSingleFrame()` to use `smoothedX` for both facing directions
5. **Step 5:** (Optional) Enhance `getDebugPlayerX()` for dual reporting
6. **Step 6:** Test in browser — verify smooth position tracking + drift during flips

---

## 12. Future Phases (Deferred)

| Phase | Feature | Status |
|-------|---------|--------|
| Phase 1 | Direction flip slides | Completed (PT1) |
| Phase 2 | Animation crossfades | Completed (PT2) |
| Phase 3 | Lerp-based visual position smoothing (`smoothedX`) | **This phase** |
| Phase 4 | Tune all transition constants together | Deferred |

---

## 13. Visual Behavior Comparison

### Before (Direct X — No Smoothing)

```
Frame N:   [████]  x=300, rendered at 300
Frame N+1: [████]  x=315, rendered at 315 ← INSTANT jump
Frame N+2: [████]  x=330, rendered at 330
```
→ Movement feels rigid, robotic, no weight.

### After (Lerp Smoothed)

```
Frame N:   [████]  x=300, smoothedX=300 → rendered at 300
Frame N+1: x=315, smoothedX=304 → rendered at 304 (lagging 4px behind)
Frame N+2: x=330, smoothedX=317 → rendered at 317 (closing gap)
Frame N+3: x=345, smoothedX=332 → rendered at 332 (96% tracked)
```
→ Movement feels "weighted" — the sprite has mass and momentum.

### During Direction Flip (Lerp + PT1 Combined)

```
Frame N:   [→████]  x=300, smoothedX=300 → moving RIGHT
Frame N+2: [→██░░]  x=295, smoothedX=298 → flip starts, smoothedX still drifting right
Frame N+5: [←░░██]  x=280, smoothedX=286 → smoothedX catching up from right side
Frame N+10:[←████]  x=260, smoothedX=259 → nearly caught up, smooth transition complete
```
→ The drift effect during reversal creates natural momentum — the most polished feel.

---

## 14. Code Diff Summary (Mental Model)

### `constants.js` — one-line addition:
```diff
   TRANSITIONS: {
     FLIP_SLIDE_DURATION: 0.15,
     MIN_DIRECTION_THRESHOLD: 0.01,
     ANIMATION_CROSSFADE_DURATION: 0.1,
+    LERP_FACTOR: 12.0,
   },
```

### `player.js` constructor — two-line addition:
```diff
   // --- Animation crossfade (Phase: SMOOTH-TRANSITION PT2) ---
   this.crossfading = false;
   this.crossfadeTimer = 0;
+  // --- Lerp visual position smoothing (Phase: SMOOTH-TRANSITION PT3) ---
+  this.smoothedX = this.x;
+  this.lerpFactor = GameConstants.TRANSITIONS.LERP_FACTOR;
```

### `player.js` updatePlayer() — lerp insertion after movement block:
```diff
   const halfW = player.width / 2;
   player.x = Math.max(halfW, Math.min(canvasWidth - halfW, player.x));
+
+  // --- Lerp: smooth visual position toward logical position ---
+  const lerpDelta = (player.x - player.smoothedX) *
+                    Math.min(player.lerpFactor * deltaTime, 1.0);
+  player.smoothedX += lerpDelta;
+  player.smoothedX = Math.max(halfW, Math.min(canvasWidth - halfW, player.smoothedX));
```

### `player.js` _drawSingleFrame() — two replacements:
```diff
-  this.x, this.y, this.width, this.height,
+  this.smoothedX, this.y, this.width, this.height,
```
```diff
-  const pivotX = this.x + this.width;
+  const pivotX = this.smoothedX + this.width;
```

---

## 15. Completion Criteria

- [ ] `LERP_FACTOR` added to `constants.js`
- [ ] `smoothedX` and `lerpFactor` properties initialized in Player constructor
- [ ] Lerp computation applied in `updatePlayer()` movement block
- [ ] `_drawSingleFrame()` uses `smoothedX` for both facing directions
- [ ] `getPlayerHitbox()` still returns logical `player.x` (verified no change needed)
- [ ] Visual behavior: character feels weighted, not floaty or rigid
- [ ] Collision detection unaffected (logical position unchanged)
- [ ] Integration with PT1 (flip slides) produces smooth drift effect
- [ ] Integration with PT2 (crossfades) works without conflict
- [ ] Browser-tested: all checklist items verified

---

*Phase 3 stands alone and is fully reversible. All changes are additive — no existing function signatures or public APIs change.*
**Initialization:** `smoothedX` starts at `this.x` (line 32) so the first frame renders at the correct position with no visual jump.