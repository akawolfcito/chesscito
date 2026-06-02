# Chesscito — Reglas de Copy Comercial (M1)

**Fecha:** 2026-06-01
**Autor:** Clausita (dirigido por Wolfcito)
**Propósito:** Reglas duras de copy para todas las superficies comerciales: palabras permitidas, palabras prohibidas, frases recomendadas, frases prohibidas, y reglas específicas para hablar de Luz, PRO, Peones, Victory Cards y Prize Pool.
**Fuente:** auditoría estratégica 2026-06-01 + memorias `feedback_promise_first_copy`, `feedback_anti_ai_prose`, `project_anti_ai_prose_ceiling`.
**Idioma de UI:** English (ver `lib/content/editorial.ts`). Las traducciones a otros locales siguen las mismas reglas.

---

## Filosofía base

> El copy de Chesscito **promete lo que entrega**, **nombra cuando duele**, **celebra cuando gana**, y **nunca vende humo**.

Todo copy se filtra contra estas reglas antes de mergear. Si rompe una regla, se reescribe. No se publica copy que pase pruebas de QA pero falle el filtro ético / comercial.

---

## 1. Palabras permitidas (vocabulario de marca)

| Palabra / Frase | Contexto |
|---|---|
| **Luz** | Nombre del Coach. Femenino. Personaje, no producto. |
| **Coach** | Sinónimo neutro de Luz en contextos donde el nombre no aplica. |
| **PRO** | Pase mensual. Siempre en mayúsculas, sin "membership" o "subscription". |
| **Pase de entrenamiento** | Forma extendida de PRO. |
| **Peones** | Unidad blanda de microayudas (cuando se introduzca el cambio de lenguaje). |
| **Análisis** | Lo que Luz entrega. Neutro y verificable. |
| **Práctica** / **Entrenamiento** | Lo que el usuario hace con Chesscito. |
| **Victoria** / **Save Victory** | Acción de guardar partida ganada como certificado. |
| **Certificado** / **Coleccionable** | Frame para Victory Cards (sin connotación de inversión). |
| **Treasury** / **Fondo del juego** | Reemplazo honesto de "prize pool" hasta tener distribución. |
| **Movimiento** / **Pieza** / **Casilla** | Vocabulario del juego, siempre prioritario sobre jerga genérica. |
| **Aprender** / **Mejorar** / **Progresar** | Verbos centrales del producto. |
| **Volver a intentarlo** / **Reintentar** | Lenguaje post-fricción. |
| **Compañera** / **Compañero** | Frame de Luz (no "asistente", no "bot", no "IA"). |

---

## 2. Palabras a evitar

| Palabra / Frase | Razón |
|---|---|
| **IA** / **AI** | Hype tech. Decir "Luz" o "Coach" en superficies de usuario. Permitido en docs técnicas. |
| **GPT** / **OpenAI** / **LLM** / **modelo** | Implementación. No mencionar en superficies de usuario. |
| **Suscripción** | Genérico, frío. Usar "pase". |
| **Membership** | Connotación de club exclusivo, no aplica. |
| **NFT** | Web3 jargon. Usar "certificado" o "coleccionable". |
| **Mint** | Reemplazar por "Save" o "Guardar" en superficies de usuario (mantener en logs/dev). |
| **Web3** / **Blockchain** / **Chain** | Plomería. Usar el mismo Stablecoin como "Celo dollars" si necesario. |
| **Token** (excepto referido al stablecoin de pago) | Confusión con criptos / DeFi. |
| **Mining** / **Yield** / **Staking** / **Farming** | DeFi jargon, no aplica al producto. |
| **Inversión** / **Activo** / **Revaloriza** | NUNCA en Victory Cards o Founder Badge. |
| **Premium AI** / **AI ilimitada** / **Mejor IA del mundo** | Hype. PRO se vende como pase de entrenamiento. |
| **Cerebro** / **Memoria** / **Cognición** / **Alzheimer** / **Demencia** | Claims médicos prohibidos sin evidencia clínica. |
| **Ganar dinero** / **Earn** / **P2E** | No somos play-to-earn. |
| **Prize pool activo** (si no se distribuye) | Promesa rota. |
| **Última oportunidad** / **Solo hoy** (sin razón real) | Manipulación de urgencia falsa. |
| **Edición limitada** (sin scarcity real on-chain) | Mentira. |
| **Renew now** / **Don't lose access** (con tono ansioso) | Dark pattern. |
| **Premium** (genérico) | Vacío. Usar "PRO". |
| **Free trial** (sugiere cargo futuro) | El free de Chesscito no es trial; es nivel base permanente. |

---

## 3. Frases recomendadas (canónicas)

