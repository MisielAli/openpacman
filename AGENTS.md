# Repository Guide

## Structure

- `src/index.html` is the application entrypoint. Serve `src/` as static files; there is no build step or package-managed tooling.
- Scripts are classic globals and must stay ordered: `maze.js` defines maze globals, `game.js` defines `createGame`/`update`/`DIRS`, `render.js` defines `draw`, and `main.js` wires input and the animation loop.
- `maze.js` owns the immutable numeric maze template. `createGame()` copies it into `game.grid`; mutate only `game.grid` while playing so restart works.
- The maze is 28 x 31 tiles and `render.js` uses `TILE = 20`; keep the canvas dimensions (`560 x 620`) and maze dimensions aligned when changing either.
- Tile values are part of the game contract: `0` walkable empty, `1` wall, `2` dot, `3` ghost-pen door. Pac-Man cannot cross doors; ghosts can.

## Skills

- For a substantial new feature, invoke the repo-local `/spec` skill (`.agents/skills/spec/SKILL.md`) first. It gathers requirements and writes a draft to `specs/`; it must not change application code.
- Implement an approved spec with `/spec-impl <NN-slug>` (`.agents/skills/spec-impl/SKILL.md`). It requires an `Approved`/`Aprobado` status, manages the `spec-NN-slug` branch according to `specs/.spec-config.yml`, and pauses after every implementation step for diff review.

## Verification

- No automated checks are configured. For gameplay changes, open `src/index.html` through a static server and manually verify keyboard movement, tunnel wrapping, dot completion, collision/life reset, and restart.
