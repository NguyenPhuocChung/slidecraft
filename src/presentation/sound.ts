/** Transition sounds synthesized with Web Audio (no external files). */
let ctx: AudioContext | null = null;
export function playTransitionSound(kind?: string) {
  if (!kind || kind === 'none' || typeof window === 'undefined') return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(ctx.destination);
    if (kind === 'click') {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(1800, t);
      g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g); o.start(t); o.stop(t + 0.06);
    } else if (kind === 'chime') {
      [880, 1320].forEach((f, i) => { const o = ctx!.createOscillator(); o.type = 'sine'; o.frequency.value = f; const gg = ctx!.createGain(); gg.gain.setValueAtTime(0.12, t + i * 0.08); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 + i * 0.08); o.connect(gg); gg.connect(ctx!.destination); o.start(t + i * 0.08); o.stop(t + 1); });
    } else if (kind === 'whoosh') {
      const len = ctx.sampleRate * 0.5;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.45);
      g.gain.value = 0.25; src.connect(f); f.connect(g); src.start(t);
    }
  } catch { /* audio not available */ }
}
