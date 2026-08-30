# Auditoría de los commits sin pushear — 2026-08-29

**Medido, no recordado:** `git rev-list --count origin/main..main` → **56** (el handoff decía 55;
envejeció con su propio commit). `origin/main` está en `37b8ba20`.

⚠️ **Trampa de herramienta encontrada durante esta auditoría.** Una corrida de
`git log --oneline origin/main..main` devolvió **50** de los 56, truncando **los 6 más viejos**
(`9b1f2332`, `84c566be`, `d5993466`, `89bf5d35`, `d8dc27e8`, `7372368a`, del 21–22/08). El mismo
comando devolvió 56 en corridas posteriores, así que es **intermitente y no lo pude reproducir**;
no afirmo causa. Lo que sí queda: **`rev-list --count` y `rtk proxy git log` coincidieron siempre
en 56**. Una auditoría construida sobre la salida cruda de `git log` acá pudo perder 6 commits sin
avisar. Cruzá siempre contra `rev-list --count`.

---

## 1. Los 56, por grupo

| # | Fecha | N | Grupo | Qué es |
| --- | --- | ---: | --- | --- |
| G1 | 08-21/22 | 8 | **Arte de minijuegos + `/dev`** | Los 6 iconos en carpeta propia, un icono deja de compartir arte con una pieza, 4 baselines del Learn Hub adoptadas, `/dev` pasa a índice clickeable |
| G2 | 08-23 | 5 | **Language brief v1.1 + piece-complete** | El brief mide píxeles y fija puntuación; el piece-complete nombra la pieza y suma sus 4 estados |
| G3 | 08-25 | 13 | **Pausa del Season Pass + Inbox V0** | La venta queda pausada con los accesos intactos; PRO expira; Inbox V0 entero (tabla, API, pantalla, chip) |
| G4 | 08-26 | 3 | **Propagación de la pausa** | La pausa se decide antes del loading; el mini-tour y la sheet de compra dejan de vender lo pausado |
| G5 | 08-27 | 16 | **`/pricing` público + audits** | Página pública de precios en `apps/landing`; el carrusel obedece la misma perilla; audits de compradores y de PLAY |
| G6 | 08-28/29 | 11 | **Core loop, CTA y color** | Los 8 del handoff + 3 de docs. JUGAR OTRA primaria, replay instantáneo, pase visual morado, CTA del hub |

**135 archivos** tocados: 72 en `apps/web/src`, 24 en raíz/otros, 16 docs, 12 arte, 5 scripts, 5 e2e.

---

## 2. Hallazgos que cambian el perfil del push

### ⛔ R1 — El push despliega DOS producciones, no una

`apps/web/.vercel` y `apps/landing/.vercel` son **dos proyectos Vercel enlazados en este mismo
monorepo**. El push a `origin/main` dispara ambos.

Lo que eso publica que no es la app: **`chesscito.com/pricing`, una superficie pública nueva**
(G5, `87d49fc5`+7), más su entrada en el `sitemap.ts` y un cambio en el `middleware.ts` de la
landing. Es lo único de esta tanda que un buscador puede indexar.

✅ **Verificado que no contradice la pausa:** `apps/landing/src/lib/pricing/plans.ts` **no lista el
Season Pass** a propósito («Sales were paused on 2026-08-25»), y dos commits del grupo
(`311fa372`, `53931838`) existen precisamente para que el carrusel obedezca la misma perilla que la
venta real. La página no cotiza lo pausado.

### ⚠️ R2 — Hay una migración sin aplicar en el rango

`apps/web/supabase/migrations/20260825000000_inbox_v0.sql` — crea `inbox_messages`, dos índices,
RLS habilitada y una policy `deny_all_direct_client_access`.

**Si no se aplica en prod, el Inbox queda inerte — pero NO rompe el hub.** Verificado en código, no
supuesto:
- `use-inbox.ts` atrapa el fallo y cae en `status: "error"`, que **no pinta badge** («An inbox that
  cannot load must never block the Hub»).
- `inbox-chip.tsx` **no se monta sin wallet** (`if (!address) return null`).

Consumidores: el chip va en el header de **los dos hubs** (`play-hub-*`, `learn-hub-*`,
`hub-lite-scaffold`), así que la superficie afectada es la principal — razón de más para aplicarla,
aunque el fallo sea silencioso y no un 500 en pantalla.

⛔ **Si está aplicada o no, se MIDE contra prod.** No lo verifiqué: no tenía sentido abrir la base
sin que me lo pidieras. Es la única acción pendiente asociada a este push.

### ⚠️ R3 — La pausa de la venta es opt-IN: al desplegar, la oferta desaparece sola

`isSeasonPassSalesEnabled()` lee `NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED === "true"`, y **la ausencia
significa pausado**. Es intencional y está documentado en `feature-flags.ts` con su evidencia (17
wallets compraron, 10 nunca registraron un Focus Day, 0 de 18 terminaron los 21 días).

Consecuencia operativa: **no hay nada que hacer para pausar, pero si en algún momento querés
reactivar, es un env var y un redeploy** — sin migración ni cambio de código. La pausa **no revoca
accesos**: quien pagó conserva entitlement, Focus Days y card.

### ✅ R4 — Nada sensible en el rango

Sin `.env`, sin claves, sin `private/`. El único archivo sin trackear es
`docs/audits/2026-08-28-docker-footprint-audit.md`, ajeno a estas sesiones.

---

## 3. Veredicto

**Los 48 commits viejos (G1–G5) no son deuda desconocida ni trabajo a medio terminar.** Son cinco
ciclos cerrados y coherentes, cada uno con su handoff y sus audits commiteados. El riesgo real del
push no está en su cantidad: está en **R1** (se publica una superficie pública nueva en un segundo
proyecto de producción) y en **R2** (una migración que conviene aplicar para que el Inbox haga algo).

Ninguno de los dos es un bloqueante para pushear.
