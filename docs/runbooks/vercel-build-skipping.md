# Runbook — saltar builds de Vercel que no pueden cambiar el deploy

**Creado:** 2026-08-04 · **Script:** `scripts/ops/vercel-should-build.sh`
**Tests:** `scripts/ops/__tests__/vercel-should-build.test.ts`

---

## Por qué existe

Cada commit reconstruía los tres proyectos de Vercel, incluidos los que sólo
tocan `docs/` o `scripts/`. Medido antes del cambio:

| | |
|---|---|
| Commits recientes que **no** cambian ningún bundle | **14 de 15** |
| Costo de cada uno | ~**320 s** de Build CPU (`chesscito` + `lite-chesscito`) |
| Deployments en 24 h | **60** |
| Build CPU en 24 h | **104 min** — de 178 min de toda la semana |
| Build CPU en la factura | **$1,34 de $2,17** — el **62 %** |

El presupuesto está para picos de infraestructura, no para compilar Next.js
porque cambió un `.md`.

---

## Cómo está cableado

Cada proyecto de Vercel tiene, en **Settings → Git → Ignored Build Step**:

| Proyecto | Root Directory | Comando |
|---|---|---|
| `chesscito` | `apps/web` | `bash ../../scripts/ops/vercel-should-build.sh web` |
| `lite-chesscito` | `apps/web` | `bash ../../scripts/ops/vercel-should-build.sh web` |
| `chesscito-landing` | `apps/landing` | `bash ../../scripts/ops/vercel-should-build.sh landing` |

Los `../../` son porque Vercel ejecuta el comando **desde el Root Directory**,
no desde la raíz del repo.

⚠️ **La lógica vive en el repo, no en el dashboard, a propósito.** La versión
anterior existía sólo en Settings, y por eso `chesscito-landing` cargó un
comando defectuoso durante meses sin que nadie lo viera. La configuración
invisible no se revisa.

---

## El contrato de exit codes — **está al revés de lo intuitivo**

```
exit 0      → CANCELA el build
exit != 0   → CORRE el build
```

En Vercel, un deployment saltado aparece como **`CANCELED`**, no como fallido, y
**el deployment anterior sigue sirviendo el dominio**. No queda nada roto ni a
medias.

---

## Banderas manuales

Van en el **mensaje del commit** y ganan sobre la decisión automática:

| Bandera | Efecto |
|---|---|
| `[skip build]` · `skip-build` | **No construye**, aunque hayas tocado código |
| `[force build]` · `force-build` | **Construye**, aunque sólo hayas tocado un `.md` |

Si un mensaje trae las dos, gana `skip` (la opción barata), y eso está fijado
por un test, no es emergente.

⚠️ **Las variantes sin corchetes existen por zsh.** Un `[skip build]` sin
comillas se expande como glob, que es el mismo problema que ya rompió `main`
una vez con un pathspec de `git add`. Con `-m "..."` entre comillas los
corchetes son seguros; si preferís no pensarlo, usá `skip-build`.

---

## Por qué NO se usa `git diff HEAD^ HEAD`

Porque **sólo mira el último commit del push**. Si empujás un commit de código
seguido de uno de docs, Vercel evalúa únicamente el de docs, cancela, y **el
código nunca se despliega**.

Reproducido contra el historial de este mismo repo:

```
HEAD^..HEAD sobre b90ee4f6 (docs)   → SKIP   ← el hotfix de ebdc5c1c nunca sale
ebdc5c1c^..b90ee4f6                 → BUILD  ← correcto
```

`turbo-ignore` compara contra **`VERCEL_GIT_PREVIOUS_SHA`**, el commit del
último deployment exitoso, así que un build cancelado **no pierde** lo que
saltó: sigue pendiente contra ese baseline y el siguiente build lo toma.

---

## ⚠️ El caso de arranque, que confunde y es normal

**Un proyecto sin deployment exitoso reciente construye igual, aunque no le
toque.**

Pasó en el estreno: `chesscito` y `lite-chesscito` cancelaron correctamente,
pero `chesscito-landing` **construyó**. Sus dos deployments anteriores estaban
en `CANCELED` (cortesía de su viejo ignore command), así que turbo-ignore se
quedó sin baseline contra el cual comparar y aplicó su propio fail-safe.

La señal en el log es la **ausencia** de dos líneas:

```
≫  Using Turborepo to determine if this project is affected...
≫  Inferred turbo version "1.13.4" from "package.json"
[should-build] BUILD — turbo-ignore reports this workspace is affected
      ↑ faltan "Found previous deployment" y "Analyzing results of"
```

Cuando SÍ hay baseline, el log dice:

```
≫  Found previous deployment ("5519eb66") for "landing"
≫  Analyzing results of `turbo run build --filter="landing...[5519eb66]"`
≫  This project and its dependencies are not affected
```

**Es autocorrectivo:** ese build deja el proyecto en `READY` y el siguiente
commit ya tiene contra qué comparar. No hay que hacer nada.

---

## Fail-safe

**Todo camino de error sale distinto de cero, o sea construye.** Un guard roto
puede desperdiciar un build; no puede dejar producción sin desplegar.

Cubre: falta el argumento de workspace, turbo-ignore no resuelve, npx no
descarga, el script no existe en el checkout, un exit code inesperado.

---

## Verificar que sigue funcionando

```bash
# los tests (no tocan la red)
pnpm -C apps/web exec vitest run ../../scripts/ops/__tests__/vercel-should-build.test.ts

# una decisión real, simulando Vercel (⚠️ VERCEL=1 es necesario:
# sin esa variable turbo-ignore ignora PREVIOUS_SHA y cae a HEAD^)
cd apps/web
VERCEL=1 VERCEL_GIT_PREVIOUS_SHA=<sha> VERCEL_GIT_COMMIT_MESSAGE="docs: x" \
  bash ../../scripts/ops/vercel-should-build.sh web
echo $?   # 0 = cancela · 1 = construye
```

---

## Revertir

Borrar el campo **Ignored Build Step** en los tres proyectos, o por API:

```
PATCH https://api.vercel.com/v9/projects/<proyecto>
{"commandForIgnoringBuildStep": null}
```

Vuelve a construir siempre. Reversible en un click, sin tocar el repo.

---

## Pendientes

- **`turbo-ignore` está deprecado** upstream, en favor de `turbo query affected`
  y del skipping nativo de Vercel. ⚠️ **`turbo query` NO existe en turbo 1.13.4**,
  que es la versión de este repo — verificado. Revisar al subir a turbo 2.x.
- **`Observability Events` es el segundo item de la factura** ($0,52 · 24 %) y
  no lo toca nada de esto: viene de telemetría, no de builds.
- El ignore command **también consume** algo de Build CPU (clona y corre
  `npx turbo-ignore`, ~15–25 s) — mucho menos que un build completo (~160 s),
  pero no es cero.
