/**
 * Single source of truth for Chesscito pitch video text overlays.
 * Spec: docs/superpowers/specs/2026-04-27-pitch-video-script.md
 *
 * ════════════════════════════════════════════════════════════════
 *  v2 — A-Cut premium / startup-game tone (2026-04-27)
 * ════════════════════════════════════════════════════════════════
 *  - A-Cut: NO clinical language. No persistent disclaimer. The
 *    A-Cut speaks about play, pre-chess, attention, patterns,
 *    decisions, MiniPay, progress and achievements.
 *  - B-Cut: keeps Cibeira (verified) + caregiver disclaimer, with
 *    fine-print professional treatment (not alarmist).
 *
 *  LOCKED CONSTRAINTS (apply to B-Cut only):
 *  1. Cibeira (2021) only as "estudio piloto · evidencia preliminar"
 *     framing → on-screen pill uses factual markers (12 weeks · N=22)
 *     to avoid sounding defensive while staying rigorous.
 *  2. Forbidden Cibeira-tied claims: "estado cognitivo global",
 *     "ánimo / depresión", "previene demencia", "retrasa Alzheimer",
 *     "tratamiento", "eficacia clínica", "cura". Verified against
 *     CrossRef + PubMed PMID 34098442 on 2026-04-27.
 *  3. Allowed claims: atención, velocidad de procesamiento,
 *     funciones ejecutivas, calidad de vida.
 *  4. Mandatory limitations caption next to Cibeira phrase: N=22,
 *     no aleatorizado, institucionalizados / semi-institucionalizados.
 *  5. "+100 estudiantes" is methodological / pedagogical origin only.
 *     Never as clinical validation, never as app traction metric.
 *  6. B-Cut MUST render the full caregiver disclaimer once (now as
 *     fine-print professional, not as alarming full-screen scene).
 * ════════════════════════════════════════════════════════════════
 */

const FPS = 30;
const seconds = (s: number): number => Math.round(s * FPS);

/* ─────────────────────────── Brand & Team ────────────────────────── */

export const PITCH_BRAND = {
  name: "Chesscito",
  tagline: "El ajedrez antes del ajedrez.",
  descriptor: "Juegos preajedrecísticos",
  url: "chesscito.vercel.app",
  /**
   * v3.5 — brand consolidation. Den Labs acts as parent backing
   * (no competition with Chesscito), MiniPay + Celo as platform /
   * ecosystem, @AKAwolfcito as public contact handle.
   */
  parent: "Den Labs",
  byline: "Construido por Den Labs",
  poweredBy: "Powered by Celo",
  miniPay: "Próximamente en MiniPay",
  contact: "@AKAwolfcito",
  channels: {
    distribution: "MiniPay",
    chain: "Celo",
  },
} as const;

export const PITCH_TEAM = {
  founders: [
    {
      realName: "Luis Fernando Ushiña",
      handle: "aka Wolfcito",
      role: "Software Developer Architect",
      coFounder: "Co-Founder Chesscito",
      /**
       * Portrait integration (see docs/superpowers/specs/2026-04-28-portrait-canon.md).
       * Drop apps/video/public/portraits/luis-ushina.jpg and flip
       * `hasPortraitAsset` to `true` to swap the placeholder for the
       * approved photo. No layout change required.
       */
      portraitKey: "luis-ushina" as const,
      hasPortraitAsset: true,
      /** v3.3 — short human/professional line for h08 founder cards. */
      tagline: "Construye el producto desde el código y el diseño.",
    },
    {
      realName: "César Litvinov Alarcón",
      handle: null,
      role: "Maestro FIDE · Entrenador",
      coFounder: "Co-Founder Chesscito",
      portraitKey: "cesar-litvinov" as const,
      hasPortraitAsset: true,
      tagline: "Diseña los retos pedagógicos inspirados en ajedrez.",
    },
    {
      realName: "Den Labs",
      handle: null,
      role: "Casa creadora",
      coFounder: null,
      portraitKey: null,
      hasPortraitAsset: false,
      tagline: "Casa creadora detrás del proyecto.",
    },
  ],
  /**
   * Methodological origin metric. Renders as social proof in the
   * coach scene attribution and the team-origin scene subtitle.
   * Per locked constraint #5: pedagogical, NOT clinical, NOT app traction.
   */
  methodologyOrigin: {
    short: "+100 estudiantes acompañados.",
    long: "Una metodología aplicada con +100 estudiantes.",
    framingNote: "Origen pedagógico, no validación clínica ni métrica de uso.",
  },
} as const;

