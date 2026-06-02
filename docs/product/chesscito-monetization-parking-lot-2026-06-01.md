# Chesscito — Monetization Parking Lot (M1 → futuro)

**Fecha:** 2026-06-01
**Autor:** Clausita (dirigido por Wolfcito)
**Propósito:** Catalogar ideas, oportunidades y propuestas de monetización que **NO se implementan en M1**, pero que no queremos perder. Cada entrada incluye descripción, valor potencial, requisitos para activarla, y razón de postergación.
**Fuente:** auditoría 2026-06-01 + memorias de producto.

---

## Cómo leer este parking lot

Cada idea está clasificada por **estadio**:

- 🟡 **Investigación abierta** — vale explorar; no hay commitment.
- 🔵 **Diseño pendiente** — necesita spec + brainstorm antes de planificación.
- 🟠 **Roadmap próximo (post-M3)** — viable, ya identificada como deseable.
- 🔴 **Bloqueada** — depende de algo más (contrato, regulación, validación).

**Regla:** ninguna idea sale del parking lot a un cluster activo sin pasar por brainstorm + spec + audit estratégico.

---

## 1. Torneos pagados 🟠

**Idea:** competiciones con entry fee en stablecoin, prize pool distribuido al final, multiplayer asíncrono o en vivo.

**Valor potencial:**
- Revenue por entry fees (ej: $0.50 entry × 200 players = $100 pool, 20% rake = $20 revenue / torneo).
- Adquisición orgánica vía competencia.
- Retención semanal (torneos recurrentes).

**Requisitos para activar:**
- Multiplayer infrastructure (no existe; actualmente solo vs AI local).
- Server-side game session attestation (no existe; `timeMs` self-reported).
- Distribución real de prize pool (no existe; ver item §2).
- Matchmaking + anti-cheat.
- Contrato nuevo: tournament escrow + distribution.

**Por qué postergada:**
- Multiplayer es un milestone de meses, no de un cluster.
- Sin attestation server-side, hay vector de cheating obvio.
- Sin distribución de prize pool funcional, el frame es inviable.

**Próximo paso (cuando llegue su turno):**
- Spec con brainstorm sobre formato (Swiss, single-elim, async ladder).
- Validar legalidad por jurisdicción (entry fee + prize en LatAm).
- Audit del contrato escrow antes de mainnet.

---

## 2. Prize Pool v2 (con distribución real) 🔴

**Idea:** convertir el actual prize pool acumulado (20% de Victory mints) en algo distribuible: ledger Supabase + admin distribution UI + método on-chain de payout + cron de distribución.

**Valor potencial:**
- Cumplir la promesa pendiente con el usuario actual.
- Habilitar torneos pagados (item §1).
- Frame honesto: "tu mint contribuye al pool, el pool se reparte cada X días entre Y criterios".

**Requisitos:**
- Decidir criterios de distribución (winners semanales? leaderboard? sorteo cripto-verificable?).
- Ledger Supabase con registro de earned/distributed per wallet.
- Admin UI para gestionar distribución (con safeguards / multi-sig).
- Método on-chain de payout (modificación a `VictoryNFTUpgradeable` o contrato nuevo de treasury).
- Cron / batch job que ejecute la distribución.
- Audit del nuevo flow.

**Por qué bloqueada:**
- Requiere decisión de producto sobre criterios (no es solo técnico).
- Requiere contrato nuevo o upgrade del actual.
- Requiere validación legal del esquema de distribución por jurisdicción.

**Acción M1:** **OCULTAR / NEUTRALIZAR el prize pool** en UI hasta que esto exista. No comunicar como promesa.

---

## 3. Sponsors / patrocinios 🟡

**Idea:** brands o partners patrocinan tournament prize pools, banners discretos, themed events.

**Valor potencial:**
- B2B revenue que no canibaliza el funnel B2C.
- Storytelling ("este torneo patrocinado por [marca]").
- Cross-promotion con ecosistema Celo / LatAm.

