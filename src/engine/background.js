// ============================================================
// background.js — Parallax Background System
// ============================================================
// Implements layered backgrounds with mixed-resolution assets
// and micro-parallax depth effects for Azbučni Juriš.
//
// Layer rendering order (farthest → nearest):
//   far_bg → mid_bg → tree → foreground
// Note: tree renders BEFORE foreground so the fence partially
// occludes it (visible through gaps), preserving depth layering.
// ============================================================

/** @enum {string} */
export const LayerType = {
  FILL_CANVAS: 'fillCanvas',
  POSITIONED: 'positioned',
};

/** @enum {string} */
export const AnchorX = {
  CENTER: 'center',
  LEFT: 'left',
};

/** @enum {string} */
export const AnchorY = {
  BOTTOM: 'bottom',
  GROUND: 'ground',
};

/**
 * BackgroundSystem — Manages layered parallax backgrounds.
 *
 * Two background layers (far_bg, mid_bg) stretch to fill the canvas,
 * while two foreground/sprite layers (foreground, tree) use per-layer
 * scaling and anchor-based positioning. Subtle horizontal shifts create
 * a 3D illusion as the player moves across the game world.
 */
export class BackgroundSystem {
  constructor() {
    /** @type {Array<{ image: HTMLImageElement, type: string, scale: number, drawX: number, drawY: number, drawW: number, drawH: number, parallaxFactor: number }>} */
    this.layers = [];

    /** @type {Array<{ name: string, type: string, displayW?: number, displayH?: number, anchor?: { x: string, y: string }, parallaxFactor: number, offScreenLeft?: number, verticalOffset?: number }>} */
    this.layerConfigs = [];

    /** @type {Map<string, HTMLImageElement>} */
    this.images = new Map();

    /** @type {boolean} */
    this.isLoaded = false;

    /** @type {number} */
    this.canvasWidth = 0;

    /** @type {number} */
    this.canvasHeight = 0;

    // Maximum horizontal shift in pixels (configurable)
    this.maxParallaxPx = 200; // Increased from 40 for visible parallax effect

    // Anchor defaults
    this.leftMargin = 32;       // px from left edge for 'left' anchor
    this.groundOffset = -15;     // px offset for 'ground' anchor (depth layering)
  }

  // ----------------------------------------------------------
  // Asset Loading
  // ----------------------------------------------------------

