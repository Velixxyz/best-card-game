// Tiny sound effects, synthesized with WebAudio — no audio files, no
// network. A short blip per event: play, hit, heal, win, loss.

export function createAudio() {
  let context = null;
  let enabled = true;

  function ensure() {
    if (!context) {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  }

  function blip(frequency, duration, type, gainValue) {
    if (!enabled) return;
    const ctx = ensure();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  }

  return {
    toggle() {
      enabled = !enabled;
      return enabled;
    },
    play() {
      blip(520, 0.12, 'triangle', 0.12);
    },
    hit() {
      blip(140, 0.22, 'sawtooth', 0.14);
    },
    heal() {
      blip(660, 0.18, 'sine', 0.1);
      window.setTimeout(() => blip(880, 0.2, 'sine', 0.08), 90);
    },
    win() {
      [523, 659, 784, 1047].forEach((frequency, i) =>
        window.setTimeout(() => blip(frequency, 0.25, 'triangle', 0.12), i * 120),
      );
    },
    lose() {
      [392, 330, 262].forEach((frequency, i) =>
        window.setTimeout(() => blip(frequency, 0.3, 'triangle', 0.1), i * 160),
      );
    },
  };
}
