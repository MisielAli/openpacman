# SPEC 02 — Energizantes y fantasmas vulnerables

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-16
> **Objetivo:** Incorporar los cuatro energizantes clasicos (uno por esquina) que vuelven vulnerables a los fantasmas durante 6 segundos, permitiendo a Pac-Man comerselos por 200/400/800/1600 puntos mientras regresan como ojos a la jaula.

---

## Alcance

**In:**

- Nuevo tile `4` (energizante) en `src/js/maze.js`: caracter `'o'` en `MAZE_STR` en las cuatro posiciones clasicas del nivel 1: `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)`. Actualizacion del contrato de tiles en `AGENTS.md`.
- Comer un energizante: 50 puntos, decrementa `dotsRemaining` (necesario para ganar) y arranca el modo asustado.
- Modo asustado global de 6 segundos (`frightTimer`): todos los fantasmas que no sean ojos (incluidos `caged` y `exiting`) se vuelven azules e invierten su direccion inmediatamente.
- Movimiento asustado: en cada interseccion, direccion aleatoria entre las legales sin reversa (reversa solo en callejon).
- El calendario scatter/chase (`updateModes`) se congela mientras `frightTimer > 0` y reanuda su curso al terminar; el reloj de liberacion (`elapsed`) sigue corriendo.
- Aviso visual: los ultimos 2 segundos del modo asustado los fantasmas parpadean entre azul y blanco.
- Comer fantasmas: cadena 200/400/800/1600 por modo asustado (`ghostChain`); el fantasma comido pasa a estado `eyes`.
- Estado `eyes`: se mueve con la heuristica local existente apuntando a la puerta `(13,11)`, cruza la puerta hacia abajo por ruta controlada hasta el interior de la jaula `(13,14)` y pasa a `exiting` (sale de inmediato, sin retraso adicional). Los ojos no danan ni se pueden recomer.
- Segundo energizante durante un modo asustado activo: reinicia `frightTimer` a 6 s y la cadena vuelve a 200.
- Colision con fantasma asustado come al fantasma; con ojos no tiene efecto; con fantasma normal quita una vida (sin cambios).
- Al perder una vida, `resetPositions` cancela el modo asustado por completo: `frightTimer = 0`, `ghostChain = 0`, `frightened = false` y ojos vuelven a `caged`.
- Render: energizantes como circulos grandes (radio ~6 px) parpadeando; fantasmas azules `#2121de` (blanco intermitente en el aviso final); ojos como solo ojos. Puntos solo en el marcador, sin pausa ni texto flotante.
- Velocidad sin cambios: `0.1` celdas/frame para todas las formas de fantasma (asustado y ojos incluidos).

**Out of scope (para futuras especificaciones):**

- Duracion decreciente del modo asustado por nivel (no existe concepto de nivel).
- Cambios de velocidad por modo (asustado mas lento, ojos mas rapidos).
- Pausa de 0.5 s con marcador flotante al comer un fantasma.
- Frutas, bonus ni interpolacion de puntos.
- Reglas exactas adicionales del arcade (Cruise Elroy, etc.).
- Persistencia entre sesiones y pruebas automatizadas.

---

## Modelo de datos

```js
// maze.js — MAZE_STR: filas 3 y 23 con 'o' en las cuatro esquinas
//   parseTile: 'o' -> 4
// Contracto actualizado: 0 vacio, 1 pared, 2 dot, 3 puerta, 4 energizante

// game.js — estado global (se anaden al objeto game)
{
  frightTimer: 0,    // segundos restantes de modo asustado (0 = inactivo)
  ghostChain: 0,     // fantasmas comidos durante el modo asustado actual
}

// game.js — estado por fantasma (se anade a cada entrada de game.ghosts[])
{
  frightened: false,  // true durante el modo asustado
  // status: 'caged' | 'exiting' | 'active' | 'eyes'
}
```

Convenciones:

- Coordenadas en celdas, origen arriba-izquierda.
- Velocidades en celdas por frame (sin cambios).
- `frightTimer` y `ghostChain` se reinician en `resetPositions`.
- Colores de fantasmas asustados: `#2121de` (azul); blanco durante el aviso final (alternado cada frame).

---

## Plan de implementacion

1. **`src/js/maze.js`:** cambiar filas 3 y 23 de `MAZE_STR` para colocar `'o'` en columnas 1 y 26. Anadir `'o'` a `parseTile` devolviendo `4`. Actualizar el comentario de cabecera del archivo con el nuevo tile. Actualizar el contrato de tiles en `AGENTS.md`. Verificacion: la pagina carga sin errores y los cuatro energizantes se cuentan en `dotsRemaining`.

