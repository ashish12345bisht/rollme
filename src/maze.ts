// Pure maze + level generation. Units: 1 cell = 1.0 world unit.

export interface Cell {
  x: number;
  y: number;
}

export interface Maze {
  cols: number;
  rows: number;
  /** h[y][x]: wall on the top edge of cell (x, y). y runs 0..rows (rows + 1 lines). */
  h: boolean[][];
  /** v[y][x]: wall on the left edge of cell (x, y). x runs 0..cols (cols + 1 lines). */
  v: boolean[][];
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Level {
  number: number;
  seed: number;
  maze: Maze;
  start: Cell;
  goal: Cell;
  holes: Hole[];
  spawns: Cell[];
}

export interface Hole {
  /** Cell the hole sits in. */
  cell: Cell;
  /** Center in world units. */
  x: number;
  y: number;
  r: number;
  /** On the solution path: a "narrow pass" you must steer around. */
  onPath: boolean;
}

/** Trap hole in the middle of a side branch. */
export const SIDE_HOLE_R = 0.34;
/** Narrow-pass hole on the route, pushed toward one wall so a careful ball can squeeze by. */
export const PASS_HOLE_R = 0.24;
export const PASS_OFFSET = 0.17;

export type Rand = () => number;

/** Small deterministic PRNG (mulberry32). */
export function makeRand(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRS: Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** Perfect maze (exactly one path between any two cells) via iterative backtracking. */
export function generateMaze(cols: number, rows: number, rand: Rand): Maze {
  const h = Array.from({ length: rows + 1 }, () => Array<boolean>(cols).fill(true));
  const v = Array.from({ length: rows }, () => Array<boolean>(cols + 1).fill(true));
  const maze: Maze = { cols, rows, h, v };
  const seen = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const stack: Cell[] = [{ x: 0, y: 0 }];
  seen[0][0] = true;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = DIRS.map((d) => ({ x: cur.x + d.x, y: cur.y + d.y })).filter(
      (n) => n.x >= 0 && n.y >= 0 && n.x < cols && n.y < rows && !seen[n.y][n.x],
    );
    if (!options.length) {
      stack.pop();
      continue;
    }
    const next = options[Math.floor(rand() * options.length)];
    setWall(maze, cur, next, false);
    seen[next.y][next.x] = true;
    stack.push(next);
  }
  return maze;
}

function setWall(m: Maze, a: Cell, b: Cell, on: boolean) {
  if (b.x === a.x + 1) m.v[a.y][a.x + 1] = on;
  else if (b.x === a.x - 1) m.v[a.y][a.x] = on;
  else if (b.y === a.y + 1) m.h[a.y + 1][a.x] = on;
  else if (b.y === a.y - 1) m.h[a.y][a.x] = on;
}

export function isOpen(m: Maze, a: Cell, b: Cell): boolean {
  if (b.x < 0 || b.y < 0 || b.x >= m.cols || b.y >= m.rows) return false;
  if (b.x === a.x + 1 && b.y === a.y) return !m.v[a.y][a.x + 1];
  if (b.x === a.x - 1 && b.y === a.y) return !m.v[a.y][a.x];
  if (b.y === a.y + 1 && b.x === a.x) return !m.h[a.y + 1][a.x];
  if (b.y === a.y - 1 && b.x === a.x) return !m.h[a.y][a.x];
  return false;
}

export function openNeighbors(m: Maze, c: Cell): Cell[] {
  return DIRS.map((d) => ({ x: c.x + d.x, y: c.y + d.y })).filter((n) => isOpen(m, c, n));
}

/** Breadth-first walk from `start`: visit order plus parent links. */
export function bfs(m: Maze, start: Cell) {
  const prev: (Cell | null)[][] = Array.from({ length: m.rows }, () => Array<Cell | null>(m.cols).fill(null));
  const dist: number[][] = Array.from({ length: m.rows }, () => Array<number>(m.cols).fill(-1));
  const order: Cell[] = [start];
  dist[start.y][start.x] = 0;
  for (let i = 0; i < order.length; i++) {
    const c = order[i];
    for (const n of openNeighbors(m, c)) {
      if (dist[n.y][n.x] !== -1) continue;
      dist[n.y][n.x] = dist[c.y][c.x] + 1;
      prev[n.y][n.x] = c;
      order.push(n);
    }
  }
  return { order, prev, dist };
}

export function solutionPath(m: Maze, start: Cell, goal: Cell): Cell[] {
  const { prev, dist } = bfs(m, start);
  if (dist[goal.y][goal.x] === -1) return [];
  const path: Cell[] = [];
  for (let c: Cell | null = goal; c; c = prev[c.y][c.x]) path.push(c);
  return path.reverse();
}

/** Merge wall segments into as few axis-aligned rectangles as possible (no seams for balls to snag on). */
export function wallRects(m: Maze, thickness: number): Rect[] {
  const half = thickness / 2;
  const rects: Rect[] = [];
  for (let y = 0; y <= m.rows; y++) {
    let x = 0;
    while (x < m.cols) {
      if (!m.h[y][x]) {
        x++;
        continue;
      }
      const s = x;
      while (x < m.cols && m.h[y][x]) x++;
      rects.push({ x0: s - half, y0: y - half, x1: x + half, y1: y + half });
    }
  }
  for (let x = 0; x <= m.cols; x++) {
    let y = 0;
    while (y < m.rows) {
      if (!m.v[y][x]) {
        y++;
        continue;
      }
      const s = y;
      while (y < m.rows && m.v[y][x]) y++;
      rects.push({ x0: x - half, y0: s - half, x1: x + half, y1: y + half });
    }
  }
  return rects;
}

export interface LevelParams {
  cols: number;
  rows: number;
  balls: number;
  /** Trap holes in side branches. */
  sideHoles: number;
  /** Narrow-pass holes on the route itself. */
  passHoles: number;
  /** 0..1: how hard a maze to pick among the generated candidates. */
  twist: number;
}

export const MAX_COLS = 11;
const CANDIDATES = 12;

/**
 * Difficulty curve. Levels are endless; everything ramps up until about level 16, after which
 * each level is a fresh maze at full difficulty. `aspect` = available height / width.
 */
export function levelParams(level: number, aspect: number): LevelParams {
  const cols = Math.min(5 + Math.floor((level - 1) / 2), MAX_COLS);
  const rows = Math.max(cols, Math.min(cols * 2, Math.round(cols * aspect)));
  const balls = Math.min(2 + Math.floor((level - 1) / 2), 6);
  // Holes stay few; the challenge comes from the maze itself.
  const sideHoles = Math.min(1 + Math.floor((level - 1) / 3), 4);
  const passHoles = level < 6 ? 0 : Math.min(1 + Math.floor((level - 6) / 4), 3);
  const twist = Math.min(1, (level - 1) / 15);
  return { cols, rows, balls, sideHoles, passHoles, twist };
}

/**
 * How hard a maze is to roll through: a long route, many forks where a ball can go the wrong way,
 * and many turns (each turn means re-tilting the phone).
 */
export function mazeDifficulty(m: Maze, start: Cell, goal: Cell): number {
  const path = solutionPath(m, start, goal);
  let forks = 0;
  let turns = 0;
  for (let i = 1; i < path.length - 1; i++) {
    if (openNeighbors(m, path[i]).length > 2) forks++;
    const a = path[i - 1], b = path[i + 1];
    if (a.x !== b.x && a.y !== b.y) turns++;
  }
  return path.length + 2 * forks + 0.5 * turns;
}

const key = (c: Cell) => `${c.x},${c.y}`;
const adjacent = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;

function shuffle<T>(arr: T[], rand: Rand): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildLevel(level: number, aspect: number, seed: number): Level {
  const p = levelParams(level, aspect);
  const rand = makeRand(seed);
  const start = { x: 0, y: 0 };
  const goal = { x: p.cols - 1, y: p.rows - 1 };

  // Generate several mazes and rank them by difficulty; later levels pick the harder ones.
  const ranked = Array.from({ length: CANDIDATES }, () => generateMaze(p.cols, p.rows, rand))
    .map((m) => ({ m, score: mazeDifficulty(m, start, goal) }))
    .sort((a, b) => a.score - b.score);
  const maze = ranked[Math.round(p.twist * (CANDIDATES - 1))].m;

  const { order, dist } = bfs(maze, start);
  const spawns = order.slice(0, p.balls);
  const path = solutionPath(maze, start, goal);
  const onPath = new Set(path.map(key));
  const reserved = new Set([...spawns.map(key), key(goal)]);
  const holes: Hole[] = [];
  const free = (c: Cell) => !holes.some((h) => adjacent(h.cell, c));

  // Narrow passes: straight stretches of the route, away from start and goal.
  const straights: { c: Cell; horizontal: boolean }[] = [];
  for (let i = 3; i < path.length - 3; i++) {
    const a = path[i - 1], c = path[i], b = path[i + 1];
    if (reserved.has(key(c))) continue;
    if (a.y === b.y) straights.push({ c, horizontal: true });
    else if (a.x === b.x) straights.push({ c, horizontal: false });
  }
  for (const { c, horizontal } of shuffle(straights, rand)) {
    if (holes.filter((h) => h.onPath).length >= p.passHoles) break;
    if (!free(c)) continue;
    const side = rand() < 0.5 ? -1 : 1;
    holes.push({
      cell: c,
      x: c.x + 0.5 + (horizontal ? 0 : side * PASS_OFFSET),
      y: c.y + 0.5 + (horizontal ? side * PASS_OFFSET : 0),
      r: PASS_HOLE_R,
      onPath: true,
    });
  }

  // Side traps: off the route (always avoidable), preferring branches right next to it.
  const nearPath = (c: Cell) => openNeighbors(maze, c).some((n) => onPath.has(key(n)));
  const sides = shuffle(
    order.filter((c) => !onPath.has(key(c)) && !reserved.has(key(c)) && dist[c.y][c.x] >= 2),
    rand,
  ).sort((a, b) => Number(nearPath(b)) - Number(nearPath(a)));
  let placed = 0;
  for (const c of sides) {
    if (placed >= p.sideHoles) break;
    if (!free(c)) continue;
    holes.push({ cell: c, x: c.x + 0.5, y: c.y + 0.5, r: SIDE_HOLE_R, onPath: false });
    placed++;
  }
  return { number: level, seed, maze, start, goal, holes, spawns };
}
