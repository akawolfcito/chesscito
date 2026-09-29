# Handoff — revisión de Upstash y Vercel

**Fecha:** 2026-09-14 · **Estado:** análisis; no se modificaron planes ni datos remotos.

## Contexto ya resuelto

- Supabase ya opera en plan **Free**. No es una migración pendiente; se vigilan su cuota, egress y el backup externo verificado.
- La copia de seguridad local/externa y la limpieza de Docker se trabajaron previamente.
- `pnpm ops:no-token` concluyó que el freno observado es saldo insuficiente real, no una falla de infraestructura.

## Última medición: `pnpm ops:health`

Tomada el 2026-09-13 21:11, Bogotá, en modo read-only:

- **Upstash:** 22.430 claves; PING mediano 123 ms y p95 467 ms (la primera conexión TLS fue el máximo). Plano de datos sano.
- **Upstash pendiente:** el monitor no puede leer comandos del período ni bandwidth porque no tiene credenciales de Management API. No añadir esas credenciales al repositorio ni a `.env` sólo para esta auditoría.
- **Vercel:** `chesscito` y `lite-chesscito` acumulan 31.393 invocaciones desde 2026-09-04. Los dominios respondieron HTTP 200. Hubo un 5xx aislado en `/api/welcome-pack/status` y uno en `/api/inbox`; telemetry no reportó 5xx en la muestra.
- El estado RED del monitor procede de medir el snapshot amplio de Supabase junto con el arranque de un contenedor temporal. Una sonda read-only mínima respondió `SELECT 1` en 68 ms y `SELECT now()` en 73 ms; no hay evidencia de lentitud real de Postgres.

## Lo que el usuario vio en Upstash Console

- Plan actual: **Pay As You Go**.
- Comandos: **127k** (69.264 writes, 57.468 reads).
- Bandwidth: **7 MB**.
- Storage: **5 MB**.
- Coste del período mostrado: **US$0,25**; budget configurado: US$300.

Frente al nivel Free de Upstash Redis (500k comandos/mes, 10 GB/mes, 256 MB), los tres números caben con mucho margen. Falta consultar la ventana/período exacto por una fuente autenticada antes de efectuar un downgrade.

## Decisiones

- **Upstash:** candidato a Free, condicionado a confirmar el período de uso y que sólo exista una base Redis activa. Redis no se elimina ni se sustituye: guarda estado de producto y saldos.
- **Vercel:** no bajar a Hobby mientras Chesscito tenga compras o persiga ingresos. Aunque las invocaciones observadas son bajas, Hobby permite únicamente uso personal/no comercial según los términos de Vercel.
- No se ha cambiado ningún plan.

## Plugin de Upstash

Se instaló globalmente el plugin oficial:

```text
Marketplace: upstash/skills
Plugin: upstash@upstash
```

El plugin configura el MCP remoto de Upstash. Esta conversación no lo ve porque se inició antes de la instalación.

### Próximo paso seguro

1. Abrir una conversación nueva o reiniciar Codex en este proyecto.
2. Pedir: “consulta las estadísticas de Upstash”.
3. Cuando aparezca OAuth, iniciar sesión en Upstash y aprobar el acceso.
4. Consultar en modo read-only: base(s) Redis activa(s), período de consumo, comandos, bandwidth y almacenamiento.

No compartir ni pegar API keys, REST tokens, URLs de conexión ni credenciales en el chat o archivos del proyecto.

## Referencias

- [Informe de preparación para planes gratuitos](2026-09-13-free-tier-readiness.md)
- [Precios de Upstash Redis](https://upstash.com/pricing/redis)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Términos de Vercel](https://vercel.com/legal/terms)