2. **`src/js/game.js` (comer energizante):** en `movePacman`, anadir caso para `grid[y][x] === 4`: poner a 0, sumar 50 puntos, decrementar `dotsRemaining`, y activar `frightTimer = FRIGHT_TIME` (6 s), `ghostChain = 0`, marcar `frightened = true` en todos los fantasmas excepto ojos. Los fantasmas `caged` y `exiting` tambien se asustan. Invertir direccion de todos los fantasmas no-ojos. Si `frightTimer > 0` (re-comer), reiniciar a 6 s y `ghostChain = 0`. Verificacion: comer un pellet pone a `game.frightTimer === 6` y `g.frightened === true` en los cuatro fantasmas (verificable con DevTools).

3. **`src/js/game.js` (congelar calendario):** en `updateModes`, si `game.frightTimer > 0` no avanzar `modeTimer` ni `modeIndex`. El reloj `elapsed` sigue corriendo en el `update` principal. Verificacion: durante el modo asustado, `game.mode` y `game.modeIndex` no cambian.

4. **`src/js/game.js` (temporizador y expiracion):** decrementar `frightTimer` con `dt` en `update`. Cuando llega a 0: marcar `frightened = false` en todos los fantasmas activos y ojos. No invertir direccion al expirar (solo al activar). Verificacion: al acabar 6 s, los fantasmas vuelven a su color y comportamiento normal.

5. **`src/js/game.js` (movimiento asustado):** en `decideGhost`, si `g.frightened` es true, elegir direccion aleatoria entre las legales sin reversa (misma logica de filtrado que ahora, pero en vez de minimizar distancia al objetivo, elegir al azar entre las opciones). Si solo hay una, usar esa. Verificacion: fantasmas azules cambian de direccion en cada interseccion de forma observable y no determinista.

6. **`src/js/game.js` (colision con fantasmas asustados):** en el bucle de colisiones, si el fantasma es `eyes`, ignorar. Si `g.frightened` es true, comer al fantasma: sumar `200 * 2^ghostChain` puntos, incrementar `ghostChain`, cambiar `g.status` a `'eyes'`, marcar `g.frightened = false`. Verificacion: comer un fantasma asustado cambia su estado y los puntos se reflejan en el marcador.

7. **`src/js/game.js` (regreso de ojos):** si `g.status === 'eyes'`, usar `ghostTarget` apuntando a `(13,11)` (el `PEN_EXIT`). En `decideGhost`, si el fantasma es ojos, permitir cruzar la puerta (actor `'exiting'`). Al llegar a `(13,11)`, seguir ruta controlada hacia abajo hasta `(13,14)` (centro de la jaula), donde cambiar a `status: 'exiting'` con `delay = 0` para que salga de inmediato. Los ojos ignoran el modo scatter/chase y siempre apuntan a la jaula. Verificacion: fantasma comido se convierte en ojos, viaja a la puerta, entra a la jaula y vuelve a salir.

8. **`src/js/render.js` (energizantes):** en `drawDots`, detectar `grid[y][x] === 4` y dibujar un circulo de radio 6 en color DOT_COLOR. El parpadeo se logra alternando visibilidad cada 15 frames: `(Math.floor(frame / 15) % 2 === 0)`. Verificacion: cuatro circulos grandes parpadean en las esquinas.

9. **`src/js/render.js` (fantasmas asustados):** en `draw`, al llamar a `drawGhost` pasar color condicional: si `g.frightened`, usar azul `#2121de`; si el parpadeo esta activo (`game.frightTimer > 0 && game.frightTimer <= 2`), alternar entre azul y blanco. Si `g.status === 'eyes'`, no dibujar cuerpo ni falda, solo los ojos (dos circulos blancos con pupila). Verificacion: fantasmas comidos muestran solo ojos; fantasmas asustados son azules con parpadeo visible al final.

10. **`src/js/game.js` (reset por vida):** en `resetPositions`, anadir `game.frightTimer = 0`, `game.ghostChain = 0`, y `g.frightened = false` en cada fantasma. Los ojos vuelven a `caged`. Verificacion: perder una vida durante el modo asustado cancela todo y los fantasmas vuelven a la jaula sin estado azul.

---

## Criterios de aceptacion

