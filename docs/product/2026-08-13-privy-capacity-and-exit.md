# Los 499 de Privy: qué hacer ahora, y qué pasa si se llenan

**Fecha:** 2026-08-13 · **Estado:** análisis, no decisión
**Origen:** founder — *"tenemos a lo sumo 3-5 de esas 499 que son pruebas… se puede convertir en
una base para la monetización… no sé si es posible otra solución después de Privy"*.

---

## 1. La prioridad se invierte: el tope NO es lo urgente

Con el allowlist **prendido** y ~5 de 499 ocupadas, el riesgo de factura sorpresa **hoy no existe**:
nadie puede entrar sin que vos lo habilites. El `login-capacity-cap-spec` sigue siendo correcto,
pero su propia sección lo dice — **medir primero, instalar después**, y construirlo ahora sería
poner un termostato en una casa vacía.

⛔ **Lo que sí falta es VISIBILIDAD, y es barato.** No se puede administrar un presupuesto que no se
ve. Hoy no hay forma de contestar *"¿cuántas personas distintas refrescaron sesión en los últimos 30
días?"* sin entrar al dashboard de Privy a mirar.

**Lo mínimo, y probablemente lo único que hace falta este mes:** marcar cada cuenta creada vía Privy
en nuestra DB al momento del login, con su fecha de última sesión. Con eso:

- el número se ve en `pnpm ops:health` junto a todo lo demás;
- el día que haga falta el tope, el contador **ya existe** y sólo hay que ponerle un umbral;
- y deja de depender de que alguien se acuerde de abrir el dashboard.

⚠️ **Con la salvedad ya escrita en el spec del tope:** si contamos nosotros, son **dos contadores
del mismo hecho** (el nuestro y el de Privy) y van a derivar. El nuestro sirve para decidir; el de
Privy es el que factura.

---

## 2. Los 499 no son un techo: son una LÍNEA DE DECISIÓN

El founder tiene razón en que 499 "es mucho". Pero el número importante no es 499, es **500**:
ahí el plan pasa de **$0 a $299/mes**.

Eso convierte la pregunta técnica en una de negocio, y es sana:

> **¿El usuario número 500 hace que la base entera genere más de $299/mes?**

- **Si sí** → el límite no es un problema, es un costo variable que se paga solo. Se paga y se sigue.
- **Si no** → crecer por web **pierde plata**, y el tope no es un seguro: es la decisión correcta.

⛔ **Y por eso el tope no debería ser una carrera para llegar a 499.** Un pozo lleno de cuentas que
no monetizan cuesta $299/mes y no devuelve nada — y como el MAU es una **ventana móvil de 30 días**,
sólo baja cuando esa gente deja de entrar durante un mes entero. Es un costo difícil de revertir.

**Lo que esto pide medir, antes que ninguna otra cosa:** de las cuentas que ya entran, cuántas
generan alguna transacción. Ese ratio decide todo lo de arriba, y es una consulta, no un feature.

---

## 3. ⛔ El costo de salir de Privy que nadie ha puesto en la balanza

**Las insignias son soulbound.** `BadgesUpgradeable.sol:142`: *"Badges are non-transferable
(soulbound). Only minting (from == address(0)) is allowed."* Y Peones, scores y ranking van todos
**por dirección de wallet**.

La consecuencia es dura:

> **Cambiar de proveedor de auth significa que los usuarios estrenan direcciones. Sus insignias no
> pueden moverse — el contrato revierte toda transferencia.**

Se puede paliar (re-mintear en la dirección nueva, mapear la vieja a la nueva), pero eso es **una
migración con gas, con decisiones y con riesgo**, no un cambio de librería.

⚠️ **Y el costo crece con el tiempo**: cuantas más insignias y más saldo haya, más cara es la
salida. Hoy, con ~5 cuentas de prueba, **la salida es prácticamente gratis**. Con 400 usuarios
reales, no.

**Eso hace que "¿nos quedamos en Privy?" sea una decisión con fecha de vencimiento.** No es urgente,
pero tampoco es indefinidamente barata, y conviene decidirla mientras siga siendo barata.

---

## 4. Si llegan muchos: las salidas, en orden de costo

### a) Empujar el crecimiento por MiniPay `[la más barata, y ya existe]`

⚠️ **MiniPay no toca Privy y no gasta un solo MAU.** `WebAccessGate` **nunca se monta** ahí. O sea
que **el crecimiento por MiniPay ya es gratis e ilimitado desde el punto de vista de esta factura**.

Eso reencuadra el problema entero: la web no es el canal de crecimiento, es el **canal medido**.
Si mañana llegan mil personas por MiniPay, no pasa nada. El tope y el waitlist sólo gobiernan la web.

**Es la opción que no requiere construir nada** — sólo decidir que la web es un canal limitado a
propósito.

### b) Pagar los $299 y seguir

Si el ratio de la §2 da bien, esto es lo correcto y no hay más discusión.

### c) Cambiar de proveedor

⚠️ **No verifiqué precios ni features actuales de ninguna alternativa, y cambian seguido.** Lo que
sí es estructural:

- El mercado de *embedded wallet + social login* tiene varios competidores directos (Dynamic,
  Web3Auth, Turnkey, Para, Magic, thirdweb, entre otros). **Cualquier comparación tiene que
  verificarse contra su pricing del día, no contra lo que yo recuerde.**
- **El criterio de selección no es el precio: es si permite EXPORTAR la clave del usuario.** Un
  proveedor del que se pueda salir con la misma dirección elimina el problema de la §3 para siempre.
  Ése es el eje de comparación que importa, y hoy no sabemos si Privy lo permite — **hay que
  comprobarlo, y es la pregunta más valiosa de todo este documento.**
- Un cambio de proveedor es **un frente completo**, del tamaño del acceso web entero. No entra
  "de paso".

### d) Auth propia + firmante

El máximo control y el máximo trabajo. Sólo tiene sentido si el producto llega a una escala donde
$299/mes es ruido — y en ese escenario el problema ya no es este.

---

## Qué hacer, concretamente

1. **Marcar las cuentas de Privy en nuestra DB** al login, con fecha de última sesión. Barato, y es
   el prerrequisito de todo lo demás.
2. **Medir el ratio de monetización** de las cuentas que ya entran. Es una consulta.
3. **Averiguar si Privy permite exportar la clave del usuario.** Decide si la §3 es un problema
   permanente o desaparece. **Es la pregunta más barata y la de mayor impacto.**
4. **Dejar el tope sin construir** hasta que (1) exista y (2) diga algo.
5. **No tratar los 499 como una meta.** Llegar a 500 con cuentas que no monetizan es empezar a
   pagar $299/mes por nada, con una ventana de 30 días para revertirlo.
