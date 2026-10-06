# PLAN: Sprite Asset Loading & Single-Frame Render Test

## Objective

Write a minimal, fresh version of `src/engine/player.js` that loads the knight spritesheet assets, extracts one frame, renders it statically on the canvas, and logs every step to the console. **No animation, physics, states, or inputs yet.**

---

## Assets (Confirmed Existing)

| Asset | Vite Path | On-Disk Path | Size |
|-------|-----------|--------------|------|
| JSON map | `/sprites/knight/map.json` | `public/sprites/knight/map.json` | 4.8 KB |
| Spritesheet | `/sprites/knight/spritesheet.png` | `public/sprites/knight/spritesheet.png` | 742 KB |

### JSON Structure (Hash-based)

```json
{
  "frames": {
    "knight-idle-1": { "frame": { "x": 0, "y": 0, "w": 211, "h": 240 }, ... },
    "knight-idle-2": { "frame": { "x": 211, "y": 0, "w": 211, "h": 240 }, ... },
    ...
  },
  "meta": { "app": "...", "image": "spritesheet.png", "format": "RGBA8888", ... }
}
```

The first frame key is **`"knight-idle-1"`** — this is the single frame we will extract and render.

---

## Implementation Plan

### File: `src/engine/player.js` (full replacement)

#### 1. `Player` Class

##### Constructor
- Store exact asset paths:
  - `this.jsonPath = '/sprites/knight/map.json'`
  - `this.imagePath = '/sprites/knight/spritesheet.png'`
- Initialize state:
  - `this.isReady = false`
  - `this.x = 100`
  - `this.y = 100`
- Initialize loaded asset holders:
  - `this.json = null`
  - `this.image = null`
- Initialize draw-once guard:
  - `this._hasDrawnOnce = false`
- Call `this._loadAssets()` to kick off async loading

##### `_loadAssets()` — Parallel Asset Loading
Uses a dual-flag pattern to know when **both** assets are ready:

```js
_loadAssets() {
  let jsonLoaded = false;
  let imageLoaded = false;

  const checkReady = () => {
    if (jsonLoaded && imageLoaded) {
      this.isReady = true;
    }
  };

  // --- Fetch JSON ---
  console.log("Player: Fetching JSON from /sprites/knight/map.json...");

  fetch(this.jsonPath)
    .then(r => r.json())
    .then(data => {
      this.json = data;
      console.log("Player: JSON loaded:", this.json);
      jsonLoaded = true;
      checkReady();
    })
    .catch(err => console.error("Player: Failed to load JSON:", err));

  // --- Load Image ---
  const img = new Image();
  img.onload = () => {
    this.image = img;
    console.log("Player: Image loaded successfully");
    imageLoaded = true;
    checkReady();
  };
  img.onerror = err => console.error("Player: Failed to load image:", err);
  img.src = this.imagePath;
}
```

##### `draw(ctx)` — Frame Rendering
- **If `!this.isReady`**: Draw a blue `60x60` rectangle at `(this.x, this.y)` as a fallback so we can confirm the render loop is running.
- **If `this.isReady`**:
  1. Extract frame: `const f = this.json.frames["knight-idle-1"].frame;`
  2. Render: `ctx.drawImage(this.image, f.x, f.y, f.w, f.h, this.x, this.y, f.w, f.h);`
  3. Log exactly once (guarded by `_hasDrawnOnce`):
     ```js
     console.log("Player: Successfully drawing static sprite frame!");
     this._hasDrawnOnce = true;
     ```

#### 2. Module-Level API (for existing imports from `main.js` and `gameLoop.js`)

| Export | Signature | Behavior |
|--------|-----------|----------|
| `initPlayer(canvasW, canvasH)` | creates `new Player()`, returns it |
| `updatePlayer()` | no-op (no physics yet) |
| `drawPlayer(ctx)` | delegates to `player.draw(ctx)` |
| `setDirection(dir)` | no-op |
| `stopPlayer()` | no-op |
| `triggerVictory()` | no-op |
| `getPlayerHitbox()` | returns `{ x, y, width: 60, height: 60 }` |

---

## Console Log Sequence (Expected)

When the page loads and the game loop runs:

1. `"Player: Fetching JSON from /sprites/knight/map.json..."` — immediate on construction
2. `"Player: Image loaded successfully"` — when image finishes loading
3. `"Player: JSON loaded: { frames: {...}, meta: {...} }"` — when fetch resolves
4. `"Player: Successfully drawing static sprite frame!"` — **exactly once**, on the first draw call after both assets are ready

---

## Integration Notes

- **No other files will be modified.** This is a pure replacement of `src/engine/player.js`.
- Existing `main.js` calls `initPlayer(canvas.width, canvas.height)` — compatible.
- Existing `gameLoop.js` calls `drawPlayer(ctx)` in the `PLAYING` state — compatible.
- The Vite dev server serves files from `/public/` at the root path, so `/sprites/knight/map.json` resolves correctly.

---

## Success Criteria

- [ ] `player.js` loads both assets without errors
- [ ] Blue fallback rectangle renders immediately (proves game loop works)
- [ ] Knight sprite frame renders statically at `(100, 100)` after both assets load
- [ ] All four console logs appear in the correct sequence
- [ ] `"Successfully drawing static sprite frame!"` logs exactly once

---

## Out of Scope (Future Phases)

- Animation state machine
- Movement / physics
- Touch / keyboard input
- Multiple spritesheets (princess theme)
- Sprite batching or atlas optimization
- Error handling for missing assets