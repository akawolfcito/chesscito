# Chesscito - Evaluacion Celopedia de foco Celo/MiniPay y estrategia de grants

**Fecha:** 2026-06-18  
**Modo:** analisis estrategico, sin implementacion  
**Fuentes usadas:** Celopedia skill v2.1.0 del repo, `README.md`, documentos de negocio/submission/readiness existentes, catalogo snapshot MiniPay 2026-04-09, y lectura viva de `https://celopg.eco/programs` el 2026-06-18.

---

## 1. Veredicto corto

**Probabilidad de que Chesscito este bien centrado en el ecosistema Celo/MiniPay: 84/100.**

Chesscito esta bastante bien ubicado para Celo y MiniPay porque no intenta ser "un juego Web3" generico. Es un producto mobile-first, de microtransacciones en stablecoins, con contratos ya en Celo Mainnet, onboarding pensado para MiniPay, precios compatibles con pagos pequenos y narrativa de educacion/acceso abierto. Eso encaja mejor con Celo que una app de trading, casino o coleccionismo especulativo.

La razon por la que no le daria 95/100 todavia es que el valor para el ecosistema aun se comunica mas como producto propio que como infraestructura, inclusion o caso repetible para otros builders. Para grants grandes, Chesscito debe presentarse menos como "mi app de ajedrez" y mas como **un caso demostrable de aprendizaje, micro-pagos, logros verificables, IA y distribucion MiniPay para mercados emergentes**.

---

## 2. Encaje con Celo y MiniPay

| Dimension | Calificacion | Lectura |
|---|---:|---|
| MiniPay mobile-first | 9/10 | El app esta disenado alrededor de viewport movil, 360x640 ya auditado, y el producto no depende de desktop. |
| Stablecoin utility | 8/10 | Pagos en USDC/USDT/cUSD, precios pequenos, seleccion de stablecoin por balance. Debe seguir evitando CELO dentro de MiniPay. |
| On-chain usefulness | 7/10 | Badges, scores, Shop y Victory NFT tienen sentido como prueba/verificacion, pero algunas partes aun se sienten mas "coleccionable" que "impact proof". |
| Ecosystem differentiation | 9/10 | En el snapshot MiniPay hay juegos, rewards, finance y utilities; no aparece otro juego educativo de ajedrez/pre-ajedrez con IA coach. |
| Grant-readiness | 8/10 | Tiene mainnet, docs, packet MiniPay, tx samples y pitch. Le falta empaquetar milestones con impacto medible y top-line ecosystem value. |
| AI/agent alignment | 6/10 | El Coach ya abre la puerta, pero aun no esta posicionado como agente Celo verificable, x402 API o ERC-8004 reputation flow. |
| Public goods / education | 8/10 | La tesis de acceso abierto es fuerte. Falta medir aprendizaje, retencion y beneficiarios con mas rigor. |

**Diagnostico:** Chesscito no esta descentrado. Esta en una zona buena, pero puede subir su probabilidad de grants si convierte tres cosas en ejes publicos: MiniPay distribution, education/public-good metrics, y AI/stablecoin infrastructure.

---

## 3. Cosas buenas que ya tiene

1. **Producto real, no pitchware.** Hay app, contratos en Celo Mainnet, transacciones de muestra, packet MiniPay, docs, flujo PRO, tienda, score save y Victory NFT.
2. **Diferenciacion en MiniPay.** El catalogo snapshot esta cargado hacia rewards, finance, utility y casual games. Chesscito es educacion skill-based, no casino-loop ni earn-loop.
3. **Precios nativos de Celo.** Montos como $0.005, $0.01, $0.025, $0.10 y $1.99 son precisamente donde Celo/MiniPay tienen ventaja frente a rails tradicionales.
4. **Narrativa sana.** El producto evita ROI, gambling y "play-to-earn". Eso ayuda con MiniPay, educacion, familias, grants y reputacion.
5. **MiniPay readiness avanzada.** Ya hay Stage 2 packet, `/stats`, legal/support, 360x640, no-CELO runtime audit y contratos verificados.
6. **Capa educativa defendible.** El respaldo de un Maestro FIDE y el enfoque pre-ajedrecistico le dan mas credibilidad que una app casual.
7. **AI Coach como semilla.** Aunque todavia no es agent infrastructure, puede convertirse en una linea de grants muy fuerte si se abstrae correctamente.