### Sobre Luz / Coach
- "Vamos a ver qué pasó." (post-loss)
- "Aprende del que ya jugaste." (Hub teaser)
- "Tu compañera de práctica."
- "Luz te muestra dónde mejoraste."
- "Revisa tu última partida con Luz."
- "Te quedan X análisis." (informativo, no presionante)

### Sobre PRO
- "Entrena con Luz todos los días."
- "Tu pase mensual de entrenamiento."
- "Luz ilimitada por 30 días."
- "Tu coach personal de ajedrez, 6 centavos al día." (alternativa quantitativa)
- "Renueva tu entrenamiento." (renewal CTA)

### Sobre Peones (cuando se introduzca)
- "X peones disponibles."
- "Cada análisis usa 1 peón."
- "Consigue más peones." (Shop CTA)

### Sobre Victory Cards
- "Guarda tu victoria."
- "Certificado permanente de tu partida."
- "Tu victoria, para siempre."
- "Comparte tu certificado."

### Sobre Free / acceso libre
- "Practica gratis, todos los días."
- "Sin paywall escondido."
- "Empieza ahora."

### Sobre fricción / pérdida
- "Te damos un escudo. Vuelve a intentarlo." (mercy shield)
- "Cada partida enseña algo." (post-loss generic)
- "Reintentar." (acción)

### Sobre el flow de pago
- "Confirma en tu wallet."
- "Recibo en Celoscan." (no "view on Celoscan" como noun)
- "Compra confirmada."

---

## 4. Frases prohibidas

- "Mejora tu memoria / previene la demencia / ejercita tu cerebro."
- "Gana dinero jugando ajedrez."
- "Tu NFT podría subir de precio."
- "Tu NFT es coleccionable raro / limitado / único."
- "Sé el primero en mintear / asegura tu spot."
- "Prize pool de $X esta semana." (mientras no se distribuya)
- "Powered by GPT-4 / OpenAI." (superficies usuario)
- "AI ilimitada / Premium AI / La mejor IA del mundo."
- "Estás a punto de perder acceso." (en tono ansioso)
- "Solo por hoy / última oportunidad." (sin razón verificable)
- "Auto-renovación / cargo automático cada mes." (PRO es manual)
- "Cancela en cualquier momento." (PRO no se "cancela", expira y no se renueva manualmente)
- "Compra antes de que suba el precio."
- "Mining / yield / staking / farming." (cualquier DeFi jargon)
- "El ranking #1 mundial." (no existe ranking mundial)
- Cualquier afirmación cuantitativa de mejora ("subirás 200 ELO", "mejora 30% en X partidas") sin estudio que la respalde.

---

## 5. Reglas para hablar de Luz

1. **Luz es un personaje, no un producto.** Tiene nombre propio, género femenino, y voz consistente. Nunca decir "la IA" o "el bot".
2. **Luz acompaña, no juzga.** Tono cálido, directo, sin condescendencia ("entiendo cómo te sentís" sí; "estuviste muy mal" no).
3. **Luz nombra el error, no al usuario.** "Esta jugada perdió la torre" sí; "fuiste descuidado" no.
4. **Luz aparece después de la fricción**, no antes. Post-loss, post-resign, journal sin analizar.
5. **Luz no se vende como "AI".** En todo copy de usuario, decir "Coach" o "Luz". La implementación técnica (gpt-4o-mini) NO se menciona.
6. **Luz no promete resultados cuantificados.** "Vas a mejorar" sí; "vas a subir 200 puntos" no.
7. **Luz no es ilimitada en free.** Pero el lenguaje no la castiga: "Te quedan X análisis" en lugar de "Ya no podés analizar".
8. **Luz no se interrumpe.** Una vez empieza el análisis, no aparecen modales de upsell encima.
9. **Luz no contradice el contenido.** Si el análisis dice "perdiste por X", no se le agrega un cross-sell que diga "deberías comprar más análisis para mejorar". El upsell es contextual, no encima del contenido.

---

## 6. Reglas para hablar de PRO

1. **PRO es un pase, no una suscripción.** "Pase mensual de entrenamiento" / "30 días con Luz" / "Tu pase PRO".
2. **PRO se renueva manualmente.** Nunca prometer ni implementar auto-renew sin consentimiento explícito on-chain.
3. **PRO comunica valor concreto**, no abstracto. "Luz ilimitada + Training Journal + identidad PRO" en lugar de "Access to all features".
4. **PRO no se vende como "AI ilimitada".** Se vende como "Entrena con Luz todos los días".
5. **PRO se ofrece como alternativa**, no como puerta única. En Coach paywall, los packs ($0.05 / $0.10) son la entrada baja; PRO es la alternativa de alto valor.
6. **PRO no se push-ea en celebración** (Save Victory success, Share modal).
7. **PRO no se push-ea durante partida activa.**
8. **PRO renewal aparece cuando quedan < 7 días**, una vez por sesión, sin tono ansioso.
9. **PRO expirado no borra historial.** El usuario mantiene acceso a análisis previos y al journal, solo pierde nuevos análisis ilimitados.
10. **Precio se muestra siempre completo**: "$1.99 USD / 30 días" o "6 centavos al día" — nunca solo "1.99" sin contexto.

