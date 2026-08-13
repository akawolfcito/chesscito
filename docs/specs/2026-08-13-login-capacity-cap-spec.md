# Spec — Tope de capacidad de login (login-capacity-cap)

**Date**: 2026-08-13
**Status**: draft
**Origen**: founder, 2026-08-13 — *"si no tenemos bien definido ese límite existe justo el caso en
el que se dispare y tengamos una deuda imposible de pagar"*.

---

## Problem

El acceso web lo concede el **allowlist nativo de Privy**. Es un control real (server-side, sin
bypass de cliente) pero **es de Privy**: para abrirlo o cerrarlo hay que entrar al dashboard, y no
tiene forma de decir *"dejá entrar hasta N y después mandá al resto a la waitlist"*.

El riesgo que preocupa es **financiero, no de seguridad**: el plan Core de Privy es gratis de 0 a
**499 MAU** y pasa a **$299/mes** desde 500. Un pico orgánico cruza ese número sin que nadie apriete
nada, y la factura llega igual.

## Goal

Que **nuestro código** decida cuándo se deja de admitir gente, con un umbral **parametrizable sin
redeploy**, mandando al excedente a la waitlist en vez de perderlo.

---

## ⛔ Lo primero, porque cambia el cálculo: un tope de ALTAS no acota la factura

Privy define MAU como *"a user who has had their session refreshed in the past thirty days"*.

**Eso incluye a los que VUELVEN, no sólo a los nuevos.** Consecuencias:

- **499 usuarios existentes que entran este mes = 499 MAU, con cero altas nuevas.** Un tope sobre
  registros no baja ese número ni un punto.
- **Cerrar el alta cuando ya estás cerca del límite no te devuelve margen.** Sólo evita empeorarlo.
- El contador es una **ventana móvil de 30 días**, así que baja solo cuando alguien deja de entrar
  durante un mes. No hay un "reset" mensual que puedas esperar.

⚠️ **Por lo tanto el tope acota el CRECIMIENTO DEL POZO, no el gasto.** Es la herramienta correcta
para el riesgo que el founder describe —*que se dispare*— y hay que instalarla **antes** de estar
cerca, no cuando ya se disparó. Instalada tarde, no sirve.

**El número a vigilar no es "cuántas cuentas hay" sino "cuántas personas distintas refrescaron
sesión en los últimos 30 días".** Son cosas distintas y el tope tiene que contar la segunda.

---

## ¿Puede ser una regla dura en código?

**Efectivamente sí para el riesgo real; formalmente no.** La distinción importa:

| | |
| --- | --- |
| **Contra un pico orgánico** (el riesgo del founder) | ✅ **Sí, es duro.** Los usuarios reales pasan por nuestra UI; si no llamamos a `login()`, no se gasta MAU. |
| **Contra alguien que quiera saltárselo** | ❌ **No.** El chequeo vive en nuestro cliente. Quien **concede** el login sigue siendo Privy. |

⛔ **Por eso el tope se llama PRESUPUESTO y nunca gate.** Si se lee como control de acceso, alguien
apaga el allowlist *"porque ya tenemos el tope"* y el acceso queda abierto de par en par. **El
allowlist de Privy sigue siendo el candado; esto es el termostato.**

### Dónde va, y por qué exactamente ahí

En `startLogin()` (`components/web-access-gate.tsx:116-121`), **justo encima de la llamada a
`login()` de la línea 120**.

⛔ **Un tope que viva después de `login()` llega tarde por construcción**: Privy cuenta el MAU al
refrescar la sesión, así que el login **ya gastó** lo que el tope quería proteger. Un contador
consultado después no protege — sólo informa de lo que se fue. Ese error se cometió en la v1 del
diseño de acceso web y lo corrigió el founder.

---

## Contracts (SDD)

```ts
/** Umbral y estado, leídos SERVER-SIDE. El cliente no decide y no cuenta. */
export type LoginCapacity = {
  /** ¿Se admite un login más? Lo único que el cliente necesita saber. */
  open: boolean;
  /** Sólo para nuestros paneles. ⚠️ NO se envía al cliente: decirle a un
   *  visitante "quedan 3 lugares" es una carrera y una invitación a forzarla. */
  used?: number;
  limit?: number;
};

/** La perilla. Vive en una FILA, no en un env var: un env var necesita redeploy,
 *  que es justo lo que el founder pidió evitar. */
export type LoginCapacityConfig = {
  /** Tope efectivo. ⚠️ Debe ir por DEBAJO del límite del plan (499). Ver §Race. */
  limit: number;
  /** Apagar el tope sin borrarlo, para reabrir en un tap. */
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
};
```

