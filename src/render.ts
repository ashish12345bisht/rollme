// Canvas renderer. A static layer (wood, holes, walls) is drawn once per layout; balls every frame.

import { PHYS, type Ball, type World } from "./physics";

const FRAME = 0.4; // wooden frame around the maze, in cells

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private layer = document.createElement("canvas");
  private dpr = 1;
  private W = 0;
  private H = 0;
  private cell = 0;
  private ox = 0;
  private oy = 0;
  private world?: World;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }

  resize() {
    const r = this.canvas.parentElement!.getBoundingClientRect();
    this.dpr = Math.min(devicePixelRatio || 1, 2.5);
    this.W = r.width;
    this.H = r.height;
    for (const c of [this.canvas, this.layer]) {
      c.width = Math.round(r.width * this.dpr);
      c.height = Math.round(r.height * this.dpr);
    }
    this.canvas.style.width = `${r.width}px`;
    this.canvas.style.height = `${r.height}px`;
    if (this.world) this.layout();
  }

  setWorld(w: World) {
    this.world = w;
    this.layout();
  }

  private layout() {
    const { cols, rows } = this.world!.level.maze;
    const pad = 10;
    this.cell = Math.min((this.W - 2 * pad) / (cols + 2 * FRAME), (this.H - 2 * pad) / (rows + 2 * FRAME));
    this.ox = (this.W - cols * this.cell) / 2;
    this.oy = (this.H - rows * this.cell) / 2;
    this.drawStatic();
  }

  private X = (x: number) => this.ox + x * this.cell;
  private Y = (y: number) => this.oy + y * this.cell;

  private drawStatic() {
    const w = this.world!;
    const { cols, rows } = w.level.maze;
    const c = this.layer.getContext("2d")!;
    const k = this.cell;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);

    // Outer frame (darker wood) with a soft drop shadow.
    const fx = this.X(-FRAME), fy = this.Y(-FRAME), fw = (cols + 2 * FRAME) * k, fh = (rows + 2 * FRAME) * k;
    c.save();
    c.shadowColor = "rgba(0,0,0,0.55)";
    c.shadowBlur = 24;
    c.shadowOffsetY = 8;
    rounded(c, fx, fy, fw, fh, k * 0.25);
    const fg = c.createLinearGradient(fx, fy, fx + fw, fy + fh);
    fg.addColorStop(0, "#7a4a28");
    fg.addColorStop(1, "#4e2c16");
    c.fillStyle = fg;
    c.fill();
    c.restore();

    // Board surface: light maple with grain.
    const bx = this.X(0), by = this.Y(0), bw = cols * k, bh = rows * k;
    c.save();
    c.beginPath();
    c.rect(bx, by, bw, bh);
    c.clip();
    const bg = c.createLinearGradient(bx, by, bx + bw, by + bh);
    bg.addColorStop(0, "#e6c48f");
    bg.addColorStop(1, "#cfa26a");
    c.fillStyle = bg;
    c.fillRect(bx, by, bw, bh);
    woodGrain(c, bx, by, bw, bh);
    // Inner shadow where the board meets the frame.
    c.shadowColor = "rgba(40,20,5,0.6)";
    c.shadowBlur = k * 0.3;
    c.strokeStyle = "rgba(0,0,0,1)";
    c.lineWidth = k * 0.2;
    c.strokeRect(bx - k * 0.1, by - k * 0.1, bw + k * 0.2, bh + k * 0.2);
    c.restore();

    // Start: a shallow engraved ring.
    const s = w.level.start;
    c.beginPath();
    c.arc(this.X(s.x + 0.5), this.Y(s.y + 0.5), k * 0.36, 0, Math.PI * 2);
    c.strokeStyle = "rgba(90,50,20,0.35)";
    c.lineWidth = k * 0.04;
    c.stroke();

    for (const h of w.level.holes) this.hole(c, h.x, h.y, h.r, false);
    const g = w.level.goal;
    this.hole(c, g.x + 0.5, g.y + 0.5, PHYS.goalRadius, true);

    // Walls: first all shadows, then all tops, so shadows never land on top of a wall.
    const t = k * 0.035;
    for (const pass of [0, 1]) {
      c.save();
      if (pass === 0) {
        c.shadowColor = "rgba(30,12,0,0.55)";
        c.shadowBlur = k * 0.14;
        c.shadowOffsetX = k * 0.05;
        c.shadowOffsetY = k * 0.09;
      }
      for (const r of w.rects) {
        const x = this.X(r.x0), y = this.Y(r.y0), ww = (r.x1 - r.x0) * k, hh = (r.y1 - r.y0) * k;
        rounded(c, x, y, ww, hh, t);
        if (pass === 0) {
          c.fillStyle = "#5a3317";
          c.fill();
        } else {
          const wg = c.createLinearGradient(x, y, x + ww * 0.3, y + hh * 0.3);
          wg.addColorStop(0, "#8a5530");
          wg.addColorStop(1, "#5c341a");
          c.fillStyle = wg;
          c.fill();
          c.strokeStyle = "rgba(255,225,180,0.18)";
          c.lineWidth = 1;
          c.stroke();
        }
      }
      c.restore();
    }
  }

  private hole(c: CanvasRenderingContext2D, cx: number, cy: number, radius: number, goal: boolean) {
    const x = this.X(cx), y = this.Y(cy), r = radius * this.cell;
    if (goal) {
      c.save();
      c.shadowColor = "rgba(255,200,90,0.8)";
      c.shadowBlur = r * 0.9;
      const ring = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r * 1.22);
      ring.addColorStop(0, "#fff0b8");
      ring.addColorStop(0.5, "#d9a842");
      ring.addColorStop(1, "#8a6117");
      c.beginPath();
      c.arc(x, y, r * 1.22, 0, Math.PI * 2);
      c.fillStyle = ring;
      c.fill();
      c.restore();
    } else {
      // Slight darkened dip of the wood around the hole.
      const dip = c.createRadialGradient(x, y, r, x, y, r * 1.35);
      dip.addColorStop(0, "rgba(80,40,10,0.45)");
      dip.addColorStop(1, "rgba(80,40,10,0)");
      c.fillStyle = dip;
      c.beginPath();
      c.arc(x, y, r * 1.35, 0, Math.PI * 2);
      c.fill();
    }
    const pit = c.createRadialGradient(x + r * 0.25, y + r * 0.3, 0, x, y, r);
    pit.addColorStop(0, goal ? "#1d1206" : "#000");
    pit.addColorStop(0.7, goal ? "#2a1a08" : "#0b0603");
    pit.addColorStop(1, goal ? "#4a3010" : "#2b170a");
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = pit;
    c.fill();
    // Lit lower lip.
    c.beginPath();
    c.arc(x, y, r - 0.5, Math.PI * 0.15, Math.PI * 0.85);
    c.strokeStyle = goal ? "rgba(255,230,160,0.5)" : "rgba(255,220,170,0.25)";
    c.lineWidth = Math.max(1, r * 0.08);
    c.stroke();
  }

  draw() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(this.layer, 0, 0);
    if (!this.world) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const k = this.cell;
    const R = PHYS.ballRadius;
    const balls = this.world.balls;

    // Balls resting in the goal, nestled together.
    const g = this.world.level.goal;
    for (const b of balls) {
      if (b.state !== "home") continue;
      const i = b.homeIndex;
      const ang = (i - 1) * ((Math.PI * 2) / 5) - Math.PI / 2;
      const off = i === 0 ? 0 : 0.2;
      const settle = Math.min(1, b.t / 0.25);
      const hx = g.x + 0.5 + Math.cos(ang) * off;
      const hy = g.y + 0.5 + Math.sin(ang) * off;
      const x = b.tx + (hx - b.tx) * settle;
      const y = b.ty + (hy - b.ty) * settle;
      chrome(c, this.X(x), this.Y(y), R * k * (1 - 0.45 * settle), 0.35 * settle);
    }
    for (const b of balls) {
      if (b.state === "fall") this.falling(b);
    }
    for (const b of balls) {
      if (b.state !== "roll") continue;
      const x = this.X(b.x), y = this.Y(b.y), r = R * k;
      c.beginPath();
      c.ellipse(x + r * 0.18, y + r * 0.28, r * 0.95, r * 0.85, 0, 0, Math.PI * 2);
      c.fillStyle = "rgba(40,18,0,0.32)";
      c.fill();
    }
    for (const b of balls) {
      if (b.state === "roll") chrome(c, this.X(b.x), this.Y(b.y), R * this.cell, 0);
    }
  }

  private falling(b: Ball) {
    const p = Math.min(1, b.t / PHYS.fallTime);
    const e = p * p;
    const x = b.x + (b.tx - b.x) * Math.min(1, p * 2);
    const y = b.y + (b.ty - b.y) * Math.min(1, p * 2);
    chrome(this.ctx, this.X(x), this.Y(y), PHYS.ballRadius * this.cell * (1 - 0.6 * e), 0.85 * e);
  }
}

