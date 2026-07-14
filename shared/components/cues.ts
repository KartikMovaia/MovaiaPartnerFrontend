// Audio cues for the kiosk recording flow — short beeps played via Web Audio.
// One beep marks "recording started"; two beeps mark "recording ended".
//
// The beep is tuned to carry across a busy gym (loud treadmills, music, chatter)
// without being harsh: it's pushed loud but runs through a brick-wall limiter so
// it can never clip or spike into painful territory, and it fades in over ~15ms
// so it lands as a friendly chime rather than a startling alarm.

// Master beep level (0–1). Higher = louder. Kept below 1.0 and capped by the
// limiter below, so raising this changes perceived loudness, never harshness.
const BEEP_LEVEL = 0.92;

let ctx: AudioContext | null = null;
function audioCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

// Prime the audio pipeline from a user gesture. iPad Safari keeps a fresh
// AudioContext "suspended" and won't play beeps fired from a timer (as the
// recording start/end beeps are) unless it was created/resumed during a tap.
export function unlockAudio(): void {
  try {
    const ac = audioCtx();
    if (ac.state === 'suspended') void ac.resume();
  } catch {
    /* audio not available — no-op */
  }
}

export function beep(durationMs = 250, frequency = 1000): void {
  try {
    const ac = audioCtx();
    const now = ac.currentTime;
    const dur = durationMs / 1000;

    // Brick-wall limiter on the output: lets us drive the tone loud (good
    // cut-through in a noisy gym) while guaranteeing the peak can't run away and
    // hurt someone's ears — hard knee + high ratio right below the ceiling.
    const limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    limiter.connect(ac.destination);

    // Master envelope: fast-but-smooth fade-in (no startling click), short hold,
    // gentle fade-out. exponential ramps never hit 0, hence the tiny floor.
    const env = ac.createGain();
    env.connect(limiter);
    const holdUntil = Math.max(0.02, dur - 0.07);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(BEEP_LEVEL, now + 0.015);
    env.gain.setValueAtTime(BEEP_LEVEL, now + holdUntil);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    // Fundamental + a quieter octave adds "presence" so the beep reads clearly
    // over broadband gym noise without needing a piercing high pitch.
    const partials: Array<{ f: number; level: number }> = [
      { f: frequency, level: 0.7 },
      { f: frequency * 2, level: 0.3 },
    ];
    for (const p of partials) {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = p.f;
      g.gain.value = p.level;
      osc.connect(g);
      g.connect(env);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    }
  } catch {
    /* audio not available — no-op */
  }
}

// Play `count` short beeps in sequence, spaced so they read as distinct tones.
// The kiosk uses one beep for "recording started" and two for "recording ended".
export function beeps(count: number, gapMs = 300): void {
  for (let i = 0; i < count; i += 1) {
    setTimeout(() => beep(180), i * gapMs);
  }
}