---

## 4. Que deberia cambiar o mejorar

### P0 estrategico

1. **Mover el pitch de "juego" a "educational MiniPay case study".**  
   "Juego de ajedrez on-chain" suena nicho. "MiniPay education app proving stablecoin micro-payments for open access learning" suena grant-ready.

2. **Separar claramente tres capas: producto, impacto, infraestructura.**  
   Producto: Chesscito app.  
   Impacto: acceso abierto, aprendizaje, familias/escuelas, metricas.  
   Infraestructura: pagos pequenos, stats, agent/coach, receipts, sponsorship rails.

3. **Convertir `/stats` en una pieza de grants, no solo compliance.**  
   Deberia mostrar: usuarios activos, ejercicios completados, badges reclamados, tx por metodo, volumen stablecoin, usuarios unicos on-chain, retention, top countries y "learning impact".

4. **Crear milestones grant-ready.**  
   No pedir "funding para seguir construyendo Chesscito". Pedir funding para entregables cerrados: "School Pilot", "MiniPay Education Analytics", "AI Coach Agent", "Sponsor-a-School stablecoin rail".

### P1 producto

5. **Reducir surfaces que distraen del core.**  
   Shop, PRO, Coach, Arena, Victory Cards, Badges, Peones, Founder, Supporter, Trophies, Leaderboard y school roadmap pueden sentirse como demasiadas narrativas. Para MiniPay/grants, elegir 3: Learn, Progress, Support.

6. **Fortalecer onboarding no-cripto.**  
   El usuario debe entender "practico, avanzo, guardo mi progreso, apoyo el acceso abierto" antes de ver cualquier detalle on-chain.

7. **Evitar sobrepeso de NFT en la narrativa.**  
   Victory NFT debe seguir siendo "recuerdo verificable" o "proof of practice", no asset coleccionable como eje central.

8. **Medir aprendizaje, no solo transacciones.**  
   Grants de educacion/impacto se ganan con evidencia: sesiones, progreso por pieza, dificultad completada, streaks, mejora de precision, cohortes.

### P2 tecnico-operativo

9. **Cerrar el gap de performance movil.**  
   La documentacion muestra progreso, pero MiniPay apunta a 90+ mobile. Mientras no este verde, debe tratarse como riesgo de listing.

10. **Alinear SLA a MiniPay.**  
    El packet menciona 48h, mientras Celopedia/MiniPay recomienda capacidad de resolver issues criticos en 24h. Conviene presentar 24h para P0/P1 y 48h para no criticos.

---

## 5. Que convendria sacar como producto per se

Estas piezas podrian vivir como productos o subproductos propios, porque tienen valor mas alla de Chesscito:

1. **Chesscito Coach API / AI Learning Agent.**  
   Un agente que analiza partidas o ejercicios y recomienda entrenamiento. Grant angle: AI + education + Celo identity/reputation.

2. **MiniPay Education Analytics Kit.**  
   Un dashboard reusable para apps MiniPay educativas: DAU/MAU, retention, tx, stablecoin volume, failed tx, learning progress.

3. **Sponsor-a-Student / Sponsor-a-School Rail.**  
   Flujo de patrocinio con stablecoins para desbloquear PRO o paquetes educativos para estudiantes/escuelas, con reportes publicos de impacto.

4. **Proof-of-Practice Badges.**  
   Un sistema de soulbound badges para aprendizaje, no solo ajedrez. Podria servir a cursos, clubes, bootcamps y comunidades.

5. **Supporter Gallery / Impact Registry.**  
   Registro publico de supporters, sponsors y beneficiarios, con privacidad cuidada. Encaja con Celo Public Goods y grants retroactivos.

6. **MiniPay Microtransaction UX Patterns.**  
   Libreria o playbook open-source: low-balance deeplink, stablecoin selector, no-CELO runtime, tx samples, copy safe.

7. **School Pilot Pack.**  
   Producto institucional: cohortes, dashboards, ejercicios, reportes y sponsoreo verificable.

8. **On-chain Learning Receipt Standard.**  
   Metadata y contrato simple para "complete una practica", portable a otras apps educativas.

Mi recomendacion: no separar todo ahora. Separaria primero **Education Analytics Kit** y **Sponsor-a-School Rail** como documentos/product-lines, no como repos. Son los que mas ayudan a grants sin distraer del app.