/** Polished steel ball: bright key light top-left, dark horizon band, warm reflection of the wood below. */
function chrome(c: CanvasRenderingContext2D, x: number, y: number, r: number, dark: number) {
  if (r <= 0.5) return;
  const g = c.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.04, x, y, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.12, "#f1f4f7");
  g.addColorStop(0.45, "#a9b1bb");
  g.addColorStop(0.78, "#4b5159");
  g.addColorStop(1, "#23272c");
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = g;
  c.fill();
  c.clip();
  // Horizon line reflection.
  c.fillStyle = "rgba(30,34,40,0.35)";
  c.beginPath();
  c.ellipse(x, y + r * 0.12, r * 1.05, r * 0.18, 0, 0, Math.PI * 2);
  c.fill();
  // Warm board reflected in the bottom of the sphere.
  const w = c.createLinearGradient(x, y + r * 0.2, x, y + r);
  w.addColorStop(0, "rgba(230,180,120,0)");
  w.addColorStop(1, "rgba(230,180,120,0.55)");
  c.fillStyle = w;
  c.fillRect(x - r, y + r * 0.2, r * 2, r * 0.8);
  if (dark > 0) {
    c.fillStyle = `rgba(15,8,2,${dark})`;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  c.restore();
  // Specular hotspot.
  c.beginPath();
  c.arc(x - r * 0.36, y - r * 0.4, r * 0.16, 0, Math.PI * 2);
  c.fillStyle = `rgba(255,255,255,${0.9 * (1 - dark)})`;
  c.fill();
}

function rounded(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

function woodGrain(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const lines = Math.ceil(h / 3);
  for (let i = 0; i < lines; i++) {
    const y0 = y + Math.random() * h;
    const amp = 2 + Math.random() * 6;
    const freq = 0.004 + Math.random() * 0.01;
    const phase = Math.random() * 10;
    c.beginPath();
    for (let px = x; px <= x + w; px += 6) {
      const py = y0 + Math.sin(px * freq + phase) * amp + Math.sin(px * freq * 3.1) * amp * 0.25;
      if (px === x) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    const dark = Math.random() < 0.7;
    c.strokeStyle = dark ? `rgba(130,75,30,${0.04 + Math.random() * 0.1})` : `rgba(255,240,210,${0.05 + Math.random() * 0.08})`;
    c.lineWidth = 0.5 + Math.random() * 1.8;
    c.stroke();
  }
}
