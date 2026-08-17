# SPEC 01 — Cuatro fantasmas con personalidades

> **Estado:** Aprovado
> **Depende on:** ninguna
> **Fecha:** 2026-08-15
> **Objetivo:** Incorporar cuatro fantasmas clásicos (Blinky, Pinky, Inky y Clyde) con identidades propias, liberación escalonada desde la jaula y estrategias diferenciadas de persecución y dispersión.

---

## Alcance

**In:**

- Ampliar `GHOST_STARTS` en `src/js/maze.js` de dos a cuatro fantasmas con identidad completa: `id`, nombre, posición inicial, tipo, color, esquina de dispersión y retraso de salida.
- Reemplazar la lógica actual `hunter`/`random` en `src/js/game.js` por cuatro estrategias:
  - **Blinky:** persigue la celda actual de Pac-Man.
  - **Pinky:** apunta a 4 celdas delante de Pac-Man según su dirección.
  - **Inky:** proyecta desde la posición de Blinky hacia 2 celdas delante de Pac-Man (vector doble).
  - **Clyde:** persigue a Pac-Man si la distancia euclidiana es ≥ 8 celdas; si es menor, se retira hacia su esquina de dispersión.
- Estados por fantasma: `caged` (esperando su retraso), `exiting` (ruta controlada por la puerta hasta `(13,11)`) y `active` (usa su estrategia).
- Liberación escalonada con retrasos de 0, 2, 4 y 6 segundos medidos en tiempo real.
- Ciclo global de modos persecución/dispersión con el calendario del nivel 1 clásico:
  `7s scatter · 20s chase · 7s scatter · 20s chase · 5s scatter · 20s chase · 5s scatter · chase permanente`.
- Inversión inmediata de dirección de los fantasmas activos en cada cambio de modo.
- Reinicio completo al perder una vida: posiciones, retrasos de salida y calendario de modos vuelven al estado inicial; puntuación, dots comidos y vidas se conservan.
- Selección de giro por heurística local: entre direcciones legales sin retorno, minimizar distancia euclidiana a la celda objetivo con desempate `up > left > down > right`.
- La puerta de la jaula (`tile 3`) solo es transitable por fantasmas en estado `exiting`; los activos no pueden reingresar.
- Paso de delta de tiempo real (limitado a `0.1 s` por cuadro) desde `src/js/main.js` hacia `update`.
- Color por fantasma tomado de su identidad en `GHOST_STARTS` (render estable sin depender del índice).

**Out of scope (para futuras especificaciones):**

- Energizantes, estado vulnerable de fantasmas y Pac-Man comiéndolos.
- Reproducción exacta de reglas del arcade más allá de las aquí descritas.
- Nombres visibles o leyenda en pantalla.
- Persistencia entre sesiones.
- Pruebas automatizadas o harness de pruebas.
- Migrar el movimiento existente a velocidades basadas en tiempo (se mantiene `0.1` celdas/cuadro para fantasmas y `0.125` para Pac-Man).

---

## Modelo de datos

```js
// maze.js — GHOST_STARTS (configuración estable, no se muta)
const GHOST_STARTS = [
  { id: 'blinky', name: 'Blinky', x: 13, y: 14, color: '#ff0000', corner: { x: 26, y: 1 },  delay: 0 },
  { id: 'pinky',  name: 'Pinky',  x: 14, y: 14, color: '#ffb8ff', corner: { x: 1,  y: 1 },  delay: 2 },
  { id: 'inky',   name: 'Inky',   x: 12, y: 14, color: '#00ffff', corner: { x: 26, y: 29 }, delay: 4 },
  { id: 'clyde',  name: 'Clyde',  x: 15, y: 14, color: '#ffb852', corner: { x: 1,  y: 29 }, delay: 6 },
];

// game.js — estado mutable por partida (game.ghosts)
{
  id: 'blinky',
  name: 'Blinky',
  color: '#ff0000',
  x: 13, y: 14,
  dir: 'up',
  speed: 0.1,
  corner: { x: 26, y: 1 },
  delay: 0,
  status: 'caged',   // 'caged' | 'exiting' | 'active'
}

// game.js — estado global de modos (en el objeto game)
{
  modeTimer: 0,     // segundos acumulados en el tramo actual
  modeIndex: 0,     // índice en MODE_PHASES
  mode: 'scatter',  // 'scatter' | 'chase'
  elapsed: 0,       // segundos desde el inicio de la vida (para retrasos)
}
```

