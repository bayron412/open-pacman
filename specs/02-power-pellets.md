# SPEC 02 — Power pellets aleatorios y modo asustado

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-09-03
> **Objetivo:** Cuatro power pellets en celdas aleatorias por nivel que, al comerlos, asustan a los fantasmas: se vuelven azules, comibles y regresan como ojos a la pen.

## Alcance

**Dentro:**

- Tile runtime 4 (power pellet) en `game.grid`; `MAZE_STR`/`MAZE` quedan intactos (`src/js/maze.js` sin cambios).
- Sorteo de 4 posiciones al azar en `createGame` y `nextLevel`: reemplazan dots (celdas 2) con distancia Manhattan ≥8 entre sí; al morir se mantienen.
- Comer pellet: 50 pts, `dotsRemaining--` (cuenta como dot), activa modo asustado por 360 frames (6 s).
- Modo asustado: fantasmas activos (no pen) azules; huyen a su esquina `SCATTER_TARGETS`; parpadeo blanco los últimos 120 frames; el horario scatter/chase pausa.
- Comer fantasma asustado: cadena 200/400/800/1600 (`eatenCount`); el comido se vuelve ojos que van a (13,11), entran a la pen y renacen normales.
- Segundo pellet durante el efecto: reinicia timer y cadena.
- `resetPositions` limpia todo el estado asustado/ojos.

**Fuera de alcance (para specs futuros):**

- Fruta / ítems de bonus.
- Duración decreciente del asustado por nivel.
- Velocidades distintas para asustado/ojos.
- Fantasmas de la pen asustados al salir.

## Modelo de datos

```js
// maze.js — sin cambios: MAZE pristino nunca contiene el tile 4.

// game.js — constantes nuevas
const POWER_PELLETS = 4;       // pellets por sorteo
const PELLET_MIN_DIST = 8;     // separación Manhattan mínima entre pellets
const FRIGHTENED_FRAMES = 360; // 6 s a 60 fps
const FRIGHTENED_FLASH = 120;  // últimos 2 s: parpadeo
const EAT_CHAIN = [ 200, 400, 800, 1600 ];
const PEN_DOOR = { x: 13, y: 11 }; // target de los ojos

// game gana (resetPositions es la fuente única que los limpia):
{ frightened: 0, eatenCount: 0 } // frames restantes | índice de cadena

// cada fantasma gana:
{ frightened: false, eyes: false }
```

Convenciones: sorteo con `Math.random` sobre celdas `grid === 2` (tras limpiar la celda de inicio). Tile 4 solo existe en `game.grid`, nunca en `MAZE`.

## Plan de implementación

1. **Sorteo y dibujo.** `game.js`: `placePellets( game )` elige 4 celdas `grid === 2` al azar con separación Manhattan ≥8 y las pone a 4; se llama en `createGame` y `nextLevel` antes de contar dots (los pellets cuentan para `dotsRemaining`). `render.js`: `drawDots` pinta tile 4 como círculo r=7 parpadeando. Manual: 4 pellets grandes visibles, posiciones distintas por partida y por nivel.
2. **Comer pellet.** `game.js`: `movePacman` — celda 4 → 0, `score += 50`, `dotsRemaining--`, `game.frightened = FRIGHTENED_FRAMES`, `game.eatenCount = 0`; cada fantasma con `pen === false` toma `frightened = true`. Manual: comer pellet suma 50 (efecto visual va en el paso siguiente).
3. **Huida, timer y pausa.** `game.js`: `ghostTarget` — `g.frightened` → `SCATTER_TARGETS[ g.kind ]`; `update` — decrementa `game.frightened` y a 0 apaga todos los `g.frightened`; `updateMode` no avanza mientras `game.frightened > 0`. `render.js`: azul `#2121de`, blanco intermitente cuando quedan ≤120 frames. Manual: huyen a su esquina ~6 s, parpadean al final, vuelven a lo suyo.
4. **Comer fantasmas.** `game.js`: en colisiones, si `g.frightened` → `g.eyes = true`, `g.frightened = false`, `score += EAT_CHAIN[ min( eatenCount, 3 ) ]`, `eatenCount++` (no quita vidas; ojos no colisionan). Manual: 200/400/800/1600 encadenados en un mismo efecto.
5. **Ojos y renacer.** `game.js`: `ghostTarget` — `g.eyes` → `PEN_DOOR`; `moveGhost` — ojos al llegar a (13,11) bajan por script a (13,14), ahí `eyes = false`, `pen = true`, `exitAt = game.frames + 60` (renace y sale); `resetPositions` limpia `frightened`/`eyes` de todos y `game.frightened`/`eatenCount`. `render.js`: `g.eyes` dibuja solo los ojos. Manual: los ojos cruzan el mapa, entran a la pen y salen renacidos; morir limpia todo.

