# Runbook — Reset de una wallet para testing (LEARN / PLAY / todo)

> ⚠️ **DESTRUCTIVO · PRODUCCIÓN.** Borra estado off-chain real en Upstash Redis +
> Supabase de PROD. **Irreversible.** PRO y Season Pass se pagaron con dinero real:
> borrarlos NO refunda; re-probar la compra = otra tx real. Los **badges y Victory
> NFTs on-chain NO se borran** (inmutables) y se re-sincronizan solos.

## Separación LEARN vs PLAY
Sí se puede separar el **server-side** (Redis + Supabase). Dos ítems son
**COMPARTIDOS** (PRO y Peones) — decides si entran. El **wipe local**
(`/dev/reset`) es todo-o-nada: borra todas las keys `chesscito*` (casi todas son
de LEARN; lo único local de PLAY es `victory-pending`).

`<wallet>` / `<WALLET>` = tu dirección 0x en **minúsculas** siempre.

---

## 🟩 LEARN (entrenamiento, ejercicios, hábito, Pass, shields)

**Redis:**
```
DEL lite:season-pass:<wallet>
DEL coach:shields:credited:<wallet>
```
**Supabase:**
```sql
begin;
delete from public.lite_season_passes  where wallet         = lower('<WALLET>');
delete from public.score_saves          where wallet         = lower('<WALLET>');
delete from public.scores               where player         = lower('<WALLET>');
delete from public.welcome_pack_claims  where wallet_address = lower('<WALLET>');
commit;
```
**Local:** abre `https://<host>/dev/reset` → "Wipe local progress" (progreso,
estrellas, streak/COMBO, daily, shields cache, save state, badges local, welcome pack).

**On-chain (NO se borra):** badges de pieza reclamados.

---

## 🟦 PLAY (partidas, Coach)

**Redis (coach):**
```
DEL coach:games:<wallet>
DEL coach:analyses:<wallet>
DEL coach:credits:<wallet>
DEL coach:pending:<wallet>
```
Más las keys por-partida (patrón) — usa SCAN, NO un patrón ancho:
```
redis-cli -u "$UPSTASH_REDIS_URL" --scan --pattern 'coach:game:<wallet>:*'     | xargs -r redis-cli -u "$UPSTASH_REDIS_URL" DEL
redis-cli -u "$UPSTASH_REDIS_URL" --scan --pattern 'coach:analysis:<wallet>:*' | xargs -r redis-cli -u "$UPSTASH_REDIS_URL" DEL
```
> ⚠️ NO uses `coach:*<wallet>*` — atraparía `coach:pro:` (PRO) y
> `coach:shields:credited:` (LEARN). Alternativa limpia: el endpoint in-app
> `DELETE /api/coach/history` borra el historial de Coach con nonce.

**Supabase:**
```sql
delete from public.coach_analyses where wallet = lower('<WALLET>');
```
**Local:** borra `chesscito:victory-pending:*` (lo hace también `/dev/reset`).

**On-chain (NO se borra):** Victory NFTs minteados. La tabla `victories`
(`player`) es un read-model sincronizado desde la cadena → **no la borres, se
re-hidrata**. PLAY seguirá mostrando tus victorias on-chain.

---

## 🟨 COMPARTIDO (afecta LEARN **y** PLAY — decide si incluir)

- **PRO** (`coach:pro:<wallet>`, Redis) — beneficios en LEARN (training pass) y
  PLAY (Coach). Era tu bloqueante. Bórralo si quieres probar como no-PRO:
  ```
  DEL coach:pro:<wallet>
  ```
- **Peones** (`peones_ledger`, Supabase) — economía ganada en LEARN, gastada en
  ambos. Borrar deja balance 0 (Welcome Pack re-reclamable):
  ```sql
  delete from public.peones_ledger where wallet = lower('<WALLET>');
  ```

**Opcional (dedupe de tx):** solo si quisieras re-verificar la MISMA tx de compra
(para una compra nueva NO hace falta): `coach:pro:processed-tx:<txHash>`,
`coach:shields:processed-tx:<txHash>`.

---

## Recetas rápidas
- **Solo LEARN fresh:** sección 🟩 (+ 🟨 Pass ya está en LEARN; incluye PRO+Peones si quieres no-PRO/0 Peones).
- **Solo PLAY fresh:** sección 🟦 (Coach). Victorias on-chain permanecen.
- **Todo fresh (new-user):** 🟩 + 🟦 + 🟨 completos, luego `/dev/reset` + reload.

## Orden y ejecución
1. Redis (server) → 2. Supabase (server) → 3. Local `/dev/reset` → 4. Reload.
Supabase tiene RLS → corre con **service role** (SQL editor o `psql`/`supabase` CLI
con credenciales server-side). Server primero, local al final para no re-hidratar.

## Verificación post-reset
- LEARN: PRO/Pass fuera (CTA "Join Challenge"), Peones 0, shields 0, progreso en cero.
- PLAY: sin historial de Coach; victorias on-chain siguen visibles (by design).
- Si algo no queda como esperas, revisar case de la wallet (todo lowercase).

## Qué NO se resetea (on-chain, inmutable)
Badges reclamados + Victory NFTs. Para eso solo sirve otra wallet (navegador +
wallet inyectada nueva, o cuenta MiniPay nueva).
