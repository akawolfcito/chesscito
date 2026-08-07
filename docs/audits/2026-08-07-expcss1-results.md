# EXP-CSS1 — critical inline + resto diferido: **FAIL**

**Fecha:** 2026-08-07 · **Perfil:** Slow 4G + CPU 4×, persona MiniPay, build de producción.
**Estado:** probe **revertido**, árbol limpio. **El frente de CSS se cierra.**

> 🔴 **FAIL, y por una razón que no es la que esperaba:** la técnica automática
> (`experimental.optimizeCss` / critters) **no tiene ningún efecto** sobre el HTML del App
> Router. No inlineó una sola regla ni difirió una sola hoja. No es que el critical inline
> "no mejore el FCP": es que **no se aplicó**.

---

## Qué se probó

`experimental.optimizeCss: true` en `next.config.js` + `critters@0.0.25` como devDependency.
Build de producción limpio; la salida del build **confirma la flag activa**:

```
 ✓ Experiments (use with caution):
   · optimizeCss
```

## Qué hizo, exactamente

**Nada.** Documentado en las dos puntas, como pediste:

| Pregunta | Respuesta medida |
|---|---|
| ¿Qué CSS inyecta inline? | **Ninguno.** 0 bloques `<style>` en el HTML servido de `/` |
| ¿Cómo difiere la hoja restante? | **No la difiere.** Siguen los 2 `<link rel="stylesheet">` bloqueantes |
| ¿Reordena reglas? | No |
| ¿Introduce preload/onload? | No. 0 `rel="preload" as="style"`, 0 `<noscript>` |
| ¿Cambia el HTML servido? | **No.** Idéntico en estructura al build anterior |

Los 9 HTML prerenderizados en `.next/server/app/**` conservan sus **2 `<link>` de CSS y 0
`<style>` inline** (la única excepción, `_not-found.html` con 221 B, es de React, no de
critters).

### Por qué es inerte — la causa

Los `<link>` que emite este app llevan `data-precedence="next"`: **los inyecta React durante
el streaming del App Router**, no están en un `<head>` estático del template. Critters
post-procesa HTML terminado, así que no tiene sobre qué trabajar. La flag es de la era del
Pages Router.

## Medición de control

Una corrida bastó para confirmarlo de punta a punta:

| | Sin la flag | Con `optimizeCss` |
|---|---|---|
| **FCP** | 1.736 ms | **1.728 ms** |
| T2 | 4.114 ms | 4.246 ms |
| Bytes / requests | 409,5 kB · 39 | 409,5 kB · 39 |
| CSS bloqueante | 2 hojas | **2 hojas** |

⛔ **No corrí las 3 corridas ni el VR.** No tendría sentido gastar 10 minutos midiendo la
varianza de un cambio que el HTML demuestra que no existe: el artefacto servido es
equivalente. Medir más no habría producido información nueva.

## Gate

De los 10 criterios, el **#9 falla en la raíz**: *"el CSS restante realmente deja de bloquear
FCP"* → **sigue bloqueando**. Los demás son inevaluables porque no hubo cambio que evaluar.

⚠️ Sobre el FOUC, que era la cautela principal: **no llegó a haber riesgo**, porque nada se
difirió. Queda dicho que si alguna vez se prueba una técnica que sí difiera, la sonda ya está
escrita (muestrea `getComputedStyle('.hub-scaffold').display` cada 100 ms y reporta cuántos ms
el hub estuvo en el DOM **sin estilar**) — un FCP de 500 ms con el hub crudo 400 ms sería FAIL,
y con esa sonda es un número, no una discusión.

---

## Decisión: el frente de CSS se cierra

**El piso de FCP queda en ~1.736 ms**, impuesto por una hoja render-blocking de 55,5 kB
encoded / 305,2 kB decoded que termina de bajar a 1.690 ms.

**"No hacer nada" es la decisión vigente hasta nueva evidencia.**

⛔ **No encadeno EXP-CSS2.** Lo que queda sin probar es la opción 2 del discovery —critical
inline **a mano**— y no la corro por iniciativa propia por dos razones:

1. Es una **copia manual** de reglas que viven en `globals.css`, y este repo ya tiene escrito
   que una copia de este tipo no la delata ningún test observable.
2. Requiere además un mecanismo propio para que la hoja grande deje de bloquear, que en App
   Router **no es una opción de configuración** — sería trabajo de plomería sobre el `<head>`
   que Next controla.

Eso necesita una hipótesis nueva y una decisión tuya, no una cascada de intentos.

### Lo que este experimento sí deja

- **Un hecho durable:** `experimental.optimizeCss` no sirve en App Router. Cualquier plan
  futuro que lo liste como palanca —el handoff de junio lo listaba como #1— está desactualizado.
- El discovery con los porcentajes reales (4,7% para el shell, 10,8% para el hub) sigue
  siendo válido y es el punto de partida si algún día se retoma.
- La sonda de FOUC, escrita y lista.

## Estado del árbol

- `next.config.js` revertido · `critters` desinstalado · `pnpm-lock.yaml` restaurado.
- Sin cambios de CSS. Sin cambios de JSX. Nada que mergear de este experimento.
