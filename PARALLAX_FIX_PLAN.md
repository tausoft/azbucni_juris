# Parallax Background Activation — Implementation Plan

## Status: ✅ Implemented — Awaiting Browser Verification

---

## 1. Analysis & Findings

### Current State of the Codebase

After reading all four core files, here's what exists:

#### `background.js` — Already has a parallax system (well-implemented!)

- **4 layers**: `far_bg`, `mid_bg`, `foreground`, `tree`
- **Parallax factors** defined in `layerConfigs`:
  - `far_bg`: `0.0` (no shift)
  - `mid_bg`: `0.05`
  - `foreground`: `0.15`
  - `tree`: `-0.1` (reverse direction — interesting!)
- **Max shift**: `maxParallaxPx = 40`
- **Render signature**: `render(ctx, playerX, totalPlayerRange)`
- **Shift formula**: `parallaxShift = normalizedPlayerPos * maxParallaxPx * layer.parallaxFactor`

#### `gameLoop.js` — THE BUG

In the `renderFrame()` function, the background is called like this during gameplay:

```js
background.render(ctx, 0, 1);  // ← hardcoded!
```

This means `normalizedPlayerPos = 0/1 = 0`, so **the parallax effect is completely disabled** — all layers render at zero offset.

#### `player.js` — Player X tracking exists

- `player.x` updates correctly in `updatePlayer(deltaTime)`
- Clamped to `[halfW, canvasWidth - halfW]`
- Debug accessor available: `getDebugPlayerX()`

---

## 2. The Problem

The parallax infrastructure is **fully built** in `background.js`, but it's **never activated** because `gameLoop.js` passes hardcoded `(0, 1)` instead of the real player position and range.

---

## 3. Plan: Fix Parallax Activation

This is a **minimal, surgical fix** — only **one file** needs changes: **`gameLoop.js`**.

### Step 1 — Update `gameLoop.js` — `renderFrame()` function

**Change the background render call during gameplay states:**

```js
// BEFORE (line ~79):
if (isUIState) {
  renderStaticBackground(ctx, w, h, background);
} else {
  background.render(ctx, 0, 1);  // ← BUG: hardcoded
}

// AFTER:
if (isUIState) {
  renderStaticBackground(ctx, w, h, background);
} else {
  const playerX = getDebugPlayerX() ?? 0;
  const halfW = w * GameConstants.PLAYER_WIDTH_RATIO / 2;
  const totalRange = w - halfW * 2;
  background.render(ctx, playerX, totalRange);
}
```

**What this does:**

1. Retrieves the actual player X coordinate via `getDebugPlayerX()`
2. Calculates the real playable range: `[halfW, canvasWidth - halfW]`
3. Passes both values to `background.render()`, which normalizes them internally
4. Parallax now activates proportionally — as player moves from left to right, layers shift by up to `±maxParallaxPx * parallaxFactor`

### Step 2 — (Optional) Verify in browser

- Start the dev server (`npm run dev`)
- Navigate to a gameplay state
- Move the player left/right with arrow keys
- Observe layers shifting at different rates (foreground shifts most, tree shifts reverse, mid_bg shifts subtly)

---

## 4. Summary of Changes

| File | Lines Affected | Change Type |
|------|---------------|-------------|
| `gameLoop.js` | ~3 lines in `renderFrame()` | Import `getDebugPlayerX` + `GameConstants`, replace hardcoded `(0,1)` with real values |
| `background.js` | **None** | Already correct |
| `player.js` | **None** | Already correct |
| `main.js` | **None** | Already correct |

---

## 5. Risk Assessment

- **Low risk**: Only one function call is changed. The background system already handles the parameters correctly.
- **No new code needed**: The entire parallax math, layer definitions, and render logic already exist.
- **Fallback safe**: If `getDebugPlayerX()` returns null, we default to `0` — no crash.

---

## 6. Next Steps

1. ✅ Draft plan written (`PARALLAX_FIX_PLAN.md`)
2. ✅ Approval received
3. ✅ Fix implemented in `gameLoop.js` (imports + render call updated)
4. ⏸️ Verify in browser — start dev server and test parallax effect during gameplay