Convenciones:

- Coordenadas en celdas, origen arriba-izquierda.
- Velocidades en celdas por cuadro (sin cambios respecto al código actual).
- Retrasos y fases de modo en segundos de tiempo real (delta limitado a `0.1 s`).

---

## Plan de implementación

1. **Actualizar `src/js/maze.js`:** reemplazar `GHOST_STARTS` por las cuatro entradas con `id`, `name`, `x`, `y`, `color`, `corner` y `delay`. Verificación manual: la página carga sin errores y se dibujan cuatro fantasmas con sus colores.
2. **Delta de tiempo en `src/js/main.js`:** calcular `dt` con `performance.now()`, limitarlo a `0.1 s` y pasarlo a `update(game, dt)`. Verificación: consola sin errores; el juego se comporta como antes.
3. **Reloj de modos en `src/js/game.js`:** añadir `modeTimer`, `modeIndex`, `mode` y `elapsed` a `createGame`; implementar `MODE_PHASES = [7 scatter, 20 chase, 7 scatter, 20 chase, 5 scatter, 20 chase, 5 scatter, chase permanente]` y la inversión inmediata de dirección de fantasmas activos en cada cambio. Verificación: con DevTools se observa el cambio de `game.mode` en los segundos esperados.
4. **Liberación escalonada en `src/js/game.js`:** estados `caged`/`exiting`/`active`; al cumplirse `delay` el fantasma pasa a `exiting` y sigue la ruta controlada por la puerta hasta `(13,11)`, donde pasa a `active`. La puerta (`tile 3`) solo es transitable en `exiting`. Verificación: los cuatro salen en 0/2/4/6 s y ninguno reingresa a la jaula.
5. **Estrategias en `src/js/game.js`:** implementar los cuatro objetivos (`blinky`: Pac-Man; `pinky`: 4 delante; `inky`: proyección desde Blinky; `clyde`: umbral euclidiano de 8) y la selección de giro por heurística local con desempate `up > left > down > right`. Eliminar la lógica `hunter`/`random`. Verificación: cada color sigue un patrón distinto y observable.
6. **Reinicio por vida en `src/js/game.js`:** al colisionar, `resetPositions` también reinicia `modeTimer`, `modeIndex`, `mode`, `elapsed` y los estados de los fantasmas. Verificación: perder una vida regresa los cuatro a la jaula con sus retrasos; dots y puntuación se conservan.
7. **Render por identidad en `src/js/render.js`:** usar `g.color` en `drawGhost` en lugar de `GHOST_COLORS[i]`. Verificación: colores estables por fantasma en toda la partida.

---

## Criterios de aceptación

- [ ] La página carga sin errores en consola con `src/` servido por un servidor estático.
- [ ] Se dibujan cuatro fantasmas con colores rojo, rosa, cian y naranja desde el inicio de cada vida.
- [ ] Blinky sale de la jaula de inmediato; Pinky a los 2 s; Inky a los 4 s; Clyde a los 6 s.
- [ ] Ningún fantasma en estado `active` reingresa a la jaula durante la partida.
- [ ] Durante `chase`, Blinky se dirige a la celda de Pac-Man en cada intersección.
- [ ] Durante `chase`, Pinky tiende a cortarle el paso por delante de la dirección de Pac-Man.
- [ ] Durante `chase`, el objetivo de Inky depende de la posición de Blinky (comportamiento distinto con Blinky vivo en distinta posición).
- [ ] Durante `chase`, Clyde se aleja de Pac-Man cuando está a menos de 8 celdas (euclidiana) y lo persigue en caso contrario.
- [ ] Los modos cambian a los 7/20/7/20/5/20/5 segundos y luego permanecen en `chase`.
- [ ] Cada cambio de modo invierte la dirección de los fantasmas activos de forma observable.
- [ ] Al perder una vida, los cuatro fantasmas vuelven a la jaula, se reinician los retrasos y el calendario vuelve a `scatter` de 7 s.
- [ ] Perder una vida no restaura dots comidos ni reinicia la puntuación.
- [ ] Las colisiones quitan exactamente una vida; con vidas en 0 el juego termina en `lost`.
- [ ] El túnel en fila 14 sigue funcionando para Pac-Man y los cuatro fantasmas.
- [ ] Completar todos los dots muestra la pantalla de victoria y el botón de reinicio lanza una partida nueva limpia.

