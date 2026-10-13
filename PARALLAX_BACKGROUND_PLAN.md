# 🎨 Parallax Background Implementation Plan

## Overview
Add layered backgrounds with **mixed-resolution assets** and micro-parallax depth effects to Azbučni Juriš. Two background layers (`far_bg`, `mid_bg`) stretch to fill the canvas, while two foreground/sprite layers (`foreground`, `tree`) use per-layer scaling and anchor-based positioning. Subtle horizontal shifts create a 3D illusion as the player moves across the game world.

### Asset Resolution Summary
| Layer | Natural Resolution | Display Strategy | Anchor |
|-------|-------------------|------------------|--------|
| `far_bg` | 4096×2304 | Scale to fill canvas | N/A (stretch) |
| `mid_bg` | 4096×2304 | Scale to fill canvas | N/A (stretch) |
| `foreground` | 4096×700 | Scaled to displayW/displayH | `center` / `bottom` |
| `tree` | 2500x2500 | Scaled to displayW/displayH | `left` / `ground` |

> **Note:** Exact dimensions for `foreground.png` and `tree.png` will be confirmed during Phase 1 asset verification. The values above are estimates based on user confirmation that these assets are smaller than the 4096×2304 background layers.

---

## Phase 1: Asset Preparation

### Step 1.1 — Create Directory Structure
```
public/
└── assets/
    └── backgrounds/
        ├── far_bg.png         (4096×2304, sky/distant mountains)
        ├── mid_bg.png         (4096×2304, rolling hills/mid-distance)
        ├── foreground.png     (4096×700, grass path + fence)
        └── tree.png           (2500x2500, tree sprite on left side)
```

### Step 1.2 — Verify Assets
- Ensure all images have **transparent backgrounds** where needed (tree, fence gaps).
- Confirm all layers are aligned at the same coordinate space (e.g., ground plane matches across layers).
- Record the **exact natural dimensions** of `foreground.png` and `tree.png` — these will be used in `layerConfigs` during Phase 2.
- Optimize PNGs for web delivery (lossless compression recommended).

## Phase 2: Core Background System (`src/engine/background.js`)

### Step 2.1 — Module Structure
```js
// src/engine/background.js
export class BackgroundSystem {
  constructor() {
    this.layers = [];              // Array of runtime layer objects { image, type, scale, drawX, drawY, drawW, drawH, parallaxFactor }
    this.layerConfigs = [];        // Array of { name, type, displayW, displayH, anchor, parallaxFactor }
    this.images = new Map();       // Map<string, HTMLImageElement> keyed by layer name
    this.isLoaded = false;
    this.canvasWidth = 0;
    this.canvasHeight = 0;
    this.maxParallaxPx = 40;       // Maximum horizontal shift in pixels (configurable)
  }

  async loadAssets(paths) { ... }  // Load all 4 background images
  init(canvasWidth, canvasHeight) { ... }
  resize(canvasWidth, canvasHeight) { ... }  // Re-calculate scales on viewport change
  render(ctx, playerX, totalPlayerRange) { ... }
}
```

### Step 2.2 — `loadAssets(paths)` Method
- Accept an array of `{ name, path }` objects (e.g., `[{name:'far_bg', path:'/assets/backgrounds/far_bg.png'}, ...]`).
- Load each image via `new Image()` + `Promise.all()`:
  ```js
  async loadAssets(paths) {
    await Promise.all(paths.map(({ name, path }) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { this.images.set(name, img); resolve(); };
        img.onerror = () => { console.error(`Failed to load ${name}`); reject(); };
        img.src = path;
      });
    }));
    this.isLoaded = this.images.size === paths.length;
  }
  ```
- Set `isLoaded = true` when all images resolve successfully.
- **Error handling:** If any image fails, log a warning and fall back to a solid color for that layer during render (graceful degradation).

