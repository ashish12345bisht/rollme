import "./style.css";
import { Sfx } from "./audio";
import { Tilt } from "./input";
import { buildLevel, levelParams } from "./maze";
import { allHome, createWorld, speedOf, step, type PhysEvent, type World } from "./physics";
import { Renderer } from "./render";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const store = {
  get(k: string, d: string) {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

const stage = $("stage");
const renderer = new Renderer($<HTMLCanvasElement>("board"));
const sfx = new Sfx();
const tilt = new Tilt();

let level = Math.max(1, parseInt(store.get("rollme:level", "1"), 10) || 1);
let seed = 0;
let world: World;
let playing = false;
let won = false;

sfx.muted = store.get("rollme:muted", "0") === "1";
$("mute").classList.toggle("off", sfx.muted);

function aspect() {
  const r = stage.getBoundingClientRect();
  return r.height / Math.max(1, r.width);
}

function startLevel(fresh: boolean) {
  if (fresh) seed = (Math.random() * 2 ** 32) >>> 0;
  world = createWorld(buildLevel(level, aspect(), seed));
  renderer.setWorld(world);
  won = false;
  sfx.silenceRolls();
  hud();
}

function hud() {
  $("lvl").textContent = String(level);
  const tray = $("tray");
  const n = world.balls.length;
  if (tray.children.length !== n) tray.innerHTML = "<i></i>".repeat(n);
  [...tray.children].forEach((el, i) => el.classList.toggle("on", i < world.homeCount));
}

function nextHint(done: number) {
  const a = levelParams(done, aspect());
  const b = levelParams(done + 1, aspect());
  const bits: string[] = [];
  if (b.balls > a.balls) bits.push("one more ball");
  if (b.cols > a.cols) bits.push("a bigger maze");
  if (b.passHoles > a.passHoles) bits.push(a.passHoles ? "another narrow pass" : "narrow passes: holes on the route you must steer around");
  else if (b.sideHoles > a.sideHoles) bits.push("more traps");
  return bits.length ? `Next: ${bits.join(", ")}.` : "Next: a fresh, twistier maze.";
}

let lastBuzz = 0;
function buzz(pattern: number | number[]) {
  const now = performance.now();
  if (now - lastBuzz < 70 || !navigator.vibrate) return;
  lastBuzz = now;
  navigator.vibrate(pattern);
}

function handle(events: PhysEvent[]) {
  for (const e of events) {
    switch (e.type) {
      case "wall":
        sfx.wallHit(e.speed);
        if (e.speed > 2.5) buzz(Math.min(30, Math.round(e.speed * 3)));
        break;
      case "ball":
        sfx.ballHit(e.speed);
        if (e.speed > 2.5) buzz(12);
        break;
      case "fall":
        sfx.fall();
        buzz([10, 60, 25, 120, 45]);
        break;
      case "respawn":
        sfx.respawn();
        break;
      case "home":
        sfx.home(e.count);
        buzz(25);
        hud();
        break;
    }
  }
  if (!won && allHome(world)) {
    won = true;
    const done = level;
    level++;
    store.set("rollme:level", String(level));
    setTimeout(() => sfx.win(), 450);
    setTimeout(() => {
      $("win-title").textContent = `Level ${done} complete`;
      $("win-sub").textContent = nextHint(done);
      $("win").classList.remove("hidden");
    }, 1200);
  }
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (playing && !won) {
    const g = tilt.get(dt);
    handle(step(world, g.x, g.y, dt));
    world.balls.forEach((b, i) => sfx.setRoll(i, b.state === "roll" ? speedOf(b) : 0));
  }
  renderer.draw();
  requestAnimationFrame(frame);
}

let toastTimer = 0;
function toast(msg: string, ms = 3500) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.add("hidden"), ms);
}

// Keep the screen awake: you're tilting, not touching.
let wake: { release(): Promise<void> } | null = null;
async function keepAwake() {
  try {
    wake = await (navigator as unknown as { wakeLock?: { request(t: string): Promise<typeof wake> } }).wakeLock?.request("screen") ?? null;
  } catch {
    /* not supported / denied */
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && playing) keepAwake();
  if (document.visibilityState === "hidden") sfx.silenceRolls();
});

$("start").addEventListener("click", async () => {
  sfx.unlock();
  const res = await tilt.start();
  $("intro").classList.add("hidden");
  playing = true;
  keepAwake();
  if (res === "denied") toast("Motion access was denied — reload and allow it to play by tilting.", 6000);
  setTimeout(() => {
    if (!tilt.sensor) toast("No tilt sensor found — use the arrow keys or WASD.", 5000);
  }, 1200);
});

$("next").addEventListener("click", () => {
  $("win").classList.add("hidden");
  startLevel(true);
});
$("restart").addEventListener("click", () => startLevel(false));
$("calib").addEventListener("click", () => {
  tilt.calibrate();
  toast("Tilt recentered — this angle is now level.", 1800);
});
$("mute").addEventListener("click", () => {
  sfx.unlock();
  sfx.setMuted(!sfx.muted);
  if (sfx.muted) sfx.silenceRolls();
  store.set("rollme:muted", sfx.muted ? "1" : "0");
  $("mute").classList.toggle("off", sfx.muted);
});

new ResizeObserver(() => renderer.resize()).observe(stage);
renderer.resize();
startLevel(true);
requestAnimationFrame(frame);
