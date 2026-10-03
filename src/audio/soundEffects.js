// ============================================================
// Audio Engine — Web Audio API sound effects (no external files)
// ============================================================

let audioCtx = null;
let isInitialized = false;

/**
 * Initialize the Web Audio context.
 */
export function initAudioEngine() {
  if (isInitialized) return;

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    isInitialized = true;
  } catch (e) {
    console.warn('Web Audio API not supported');
  }
}

/**
 * Play a sound effect by type.
 * @param {'catch' | 'miss' | 'win' | 'lose' | 'click'} type
 */
export function playBeep(type) {
  if (!audioCtx || !isInitialized) return;

  // Resume context if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  switch (type) {
    case 'catch':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, audioCtx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(784, audioCtx.currentTime + 0.1); // G5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.15);
      break;

    case 'miss':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.3);
      break;

    case 'win':
      // Arpeggio: C5-E5-G5-C6
      playNote(523, 0);
      playNote(659, 0.1);
      playNote(784, 0.2);
      playNote(1047, 0.3);
      break;

    case 'lose':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.5);
      break;

    case 'click':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.05);
      break;
  }
}

/**
 * Play a single note in the win arpeggio.
 */
function playNote(frequency, delay) {
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, audioCtx.currentTime + delay);
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + delay + 0.3);

  osc.start(audioCtx.currentTime + delay);
  osc.stop(audioCtx.currentTime + delay + 0.3);
}