**Requisitos:**
- Producto en estado comercial maduro (M2-M3 ejecutados).
- Inventory de slots claros (banner en endgame? card en Shop? tournament naming?).
- Sales funnel B2B (no existe).
- Sponsor agreement template + facturación.

**Por qué postergada:**
- Sin producto B2C estable, vender B2B es prematuro.
- Sin inventory definido, las conversaciones con sponsors no tienen oferta clara.

**Próximo paso:**
- Esperar a M3 / M4. Luego mapear inventory disponible.

---

## 4. B2B / colegios / educación 🟡

**Idea:** licencias para profesores de ajedrez en LatAm, paquetes para escuelas, dashboard de progreso de alumnos.

**Valor potencial:**
- Tracción institucional (educación + ajedrez es vertical natural en LatAm).
- Sticky revenue (contratos anuales).
- Story de impacto social.

**Requisitos:**
- Dashboard multi-user (no existe).
- Pricing tier institucional (no definido).
- Cumplimiento de privacidad de menores (COPPA-equivalent en LatAm).
- Equipo de ventas o partnership.

**Por qué postergada:**
- Producto consumer necesita estabilidad antes de añadir capa institucional.
- Privacidad de menores es vector regulatorio serio.
- No hay equipo de ventas para hacer outreach a colegios.

**Próximo paso:**
- Mapear 3 colegios pilot interesados (research, no commitment).
- Diseñar dashboard mockup para validar interés.

---

## 5. Founder Badge soulbound 🔴

**Idea:** convertir Founder Badge actual (spend fungible sin perks) en NFT soulbound con perks reales (ej: 10% discount en Coach packs, identidad visual permanente, acceso early a features).

**Valor potencial:**
- Diferenciación clara de Founder Badge vs Welcome Pack.
- Recompensa simbólica para early supporters.
- Posible scarcity real (max supply on-chain).

**Requisitos:**
- Contrato nuevo (soulbound ERC-721 con perks check).
- Decisión de perks concretos (no aire).
- Migración de holders actuales del fungible (si los hay).
- Audit del contrato.

**Por qué bloqueada:**
- Requiere contrato nuevo (audit + deploy + verificación).
- Perks no están definidos.
- Migración de holders actuales requiere coordinación.

**Decisión M1:** rediseñar Founder Badge como **Welcome Pack** sin contrato (server-side bundle) **o** ocultarlo. La versión soulbound queda en parking lot.

---

## 6. Contratos nuevos 🔴

Lista de contratos que **NO se construyen en M1**, pero que aparecen en el roadmap potencial:

| Contrato | Propósito | Pre-requisito |
|---|---|---|
| Welcome Pack itemId=7 | Bundle on-chain alternativo al server-side | Validar que server-side bundle no escala |
| VictoryNFT v2 | Server-side game session attestation | Multiplayer o tournaments |
| Prize Pool distribution | Método de payout on-chain | Decisión de criterios |
| Sponsored tournament escrow | B2B tournament infra | Sponsor pipeline |
| Founder Badge soulbound | Item §5 | Perks definidos |
| Referral contract | Referidos on-chain con split | Item §8 |
| Season Pass | Item §9 | Validación de modelo |

**Regla:** ningún contrato nuevo en M1. Cada uno requiere spec + audit + deploy + verification antes de mainnet.

---

## 7. Rankings avanzados / ELO 🟡

**Idea:** sistema de rating ELO + leaderboard global + temporadas.

**Valor potencial:**
- Retención competitiva.
- Status / identidad ("Soy 1450 ELO en Chesscito").
- Storytelling alrededor del progreso.

**Requisitos:**
- Multiplayer (item §1) o ELO solo vs AI con tier difficulty.
- Backend de rating (cálculo, storage, queries).
- UI de leaderboard + perfil.
- Antifraude (importante si hay premios).

**Por qué postergada:**
- ELO solo vs AI tiene poco significado.
- Multiplayer es prerequisito real.
- Sin moderación, leaderboard se ensucia rápido.

