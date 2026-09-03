// main.js
// Bucle, teclado y pantallas. Usa createGame/update/draw (globals).

const canvas = document.getElementById( 'game' );
const ctx = canvas.getContext( '2d' );
const overlay = document.getElementById( 'overlay' );
const actionBtn = document.getElementById( 'action-btn' );

let game = createGame();
let frame = 0;

// Paso fijo a 60 fps: en pantallas de 120 Hz rAF corre al doble y todos los
// tiempos del juego (salida de pen, horario de modos) se acortarian a la mitad.
const STEP = 1000 / 60;
let last = performance.now();
let acc = 0;

const KEY_DIR = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

document.addEventListener( 'keydown', ( e ) => {
  const dir = KEY_DIR[ e.key ];
  if ( dir ) {
    e.preventDefault();
    if ( game.state === 'playing' ) game.pacman.nextDir = dir;
    return;
  }
  // Escape pausa; Enter reanuda o arranca.
  if ( e.key === 'Escape' && game.state === 'playing' ) {
    game.state = 'paused';
    showOverlay( 'PAUSA', '', 'Reanudar', resumeGame );
  } else if ( e.key === 'Enter' ) {
    // preventDefault: evita el click del boton enfocado al presionar Enter.
    e.preventDefault();
    if ( game.state === 'paused' ) resumeGame();
    else if ( game.state !== 'playing' ) startGame();
  }
} );

function showOverlay( title, cls, btnLabel, onClick ) {
  overlay.innerHTML =
    '<h1' + ( cls ? ' class="' + cls + '"' : '' ) + '>' + title + '</h1>' +
    '<button id="action-btn">' + btnLabel + '</button>';
  overlay.classList.add( 'show' );
  document.getElementById( 'action-btn' ).addEventListener( 'click', onClick || startGame );
}

function resumeGame() {
  game.state = 'playing';
  overlay.classList.remove( 'show' );
}

function startGame() {
  // Ganar el nivel anterior continua la partida (score y vidas persisten);
  // cualquier otro arranque es partida nueva.
  if ( game.state === 'won' ) nextLevel( game );
  else game = createGame();
  resumeGame();
}

if ( actionBtn ) actionBtn.addEventListener( 'click', startGame );

function loop( now ) {
  acc += now - last;
  last = now;
  if ( acc > 200 ) acc = 200; // pestaña oculta: no perseguir el tiempo perdido
  while ( acc >= STEP ) {
    acc -= STEP;
    frame++;
    if ( game.state === 'playing' ) {
      update( game );
      if ( game.state === 'won' ) showOverlay( 'GANASTE', 'win', 'Siguiente nivel' );
      else if ( game.state === 'lost' ) showOverlay( 'PERDISTE', 'lose', 'Reiniciar' );
    }
  }
  draw( ctx, game, frame );
  requestAnimationFrame( loop );
}

requestAnimationFrame( loop );