---

## 7. Reglas para hablar de Peones (cuando aplique)

1. **Peones son unidad blanda**, no token, no moneda, no activo. Lenguaje cálido y de juego.
2. **Peones se "gastan" o "usan"**, no se "queman" ni se "spendean".
3. **Peones no se prometen como intercambiables** con dinero real ni con otras monedas in-game.
4. **Cada peón tiene destino claro**: análisis Coach, shield, retry, save. Nunca "peones para comprar más peones".
5. **El conteo se muestra siempre**: "Tienes 3 peones" / "Te quedan 0 peones".
6. **0 peones no es castigo**: el copy informa, no presiona. "Consigue más peones cuando quieras" en lugar de "Ya no podés jugar".
7. **Peones no son ERC-20.** No se prometen como token transferible, intercambiable o tradeable.
8. **Cambio de lenguaje opcional en M1.** Si el A/B test muestra confusión, se mantiene "credits" / "Coach credits" hasta tener clarity validada.

---

## 8. Reglas para hablar de Victory Cards

1. **Victory Cards son certificados**, no NFTs especulativos. Frame: "tu victoria, guardada para siempre".
2. **No mencionar revaloración.** Nunca "podría subir de precio", "edición limitada que se valoriza", "asset que mejora".
3. **No mencionar mercado secundario.** Si hay reventa técnica posible vía OpenSea / explorer, NO se promueve.
4. **El precio se justifica como costo simbólico**: "$0.005–$0.02 por guardar tu partida en Celo". Sin promesas de utilidad económica.
5. **Save Victory es secondary CTA** en endgame win, no primary push.
6. **Save Victory no aparece** en loss, resign o draw.
7. **El asset visual** se muestra para confirmar la partida, no para vender futuro.
8. **No usar palabra "mint"** en superficies de usuario. Usar "Save", "Guardar", "Certificar".
9. **No prometer ranking, ranking dinámico, scarcity, o linked rewards.** Es un certificado, punto.
10. **Share modal** muestra el certificado, no lo vende.

---

## 9. Reglas para hablar de Prize Pool

1. **NO mencionar "prize pool" como promesa activa** mientras no haya distribución implementada.
2. **NO mostrar balance del pool** en superficies de usuario hasta tener payout.
3. **Renombrar a "Treasury" o "Fondo del juego"** si la transparencia exige mostrarlo, con explicación honesta: "Cubre costos operativos y futuras iniciativas comunitarias."
4. **NO usar countdown** a distribución hasta que el código de payout exista, esté auditado, y la fecha sea real.
5. **NO usar el balance del pool como gancho de adquisición** ("Únete al pool de $X").
6. **NO vincular Victory Cards a "premios" del pool** mientras no se distribuya.
7. **Si se distribuye en el futuro**, el copy lo anuncia con: (a) fecha confirmada, (b) reglas verificables, (c) método de payout publicado en docs, (d) post-mortem público después.
8. **NO usar lenguaje de lotería / sorteo / casino** ("tu chance de ganar", "ticket al pool").

---

## 10. Reglas para evitar claims médicos o especulativos

### Claims médicos / cognitivos (PROHIBIDOS sin evidencia clínica)
- "Mejora tu memoria."
- "Previene el Alzheimer."
- "Reduce el riesgo de demencia."
- "Ejercita tu cerebro."
- "Mejora tu capacidad cognitiva."
- "Aumenta tu inteligencia."
- "Estimula tu agilidad mental."
- "Combate el deterioro cognitivo."

**Reemplazo permitido** (sin claim médico):
- "Practica ajedrez."
- "Entrena tu paciencia."
- "Aprende a planear."
- "Disfruta el juego."
- "Forma el hábito."

### Claims financieros / especulativos (PROHIBIDOS)
- "Tu NFT subirá de precio."
- "Inversión en blockchain."
- "Asset que se revaloriza."
- "Próxima edición vale más."
- "Sé early, captura valor."
- "Whitelist exclusiva."
- "Token con upside."

**Reemplazo permitido:**
- "Certificado permanente."
- "Tu victoria, guardada."
- "Coleccionable simbólico."
- "Recuerdo de la partida."

