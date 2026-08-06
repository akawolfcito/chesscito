# Session Handoff — 2026-08-06 (mantenimiento de disco — cerrada)

> 📌 **Sesión de mantenimiento, sin cambios de código.** Se recuperaron ~5 GB en el repo/Docker
> y se estableció con evidencia cómo borrar perfiles de Chrome, que es donde está el volumen
> real. El resto de los perfiles los revisa el founder a mano.

## Completed

### 1. Limpieza ejecutada — ~5 GB (16 Gi → 21,9 Gi libres, 97% → 95%)

| Acción | Recuperado |
|---|---|
| `docker image rm postgres:15` (huérfana, resto de la receta de junio) | 467 MB / 3 capas |
| `rm -rf apps/web/.next/cache` | 1,9 GB (`.next` quedó en 212 MB) |
| `pnpm store prune` | 1.691 paquetes / 117.442 archivos |

⚠️ El store de pnpm bajó 2,0 → 1,8 GB en `du` pese a borrar 117k archivos: es
content-addressed con hard links, **`du` subcuenta lo liberado**. El número real sale de `df`.
No se tocó `postgres:16-alpine` — la usa `pnpm ops:health`.

### 2. El ítem del `--rm` NO tiene código que arreglar

El open question del audit de Docker (`docs/audits/2026-08-06-docker-local-audit.md:555`)
preguntaba dónde se levanta Postgres para tests sin `--rm`. **Respuesta: en ningún lado del
código.** `scripts/ops/verify-stats-rpcs.ts`, `scripts/ops/collectors/supabase.ts` y
`apps/web/scripts/privileged-views-role-probe.sql` **ya usan `--rm`**. La única receta sin
`--rm` es **prosa** en `docs/handoffs/2026-06-09-savescore-offchain-slices-1-3-handoff.md:57`
(`docker run -d --name pg postgres:15`). Docker hoy: 12 contenedores, 2 volúmenes,
**0 huérfanos**.

### 3. Diagnóstico de disco: el proyecto no es el problema

`scripts/disk-telemetry.sh` (read-only) más medición manual:

| Consumidor | Tamaño |
|---|---|
| `~/Library/Caches/Google/Chrome` | **24 GB** (caché descartable) |
| `~/Library/Application Support/Google/Chrome` | **otros 24 GB** (perfiles reales) |
| `/var/folders/…/T` | 5,4 GB (se recupera al reiniciar) |
| `OptGuideOnDeviceModel` (modelo IA on-device de Chrome) | 4,0 GB, re-descargable |
| `~/Library/Caches/pnpm` | 2,0 GB |
| `node_modules` (root) | 1,9 GB — **no era el culpable** |

Confirma `feedback_du_lies_about_pnpm_node_modules`.

### 4. ✅ Verificado empíricamente: borrar un perfil de Chrome limpia LOS DOS árboles

Es el resultado más útil de la sesión, porque decide la estrategia de los 38 perfiles restantes.

Método: snapshot antes → el founder borra `Profile 48` desde `chrome://profile-picker/`
(tres puntos en la tarjeta → Delete) → snapshot después → diff.

```
             antes → después
cache_dirs      64 → 63
data_dirs       64 → 63
local_state     64 → 63
```

`Profile 48` desapareció de las dos ubicaciones a la vez (70,6 MB de datos + 175,7 MB de
caché = ~246 MB; `df` se movió +0,2 GB, cuadra). **No hay que barrer la caché aparte.**

## Current State

| | |
|---|---|
| Rama | `main` local, **13 commits SIN PUSHEAR** (el founder pushea) |
| `origin/main` | sigue en `b32b9949` |
| Árbol | ✅ limpio |
| Suite unit | 7397 passing / 596 files (baseline 2026-08-06, **no re-corrida: cero cambios de código esta sesión**) |
| VR | 61/62, verificado el 2026-08-06 (`44ee073`) |
| Disco | **21,9 Gi libres (95%)**, desde 16 Gi |
| Docker | 12 contenedores, 2 volúmenes, 0 huérfanos |