**Próximo paso:**
- Spec mínimo para ELO local (solo vs AI) como prototipo.
- Validar interés de jugadores power.

---

## 8. Referidos 🟡

**Idea:** referral code que da créditos Coach (o peones) al referrer + welcome bonus al referido.

**Valor potencial:**
- Adquisición orgánica viral.
- CAC bajo si funciona.
- Loop natural con share modal post-victoria.

**Requisitos:**
- Sistema de tracking de referrals (server-side).
- Decisión de incentivos (peones, créditos, PRO days?).
- Anti-abuso (mismo IP, mismas wallets sybil).
- UI de "Invita a un amigo" en Account.

**Por qué postergada:**
- Sin funnel comercial activo (M1 lo arranca), referidos son prematuros.
- Sybil protection es no-trivial.
- Decisión de incentivos requiere telemetría base que aún no tenemos.

**Próximo paso (post-M3):**
- Spec con incentive testing.
- Sybil heuristics (device fingerprint + onchain reputation).

---

## 9. Season Pass 🟡

**Idea:** pass trimestral o semestral con beneficios diferentes a PRO (cosmetics, peones extra, unlock de modos especiales).

**Valor potencial:**
- ARPU alto vía bundles cosméticos (theme system foundation ya dormido en repo).
- Engagement por temporada (collect-to-complete loops).
- Storytelling de seasons (eventos, themes).

**Requisitos:**
- Theme system activado y poblado de assets.
- Modos especiales construidos (puzzles, daily challenges, etc.).
- Lógica de season expiry + reward tracking.
- Pricing tier que no canibalice PRO.

**Por qué postergada:**
- Theme system está dormido (esperando asset drop).
- Sin modos especiales construidos, el pass está vacío.
- PRO debe demostrar ARPU base antes de añadir un segundo pass.

**Próximo paso:**
- Validar que PRO funciona (M2 telemetría).
- Brainstorm de qué incluiría el season pass (assets vs gameplay).

---

## 10. Donaciones / Tip Jar 🟡

**Idea:** botón "Apoya Chesscito" con donación directa al treasury en USDC, sin contrapartida funcional.

**Valor potencial:**
- Capa de community / impacto que algunos usuarios valoran.
- Revenue extra sin afectar funnel principal.
- Honest framing: "Ayúdanos a seguir construyendo".

**Requisitos:**
- UI sencilla (Account section o footer).
- Endpoint que reciba transfer y emita recibo simbólico.
- Copy honesto (sin gamification falsa, sin perks ocultos).

**Por qué postergada (pero accesible):**
- No es prioridad de revenue.
- Necesita copy bien calibrado para no sonar a mendicidad ni a manipulación.

**Próximo paso:**
- Spec mínimo cuando se quiera abrir capa de community real.

---

## 11. Whitelabel / Multi-tenant 🟡

**Idea:** clubes de ajedrez (físicos o virtuales) pueden tener su instancia con vanity domain, branding, identidad propia.

**Valor potencial:**
- Revenue B2B recurrente.
- Cada whitelabel = canal de adquisición.
- Story de "powered by Chesscito".

**Requisitos:**
- Producto core estable.
- Multi-tenant architecture (no existe).
- Vanity domain provisioning automático.
- Branding system / theme system maduro.
- Equipo de partnership.

**Por qué postergada:**
- Producto core aún no maduro.
- Multi-tenant es arquitectura de meses.
- Sin demanda validada.

---

## 12. Daily Challenge / Puzzle del Día 🟡

**Idea:** un puzzle táctico diario, gratis para todos, con leaderboard de tiempo, racha + recompensas.

**Valor potencial:**
- Retención D1 (la gente vuelve por el daily).
- Adquisición orgánica (compartir resultado tipo Wordle).
- Gancho para PRO (puzzle ilimitado o análisis del intento).