### Claims de scarcity (solo si son verificables on-chain)
- ❌ "Edición limitada" (sin max supply en contrato).
- ❌ "Solo X disponibles" (sin verificable).
- ❌ "Compra antes de que se agoten" (sin scarcity real).
- ✅ "Cada Founder Badge emite un evento único" (si es verdad y es lo que entrega).

### Claims de comunidad / ranking (solo si existen)
- ❌ "Top 100 jugadores del mundo" (no existe).
- ❌ "Ranking global verificado" (no existe).
- ✅ "Leaderboard semanal" (si la feature existe y es verificable).

---

## 11. Reglas anti-AI prose (memoria activa)

**Hard rules** (enforced by `project_anti_ai_prose_ceiling` CI gate):

1. **Sin em-dash (—)** ni en-dash (–) en copy de usuario. Usar comas, puntos, o reestructurar.
2. **Sin "deep dive", "unleash", "leverage", "robust", "seamless"** y demás vocabulario AI-flavored.
3. **Sin listas de tres adjetivos** ("powerful, intuitive, beautiful").
4. **Sin "Welcome to X! Let's explore..."** ni intros generadas.
5. **Sin sobre-explicación.** Si la pantalla muestra el board, no decir "Aquí ves un tablero de ajedrez".

**Estilo objetivo:**
- Directo. Frases cortas.
- Vocabulario del juego (movimiento, pieza, casilla, jugada, victoria).
- Cero metáforas tech ("desbloquea poderes", "supera niveles" — usar "aprende", "practica").
- Tono cálido pero no cursi.

---

## 12. Reglas de promise-first (memoria activa)

**Hard rule** (memoria `feedback_promise_first_copy`):

> **Entry surfaces lead with REWARD in ≤5 words + plain language.**

Ejemplos:

| ❌ Antes (feature-first) | ✅ Después (reward-first) |
|---|---|
| "Mint your Victory NFT on Celo" | "Guarda tu victoria, para siempre" |
| "Subscribe to PRO membership" | "Entrena con Luz todos los días" |
| "Unlock AI-powered chess analysis" | "Aprende del que ya jugaste" |
| "Buy Coach credits from $0.05" | "Revisa tu partida desde $0.05" |

Evitar **siempre**: NFT, mint, subscription, web3, chain, AI, premium, unlock, blockchain.

---

## 13. Casing y formato

**Casing rule** (`docs/design-patterns/cta-casing-rule.md`):
- Botones primarios: Sentence case ("Save Victory", "Renew now").
- Headings de modales: Sentence case ("Comprar más análisis").
- Pricing: siempre con moneda visible ("$1.99 USD", no "1.99").
- Duraciones: explícitas ("30 días", "una hora", no "1mo").

**Símbolos prohibidos en UI:**
- `—` em-dash y `–` en-dash (bloqueados por CI).
- `™` `®` `©` salvo legal footer.
- `→` solo en estados específicos (no en headings genéricos).

---

## 14. Process / enforcement

### Antes de mergear copy
1. Pasar por `editorial.ts` (single source of truth).
2. Verificar contra esta lista de reglas.
3. Si toca PRO / Coach / Victory / Prize Pool: triple-check con sección correspondiente.
4. CI ejecuta `anti-ai-prose` regression test (em/en-dash gate).
5. Visual regression (`pnpm test:e2e:visual`) si toca surface visible.

### En revisión
- Si pasa los checks pero rompe el "espíritu" del documento (ej: copy técnicamente válido pero suena a hype), se devuelve a reescritura.
- Si introduce nueva copy en SKUs (Welcome Pack, Sponsor a player, etc.), se documenta en `editorial.ts` con comment apuntando a esta guía.

### Cambios al documento
- Solo el equipo de producto + Wolfcito autoriza relajar reglas.
- Toda relajación se documenta con fecha + razón.
- Las reglas anti-AI prose y los claims médicos / especulativos NO se relajan sin escalation.

---

## 15. Referencias

- Dirección: `docs/product/chesscito-monetization-direction-2026-06-01.md`
- Funnel: `docs/product/chesscito-monetization-funnel-map-2026-06-01.md`
- Inventory técnico: `docs/product/chesscito-current-monetization-inventory-2026-06-01.md`
- Parking lot: `docs/product/chesscito-monetization-parking-lot-2026-06-01.md`
- Editorial: `apps/web/src/lib/content/editorial.ts`
- Casing rule: `docs/design-patterns/cta-casing-rule.md`
- Anti-AI ceiling: `project_anti_ai_prose_ceiling` (CI gate)
- Promise-first: memoria `feedback_promise_first_copy`
- Anti-AI prose: memoria `feedback_anti_ai_prose`
