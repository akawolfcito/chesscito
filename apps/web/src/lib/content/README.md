# `lib/content/` — Editorial & i18n architecture

> **Companion doc:** `docs/content/chesscito-language-brief.md` (voice / vocabulary / Web3 + wellness rules).
> **Status:** v1.0 — stable. Read before adding or editing copy.

---

## TL;DR

```
apps/web/src/lib/content/
├── editorial.ts            ← 📝 AUTHORING SOURCE (EN)
└── messages/
    ├── en.ts               ← 🔧 Bundle derivado de editorial.ts (no escribes copy aquí)
    └── es.ts               ← 🌎 Overrides ES (spread EN como fallback)
```

| Archivo | Rol | Cuándo editas |
| --- | --- | --- |
| `editorial.ts` | Fuente de verdad EN. Strings, helpers, ICU. | Para CUALQUIER cambio de copy EN. |
| `messages/en.ts` | Bundle runtime para next-intl. Auto-deriva de editorial.ts. | Solo para AÑADIR mirrors ICU cuando un helper nuevo aparece en editorial.ts. |
| `messages/es.ts` | Overrides ES. Spread `...en` como fallback. | Para TRADUCIR namespaces nuevos o actualizar overrides existentes. |

---

## 1. `editorial.ts`

~2500 LOC, ~85 named exports. Es el **único lugar** donde se escribe copy EN nuevo. Los componentes (legacy) lo importaron directo y los componentes nuevos (post-Stage C) lo leen vía `useTranslations` de next-intl.

### Tipos de valores que puede contener

```ts
export const BADGE_SHEET_COPY = {
  // 1. Strings literales
  title: "Your Badges",

  // 2. Strings con ICU placeholder (next-intl los entiende tal cual)
  starsProgressFormat: "{collected} of {total} stars",

  // 3. Function helpers (legacy / runtime convenience)
  claimSuccess: (piece: string) =>
    `${piece.charAt(0).toUpperCase()}${piece.slice(1)} Badge claimed!`,
} as const;
```

### Reglas al editar

- **Single source of truth.** No dupliques strings que ya existen — busca primero.
- **Function helpers necesitan mirror ICU en `messages/en.ts`.** stripFunctions los elimina del bundle.
- **No metas copy ES aquí.** El brief lo dice: este es el authoring EN.
- **No traduzcas marcas.** PRO, ARENA, Chesscito, Celo, MiniPay quedan en su forma original.
- **Si una key cambia de signatura** (e.g. de `(p: string) => string` a `(p: string, n: number) => string`), revisa los callers + actualiza el mirror ICU en en.ts + actualiza es.ts.

## 2. `messages/en.ts`

```ts
import * as editorial from "../editorial";

const messages = stripFunctions({ ...editorial });

// ICU mirrors para function helpers que stripFunctions tiró
const m = messages as any;
m.BADGE_SHEET_COPY.claimSuccess = "{piece} Badge claimed!";
m.HUB_V2_TRAINING_COPY.active.daysFormat = "{d}d";
// …
export default messages;
```

### Qué hace

1. Importa **todo** el namespace de editorial.ts (`import *`).
2. Aplica `stripFunctions` recursivamente — borra cualquier valor que sea función (`typeof v === "function"`) porque `NextIntlClientProvider` requiere mensajes JSON-serializable.
3. Para cada function helper, agrega un **mirror ICU** en formato `"{token}"`. next-intl lo parsea y resuelve placeholders en runtime.

### Qué NO hacer

- **NO escribir copy nuevo aquí.** El bundle se regenera importando editorial.ts; cualquier cosa que pongas a mano para reemplazar un string de editorial.ts queda hidden, brittle, y diverges del authoring source. Solo se permiten mirrors ICU (re-expresiones de funciones que ya existen en editorial).
- **NO eliminar mirrors existentes** sin antes verificar que ningún componente llama a esa key con placeholders.
- **NO traducir aquí.** ES vive en es.ts.

### Cuándo agregar un mirror nuevo

Cuando agregues una function helper a editorial.ts y un componente la consume vía `useTranslations`. Patrón:

```ts
// editorial.ts
greeting: (name: string) => `Hello, ${name}!`,

// messages/en.ts
m.SOME_NAMESPACE.greeting = "Hello, {name}!";

// component
const t = useTranslations("SOME_NAMESPACE");
t("greeting", { name: "Wolfcito" });
```

Si la helper solo se usa en código legacy (no via useTranslations), no necesita mirror — el helper directo de editorial.ts sigue funcionando.

## 3. `messages/es.ts`

```ts
import enBundle from "./en";
const en = enBundle as any;

const messages = {
  ...en, // ← spread del bundle EN como fallback
  LEGAL_SHELL_COPY: {
    back: "Atrás",
    aboutTitle: "Acerca",
    lastUpdatedLabel: "Última actualización",
  },
  // ... más overrides ...
};

export default messages;
```