**Requisitos:**
- Banco de puzzles (curado o generado).
- UI de puzzle (parecida a Arena pero one-shot).
- Streak tracking en Supabase.
- Recompensa diaria (peones? créditos? trofeo?).

**Por qué postergada:**
- Banco de puzzles requiere curación o licensing.
- UI nueva (no es reutilizar Arena tal cual).
- Validación de retention vs costo dev.

**Próximo paso:**
- Spec MVP con 30 puzzles curados.
- A/B test de retention.

---

## 13. Coleccionables temáticos (skins de pieza, tableros) 🔵

**Idea:** vender skins cosméticas para piezas + tableros. Theme system foundation ya está listo para esto.

**Valor potencial:**
- ARPU alto en cohort que valora identidad visual.
- Storytelling por temporada (Halloween 2026, Christmas 2026).
- Reactivar Founder Badge como item cosmético entre otros.

**Requisitos:**
- Assets visuales (arte ilustrativo de Chesscito).
- Theme system activado (foundation ya dormido).
- SKUs en Shop.
- Lógica de "set activo" en Account.

**Por qué postergada:**
- Foundation lista, pero no hay drop de assets aún (memory `project_theme_system_foundation`).
- Sin telemetría base, no sabemos si el cohort cosmético existe.

**Próximo paso:**
- Coordinar con arte para definir primer drop (ej: PRO Gold Leaf como reward de PRO).
- Validar con copy/UI antes de mintear SKUs.

---

## 14. Coach Voice / TTS 🟡

**Idea:** Luz lee el análisis en voz alta (TTS), con personalidad y entonación.

**Valor potencial:**
- Diferenciación de experiencia (Coach con voz se siente más real).
- Accesibilidad (jugadores que prefieren audio).
- Engagement post-game (escuchar en lugar de leer).

**Requisitos:**
- Provider TTS (ej: ElevenLabs, OpenAI TTS).
- Costo adicional por análisis (TTS es ~$0.001-$0.005 / minuto).
- UI player en coach viewer.
- Voice direction (¿qué voz? ¿qué tono?).

**Por qué postergada:**
- Costo añadido sin validación de demanda.
- Decisión de voz / personalidad requiere brainstorm.

**Próximo paso:**
- Prototype con 5 análisis a TTS para validar UX.
- Decisión de voz (LatAm es prioritario; acento latino).

---

## 15. AI Opponent personalities 🟡

**Idea:** en lugar de "Easy / Medium / Hard", oponentes con personalidad (Luz Strategist, Diego Aggressive, etc.), cada uno con estilo de juego distinto.

**Valor potencial:**
- Engagement por curiosidad ("¿cómo juega Luz?").
- Storytelling alrededor de los rivales.
- Unlock de personalidades como milestone.

**Requisitos:**
- Tuning del engine para reflejar personalidad (no trivial con js-chess-engine).
- Arte por personaje.
- Copy / dialog (intro + reacciones a movidas).

**Por qué postergada:**
- Engine tuning es trabajo significativo.
- Sin validación de demanda.

---

## 16. Cross-game collectibles (multi-juego ecosystem) 🟡

**Idea:** Chesscito como primer juego de una familia (peón → pieza → tablero); collectibles que crossean entre juegos.

**Valor potencial:**
- Plataforma > juego único.
- Network effects entre juegos hermanos.

**Requisitos:**
- Más de un juego funcional.
- Infraestructura compartida (contratos, accounts, identity).

**Por qué postergada:**
- Chesscito solo. No hay hermanos.
- Pensar en ecosystem antes de tener un solo juego comercial fuerte es premature optimization.

---

## 17. Push notifications / re-engagement 🔵

**Idea:** notificaciones contextuales ("Tu pase PRO expira en 2 días", "Tienes un análisis sin leer", "Daily challenge ya disponible").

**Valor potencial:**
- Retención D7 / D30.
- Recovery de churners.
- Trigger para upsells contextuales.

**Requisitos:**
- Push infrastructure en MiniPay (verificar si está expuesta vía MiniPay SDK).
- Lógica de scheduling.
- Opt-in flow.