/* ─────────────────────────── Disclaimers ────────────────────────── */

/**
 * Full reinforced disclaimer for B-Cut esc 10. Mandatory near
 * academic block. Now rendered as professional fine-print, not as
 * alarming dedicated scene.
 */
export const DISCLAIMER_CAREGIVER =
  "Chesscito no diagnostica, trata, previene ni cura enfermedades neurodegenerativas, deterioro cognitivo o demencia. Su propósito es educativo y recreativo. Cualquier uso en personas con deterioro cognitivo o necesidades clínicas debe complementarse con la orientación de profesionales de salud." as const;

/* ─────────────────────────── Cibeira Citation ────────────────────────── */

/**
 * Verified 2026-04-27 via CrossRef + PubMed PMID 34098442.
 * Any change to `screenPhrase` must be cross-checked against
 * `validClaims` and `forbiddenClaims` below.
 */
export const CIBEIRA_2021 = {
  fullCitation:
    "Cibeira, N., Lorenzo-López, L., Maseda, A., Blanco-Fandiño, J., López-López, R., & Millán-Calenti, J. C. (2021). Effectiveness of a chess-training program for improving cognition, mood, and quality of life in older adults: A pilot study. Geriatric Nursing, 42(4), 894–900.",
  doi: "10.1016/j.gerinurse.2021.04.026",
  pubmedId: "34098442",
  classification: "Estudio piloto · 12 semanas · N=22",
  screenPhrase:
    "Cibeira et al. (2021), estudio piloto controlado con 22 adultos mayores institucionalizados: 12 semanas de entrenamiento en ajedrez mejoraron atención, velocidad de procesamiento, funciones ejecutivas y calidad de vida.",
  limitationsCaption:
    "Geriatric Nursing 42(4): 894–900. Estudio piloto, no aleatorizado. N=22, adultos mayores institucionalizados/semi-institucionalizados. Resultados no generalizables a población general.",
  validClaims: [
    "atención",
    "velocidad de procesamiento",
    "funciones ejecutivas",
    "calidad de vida",
  ],
  forbiddenClaims: [
    "estado cognitivo global",
    "ánimo",
    "depresión",
    "previene demencia",
    "retrasa Alzheimer",
    "tratamiento",
    "eficacia clínica",
    "cura",
  ],
} as const;

/* ─────────────────────────── Glossary (crypto-light) ────────────────────────── */

export const PITCH_GLOSSARY = {
  NFT: "logro · victoria guardada",
  onchain: "guardado · verificable",
  wallet: "tu cuenta en MiniPay",
  token: "logro digital",
  blockchain: "verificable",
} as const;

/* ─────────────────────────── A-Cut · Premium / startup-game (~55s) ────────────────────────── */

