import { describe, expect, it } from "vitest";
import {
  bfs, buildLevel, generateMaze, isOpen, levelParams, makeRand, mazeDifficulty, PASS_HOLE_R, PASS_OFFSET, solutionPath,
  wallRects, type Level,
} from "./maze";
import { collideBalls, createWorld, PHYS, step, type Ball } from "./physics";

const key = (c: { x: number; y: number }) => `${c.x},${c.y}`;

describe("maze", () => {
  it("is a perfect maze: every cell reachable, exactly cells-1 openings", () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const m = generateMaze(9, 15, makeRand(seed));
      expect(bfs(m, { x: 0, y: 0 }).order.length).toBe(9 * 15);
      const openings = m.h.flat().filter((w) => !w).length + m.v.flat().filter((w) => !w).length;
      expect(openings).toBe(9 * 15 - 1);
    }
  });

  it("keeps the outer boundary closed", () => {
    const m = generateMaze(6, 10, makeRand(7));
    expect(m.h[0].every(Boolean)).toBe(true);
    expect(m.h[10].every(Boolean)).toBe(true);
    expect(m.v.every((row) => row[0] && row[6])).toBe(true);
  });

  it("finds a connected solution from corner to corner", () => {
    const m = generateMaze(7, 12, makeRand(42));
    const path = solutionPath(m, { x: 0, y: 0 }, { x: 6, y: 11 });
    expect(key(path[0])).toBe("0,0");
    expect(key(path[path.length - 1])).toBe("6,11");
    for (let i = 1; i < path.length; i++) expect(isOpen(m, path[i - 1], path[i])).toBe(true);
  });

  it("merges walls into far fewer rects than segments", () => {
    const m = generateMaze(9, 15, makeRand(5));
    const segments = m.h.flat().filter(Boolean).length + m.v.flat().filter(Boolean).length;
    expect(wallRects(m, 0.14).length).toBeLessThan(segments);
  });
});

describe("levels", () => {
  it("keeps side traps off the route and narrow passes on straight stretches of it", () => {
    for (let level = 1; level <= 20; level++) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const L = buildLevel(level, 1.7, seed);
        const path = solutionPath(L.maze, L.start, L.goal);
        const idx = new Map(path.map((c, i) => [key(c), i]));
        const banned = new Set([...L.spawns.map(key), key(L.goal)]);
        for (const h of L.holes) {
          expect(banned.has(key(h.cell))).toBe(false);
          expect(idx.has(key(h.cell))).toBe(h.onPath);
          if (h.onPath) {
            const i = idx.get(key(h.cell))!;
            const [a, b] = [path[i - 1], path[i + 1]];
            expect(a.x === b.x || a.y === b.y).toBe(true);
          }
        }
        for (const a of L.holes)
          for (const b of L.holes)
            if (a !== b) expect(Math.abs(a.cell.x - b.cell.x) + Math.abs(a.cell.y - b.cell.y)).toBeGreaterThan(1);
        expect(L.spawns.length).toBe(levelParams(level, 1.7).balls);
        expect(key(L.goal)).toBe(`${L.maze.cols - 1},${L.maze.rows - 1}`);
      }
    }
  });

  it("gets harder: bigger mazes, more balls and holes, harder-ranked layouts", () => {
    const p1 = levelParams(1, 1.7), p16 = levelParams(16, 1.7);
    expect(p16.cols).toBeGreaterThan(p1.cols);
    expect(p16.balls).toBeGreaterThan(p1.balls);
    expect(p16.passHoles).toBeGreaterThan(0);
    expect(p1.passHoles).toBe(0);
    // Same size, same seed: the twist knob alone should pick a harder layout.
    const avg = (twistLevel: number) => {
      let sum = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const L = buildLevel(twistLevel, 1.7, seed);
        sum += mazeDifficulty(L.maze, L.start, L.goal) / (L.maze.cols * L.maze.rows);
      }
      return sum / 20;
    };
    expect(avg(16)).toBeGreaterThan(avg(1));
  });

  it("leaves room beside a narrow-pass hole for a ball to squeeze by", () => {
    const wallFace = 0.5 - PHYS.wallThickness / 2;
    expect(PASS_OFFSET + PASS_HOLE_R).toBeLessThanOrEqual(wallFace);
    // Closest the ball's center can get to the far wall vs. the edge of the hole's pull.
    const farthest = wallFace - PHYS.ballRadius;
    expect(PASS_OFFSET + farthest).toBeGreaterThan(PASS_HOLE_R + 0.05);
  });

  it("is deterministic for a seed", () => {
    expect(buildLevel(6, 1.6, 77)).toEqual(buildLevel(6, 1.6, 77));
  });
});