---

## Decisiones

- **Sí:** estrategias clásicas simplificadas (Blinky directo, Pinky 4 delante, Inky proyección desde Blinky, Clyde umbral de 8 euclidiano). Diferencias claramente observables sin reproducir el arcade exacto.
- **Sí:** nombres y colores clásicos con identidad estable en `GHOST_STARTS`. Facilita lógica, depuración y render.
- **Sí:** liberación escalonada 0/2/4/6 s con estados `caged`/`exiting`/`active`. Evita superposición inicial y da un arranque justo.
- **Sí:** ciclo global persecución/dispersión con calendario del nivel 1 clásico. Añade tensión rítmica sin estados extra por fantasma.
- **Sí:** Blinky participa de la dispersión (persigue solo durante `chase`). Respeta los modos clásicos; sigue siendo el más directo en persecución.
- **Sí:** relojes en tiempo real con delta limitado a `0.1 s`. Los intervalos son estables ante caídas de FPS y la pestaña en segundo plano no salta fases.
- **Sí:** inversión inmediata de dirección al cambiar de modo. Hace visible la transición y reproduce la regla clásica.
- **Sí:** heurística local con desempate `up > left > down > right`. Navegación fiel al arcade sin coste de pathfinding.
- **Sí:** objetivos proyectados (Pinky/Inky) se conservan aunque caigan en pared o fuera del mapa. La heurística local elige el giro que más se acerca.
- **Sí:** sin reingreso a la jaula para fantasmas activos; la puerta solo se usa al salir.
- **Sí:** misma velocidad (0.1) para los cuatro. Las personalidades provienen de objetivos, no de velocidad.
- **Sí:** reiniciar calendario de modos al perder una vida. Comportamiento clásico y predecible.
- **No:** energizantes y fantasmas vulnerables. Merece su propia especificación.
- **No:** ruta mínima real (pathfinding). La heurística local es suficiente y más barata.
- **No:** velocidades distintas por fantasma. Mezcla personalidad con dificultad sin necesidad.
- **No:** nombres visibles o leyenda en pantalla. Los colores bastan para distinguirlos.
- **No:** harness de pruebas automatizadas. Verificación manual dirigida con DevTools.
- **No:** migrar el movimiento a velocidades basadas en tiempo. Fuera de alcance; solo los relojes de modo/liberación usan tiempo real.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Ruta de salida por la puerta puede dejar fantasmas atascados si `(13,11)` no es alcanzable | Ruta fija y corta definida en el paso 4; verificar manualmente las cuatro salidas en cada vida. |
| Fantasmas podrían acorralar a Pac-Man de forma injusta en `chase` permanente final | Umbrales clásicos (Pinky 4, Clyde 8) y misma velocidad conservan escapatorias; ajustable tras pruebas manuales. |
| Delta grande al volver de segundo plano podría saltarse liberaciones | Delta limitado a `0.1 s` por cuadro. |
| Regresión en túnel/colisiones por el refactor de `decideGhost` | Criterios de aceptación cubren túnel, colisiones, victoria y reinicio. |

---

## Lo que **no** está en esta especificación

- Energizantes y fantasmas vulnerables.
- Reglas exactas adicionales del arcade (Cruise Elroy, velocidades por modo, frutas).
- Nombres visibles de fantasmas.
- Persistencia y pruebas automatizadas.

Cada uno de estos puntos, si llega, va en su propia especificación.
