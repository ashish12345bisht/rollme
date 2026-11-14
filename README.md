# RollMe

A wooden tilt maze for your phone. Tilt to roll steel balls through the maze, avoid the holes,
and get every ball into the golden goal. Levels are endless and generated randomly, and the
mazes get trickier as you go.

The physics and sound are written from scratch, with no game engine and no audio files. The
rolling steel, clinks, hole drops and goal chimes are all synthesized with the Web Audio API.
Built with TypeScript, Vite and canvas.

## Run

```bash
npm install
npm run dev      # desktop: play with arrow keys / WASD
npm run phone    # HTTPS on your LAN, so a phone's tilt sensor works
npm test         # maze + physics unit tests
npm run build
```

Browsers only expose motion sensors to secure (HTTPS) pages, which is why `npm run phone` serves
with a self-signed certificate. Accept the warning on the phone, then tap Start.

## How levels work

Each level generates 12 perfect mazes using randomized depth-first search, scores them (route
length, forks, turns), and picks a harder one as levels go up. Holes are kept off the route, or
on it only as narrow passes with room to squeeze by, so every level is solvable. The code is in
`src/maze.ts`, with the physics in `src/physics.ts`.
