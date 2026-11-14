// Pure physics: steel balls rolling on a tilted board. World units are maze cells.

import { wallRects, type Level, type Rect } from "./maze";

export const PHYS = {
  /** Acceleration (cells/s²) when the board is tilted straight up (sin = 1). */
  gravity: 28,
  /** Rolling resistance (cells/s²): a nearly-level board lets balls settle. */
  rollFriction: 0.45,
  /** Linear drag per second. */
  drag: 0.35,
  maxSpeed: 14,
  wallBounce: 0.38,
  ballBounce: 0.85,
  /** Below this impact speed collisions are fully inelastic (no jitter at rest). */
  bounceMin: 0.6,
  /** Impacts quieter than this produce no sound event. */
  soundMin: 0.45,
  wallThickness: 0.14,
  ballRadius: 0.22,
  goalRadius: 0.4,
  /** Pull towards a hole's center once a ball is over its lip (the board dips there). */
  holePull: 12,
  fallTime: 0.45,
};

export type BallState = "roll" | "fall" | "wait" | "home";

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: BallState;
  /** Animation clock for fall / home. */
  t: number;
  /** Where the ball is falling into (hole or goal center). */
  tx: number;
  ty: number;
  homeIndex: number;
}

export interface World {
  level: Level;
  rects: Rect[];
  balls: Ball[];
  homeCount: number;
}

export type PhysEvent =
  | { type: "wall"; id: number; speed: number }
  | { type: "ball"; a: number; b: number; speed: number }
  | { type: "fall"; id: number }
  | { type: "respawn"; id: number }
  | { type: "home"; id: number; count: number };

const center = (c: { x: number; y: number }) => ({ x: c.x + 0.5, y: c.y + 0.5 });

export function createWorld(level: Level): World {
  const balls = level.spawns.map((c, id) => {
    const p = center(c);
    return { id, x: p.x, y: p.y, vx: 0, vy: 0, state: "roll" as BallState, t: 0, tx: 0, ty: 0, homeIndex: -1 };
  });
  return { level, rects: wallRects(level.maze, PHYS.wallThickness), balls, homeCount: 0 };
}

export const allHome = (w: World) => w.homeCount === w.balls.length;
export const speedOf = (b: Ball) => Math.hypot(b.vx, b.vy);

/** Advance the world. (gx, gy) is the tilt vector in screen space, each component in [-1, 1]. */
export function step(w: World, gx: number, gy: number, dt: number): PhysEvent[] {
  dt = Math.min(dt, 1 / 30);
  const events: PhysEvent[] = [];
  const r = PHYS.ballRadius;

  for (const b of w.balls) {
    if (b.state === "fall") {
      b.t += dt;
      if (b.t >= PHYS.fallTime) b.state = "wait";
    } else if (b.state === "home") {
      b.t += dt;
    }
  }
  // Respawn waiting balls once the start cell is clear.
  const s = center(w.level.start);
  for (const b of w.balls) {
    if (b.state !== "wait") continue;
    const blocked = w.balls.some((o) => o.state === "roll" && Math.hypot(o.x - s.x, o.y - s.y) < 2 * r + 0.02);
    if (blocked) continue;
    Object.assign(b, { x: s.x, y: s.y, vx: 0, vy: 0, state: "roll", t: 0 });
    events.push({ type: "respawn", id: b.id });
  }

  const rolling = w.balls.filter((b) => b.state === "roll");
  const maxV = rolling.reduce((m, b) => Math.max(m, speedOf(b)), 0) + PHYS.gravity * dt;
  const subs = Math.max(2, Math.ceil((Math.min(maxV, PHYS.maxSpeed) * dt) / (r * 0.35)));
  const h = dt / subs;

  const wallHit = new Map<number, number>();
  const ballHit = new Map<string, number>();
  const holes = w.level.holes;
  const goal = center(w.level.goal);

  for (let i = 0; i < subs; i++) {
    for (const b of rolling) {
      if (b.state !== "roll") continue;
      let ax = gx * PHYS.gravity;
      let ay = gy * PHYS.gravity;

      if (sink(b, goal, PHYS.goalRadius)) {
        b.state = "home";
        b.homeIndex = w.homeCount++;
        events.push({ type: "home", id: b.id, count: w.homeCount });
        continue;
      }
      let fell = false;
      for (const hc of holes) {
        if (sink(b, hc, hc.r)) {
          b.state = "fall";
          events.push({ type: "fall", id: b.id });
          fell = true;
          break;
        }
        const pull = lip(b, hc, hc.r);
        ax += pull.x;
        ay += pull.y;
      }
      if (fell) continue;
      const gp = lip(b, goal, PHYS.goalRadius);
      ax += gp.x;
      ay += gp.y;

      b.vx += ax * h;
      b.vy += ay * h;
      const sp = speedOf(b);
      if (sp > 0) {
        const next = Math.min(PHYS.maxSpeed, Math.max(0, sp - PHYS.rollFriction * h) * (1 - PHYS.drag * h));
        b.vx *= next / sp;
        b.vy *= next / sp;
      }
      b.x += b.vx * h;
      b.y += b.vy * h;
    }

    const live = rolling.filter((b) => b.state === "roll");
    for (let a = 0; a < live.length; a++) {
      for (let c = a + 1; c < live.length; c++) {
        const hit = collideBalls(live[a], live[c], r);
        if (hit > 0) {
          const k = `${live[a].id}-${live[c].id}`;
          ballHit.set(k, Math.max(ballHit.get(k) ?? 0, hit));
        }
      }
    }
    for (const b of live) {
      for (const rect of w.rects) {
        const hit = collideRect(b, rect, r);
        if (hit > 0) wallHit.set(b.id, Math.max(wallHit.get(b.id) ?? 0, hit));
      }
    }
  }

  for (const [id, speed] of wallHit) if (speed >= PHYS.soundMin) events.push({ type: "wall", id, speed });
  for (const [k, speed] of ballHit) {
    if (speed < PHYS.soundMin) continue;
    const [a, b] = k.split("-").map(Number);
    events.push({ type: "ball", a, b, speed });
  }
  return events;
}

