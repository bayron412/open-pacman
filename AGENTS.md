# AGENTS.md — open-pacman

Vanilla JS/HTML/CSS Pac-Man clone. Learning project for spec-driven development. No build system, no package.json, no tests, no lint/typecheck — do not invent or run such commands.

## Run / verify

Open `src/index.html` directly in a browser, or serve the root (`python3 -m http.server`) and open `/src/index.html`. Manual play is the only verification.

## Architecture (src/)

No modules — plain `<script>` tags in `src/index.html`, sharing globals. **Load order matters and is fixed**: `maze.js` → `game.js` → `render.js` → `main.js`.

- `maze.js` — 28x31 maze as 31 strings, parsed to numeric `MAZE`. Also exports (via `window.*`) `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`.
- `game.js` — state and rules: `createGame()` / `update()`. Depends on maze.js globals.
- `render.js` — canvas drawing: `draw(ctx, game, frame)`. `TILE = 20`, canvas 560x620.
- `main.js` — game loop, keyboard, overlay screens.

Key invariants:
- `MAZE` is pristine and never mutated; each game copies it to `game.grid`. Eat dots / mutate only `game.grid`.
- Tile encoding: `#`=1 wall, `.`=2 dot, ` `=0 empty, `-`=3 pen door.
- Walls (1) and the pen door (3) block every actor (`isWall` in game.js). Only the scripted pen exit (`exitPen` in game.js) crosses the door.
- Row 14 is the tunnel: actors wrap horizontally at the edges.
- Maze is symmetric about the vertical axis between columns 13 and 14 — keep it that way when editing.

## Conventions

- Code comments and UI text are in **Spanish** — match that.
- Style: spaces inside parens (e.g. `foo( x )`), matching existing files.

## Spec-driven workflow (this repo's purpose)

Two custom commands live in `.agents/skills/` (installed via `skills-lock.json`):

- `/spec <description>` — guided spec authoring. Specs are saved as `specs/NN-slug.md` (zero-padded, sequential). Phase 2 (clarifying questions) is mandatory; never write code during `/spec`.
- `/spec-impl <NN-slug>` — implements an **Approved** spec only (any language's word for approved). Creates branch `spec-NN-slug`, implements step by step with pauses for diff review. **Never auto-commit** — the user commits.
- `specs/.spec-config.yml` (`AutoCreateBranch`) controls branch creation; default `true` if missing.

New features go through a spec first; ask before improvising outside an approved spec.
