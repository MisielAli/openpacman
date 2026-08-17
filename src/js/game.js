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

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Calendario de modos del nivel 1 clasico. La ultima fase (index 7) es
// chase permanente y no aparece aqui: agotado el calendario no hay mas cambios.
const MODE_PHASES = [
  { mode: 'scatter', time: 7 },
  { mode: 'chase', time: 20 },
  { mode: 'scatter', time: 7 },
  { mode: 'chase', time: 20 },
  { mode: 'scatter', time: 5 },
  { mode: 'chase', time: 20 },
  { mode: 'scatter', time: 5 },
];

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    modeTimer: 0,
    modeIndex: 0,
    mode: 'scatter',
    elapsed: 0,
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      id: g.id,
      name: g.name,
      color: g.color,
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      corner: { x: g.corner.x, y: g.corner.y },
      delay: g.delay,
      status: 'caged',
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman:  bloqueado por pared (1) y puerta (3)
//   ghost:   bloqueado por pared (1) y puerta (3) — los activos no reingresan
//   exiting: bloqueado solo por pared (1); atraviesa la puerta al salir
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor !== 'exiting' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
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
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Distancia euclidiana al cuadrado (suficiente para comparar).
function dist2( x1, y1, x2, y2 ) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

// Celda objetivo del fantasma segun el modo global y su personalidad.
// Los objetivos proyectados pueden caer en pared o fuera del mapa: la
// heuristica local elige el giro que mas se acerca.
function ghostTarget( game, g ) {
  if ( game.mode === 'scatter' ) return { x: g.corner.x, y: g.corner.y };

  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  if ( g.id === 'blinky' ) return { x: px, y: py };

  if ( g.id === 'pinky' ) {
    const d = DIRS[ p.dir ];
    return { x: px + d.x * 4, y: py + d.y * 4 };
  }

  if ( g.id === 'inky' ) {
    const blinky = game.ghosts.find( ( o ) => o.id === 'blinky' );
    const d = DIRS[ p.dir ];
    const ax = px + d.x * 2;
    const ay = py + d.y * 2;
    return { x: ax * 2 - Math.round( blinky.x ), y: ay * 2 - Math.round( blinky.y ) };
  }

  // clyde: persigue lejos, se retira a su esquina si esta a menos de 8 celdas.
  if ( dist2( g.x, g.y, px, py ) >= 8 * 8 ) return { x: px, y: py };
  return { x: g.corner.x, y: g.corner.y };
}

// Prioridad de desempate entre giros igual de buenos: up > left > down > right.
const DIR_PRIORITY = [ 'up', 'left', 'down', 'right' ];

function decideGhost( game, g ) {
  const grid = game.grid;
  const target = ghostTarget( game, g );

  const options = DIR_PRIORITY.filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];

  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const dist = dist2( g.x + d.x, g.y + d.y, target.x, target.y );
    // '<' estricto: ante empate gana la direccion con mayor prioridad.
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

// Ruta controlada de salida: centrarse en x=13 y subir por la puerta hasta
// (13,11), donde el fantasma pasa a activo.
const PEN_EXIT = { x: 13, y: 11 };

function stepExiting( g ) {
  if ( g.x === PEN_EXIT.x && g.y === PEN_EXIT.y ) {
    g.status = 'active';
    g.dir = 'left';
    return;
  }
  if ( g.x < PEN_EXIT.x ) g.dir = 'right';
  else if ( g.x > PEN_EXIT.x ) g.dir = 'left';
  else g.dir = 'up';
}

function moveGhost( game, g ) {
  if ( g.status === 'caged' ) return;

  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( g.status === 'exiting' ) stepExiting( g );
    else decideGhost( game, g );
    const actor = g.status === 'exiting' ? 'exiting' : 'ghost';
    if ( !canMove( grid, g.x, g.y, g.dir, actor ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;

  game.modeTimer = 0;
  game.modeIndex = 0;
  game.mode = 'scatter';
  game.elapsed = 0;

  game.ghosts.forEach( ( g, i ) => {
    const s = GHOST_STARTS[ i ];
    g.x = s.x;
    g.y = s.y;
    g.dir = 'up';
    g.status = 'caged';
    g.delay = s.delay;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

// Avanza el calendario scatter/chase con tiempo real e invierte la direccion
// de los fantasmas activos en cada cambio de modo.
function updateModes( game, dt ) {
  game.elapsed += dt;
  game.modeTimer += dt;
  const phase = MODE_PHASES[ game.modeIndex ];
  if ( !phase || game.modeTimer < phase.time ) return;
  game.modeTimer = 0;
  game.modeIndex++;
  const next = MODE_PHASES[ game.modeIndex ];
  game.mode = next ? next.mode : 'chase';
  game.ghosts.forEach( ( g ) => {
    if ( g.status === 'active' ) g.dir = OPPOSITE[ g.dir ];
  } );
}

function update( game, dt ) {
  updateModes( game, dt );

  game.ghosts.forEach( ( g ) => {
    if ( g.status === 'caged' && game.elapsed >= g.delay ) g.status = 'exiting';
  } );

  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