### Cómo funciona el fallback

`/es/*` → next-intl busca cada key primero en es.ts; si NO existe, el spread `...en` la sirve del bundle EN.

Resultado: una key no traducida muestra inglés en el surface ES — feo pero no roto.

### Reglas al editar

- **Trabaja por namespace completo.** No edites una key suelta; si vas a override `BADGE_SHEET_COPY`, copia el namespace completo desde el EN para mantener todas las keys consistentes.
- **Respeta los ICU placeholders.** Si EN dice `"Hello, {name}"`, ES debe usar el mismo `{name}` (puede reordenar — `"Hola, {name}"`).
- **Sigue el brief** (`docs/content/chesscito-language-brief.md`): translate by intent, mobile-first length, Web3-light vocabulary.
- **NO elimines el spread `...en`.** Sin él, cualquier key faltante en ES tira fallback string raw (e.g. `"BADGE_SHEET_COPY.title"`) en vez de inglés. La degradación graceful depende del spread.

### Sync manual EN → ES

⚠️ **No hay sync automático.** Si cambias `editorial.ts` y el namespace está overrideado en es.ts, la versión ES queda stale.

Workflow al editar copy EN:

1. Edita `editorial.ts` (EN).
2. Busca la misma key en `messages/es.ts`. Si existe, actualiza el ES en paralelo.
3. Si la key es nueva, OPCIONAL agregar el ES en el mismo PR (sin override, ES fallback a EN automáticamente — el audit script lo flaggea).

## 4. Helpers + utilidades

- `apps/web/src/lib/content/locale.ts` — pequeños helpers (proper-noun lists, etc.).
- `apps/web/src/i18n/routing.ts` — config de next-intl (locales, defaultLocale, prefix).
- `apps/web/src/middleware.ts` — gate `NEXT_PUBLIC_I18N_ES_READY` + intl middleware.
- `apps/web/src/test-utils/render-with-intl.tsx` — wrapper de tests que monta `NextIntlClientProvider` con el bundle EN o ES.

## 5. Cómo migrar un componente nuevo a i18n

```tsx
// antes:
import { BADGE_SHEET_COPY } from "@/lib/content/editorial";
export function MyComponent() {
  return <h2>{BADGE_SHEET_COPY.title}</h2>;
}

// después:
"use client";
import { useTranslations } from "next-intl";
export function MyComponent() {
  const t = useTranslations("BADGE_SHEET_COPY");
  return <h2>{t("title")}</h2>;
}
```

Si el componente es Server Component, usar `getTranslations` de `next-intl/server`. Si tiene tests, cambiarlos a `renderWithIntl` (alias `render`) desde `@/test-utils/render-with-intl`.

## 6. Audit script

```bash
pnpm content:audit
```

Reporta sin bloquear build:

1. **ES keys huérfanas** — paths en es.ts que no existen en EN (probable rename / typo).
2. **EN keys sin override ES** — namespaces enteros o keys sueltas pendientes de traducción.
3. **Strings largos en paths "button-like"** — flagea valores > 25 caracteres en keys que se ven como botones (cta, button, label en path).
4. **Términos Web3 técnicos en copy user-facing** — NFT, mint, on-chain, smart contract, transaction en strings que NO viven en namespaces de docs / legal.
5. **Claims cognitivos riesgosos** — Alzheimer, demencia, tratamiento, cura, medical, etc.
6. **Function helpers sin mirror ICU** — heurística: editorial.ts tiene función en una key pero en.ts no tiene un string en la misma path → posible bug latente.

Imprimir reporte humano-legible en consola, exit code 0 (warn-only).

## 7. Pitfalls comunes

| Síntoma | Causa | Fix |
| --- | --- | --- |
| `useTranslations` devuelve la key cruda (e.g. `"FOO_COPY.bar"`) | Key no existe en bundle | Verificar editorial.ts + en.ts + mirror si la key viene de function helper |
| Botón ES rompe layout (más largo que EN) | Traducción literal en lugar de equivalente corto | Aplicar regla del brief — same intent, similar visual length |
| Test falla con "context not found" | Componente usa useTranslations + test usa raw `render` | Cambiar a `renderWithIntl as render` |
| ES muestra inglés en alguna pantalla | Namespace no overrideado en es.ts | OK temporalmente; el audit lo flaggea como missing-ES |
| Mismo string aparece 2 veces con copy distinto | Drift entre callers | Buscar todas las llamadas a la key + consolidar |

## 8. Para profundizar

- `docs/content/chesscito-language-brief.md` — voice, vocabulary, do/don't.
- `docs/superpowers/specs/2026-05-23-i18n-es-en-design.md` — spec original de la migración.
- Handoffs por batch: `docs/handoffs/2026-05-2*-i18n-*-handoff.md`.

---

**Mantiene:** Wolfcito (@akawolfcito).