## Criterios de aceptación

- [ ] Cada partida nueva y cada nivel muestra exactamente 4 pellets grandes parpadeantes sobre celdas que antes tenían dot.
- [ ] Las 4 posiciones difieren entre partidas/niveles y guardan distancia Manhattan ≥8 entre sí; ninguna cae en pared, puerta, pen, túnel ni en la celda de inicio de Pac-Man.
- [ ] Comer pellet suma 50 pts, decrementa `dotsRemaining`; el nivel se gana comiendo dots + pellets.
- [ ] Al comerlo, los fantasmas fuera de la pen se vuelven azules; los de la pen salen normales.
- [ ] Asustados huyen hacia su esquina scatter; el horario scatter/chase no avanza durante el efecto.
- [ ] El efecto dura ~6 s, con parpadeo azul/blanco los últimos ~2 s.
- [ ] Comer fantasmas da 200/400/800/1600 en cadena; el comido se vuelve ojos.
- [ ] Los ojos llegan a (13,11), entran a la pen y salen como fantasma normal; no matan ni son comibles.
- [ ] Un segundo pellet reinicia el timer y la cadena a 200.
- [ ] Perder una vida limpia modo asustado y ojos.
- [ ] Partida completa (ganar y perder, varios niveles) sin errores en consola.

## Decisiones

- **Sí:** tile 4 runtime-only — `MAZE_STR` se queda legible y pristino.
- **Sí:** pellets reemplazan dots y cuentan para ganar — como el arcade.
- **Sí:** separación ≥8 Manhattan entre pellets — evita amontonamiento.
- **Sí:** huida apuntando a la esquina scatter — reusa `decideGhost`, diff mínimo.
- **Sí:** pausar el horario de modos durante el efecto — clásico, 1 línea.
- **Sí:** duración fija 360 frames en todos los niveles.
- **Sí:** fantasmas en la pen salen normales; cadena reinicia con cada pellet — clásico.
- **No:** velocidades distintas para asustado/ojos — la cuadrícula exige pasos 1/n (ver comentario de `LEVEL_SPEEDS`); otra tabla es bloat.
- **No:** freeze de 1 s al comer fantasma (arcade) — sin valor aquí.
- **No:** fruta, bonus, persistencia de posiciones entre sesiones.

## Riesgos

| Riesgo                                            | Mitigación                                |
| ------------------------------------------------- | ----------------------------------------- |
| Pellet junto al inicio de Pac-Man (50 pts gratis) | Aceptado: es el azar pedido               |
| Ojos atascados camino a (13,11)                   | `decideGhost` ya resuelve callejones      |
| `dotsRemaining` descontado doble                  | Comer solo ocurre en `movePacman` aligned |

## Lo que **no** está en este spec

- Fruta / ítems de bonus.
- Duración decreciente del asustado por nivel.
- Velocidades distintas para asustado/ojos.
- Persistencia de posiciones entre sesiones.

Cada uno, si llega, va en su propio spec.
