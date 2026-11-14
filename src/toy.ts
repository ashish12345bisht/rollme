// "Geometry box" look: a translucent plastic pencil-box maze toy with a printed picture card,
// clear plastic walls and a glass cover over the balls.

import { makeRand, type Rand } from "./maze";
import type { World } from "./physics";

export const TOY_FRAME = 0.62; // plastic case border, in cells

export interface Geo {
  ox: number;
  oy: number;
  k: number;
  world: World;
}

const CASES = [
  { base: "#f7c51e", light: "#ffe680", dark: "#c98d00" }, // yellow
  { base: "#8fd14f", light: "#d2f59a", dark: "#4f9a1c" }, // lime
  { base: "#45b3f0", light: "#a8e2ff", dark: "#1a74b5" }, // sky
  { base: "#f27bb0", light: "#ffc2df", dark: "#c03f7d" }, // pink
  { base: "#f7953b", light: "#ffcf95", dark: "#c45f0d" }, // orange
];

export function caseColor(level: number) {
  return CASES[(level - 1) % CASES.length];
}

const TAU = Math.PI * 2;

/** Everything that doesn't move: case, printed card, holes, goal, clear walls. */
export function drawToy(c: CanvasRenderingContext2D, g: Geo) {
  const { k, world } = g;
  const { cols, rows } = world.level.maze;
  const X = (x: number) => g.ox + x * k;
  const Y = (y: number) => g.oy + y * k;
  const col = caseColor(world.level.number);
  const F = TOY_FRAME;
  const fx = X(-F), fy = Y(-F), fw = (cols + 2 * F) * k, fh = (rows + 2 * F) * k;

  // Clasp tab at the bottom (drawn first so the case overlaps it).
  c.save();
  c.shadowColor = "rgba(0,0,0,0.4)";
  c.shadowBlur = 10;
  c.shadowOffsetY = 4;
  round(c, fx + fw / 2 - k * 0.9, fy + fh - k * 0.2, k * 1.8, k * 0.55, k * 0.18);
  c.fillStyle = col.dark;
  c.fill();
  c.restore();

  // Plastic case.
  c.save();
  c.shadowColor = "rgba(0,0,0,0.5)";
  c.shadowBlur = 26;
  c.shadowOffsetY = 10;
  round(c, fx, fy, fw, fh, k * 0.55);
  const cg = c.createLinearGradient(fx, fy, fx, fy + fh);
  cg.addColorStop(0, col.light);
  cg.addColorStop(0.08, col.base);
  cg.addColorStop(0.92, col.base);
  cg.addColorStop(1, col.dark);
  c.fillStyle = cg;
  c.fill();
  c.restore();
  // Moulded lip: a lighter inner rim and a glossy top edge.
  round(c, fx + k * 0.12, fy + k * 0.12, fw - k * 0.24, fh - k * 0.24, k * 0.45);
  c.strokeStyle = hexA(col.light, 0.7);
  c.lineWidth = k * 0.07;
  c.stroke();
  round(c, fx + 2, fy + 2, fw - 4, fh - 4, k * 0.53);
  c.strokeStyle = "rgba(255,255,255,0.55)";
  c.lineWidth = 1.5;
  c.stroke();

  // Red rivets: four corners plus the middle of the long sides.
  const rv = F * 0.5;
  const rivets = [
    [-rv, -rv], [cols + rv, -rv], [-rv, rows + rv], [cols + rv, rows + rv],
    [-rv, rows / 2], [cols + rv, rows / 2],
  ];
  for (const [rx, ry] of rivets) rivet(c, X(rx), Y(ry), k * 0.15);

  // Embossed START / FINISH on the case.
  const s = world.level.start, gl = world.level.goal;
  label(c, "START ▸", X(s.x + 0.08), Y(-F / 2), k, "left");
  label(c, "FINISH", X(gl.x + 0.92), Y(rows + F / 2), k, "right");

  // Recess for the card.
  const bx = X(0), by = Y(0), bw = cols * k, bh = rows * k;
  c.save();
  round(c, bx - 3, by - 3, bw + 6, bh + 6, 6);
  c.fillStyle = hexA(col.dark, 0.9);
  c.fill();
  c.beginPath();
  c.rect(bx, by, bw, bh);
  c.clip();
  scene(c, bx, by, bw, bh, world.level.number, makeRand(world.level.seed ^ 0x5eed));
  // The case lip throws a shadow onto the card.
  c.shadowColor = "rgba(0,0,0,0.55)";
  c.shadowBlur = k * 0.25;
  c.strokeStyle = "#000";
  c.lineWidth = k * 0.2;
  c.strokeRect(bx - k * 0.1, by - k * 0.1, bw + k * 0.2, bh + k * 0.2);
  c.restore();

  // Holes punched through the card.
  for (const h of world.level.holes) {
    const x = X(h.x), y = Y(h.y), r = h.r * k;
    c.beginPath();
    c.arc(x, y, r * 1.12, 0, TAU);
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.fill();
    const pit = c.createRadialGradient(x + r * 0.2, y + r * 0.3, 0, x, y, r);
    pit.addColorStop(0, "#000");
    pit.addColorStop(0.75, "#0c0c14");
    pit.addColorStop(1, "#30303c");
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fillStyle = pit;
    c.fill();
  }

  // Goal: a red-and-white target cup.
  const gx = X(gl.x + 0.5), gy = Y(gl.y + 0.5), gr = 0.4 * k;
  for (const [rr, fill] of [[1.25, "#fff"], [1.1, "#e8322f"], [0.95, "#fff"]] as const) {
    c.beginPath();
    c.arc(gx, gy, gr * rr, 0, TAU);
    c.fillStyle = fill;
    c.fill();
  }
  const cup = c.createRadialGradient(gx + gr * 0.2, gy + gr * 0.3, 0, gx, gy, gr);
  cup.addColorStop(0, "#5a0d0c");
  cup.addColorStop(1, "#b3201e");
  c.beginPath();
  c.arc(gx, gy, gr * 0.85, 0, TAU);
  c.fillStyle = cup;
  c.fill();

  // Clear plastic walls: faint body, crisp white edges, a sharp shadow on the card.
  for (const pass of [0, 1, 2]) {
    for (const r of world.rects) {
      const x = X(r.x0), y = Y(r.y0), w = (r.x1 - r.x0) * k, h = (r.y1 - r.y0) * k;
      if (pass === 0) {
        round(c, x + k * 0.05, y + k * 0.07, w, h, 2);
        c.fillStyle = "rgba(0,0,40,0.4)";
        c.fill();
      } else if (pass === 1) {
        round(c, x, y, w, h, 2);
        c.fillStyle = "rgba(235,245,255,0.5)";
        c.fill();
      } else {
        round(c, x + 0.5, y + 0.5, w - 1, h - 1, 2);
        c.strokeStyle = "rgba(255,255,255,0.95)";
        c.lineWidth = 1.2;
        c.stroke();
      }
    }
  }
}