### Step 2.3 — `init(canvasWidth, canvasHeight)` Method
- Store canvas dimensions.
- Define **per-layer configuration** with individual sizing rules:
  ```js
  this.layerConfigs = [
    { name: 'far_bg',       type: 'fillCanvas',  parallaxFactor: 0.0 },
    { name: 'mid_bg',       type: 'fillCanvas',  parallaxFactor: 0.05 },
    { name: 'foreground',   type: 'positioned',  displayW: 4096, displayH: 700,  anchor: { x: 'center', y: 'bottom' }, parallaxFactor: 0.15 },
    { name: 'tree',         type: 'positioned',  displayW: 2500, displayH: 2500, anchor: { x: 'left',   y: 'ground' }, parallaxFactor: -0.1 },
  ];
  ```
- Anchor definitions:
  | Anchor X | Meaning | Calculation |
  |----------|---------|-------------|
  | `'center'` | Horizontally centered on canvas | `drawX = (canvasWidth - drawW) / 2` |
  | `'left'` | Left-aligned with configurable margin | `drawX = leftMargin` (set to `32px` as default) |

  | Anchor Y | Meaning | Calculation |
  |----------|---------|-------------|
  | `'bottom'` | Bottom edge of canvas | `drawY = canvasHeight - drawH` |
  | `'ground'` | Ground-aligned (slightly above bottom for depth layering) | `drawY = canvasHeight - drawH + groundOffset` (`groundOffset = 16px` as default) |

- **Layer spatial relationship:**
  - The `tree` sprite sits *just behind* the `foreground` strip in depth space.
  - It should be **visible through gaps** in the foreground fence (partial occlusion).
  - The tree's base must align with the ground plane of `foreground.png` so it reads as sitting on the same terrain.

- **Tree boundary constraint:**
  - The tree can be positioned *outside* the left edge of the canvas (hiding behind the fence when player moves).
  - It must **never extend past the right edge** of the canvas — i.e., `drawX + drawW ≤ canvasWidth`.
  - This ensures the tree never appears in front of the foreground strip on the right side, preserving depth layering.

- For **fillCanvas layers** (far_bg, mid_bg): stretch to fill the viewport
  ```js
  const fillLayers = this.layerConfigs.filter(l => l.type === 'fillCanvas');
  for (const config of fillLayers) {
    const img = this.images.get(config.name);
    const scale = Math.min(canvasWidth / img.naturalWidth, canvasHeight / img.naturalHeight);
    this.layers.push({
      image: img,
      type: 'fillCanvas',
      scale: scale,
      drawW: img.naturalWidth * scale,
      drawH: img.naturalHeight * scale,
      drawX: (canvasWidth - (img.naturalWidth * scale)) / 2,
      drawY: (canvasHeight - (img.naturalHeight * scale)) / 2,
      parallaxFactor: config.parallaxFactor || 0.0,
    });
  }
  ```

- For **positioned layers** (foreground, tree): individual scale + anchor-based positioning
  ```js
  const posLayers = this.layerConfigs.filter(l => l.type === 'positioned');
  for (const config of posLayers) {
    const img = this.images.get(config.name);
    const scale = Math.min(config.displayW / img.naturalWidth, config.displayH / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    
    let drawX, drawY;
    
    // Horizontal positioning via anchor
    if (config.anchor.x === 'center') {
      drawX = (canvasWidth - drawW) / 2;
    } else if (config.anchor.x === 'left') {
      drawX = this.leftMargin || 32; // configurable margin from left edge
    }
    
    // Vertical positioning via anchor
    if (config.anchor.y === 'bottom') {
      drawY = canvasHeight - drawH;
    } else if (config.anchor.y === 'ground') {
      drawY = canvasHeight - drawH + (this.groundOffset || 16); // slight offset for depth layering
    }
    
    this.layers.push({
      image: img,
      type: 'positioned',
      scale: scale,
      drawW: drawW,
      drawH: drawH,
      drawX: drawX,
      drawY: drawY,
      parallaxFactor: config.parallaxFactor,
    });
  }
  ```

### Step 2.4 — `resize(canvasWidth, canvasHeight)` Method
- Called when the viewport changes (window resize, orientation change).
- Re-calculate all layer scales and positions using the same logic as `init()`.
- Clear `this.layers` array before rebuilding to avoid duplicates.
- Re-render immediately after resize.

