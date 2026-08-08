# QA en device — fix del restore de contenido completado

**Fecha:** 2026-08-08 · **Commit:** `69ab885` · **Rama:** `main` local (sin pushear)
**Spec:** `docs/specs/2026-08-07-restore-completed-content.md`

⚠️ El túnel es **otro origen**, así que su `localStorage` está vacío: no arrastra el estado
de `learn.chesscito.com`. Hay que sembrarlo.

---

## 0. Verificar el prefijo de claves (5 s)

El prefijo es `chesscito:` salvo que el build tenga `NEXT_PUBLIC_LITE_PROGRESS_VERSION`, que
lo vuelve `chesscito:lite:<version>:`. Confirmalo antes de sembrar:

```js
Object.keys(localStorage).filter(k => k.includes("chesscito"))
```

Si ves `chesscito:lite:algo:progress:...`, cambiá `P` en el snippet de abajo.

## 1. Sembrar el estado del bug

Pegar en la consola **de la pestaña del túnel**, y **recargar**:

```js
const P = "chesscito:";                     // ← ajustar si el paso 0 mostró otro prefijo
localStorage.setItem(P + "progress:rook", JSON.stringify({
  piece: "rook", currentId: "rook-3",
  stars: { "rook-1": 3, "rook-2": 3, "rook-3": 3 },   // 9★ > el gate de 6★ + 3 ejercicios
}));
localStorage.setItem(P + "labyrinth-best:rook", JSON.stringify({
  "rook-rail-two-turns": 12,
  "rook-rail-dead-end": 6,
  "rook-rail-two-roads": 6,
  "rook-rail-rook-run": 10,                 // los cuatro terminados
}));
localStorage.setItem(P + "training-content:rook", "rook-rail-rook-run");  // el puntero rancio
location.reload();
```

Eso reproduce **exactamente** el estado de tu cuenta de prod: los cuatro bests escritos y el
último contenido jugado apuntando a `Rook Run`.

---

## 2. El caso principal — AC-1 + AC-2

- [ ] Ir al **hub** y tocar la **torre**.
- [ ] ✅ **NO** aterrizás dentro de `Rook Run`. No hay tablero de laberinto montado.
- [ ] ✅ Se abre la **senda** (el drawer de Special Training) con los cuatro nodos.
- [ ] ✅ Los cuatro se ven **completados**. Ese es el punto: antes el progreso era invisible.
- [ ] ✅ La pantalla **no** queda colgada cargando.

⚠️ **`Rook Run` SÍ aparece como texto** — es el título del nodo dentro de la senda, y es
correcto (decisión B4.2.3). Lo que no debe aparecer es el **tablero**.

## 3. Contra-chequeo: el tap explícito sigue abriendo — AC-4

- [ ] Con la senda abierta, tocar el nodo **`Rook Run`**.
- [ ] ✅ **Abre el laberinto**. Rejugar algo terminado a propósito es legítimo; el filtro es
      exclusivo del restore implícito.
- [ ] Salir y volver a entrar a la torre → ✅ vuelve a caer en la senda, no en el tablero.

## 4. Contra-chequeo: una pieza a medias no cambió

- [ ] Ir a una pieza con laberintos **sin terminar** (p. ej. el alfil, sin sembrar nada).
- [ ] ✅ El flujo de ejercicios funciona igual que siempre.
- [ ] Entrar a un laberinto, salir sin terminarlo, volver a la pieza.
- [ ] ✅ Lo **reabre** — un laberinto sin `best` no está completo, así que el restore lo sirve.

## 5. Contra-chequeo del borde: terminado pero NO al óptimo

La regla es "cualquier llegada", no "3 estrellas". Para probarlo:

```js
const P = "chesscito:";
localStorage.setItem(P + "labyrinth-best:rook", JSON.stringify({
  "rook-rail-two-turns": 99,   // pésimo, pero terminado
  "rook-rail-dead-end": 99,
  "rook-rail-two-roads": 99,
  "rook-rail-rook-run": 99,
}));
localStorage.setItem(P + "training-content:rook", "rook-rail-rook-run");
location.reload();
```

- [ ] ✅ Tampoco lo re-sirve. Si acá cayeras en el tablero, la implementación estaría
      chequeando el óptimo en vez de la completitud.

---

## Limpiar al terminar

```js
Object.keys(localStorage).filter(k => k.includes("chesscito")).forEach(k => localStorage.removeItem(k));
location.reload();
```

---

## Lo que este checklist NO puede mostrar

- **La precedencia `locked > completed`.** No tiene consecuencia observable hoy: en un restore
  las dos acciones asientan igual, y el CTA de unlock lo rutea el drawer por su cuenta. Vive
  como contrato en el tipo, no como comportamiento.
- **El laberinto gateado por pass.** Necesita una cuenta sin Challenge Pass y un nodo con
  `access: "training_pass"`; hoy sólo `knight-tour-*` lo tiene. Cubierto por
  `training-pass-screen-integration` y por el guard nuevo.