- [ ] La pagina carga sin errores en consola con `src/` servido por un servidor estatico.
- [ ] Cuatro energizantes grandes parpadeando en `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)` desde el inicio de cada partida.
- [ ] Comer un energizante suma 50 puntos y decrementa `dotsRemaining`.
- [ ] Ganar la partida requiere comer los 4 energizantes ademas de todos los dots normales.
- [ ] Al comer un energizante, todos los fantasmas no-ojos (incluidos `caged` y `exiting`) invierten su direccion y se vuelven azules.
- [ ] Fantasmas asustados eligen direcciones aleatorias sin reversa en cada interseccion.
- [ ] El calendario scatter/chase se congela durante el modo asustado y reanuda despues.
- [ ] Parpadeo azul/blanco visible en los ultimos 2 segundos del modo asustado.
- [ ] Comer fantasmas consecutivos durante un mismo modo asustado puntua 200, 400, 800 y 1600.
- [ ] Un segundo energizante durante un modo asustado activo reinicia el temporizador a 6 s y la cadena a 200.
- [ ] El fantasma comido pasa a ojos, regresa a la jaula por la puerta y vuelve a salir.
- [ ] Los ojos no danan a Pac-Man ni se pueden recomer.
- [ ] A los 6 segundos, los fantasmas vuelven a su color y comportamiento normal.
- [ ] Perder una vida cancela completamente el modo asustado (temporizador, cadena, ojos y colores).
- [ ] Colision con fantasma normal (no asustado, no ojos) quita exactamente una vida como antes.
- [ ] El tunel en fila 14 sigue funcionando para Pac-Man y los cuatro fantasmas en todos los estados.
- [ ] Completar todos los dots y energizantes muestra la pantalla de victoria.

---

## Decisiones

- **Si:** modo asustado clasico completo: fantasmas azules, movimiento aleatorio, cadena 200/400/800/1600, ojos de regreso. Es la continuacion natural de SPEC 01.
- **Si:** tile 4 con caracter `'o'` y las cuatro posiciones clasicas del nivel 1. Mantiene el contrato de tiles simple.
- **Si:** 50 puntos por energizante, cuenta para `dotsRemaining`. Victoria requiere comer los 4. Respeta la regla clasica.
- **Si:** modo asustado afecta a `caged` y `exiting` (no solo `active`). Respeta el comportamiento del arcade.
- **Si:** todos los fantasmas invierten direccion al activarse el modo asustado. Mecanismo existente, regla clasica.
- **Si:** movimiento asustado aleatorio sin reversa (reversa solo en callejon). Simple y fiel al arcade.
- **Si:** calendario scatter/chase congelado durante asustado. Evita cambios de modo invisibles; el arcade lo hace asi.
- **Si:** el reloj `elapsed` (liberacion escalonada) sigue corriendo durante asustado. La jaula se vacia en su ritmo natural.
- **Si:** velocidad 0.1 uniforme para asustados y ojos. Consistente con SPEC 01 ("las personalidades provienen de objetivos, no de velocidad").
- **Si:** segundo pellet reinicia a 6 s y cadena a 200. Comportamiento clasico, mas dinamico.
- **Si:** ojos regresan por heuristica local hacia `(13,11)` y ruta controlada hacia abajo. Reutiliza la maquinaria existente.
- **Si:** los ojos pueden cruzar la puerta hacia abajo (`actor = 'eyes'` en `isWall`). Sin esta regla, los ojos se atascarian.
- **Si:** al expirar el modo asustado no se invierte la direccion. Solo la activacion invierte.
- **No:** duracion decreciente por nivel. No hay concepto de nivel aun.
- **No:** velocidad distinta para asustados u ojos. Aun no.
- **No:** pausa visual ni texto flotante al comer fantasma. Los puntos en el marcador bastan.
- **No:** pathfinding para ojos. La heuristica local con objetivo en la puerta es suficiente.
- **No:** frutas, bonus, Cruise Elroy ni reglas adicionales del arcade.

---

## Riesgos

| Riesgo | Mitigacion |
| --- | --- |
| Movimiento aleatorio puede llevar a un fantasma asustado a un callejon sin salida | La reversa se permite en callejon; es un comportamiento aceptable y esperable. |
| Ojos pueden tardar en encontrar la puerta si estan en la otra punta del mapa | La heuristica local con objetivo fijo funciona bien en el laberinto conectado; velocidad constante lo hace predecible. |
| Interaccion entre inversiones multiples (pellet + cambio de modo simultaneo) | El modo congelado durante asustado evita solapamientos; las inversiones se propagan en la misma linea de `update`. |
| Puerta permite paso a ojos y fantasmas asustados podrian quedar atrapados dentro de la jaula | Los ojos siempre pasan a `exiting` con delay 0 y salen; los asustados activos no pueden entrar a la jaula (actor `'ghost'` bloqueado por puerta). |

---

## Lo que **no** esta en esta especificacion

- Duracion decreciente del modo asustado por nivel.
- Cambios de velocidad por modo.
- Pausa visual al comer fantasma.
- Frutas y bonus.
- Reglas exactas adicionales del arcade (Cruise Elroy, etc.).
- Persistencia y pruebas automatizadas.

Cada uno de estos puntos, si llega, va en su propia especificacion.