```js
resize(canvasWidth, canvasHeight) {
  this.canvasWidth = canvasWidth;
  this.canvasHeight = canvasHeight;
  this.layers = []; // Clear old layers
  
  // Re-run the same init logic (extract into a private _buildLayers() method)
  this._buildLayers();
}

_buildLayers() {
  // Same logic as Step 2.3 fillCanvas + positioned paths
}
```

### Step 2.5 — `render(ctx, playerX, totalPlayerRange)` Method
- Iterate through layers in order: `[far_bg, mid_bg, tree, foreground]`.
  - **Important:** `tree` renders *before* `foreground` so the foreground fence partially occludes it (visible through gaps).
  - This is the **reverse** of their positions in `layerConfigs` — tree is index 3 in configs but renders before index 2 (foreground).
- For each layer, calculate micro-parallax offset:
  ```js
  const normalizedPlayerPos = playerX / totalPlayerRange; // 0 to 1
  const parallaxShift = normalizedPlayerPos * this.maxParallaxPx * layer.parallaxFactor;
  ```
- Draw with per-layer position + parallax shift:
  ```js
  ctx.save();
  ctx.translate(parallaxShift, 0);
  ctx.drawImage(
    layer.image,
    layer.drawX,
    layer.drawY,
    layer.drawW,
    layer.drawH
  );
  ctx.restore();
  ```
