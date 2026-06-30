// Audio cues for the kiosk recording flow. A beep (Web Audio) plus an optional
// spoken phrase (Web Speech API) — configurable so a partner could swap beeps
// for a voice saying "start recording" / "end recording".

let ctx: AudioContext | null = null;
function audioCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

export function beep(durationMs = 250, frequency = 880): void {
  try {
    const ac = audioCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.value = frequency;
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.001, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ac.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + durationMs / 1000);
    osc.start();
    osc.stop(ac.currentTime + durationMs / 1000);
  } catch {
    /* audio not available — no-op */
  }
}

export function speak(text: string): void {
  try {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* no-op */
  }
}

// Combined cue: beep + voice. Set `voice` to false to use beep only.
export function cue(phrase: string, voice = true): void {
  beep();
  if (voice) setTimeout(() => speak(phrase), 200);
}
