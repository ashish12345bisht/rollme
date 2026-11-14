// Synthesized sound: steel balls rolling on a wooden board, clinks, hole drops, goal chimes.

interface Roll {
  out: GainNode;
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  ring: BiquadFilterNode;
}

// Major pentatonic steps (semitones) — every goal chime harmonizes with the last.
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

export class Sfx {
  private ctx?: AudioContext;
  private master!: GainNode;
  private dry!: GainNode;
  private send!: GainNode;
  private noise!: AudioBuffer;
  private rolls: Roll[] = [];
  muted = false;
  /** What the walls are made of: changes the knock sound. */
  material: "wood" | "plastic" = "wood";

  /** Must be called from a user gesture (tap) — browsers block audio before that. */
  unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      comp.connect(this.master).connect(ctx.destination);

      this.dry = ctx.createGain();
      this.dry.connect(comp);
      // Small-room reverb so chimes and clinks feel like they're in a wooden box.
      const verb = ctx.createConvolver();
      verb.buffer = this.impulse(1.4);
      this.send = ctx.createGain();
      this.send.gain.value = 0.35;
      this.send.connect(verb).connect(comp);

      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02);
  }

  private impulse(secs: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return buf;
  }

  private roll(i: number): Roll {
    const ctx = this.ctx!;
    while (this.rolls.length <= i) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      // Each ball gets its own slightly different steel "ring" frequency.
      const id = this.rolls.length;
      const out = ctx.createGain();
      out.gain.value = 0;
      const low = ctx.createBiquadFilter();
      low.type = "lowpass";
      low.Q.value = 0.9;
      const mid = ctx.createBiquadFilter();
      mid.type = "bandpass";
      mid.Q.value = 1.2;
      const ring = ctx.createBiquadFilter();
      ring.type = "bandpass";
      ring.Q.value = 18;
      ring.frequency.value = 2900 + id * 237;
      const gl = ctx.createGain(); gl.gain.value = 1;
      const gm = ctx.createGain(); gm.gain.value = 0.45;
      const gr = ctx.createGain(); gr.gain.value = 2.2;
      src.connect(low).connect(gl).connect(out);
      src.connect(mid).connect(gm).connect(out);
      src.connect(ring).connect(gr).connect(out);
      out.connect(this.dry);
      src.start(0, Math.random() * 2);
      this.rolls.push({ out, low, mid, ring });
    }
    return this.rolls[i];
  }

  /** Called every frame per ball with its speed in cells/s (0 = silent). */
  setRoll(i: number, speed: number) {
    if (!this.ctx) return;
    const r = this.roll(i);
    const t = this.ctx.currentTime;
    const level = speed < 0.15 ? 0 : Math.min(1, speed / 9) ** 1.15;
    // Random flutter = the grain of the wood under the ball.
    const grain = 0.7 + Math.random() * 0.6;
    r.out.gain.setTargetAtTime(level * 0.32 * grain, t, 0.03);
    // On a printed card under plastic the rumble is thinner and brighter than on wood.
    const lift = this.material === "plastic" ? 1.6 : 1;
    r.low.frequency.setTargetAtTime((160 + speed * 55) * lift, t, 0.05);
    r.mid.frequency.setTargetAtTime(700 + speed * 90, t, 0.05);
  }

  silenceRolls() {
    if (!this.ctx) return;
    for (const r of this.rolls) r.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
  }

  // ---- one-shots -------------------------------------------------------

  /** Inharmonic partials of a struck steel sphere. */
  private tink(freq: number, gain: number, decay: number, when = 0, wet = 0.2) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const ratios = [1, 2.32, 4.25, 6.63];
    const amps = [1, 0.55, 0.3, 0.15];
    const decays = [1, 0.55, 0.32, 0.2];
    ratios.forEach((ratio, k) => {
      const o = ctx.createOscillator();
      o.frequency.value = freq * ratio;
      const g = ctx.createGain();
      const d = decay * decays[k];
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * amps[k]), t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(this.dry);
      if (wet) {
        const s = ctx.createGain();
        s.gain.value = wet;
        g.connect(s).connect(this.send);
      }
      o.start(t);
      o.stop(t + d + 0.05);
    });
  }

  private click(gain: number, freq: number, when = 0, len = 0.025) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, gain), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(this.dry);
    src.start(t, Math.random() * 1.5, len + 0.02);
  }

  /** Low, woody knock with a pitch drop. */
  private thock(freq: number, gain: number, decay: number, when = 0, wet = 0.15) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.62, t + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(this.dry);
    const s = ctx.createGain();
    s.gain.value = wet;
    g.connect(s).connect(this.send);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  /** Warm bell (struck chime bar). */
  private bell(freq: number, gain: number, when = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const parts: [number, number, number][] = [
      [1, 1, 1.8],
      [2, 0.45, 1.1],
      [3.01, 0.22, 0.7],
      [4.17, 0.12, 0.4],
    ];
    for (const [ratio, amp, dec] of parts) {
      const o = ctx.createOscillator();
      o.frequency.value = freq * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain * amp, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g);
      g.connect(this.dry);
      const s = ctx.createGain();
      s.gain.value = 0.6;
      g.connect(s).connect(this.send);
      o.start(t);
      o.stop(t + dec + 0.05);
    }
  }

  private ok() {
    return !!this.ctx && !this.muted;
  }

  wallHit(speed: number) {
    if (!this.ok()) return;
    const s = Math.min(1, speed / 8);
    if (this.material === "plastic") {
      // Hollow plastic tick: short, bright, a small boxy body.
      this.thock(420 + Math.random() * 60, 0.3 * s, 0.05);
      this.click(0.45 * s, 3200 + Math.random() * 800, 0, 0.015);
      this.tink(2600 * (0.95 + Math.random() * 0.1), 0.07 * s, 0.25);
      return;
    }
    this.thock(150 + Math.random() * 30, 0.55 * s, 0.09);
    this.click(0.4 * s, 1500 + Math.random() * 500);
    this.tink(2300 * (0.95 + Math.random() * 0.1), 0.09 * s, 0.35);
  }

  ballHit(speed: number) {
    if (!this.ok()) return;
    const s = Math.min(1, speed / 8);
    this.tink(3300 * (0.94 + Math.random() * 0.12), 0.32 * s, 0.7, 0, 0.3);
    this.click(0.12 * s, 6000);
  }

  /** Ball spirals round the rim, drops, knocks in the box below, then a soft falling two-note. */
  fall() {
    if (!this.ok()) return;
    const rattles = [0, 0.085, 0.15, 0.2, 0.235, 0.26];
    rattles.forEach((w, i) => {
      const g = 0.16 * (1 - i / rattles.length) + 0.03;
      this.tink(2500 + i * 60, g, 0.25, w, 0.25);
      this.click(g * 0.8, 1800, w);
    });
    this.thock(120, 0.75, 0.4, 0.33, 0.35);
    this.thock(62, 0.45, 0.55, 0.33, 0.2);
    // Mellow wooden "doo-dum", like a marimba sighing.
    this.marimba(392, 0.22, 0.55);
    this.marimba(294, 0.22, 0.74);
  }

  private marimba(freq: number, gain: number, when: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    for (const [ratio, amp, dec] of [[1, 1, 0.7], [3.9, 0.25, 0.18], [10, 0.05, 0.05]] as const) {
      const o = ctx.createOscillator();
      o.frequency.value = freq * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain * amp, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g);
      g.connect(this.dry);
      const s = ctx.createGain();
      s.gain.value = 0.5;
      g.connect(s).connect(this.send);
      o.start(t);
      o.stop(t + dec + 0.05);
    }
  }

  /** A ball sinks into the goal; each one rings the next note up the scale. */
  home(count: number) {
    if (!this.ok()) return;
    this.tink(2700, 0.14, 0.3);
    this.thock(200, 0.4, 0.12, 0.04);
    const semi = PENTA[Math.min(count - 1, PENTA.length - 1)];
    this.bell(523.25 * 2 ** (semi / 12), 0.22, 0.08);
  }

  respawn() {
    if (!this.ok()) return;
    this.tink(3000, 0.06, 0.2);
  }

  win() {
    if (!this.ok()) return;
    [0, 4, 7, 12, 16, 19, 24].forEach((semi, i) => this.bell(523.25 * 2 ** (semi / 12), 0.2, i * 0.11));
  }
}