/** A single closed cell with one ball in it, far from any hole or goal. */
function boxWorld(): ReturnType<typeof createWorld> {
  const maze = generateMaze(3, 3, makeRand(1));
  for (const row of maze.h) row.fill(true);
  for (const row of maze.v) row.fill(true);
  const level: Level = { number: 1, seed: 1, maze, start: { x: 0, y: 0 }, goal: { x: 2, y: 2 }, holes: [], spawns: [{ x: 1, y: 1 }] };
  return createWorld(level);
}

const run = (w: ReturnType<typeof createWorld>, gx: number, gy: number, secs: number) => {
  const all = [];
  for (let t = 0; t < secs; t += 1 / 60) all.push(...step(w, gx, gy, 1 / 60));
  return all;
};

describe("physics", () => {
  it("rolls downhill and comes to rest against the wall", () => {
    const w = boxWorld();
    const events = run(w, 0, 0.4, 3);
    const b = w.balls[0];
    expect(b.y).toBeCloseTo(2 - PHYS.wallThickness / 2 - PHYS.ballRadius, 2);
    expect(Math.abs(b.vy)).toBeLessThan(0.05);
    expect(events.some((e) => e.type === "wall")).toBe(true);
  });

  it("stays put on a level board", () => {
    const w = boxWorld();
    run(w, 0, 0, 1);
    expect(w.balls[0].x).toBeCloseTo(1.5, 6);
    expect(w.balls[0].y).toBeCloseTo(1.5, 6);
  });

  it("never tunnels through a wall at top speed", () => {
    const w = boxWorld();
    w.balls[0].vx = 100;
    run(w, 1, 0, 2);
    w.balls[0].vx = -100;
    run(w, -1, 0, 2);
    expect(w.balls[0].x).toBeGreaterThan(1);
    expect(w.balls[0].x).toBeLessThan(2);
  });

  it("separates overlapping balls and swaps velocity on a head-on hit", () => {
    const mk = (x: number, vx: number): Ball => ({ id: 0, x, y: 0, vx, vy: 0, state: "roll", t: 0, tx: 0, ty: 0, homeIndex: -1 });
    const a = mk(0, 3);
    const b = mk(0.5, -3);
    expect(collideBalls(a, b, 0.27)).toBeCloseTo(6);
    expect(b.x - a.x).toBeCloseTo(0.54);
    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
  });

  it("drops into a hole, then respawns at the start", () => {
    const w = boxWorld();
    w.level.holes = [{ cell: { x: 1, y: 1 }, x: 1.5, y: 1.5, r: 0.34, onPath: false }];
    w.balls[0].x = 1.6;
    const events = run(w, 0, 0, 1);
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(["fall", "respawn"]));
    expect(w.balls[0].state).toBe("roll");
    expect(w.balls[0].x).toBeCloseTo(0.5);
  });

  it("captures balls in the goal and counts them", () => {
    const w = boxWorld();
    w.level.goal = { x: 1, y: 1 };
    const events = run(w, 0, 0, 0.2);
    expect(events).toContainEqual({ type: "home", id: 0, count: 1 });
    expect(w.homeCount).toBe(1);
  });

  it("lets a careful ball roll past a narrow pass, but a careless one falls in", () => {
    const corridor = (y: number) => {
      const maze = generateMaze(5, 1, makeRand(1)); // a single straight corridor
      const level: Level = {
        number: 1, seed: 1, maze, start: { x: 0, y: 0 }, goal: { x: 4, y: 0 }, spawns: [{ x: 0, y: 0 }],
        holes: [{ cell: { x: 2, y: 0 }, x: 2.5, y: 0.5 + PASS_OFFSET, r: PASS_HOLE_R, onPath: true }],
      };
      const w = createWorld(level);
      w.balls[0].y = y;
      return w;
    };
    const careful = corridor(0.3);
    const ev1 = run(careful, 0.3, -0.05, 4); // hug the far wall
    expect(ev1.some((e) => e.type === "fall")).toBe(false);
    expect(careful.homeCount).toBe(1);

    const careless = corridor(0.5);
    const ev2 = run(careless, 0.3, 0.02, 4);
    expect(ev2.some((e) => e.type === "fall")).toBe(true);
  });
});
