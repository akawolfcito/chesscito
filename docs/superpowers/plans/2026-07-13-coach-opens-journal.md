# Coach abre el Diario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** El tile del Coach en el dock de PLAY deja de abrir el paywall y abre el Diario, para
que un jugador free descubra que el análisis existe antes de que se le pida pagar por él.

**Architecture:** No construimos superficie nueva: `/coach/history` **nunca estuvo bloqueado por
PRO** — el único que lo escondía era un `if` en el dock. Se cae ese `if`, se cae el badge PRO del
tile, y la venta se muda adentro del diario (donde el CTA "Ask Coach" consciente de créditos ya
vive). Dos arreglos que salieron del red team viajan en el mismo diff: la rama **sin wallet** del
diario gana un CTA de conectar real (hoy es una frase sin botón, y el ProSheet que sacamos era el
embudo de conexión), y los eventos de compra de PRO ganan la dimensión `source` sin la que la
decisión no sería reversible con datos.

**Tech Stack:** Next.js 14 App Router · TypeScript · Vitest + RTL · Playwright (VR) ·
next-intl (`editorial.ts` = EN, `messages/es.ts` = ES)

## Global Constraints

- **Spec:** `docs/specs/2026-07-13-coach-opens-journal-spec.md`. **Red team:**
  `docs/specs/2026-07-13-coach-opens-journal-redteam.md`. No re-especificar.
- **Scope: hub de PLAY únicamente.** LEARN no se toca (ahí el chip del Coach ni se renderiza en
  Lite — es otra conversación).
- **Copy en inglés**, y toda clave nueva va a **los dos** catálogos (`editorial.ts` + `es.ts`) o
  `audit-content-messages` se queja de la asimetría.
- **Nunca escribir el precio como texto.** Se interpola desde `rail-config.ts`.
- **Command hygiene:** nunca prefijar con `cd`; usar `pnpm -C <ruta-absoluta>` y
  `git -C <ruta-absoluta>`. Un comando por llamada, sin pipes ni heredocs.
- **Typecheck:** `pnpm -C apps/web exec tsc --noEmit` pelado.
- **Gate de calidad:** suite verde + `tsc` limpio **antes** del merge local. Commits atómicos.
- Ruta absoluta del repo:
  `/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito`
  (abreviada como `<REPO>` de acá en adelante).

## Desviación del spec — leer antes de la Task 4

El spec §4 pedía una taxonomía nueva de CTAs
(`"coach_dock" | "journal" | "pro_chip" | ...`) pasada por `openSheet(source)`.
**No se construye así**, y el motivo es que el ProSheet **ya tiene** un `source`:

```tsx
// pro-sheet.tsx:138-139 — ya existe
const livePathname = usePathname();
const [source] = useState<string>(() => livePathname ?? "/");
```

Es el **pathname**, congelado al abrir. No distingue "chip PRO" de "tile Coach" (los dos son
`/`), pero **sí distingue la superficie**, y después de este cambio un ProSheet abierto desde el
diario llega con `/coach/history` o `/coach/<gameId>`. Eso responde exactamente la pregunta que
el spec necesita responder —*¿compraron **desde** el diario?*— sin inventar taxonomía y sin tocar
los ~15 call sites de `openSheet()` en arena/exercises/profile/hub.

**Lo único que falta** es que `pro_purchase_started` y `pro_purchase_confirmed` lo lleven; hoy solo
`pro_extend_tap` lo emite (`pro-sheet.tsx:413`).

**Limitación aceptada y explícita:** esto atribuye por **superficie**, no por **CTA dentro de una
superficie**. Si algún día hace falta separar "chip PRO" de "tile Coach" dentro del mismo hub,
ahí se agrega el parámetro explícito. Hoy no hace falta y el costo no se justifica.

---

### Task 1: El Coach abre el Diario, y el tile pierde el badge PRO

**Files:**
- Modify: `apps/web/src/components/hub/play-hub-client.tsx:98-102`
- Modify: `apps/web/src/components/hub/play-hub-scaffold.tsx:198-204`
- Test: `apps/web/src/components/hub/__tests__/play-hub-client.test.tsx`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: nada que otras tasks consuman. Task aislada.

- [ ] **Step 1: Invertir el test del paywall (rojo)**

En `play-hub-client.test.tsx`, **reemplazar** la aserción existente que dice que un usuario sin
PRO recibe el ProSheet. El test nuevo fija lo contrario:

```tsx
it("routes to the journal instead of the paywall when PRO is inactive", async () => {
  const user = userEvent.setup();
  renderPlayHub({ proActive: false });

  await user.click(screen.getByRole("button", { name: /coach/i }));

  expect(pushMock).toHaveBeenCalledWith("/coach/history");
  expect(screen.queryByTestId("pro-sheet")).not.toBeInTheDocument();
});

it("keeps routing PRO holders to the journal", async () => {
  const user = userEvent.setup();
  renderPlayHub({ proActive: true });

  await user.click(screen.getByRole("button", { name: /coach/i }));

  expect(pushMock).toHaveBeenCalledWith("/coach/history");
});

it("does not brand the Coach tile as PRO-locked", () => {
  renderPlayHub({ proActive: false });

  const coachTile = screen.getByRole("button", { name: /coach/i });
  expect(within(coachTile).queryByText("PRO")).not.toBeInTheDocument();
});
```

> Usar el helper de render y el mock del router que **ya existen** en ese archivo — no inventar
> nombres nuevos. Si el helper actual no acepta `proActive`, extenderlo, no duplicarlo.

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm -C <REPO>/apps/web exec vitest run src/components/hub/__tests__/play-hub-client.test.tsx`
Expected: **FAIL** — hoy el tap sin PRO abre el ProSheet y el tile sí tiene el texto "PRO".

- [ ] **Step 3: Sacar la rama del handler**

En `play-hub-client.tsx`, reemplazar:

```tsx
        onCoachTap={() => {
          track("play_hub_coach_tap", { pro_active: pro.active });
          if (pro.active) router.push("/coach/history");
          else proSheet.openSheet();
        }}
```

por:

```tsx
        onCoachTap={() => {
          // The Coach no longer sells a door — it opens the room. The journal
          // was never PRO-gated (coach/history/page.tsx renders for any
          // connected wallet); only this `if` hid it. The sale now lives
          // inside, behind the player's own matches. `pro_active` stays on the
          // event: it is how we measure free players entering the journal.
          track("play_hub_coach_tap", { pro_active: pro.active });
          router.push("/coach/history");
        }}
```

- [ ] **Step 4: Sacar el badge del tile**

En `play-hub-scaffold.tsx`, borrar la línea del badge del `HubActionTile` del Coach:

```tsx
          <HubActionTile
            iconSrc="/art/new-icons-chesscito/training.png"
            label={tPlay("coachLabel")}
            ariaLabel={tHud("coachAriaLabel")}
            onClick={onCoachTap}
          />
```

> **No borrar la prop `badge` de `HubActionTile`** — es API genérica y `play-tactics-tile.tsx:67`
> usa la misma clase CSS (`.play-hub-action-badge`) para su badge "done". La regla de
> `globals.css:8646` **sigue viva**.

- [ ] **Step 5: Correr y verificar que pasa**

Run: `pnpm -C <REPO>/apps/web exec vitest run src/components/hub/__tests__/play-hub-client.test.tsx`
Expected: **PASS**

- [ ] **Step 6: Commit**

```bash
git -C <REPO> add apps/web/src/components/hub/play-hub-client.tsx apps/web/src/components/hub/play-hub-scaffold.tsx apps/web/src/components/hub/__tests__/play-hub-client.test.tsx
git -C <REPO> commit -m "feat(play-hub): the Coach opens the room instead of selling the door"
```

---

### Task 2: El Diario sin wallet gana un CTA de conectar

**El defecto que cierra:** hoy la rama sin wallet renderiza **una frase y ningún botón**
(`page.tsx:59-66`). Como el ProSheet que sacamos en la Task 1 llevaba un CTA **"Connect wallet"**,
sin esta task el cambio reemplaza un muro por un **pozo**.

**Files:**
- Modify: `apps/web/src/app/[locale]/coach/history/page.tsx:51-66`
- Modify: `apps/web/src/lib/content/editorial.ts` (bloque `COACH_COPY`, empieza en `:1505`)
- Modify: `apps/web/src/lib/content/messages/es.ts` (bloque COACH equivalente)
- Test: `apps/web/src/app/[locale]/coach/history/__tests__/coach-history-page.test.tsx`

**Interfaces:**
- Consumes: `useConnectWallet()` de `@/lib/wallet/use-connect-wallet` → `{ connectWallet }`.
  Ya lo usan seis superficies (`trophies-body.tsx:157` es el patrón a copiar).
- Produces: clave de copy `COACH_COPY.connectWalletButton`.

- [ ] **Step 1: Escribir el test que falla**

```tsx
it("offers a real way to connect, not just a sentence", async () => {
  const user = userEvent.setup();
  mockUseAccount.mockReturnValue({ address: undefined });
  render(<CoachHistoryPage />);

  const cta = screen.getByRole("button", { name: /connect/i });
  await user.click(cta);

  expect(connectWalletMock).toHaveBeenCalled();
});
```

> Mockear `@/lib/wallet/use-connect-wallet` para exponer `connectWalletMock`, igual que hacen los
> tests de `trophies-body`.

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm -C <REPO>/apps/web exec vitest run "src/app/[locale]/coach/history/__tests__/coach-history-page.test.tsx"`
Expected: **FAIL** — `Unable to find role="button"` con nombre /connect/. Hoy solo hay un `<p>`.