/** Ball center is deep enough over the opening to drop in. */
function sink(b: Ball, c: { x: number; y: number }, radius: number): boolean {
  if (Math.hypot(b.x - c.x, b.y - c.y) >= radius * 0.55) return false;
  b.tx = c.x;
  b.ty = c.y;
  b.t = 0;
  return true;
}

function lip(b: Ball, c: { x: number; y: number }, radius: number) {
  const dx = c.x - b.x;
  const dy = c.y - b.y;
  const d = Math.hypot(dx, dy);
  if (d >= radius || d < 1e-6) return { x: 0, y: 0 };
  return { x: (dx / d) * PHYS.holePull, y: (dy / d) * PHYS.holePull };
}

/** Returns the normal impact speed (0 if no contact). */
export function collideRect(b: Ball, R: Rect, r: number): number {
  const qx = Math.max(R.x0, Math.min(b.x, R.x1));
  const qy = Math.max(R.y0, Math.min(b.y, R.y1));
  const dx = b.x - qx;
  const dy = b.y - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return 0;
  let nx: number, ny: number, pen: number;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    nx = dx / d;
    ny = dy / d;
    pen = r - d;
  } else {
    // Center inside the wall: leave by the nearest face.
    const l = b.x - R.x0, rt = R.x1 - b.x, t = b.y - R.y0, bt = R.y1 - b.y;
    const m = Math.min(l, rt, t, bt);
    if (m === l) [nx, ny, pen] = [-1, 0, l + r];
    else if (m === rt) [nx, ny, pen] = [1, 0, rt + r];
    else if (m === t) [nx, ny, pen] = [0, -1, t + r];
    else [nx, ny, pen] = [0, 1, bt + r];
  }
  b.x += nx * pen;
  b.y += ny * pen;
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return 0;
  const e = -vn > PHYS.bounceMin ? PHYS.wallBounce : 0;
  b.vx -= (1 + e) * vn * nx;
  b.vy -= (1 + e) * vn * ny;
  return -vn;
}

export function collideBalls(a: Ball, b: Ball, r: number): number {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let d2 = dx * dx + dy * dy;
  const min = 2 * r;
  if (d2 >= min * min) return 0;
  if (d2 < 1e-12) {
    dx = 1e-3;
    dy = 0;
    d2 = 1e-6;
  }
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const pen = (min - d) / 2;
  a.x -= nx * pen;
  a.y -= ny * pen;
  b.x += nx * pen;
  b.y += ny * pen;
  const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rv >= 0) return 0;
  const e = -rv > PHYS.bounceMin ? PHYS.ballBounce : 0;
  const j = (-(1 + e) * rv) / 2;
  a.vx -= j * nx;
  a.vy -= j * ny;
  b.vx += j * nx;
  b.vy += j * ny;
  return -rv;
}