export const PITCH_A_COPY = {
  variantId: "a-cut" as const,
  variantLabel: "A-Cut · Mainstream premium",
  totalDurationSeconds: 55,
  scenes: {
    /** 1 — Hook categórico */
    hook: {
      durationFrames: seconds(4),
      title: "El ajedrez antes del ajedrez.",
      /** v3.2 — cognac italic on the closing fragment */
      highlight: "antes del ajedrez.",
      subtitle: "Retos breves para entrenar atención, patrones y decisiones.",
      badge: "CHESSCITO · JUEGOS PREAJEDRECÍSTICOS",
    },
    /** 2 — Promesa de juego, no de pantalla */
    problem: {
      durationFrames: seconds(6),
      title: "No necesitas más pantalla.\nNecesitas mejor juego.",
      /** v3 — amber accent en la frase final del título */
      highlight: "mejor juego.",
      subtitle: "10 minutos. Un reto. Una pequeña victoria.",
      /** v3 — value cards en timeline vertical sutil */
      valueCards: ["10 minutos", "Un reto", "Una pequeña victoria"] as const,
    },
    /** 3 — Capacidades, sin presión */
    capabilityShow: {
      durationFrames: seconds(7),
      title: "Atención. Patrones. Decisiones.",
      /** v3.2 — cognac italic on the relief promise */
      highlight: "sin la presión del ajedrez.",
      subtitle: "Lo mejor del ajedrez, sin la presión del ajedrez.",
      screenshotKey: "exercise-rook-pattern" as const,
      badge: "MÉTODO REAL",
      valueCards: ["Atención", "Patrones", "Decisiones"] as const,
    },
    /** 4 — Acceso friction-zero */
    solution: {
      durationFrames: seconds(6),
      /**
       * v3 — split en dos líneas para componer text-left + phone-right
       * con énfasis amber en "Empieza gratis."
       */
      title: "Abre MiniPay.\nEmpieza gratis.",
      highlight: "Empieza gratis.",
      subtitle: "Sin descargas. Sin registros complicados.",
      screenshotKey: "play-hub" as const,
      badge: "ACCESO INSTANTÁNEO",
      valueCards: [
        "Sin descargas",
        "Sin registros",
        "Acceso instantáneo",
      ] as const,
      ctaLabel: "Empezar gratis",
    },
    /** 5 — Coach: statement categórico + atribución (no quote VO) */
    coachVo: {
      durationFrames: seconds(7),
      statement: "Antes de competir, hay que aprender a pensar jugando.",
      /** v3.2 — cognac italic on the pedagogical core */
      highlight: "pensar jugando.",
      attribution:
        "César Litvinov · Maestro FIDE · +100 estudiantes acompañados.",
      /** v3.2 — split for the SignatureBlock (primary uppercase + detail) */
      signaturePrimary: "César Litvinov · Maestro FIDE",
      signatureDetail: "+100 estudiantes acompañados",
    },
    /** 6 — Progresión Arena */
    arena: {
      durationFrames: seconds(6),
      title: "Cuando estés listo,\nsube el reto.",
      /** v3.2 — cognac italic on the action verb-phrase */
      highlight: "sube el reto.",
      subtitle: "Practica, juega contra IA y mejora a tu ritmo.",
      screenshotKey: "arena" as const,
      badge: "ARENA",
      valueCards: ["IA", "Ritmo propio", "Práctica"] as const,
    },
    /** 7 — Celebración (reemplaza el frame anterior de Sovereignty) */
    sovereignty: {
      durationFrames: seconds(5),
      title: "Celebra tu progreso.",
      /** v3.2 — cognac italic on the personal stake */
      highlight: "tu progreso.",
      subtitle: "Gana retos, desbloquea logros y guarda tus victorias.",
      screenshotKey: "victory-state" as const,
      valueCards: ["Logros", "Victorias", "Rachas"] as const,
    },
    /**
     * 8 — Origen + presentación real del equipo (v3.3).
     *
     * Centered hierarchy: title → brief team intro → 2 founder cards
     * (Luis, César) → "100+" closing impact metric. Replaces the
     * earlier asymmetric layout where "100+" sat on the left rail.
     *
     * The "100+" reframes from "+100 estudiantes" (career-side, hard
     * to validate as a public claim) to product-side "100+ retos
     * diseñados para práctica mental activa" — safer copy that
     * communicates impact without medical claims.
     */
    teamMini: {
      durationFrames: seconds(5),
      title: "Nacido en el aula.\nConvertido en juego.",
      /** v3.2 — cognac italic on the transformation */
      highlight: "Convertido en juego.",
      /** v3.3 — short narrative that introduces the founders below */
      subtitle: "Las personas detrás de Chesscito.",
      foundingNumber: "100+",
      /**
       * v3.3 — product-side framing. NOT "+100 estudiantes". This is
       * a copy-safe impact line that does not imply clinical efficacy
       * or app-traction metrics.
       */
      foundingNumberCaption:
        "Retos diseñados para práctica mental activa.",
      /**
       * Legacy field — no longer rendered after v3.3 layout shift.
       * Kept for back-compat with any external consumer; can be
       * removed once we confirm no other surface reads it.
       */
      signatureLine:
        "César Litvinov Alarcón · Luis Fernando Ushiña · Den Labs",
    },
    /** 9 — Invitación final */
    cta: {
      durationFrames: seconds(5),
      title: "Juega tu primer reto hoy.",
      /** v3.2 — cognac italic on the action verb */
      highlight: "tu primer reto",
      subtitleInMiniPay: "Tócalo en Discover · MiniPay",
      subtitleSocial: "Próximamente en MiniPay · chesscito.vercel.app",
      url: PITCH_BRAND.url,
      /** v3.2 — decorative luxury CTA */
      ctaLabel: "Jugar ahora",
    },
  },
} as const;

/* ─────────────────────────── B-Cut · Caregivers (~75s) ────────────────────────── */