`GET /api/access/capacity` → `LoginCapacity`. Sin autenticación (es previo al login), con rate
limit y cacheable pocos segundos.

---

## Behavior

1. Dado un visitante web sin sesión, cuando el gate va a llamar a `login()`, entonces primero
   consulta la capacidad; si `open`, sigue como hoy.
2. Dado `open: false`, entonces **no se llama a `login()`** y el visitante ve la waitlist que ya
   existe (`EarlyAccessRequest`) — **no** un error.
3. Dado un usuario que **ya tiene sesión**, entonces el tope **no lo toca**. Cerrar la puerta a
   quien ya está adentro no ahorra nada (su MAU ya está contado) y le rompe el producto.
4. Dado MiniPay, entonces el tope **no aplica**: no pasa por Privy y no gasta MAU.
5. Dado que la consulta de capacidad **falla** (red, DB caída), entonces se permite el login.
   ⚠️ **Fail-open a propósito**: el costo de un error es una factura; el de fail-closed es que
   nadie entra a la app. Y el allowlist de Privy sigue debajo como red.
6. Dado `enabled: false`, entonces siempre `open: true` — es el interruptor para reabrir sin deploy.
7. Dado un cambio de `limit` en la fila, entonces surte efecto en la siguiente consulta,
   **sin redeploy**.

---

## Edge cases

- **La carrera del umbral.** N visitantes tocan ENTER a la vez; todos leen `open: true` y todos
  entran. El chequeo **no puede ser transaccional con el contador de Privy**, así que el tope
  siempre puede sobrepasarse un poco. **Mitigación: fijar `limit` con margen** (p. ej. 460 sobre
  499), y tratar el margen como parte del diseño, no como un bug.
- **De dónde sale `used`.** Hay que contar personas distintas con sesión refrescada en 30 días.
  ⚠️ **Si lo contamos nosotros, es una estimación de un número que lleva Privy** — y dos contadores
  del mismo hecho derivan. Hay que decidir cuál manda y aceptar el error del otro.
- **Un visitante rechazado que insiste.** No debe poder forzar el login recargando; y como no se le
  dice cuántos lugares quedan, tampoco puede cronometrar el intento.
- **Reabrir.** Subir `limit` no re-admite a nadie automáticamente: los que se fueron a la waitlist
  no vuelven solos. Hay que decidir si se les avisa.

---

## Acceptance criteria

- [ ] Con `open: false`, `login()` **no se llama** (aserción sobre el hook de Privy, no sobre la UI).
- [ ] Con `open: false`, el visitante ve la waitlist, no un error.
- [ ] Un usuario con sesión existente entra con `open: false`.
- [ ] MiniPay no consulta la capacidad ni la respeta.
- [ ] Si `/api/access/capacity` falla o tarda, el login procede (fail-open).
- [ ] Cambiar `limit` en la fila cambia el comportamiento **sin redeploy**.
- [ ] `enabled: false` reabre por completo.
- [ ] La respuesta al cliente **no** incluye `used` ni `limit`.
- [ ] `GET /api/access/capacity` tiene rate limit.

---

## Open questions

1. **¿Cuál es el número?** No lo puedo elegir yo: depende de cuánta factura estás dispuesto a pagar
   y de si querés margen para el pico. Sólo sé que **debe ser menor que 499** por la carrera.
2. **¿Quién cuenta?** ¿Nuestra DB (estimación, pero nuestra) o la API de Privy (autoritativa, pero
   dependencia externa)? **No verifiqué si Privy expone ese contador por API** — hay que
   comprobarlo antes de diseñar el contador, no asumirlo.
3. **¿Y si el pozo ya está alto?** El tope no baja MAU. Si al medir ya estás cerca de 499, el tope
   evita empeorar pero no evita la factura de este mes. **Medir primero, instalar después.**
4. **¿Se avisa a quien quedó en la waitlist cuando se reabre?** Sin eso, cerrar es perderlos igual —
   que es justo lo que el founder quiere evitar.