  /**
   * Load all background layer images.
   * @param {{ name: string, path: string }[]} paths — Array of {name, path} objects
   * @returns {Promise<void>} Resolves when all images load successfully
   */
  async loadAssets(paths) {
    await Promise.all(
      paths.map(({ name, path }) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            this.images.set(name, img);
            resolve();
          };
          img.onerror = () => {
            console.error(`BackgroundSystem: Failed to load background layer "${name}" from ${path}`);
            reject(new Error(`Failed to load background layer: ${name}`));
          };
          img.src = path;
        });
      })
    );

    this.isLoaded = this.images.size === paths.length;

    if (this.isLoaded) {
      console.log(
        `BackgroundSystem: All ${paths.length} background layers loaded successfully.`,
        [...this.images.keys()]
      );
    } else {
      console.warn(
        `BackgroundSystem: Only ${this.images.size}/${paths.length} layers loaded. ` +
        `Some layers will fall back to solid colors.`
      );
    }
  }

  // ----------------------------------------------------------
  // Initialization & Resize
  // ----------------------------------------------------------

  /**
   * Initialize the background system with canvas dimensions.
   * Builds layer configurations and calculates scales/positions.
   * @param {number} canvasWidth — Canvas buffer width (DPR-corrected)
   * @param {number} canvasHeight — Canvas buffer height (DPR-corrected)
   */
  init(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    // Define per-layer configuration
    this.layerConfigs = [
      { name: 'far_bg',       type: LayerType.FILL_CANVAS, parallaxFactor: 0.0 },
      { name: 'mid_bg',       type: LayerType.FILL_CANVAS, parallaxFactor: 0.1, horizontalOffset: 0.04 },
      { name: 'foreground',   type: LayerType.POSITIONED, proportionScale: 1.05, anchor: { x: AnchorX.CENTER, y: AnchorY.BOTTOM }, parallaxFactor: 0.2, parallaxPadding: 0 },
      { name: 'tree',         type: LayerType.POSITIONED, proportionScale: 1, anchor: { x: AnchorX.LEFT, y: AnchorY.GROUND }, offScreenLeft: 0.25, verticalOffset: -0.05, parallaxFactor: 0.18 },
    ];

    this._buildLayers();
  }

  /**
   * Rebuild layer scales and positions when viewport changes.
   * @param {number} canvasWidth — New canvas buffer width
   * @param {number} canvasHeight — New canvas buffer height
   */
  resize(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    // Clear old layers before rebuilding
    this.layers = [];
    this._buildLayers();
  }

  /**
   * Get the Y-coordinate of the far_bg bottom edge (ground level).
   * Returns canvasHeight as fallback if far_bg is not loaded.
   * @returns {number} Ground-level Y in buffer-space coordinates
   */
  getGroundY() {
    const farBg = this.layers.find(l => l.image?.src.includes('far_bg'));
    return farBg ? (farBg.drawY + farBg.drawH) : this.canvasHeight;
  }

  /**
   * Get the Y-coordinate of the far_bg top edge.
   * Useful for computing the visible scene height (sceneBottom - farBgTop).
   * Returns 0 as fallback if far_bg is not loaded.
   * @returns {number} Far-bg top Y in buffer-space coordinates
   */
  getFarBgTop() {
    const farBg = this.layers.find(l => l.image?.src.includes('far_bg'));
    return farBg ? farBg.drawY : 0;
  }

  /**
   * Private: Build layer objects from configs using current canvas dimensions.
   */
  _buildLayers() {
    // --- Fill Canvas layers (stretch to fill viewport) ---
    const fillLayers = this.layerConfigs.filter((l) => l.type === LayerType.FILL_CANVAS);
    for (const config of fillLayers) {
      const img = this.images.get(config.name);
      if (!img) continue; // Skip if image not loaded

      const scale = Math.min(
        this.canvasWidth / img.naturalWidth,
        this.canvasHeight / img.naturalHeight
      );
      this.layers.push({
        image: img,
        type: LayerType.FILL_CANVAS,
        scale: scale,
        drawW: img.naturalWidth * scale,
        drawH: img.naturalHeight * scale,
        drawX: (this.canvasWidth - (img.naturalWidth * scale)) / 2 + (config.horizontalOffset ? this.canvasWidth * config.horizontalOffset : 0),
        drawY: (this.canvasHeight - (img.naturalHeight * scale)) / 2,
        parallaxFactor: config.parallaxFactor || 0.0,
      });
    }

    // --- Extract far_bg scale and left edge for proportional positioned layers ---
    const farBgLayer = this.layers.find((l) => l.type === LayerType.FILL_CANVAS && l.image?.src.includes('far_bg'));
    const farBgScale = farBgLayer ? farBgLayer.scale : 1;
    const farBgLeftEdge = farBgLayer ? farBgLayer.drawX : 0;
    const sceneBottom = farBgLayer ? (farBgLayer.drawY + farBgLayer.drawH) : this.canvasHeight;

    // --- Positioned layers (individual scale + anchor-based positioning) ---
    const posLayers = this.layerConfigs.filter((l) => l.type === LayerType.POSITIONED);
    for (const config of posLayers) {
      const img = this.images.get(config.name);
      if (!img) continue; // Skip if image not loaded

      // Proportional display size derived from far_bg scale
      const proportionMultiplier = config.proportionScale || 1;
      const displayW = img.naturalWidth * farBgScale * proportionMultiplier;
      const displayH = img.naturalHeight * farBgScale * proportionMultiplier;
      const scale = Math.min(
        displayW / img.naturalWidth,
        displayH / img.naturalHeight
      );
      let drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;

      // --- Parallax padding: shift image left so extra width hangs off-screen, absorbing parallax shifts ---
      const hPad = config.parallaxPadding || 0;

      let drawX, drawY;

      // --- Horizontal positioning via anchor ---
      if (config.offScreenLeft !== undefined) {
        // Visible portion starts at background left edge; fraction hangs beyond it into the margin
        drawX = farBgLeftEdge - drawW * config.offScreenLeft;
      } else if (config.anchor?.x === AnchorX.CENTER) {
        // Shift left by hPad so both edges extend beyond canvas, absorbing parallax in either direction
        drawX = (this.canvasWidth - drawW) / 2 - hPad;
      } else if (config.anchor?.x === AnchorX.LEFT) {
        drawX = this.leftMargin;
      }

      // --- Vertical positioning via anchor (anchored to far_bg bottom, not canvas bottom) ---
      if (config.anchor?.y === AnchorY.BOTTOM) {
        drawY = sceneBottom - drawH;
      } else if (config.anchor?.y === AnchorY.GROUND) {
        drawY = sceneBottom - drawH + this.groundOffset;
      }

      // --- Apply independent vertical offset (percentage of scene height) ---
      if (config.verticalOffset !== undefined) {
        drawY += (sceneBottom - farBgLayer.drawY) * config.verticalOffset;
      }

      // --- Tree boundary constraint ---
      // Tree must never extend past the right edge of the canvas.
      if (config.name === 'tree' && drawX + drawW > this.canvasWidth) {
        drawX = this.canvasWidth - drawW;
      }

      this.layers.push({
        image: img,
        type: LayerType.POSITIONED,
        scale: scale,
        drawW: drawW,
        drawH: drawH,
        drawX: drawX,
        drawY: drawY,
        parallaxFactor: config.parallaxFactor,
      });
    }
  }

  // ----------------------------------------------------------
  // Rendering
  // ----------------------------------------------------------

  /**
   * Render all background layers with micro-parallax offsets.
   * Layer order: far_bg → mid_bg → tree → foreground (tree before foreground for occlusion).
   * @param {CanvasRenderingContext2D} ctx — Canvas rendering context
   * @param {number} playerX — Current player X position in game world
   * @param {number} totalPlayerRange — Total possible player movement range
   */
  render(ctx, playerX, totalPlayerRange) {
    if (!this.isLoaded || this.layers.length === 0) return;

    // --- Clip to visible scene bounds (background image area) ---
    const farBgLayer = this.layers.find((l) => l.type === LayerType.FILL_CANVAS && l.image?.src.includes('far_bg'));
    if (farBgLayer) {
      const farBgRightEdge = farBgLayer.drawX + farBgLayer.drawW;
      const farBgBottomEdge = farBgLayer.drawY + farBgLayer.drawH;
      ctx.save();
      ctx.beginPath();
      ctx.rect(farBgLayer.drawX, farBgLayer.drawY, farBgRightEdge - farBgLayer.drawX, farBgBottomEdge - farBgLayer.drawY);
      ctx.clip();
    }

    // Calculate normalized player position (0 to 1)
    const halfW = this.canvasWidth * 0.06 / 2;
    const normalizedPlayerPos = totalPlayerRange > 0 ? (playerX - halfW) / totalPlayerRange : 0;

    // Enforced render order: farthest layers first, tree before foreground
    const renderOrder = ['far_bg', 'mid_bg', 'tree', 'foreground'];

    for (const layerName of renderOrder) {
      const layer = this.layers.find((l) => l.image && l.image.src.includes(layerName));
      if (!layer || !layer.image) continue;

      // Calculate micro-parallax shift
      const parallaxShift = normalizedPlayerPos * this.maxParallaxPx * layer.parallaxFactor;

      ctx.save();
      ctx.translate(parallaxShift, 0);

      // Draw the image with fallback to solid color if image fails
      try {
        ctx.drawImage(layer.image, layer.drawX, layer.drawY, layer.drawW, layer.drawH);
      } catch (e) {
        // Graceful degradation: draw solid color fallback
        console.warn(`BackgroundSystem: Failed to draw layer "${layerName}", falling back to solid color.`);
        ctx.fillStyle = this._getFallbackColor(layerName);
        ctx.fillRect(layer.drawX, layer.drawY, layer.drawW, layer.drawH);
      }

      ctx.restore();
    }

    // Restore clip region after all layers drawn
    if (farBgLayer) {
      ctx.restore();
    }
  }

  /**
   * Get a fallback solid color for a layer if the image fails to load.
   * @param {string} layerName — Layer identifier
   * @returns {string} CSS color string
   */
  _getFallbackColor(layerName) {
    const fallbacks = {
      far_bg: '#87CEEB',       // Sky blue
      mid_bg: '#90EE90',       // Light green
      foreground: '#228B22',   // Forest green
      tree: '#2E8B57',         // Sea green
    };
    return fallbacks[layerName] || '#cccccc';
  }

  /**
   * Render all background layers WITHOUT parallax offsets (static render).
   * Used for UI screens (menu, theme select) where no scrolling is desired.
   * @param {CanvasRenderingContext2D} ctx — Canvas rendering context
   * @param {number} w — Canvas width
   * @param {number} h — Canvas height
   */
  renderStatic(ctx, w, h) {
    if (!this.isLoaded || this.layers.length === 0) return;

    // --- Clip to visible scene bounds (background image area) ---
    const farBgLayer = this.layers.find((l) => l.type === LayerType.FILL_CANVAS && l.image?.src.includes('far_bg'));
    if (farBgLayer) {
      const farBgRightEdge = farBgLayer.drawX + farBgLayer.drawW;
      const farBgBottomEdge = farBgLayer.drawY + farBgLayer.drawH;
      ctx.save();
      ctx.beginPath();
      ctx.rect(farBgLayer.drawX, farBgLayer.drawY, farBgRightEdge - farBgLayer.drawX, farBgBottomEdge - farBgLayer.drawY);
      ctx.clip();
    }

    // Enforced render order: farthest layers first, tree before foreground
    const renderOrder = ['far_bg', 'mid_bg', 'tree', 'foreground'];

    for (const layerName of renderOrder) {
      const layer = this.layers.find((l) => l.image && l.image.src.includes(layerName));
      if (!layer || !layer.image) continue;

      ctx.save();

      // Draw the image with fallback to solid color if image fails
      try {
        ctx.drawImage(layer.image, layer.drawX, layer.drawY, layer.drawW, layer.drawH);
      } catch (e) {
        // Graceful degradation: draw solid color fallback
        console.warn(`BackgroundSystem: Failed to draw static layer "${layerName}", falling back to solid color.`);
        ctx.fillStyle = this._getFallbackColor(layerName);
        ctx.fillRect(layer.drawX, layer.drawY, layer.drawW, layer.drawH);
      }

      ctx.restore();
    }

    // Restore clip region after all layers drawn
    if (farBgLayer) {
      ctx.restore();
    }
  }

  /**
   * Check if a specific background layer is loaded.
   * @param {string} layerName — Layer identifier
   * @returns {boolean}
   */
  hasLayer(layerName) {
    return this.images.has(layerName);
  }

  /**
   * Get the number of loaded layers.
   * @returns {number}
   */
  getLoadedCount() {
    return this.images.size;
  }

  /**
   * Get all loaded layer names.
   * @returns {string[]}
   */
  getLoadedLayers() {
    return [...this.images.keys()];
  }
}
