// main.js
// Bucle, teclado y pantallas. Usa createGame/update/draw (globals).

const canvas = document.getElementById( 'game' );
const ctx = canvas.getContext( '2d' );
const overlay = document.getElementById( 'overlay' );
const actionBtn = document.getElementById( 'action-btn' );

let game = createGame();
let frame = 0;
let lastTime = performance.now();

const KEY_DIR = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

document.addEventListener( 'keydown', ( e ) => {
  const dir = KEY_DIR[ e.key ];
  if ( !dir ) return;
  e.preventDefault();
  if ( game.state === 'playing' ) game.pacman.nextDir = dir;
} );

function showOverlay( title, cls, btnLabel ) {
  overlay.innerHTML =
    '<h1' + ( cls ? ' class="' + cls + '"' : '' ) + '>' + title + '</h1>' +
    '<button id="action-btn">' + btnLabel + '</button>';
  overlay.classList.add( 'show' );
  document.getElementById( 'action-btn' ).addEventListener( 'click', startGame );
}

function startGame() {
  game = createGame();
  game.state = 'playing';
  overlay.classList.remove( 'show' );
}

if ( actionBtn ) actionBtn.addEventListener( 'click', startGame );

function loop() {
  frame++;
  const now = performance.now();
  const dt = Math.min( ( now - lastTime ) / 1000, 0.1 );
  lastTime = now;
  if ( game.state === 'playing' ) {
    update( game, dt );
    if ( game.state === 'won' ) showOverlay( 'GANASTE', 'win', 'Reiniciar' );
    else if ( game.state === 'lost' ) showOverlay( 'PERDISTE', 'lose', 'Reiniciar' );
  }
  draw( ctx, game, frame );
  requestAnimationFrame( loop );
}

loop();