- [ ] **Step 3: Agregar la clave de copy a los DOS catálogos**

En `editorial.ts`, dentro de `COACH_COPY`, junto a `connectWalletForHistory` (`:1610`):

```ts
  connectWalletButton: "Connect Wallet",
```

En `messages/es.ts`, en el bloque COACH equivalente:

```ts
    connectWalletButton: "Conectar Wallet",
```

- [ ] **Step 4: Renderizar el CTA**

En `coach/history/page.tsx`, agregar el import y reemplazar la rama sin wallet:

```tsx
import { useConnectWallet } from "@/lib/wallet/use-connect-wallet";
```

```tsx
export default function CoachHistoryPage() {
  const t = useTranslations("COACH_COPY");
  const { address } = useAccount();
  const { connectWallet } = useConnectWallet();
  const router = useRouter();
  // ... resto igual

  if (!address) {
    return (
      <main className="tj-root">
        <PageHeader onBack={() => router.push("/")} />
        {/* The dock used to hand this player the ProSheet, whose primary CTA
         *  was literally "Connect wallet". Now that the Coach opens the
         *  journal instead, this branch IS the connect funnel — a sentence
         *  with no button would be a dead end, not a softer sell. */}
        <p className="tj-no-wallet-text">{t("connectWalletForHistory")}</p>
        <PrincipalButton
          size="medium"
          className="self-center"
          onClick={() => connectWallet()}
        >
          {t("connectWalletButton")}
        </PrincipalButton>
      </main>
    );
  }
```

> `PrincipalButton` **ya está importado** en este archivo (`:12`). No agregar un import duplicado.

- [ ] **Step 5: Correr y verificar que pasa**

Run: `pnpm -C <REPO>/apps/web exec vitest run "src/app/[locale]/coach/history/__tests__/coach-history-page.test.tsx"`
Expected: **PASS**

- [ ] **Step 6: Verificar la paridad de catálogos**

Run: `pnpm -C <REPO>/apps/web exec tsx scripts/audit-content-messages.ts`
Expected: sin errores de clave faltante en ES.

- [ ] **Step 7: Commit**

```bash
git -C <REPO> add apps/web/src/app/[locale]/coach/history/page.tsx apps/web/src/lib/content/editorial.ts apps/web/src/lib/content/messages/es.ts apps/web/src/app/[locale]/coach/history/__tests__/coach-history-page.test.tsx
git -C <REPO> commit -m "fix(coach): the journal's no-wallet branch stops being a dead end"
```

---

### Task 3: El ProSheet deja de gritar el precio por día

**Files:**
- Modify: `apps/web/src/components/pro/pro-sheet.tsx:437-442` (y el comentario de `:370-375`)
- Modify: `apps/web/src/lib/content/editorial.ts:2117`
- Modify: `apps/web/src/lib/content/messages/es.ts:277`
- Test: `apps/web/src/components/pro/__tests__/pro-sheet.test.tsx`

**Interfaces:**
- Consumes: nada. Produces: nada. Task aislada.

- [ ] **Step 1: Escribir el test que falla**

```tsx
it("never hand-writes a per-day price derived from the real one", () => {
  renderProSheet({ open: true, status: null });

  expect(screen.queryByText(/cents a day/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/centavos al día/i)).not.toBeInTheDocument();
  // The line that earns its place stays: it says something the price cannot.
  expect(screen.getByText(/no auto-billing/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm -C <REPO>/apps/web exec vitest run src/components/pro/__tests__/pro-sheet.test.tsx`
Expected: **FAIL** — "≈ 6 cents a day" está en el DOM.

- [ ] **Step 3: Borrar el render**

En `pro-sheet.tsx`, borrar el `<p>` de `priceSubLabel` (`:437-442`), dejando `priceLabel` y
`noAutoBillingLine`. Y corregir el comentario de `:370-375`, que todavía describe el sub-label:

```tsx
              {/* Center card — branches by subscription state.
               *  Non-active: the price card. The per-day equivalent used to
               *  live under it; it was clutter AND a hand-written derivative
               *  of $1.99/30 that would have lied, silently, the day PRO's
               *  price moved — no test would have turned red. `noAutoBilling`
               *  stays: it says something the price cannot.
               *  Active: ProActiveBadge + the extend/renew sub-line. */}
```

