# Red team — CLS 0,179 / `align-self: stretch`

**Spec:** `2026-08-07-hub-anchor-cls-fix.md` · **Pases:** 2
**Veredicto: READY** — 1 P0 resuelto dentro del spec, 3 P1 incorporados, ningún P0 abierto.

---

## Pase 1

### P0-1 — El fix no tiene ningún test que lo defienda

`align-self: stretch` es una línea de CSS cuyo efecto **sólo existe en un motor de layout
real**. jsdom no calcula layout, así que **ni un solo test de la suite puede ver la
diferencia**: borrar la declaración deja los 7.468 tests en verde y el CLS vuelve.

Y el VR tampoco lo protege: fotografía el **estado final**, que es idéntico con y sin el fix.
⛔ Es decir: **el frente entero se puede revertir por accidente sin que nada se ponga rojo.**

Es exactamente el patrón que este repo ya tiene documentado — una propiedad de layout cuya
ausencia no la delata nada observable.

**Resolución — obligatoria en el spec:**

1. **Guard de fuente** que asserte que `.hub-scaffold-anchor` declara `align-self: stretch`,
   **con el porqué en el propio test** (no un assert desnudo: un comentario que explique que
   sin eso el item se dimensiona por contenido y el CLS vuelve).
   ⚠️ Es un guard de implementación, y se declara como tal. Es lo único que un test puede ver.
2. **La sonda de la ventana colapsada queda versionada** o, como mínimo, documentada en el
   informe de cierre como el camino de re-validación. Sin eso, la próxima persona no tiene
   forma de reproducir AC1/AC2.

→ Incorporado como **AC15** (guard de fuente) y **AC16** (camino de re-validación documentado).

### P1-1 — "El estado final es idéntico" es cierto **por coincidencia numérica**

El spec lo declara en E2, pero conviene subrayar el riesgo: hoy coinciden **porque el ancho
intrínseco de la imagen (256 px) supera la columna (234 px)**, así que el shrink-to-fit siempre
topa. No es una propiedad del diseño: es una relación entre dos números que nadie está
vigilando.

Si mañana `--app-max-width` sube o el asset del portal se re-exporta más chico, `stretch` y
`center` dejan de coincidir y **el VR se pondrá rojo por una causa que nadie va a asociar a
este commit**.

**Resolución:** queda en E2 del spec **y** en el informe de cierre, con la condición explícita
(`columna < ancho intrínseco del portal`). No se agrega guard: vigilar dos números que hoy no
se tocan sería una alarma que nadie va a mantener.

### P1-2 — Validar con CLS puede dar un falso verde

Ya está en AC5, pero el red team lo confirma como el riesgo más probable de **auto-engaño**:
2 de 5 corridas del baseline dieron 0,0000 **con el defecto presente**. Un implementador
apurado corre una vez, ve 0,0000 y declara éxito.

**Resolución:** AC5 exige ≥ 4 corridas y **AC1/AC2 son los criterios primarios** — la causa es
determinista, el efecto no. Si los dos conjuntos se contradicen, **manda la causa**.

### P1-3 — El shift podría mudarse, no desaparecer

Cubierto por E4, pero el AC estaba flojo: AC5 mide el shift *atribuible*, y AC6 el CLS total.
Falta el caso "aparece un shift nuevo en otro nodo".

**Resolución:** AC6 se reformula para exigir que **no aparezca ningún `layout-shift` con
`sources` distintos de los conocidos** — el instrumento ya captura los nodos, así que es
gratis.

---

## Pase 2 — atacado y NO resultó hallazgo

- **"`stretch` va a descentrar los hermanos"** → no: es `align-self` en un item, no
  `align-items` en el contenedor. `AppModeSwitch` y `hub-scaffold-center-stack` no se tocan.
- **"`min-width: 0` del anchor va a interferir"** → no: en una columna flex el eje transversal
  es el horizontal, y `min-width: 0` sólo baja el mínimo automático; con `stretch` el ancho lo
  fija el contenedor.
- **"Va a romper 360 × 640"** → no hay razón mecánica (la columna es más angosta y el
  `aspect-ratio` sigue mandando), pero **se verifica igual**: E1 y el proyecto `minipay-360`.
- **"Puede afectar otras superficies"** → no: `.hub-scaffold-anchor` aparece en un solo lugar
  del código.
- **"El `aspect-ratio` podría no aplicar sin la imagen"** → **medido que sí**: con `stretch`
  inyectado, el anchor midió 234 × 363,8 con `naturalWidth = 0`. El alto salió del ratio, no
  del asset.

---

## Veredicto

**READY.** El único P0 no está en el fix sino en su **protección**, y se resuelve con dos AC
nuevos. Sin P0 abiertos.

### AC incorporados al spec

- **AC15** — Guard de fuente: `.hub-scaffold-anchor` declara `align-self: stretch`, con la
  razón escrita en el test. Declarado explícitamente como guard de **implementación**, porque
  es lo único que un test puede ver.
- **AC16** — El camino de re-validación (sonda de la ventana colapsada) queda documentado en el
  informe de cierre, con el comando exacto.
- **AC6 reformulado** — no aparece ningún `layout-shift` con `sources` fuera de los conocidos.