**Por qué postergada:**
- Necesita validar disponibilidad real en MiniPay (no es web push estándar).
- Anti-spam discipline antes de habilitar.

---

## 18. Premium content / curated lessons 🟡

**Idea:** lessons curadas (escritas por jugadores expertos) detrás de PRO o packs especiales. Diferente del análisis automático de Luz.

**Valor potencial:**
- Diferenciación del análisis genérico.
- B2B oportunidad (profesores publican lessons).
- Storytelling alrededor de mentors.

**Requisitos:**
- Equipo de curación o partnership con creators.
- Sistema de hosting de lessons.
- Pricing tier (PRO sí / no? pack aparte?).

**Por qué postergada:**
- Sin equipo de curación.
- Sin demanda validada.

---

## 19. Wallet / Account abstraction mejorada 🟡

**Idea:** usuario puede jugar y pagar sin entender que hay wallet (Smart Account, social login, gasless tx).

**Valor potencial:**
- UX drop de fricción enorme (especialmente para usuarios no-cripto).
- Adquisición mainstream.
- Reducción de churn en onboarding.

**Requisitos:**
- Account abstraction provider (Privy, Magic, Web3Auth, etc.) en Celo.
- Sponsored gas o paymaster.
- Migration path para wallets actuales.

**Por qué postergada (pero estratégica):**
- MiniPay ya hace mucho de esto.
- Si pivotamos a multi-platform (web standalone, iOS, Android), AA es clave.

**Próximo paso (post-MiniPay traction):**
- Spec de account abstraction para canal web.

---

## 20. Otras ideas mencionadas pero no priorizadas

- **NFT minting de momentos específicos** (no solo victorias) — ver `docs/product/moment-nft-future-feature-2026-05-30.md`. Requiere madurez de motif detection de Coach.
- **Save Replay como video shareable** (Remotion / HyperFrames pipeline).
- **Voice input / chat con Luz** post-game.
- **Friends list / multiplayer asíncrono entre amigos** (sin tournament).
- **Achievement system** (badges fuera de Founder).
- **Welcome flow con tutorial gamificado** (más allá de cinematica rook).
- **Premium copy variants** (lenguaje formal vs casual, opt-in).
- **Localización profunda** (más allá de EN/ES — pt-BR, fr, etc.).
- **AI opponent que recuerda partidas pasadas con el usuario** (state across sessions).
- **In-game tips / hints durante la partida** (peones-gated).

---

## Reglas operativas del parking lot

1. **Nada sale del parking lot a un cluster activo** sin brainstorm + spec + audit estratégico.
2. **Cada idea debe pasar el filtro del documento de dirección** (`chesscito-monetization-direction-2026-06-01.md`):
   - ¿Está en una de las 4 capas (Free / Luz / PRO / Supporters)?
   - ¿Rompe alguna decisión explícita (D1-D12)?
   - ¿Cumple las copy rules?
3. **Postergar es válido.** No todo tiene que activarse.
4. **Reordenar ranking ocasionalmente.** Cada quarter, revisar prioridades.
5. **Si una idea encuentra una alternativa simple en M1-M3**, registrar el aprendizaje y cerrar la entrada del parking.
6. **Si una idea se desbloquea por contexto externo** (e.g. MiniPay habilita push), promoverla a roadmap.

---

## Referencias

- Dirección: `docs/product/chesscito-monetization-direction-2026-06-01.md`
- Funnel: `docs/product/chesscito-monetization-funnel-map-2026-06-01.md`
- Inventory técnico: `docs/product/chesscito-current-monetization-inventory-2026-06-01.md`
- Copy rules: `docs/product/chesscito-commercial-copy-rules-2026-06-01.md`
- Moment NFT roadmap: `docs/product/moment-nft-future-feature-2026-05-30.md`
- Theme system: memoria `project_theme_system_foundation`
- Audit base: `docs/monetization/2026-06-01-strategic-audit.md`