export const PITCH_B_COPY = {
  variantId: "b-cut-caregiver" as const,
  variantLabel: "B-Cut · Cuidadores y centros de día",
  totalDurationSeconds: 75,
  scenes: {
    hook: {
      durationFrames: seconds(5),
      title: "Ajedrez simple para mantener la mente activa.",
      subtitle:
        "Pequeñas rutinas que pueden acompañarse en casa, en familia o en centros de día.",
    },
    problem: {
      durationFrames: seconds(7),
      title: "El reto no es aprender ajedrez competitivo.",
      subtitle: "Es tener una actividad clara, repetible y motivante.",
    },
    capabilityShow: PITCH_A_COPY.scenes.capabilityShow,
    /** B-Cut exclusive. Locked phrase from CIBEIRA_2021.screenPhrase. */
    academicBlock: {
      durationFrames: seconds(10),
      classification: CIBEIRA_2021.classification,
      title: CIBEIRA_2021.screenPhrase,
      caption: CIBEIRA_2021.limitationsCaption,
    },
    solution: {
      durationFrames: seconds(7),
      title:
        "Chesscito convierte el ajedrez en pequeñas rutinas que pueden acompañarse en casa, en familia o en centros de día.",
      subtitle: `Sin descargas — abre ${PITCH_BRAND.channels.distribution} y juega. Gratis.`,
      screenshotKey: "play-hub" as const,
    },
    coachVo: PITCH_A_COPY.scenes.coachVo,
    arena: PITCH_A_COPY.scenes.arena,
    sovereignty: PITCH_A_COPY.scenes.sovereignty,
    teamMini: PITCH_A_COPY.scenes.teamMini,
    /**
     * Reduced from 8s → 5s (per v2 review). Renders as fine-print
     * professional, not as alarming dedicated full-screen scene.
     */
    disclaimer: {
      durationFrames: seconds(5),
      label: "Nota profesional",
      body: DISCLAIMER_CAREGIVER,
    },
    cta: {
      durationFrames: seconds(6),
      title: "Compártelo con quien cuidas.",
      subtitle: `${PITCH_BRAND.url} · jugar es gratis en ${PITCH_BRAND.channels.distribution}`,
    },
  },
} as const;

/* ─────────────────────────── Type Exports ────────────────────────── */

export type PitchACopy = typeof PITCH_A_COPY;
export type PitchBCopy = typeof PITCH_B_COPY;
export type CibeiraCitation = typeof CIBEIRA_2021;
export type ScreenshotKey =
  | "play-hub"
  | "exercise-rook-pattern"
  | "arena"
  | "victory-state";

/* ──────────────────────────── i18n (v3.9) ──────────────────────────── */

export type PitchLocale = "es" | "en";

/** Brand fields that NEVER change between languages. */
export const PITCH_BRAND_STATIC = {
  name: PITCH_BRAND.name,
  url: PITCH_BRAND.url,
  parent: PITCH_BRAND.parent,
  contact: PITCH_BRAND.contact,
  channels: PITCH_BRAND.channels,
} as const;

/** Brand fields that DO translate. */
export const PITCH_BRAND_LOCALES = {
  es: {
    tagline: "El ajedrez antes del ajedrez.",
    descriptor: "Juegos preajedrecísticos",
    byline: "Construido por Den Labs",
    poweredBy: "Powered by Celo",
    miniPay: "Próximamente en MiniPay",
  },
  en: {
    tagline: "The chess before chess.",
    descriptor: "Pre-chess games",
    byline: "Built by Den Labs",
    poweredBy: "Powered by Celo",
    miniPay: "Coming soon to MiniPay",
  },
} as const satisfies Record<PitchLocale, Record<string, string>>;

/** Localized founder array. Names stay; role + tagline switch. */
const PITCH_TEAM_EN = {
  founders: [
    {
      realName: "Luis Fernando Ushiña",
      handle: "aka Wolfcito",
      role: "Software Developer Architect",
      coFounder: "Co-Founder Chesscito",
      portraitKey: "luis-ushina" as const,
      hasPortraitAsset: true,
      tagline: "Builds the product through code and design.",
    },
    {
      realName: "César Litvinov Alarcón",
      handle: null,
      role: "FIDE Master · Coach",
      coFounder: "Co-Founder Chesscito",
      portraitKey: "cesar-litvinov" as const,
      hasPortraitAsset: true,
      tagline: "Designs the chess-inspired pedagogical challenges.",
    },
    {
      realName: "Den Labs",
      handle: null,
      role: "Creative studio",
      coFounder: null,
      portraitKey: null,
      hasPortraitAsset: false,
      tagline: "Creative studio behind the project.",
    },
  ],
  methodologyOrigin: {
    short: "+100 students mentored.",
    long: "Methodology applied with +100 students.",
    framingNote: "Pedagogical origin, not clinical validation nor app traction metric.",
  },
} as const;

