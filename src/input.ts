// Tilt input: phone orientation sensor, with arrow keys / WASD as a desktop fallback.

export type TiltStart = "ok" | "denied" | "none";

const KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
  a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1],
};
const RAD = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class Tilt {
  /** True once a real orientation reading has arrived. */
  sensor = false;
  private beta = 0;
  private gamma = 0;
  private b0 = 0;
  private g0 = 0;
  private wantCalib = true;
  private held = new Set<string>();
  private x = 0;
  private y = 0;

  constructor() {
    addEventListener("keydown", (e) => {
      if (e.key in KEYS) {
        this.held.add(e.key);
        e.preventDefault();
      }
    });
    addEventListener("keyup", (e) => this.held.delete(e.key));
    addEventListener("blur", () => this.held.clear());
  }

  /** Call from a tap: iOS only grants motion access inside a user gesture. */
  async start(): Promise<TiltStart> {
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
      .DeviceOrientationEvent;
    if (!DOE) return "none";
    if (typeof DOE.requestPermission === "function") {
      try {
        if ((await DOE.requestPermission()) !== "granted") return "denied";
      } catch {
        return "denied";
      }
    }
    addEventListener("deviceorientation", this.onOrient);
    return "ok";
  }

  private onOrient = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    this.beta = e.beta;
    this.gamma = e.gamma;
    this.sensor = true;
    if (this.wantCalib) this.calibrate();
  };

  /** Treat however the phone is held right now as "level". */
  calibrate() {
    if (!this.sensor) {
      this.wantCalib = true;
      return;
    }
    this.b0 = this.beta;
    this.g0 = this.gamma;
    this.wantCalib = false;
  }

  /** Gravity direction in screen space, components roughly in [-1, 1]. */
  get(dt: number): { x: number; y: number } {
    let tx: number, ty: number;
    if (this.sensor) {
      // Device frame: gamma = left/right tilt, beta = front/back tilt.
      const dx = Math.sin(clamp(this.gamma - this.g0, -70, 70) * RAD);
      const dy = Math.sin(clamp(this.beta - this.b0, -70, 70) * RAD);
      // Rotate into screen space if the screen is in landscape.
      const angle = (screen.orientation?.angle ?? 0) * RAD;
      tx = dx * Math.cos(angle) + dy * Math.sin(angle);
      ty = -dx * Math.sin(angle) + dy * Math.cos(angle);
    } else {
      tx = ty = 0;
      for (const k of this.held) {
        tx += KEYS[k][0] * 0.3;
        ty += KEYS[k][1] * 0.3;
      }
    }
    // Light smoothing: removes sensor jitter without feeling laggy.
    const a = Math.min(1, dt * (this.sensor ? 20 : 6));
    this.x += (tx - this.x) * a;
    this.y += (ty - this.y) * a;
    return { x: this.x, y: this.y };
  }
}
