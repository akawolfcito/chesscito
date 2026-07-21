# Get Peones payment recovery handoff — 2026-07-20

## Context and causa raíz

El flujo anterior colapsaba rechazos del provider sin hash en `unknown_submission_state`. El error original se descartaba y no se persistían de forma suficiente el lifecycle, el hash ni una ruta de recuperación segura. El endurecimiento conserva la ambigüedad, impide acreditar sin evidencia y mantiene la idempotencia.

## Arquitectura final

```text
CREATED → SUBMITTING → SUBMITTED → CONFIRMED

SUBMITTING → CANCELLED
SUBMITTING → FAILED
SUBMITTING → EXPIRED

SUBMITTED → REVERTED
```

El frontend nunca autoriza crédito. Sólo la evidencia on-chain validada por el verifier autoritativo puede llevar un intent a `CONFIRMED` y acreditar Peones.

## Commits

- `d0eed70e`: endurece la recuperación de submission y conserva estados/errores ambiguos.
- `81d0e87e`: serializa la creación por identidad comercial mediante advisory lock y trigger legacy.
- `d6cd80c0`: prepara el cierre administrativo auditado de intents legacy.

## Migraciones

Aplicar siempre en este orden:

1. `20260720000000_get_peones_intent_lifecycle.sql` — lifecycle persistido, backfill y verificación de evidencia.
2. `20260720010000_get_peones_intent_creation_lock.sql` — creación transaccional por identidad, advisory lock y protección de inserciones legacy.
3. `20260721000000_get_peones_legacy_resolution.sql` — resolución administrativa restringida, log append-only y permisos service-role-only.

Las tres migraciones ya están aplicadas y verificadas en Supabase producción.

**DATABASE READY**

**APPLICATION PENDING DEPLOY**

No existe evidencia de que la aplicación nueva haya sido desplegada.

## Estado legacy

Hay 16 intents: 1 `CONFIRMED` y 15 `SUBMITTING` legacy. Trece son `canary-v1` y bloquean cuatro wallets; dos pertenecen a `rollback-exercise-2026-07-01` y no bloquean `canary-v1`. Los 15 legacy están sin hash y sin consumption. La resolución es individual: no cerrar masivamente ni inferir transacciones usando sólo wallet, amount y timestamp.

Hay 6 consumptions: 1 vinculada a intent y 5 legacy sin `intent_id` (2 Season Pass, 2 PRO y 1 Get Peones legacy). No deben enlazarse retrospectivamente por coincidencia temporal.

## Procedimiento de resolución

Usar [`docs/audits/get-peones-legacy-resolution.sql`](../audits/get-peones-legacy-resolution.sql):

1. Ejecutar preview read-only.
2. Revisar logs y evidencia on-chain.
3. Confirmar hashless y ausencia de consumption.
4. Aprobar un intent individual.
5. Ejecutar `resolve_get_peones_legacy_intent` con `service_role`.
6. Preferir `EXPIRED` cuando sólo exista expiración y ausencia de evidencia.
7. Ejecutar el post-check y conservar el resolution log.

La RPC no fabrica hashes, no acredita, no crea consumptions y no reabre intents terminales.

## Smoke test pendiente

Con una wallet nueva y sin fondos reales: cancelación, compra exitosa, idempotencia, reload después de recibir hash, doble tap, provider ambiguo, resolución de un legacy controlado y confirmación de que la wallet queda desbloqueada.

## Observabilidad

Revisar eventos de creación, submission, reconciliación, confirmación y resolución con `intent_id`, estado actual/anterior, estado recibido, `has_tx_hash`, `provider_result_kind`, `error_code`, `recoverable`, `retry_safe`, `resolution_code` y actor/fecha administrativa. No registrar wallets completas, firmas, secretos ni payloads del provider.

## Riesgos residuales

- Caída simultánea de navegador/backend después del broadcast puede requerir investigación manual.
- Sin hash no hay reconciliación automática autorizada.
- Las cuatro wallets legacy canary permanecen bloqueadas hasta revisión individual.
- Permanece un error TypeScript preexistente del test Coach, ajeno a payments.

## No hacer

- No fabricar `txHash` ni acreditar manualmente.
- No crear consumptions manuales.
- No resolver masivamente intents legacy.
- No reabrir intents terminales.
- No desplegar la aplicación nueva sobre el esquema anterior.
- No conceder RPC a `anon` o `authenticated`.

## Punto exacto de continuación

1. Desplegar los commits de aplicación.
2. Ejecutar smoke test restringido con wallet nueva.
3. Resolver un intent legacy controlado.
4. Habilitar gradualmente el canary.

**DATABASE READY**

**APPLICATION READY TO DEPLOY**

**LEGACY RESOLUTION PENDING**
**HANDOFF COMPLETE**