/** Glass cover, drawn over the balls each frame. */
export function drawGlass(c: CanvasRenderingContext2D, g: Geo) {
  const { k } = g;
  const { cols, rows } = g.world.level.maze;
  const x = g.ox, y = g.oy, w = cols * k, h = rows * k;
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.fillStyle = "rgba(220,235,255,0.06)";
  c.fillRect(x, y, w, h);
  // Two diagonal glare streaks.
  const streak = (t: number, width: number, a: number) => {
    const sx = x + w * t;
    c.beginPath();
    c.moveTo(sx, y);
    c.lineTo(sx + width, y);
    c.lineTo(sx + width - h * 0.55, y + h);
    c.lineTo(sx - h * 0.55, y + h);
    c.closePath();
    const lg = c.createLinearGradient(sx - h * 0.3, 0, sx + width, 0);
    lg.addColorStop(0, "rgba(255,255,255,0)");
    lg.addColorStop(0.5, `rgba(255,255,255,${a})`);
    lg.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = lg;
    c.fill();
  };
  streak(0.55, w * 0.32, 0.2);
  streak(0.98, w * 0.12, 0.16);
  // Bright reflection along the top edge, darker toward the bottom.
  const vg = c.createLinearGradient(0, y, 0, y + h);
  vg.addColorStop(0, "rgba(255,255,255,0.18)");
  vg.addColorStop(0.06, "rgba(255,255,255,0)");
  vg.addColorStop(0.9, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.12)");
  c.fillStyle = vg;
  c.fillRect(x, y, w, h);
  c.restore();
  c.strokeStyle = "rgba(255,255,255,0.6)";
  c.lineWidth = 1;
  c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

// ---- printed picture cards (procedural, a different scene per level) ----

function scene(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, level: number, rand: Rand) {
  const which = (level - 1) % 4;
  const u = Math.min(w, h) / 6; // scale unit
  const rr = (a: number, b: number) => a + rand() * (b - a);
  const sky = (top: string, bottom: string) => {
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
  };
  const hills = (colors: string[]) => {
    colors.forEach((fill, i) => {
      const base = y + h * (0.7 + i * 0.1);
      const amp = h * 0.05;
      const ph = rand() * TAU;
      c.beginPath();
      c.moveTo(x, y + h);
      for (let px = 0; px <= w; px += 4) c.lineTo(x + px, base + Math.sin(px / (w * 0.22) + ph) * amp);
      c.lineTo(x + w, y + h);
      c.closePath();
      c.fillStyle = fill;
      c.fill();
    });
  };
  const stars = (n: number, color: string) => {
    c.fillStyle = color;
    for (let i = 0; i < n; i++) star(c, x + rand() * w, y + rand() * h * 0.75, rr(1, 3.2), 4);
  };

  if (which === 0) {
    // Candy land.
    sky("#ffd3ea", "#bfeaff");
    for (let i = 0; i < 5; i++) cloud(c, x + rand() * w, y + rand() * h * 0.5, rr(0.6, 1.1) * u);
    hills(["#ffa3cf", "#9fe3c4", "#c8a6ff"]);
    for (let i = 0; i < 9; i++) {
      const px = x + rand() * w, py = y + rand() * h;
      lollipop(c, px, py, rr(0.35, 0.7) * u, ["#ff5fa2", "#ffb000", "#5bc8ff", "#7cd36b"][i % 4]);
    }
    for (let i = 0; i < 40; i++) dot(c, x + rand() * w, y + rand() * h, rr(1.5, 4), ["#fff", "#ff7ab8", "#ffd34d"][i % 3]);
  } else if (which === 1) {
    // Night town.
    sky("#1d2a6e", "#6b4fa8");
    stars(80, "rgba(255,250,220,0.95)");
    const mx = x + w * rr(0.2, 0.8), my = y + h * 0.15;
    c.save();
    c.shadowColor = "rgba(255,240,180,0.9)";
    c.shadowBlur = u;
    dot(c, mx, my, u * 0.6, "#fff2b8");
    c.restore();
    hills(["#3a2a74", "#2a1f57"]);
    let hx = x - u * 0.2;
    while (hx < x + w) {
      const hw = rr(0.6, 1.1) * u, hh = rr(0.6, 1.4) * u;
      house(c, hx, y + h - hh - h * 0.04, hw, hh, rand);
      hx += hw + rr(0.1, 0.5) * u;
    }
  } else if (which === 2) {
    // Under the sea.
    sky("#8be2ff", "#1c5fa8");
    c.fillStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i < 5; i++) {
      const sx = x + rand() * w;
      c.beginPath();
      c.moveTo(sx, y);
      c.lineTo(sx + u * 0.6, y);
      c.lineTo(sx + u * 1.8, y + h);
      c.lineTo(sx + u * 0.9, y + h);
      c.fill();
    }
    hills(["#e9d39b", "#d9bd7c"]);
    for (let i = 0; i < 10; i++) weed(c, x + rand() * w, y + h, rr(1, 2.5) * u, rand);
    for (let i = 0; i < 9; i++)
      fish(c, x + rand() * w, y + rand() * h * 0.75, rr(0.35, 0.65) * u, ["#ff8a3d", "#ffd23d", "#ff5f8f", "#9b7bff"][i % 4], rand() < 0.5);
    c.strokeStyle = "rgba(255,255,255,0.7)";
    c.lineWidth = 1.2;
    for (let i = 0; i < 30; i++) {
      c.beginPath();
      c.arc(x + rand() * w, y + rand() * h, rr(2, 6), 0, TAU);
      c.stroke();
    }
  } else {
    // Space.
    sky("#2b0f55", "#0b1a3e");
    stars(140, "rgba(255,255,255,0.9)");
    for (let i = 0; i < 4; i++) {
      planet(c, x + rand() * w, y + rand() * h, rr(0.5, 1.1) * u, ["#ff9d5c", "#5cd4ff", "#c38bff", "#7be08a"][i], rand() < 0.5);
    }
    const cx = x + rand() * w * 0.5, cy = y + rand() * h * 0.5;
    const tail = c.createLinearGradient(cx, cy, cx - u * 2, cy - u);
    tail.addColorStop(0, "rgba(255,255,255,0.9)");
    tail.addColorStop(1, "rgba(255,255,255,0)");
    c.strokeStyle = tail;
    c.lineWidth = u * 0.18;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx - u * 2, cy - u);
    c.stroke();
    dot(c, cx, cy, u * 0.12, "#fff");
  }
}