## Next Tasks

**Lo de Chrome queda en manos del founder** — decisión explícita del cierre. El mapa que
dejó la medición, para cuando lo retome:

| | Perfiles | Data + caché |
|---|---|---|
| Con wallet detectada | 25 | **28,1 GB** ⛔ no tocar |
| Sin wallet detectada | 38 | **14,9 GB** ✅ pozo seguro |

Perfiles con wallet: `Default`, `3`, `4`, `16`, `18`, `21`, `24`, `25`, `31`, `34`, `38`,
`39`, `41`, `44`, `45`, `49`, `53`, `59`, `60`, `67`, `71`, `72`, `79`, `81`, `82`.

⚠️ **La marca "sin wallet" mira solo CUATRO extension-ids** (MetaMask
`nkbihfbeogaeaoehlefnkodbefgpgknn`, Coinbase `hnfanknocfeofbddgcijnmhnfnkdnaad`, Phantom
`bfnaelmomeimhlpmgjnjophhpkkoljpa`, Rabby `acmacodkjbdgmoleebolmdjonilkdbch`). Un perfil con
Rainbow / Keplr / Backpack / Trust **saldría como seguro y no lo es**. Ampliar la lista de ids
antes de barrer en volumen.

Del backlog previo, siguen diferidos y sin cambios: Supabase CLI v2.98.2 → v2.111.0 (solo al
tocar auth/storage, con backup verificado), y el directorio corrupto de la VM de Docker
(el propio audit lo marca cosmético).

Frentes de producto vivos: `docs/backlog/2026-07-10-backlog-index.md` y
`docs/product/2026-07-13-direction-where-we-are.md`.

## Blockers

**Ninguno.**

## Open questions

- **La convención del `--rm` no quedó escrita.** Se ofreció y no se eligió. Si se documenta,
  el lugar es `CLAUDE.md` (sección de command hygiene) + corregir la receta del handoff de
  junio. Sin eso, la próxima sesión que levante un Postgres suelto vuelve a dejar volúmenes.
- **Los scripts de medición vivieron en el scratchpad de la sesión y se pierden**
  (`chrome-snapshot.sh`, `profile-diff.sh`, `cache-age.sh`). Si el founder va a seguir
  borrando perfiles y quiere medir el efecto, hay que promoverlos a `scripts/` como hermanos
  de `disk-telemetry.sh` — o rehacerlos.

## Notes

- ⛔ **Las seeds NO están en `Caches`.** Los vaults viven en
  `Application Support/Google/Chrome/<Profile>/Local Extension Settings/<extension-id>/`.
  `Caches/Google/Chrome/<Profile>` contiene **únicamente** `Cache` y `Code Cache`. Verificado
  directorio por directorio.
- ⚠️ **El camino peligroso no es borrar la carpeta `Caches`, es "Borrar datos de navegación"
  de Chrome con "Cookies y datos de sitios" tildado** — eso sí puede vaciar el storage de
  extensiones.
- ⚠️ **Copiar la carpeta del perfil NO es un respaldo de wallet**: el vault está cifrado con
  la contraseña de la extensión, y copiado con Chrome abierto el LevelDB puede quedar
  corrupto. Un respaldo solo cuenta como probado si se restauró la frase en una wallet limpia
  y salió la misma dirección.
- ⚠️ **"Close This Profile" ≠ borrar.** Solo cierra las ventanas. El borrado vive únicamente
  en `chrome://profile-picker/`, y Chrome **no deja borrar un perfil abierto** — de ahí que
  cerrarlo sea el paso previo, no el borrado.
- 📊 **Regeneración del caché de Chrome, medida por `mtime`:** de los 64 caches, 24 se
  escribieron en 2026, 39 en 2025 y 2 en 2024. Los activos suman **2,5 GB**; los 52 dormidos,
  **21,9 GB**. Borrar el caché entero recupera 24 GB y solo vuelven ~2,5 en semanas de uso —
  los 21,9 tardaron **~2 años** en acumularse.
