// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

// Velocidades por nivel en celdas/frame. Solo pasos 1/n: la cuadricula
// (aligned) solo engancha si el paso divide la celda exacta; un 0.075,
// p.ej., se saltaria los cruces. Techo desde nivel 4, como el original.
const LEVEL_SPEEDS = {
  1: { pac: 1 / 10, ghost: 1 / 13 },
  2: { pac: 1 / 9, ghost: 1 / 11 },
  3: { pac: 1 / 8, ghost: 1 / 10 },
  4: { pac: 1 / 7, ghost: 1 / 9 },
};
// Frames de espera antes de salir de la pen (blinky ya esta fuera).
const GHOST_EXIT_DELAY = { pinky: 120, inky: 360, clyde: 720 }; // a 60 fps
// Esquina de scatter de cada fantasma: a donde se retira en modo scatter
// (clyde tambien huye a la suya en chase cuando esta cerca).
const SCATTER_TARGETS = {
  blinky: { x: 25, y: 0 },
  pinky: { x: 2, y: 0 },
  inky: { x: 27, y: 30 },
  clyde: { x: 0, y: 30 },
};
// Horario clasico del nivel 1: alterna scatter/chase empezando en scatter
// (frames a 60 fps). El tramo final (Infinity) es chase ya para siempre.
const MODE_SCHEDULE = [ 420, 1200, 420, 1200, 420, 1200, 300, Infinity ];
// Prioridad de desempate clasica al elegir direccion en un cruce.
const DIR_PRIORITY = [ 'up', 'left', 'down', 'right' ];
// Power pellets: cuantos se sortean y separacion Manhattan minima entre ellos.
const POWER_PELLETS = 4;
const PELLET_MIN_DIST = 8;
// Modo asustado: duracion en frames (6 s a 60 fps) y parpadeo final.
const FRIGHTENED_FRAMES = 360;
const FRIGHTENED_FLASH = 120;
// Cadena de puntos por comer fantasmas asustados en un mismo efecto.
const EAT_CHAIN = [ 200, 400, 800, 1600 ];
// Target de los ojos (fantasma comido): la puerta de la pen.
const PEN_DOOR = { x: 13, y: 11 };

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  const game = {
    state: 'start',
    frames: 0,
    score: 0,
    lives: 3,
    level: 1,
    dotsRemaining: 0,
    // Modo asustado: frames restantes del efecto e indice de cadena.
    frightened: 0,
    eatenCount: 0,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      kind: g.kind,
      frightened: false,
      eyes: false,
    } ) ),
  };
  // Estado inicial de unica fuente: resetPositions completa pen/exitAt,
  // igual que tras morir, sin duplicar la logica del escalonado.
  placePellets( game );
  // Los pellets cuentan como dots para ganar el nivel.
  game.dotsRemaining = game.grid.flat().filter( ( v ) => v === 2 || v === 4 ).length;
  resetPositions( game );
  return game;
}