function dot(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = fill;
  c.fill();
}

function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, points: number) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points - Math.PI / 2;
    const d = i % 2 ? r * 0.35 : r;
    c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  c.fill();
}

function cloud(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.fillStyle = "rgba(255,255,255,0.9)";
  for (const [dx, dy, r] of [[0, 0, 0.5], [0.45, -0.15, 0.4], [0.85, 0.05, 0.38], [-0.4, 0.08, 0.35]])
    dot(c, x + dx * s, y + dy * s, r * s, "rgba(255,255,255,0.9)");
}

function lollipop(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  c.fillStyle = "#fff";
  c.fillRect(x - r * 0.07, y, r * 0.14, r * 2.2);
  dot(c, x, y, r, "#fff");
  c.strokeStyle = color;
  c.lineWidth = r * 0.22;
  c.beginPath();
  for (let t = 0; t < 14; t += 0.2) {
    const d = (t / 14) * r * 0.85;
    c.lineTo(x + Math.cos(t) * d, y + Math.sin(t) * d);
  }
  c.stroke();
}

function house(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rand: Rand) {
  c.fillStyle = "#171238";
  c.fillRect(x, y, w, h);
  c.beginPath();
  c.moveTo(x - w * 0.1, y);
  c.lineTo(x + w / 2, y - h * 0.4);
  c.lineTo(x + w * 1.1, y);
  c.fill();
  c.fillStyle = "#ffd65c";
  for (let wy = y + h * 0.15; wy < y + h * 0.75; wy += h * 0.3)
    for (let wx = x + w * 0.15; wx < x + w * 0.8; wx += w * 0.4) if (rand() < 0.7) c.fillRect(wx, wy, w * 0.2, h * 0.16);
}