export const PITCH_TEAM_LOCALES = {
  es: PITCH_TEAM,
  en: PITCH_TEAM_EN,
} as const satisfies Record<PitchLocale, unknown>;

/** Localized A-Cut copy. Identical structure, translated strings. */
const PITCH_A_COPY_EN = {
  variantId: "a-cut" as const,
  variantLabel: "A-Cut · Mainstream premium",
  totalDurationSeconds: 55,
  scenes: {
    hook: {
      durationFrames: seconds(4),
      title: "The chess before chess.",
      highlight: "before chess.",
      subtitle: "Short challenges to train attention, patterns and decisions.",
      badge: "CHESSCITO · PRE-CHESS GAMES",
    },
    problem: {
      durationFrames: seconds(6),
      title: "You don't need more screen.\nYou need better play.",
      highlight: "better play.",
      subtitle: "10 minutes. One challenge. A small victory.",
      valueCards: ["10 minutes", "One challenge", "A small victory"] as const,
    },
    capabilityShow: {
      durationFrames: seconds(7),
      title: "Attention. Patterns. Decisions.",
      highlight: "without the pressure of chess.",
      subtitle: "The best of chess, without the pressure of chess.",
      screenshotKey: "exercise-rook-pattern" as const,
      badge: "REAL METHOD",
      valueCards: ["Attention", "Patterns", "Decisions"] as const,
    },
    solution: {
      durationFrames: seconds(6),
      title: "Open MiniPay.\nStart free.",
      highlight: "Start free.",
      subtitle: "No downloads. No complicated signups.",
      screenshotKey: "play-hub" as const,
      badge: "INSTANT ACCESS",
      valueCards: ["No downloads", "No signups", "Instant access"] as const,
      ctaLabel: "Start free",
    },
    coachVo: {
      durationFrames: seconds(7),
      statement: "Before competing, you must learn to think while playing.",
      highlight: "think while playing.",
      attribution: "César Litvinov · FIDE Master · +100 students mentored.",
      signaturePrimary: "César Litvinov · FIDE Master",
      signatureDetail: "+100 students mentored",
    },
    arena: {
      durationFrames: seconds(6),
      title: "When you're ready,\nraise the challenge.",
      highlight: "raise the challenge.",
      subtitle: "Practice, play against AI and improve at your own pace.",
      screenshotKey: "arena" as const,
      badge: "ARENA",
      valueCards: ["AI", "Own pace", "Practice"] as const,
    },
    sovereignty: {
      durationFrames: seconds(5),
      title: "Celebrate your progress.",
      highlight: "your progress.",
      subtitle: "Win challenges, unlock achievements and save your victories.",
      screenshotKey: "victory-state" as const,
      valueCards: ["Achievements", "Victories", "Streaks"] as const,
    },
    teamMini: {
      durationFrames: seconds(5),
      title: "Born in the classroom.\nTurned into a game.",
      highlight: "Turned into a game.",
      subtitle: "The people behind Chesscito.",
      foundingNumber: "100+",
      foundingNumberCaption: "Challenges designed for active mental practice.",
      signatureLine:
        "César Litvinov Alarcón · Luis Fernando Ushiña · Den Labs",
    },
    cta: {
      durationFrames: seconds(5),
      title: "Play your first challenge today.",
      highlight: "your first challenge",
      subtitleInMiniPay: "Tap it in Discover · MiniPay",
      subtitleSocial: "Coming soon to MiniPay · chesscito.vercel.app",
      url: PITCH_BRAND.url,
      ctaLabel: "Play now",
    },
  },
} as const;

export const PITCH_A_COPY_LOCALES = {
  es: PITCH_A_COPY,
  en: PITCH_A_COPY_EN,
} as const satisfies Record<PitchLocale, unknown>;

/**
 * B-Cut copy is NOT translated yet. The Cibeira (2021) academic
 * citation is bound to its original Spanish publication, so the
 * B-Cut stays Spanish-only regardless of `locale`. Both keys
 * resolve to the same content for API uniformity.
 */
export const PITCH_B_COPY_LOCALES = {
  es: PITCH_B_COPY,
  en: PITCH_B_COPY,
} as const satisfies Record<PitchLocale, unknown>;