- **Layer order enforcement:** Render farthest layers first (`far_bg` → `mid_bg`), then `tree` → `foreground`. The tree/foreground pair is the **only exception** to strict `layerConfigs` order — tree renders before foreground so the fence partially occludes it.
  ctx.drawImage(
    layer.image,
    layer.drawX,
    layer.drawY,
    layer.drawW,
    layer.drawH
  );
  ctx.restore();
  ```

### Step 2.6 — Parallax Factors (Configurable)
| Layer | Factor | Max Shift (px) | Direction |
|-------|--------|----------------|-----------|
| Far BG | `0.0` | 0 | Static (no movement) |
| Mid BG | `0.05` | ~2 | Follows player slightly |
| Foreground | `0.15` | ~6 | Follows player more (depth layering) |
| Tree | `-0.1` | ~-4 | Opposite direction (breathing effect) |

> **Note:** `maxParallaxPx = 40` is the base multiplier. Actual shift = `normalizedPlayerPos * maxParallaxPx * factor`. Values are tuned for subtle micro-parallax — never exceed ±20px total.


## Phase 3: Integration Points

### Step 3.1 — `main.js` (Bootstrap)
**Changes:**
1. Import `BackgroundSystem`:
   ```js
   import { BackgroundSystem } from './engine/background.js';
   ```
2. Instantiate globally:
   ```js
   const background = new BackgroundSystem();
   ```
3. Load assets before game loop starts (with error handling):
   ```js
   try {
     await background.loadAssets([
       { name: 'far_bg', path: '/assets/backgrounds/far_bg.png' },
       { name: 'mid_bg', path: '/assets/backgrounds/mid_bg.png' },
       { name: 'foreground', path: '/assets/backgrounds/foreground.png' },
       { name: 'tree', path: '/assets/backgrounds/tree.png' },
     ]);
   } catch (err) {
     console.warn('Background assets failed to load, continuing without parallax:', err);
   }
   ```
4. Init after canvas is ready:
   ```js
   await background.init(canvas.width, canvas.height);
   ```
5. Expose to other modules via a shared state object or pass as argument.
6. **Resize handling:** Attach a `resize` listener that calls `background.resize()`:
   ```js
   window.addEventListener('resize', () => {
     if (background.isLoaded) {
       background.resize(canvas.width, canvas.height);
     }
   });
   ```

### Step 3.2 — `engine/gameLoop.js` (Render Phase)
**Changes:**
1. Accept `background` and `playerX` as parameters.
2. Add render call at the **top** of the draw phase:
   ```js
   // Render phase (order matters!)
   if (state.current === 'PLAYING' && background.isLoaded) {
     background.render(ctx, player.x, player.totalRange);
   }
   ```

### Step 3.3 — `components/menu.js` (Menu State)
**Changes:**
1. Accept `background` as parameter to `render()` function.
2. Add render call at the top of the menu draw:
   ```js
   if (background.isLoaded) {
     background.render(ctx, 0, 1); // Static for menu
   }
   ```

### Step 3.4 — `components/themeSelect.js` (Theme Select State)
**Changes:**
1. Accept `background` as parameter to `render()` function.
2. Add render call at the top of the theme select draw:
   ```js
   if (background.isLoaded) {
     background.render(ctx, 0, 1); // Static for menu
   }
   ```


## Phase 4: Testing & Polish

### Step 4.1 — Functional Tests
| Test | Expected Result |
|------|-----------------|
| Background loads in MENU state | Visible behind menu UI |
| Background loads in THEME_SELECT | Visible behind theme cards |
| Background loads in PLAYING | Visible behind gameplay elements |
| Player moves left/right | Layers shift correctly (parallax works) |
| Tree shifts opposite to player | Creates breathing/depth effect |
| Resize browser | Canvas scales, layers re-center properly |

### Step 4.2 — Visual Polish Checks
- [ ] No clipping at canvas edges
- [ ] Ground plane aligns across all layers (grass meets fence naturally)
- [ ] Tree is visible through fence gaps, partially occluded by foreground strip
- [ ] Tree base aligns with foreground ground plane
- [ ] Tree never extends past right canvas edge
- [ ] Micro-parallax is subtle but noticeable (~20-30px max shift)
- [ ] No flickering or tearing during animation

### Step 4.3 — Performance Checks
- [ ] No jank on low-end devices (verify FPS stays ≥60)
- [ ] Images load before first render (no flash of missing assets)
- [ ] Memory usage stable over long sessions (no leaks)

---

## Dependencies & Risks

| Item | Status | Notes |
|------|--------|-------|
| Assets ready? | ⏳ Pending | User must provide 4 PNG files (2 at 4096×2304, 2 smaller) |
| Canvas resize handling? | ✅ Added | `resize()` method + window listener in Phase 3.1 |
| Image loading errors? | ✅ Mitigated | Fallback to solid color per layer; graceful degradation |
| Cross-origin issues? | ❌ None | Local files, no CORS concerns |
| Layer order correctness? | ✅ Enforced | Render: far_bg → mid_bg → tree → foreground (tree/foreground reversed vs. config for occlusion) |
| Anchor positioning bugs? | ⚠️ Watch | Test with real asset dimensions; adjust `leftMargin`/`groundOffset` as needed |

### Risks & Mitigations
1. **Asset dimensions mismatch:** If `foreground.png` or `tree.png` dimensions differ significantly from estimates, the `displayW/displayH` values in `layerConfigs` must be updated. Phase 1 Step 1.2 explicitly requires recording exact dimensions.
2. **Performance on mobile:** 4096×2304 layers are heavy. Consider downscaling to 2048×1152 if FPS drops on low-end devices.
3. **Parallax too strong/subtle:** Factors in Step 2.6 are starting points. Test with real gameplay and tweak `maxParallaxPx` per-layer as needed.

---

## Estimated Effort

| Phase | Effort | Complexity |
|-------|--------|------------|
| Phase 1: Asset Prep | 30 min | Low |
| Phase 2: Core System | 1-2 hours | Medium |
| Phase 3: Integration | 1 hour | Medium |
| Phase 4: Testing/Polish | 30-60 min | Low |
| **Total** | **~3-4 hours** | |

---

## Notes for Implementation
- Use `ctx.save()` / `ctx.restore()` around each layer draw to avoid transform accumulation.
- Consider adding a loading screen while images fetch (optional enhancement).
- If assets are large, add a progress indicator during load.
- Keep parallax factors in a config object at the top of `background.js` for easy tweaking.

