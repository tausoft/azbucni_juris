Act as a Senior HTML5 Game Developer. We are writing a fresh, minimal version of `src/engine/player.js` to test asset loading and single-frame rendering.

Here is the exact file path structure served by Vite:
- JSON map: '/sprites/knight/map.json'
- Spritesheet image: '/sprites/knight/spritesheet.png'

The JSON uses a Hash structure where the first frame key is named "knight-idle-1".

Your only task is to load these two assets, extract that single frame, render it statically on the canvas, and log every step to the console. Do not add any inputs, physics, states, or animations yet.

Please write `src/engine/player.js` to do exactly this:
1. In the constructor, store the exact paths: '/sprites/knight/map.json' and '/sprites/knight/spritesheet.png'.
2. Initialize `this.isReady = false`, `this.x = 100`, and `this.y = 100`.
3. Fetch the JSON and load the Image. 
4. Add these exact console logs for debugging:
   - console.log("Player: Fetching JSON from /sprites/knight/map.json...")
   - console.log("Player: JSON loaded:", this.json)
   - console.log("Player: Image loaded successfully")
5. When BOTH the JSON is parsed and the Image `onload` triggers, set `this.isReady = true`.
6. In the `draw(ctx)` method:
   - If `this.isReady` is false, draw a fallback shapes/square so we know the loop is running.
   - If `this.isReady` is true, extract the frame: `const f = this.json.frames["knight-idle-1"].frame;`
   - Render it using: `ctx.drawImage(this.image, f.x, f.y, f.w, f.h, this.x, this.y, f.w, f.h);`
   - Use a single-use flag to log exactly once: console.log("Player: Successfully drawing static sprite frame!")

Provide the clean, minimal ES6 Player class module.