---

## 6. Grants y programas activos al 2026-06-18

Lectura viva de `celopg.eco/programs`:

| Programa | Ventana | Monto visible | Encaje con Chesscito |
|---|---|---:|---|
| **Prezenti: Frontier Pool** | May 6 - Jun 30, 2026 | Up to 25K USD Grants | Bueno si el milestone es AI/agent infrastructure: Coach Agent, x402 paid coaching API, ERC-8004 reputation. |
| **Proof of Ship S2** | Apr 1 - Jul 31, 2026 | 20K USDT | Muy bueno. Mini App builders, shipping reputation, metrics, monthly cadence. |
| **Prezenti: Anchor Round** | Feb 25 - Jun 30, 2026 | Up to 25K USD Grants | Bueno para milestone educativo/general: MiniPay education pilot, analytics, school sponsorship rail. |
| **Celo Builder Fund** | Jan 1 - Dec 31, 2026 | $25K per project investment | Muy bueno si Chesscito se presenta como venture/product with traction, not only public good. |

Nota: GoodBuilders S3 figura en la referencia cacheada de Celopedia como Feb 5 - May 18, 2026, por lo que al 2026-06-18 no debe tratarse como activo salvo que se confirme una nueva ronda.

---

## 7. Top 10 ideas/proyectos alineados para grants

### 1. MiniPay Education Proof-of-Practice

**Idea:** convertir los ejercicios completados en pruebas verificables de progreso educativo, con badges soulbound y dashboard publico.  
**Por que Celo:** usa fees bajos, mainnet, identidad ligera y stablecoins para sostener acceso abierto.  
**Grant target:** Prezenti Anchor, Proof of Ship S2, Celo Builder Fund.  
**Probabilidad grant-fit:** 9.2/10.

### 2. Sponsor-a-School Stablecoin Rail

**Idea:** permitir que sponsors financien acceso PRO o creditos educativos para escuelas/clubes, con reportes de uso y progreso.  
**Por que Celo:** stablecoin payments, transparencia, mercados emergentes, public goods.  
**Grant target:** Prezenti Anchor, Celo Builder Fund, Divvi/impact programs si hay volumen.  
**Probabilidad grant-fit:** 9.0/10.

### 3. Chesscito Coach as Celo AI Agent

**Idea:** registrar el Coach como agente con identidad/reputacion, historiales de feedback y endpoints publicos.  
**Por que Celo:** Celopedia marca ERC-8004, x402 y AI agents como eje del ecosistema.  
**Grant target:** Prezenti Frontier Pool.  
**Probabilidad grant-fit:** 8.9/10.

### 4. x402 Micro-Coaching API

**Idea:** API pagada por uso para analisis de partidas/ejercicios con stablecoins, reutilizable por clubes o apps educativas.  
**Por que Celo:** x402 + pagos sub-centavo + settlement rapido.  
**Grant target:** Prezenti Frontier Pool, Celo Builder Fund.  
**Probabilidad grant-fit:** 8.7/10.

### 5. MiniPay Learning Analytics Kit

**Idea:** open-source kit para que Mini Apps educativas midan DAU, retention, tx, stablecoin volume, progress y failed tx.  
**Por que Celo:** mejora calidad del ecosistema MiniPay y reduce friccion de listing.  
**Grant target:** Proof of Ship S2, Prezenti Anchor.  
**Probabilidad grant-fit:** 8.6/10.

### 6. Stablecoin Microtransaction UX Library

**Idea:** libreria/pattern pack para selector USDC/USDT/USDm, low-balance Deposit deeplink, copy MiniPay-safe y tx status.  
**Por que Celo:** ataca un dolor transversal de builders MiniPay.  
**Grant target:** Proof of Ship S2, Celo Builder Fund.  
**Probabilidad grant-fit:** 8.3/10.

### 7. Open Chesscito School Pilot

**Idea:** piloto con una escuela/club/ONG: cohortes, metas semanales, dashboard de progreso y sponsor stablecoin.  
**Por que Celo:** impacto medible, inclusion, pagos globales, public goods.  
**Grant target:** Prezenti Anchor, Celo Builder Fund.  
**Probabilidad grant-fit:** 8.2/10.

