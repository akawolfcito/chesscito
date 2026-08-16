# El Data Cache de Next servía lecturas viejas de Supabase

**Fecha:** 2026-08-16 · **Severidad:** P0 para el duelo, **abierto para 25 rutas más**
**Encontrado:** en el primer smoke de preview del duelo p2p, por el founder
**Arreglado:** sólo en las cinco rutas del duelo. El resto queda **reportado, no tocado**.

---

## 1. El síntoma

El invitado abría el enlace, el tablero aparecía un par de segundos, y la pantalla **volvía a
"JOIN THE GAME"**. Nadie podía mover. Pasaba en MiniPay, en el navegador del teléfono y en
desktop — o sea, sistemático, no de una plataforma.

## 2. Lo que lo cerró: la base y la API no decían lo mismo

| | status | version | asientos |
| --- | --- | --- | --- |
| **La fila, por psql** | `active` | 2 | los dos ocupados |
| **`GET /api/duel/[id]`** | `awaiting-opponent` | 1 | sólo blancas |

⛔ **El JOIN persistía perfecto.** El servidor contestaba un snapshot **anterior al JOIN**.

Y no era el CDN:

```
x-vercel-cache: MISS
age: 0
cache-control: public, max-age=0, must-revalidate
```

Un cache-buster en la query devolvía **lo mismo**. La ruta **corría** en cada request y aun así
leía viejo. El cache estaba **debajo** de la ruta.

## 3. La causa

En el App Router, **Next parchea `fetch` y cachea los GET por defecto**, y `supabase-js` habla
con PostgREST **por `fetch`**. Un `select` queda cacheado como cualquier otro GET — **entre
requests y entre usuarios**.

⚠️ **`export const dynamic = "force-dynamic"` NO lo evita.** Fuerza el *render* dinámico, no los
datos frescos. Las cinco rutas del duelo ya lo tenían y no sirvió de nada.

⚠️ **Y `next dev` no aplica ese cache**, que es exactamente por qué todo el desarrollo local, la
suite entera y el VR estaban verdes. Es un defecto que **sólo existe en un build real**.

## 4. El arreglo, acotado al duelo

`getSupabaseServer({ freshReads: true })` pasa un `fetch` propio que fuerza `cache: "no-store"`.

⛔ **Opt-in, no default.** Esta factory la comparten 34 archivos y cambiarle el comportamiento a
todos durante un freeze es un cambio que nadie pidió. Las cinco rutas del duelo la piden; nadie
más cambia.

⚠️ La propiedad vive en el **cliente**, no en cada ruta: una sexta ruta del duelo la hereda por
construcción en vez de por acordarse.

## 5. ⛔ Lo que queda ABIERTO, y es más grande que el duelo

**34 archivos** usan `getSupabaseServer()`. **25 de ellos hacen `.select(`** — o sea, lecturas
que pueden estar sirviéndose del mismo cache.

No están arreglados, y no es negligencia: arreglarlos es un cambio de comportamiento en
superficies que no se probaron en esta pasada, durante un freeze cuyo criterio explícito es
tocar **sólo bloqueantes probados**.

Lo que sí hace falta saber para priorizarlo:

- **Sólo afecta lecturas.** `insert`, `update`, `upsert` y `rpc` van por POST y no se cachean.
- **El daño depende de la frescura que cada superficie necesite.** Un leaderboard que se atrasa
  unos minutos es distinto de un balance de Peones que decide una compra.
- ⚠️ **Y hay un riesgo que no es de frescura sino de PRIVACIDAD**: el Data Cache es compartido
  entre requests, así que una lectura parametrizada por usuario podría, en principio, servirle a
  otro la respuesta del primero. Eso hay que verificarlo por superficie antes de asumirlo en
  cualquier dirección.

📌 **Próximo paso sugerido, fuera de este freeze:** auditar las 25 lecturas, clasificarlas por
frescura requerida y por si están parametrizadas por usuario, y decidir si `freshReads` pasa a
ser el default con excepciones explícitas.

## 6. Cómo no perder esto

- `src/lib/supabase/__tests__/fresh-reads.test.ts` fija que las cinco rutas del duelo lo pidan y
  que el default no cambie para nadie más.
- El comentario en `getSupabaseServer` lleva la medición al lado, no la conclusión sola.

## 7. La lección

⛔ **Un feature puede estar verde en todo lo que sabemos medir y roto en producción por algo que
`next dev` no ejecuta.** Suite de 687 archivos, VR 67/67, `tsc` limpio, y el duelo no se podía
jugar. Lo encontró un smoke en preview con dos dispositivos, que es exactamente lo que el
checklist de congelamiento exigía antes de declarar nada.