// Sortea POWER_PELLETS celdas con dot (grid === 2) separadas >=PELLET_MIN_DIST
// en Manhattan y las marca como power pellets (tile 4, solo en runtime: MAZE
// nunca lo contiene). Solo se sortea al crear partida y al subir de nivel;
// al morir los pellets restantes se mantienen.
function placePellets( game ) {
  const grid = game.grid;
  let chosen = [];
  // Reintenta el sorteo entero si el azar deja menos de POWER_PELLETS
  // colocables (rarisimo: cubrir todos los dots con 3 rombos de radio 7).
  do {
    const candidates = [];
    for ( let y = 0; y < grid.length; y++ )
      for ( let x = 0; x < grid[ 0 ].length; x++ )
        if ( grid[ y ][ x ] === 2 ) candidates.push( { x, y } );
    chosen = [];
    while ( chosen.length < POWER_PELLETS && candidates.length ) {
      const c = candidates.splice( Math.floor( Math.random() * candidates.length ), 1 )[ 0 ];
      if ( chosen.every( ( p ) => Math.abs( p.x - c.x ) + Math.abs( p.y - c.y ) >= PELLET_MIN_DIST ) )
        chosen.push( c );
    }
  } while ( chosen.length < POWER_PELLETS );
  for ( const p of chosen ) grid[ p.y ][ p.x ] = 4;
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro? Pared (1) y puerta (3) bloquean a todos los actores;
// la puerta solo la cruza el script de salida de la pen (exitPen).
function isWall( grid, x, y ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  return v === 1 || v === 3;
}

// Puede avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet.
    const cell = grid[ p.y ][ p.x ];
    if ( cell === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    } else if ( cell === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 50;
      game.dotsRemaining--;
      // Activa el modo asustado: reinicia timer y cadena de fantasmas.
      game.frightened = FRIGHTENED_FRAMES;
      game.eatenCount = 0;
      // Solo los activos: los de la pen salen normales y los ojos ya
      // estan muertos (renacen normales).
      game.ghosts.forEach( ( g ) => {
        if ( !g.pen && !g.eyes ) g.frightened = true;
      } );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Target de cada fantasma segun su personalidad clasica. Es solo referencia
// de distancia: puede caer en pared o fuera del tablero; nunca se visita.
function ghostTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const pd = DIRS[ p.dir ];

  // Ojos (comido): regresa a la puerta de la pen.
  if ( g.eyes ) return PEN_DOOR;
  // Asustado: huye hacia su esquina scatter.
  if ( g.frightened ) return SCATTER_TARGETS[ g.kind ];
  // En scatter cada fantasma se retira a su esquina; en chase usa su
  // personalidad clasica.
  if ( game.mode === 'scatter' ) return SCATTER_TARGETS[ g.kind ];
  if ( g.kind === 'blinky' ) return { x: px, y: py };
  if ( g.kind === 'pinky' ) return { x: px + pd.x * 4, y: py + pd.y * 4 };
  if ( g.kind === 'inky' ) {
    const blinky = game.ghosts[ 0 ]; // orden fijo: 0 = blinky
    const pivX = px + pd.x * 2;
    const pivY = py + pd.y * 2;
    return { x: 2 * pivX - Math.round( blinky.x ), y: 2 * pivY - Math.round( blinky.y ) };
  }
  // clyde: timido — persigue lejos, huye a su esquina a 8 celdas o menos.
  const dist = Math.abs( g.x - px ) + Math.abs( g.y - py );
  return dist > 8 ? { x: px, y: py } : SCATTER_TARGETS.clyde;
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const target = ghostTarget( game, g );

  const options = DIR_PRIORITY.filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];

  // En cada cruce, la direccion que minimiza Manhattan al target.
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const dist = Math.abs( g.x + d.x - target.x ) + Math.abs( g.y + d.y - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

// Salida guionizada de la pen: alinear x a 13, luego subir hasta (13,11).
// No usa canMove: la ruta (interior pen + puerta) esta verificada en el maze.
function exitPen( g ) {
  if ( g.x < 13 ) g.x = Math.min( 13, g.x + g.speed );
  else if ( g.x > 13 ) g.x = Math.max( 13, g.x - g.speed );
  else if ( g.y > 11 ) g.y -= g.speed;

  if ( g.y <= 11 ) {
    g.y = 11;
    g.pen = false;
    g.dir = 'left';
  }
}

function moveGhost( game, g ) {
  // Ojos que alcanzaron la puerta: entran a la pen por script bajando hasta
  // (13,14), donde renacen. Igual que exitPen, no usa canMove (la puerta
  // bloquea a los actores normales). La columna 13 solo se recorre asi entre
  // las filas 11 y 14, por lo que la condicion no captura a nadie mas.
  // OJO: x llega por pasos acumulados (p.ej. 12.999999999999998), nunca por
  // igualdad estricta con 13 — comparar con tolerancia y snap.
  if ( g.eyes && Math.abs( g.x - PEN_DOOR.x ) < 1e-3 && g.y >= PEN_DOOR.y && g.y < 14 ) {
    g.x = PEN_DOOR.x;
    g.y += g.speed;
    if ( g.y >= 14 ) {
      g.y = 14;
      g.eyes = false;
      g.pen = true;
      g.exitAt = game.frames + 60; // renace y sale al segundo
    }
    return;
  }
  // Dentro de la pen: quieto hasta su turno, luego sale con el script.
  if ( g.pen ) {
    if ( game.frames >= g.exitAt ) exitPen( g );
    return;
  }
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

// Avanza el horario scatter/chase. Al cambiar de modo, cada fantasma activo
// da media vuelta (senal clasica del original). El opuesto conserva el eje,
// asi que el snap de alineacion reintegra a la cuadricula sin romperla.
function updateMode( game ) {
  // El horario scatter/chase pausa mientras dura el modo asustado.
  if ( game.frightened > 0 ) return;
  game.modeFrames++;
  if ( game.modeFrames < MODE_SCHEDULE[ game.modeIndex ] ) return;
  game.modeFrames = 0;
  game.modeIndex++;
  game.mode = game.mode === 'scatter' ? 'chase' : 'scatter';
  game.ghosts.forEach( ( g ) => {
    if ( !g.pen ) g.dir = OPPOSITE[ g.dir ];
  } );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  // Velocidades del nivel (fuente unica: arranque, tras morir y al subir
  // de nivel). Techo en nivel 4.
  const sp = LEVEL_SPEEDS[ Math.min( game.level, 4 ) ];
  p.speed = sp.pac;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.speed = sp.ghost;
    // El escalonado se reinicia relativo al frame actual de la partida.
    g.pen = g.kind !== 'blinky';
    g.exitAt = game.frames + ( GHOST_EXIT_DELAY[ g.kind ] || 0 );
    g.frightened = false;
    g.eyes = false;
  } );
  // El horario de modos tambien se reinicia (como en el original al morir),
  // igual que todo el estado asustado/ojos (fuente unica de limpieza).
  game.mode = 'scatter';
  game.modeIndex = 0;
  game.modeFrames = 0;
  game.frightened = 0;
  game.eatenCount = 0;
}

// Siguiente nivel: laberinto y dots nuevos, mismo score y vidas (como el
// original). El estado 'playing' lo pone quien llama.
function nextLevel( game ) {
  game.level++;
  game.grid = MAZE.map( ( row ) => row.slice() );
  game.grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;
  placePellets( game );
  // Los pellets cuentan como dots para ganar el nivel.
  game.dotsRemaining = game.grid.flat().filter( ( v ) => v === 2 || v === 4 ).length;
  resetPositions( game );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.frames++;
  // Timer del modo asustado: al llegar a 0 se apaga en todos los fantasmas.
  if ( game.frightened > 0 ) {
    game.frightened--;
    if ( game.frightened === 0 ) {
      game.ghosts.forEach( ( g ) => {
        g.frightened = false;
      } );
    }
  }
  updateMode( game );
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( !collides( game.pacman, g ) ) continue;
    // Ojos: no colisionan (ni matan ni son comibles).
    if ( g.eyes ) continue;
    // Fantasma asustado: se lo come, se vuelve ojos y encadena puntos.
    if ( g.frightened ) {
      g.frightened = false;
      g.eyes = true;
      game.score += EAT_CHAIN[ Math.min( game.eatenCount, 3 ) ];
      game.eatenCount++;
      continue;
    }
    game.lives--;
    if ( game.lives <= 0 ) {
      game.state = 'lost';
      return;
    }
    resetPositions( game );
    break;
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.nextLevel = nextLevel;
window.DIRS = DIRS;
window.FRIGHTENED_FLASH = FRIGHTENED_FLASH;