### 8. Impact Supporter Registry

**Idea:** galeria/registro verificable de supporters y beneficiarios, con privacy-safe reporting.  
**Por que Celo:** conecta micro-donaciones, reconocimiento y public goods.  
**Grant target:** Prezenti Anchor, Celo Public Goods-style retro funding, Divvi si hay tx usage.  
**Probabilidad grant-fit:** 7.9/10.

### 9. MiniPay Game-to-Learn Template

**Idea:** template open-source basado en Chesscito para juegos educativos MiniPay: onboarding, tasks, badges, stablecoin shop, stats.  
**Por que Celo:** genera mas builders y casos no-financieros en MiniPay.  
**Grant target:** Proof of Ship S2, Prezenti Anchor.  
**Probabilidad grant-fit:** 7.8/10.

### 10. Local Stablecoin Education Experiments

**Idea:** experiencias por pais usando Mento local stablecoins donde tenga sentido: COPm, KESm, NGNm, BRLm, etc.  
**Por que Celo:** Celo es home of stablecoins y MiniPay opera en mercados donde moneda local importa.  
**Grant target:** Celo Builder Fund, ecosystem/local stablecoin partners.  
**Probabilidad grant-fit:** 7.4/10.

---

## 8. Que conviene sacar o bajar de prioridad

1. **CELO como opcion de pago user-facing.**  
   Ya esta oculto en MiniPay y deberia seguir asi. Para el pitch MiniPay, stablecoins only.

2. **Founder Badge como headline.**  
   Puede quedarse, pero no debe ser el centro. El centro debe ser progreso educativo y acceso abierto.

3. **Victory NFT como coleccionable.**  
   Mantenerlo como "victory card" o "proof of game", no como NFT especulativo.

4. **Demasiadas monedas/nombres internos.**  
   Peones, shields, credits, PRO, badges, victory cards y founder pueden abrumar. Para grant/pitch, agruparlos como "practice economy".

5. **Arena full chess como producto principal.**  
   Es valioso, pero el diferencial grant-ready es el learning path. Arena debe ser retention/progression, no reemplazo de Chess.com.

6. **Claims cognitivos fuertes.**  
   Mantener "playful cognitive companion" y evitar salud/terapia/diagnostico.

---

## 9. Recomendacion de foco para los proximos 30 dias

### Semana 1: Empaque grant-ready

- Reescribir pitch corto: "MiniPay education app proving stablecoin micro-payments for open access learning".
- Preparar 3 milestone proposals: Proof-of-Practice, Sponsor-a-School, AI Coach Agent.
- Actualizar packet con SLA P0/P1 de 24h y PageSpeed actual.

### Semana 2: Evidencia

- Capturar metricas actuales de `/stats`.
- Documentar transacciones por metodo, usuarios unicos, badges, Victory Cards, PRO/shop revenue y ejercicios completados.
- Preparar screenshots MiniPay 360x640.

### Semana 3: Outreach

- Aplicar a Proof of Ship S2 con shipping log y metrics.
- Aplicar a Prezenti Anchor con School Pilot / Proof-of-Practice.
- Preparar Celo Builder Fund con vision venture: education + stablecoin microtransactions + AI coach.

### Semana 4: Producto minimo de impacto

- No construir features nuevas grandes sin grant target.
- Pulir performance mobile, stats e impacto.
- Conseguir 1 piloto real: escuela, club de ajedrez, comunidad Celo, ONG o cohort beta.

---

## 10. Conclusion

Chesscito tiene un encaje fuerte con Celo/MiniPay porque usa Celo para algo que si necesita Celo: pagos pequenos, costos bajos, prueba verificable, acceso global y distribucion movil. La oportunidad no es competir como otro juego del catalogo. La oportunidad es convertirse en **el caso de referencia de educacion gamificada en MiniPay**.

La estrategia mas fuerte para grants es no pedir dinero para "hacer crecer Chesscito" de forma amplia. Es pedir funding para piezas con valor ecosistemico:

- proof-of-practice educativo,
- sponsor-a-school con stablecoins,
- AI Coach como agente Celo,
- analytics/patterns reutilizables para Mini Apps.

Si Chesscito empaqueta esas lineas con milestones medibles, su probabilidad de encajar en Celo grants sube de **84/100** a una zona cercana a **90/100**.