function weed(c: CanvasRenderingContext2D, x: number, y: number, h: number, rand: Rand) {
  c.strokeStyle = rand() < 0.5 ? "#2fae6a" : "#48c98a";
  c.lineWidth = h * 0.08;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x, y);
  for (let t = 0; t <= 1; t += 0.1) c.lineTo(x + Math.sin(t * 7) * h * 0.1, y - t * h);
  c.stroke();
}

function fish(c: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, flip: boolean) {
  c.save();
  c.translate(x, y);
  if (flip) c.scale(-1, 1);
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(0, 0, s, s * 0.55, 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.moveTo(-s * 0.8, 0);
  c.lineTo(-s * 1.5, -s * 0.5);
  c.lineTo(-s * 1.5, s * 0.5);
  c.fill();
  dot(c, s * 0.5, -s * 0.12, s * 0.14, "#fff");
  dot(c, s * 0.53, -s * 0.12, s * 0.07, "#222");
  c.restore();
}

function planet(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, ring: boolean) {
  const g = c.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, "#fff");
  g.addColorStop(0.25, color);
  g.addColorStop(1, "#1a1030");
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = g;
  c.fill();
  if (ring) {
    c.strokeStyle = "rgba(255,230,180,0.75)";
    c.lineWidth = r * 0.12;
    c.beginPath();
    c.ellipse(x, y, r * 1.7, r * 0.45, -0.35, 0, TAU);
    c.stroke();
  }
}

function rivet(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x + r * 0.15, y + r * 0.25, r, 0, TAU);
  c.fillStyle = "rgba(0,0,0,0.3)";
  c.fill();
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, "#ff9a8f");
  g.addColorStop(0.5, "#e8231f");
  g.addColorStop(1, "#8e0c0a");
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = g;
  c.fill();
}

function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, k: number, align: CanvasTextAlign) {
  c.save();
  c.font = `800 ${Math.max(9, k * 0.26)}px ui-rounded, system-ui, sans-serif`;
  c.textAlign = align;
  c.textBaseline = "middle";
  c.fillStyle = "rgba(0,0,0,0.25)";
  c.fillText(text, x + 1, y + 1);
  c.fillStyle = "rgba(255,255,255,0.92)";
  c.fillText(text, x, y);
  c.restore();
}

function round(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