- [ ] **Step 4: Borrar la clave de los dos catálogos**

`editorial.ts:2117` → borrar `priceSubLabel: "≈ 6 cents a day",`
`messages/es.ts:277` → borrar `priceSubLabel: "≈ 6 centavos al día",`

- [ ] **Step 5: Correr y verificar que pasa**

Run: `pnpm -C <REPO>/apps/web exec vitest run src/components/pro/__tests__/pro-sheet.test.tsx`
Expected: **PASS**

- [ ] **Step 6: Commit**

```bash
git -C <REPO> add apps/web/src/components/pro/pro-sheet.tsx apps/web/src/lib/content/editorial.ts apps/web/src/lib/content/messages/es.ts apps/web/src/components/pro/__tests__/pro-sheet.test.tsx
git -C <REPO> commit -m "refactor(pro): drop the hand-written per-day price"
```

---

### Task 4: Las compras de PRO dicen de qué superficie vinieron

**Leer primero la sección "Desviación del spec" de arriba.** Reusamos el `source` = pathname que
el ProSheet ya calcula; **no** construimos la taxonomía de CTAs que pedía el spec §4.

**Files:**
- Modify: `apps/web/src/lib/pro/use-pro-sheet-state.ts` (imports, `openSheet` `:221-223`,
  `handleVerified` `:143-159`, `handlePurchase` `:237-250`)
- Test: `apps/web/src/lib/pro/__tests__/use-pro-sheet-state.test.tsx`

**Interfaces:**
- Consumes: `usePathname()` de `@/i18n/navigation` (el mismo que usa `pro-sheet.tsx:138`).
- Produces: los eventos `pro_purchase_started` y `pro_purchase_confirmed` ahora llevan
  `source: string` (el pathname congelado al abrir la hoja).

- [ ] **Step 1: Escribir el test que falla**

```tsx
it("attributes the purchase to the surface that opened the sheet", async () => {
  mockPathname.mockReturnValue("/coach/history");
  const { result } = renderHook(() => useProSheetState());

  act(() => result.current.openSheet());
  await act(async () => { await result.current.sheetProps.onPurchase(); });

  expect(trackMock).toHaveBeenCalledWith(
    "pro_purchase_started",
    expect.objectContaining({ source: "/coach/history" }),
  );
});

it("freezes the source at open, so a route change mid-purchase cannot rewrite it", async () => {
  mockPathname.mockReturnValue("/coach/history");
  const { result } = renderHook(() => useProSheetState());

  act(() => result.current.openSheet());
  mockPathname.mockReturnValue("/");   // the user navigated underneath us

  await act(async () => { await result.current.sheetProps.onPurchase(); });

  expect(trackMock).toHaveBeenCalledWith(
    "pro_purchase_started",
    expect.objectContaining({ source: "/coach/history" }),
  );
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm -C <REPO>/apps/web exec vitest run src/lib/pro/__tests__/use-pro-sheet-state.test.tsx`
Expected: **FAIL** — los eventos no llevan `source`.

- [ ] **Step 3: Congelar el pathname al abrir y adjuntarlo a los eventos**

En `use-pro-sheet-state.ts`, agregar el import:

```ts
import { usePathname } from "@/i18n/navigation";
```

Guardar el origen al abrir (mismo patrón que `pro-sheet.tsx:138`, pero en el hook, que es donde
viven los `track` de compra):

```ts
  const livePathname = usePathname();
  // Frozen at open, not read at purchase: the player can navigate while the
  // sheet is up, and attributing the sale to wherever they drifted to would
  // answer the wrong question. What we need to know is which surface SOLD it.
  const sourceRef = useRef<string>("/");

  const openSheet = useCallback(() => {
    sourceRef.current = livePathname ?? "/";
    setOpen(true);
  }, [livePathname]);
```

Y adjuntarlo a los dos eventos:

```ts
    track("pro_purchase_confirmed", {
      item_id: 6,
      price_usd6: Number(pack.priceUsd6),
      days_granted: pack.durationDays,
      tx_hash_prefix: result.txHash.slice(0, 10),
      source: sourceRef.current,
    });
```

