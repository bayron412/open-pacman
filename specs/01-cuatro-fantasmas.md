# SPEC 01 — Cuatro fantasmas con personalidad clásica

> **Estado:** Implementado
> **Depende de:** Ninguna
> **Fecha:** 2026-08-30
> **Objetivo:** Cuatro fantasmas (blinky, pinky, inky, clyde) con los comportamientos clásicos del arcade, salida escalonada de la pen y colores propios.

## Alcance

**Dentro:**

- Cuatro fantasmas con `kind`: `blinky`, `pinky`, `inky`, `clyde` (`GHOST_STARTS` en `src/js/maze.js`).
- Comportamientos clásicos en `decideGhost` (`src/js/game.js`):
  - blinky: target = celda de Pac-Man (persigue directo).
  - pinky: target = 4 celdas delante de la dirección de Pac-Man.
  - inky: pivote = Pac-Man + 2·dirección; target = 2·pivote − blinky.
  - clyde: a >8 celdas Manhattan persigue a Pac-Man; a ≤8 apunta a su esquina.
- Salida escalonada de la pen por temporizador: blinky arranca fuera; pinky, inky y clyde salen a ~2 s, ~6 s y ~12 s.
- Colores por kind en `src/js/render.js` (rojo, rosa, cian, naranja).
- Reinicio de posiciones y temporizadores al perder una vida (`resetPositions`).

**Fuera de alcance (para specs futuros):**

- Modo scatter/chase alternado.
- Power pellets y modo asustado (fantasmas comestibles).
- Velocidades distintas por fantasma (incluido Cruise Elroy).
- Salida de la pen por contador de dots (usamos temporizador).

## Modelo de datos

```js
// maze.js — GHOST_STARTS (orden fijo: 0=blinky … 3=clyde)
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'blinky' }, // fuera de la pen, sobre la puerta
  { x: 13, y: 14, kind: 'pinky' },
  { x: 11, y: 14, kind: 'inky' },
  { x: 15, y: 14, kind: 'clyde' },
];

// game.js — reglas nuevas
const GHOST_EXIT_DELAY = { pinky: 120, inky: 360, clyde: 720 }; // frames a 60 fps
const CLYDE_CORNER = { x: 0, y: 30 };

// cada fantasma en game.ghosts[i] gana:
{ x, y, dir, speed, kind, pen: true|false, exitAt: <frame> }

// game gana: frames (contador que update() incrementa; exitAt es absoluto)
```

Convenciones: coordenadas en celdas, origen arriba-izquierda (ya existentes). Distancias Manhattan. Los targets pueden caer fuera del tablero o en paredes: son solo referencia de distancia, nunca se visitan.

## Plan de implementación

1. **Arranques y colores.** `maze.js`: `GHOST_STARTS` ×4. `render.js`: reordenar `GHOST_COLORS` al orden de kinds. `game.js`: renombrar rama `'hunter'` → `'blinky'` (los otros 3 caen en rama random por ahora). Manual: 4 fantasmas visibles, blinky caza.
2. **Estado de pen.** `game.js`: `game.frames = 0` en `createGame`; cada fantasma gana `pen`/`exitAt`; blinky `pen = false`. Si `pen` y `frames < exitAt`, el fantasma no se mueve. Manual: 3 quietos en la pen, blinky caza.
3. **Salida guionizada.** `game.js`: si `pen` y `frames ≥ exitAt`, alinear `x` a 13, luego subir hasta `(13,11)`; al llegar `pen = false`, `dir = 'left'`. El script no usa `canMove`. Manual: salen en orden ~2 s / ~6 s / ~12 s, sin amontonarse.
4. **Puerta.** `game.js`: `isWall` trata la puerta (3) como muro también para fantasmas. Solo el script de salida la cruza. Manual: ningún fantasma activo re-entra a la pen.
5. **Personalidades.** `game.js`: `decideGhost` con las 4 fórmulas (blinky directo; pinky 4 delante; inky 2·pivote − blinky; clyde tímido con `CLYDE_CORNER`). Borrar rama random. Manual: clyde huye a su esquina al acercarte; pinky corta el paso.
6. **Reset.** `game.js`: `resetPositions` reasigna `pen`/`exitAt` relativos a `game.frames`. Manual: morir con los 4 fuera → vuelven a la pen y escalonan de nuevo.

## Criterios de aceptación

- [ ] Al arrancar se ven 4 fantasmas: blinky rojo en (13,11) y pinky rosa, inky cian, clyde naranja dentro de la pen.
- [ ] pinky, inky y clyde salen en orden ~2 s, ~6 s y ~12 s tras iniciar o resucitar; nunca amontonados.
- [ ] blinky en cada cruce elige la dirección que minimiza su distancia Manhattan a Pac-Man.
- [ ] pinky apunta 4 celdas delante de la dirección de Pac-Man.
- [ ] inky apunta a 2·pivote − blinky (verificable leyendo `decideGhost`).
- [ ] clyde persigue a >8 celdas Manhattan y se dirige a (0,30) a ≤8.
- [ ] Ningún fantasma activo cruza la puerta; solo el script de salida.
- [ ] Al perder una vida los 4 regresan a sus posiciones y el escalonado se reinicia.
- [ ] Partida completa (ganar o perder) sin errores en consola.

## Decisiones

- **Sí:** comportamientos clásicos del arcade (elección del usuario).
- **Sí:** salida escalonada por temporizador en frames, no por dots — desacopla la salida del tablero.
- **Sí:** nombres canónicos blinky/pinky/inky/clyde — casan con la literatura y los colores.
- **Sí:** blinky arranca en (13,11), celda entera; el arcade lo centra en 13.5 pero este motor usa celdas alineadas.
- **Sí:** la puerta bloquea también a fantasmas activos — evita re-entrada y camping en la pen.
- **No:** scatter/chase — otro spec.
- **No:** power pellets — otro spec.
- **No:** bug original de pinky (arriba = 4 arriba + 2 izquierda) — target limpio 4 delante.
- **No:** euclídea para clyde (arcade usa ≥8 euclídeo) — Manhattan por consistencia con el resto del código.
- **No:** rebote cosmético dentro de la pen — quietos hasta salir.
- **No:** velocidades distintas por fantasma — mismo `GHOST_SPEED`.

## Riesgos

| Riesgo                                 | Mitigación                                              |
| -------------------------------------- | ------------------------------------------------------- |
| Fantasmas acampando dentro de la pen   | La puerta los bloquea una vez activos                   |
| Script de salida desalineado (x ≠ 13)  | Primero alinear x a 13, luego subir                     |
| Targets fuera del tablero (pinky/inky) | El target es solo referencia de distancia; no se valida |

## Lo que **no** está en este spec

- Modo scatter/chase alternado.
- Power pellets y modo asustado.
- Velocidades distintas por fantasma.
- Salida por contador de dots.

Cada uno, si llega, va en su propio spec.