```ts
    track("pro_purchase_started", {
      item_id: 6,
      price_usd6: Number(pack.priceUsd6),
      source: sourceRef.current,
    });
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `pnpm -C <REPO>/apps/web exec vitest run src/lib/pro/__tests__/use-pro-sheet-state.test.tsx`
Expected: **PASS**

- [ ] **Step 5: Commit**

```bash
git -C <REPO> add apps/web/src/lib/pro/use-pro-sheet-state.ts apps/web/src/lib/pro/__tests__/use-pro-sheet-state.test.tsx
git -C <REPO> commit -m "feat(pro): purchases now say which surface sold them"
```

---

### Task 5: Regenerar el baseline VR del play hub

El dock cambia de píxeles (se fue el badge PRO), así que el baseline visual queda desactualizado
y la suite de VR se pone roja. **Esto no es opcional ni cosmético: un baseline stale enmascara la
próxima regresión de verdad.**

**Files:**
- Modify: el snapshot del play hub en `apps/web/e2e/**` (baseline de `--project=minipay`)

- [ ] **Step 1: Confirmar que el puerto está libre**

Run: `lsof -ti:3000`
Expected: **vacío**. Si devuelve un PID, matarlo antes de seguir.

- [ ] **Step 2: Correr la VR y ver el fallo esperado**

Run: `pnpm -C <REPO>/apps/web test:e2e:visual`
Expected: **FAIL** en el snapshot del play hub (y **solo** en ese). Si falla algún otro,
**parar** — es una regresión de verdad, no un baseline stale.

- [ ] **Step 3: Regenerar el baseline**

Run: `pnpm -C <REPO>/apps/web exec playwright test e2e/visual-regression.spec.ts --project=minipay --update-snapshots`

- [ ] **Step 4: Revisar el diff a ojo antes de aceptarlo**

Run: `git -C <REPO> status --short`
Mirar la imagen nueva: **lo único que debe cambiar es la ausencia del badge PRO en el tile del
Coach.** Cualquier otro píxel movido es un bug que este plan no pidió.

- [ ] **Step 5: Commit**

```bash
git -C <REPO> add apps/web/e2e
git -C <REPO> commit -m "test(vr): rebaseline the play hub dock without the PRO badge"
```

---

### Task 6: Gate de calidad y merge

- [ ] **Step 1: Suite completa**

Run: `pnpm -C <REPO>/apps/web test`
Expected: **PASS**. Baseline previa: **5073 passing / 426 files**. El número sube (tests nuevos);
**no debe bajar**. Reportar el conteo en el mensaje de merge.

- [ ] **Step 2: Typecheck**

Run: `pnpm -C <REPO>/apps/web exec tsc --noEmit`
Expected: sin output.

- [ ] **Step 3: Verificar en el navegador — el flujo, no el test**

Levantar PLAY (el modo importa: en LEARN este dock no existe):

Run: `NEXT_PUBLIC_CHESSCITO_MODE=play pnpm -C <REPO>/apps/web dev`

Recorrer, **sin PRO**:
1. Dock → **Coach** → cae en el Diario (no en el ProSheet), y el tile **no** dice PRO.
2. **Desconectado** → el Diario ofrece un **botón** de conectar, no una frase.
3. Sin partidas → empty state con su CTA a `/arena?fresh=1`.

- [ ] **Step 4: Merge local a `main` + UN push**

```bash
git -C <REPO> checkout main
git -C <REPO> merge --no-ff feat/coach-opens-journal
git -C <REPO> push origin main
git -C <REPO> branch -d feat/coach-opens-journal
```

- [ ] **Step 5: Handoff**

Escribir `docs/handoffs/2026-07-13-coach-opens-journal-handoff.md` con: estado final, el conteo de
la suite, la desviación del spec §4 (source = pathname, no taxonomía de CTAs) y su limitación, y
la open question que sigue viva — *con el badge fuera del dock, ¿queda alguna señal de que el
análisis es de pago, y hace falta?* La respuesta ahora **se puede medir**: `pro_purchase_confirmed`
con `source` empezando en `/coach`.

---

## Self-review

**Cobertura del spec:**

| Sección del spec | Task |
| --- | --- |
| §1 Coach siempre abre el Diario + badge fuera | Task 1 |
| §2 Retirar `priceSubLabel` | Task 3 |
| §3 CTA de conectar sin wallet (red team P0) | Task 2 |
| §4 `source` en el ProSheet (red team P2) | Task 4 — **con desviación documentada arriba** |
| Baseline VR | Task 5 |
| Back del diario | **No se construye nada** — el red team lo verificó falso: en el build de PLAY, `/` ES el hub de PLAY (`hub-scaffold-client.tsx:15`) |

**Consistencia de tipos:** `openSheet()` **no cambia de firma** (sigue siendo `() => void`), así
que los ~15 call sites de arena/exercises/profile/hub **no se tocan**. Ese es el punto de la
desviación: el `source` se captura adentro del hook vía `usePathname()`, no se pasa por parámetro.
