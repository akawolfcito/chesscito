/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  messages/es.ts — Spanish overrides for next-intl                 ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  • Spread `...en` at the top is the EN fallback. NEVER remove it. ║
 * ║    Without it, missing ES keys return raw fallback paths instead  ║
 * ║    of degrading gracefully to English.                            ║
 * ║  • Override by full namespace, not single keys, to keep each      ║
 * ║    namespace coherent for the reviewer.                           ║
 * ║  • Translate by INTENT, not literally — preserve visual length    ║
 * ║    where it matters (buttons, chips). See brief §4.               ║
 * ║  • There is NO automatic sync from editorial.ts. When the EN      ║
 * ║    source changes, manually update the matching override here.    ║
 * ║                                                                   ║
 * ║  Brief:        docs/content/chesscito-language-brief.md           ║
 * ║  Architecture: apps/web/src/lib/content/README.md                 ║
 * ║  Audit:        pnpm content:audit                                 ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * ES message bundle for next-intl.
 *
 * Stage 4 (in flight): namespaces below are translated into Spanish.
 * Anything NOT listed falls back to the EN bundle via the spread —
 * surface-by-surface migration means the legal pages are localized
 * first; arena/coach/hub/etc. still render EN until their Stage C
 * commits land + corresponding ES overrides are added here.
 *
 * `/es/*` is gated behind NEXT_PUBLIC_I18N_ES_READY=1 (middleware)
 * so visitors do not see Spanglish during the migration.
 */
import enBundle from "./en";

// The EN bundle resolves through `import * as editorial` → its keys
// are typed `unknown`. Cast to a permissive record so this file can
// spread sub-objects (e.g. preserve env-derived href fields) without
// fighting the type system. Stage 6 will tighten the bundle shape.
//
// The `@typescript-eslint/no-explicit-any` rule is not configured in
// this project's ESLint setup, so `any` here does not trigger a lint
// error. A prior eslint-disable directive referencing that rule broke
// the production build (unknown-rule error) — leave the cast bare.
const en = enBundle as any;

const messages = {
  ...en,
  LEGAL_SHELL_COPY: {
    back: "Atrás",
    aboutTitle: "Acerca",
    lastUpdatedLabel: "Última actualización",
  },
  ABOUT_COPY: {
    title: "Chesscito",
    operatedBy: "Operado por Wolfcito",
    handle: "@akawolfcito",
    version: "v0.1.0",
    operatorDisclaimer:
      "Chesscito es un producto independiente construido y operado por Wolfcito. No es operado por, ni está afiliado o respaldado por Opera o MiniPay. MiniPay se menciona únicamente como wallet y canal de distribución.",
    links: {
      why: "Por qué Chesscito",
      support: "Soporte",
      privacy: "Política de Privacidad",
      terms: "Términos del Servicio",
      invite: "Invita a un amigo",
    },
    clipboardFeedback: "¡Copiado!",
    shareTitle: "Chesscito",
    shareText:
      "Aprende los movimientos de las piezas de ajedrez con retos gamificados y verificables en Celo.",
    shareUrl: "https://chesscito.com",
  },
  ABOUT_METHODOLOGY_COPY: {
    sectionTitle: "Metodología",
    body:
      "El plan de estudios de Chesscito está diseñado por un equipo humano real. Pedagogía a cargo del Maestro FIDE César Litvinov Alarcón — más de 100 estudiantes acompañados, con egresados que han competido en torneos nacionales e internacionales.",
    cesar: "César Litvinov Alarcón · Maestro FIDE",
    wolfcito: "Wolfcito · Co-fundador",
  },
  COGNITIVE_DISCLAIMER_COPY: {
    short:
      "Chesscito es un compañero cognitivo lúdico. No reemplaza diagnósticos ni tratamientos médicos.",
    full:
      "Chesscito es una experiencia lúdica de compañía cognitiva. No reemplaza diagnósticos, tratamientos médicos ni terapia profesional.",
  },
  SUPPORT_COPY: {
    title: "Soporte",
    primaryChannel: {
      ...en.SUPPORT_COPY.primaryChannel,
      label: "Correo",
      unavailable: "Contacto no disponible",
    },
    secondaryChannel: {
      ...en.SUPPORT_COPY.secondaryChannel,
      label: "GitHub Issues",
      value: "Reporta un bug o solicita una función",
    },
    tertiaryChannel: {
      ...en.SUPPORT_COPY.tertiaryChannel,
      label: "Telegram",
      value: "@chesscito_app",
    },
    howToReport:
      "Describe el problema, incluye capturas de pantalla si es posible, y menciona tu dispositivo y navegador.",
    reportableIssues: [
      "Problemas de carga",
      "Errores de transacción",
      "Bugs de interfaz",
      "Preguntas sobre la mecánica",
      "Solicitudes de funciones",
    ],
    responseTime: "Buscamos responder dentro de las 48 horas.",
    sections: {
      contactUs: "Contáctanos",
      community: "Comunidad",
      technicalIssues: "Problemas técnicos",
      howToReport: "Cómo reportar un problema",
    },
  },
  PRIVACY_COACH_COPY: {
    heading: "Historial del Coach (Chesscito PRO)",
    para1:
      "Los suscriptores PRO activos guardan sus análisis de partida para recibir coaching personalizado entre sesiones. Conservamos los análisis durante 365 días desde su creación; después se eliminan automáticamente. Los análisis de usuarios del nivel gratuito viven solo en nuestra caché de 30 días y nunca se persisten a largo plazo.",
    para2Title: "Tu control:",
    para2:
      "Puedes eliminar todo el historial almacenado del Coach en cualquier momento desde tu wallet en la página de historial del Coach, sin importar el estado PRO. La eliminación es permanente e inmediata.",
    para3Title: "Qué se almacena:",
    para3:
      "Dirección del wallet (en minúsculas), ID de la partida, marcas de tiempo, metadatos de la partida (dificultad, resultado, número total de movimientos) y la respuesta generada por la IA (resumen, errores identificados, lecciones, elogios). NO almacenamos tu lista completa de movimientos. Ningún identificador personal más allá de la dirección del wallet.",
    para4Title: "Pérdida de acceso al wallet:",
    para4:
      "La eliminación requiere control del wallet que es dueño de los análisis. Si pierdes el acceso, contacta a support@chesscito.com para una solicitud de eliminación fuera de banda. Pediremos prueba de la propiedad original.",
  },
  LEGAL_COPY: {
    terms: {
      title: "Términos del Servicio",
      lastUpdated: "15 de marzo de 2026",
      sections: [
        {
          heading: "Operador independiente",
          body: "Chesscito es un producto independiente construido y operado por Wolfcito (@akawolfcito). No es operado por, ni está afiliado o respaldado por Opera o MiniPay. Las referencias a MiniPay a lo largo del servicio lo identifican únicamente como wallet y canal de distribución.",
        },
        {
          heading: "Descripción del servicio",
          body: "Chesscito es una experiencia educativa de pre-ajedrez en la blockchain de Celo, accesible vía MiniPay. El servicio ofrece retos interactivos de movimientos de piezas de ajedrez con coleccionables on-chain.",
        },
        {
          heading: "Elegibilidad",
          body: "Necesitas una wallet compatible (como MiniPay) para usar Chesscito. La elegibilidad por edad la determina tu jurisdicción aplicable.",
        },
        {
          heading: "Responsabilidad del wallet",
          body: "Eres el único responsable de la seguridad de tu wallet, llaves privadas y frases semilla. Chesscito nunca solicita, almacena ni tiene acceso a estas.",
        },
        {
          heading: "Transacciones on-chain",
          body: "Ciertas acciones — incluyendo reclamos de badges, envío de scores, compras en la tienda y mint de NFTs — interactúan con smart contracts en la blockchain de Celo. Estas transacciones son irreversibles una vez confirmadas on-chain.",
        },
        {
          heading: "Activos digitales",
          body: "Los NFTs, badges y artículos de la tienda obtenidos en Chesscito no tienen valor, liquidez ni apreciación garantizados. Son coleccionables del juego, no instrumentos financieros.",
        },
        {
          heading: "Dependencias de terceros",
          body: "Algunas funciones dependen de infraestructura de terceros, wallets y redes blockchain que pueden no estar disponibles, presentar demoras o comportarse de forma inesperada.",
        },
        {
          heading: "Cambios al servicio",
          body: "Chesscito puede modificar, pausar o discontinuar funciones en cualquier momento sin aviso previo.",
        },
        {
          heading: "Limitación de responsabilidad",
          body: 'El servicio se entrega "tal cual". Chesscito y su operador no son responsables por pérdidas derivadas de transacciones blockchain, problemas de wallet o interrupciones del servicio.',
        },
      ],
    },
    privacy: {
      title: "Política de Privacidad",
      lastUpdated: "15 de marzo de 2026",
      sections: [
        {
          heading: "Datos que manejamos",
          body: "Al usar Chesscito, los siguientes datos están involucrados: tu dirección pública de wallet (provista por tu wallet al conectarse), datos de interacción on-chain como scores, badges y compras (públicamente visibles en la blockchain de Celo), y estado local de la app incluyendo progreso de tutoriales, conteo de escudos y preferencias de juego.",
        },
        {
          heading: "Datos que NO recolectamos",
          body: "Chesscito no recolecta contraseñas, frases semilla, identificaciones emitidas por gobiernos, información de identificación personal (PII), ni cookies de analítica o tracking.",
        },
        {
          heading: "Almacenamiento local",
          body: "El estado de tutoriales, preferencias de juego, escudos de racha y ajustes de UX se almacenan en tu dispositivo con fines de experiencia. Las acciones on-chain y los datos blockchain relacionados son públicos por naturaleza y pueden transmitirse a través de la infraestructura de wallet y red necesaria para operar la app.",
        },
        {
          heading: "Infraestructura de terceros",
          body: "Chesscito utiliza proveedores RPC de Celo para lecturas y escrituras blockchain, y WalletConnect para conexión de wallets. No usamos proveedores de analítica ni redes de publicidad.",
        },
        {
          heading: "Propósito del uso de datos",
          body: "Los datos se usan únicamente para operar el juego: validar movimientos, registrar scores, procesar compras y mintear coleccionables.",
        },
        {
          heading: "Retención de datos",
          body: "Los datos on-chain son permanentes por la naturaleza de la blockchain. Los datos locales en tu dispositivo pueden ser borrados por ti en cualquier momento desde la configuración del navegador.",
        },
        {
          heading: "Contacto",
          body: `Para preguntas relacionadas con privacidad, visita nuestra página de Soporte o escribe a ${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "nuestro equipo de soporte"}.`,
        },
      ],
    },
  },
  GLOBAL_STATUS_BAR_COPY: {
    guestLabel: "Invitado",
    ariaLabelConnected: "Estado del jugador",
    ariaLabelAnonymous: "Estado anónimo",
    ariaLabelLive: "Estado de partida en vivo",
    proManageLabel: "Administrar Chesscito PRO",
    proViewLabel: "Ver Chesscito PRO",
    proInactiveLabel: "PRO",
    proLoadingAriaLabel: "Cargando estado PRO",
    backLabel: "Volver al hub",
    accountLabel: "Abrir cuenta",
    accountChipLabel: "Cuenta",
  },
  CONNECT_PROMPT_COPY: {
    title: "Guarda tu progreso en cadena",
    starsSubline: "Ganaste 3 estrellas. Conecta tu wallet para no perderlas.",
    victorySubline: "¡Ganaste! Conecta tu wallet para acuñar tu victoria.",
    badgesSubline: "Tienes badges para reclamar. Conecta tu wallet para conservarlos.",
    connectCta: "Conectar para guardar",
    dismissCta: "Quizás luego",
    dismissAriaLabel: "Descartar recordatorio de conexión",
    successAfterConnect: "Tu progreso está guardado en cadena.",
  },
  ACCOUNT_SHEET_COPY: {
    title: "Cuenta",
    description: "Wallet, red y estado PRO",
    walletLabel: "Wallet",
    networkLabel: "Red",
    proLabel: "PRO",
    copyAddress: "Copiar dirección",
    copiedAddress: "Copiada",
    disconnect: "Desconectar",
    minipayDisconnectHint:
      "Si MiniPay mantiene la sesión activa, desconecta desde los ajustes del wallet de MiniPay.",
    managePro: "Gestionar PRO",
    viewPro: "Ver PRO",
    activePro: "Activo",
    inactivePro: "Inactivo",
    unknownNetwork: "Red desconocida",
    closeAriaLabel: "Cerrar cuenta",
    coachRowLabel: "Mi Coach",
    coachStatusActive: "Conversa",
    coachStatusFree: "Gratis",
    coachStatusEmpty: "Sin gratis",
    languageLabel: "Idioma",
    languageOptionEnglish: "English",
    languageOptionSpanish: "Español",
    languageSwitchAriaFormat: "Cambiar idioma a {name}",
  },
  PRO_COPY: {
    ...en.PRO_COPY,
    label: "Chesscito PRO",
    kicker: "Pase de entrenamiento",
    tagline: "Chesscito que crece con vos",
    taglineSub: "Mientras más jugás, más app desbloqueás.",
    subtitle:
      "Pase mensual que mantiene a Chesscito abierto. Renueva cuando quieras.",
    priceLabel: "$1.99 / mes",
    durationLabel: "30 días",
    ctaBuy: "Activar PRO",
    ctaConnectWallet: "Conectar wallet",
    trainingPassLabel: "PASE DE ENTRENAMIENTO",
    activePerksLabel: "VENTAJAS ACTIVAS",
    ctaActive: "PRO activo",
    ctaRenew: "Extender entrenamiento",
    processingLabel: "Procesando…",
    verifyingLabel: "Verificando…",
    switchNetworkLabel: "Cambiar red",
    closeLabel: "Cerrar PRO",
    noAutoBillingLine: "({duration} · sin cobros automáticos)",
    insufficientBalance: "Saldo insuficiente de stablecoin.",
    txTimeout: "Esto tardó más de lo esperado. Intenta de nuevo.",
    statusActiveSuffix:
      "{daysLeft, plural, =1 {Vence mañana} other {# días restantes}}",
    expiringMicroCopy: "Renueva cuando quieras para seguir entrenando",
    statusBadgeActive: "ACTIVO",
    statusBadgeExpiring: "POR VENCER",
    comingSoonLabel: "PRONTO",
    activeCtaPlay: "Jugar en Arena",
    activeCtaGotIt: "Entendido",
    activeSublineHub: "El Coach analiza después de la partida",
    activeSublineArena: "El Coach se activa tras el jaque mate",
    missionNote:
      "Cada suscripción PRO ayuda a mantener la versión gratuita abierta para nuevos jugadores, familias y escuelas.",
    chip: {
      inactive: "PRO",
      activePrefix: "PRO",
    },
    chipActiveAriaLabel: "{label} activo",
    chipGetAriaLabel: "Activar {label}",
    coachCardAriaLabel: "Entrenamiento Coach PRO",
    coachChipsAriaLabel: "Coach PRO incluye",
    coachKickerActive: "Pase de entrenamiento",
    coachKickerInactive: "Coach personal",
    hubCoachCard: {
      inactive: {
        title: "Coach PRO",
        body: "Recibe feedback después de partidas y prácticas.",
        chips: ["Errores", "Consejos", "Historial"],
        cta: "COACH",
      },
      active: {
        title: "PRO Activo · {remainingDays}d",
        body: "Tu Coach está listo.",
        features: "Análisis · Historial · Próximo entrenamiento",
        chips: ["Análisis", "Historial", "Próximo entrenamiento"],
        cta: "DIARIO",
      },
    },
    activeActions: {
      journal: "DIARIO",
      journalSubline:
        "Revisa tu historial con el Coach y elige la próxima lección.",
    },
    perksActive: [
      "Coach AI: análisis instantáneo, sin límite diario",
      "Plan de entrenamiento personalizado según tu historial",
      "Tu aporte mantiene a Chesscito abierto para nuevos jugadores",
    ],
    errors: {
      notConfigured: "PRO aún no está activo. Vuelve a intentarlo pronto.",
      purchaseFailed:
        "No se pudo verificar la compra. Intenta de nuevo.",
      walletRequired: "Conecta tu wallet para comprar PRO.",
      verifyFailedTitle: "Pago confirmado — verificación pendiente.",
      verifyFailedReassurance:
        "Tu pago quedó guardado en Celo. Reintentar no genera doble cobro.",
      retryVerifyCta: "Reintentar",
      retryingVerify: "Verificando…",
    },
    receipt: {
      success:
        "PRO activado. Tu plan de entrenamiento está activo por 30 días.",
    },
  },
  COACH_COPY: {
    ...en.COACH_COPY,
    askCoach: "COACH",
    loading: "Cargando…",
    quickReviewTitle: "ANÁLISIS",
    coachAnalysisTitle: "ANÁLISIS",
    keyMoments: "MOMENTOS CLAVE",
    whatYouDidWell: "LO QUE HICISTE BIEN",
    takeaways: "APRENDIZAJES",
    tips: "CONSEJOS",
    yourSessions: "DIARIO",
    pastSessions: "Sesiones anteriores",
    yourProgress: "TU PROGRESO",
    gamesAnalyzed: "Partidas analizadas: {count}",
    highestDifficulty: "Dificultad máxima: {difficulty}",
    currentStreak: "Racha actual: {wins} victorias",
    creditTitle: "Yo sigo acá",
    creditExplain:
      "Vi tu partida. Ya gastaste tus 3 análisis gratis. Sumá un pack y seguimos conversando.",
    creditPack5: "5 análisis",
    creditPack20: "20 análisis",
    creditBest: "MEJOR",
    buyWithUsdc: "Comprar con stablecoin",
    orQuickReview: "ANÁLISIS",
    getFullAnalysis: "ANÁLISIS PRO",
    getFullAnalysisSub: "Mira tus momentos clave y consejos personalizados",
    analyzing: "Analizando tu partida",
    reviewingMoves: "Revisando tus jugadas",
    canLeave: "Puedes salir. Guardamos tu resultado",
    analysisReady: "Tu análisis está listo",
    analysisProcessing: "Tu análisis aún se está procesando…",
    analysisFailed:
      "No se pudo completar el análisis. Tu crédito no se gastó.",
    coachResting: "El Coach está descansando. Intenta más tarde.",
    cancel: "Cancelar",
    retry: "Reintentar",
    full: "Completo",
    quick: "Rápido",
    keyMomentsCount: "{count} momentos clave",
    moveLabel: "Jugada {moveNumber} · Jugaste {move}",
    tryInstead: "→ Intenta {move}",
    welcomeTitle: "Conoce a tu Coach",
    welcomeSub:
      "Un compañero de aprendizaje que te ayuda a entender tus decisiones y mejorar paso a paso.",
    welcomePack: "3 análisis",
    welcomePackDetail: "Momentos clave · Lecciones · Reconocimientos",
    claimFree: "RECLAMAR",
    welcomeNote:
      "Análisis gratis para empezar. Después, paquetes desde $0.05.",
    creditComingSoon: "¡Los paquetes de créditos llegan pronto!",
    connecting: "Conectando al Coach…",
    coachThinking: "El Coach está pensando…",
    keepScreenOpen: "Mantén esta pantalla abierta.",
    reviewRetryTitle: "REINTENTAR",
    slowThinking:
      "El Coach sigue pensando. Mantén esta pantalla abierta.",
    retryReview: "REINTENTAR",
    analysisIncomplete: "Tu análisis no se completó.",
    analysisIncompleteBody:
      "Inténtalo de nuevo. Si sigue fallando, vuelve más tarde.",
    loadingCanLeave:
      "Puedes salir. Tu resultado estará listo cuando regreses.",
    creditPackSubtitle: "{count} análisis de partidas",
    historyAskNextTitle: "Pedile a Luz tu próximo análisis",
    historyAskNextSub:
      "Ya no te quedan análisis gratis. Sumá un pack y seguí conversando.",
    unlockFullAnalysis: "ANÁLISIS PRO",
    historyFooter: {
      building: "Construyendo tu historial…",
      reviewing:
        "{count, plural, =1 {Revisando # partida pasada} other {Revisando # partidas pasadas}}",
      manageLabel: "gestionar historial",
    },
    historyDelete: {
      title: "Eliminar todo tu historial del Coach",
      body:
        "Elimina permanentemente cada análisis guardado de nuestros registros. Esta acción no se puede deshacer. Tu pase PRO activo no se ve afectado.",
      cta: "Eliminar historial",
      confirmTitle: "¿Eliminar todo el historial?",
      confirmBody:
        "Esto eliminará permanentemente todos tus análisis pasados del Coach y el seguimiento de debilidades. Tu próximo análisis comenzará desde cero.",
      confirmAccept: "Sí, eliminar todo",
      confirmCancel: "Mantener mi historial",
      successToast: "Datos del Coach eliminados de nuestros registros",
      errorToast: "No se pudo eliminar. Intenta de nuevo",
    },
    analysisLocaleBadge: {
      en: "EN",
      es: "ES",
      ariaLabel: "Idioma del análisis: {locale}",
    },
    reanalyze: {
      cta: "Reanalizar",
      ariaLabel: "Reanalizar esta partida en tu idioma actual",
      panelTitle: "¿Querés otra perspectiva?",
      panelBody:
        "Los análisis del Coach son aproximados. Generá uno nuevo si este no te convenció, o para leerlo en tu idioma actual.",
      confirmTitle: "¿Reanalizar esta partida?",
      confirmBody:
        "Esto genera un análisis nuevo en tu idioma actual y usa 1 crédito.",
      confirmBodyPro:
        "Esto genera un análisis nuevo en tu idioma actual. Los suscriptores PRO no gastan créditos.",
      confirmAccept: "Sí, reanalizar",
      confirmCancel: "Cancelar",
      inFlightLabel: "Generando nuevo análisis…",
    },
    historyBannerSubtitle:
      "Coaching personalizado desde tu historial de partidas.",
    backLabel: "Atrás",
    connectWalletForHistory:
      "Conecta tu wallet para ver tu historial del Coach.",
    historyAriaLabel: "Historial de análisis del Coach",
    resultLabels: {
      win: "Victoria",
      lose: "Derrota",
      draw: "Tablas",
      resigned: "Rendición",
    },
    relativeTime: {
      justNow: "ahora mismo",
      minutes: "hace {count}m",
      hours: "hace {count}h",
      days: "hace {count}d",
      months: "hace {count}mes",
    },
    latestReviewCard: {
      title: "Último análisis",
      openLabel: "Abrir →",
      ariaLabel:
        "Abrir análisis {typeLabel} del Coach, {result}, {difficulty}, {moves} jugadas",
    },
    progressStats: {
      reviewed: "Revisadas",
      highest: "Máxima",
      winStreak: "Racha",
    },
    emptyState: {
      title: "Aún sin análisis",
      body:
        "Juega una partida en Arena y pide análisis al Coach al terminar.",
      cta: "ARENA",
      ctaAriaLabel: "Ir a Arena y jugar una partida",
    },
    manageHistoryOpen: "Gestionar historial",
    manageHistoryClose: "Cerrar",
  },
  COACH_ENTRY_COPY: {
    ...en.COACH_ENTRY_COPY,
    getCoachAnalysis: "Obtener análisis del Coach",
    savingMatch: "Guardando partida…",
    matchSaved: "Partida guardada",
    matchNotSaved: "Partida no guardada · el juego continúa",
    matchNotSavedRetry: "Reintentar",
    matchTooShort: "Partida demasiado corta para analizar",
    historyMatchLabel: "Partida",
    analyzeChipLabel: "Analizar",
    historyAnalyzeAriaLabel:
      "Analizar partida del {timestamp}, {difficulty}, {result}",
    victorySecondaryDescription:
      "Acción secundaria. Reclamar Victoria arriba es la acción principal.",
    offlineToAnalyze: "Necesitas estar en línea para analizar",
    persistDismissLabel: "Cerrar",
    reviewKicker: "COACH REVIEW",
    reviewHeadlineReady: "¿Una mirada más profunda?",
    reviewBodyReady: "El Coach revisa tu partida y muestra los momentos clave.",
    reviewHeadlineTooShort: "Sin jugadas para analizar",
    reviewBodyTooShort: "Haz al menos una jugada antes de pedir análisis al Coach.",
  },
  COACH_ONBOARDING_COPY: {
    ...en.COACH_ONBOARDING_COPY,
    intros: {
      win: "Hola, soy Luz. Vi tu partida. Ganaste con criterio. ¿Te cuento qué vi?",
      lose: "Hola, soy Luz. Vi tu partida. Perder duele, lo sé, pero ya hiciste cosas bien. ¿Te las muestro?",
      draw: "Hola, soy Luz. Vi tu partida. Empate, interesante. ¿Te muestro dónde estuvo cerca?",
    },
    ctaAccept: "Sí, mostrame",
    ctaDecline: "Ahora no",
  },
  COACH_CTA_COPY: {
    ...en.COACH_CTA_COPY,
    askWithCounter: "Pedile a Luz tu análisis (te quedan {count} gratis)",
    askWhenZero: "Pedile a Luz tu análisis (necesitás PRO o un pack)",
  },
  ARENA_COPY: {
    ...en.ARENA_COPY,
    title: "Arena",
    subtitle: "Elige tu rango. Domina el tablero.",
    difficulty: {
      easy: "Fácil",
      medium: "Medio",
      hard: "Difícil",
    },
    difficultyDesc: {
      easy: "IA amigable — comete errores seguido",
      medium: "Jugadora sólida — un reto justo",
      hard: "Experta — juega para ganar",
    },
    startMatch: "JUGAR",
    backToHub: "HUB",
    backToHubAria: "Volver al Hub",
    playAsWhite: "Juega como Blancas",
    playAsBlack: "Juega como Negras",
    resign: "Rendirse",
    resignConfirm: "Toca de nuevo para confirmar",
    undo: "Deshacer",
    yourTurn: "Tu turno",
    newGame: "Nueva partida",
    aiThinking: "IA pensando…",
    preparingAi: "Preparando IA…",
    promotionTitle: "Promueve el peón a:",
    endState: {
      checkmate: {
        win: "Jaque mate — ¡Ganaste!",
        lose: "Jaque mate — La IA ganó",
      },
      stalemate: "Tablas por ahogado",
      draw: "Tablas",
      resigned: "Te rendiste",
    },
    playAgain: "JUGAR",
    softGateTitle: "¿Calentamos antes?",
    softGateBody:
      "Aprende una pieza en menos de 2 minutos y luego reta a la IA.",
    softGateLearn: "PIEZAS",
    softGateEnter: "ARENA",
    prizePoolLabel: "Premio comunitario",
    prizePoolLoading: "Cargando premio…",
    prizePoolUnavailable: "Premio no disponible",
    prizePoolSoonHint:
      "Distribución v2 próximamente — 20% de cada victoria guardada va al premio comunitario",
    aiError: "IA desconectada",
    aiTimeout: "La IA tardó demasiado",
    engineError: "Error del motor — reinicia la partida",
    restartMatch: "Reiniciar",
    boardError: "Error del tablero — reinicia la partida",
    coachSignal: {
      inactiveTitle: "ANÁLISIS",
      inactiveBody: "Desbloquea el análisis completo al jugar",
      inactiveCta: "COACH",
      activeTitle: "ANÁLISIS",
      activeBody: "Revisa después del jaque mate",
    },
    coachPreview: {
      emptyTitle: "Sin jugadas para analizar",
      emptyBody:
        "Haz al menos una jugada antes de pedir análisis al Coach.",
      inactiveTitle: "Vista previa del Coach",
      insight:
        "Terminaste una partida en {difficulty} en {moves} jugadas. El Coach encontró momentos clave detrás de {result, select, win {tu victoria} draw {las tablas} resigned {la rendición} other {la derrota}}.",
      lockedBenefits: ["Momentos clave", "Mejores jugadas", "Próximo entrenamiento"],
      inactiveCta: "ANÁLISIS PRO",
      activeTitle: "ANÁLISIS",
      activeBody: "Revisa tus momentos clave y próximo paso de entrenamiento.",
      activeCta: "ANALIZAR",
      cardKicker: "Análisis del Coach",
      cardChipsAriaLabel: "El análisis completo incluye",
    },
    coachSignalAriaLabel: "Análisis del Coach",
    coachSignalTokenPro: "PRO",
    coachSignalTokenFree: "Coach",
    confirmQuitAriaLabel: "Confirmar salir",
    confirmQuitLabel: "¿SALIR?",
    confirmResignLabel: "¿Confirmar?",
    timerAriaLabel: "Tiempo transcurrido: {time}",
    promotionCancelAriaLabel: "Cancelar promoción",
    colorPickerAriaLabel: "Elige tu color",
    softGateRegionLabel: "Calentamiento",
    scaffoldPageAriaFormat: "Chesscito {title}",
    playAsPrefix: "Juega como",
    playAsWhiteName: "Blancas",
    playAsBlackName: "Negras",
    matchEndedLabel: "¿Otra ronda?",
    matchEndedHint: "Inténtalo de nuevo cuando estés listo.",
  },
  VICTORY_CLAIM_COPY: {
    ...en.VICTORY_CLAIM_COPY,
    progressTitle: "Guardando…",
    challengeText:
      "Resolví esto en {moves} jugadas. ¿Puedes superarme?\nJuega Chesscito en Celo 👉 {url}",
    claimButton: "GUARDAR VICTORIA",
    claimHelper:
      "Guarda esta victoria para siempre y desbloquea tu tarjeta para compartir",
    teaserLabel: "Se desbloquea al guardar",
    teaserCheckmate: "Jaque mate en {moves} jugadas",
    teaserShare: "COMPARTIR",
    claimingInProgress: "Guardando…",
    claiming: "Guardando tu victoria…",
    claimProgress1: "Registrando tu resultado",
    claimProgress2: "Preparando tu tarjeta",
    successTitle: "¡Victoria guardada!",
    successSubtitle: "Tu victoria quedó guardada en Celo. Tu tarjeta está lista.",
    errorTitle: "No se pudo guardar",
    errorSubtitle: "Algo salió mal al guardar tu victoria.",
    tryAgain: "Reintentar",
    shareCard: "Compartir tarjeta",
    challengeFriend: "Retar a alguien",
    copyLink: "Copiar enlace",
    copiedToast: "¡Copiado!",
    sharedToast: "¡Compartido!",
    viewTrophies: "TROFEOS",
    card: {
      headline: "JAQUE MATE",
      challengeLine: "¿Puedes superarme?",
      performanceLine: "{moves} JUGADAS • {time}",
      byLine: "por {player}",
      brand: "Chesscito",
    },
    progressSteps: ["Firmando", "Confirmando", "Listo"],
    progressTimeHint: "Tarda unos segundos",
    claimedBadge: "Victoria guardada",
    errorRecoveryHint:
      "Tu partida está guardada. Puedes intentar guardarla de nuevo cuando quieras.",
    errorKindCopy: {
      error: {
        title: "No se pudo guardar",
        subtitle: "Algo salió mal al guardar tu victoria.",
        hint: "Tu partida está guardada. Puedes intentar guardarla de nuevo cuando quieras.",
      },
      cancelled: {
        title: "Guardada para después",
        subtitle:
          "Nada se confirmó. Tu victoria sigue aquí cuando quieras guardarla.",
        hint: "No hubo cargo. Toca reintentar cuando quieras.",
      },
      timeout: {
        title: "Aún confirmando…",
        subtitle:
          "La red está tardando más de lo normal. Tu wallet puede tener ya la confirmación.",
        hint: "Revisa primero tu wallet — si sigue pendiente, espera un momento antes de reintentar.",
      },
    },
    statusHeadlinePaused: "En pausa",
    statusHeadlineError: "Error",
    reviewMatchCta: "Analizar partida",
  },
  VICTORY_CELEBRATION_COPY: {
    ...en.VICTORY_CELEBRATION_COPY,
    title: "Victoria",
    headlineCheckmate: "¡Jaque mate!",
    headlineWin: "¡Victoria!",
    performanceLine: "Resuelta en {moves} jugadas — {time}",
    performanceLineCheckmate: "Jaque mate en {moves} jugadas — {time}",
    stats: { difficulty: "nivel", moves: "jugadas", time: "tiempo" },
  },
  PIECE_LABELS: {
    rook: "Torre",
    bishop: "Alfil",
    knight: "Caballo",
    pawn: "Peón",
    queen: "Reina",
    king: "Rey",
  },
  JOURNEY_RAIL_COPY: {
    ariaLabel: "Tu camino",
    pieceBadgeFormat: "Insignia de {piece}",
    unlockPieceFormat: "Desbloquea {piece}",
    noMorePieces: "Sin más piezas",
    allPiecesMastered: "Todas las piezas dominadas",
    claimed: "Conseguida",
    readyToClaim: "Lista para obtener",
    ready: "Listo",
    claimBadgeFirst: "Obtén la insignia primero",
    starProgressFormat: "{current} / {total} ★",
    masteredCountFormat: "{count} / {total}",
  },
  TX_PROGRESS_COPY: {
    pillsPrepare: "PREPARAR",
    pillsSign: "FIRMAR",
    pillsSend: "ENVIAR",
    pillsWait: "ESPERA",
    pillsVerify: "VERIFICAR",
    pillsDone: "LISTO",
    pillsFailed: "FALLÓ",
    toastPrepare: "Preparando…",
    toastSign: "Firma en tu billetera…",
    toastSend: "Enviando transacción…",
    toastWait: "Confirmando on-chain…",
    toastVerify: "Verificando con el servidor…",
    toastDoneSuccess: "Listo",
    toastDoneFailed: "Falló",
    stepCounter: "Paso {current} de {total}",
    toastErrorFallback: "Transacción fallida — ver detalles",
  },
  SHARE_COPY: {
    ...en.SHARE_COPY,
    button: "Compartir",
    badge:
      "¡Gané la insignia Ascendente de {piece} en Chesscito! {stars}/15 estrellas — guardado en Celo para siempre.",
    score:
      "¡Acabo de guardar mi puntaje de Chesscito en Celo! {stars}/15 estrellas — para siempre.",
    shop: "¡Acabo de obtener {item} en Chesscito!",
    fallbackCopied: "¡Copiado!",
    playCta: "Jugar Chesscito",
  },
  DAILY_SHARE_COPY: {
    ...en.DAILY_SHARE_COPY,
    shareChallenge: "Compartir reto",
    shareResult: "Compartir resultado",
    ctaChallenge: "¿Puedes resolver el puzzle de hoy?",
    ctaSolvedNoStreak: "Resolví el puzzle de hoy. ¿Y tú?",
    ctaSolvedWithStreak: "Resolví el puzzle de hoy. Racha: {streak}. ¿Y tú?",
    metaTitleChallenge: "Táctica diaria — Chesscito",
    metaTitleSolved: "Táctica diaria resuelta — Chesscito",
    headlineChallenge: "Táctica diaria",
    headlineSolved: "Táctica diaria resuelta",
    defaultName: "Táctica diaria",
  },
  ENDGAME_SHARE_COPY: {
    ...en.ENDGAME_SHARE_COPY,
    shareChallenge: "Compartir reto",
    shareResult: "Compartir resultado",
    ctaChallenge: "¿Puedes forzar mate desde esta posición?",
    ctaSolvedNoMoves: "Resolví este final. ¿Y tú?",
    ctaSolvedWithMoves:
      "Resolví este entrenamiento R+T vs R en {moves}/{limit} movimientos. ¿Y tú?",
    metaTitleChallenge: "Reto de final — Chesscito",
    metaTitleSolved: "Final resuelto — Chesscito",
    headlineChallenge: "Reto de final",
    headlineSolved: "Final resuelto",
    defaultName: "R+T vs R",
    kicker: "Mini Arena",
  },
  BADGE_SHARE_COPY: {
    kicker: "Insignia obtenida",
    metaTitleFormat: "Insignia Ascendente de {piece}",
    headlineFormat: "{piece} Ascendente",
  },
  SCORE_SHARE_COPY: {
    metaTitleFormat: "{stars}/15 estrellas en Chesscito",
    kickerFormat: "{piece} dominada",
    headlineFormat: "{stars} / 15 estrellas",
  },
  SHARE_GRID_COPY: {
    more: "Más",
    copy: "Copiar",
    save: "Guardar",
    saveSaved: "Guardado",
    saveLinkCopied: "Link copiado",
    saveFailed: "Reintentar",
    shareOnLabel: "Compartir en {service}",
  },
  SHARE_MODAL_COPY: {
    defaultTitle: "Compartir",
    closeLabel: "Cerrar compartir",
    previewAlt: "Vista previa",
    generatingCard: "Generando tu card…",
    previewUnavailable: "Vista previa no disponible",
  },
  VICTORY_PAGE_COPY: {
    tagline: "Entrena tu mente con retos pre-ajedrecísticos — un juego de Celo MiniPay",
    challengeLine: "¿Puedes superarlo?",
    acceptChallenge: "Aceptar reto",
    backToHub: "HUB",
    loading: "Cargando victoria...",
    errorTitle: "No se pudo cargar la victoria",
    errorFallback: "Algo salió mal al cargar esta victoria.",
    tryAgain: "Reintentar",
    metaCheckmate: "Jaque mate en {moves} movimientos",
    metaComplete: "Completado en {moves} movimientos",
    metaChallenge:
      "¿Puedes superarlo? Victoria #{id} guardada como una carta de victoria de Chesscito.",
    metaFallback: "¿Puedes superarlo? Juega Chesscito en Celo.",
    metaFallbackTitle: "Victoria #{id}",
  },
  TROPHY_VITRINE_COPY: {
    pageTitle: "TROFEOS",
    pageDescription: "Tus victorias guardadas.",
    myVictories: "Mis victorias",
    hallOfFame: "Salón de la fama",
    movesLabel: "jugadas",
    shareLabel: "Compartir",
    loadingText: "Cargando trofeos…",
    copiedToast: "¡Enlace copiado!",
    connectWallet: "Conecta tu wallet para ver tus trofeos",
    connectWalletButton: "Conectar wallet",
    noVictories: "Aún sin victorias",
    firstVictoryHeadline: "Cada victoria, tuya para siempre.",
    firstVictorySub: "Gana una partida y recibe un coleccionable digital. Es tuyo de por vida.",
    heroEyebrow: "TU VITRINA",
    heroVictoriesLabel: "VICTORIAS",
    heroAchievementsLabel: "LOGROS",
    heroBestLabelFormat: "Tu mejor: {moves} jugadas · {time}",
    heroEmptyHint: "Tu primera victoria espera.",
    noGlobalVictories: "Aún no hay victorias registradas",
    loadError: "No se pudieron cargar las victorias",
    tapToRetry: "Toca para reintentar",
    configError: "Trofeos sin conexión",
    roadmap: "Próximamente: Torneos • Pases VIP • Recompensas de temporada",
    arenaLink: "ARENA",
    cardIdPrefix: "Victoria",
    backLabel: "Atrás",
    verifiableVictoryHeadline: "Victoria verificable",
    movesStatLabel: "Jugadas",
    timeStatLabel: "Tiempo",
    playerStatLabel: "Jugador",
    historyHeading: "Historial",
    closeSheetLabel: "Cerrar trofeos",
  },
  ACHIEVEMENTS_COPY: {
    sectionTitle: "Logros",
    sectionDescription: "{earned} de {total} desbloqueados",
    emptyHint: "Gana en Arena para desbloquear logros",
    lockedLabel: "Bloqueado",
    earnedLabel: "Ganado",
    progressLabel: "{current}/{goal}",
    sectionEarned: "Ganados",
    sectionLocked: "Bloqueados",
    detailEarnedSubtitle: "Logro desbloqueado",
    detailLockedSubtitle: "Cómo desbloquear",
    goalLabel: "Meta",
    detailCloseLabel: "Cerrar",
    progressEyebrow: "PROGRESO",
    itemsLabel: "ÍTEMS",
    closeAchievementLabel: "Cerrar logro",
    items: {
      "first-victory": {
        title: "Primera victoria",
        description: "Gana tu primera partida en Arena.",
      },
      "arena-champion-medium": {
        title: "Jugador sólido",
        description: "Vence a la IA en Medio o Difícil.",
      },
      "arena-champion-hard": {
        title: "Campeón del Arena",
        description: "Vence a la IA en Difícil.",
      },
      speedrunner: {
        title: "Velocista",
        description: "Gana una partida en 20 movimientos o menos.",
      },
      "rapid-finish": {
        title: "Cierre rápido",
        description: "Gana una partida en menos de 30 segundos.",
      },
      "five-crowns": {
        title: "Cinco coronas",
        description: "Gana 5 partidas en Arena.",
      },
      dedication: {
        title: "Dedicación",
        description: "Gana 25 partidas en Arena.",
      },
    },
  },
  PROFILE_COPY: {
    pageTitle: "Perfil",
    sheetDescription: "Perfil, pendientes, estadísticas y wallet",
    closeLabel: "Cerrar perfil",
    editNameAria: "Editar nombre",
    tierAriaFormat: "Rango {title}, {xp} XP",
    pendingClaimsHeader: "Por obtener",
    generalStatsHeader: "Estadísticas generales",
    walletLabel: "Wallet",
    networkLabel: "Red",
    disconnect: "Desconectar wallet",
    manage: "Gestionar",
    refreshAria: "Actualizar pendientes",
    statLabels: {
      piecesMastered: "Piezas dominadas",
      dailyStreak: "Racha diaria",
      puzzlesSolved: "Tácticas resueltas",
      arenaWins: "Victorias en Arena",
      trophies: "Trofeos",
      nftsMinted: "Victorias guardadas",
    },
  },
  DISPLAY_NAME_COPY: {
    dialogTitle: "Elige tu nombre",
    placeholder: "Hasta 20 caracteres",
    save: "Guardar",
    cancel: "Cancelar",
    visitor: "Visitante",
  },
  TIER_LABELS: {
    visitor: "Visitante",
    apprentice: "Aprendiz",
    trainee: "Practicante",
    knight: "Caballero",
    wizard: "Mago",
    grandmaster: "Gran maestro",
  },
  HERO_CTA_COPY: {
    newPlayer: {
      label: "ENTRENA TORRE",
      sub: "aprende primero la torre",
      variant: "amber",
    },
    dailyPending: {
      label: "TÁCTICA DEL DÍA",
      sub: "la táctica del día te espera",
      variant: "blue",
    },
    defaultCaughtUp: {
      label: "ENTRENA PIEZAS",
      sub: "toca una pieza para empezar",
      variant: "amber",
    },
  },
  CLAIM_COPY: {
    kinds: {
      badge: "Insignia {name}",
      score: "Guardar puntaje · {points} pts",
      victoryNft: "Guarda tu victoria · {difficulty}",
    },
    claimVerb: "Obtener",
    costGasOnly: "Solo tarifa de red",
    costEstimateUsd: "~${amount}",
    inFlightLabel: "En curso — reconecta para verificar",
    refreshAria: "Actualizar",
    emptyAria: "Sin reclamos pendientes",
  },
  HOME_ANCHOR_COPY: {
    alt: "Reino de Chesscito — Wolfcito el mago con estatuas de piezas de ajedrez",
    attractHint: "Tu entrenamiento te espera en el reino",
    taglineLead: "Entrena tus piezas. Domina el tablero.",
    taglineHighlight: "¡Después juega y gana!",
  },
  REWARD_COPY: {
    rook: {
      label: "Maestría de Torre",
      claimableHint: "Toca para reclamar tu insignia de Torre",
      lockedHint: "Completa los 3 niveles de Torre para desbloquear",
      unlockRequirement: "Completa Torre L1 + L2 + L3",
      ariaLabel:
        "{state, select, claimable {Reclama la insignia de maestría de Torre — lista} progress {Maestría de Torre — en progreso} other {Maestría de Torre — bloqueada}}",
    },
    bishop: {
      label: "Maestría de Alfil",
      claimableHint: "Toca para reclamar tu insignia de Alfil",
      lockedHint: "Domina la Torre primero, luego completa los 3 niveles de Alfil",
      unlockRequirement: "Completa Alfil L1 + L2 + L3",
      ariaLabel:
        "{state, select, claimable {Reclama la insignia de maestría de Alfil — lista} progress {Maestría de Alfil — en progreso} other {Maestría de Alfil — bloqueada}}",
    },
    queen: {
      label: "Maestría de Reina",
      claimableHint: "Toca para reclamar tu insignia de Reina",
      lockedHint: "Domina Torre + Alfil para desbloquear",
      unlockRequirement: "Domina Torre + Alfil",
      ariaLabel:
        "{state, select, claimable {Reclama la insignia de maestría de Reina — lista} progress {Maestría de Reina — en progreso} other {Maestría de Reina — bloqueada}}",
    },
    knight: {
      label: "Maestría de Caballo",
      claimableHint: "Toca para reclamar tu insignia de Caballo",
      lockedHint: "Domina la Reina primero, luego completa los 3 niveles de Caballo",
      unlockRequirement: "Domina la Reina, luego completa Caballo L1 + L2 + L3",
      ariaLabel:
        "{state, select, claimable {Reclama la insignia de maestría de Caballo — lista} progress {Maestría de Caballo — en progreso} other {Maestría de Caballo — bloqueada}}",
    },
    king: {
      label: "Maestría de Rey",
      claimableHint: "Toca para reclamar tu insignia de Rey",
      lockedHint: "Domina el Caballo primero",
      unlockRequirement: "Domina el Caballo, luego completa Rey L1 + L2 + L3",
      ariaLabel:
        "{state, select, claimable {Reclama la insignia de maestría de Rey — lista} progress {Maestría de Rey — en progreso} other {Maestría de Rey — bloqueada}}",
    },
    pawn: {
      label: "Maestría de Peón",
      claimableHint: "Toca para reclamar tu insignia de Peón",
      lockedHint: "Domina el Rey primero — el Peón es el jefe final",
      unlockRequirement: "Domina el Rey, luego completa Peón L1 + L2 + L3",
      ariaLabel:
        "{state, select, claimable {Reclama la insignia de maestría de Peón — lista} progress {Maestría de Peón — en progreso} other {Maestría de Peón — bloqueada}}",
    },
    victory: {
      label: "Guarda tu victoria",
      claimableHint: "Toca para guardar tu última victoria en Arena",
      lockedHint: "Gana una partida en Arena para desbloquear",
      unlockRequirement: "Gana una partida en Arena",
      ariaLabel:
        "{state, select, claimable {Victoria lista — toca para guardar} progress {Victoria en progreso} other {Sin victoria lista — gana una partida en Arena}}",
    },
  },
  ROADMAP_COPY: {
    sectionTitle: "Próximamente",
    sectionDescription: "Lo que viene a Chesscito.",
    soonTag: "Pronto",
    items: [
      {
        title: "Torneos",
        description: "Brackets agendados con pozos compartidos.",
      },
      {
        title: "Pases VIP",
        description: "Pases ligados a eventos futuros de la comunidad Celo.",
      },
      {
        title: "Recompensas de temporada",
        description: "Retos rotativos con coleccionables verificables únicos.",
      },
    ],
  },
  GLOSSARY: {
    badge: "Insignia",
    claimBadge: "RECLAMAR",
    submitScore: "GUARDAR",
    piecePath: "Camino de Piezas",
    trial: "Reto",
    progress: "Progreso",
    leaderboard: "LÍDERES",
  },
  CTA_LABELS: {
    startTrial: "Comenzar",
    continue: "Continuar",
    claimBadge: "RECLAMAR",
    submitScore: "GUARDAR",
    retry: "Reintentar",
    viewLeaderboard: "LÍDERES",
    backToPlay: "Volver a jugar",
  },
  FOOTER_CTA_COPY: {
    submitScore: { label: "GUARDAR", compactLabel: "GUARDAR", loading: "Guardando..." },
    useShield: { label: "Usar Escudo", compactLabel: "Escudo", loading: "Usando Escudo..." },
    claimBadge: { label: "RECLAMAR", compactLabel: "RECLAMAR", loading: "Reclamando..." },
    retry: { label: "Reintentar", compactLabel: "Reintentar", loading: null },
    connectWallet: { label: "Conectar Wallet", compactLabel: "Conectar", loading: null },
    switchNetwork: { label: "Cambiar Red", compactLabel: "Red", loading: null },
    shieldsLeft: "{n} restantes",
    submitCanceled: "Guardado cancelado",
    submitFailed: "Falló el guardado — reintenta",
  },
  PIECE_RAIL_COPY: {
    comingSoon: "Pronto",
    title: "Elige una pieza",
    triggerAriaFormat: "Cambiar pieza (actual: {piece})",
    closeLabel: "Cerrar selector de pieza",
  },
  MISSION_DETAIL_COPY: {
    title: "Misión",
    scoreLabel: "Puntaje",
    timeLabel: "Tiempo",
    preFirstMoveHint: "Haz tu primer movimiento para empezar",
    journeyTitle: "Tu viaje",
    closeLabelFormat: "Cerrar {title}",
  },
  BADGE_TITLES: {
    rook: "Torre Ascendente",
    bishop: "Alfil Ascendente",
    knight: "Caballo Ascendente",
    pawn: "Peón Ascendente",
    queen: "Reina Ascendente",
    king: "Rey Ascendente",
  },
  RESULT_OVERLAY_COPY: {
    badge: {
      title: "¡Insignia obtenida!",
      subtitle: "{piece} Ascendente ya es tuya",
    },
    score: {
      title: "¡Puntaje guardado!",
      subtitle: "Guardado en Celo. Listo para compartir.",
    },
    shop: {
      title: "¡Compra lista!",
      subtitle: "{item} desbloqueado — gracias por apoyar Chesscito",
    },
    error: {
      title: "No se pudo guardar",
      cancelled: "El guardado fue cancelado",
      insufficientFunds: "Fondos insuficientes para completar esta acción",
      network: "Error de red — revisa tu conexión y reintenta",
      timeout:
        "Esto está tardando más de lo esperado. Revisa tu wallet o reintenta.",
      revert: "Falló la confirmación — esta acción puede no estar disponible ahora",
      unknown: "Algo salió mal. Por favor reintenta",
      badgeAlreadyClaimed: "¡Ya tienes esta insignia!",
      signingUnavailable: "Servicio de firma no disponible — reintenta en un momento.",
      purchaseKindCopy: {
        error: {
          title: "No se pudo comprar",
          subtitle: "Algo salió mal al completar tu compra.",
          hint: "No se hizo ningún cargo. Reintenta o cierra y reabre la tienda.",
        },
        cancelled: {
          title: "Guardado para luego",
          subtitle: "No se realizó ninguna transacción. No hubo cargo.",
          hint: "Toca el ítem cuando cambies de opinión.",
        },
        timeout: {
          title: "Todavía confirmando…",
          subtitle:
            "La red está tardando más de lo usual. Tu wallet puede ya tener la transacción.",
          hint: "Revisa tu wallet primero — si sigue pendiente, dale un momento antes de reintentar.",
        },
      },
    },
    cta: {
      continue: "Continuar",
      tryAgain: "Reintentar",
      dismiss: "Descartar",
      receiptOnCeloscan: "Recibo en CeloScan",
    },
  },
  PIECE_COMPLETE_COPY: {
    title: "¡Todos los ejercicios completos!",
    subtitleWithNext: "¡Has dominado esta pieza! Te espera {next}.",
    subtitleFinal: "¡Has conquistado cada pieza. Ahora demuéstralo en la Arena!",
    subtitleKeepPracticing: "Sigue empujando — ¡más estrellas desbloquean tu insignia!",
    tryArena: "ARENA",
    nextPiece: "Comenzar {piece}",
    practiceAgain: "Practicar de nuevo",
    submitScore: "GUARDAR",
    coachHint: "Prueba el Coach en Arena",
  },
  BADGE_EARNED_COPY: {
    title: "{piece} Ascendente obtenida",
    claimBadge: "OBTENER",
    submitScore: "GUARDAR",
    later: "Después",
    headerLabel: "¡Insignia obtenida!",
  },
  BADGE_SHEET_COPY: {
    title: "Tus insignias",
    subtitle: "Tu colección",
    owned: "Conseguida",
    claimBadge: "Obtener insignia",
    claiming: "Obteniendo…",
    locked: "Completa retos para desbloquear",
    notStarted: "Completa retos para desbloquear",
    viewTrophies: "Ver trofeos",
    claimSuccess: "¡Insignia {piece} obtenida!",
    ariaLabel: "Insignias",
    closeAriaLabel: "Cerrar insignias",
    ascendantFormat: "{piece} Ascendente",
    claimable: "Lista",
    lockedShort: "Bloqueada",
    claim: "Obtener",
    starsProgressFormat: "{collected} de {total} estrellas",
    firstStepHint: "Domina la Torre, reclama tu primer coleccionable digital.",
    heroPiecesLabel: "PIEZAS",
  },
  TUTORIAL_COPY: {
    rook: "La Torre se mueve en líneas rectas — horizontal o vertical",
    bishop: "El Alfil se mueve en diagonal — cualquier distancia",
    knight: "El Caballo salta en forma de L — 2+1 casillas",
    pawn: "El Peón avanza una casilla — captura en diagonal",
    queen: "La Reina se mueve en cualquier dirección — cualquier distancia",
    king: "El Rey se mueve una casilla en cualquier dirección",
  },
  CAPTURE_COPY: {
    statsLabel: "CAPTURA",
    tutorialBanner: "Captura el objetivo — mueve tu Torre a su casilla",
  },
  SHIELD_COPY: {
    label: "Escudo de Racha",
    subtitle: "¿Fallaste un reto? Usa un escudo para reintentar sin penalización.",
    useShield: "Usar Escudo",
    shieldsLeft: "{n} restantes",
    shieldUsed: "¡Escudo usado!",
    buyLabel: "Comprar (3 usos)",
  },
  DAILY_SOLVE_COPY: {
    solved: "¡Resuelto!",
    firstStreak: "¡Primera racha!",
    extendedStreak: "+1 día",
    newStreak: "¡Nueva racha!",
    streakLabel: "Racha: {n}",
  },
  STATUS_STRIP_COPY: {
    walletNotConnected: "Conecta tu wallet para jugar",
    networkReady: "Red lista",
    switchNetwork: "Cambia a la red soportada",
    piecePathComplete: "Camino de Piezas completo",
    piecePathInProgress: "Camino de Piezas en progreso",
    badgeClaimed: "Conseguida",
    badgeReady: "Lista para reclamar",
    submittingScore: "Guardando puntaje",
    scoreSubmitted: "Puntaje guardado",
    claimingBadge: "Reclamando insignia",
    badgeClaimed2: "Insignia reclamada",
    processingPurchase: "Procesando compra",
    purchaseComplete: "Compra completa",
    waitingConfirmation: "Esperando confirmación.",
    scoreOnchain: "Tu puntaje está registrado públicamente.",
    badgeOnchain: "Tu insignia ahora está confirmada.",
    purchaseOnchain: "Tu compra ahora está confirmada.",
  },
  PHASE_FLASH_COPY: {
    success: "¡Bien hecho!",
    failure: "Reintenta",
  },
  SHOP_SHEET_COPY: {
    title: "TIENDA",
    description: "Equipo arcano para entrenar.",
    featured: "Destacado",
    buyButton: "Comprar",
    buyWithCelo: "Comprar con 1 CELO",
    payWithCeloShort: "Pagar con CELO",
    buyButtonComingSoon: "Próximamente",
    buyButtonUnavailable: "No disponible",
    empty: "Los ítems de la tienda no están disponibles ahora.",
    moreSoonTitle: "Más tesoros vienen",
    moreSoonHint: "Skins, cosméticos y boosters se preparan en el taller.",
    ariaLabel: "Tienda",
    closeAriaLabel: "Cerrar tienda",
    successBannerFormat: "¡{item} desbloqueado!",
    successBannerTxFormat: "tx {hash}",
    buyButtonAriaFormat: "{action}: {item} por {price}",
    status: {
      available: "Disponible",
      unavailable: "No disponible",
      notConfigured: "Próximamente",
    },
  },
  LEADERBOARD_SHEET_COPY: {
    title: "LÍDERES",
    description: "Sube en el tablero. Reina en el tablero.",
    columnPlayer: "Jugador",
    columnScore: "Puntaje",
    loading: "Cargando tabla...",
    empty: "Aún sin campeones.",
    emptyArenaLink: "ARENA",
    error: "No se pudo cargar el ranking",
    retry: "Reintentar",
    champion: "Campeón",
    topCompetitors: "Mejores competidores",
    closeAriaLabel: "Cerrar líderes",
    heroEyebrow: "EL RANKING",
    heroChampionLabelFormat: "Campeón: {player}",
    heroChampionStatsFormat: "{score} pts · {count} jugadores",
    heroEmptyHeadline: "Aún sin ranking",
    heroEmptyHint: "Sé el primero en sumar puntos.",
  },
  PURCHASE_CONFIRM_COPY: {
    title: "Confirmar compra",
    description: "Revisa los detalles antes de confirmar.",
    confirmButton: "Confirmar compra",
    approving: "Aprobando {token}…",
    buying: "Comprando…",
    cancel: "Cancelar",
    closeAriaLabel: "Cancelar compra",
    unknownNetwork: "Red desconocida",
  },
  SAVED_CHIP_COPY: {
    label: "Guardado · {stars}★",
    hint: "Supera tu puntaje para guardar de nuevo",
    receiptHint: "Toca para ver recibo",
    ariaLabel:
      "Puntaje guardado en cadena: {stars} de {total} estrellas. Supera tu puntaje para guardar de nuevo.",
    ariaLabelWithReceipt:
      "Puntaje guardado en cadena: {stars} de {total} estrellas. Toca para ver recibo en Celoscan.",
  },
  MISSION_BRIEFING_COPY: {
    label: "MISIÓN",
    play: "¡VAMOS!",
    targetPrefix: "Mover a:",
    moveHint: {
      rook: "La Torre se mueve en líneas rectas",
      bishop: "El Alfil se mueve en diagonal",
      knight: "El Caballo salta en forma de L",
      pawn: "El Peón avanza, captura en diagonal",
      queen: "La Reina se mueve en cualquier dirección",
      king: "El Rey se mueve una casilla a la vez",
    },
    captureHint: "Captura la pieza objetivo",
    moveObjective: "Mueve tu {piece} a {target}",
    pieceHint: {
      rook: "♜ Líneas rectas",
      bishop: "♝ Movimientos diagonales",
      knight: "♞ Saltos en L",
      pawn: "♟ Avanza + captura diagonal",
      queen: "♛ Cualquier dirección, cualquier distancia",
      king: "♚ Una casilla, cualquier dirección",
    },
    captureHintCompact: "♜ Captura el objetivo",
    closeLabel: "Cerrar",
    visibleMissionTargetFormat: "Mover a {target}",
    captureLabel: "Captura",
    openDetailsLabyrinthAriaFormat:
      "Abrir detalles de misión — ruta óptima {moves} movimientos",
    openDetailsCaptureAriaLabel: "Abrir detalles de misión — capturar objetivo",
    openDetailsTargetAriaFormat: "Abrir detalles de misión — objetivo {target}",
  },
  EXERCISE_DRAWER_COPY: {
    title: "Ejercicios",
    progressLabel: "{earned}/{max}",
    badgeThresholdHint: "Insignia a las {threshold} estrellas",
    locked: "Bloqueado",
    ariaLabel: "Ejercicios",
    closeAriaLabel: "Cerrar ejercicios",
    exerciseFallbackFormat: "Ejercicio {n}",
    captureLabel: "Captura",
    movementLabel: "Movimiento",
    starsEarnedAriaFormat: "{total} de {max} estrellas obtenidas",
  },
  LABYRINTH_COPY: {
    toggleExercises: "Ejercicios",
    toggleLabyrinths: "Laberintos",
    tryLabyrinth: "Probar Laberinto",
    orTryLabyrinth: "o prueba Laberinto →",
    missionTitle: "Laberinto",
    missionHint: "Alcanza la estrella · óptimo {optimal} movimientos",
    movesLabel: "{n, plural, =1 {# movimiento} other {# movimientos}}",
    completeTitle: "¡Laberinto Resuelto!",
    completeStars: "{stars}/3 ★",
    completeMovesOptimalFormat: "¡Óptimo! {moves} movimientos",
    completeMovesFormat: "{moves} movimientos · óptimo {optimal}",
    perfectPath: "★ Camino perfecto",
    newBestFormat: "¡Nuevo récord! Vence {previous} → {current}",
    firstCompletionFormat: "Primera completación · {moves} movimientos",
    yourBestFormat: "Tu mejor: {previous} movimientos",
    retry: "Reintentar",
    back: "Volver a Ejercicios",
    layerToggleAriaLabel: "Alternar capa",
  },
  SHOP_ITEM_COPY: {
    founderBadge: {
      label: "Insignia Fundador",
      subtitle: "Apoyo desde el día uno. Tuya para siempre.",
    },
    retryShield: {
      label: "Escudo de Racha",
      subtitle: "Reintenta sin perder tu racha.",
    },
    coachPack: {
      label: "Créditos de Coach",
      subtitle: "Prueba el análisis IA, sin suscripción.",
    },
    coachPack5: {
      label: "5 Créditos de Coach",
      subtitle: "5 análisis de partidas con Luz.",
    },
    coachPack20: {
      label: "20 Créditos de Coach",
      subtitle: "20 análisis de partidas con Luz. Mejor valor.",
    },
    pro: {
      label: "Chesscito PRO",
      subtitle: "Análisis de Coach ilimitados · pase de 30 días.",
    },
  },
  HUB_V2_SPLASH_COPY: {
    title: "Bienvenido",
    tagline: "Pequeñas jugadas. Grandes hábitos mentales.",
    dismissHint: "Toca en cualquier lugar para comenzar",
    ariaLabel: "Pantalla de bienvenida",
    ariaTitleId: "splash-title",
  },
  HUB_V2_MASTERY_COPY: {
    rook: {
      label: "Torre",
      subLocked: "Domina para desbloquear",
      subInProgress: "{current}/{total}",
      subMastered: "★★★",
      subComingSoon: "Próximamente",
      ariaLabel:
        "{state, select, mastered {Torre dominada, tres estrellas} inProgress {Torre en progreso, {current} de {total} estrellas} lockedBuildable {Torre — empieza a practicar para ganar estrellas} other {Torre — próximamente}}",
    },
    bishop: {
      label: "Alfil",
      subLocked: "Domina para desbloquear",
      subInProgress: "{current}/{total}",
      subMastered: "★★★",
      subComingSoon: "Próximamente",
      ariaLabel:
        "{state, select, mastered {Alfil dominado, tres estrellas} inProgress {Alfil en progreso, {current} de {total} estrellas} lockedBuildable {Alfil — empieza a practicar para ganar estrellas} other {Alfil — próximamente}}",
    },
    knight: {
      label: "Caballo",
      subLocked: "Domina para desbloquear",
      subInProgress: "{current}/{total}",
      subMastered: "★★★",
      subComingSoon: "Próximamente",
      ariaLabel:
        "{state, select, mastered {Caballo dominado, tres estrellas} inProgress {Caballo en progreso, {current} de {total} estrellas} lockedBuildable {Caballo — empieza a practicar para ganar estrellas} other {Caballo — próximamente}}",
    },
    pawn: {
      label: "Peón",
      subLocked: "Domina para desbloquear",
      subInProgress: "{current}/{total}",
      subMastered: "★★★",
      subComingSoon: "Próximamente",
      ariaLabel:
        "{state, select, mastered {Peón dominado, tres estrellas} inProgress {Peón en progreso, {current} de {total} estrellas} lockedBuildable {Peón — empieza a practicar para ganar estrellas} other {Peón — próximamente}}",
    },
    queen: {
      label: "Reina",
      subLocked: "Domina para desbloquear",
      subInProgress: "{current}/{total}",
      subMastered: "★★★",
      subComingSoon: "Próximamente",
      ariaLabel:
        "{state, select, mastered {Reina dominada, tres estrellas} inProgress {Reina en progreso, {current} de {total} estrellas} lockedBuildable {Reina — empieza a practicar para ganar estrellas} other {Reina — próximamente}}",
    },
    king: {
      label: "Rey",
      subLocked: "Domina para desbloquear",
      subInProgress: "{current}/{total}",
      subMastered: "★★★",
      subComingSoon: "Próximamente",
      ariaLabel:
        "{state, select, mastered {Rey dominado, tres estrellas} inProgress {Rey en progreso, {current} de {total} estrellas} lockedBuildable {Rey — empieza a practicar para ganar estrellas} other {Rey — próximamente}}",
    },
    streakLabel:
      "{days, plural, =0 {} =1 {Racha de 1 día} other {Racha de # días}}",
    masteryDashboardAriaLabel: "Maestrías de piezas",
  },
  HUB_V2_TRAINING_COPY: {
    active: {
      kicker: "Pase de entrenamiento",
      daysFormat: "{d}d",
      sessionsFormat: "Sesiones: {used}/{total}",
      renewsFormat: "Renueva {mmdd}",
      ariaLabel:
        "Pase de entrenamiento activo, {d} días restantes, {used} de {total} sesiones usadas",
    },
    inactive: {
      title: "Desbloquea Coach + Premium",
      priceLabel: "$1.99 / 30 días",
      perks: [
        "Análisis de Coach diarios",
        "12 sesiones de Arena",
        "HUD premium",
      ],
      cta: "Ver plan",
      ariaLabel: "Pase de entrenamiento — $1.99 por 30 días, ver plan",
    },
  },
  HUB_ACTION_RAIL_COPY: {
    dailyLabel: "Diario",
    mateLabel: "Mate",
    coachLabel: "Coach",
    proDiscoveryTitle: "PRO",
    proDiscoverySubtitle: "Desbloquea la experiencia completa",
    proDiscoveryAriaLabel:
      "Desbloquea PRO — experiencia completa.",
    arenaUnlockedAriaFormat: "Entrenamiento especial: {name}",
    arenaLockedAriaFormat: "{name} — bloqueado",
    dailyCompletedAriaFormat: "Táctica Diaria completada. Nueva en {hours}h.",
    dailyPlayAriaFormat: "Juega la Táctica Diaria de hoy. {name}.",
  },
  SECONDARY_CTA_COPY: {
    arena: {
      label: "Entrar a Arena",
      ariaLabel: "Entrar a Arena — ajedrez completo vs IA",
    },
  },
  SETTINGS_STUB_COPY: {
    title: "Ajustes",
    comingSoonTooltip: "Próximamente",
    versionChipLabel: "Build {sha}",
    themeToggleLabel: "Tema",
    hapticsToggleLabel: "Hápticas",
    languageToggleLabel: "Idioma",
    closeAriaLabel: "Cerrar ajustes",
  },
  HUB_SCAFFOLD_COPY: {
    rootAriaLabel: "Hub de Chesscito",
    premiumKicker: "Pase de entrenamiento",
    premiumInactiveLabel: "Hazte PRO",
    playLabel: "ENTRAR A ARENA",
    playAriaLabel: "Entrar a la Arena",
    premiumInactiveAriaLabel: "Pase de entrenamiento — toca para desbloquear",
    premiumActiveAriaFormat:
      "Pase de entrenamiento — {used} de {total} sesiones usadas, {days} días restantes",
  },
  HUB_RAIL_COPY: {
    ...en.HUB_RAIL_COPY,
    learnLabel: "APRENDE",
    unlockLabel: "DESBLOQUEA",
  },
  HUD_COPY: {
    ...en.HUD_COPY,
    trophiesLabel: "Trofeos",
    trophiesAriaLabel: "Trofeos: {count}",
    proLabel: "PRO",
    proRemainingFormat: "{days}d",
    proAriaLabel:
      "{days, plural, =1 {PRO activo, 1 día restante} other {PRO activo, # días restantes}}",
    proInactiveAriaLabel: "PRO inactivo — toca para saber más",
    connectLabel: "Conectar",
    connectAriaLabel: "Conecta tu wallet para ver tus stats",
    coachLabel: "Coach",
    coachAriaLabel: "Abrir historial de sesiones del Coach",
    streakLabel: "Racha",
    streakFormat: "{days, plural, =1 {Racha de 1 día} other {Racha de # días}}",
    streakAriaLabel:
      "{days, plural, =1 {Racha: 1 día} other {Racha: # días}}",
    starsLabel: "Estrellas",
    starsFormat: "{current}/{total}",
    starsAriaLabel: "Estrellas: {current} de {total}",
    shieldsLabel: "Escudos",
    shieldsFormat: "Escudo ×{count}",
    shieldsAriaLabel:
      "{count, plural, =1 {1 escudo de racha disponible} other {# escudos de racha disponibles}}",
    secondaryRowAriaLabel: "Recursos del jugador",
    practiceLinkLabel: "ENTRENAR PIEZAS",
    practiceLinkAriaLabel: "Practica piezas de ajedrez individualmente",
  },
  ABOUT_LINK_COPY: {
    label: "Acerca de Chesscito",
  },
  CONNECT_BUTTON_COPY: {
    miniPayDetected: "MiniPay detectado",
    openInMiniPay: "Abrir en MiniPay",
  },
  DAILY_BADGE_COPY: {
    label: "Diario listo",
    ariaLabel: "La táctica del día está lista — toca para jugar",
  },
  DIFFICULTY_LABELS: {
    1: "Fácil",
    2: "Medio",
    3: "Difícil",
  },
  DOCK_LABELS: {
    home: "Inicio",
    pieces: "Piezas",
    shop: "Tienda",
    board: "Tablero",
    settings: "Ajustes",
    arena: "Arena",
    badge: "Insignias",
    trophies: "Trofeos",
    leaderboard: "Líderes",
    navAriaLabel: "Navegación del juego",
  },
  ERROR_PAGE_COPY: {
    title: "Algo salió mal",
    fallback: "Ocurrió un error inesperado.",
    tryAgain: "Reintentar",
    boardCrashed: "¡Ups! El tablero falló",
    gameFallback: "Algo salió mal al cargar el juego.",
    reloadGame: "Recargar juego",
  },
  EXERCISE_DESCRIPTIONS: {
    "rook-1": "Movimiento horizontal",
    "rook-2": "Movimiento vertical",
    "rook-3": "Del centro al borde",
    "rook-4": "Captura en esquina",
    "rook-5": "Captura cruzada",
    "bishop-1": "Diagonal principal",
    "bishop-2": "Antidiagonal",
    "bishop-3": "Diagonal corta",
    "bishop-4": "Ruta en dos jugadas",
    "bishop-5": "Ruta complicada",
    "knight-1": "Salto en L al centro",
    "knight-2": "Salto en L a la esquina",
    "knight-3": "L horizontal",
    "knight-4": "Dos saltos",
    "knight-5": "Travesía larga",
    "pawn-1": "Avance simple",
    "pawn-2": "Avance largo",
    "pawn-3": "Captura diagonal",
    "pawn-4": "Decisión de captura",
    "pawn-5": "Ruta mixta",
    "queen-1": "Diagonal larga",
    "queen-2": "Columna vertical",
    "queen-3": "Diagonal corta",
    "queen-4": "Fila horizontal",
    "queen-5": "Ruta en dos jugadas",
  },
  HUB_V2_DOCK_COPY: {
    playLabel: "ARENA",
    playAriaLabel: "Entrar a la Arena y jugar una partida completa",
    practiceLinkLabel: "PIEZAS",
    practiceLinkAriaLabel: "Practica piezas de ajedrez individualmente",
    trophiesLinkLabel: "TROFEOS",
    trophiesLinkAriaLabel: "Ver todos los trofeos",
    primaryActionsAriaLabel: "Acciones principales",
  },
  INVITE_COPY: {
    button: "Invitar",
    text: "¡Ven a aprender ajedrez conmigo en Chesscito!",
    url: "https://chesscito.com",
    copied: "¡Enlace copiado!",
  },
  LEADERBOARD_COPY: {
    description: "Los mejores puntajes registrados públicamente.",
    empty: "Aún no hay puntajes registrados.",
  },
  LEADERBOARD_TABS_COPY: {
    tabs: {
      puzzlesWeek: "Tácticas de la semana",
      arenaWins: "Victorias en Arena",
    },
  },
  MISSION_RIBBON_COPY: {
    hub: "Pequeñas jugadas. Grandes hábitos mentales.",
    arena: "Tu entrenamiento continúa, jugada por jugada.",
    "pro-sheet":
      "Tu plan de entrenamiento. Tu forma de mantener Chesscito libre para todos.",
    "landing-cta-bar": "Pequeñas jugadas. Grandes hábitos mentales.",
    exercises: "Observa la pieza. Muévela.",
    ariaLabel: "Mensaje de misión",
  },
  PASSPORT_COPY: {
    verifiedLabel: "Verificado",
    infoBanner: "Verifica para registrar tu puntaje",
    ctaLabel: "Verificar",
    passportUrl: "https://passport.gitcoin.co",
  },
  PRACTICE_COPY: {
    label: "Modo práctica",
  },
  PRO_DROP_COPY: {
    current: "Knight's Tour",
    activeLabel: "PRO · {puzzle} — resuelve el tablero",
    inactiveLabel: "Desbloquea {puzzle} + puzzles mensuales",
  },
  PURCHASE_FIELD_LABELS: {
    item: "Ítem",
    price: "Precio",
    payingWith: "Pagando con",
    status: "Estado",
    network: "Red",
  },
  SPLASH_COPY: {
    loading: "Cargando…",
    subtitle: "Preparando el tablero",
  },
  UNLOCK_COPY: {
    title: "¡Has desbloqueado {piece}!",
    cta: "Comenzar {piece}",
  },
  LANDING_COPY: {
    meta: {
      title: "Chesscito — Pequeñas jugadas. Grandes hábitos mentales.",
      description:
        "Chesscito convierte el ajedrez en retos visuales de pocos minutos para ejercitar atención, memoria, planificación y toma de decisiones desde edades tempranas.",
    },
    disclaimer:
      "Chesscito es una experiencia lúdica de acompañamiento cognitivo. No reemplaza diagnóstico, tratamiento médico ni terapia profesional.",
    nav: {
      brand: "Chesscito",
      primaryCta: "Empezar gratis",
    },
    hero: {
      eyebrow: "BIENESTAR COGNITIVO LÚDICO",
      headline: "Pequeñas jugadas. Grandes hábitos mentales.",
      subcopy:
        "Chesscito convierte el ajedrez en retos visuales de pocos minutos para ejercitar atención, memoria, planificación y toma de decisiones desde edades tempranas.",
      primaryCta: "Empezar gratis",
      secondaryCta: "Conocer la iniciativa",
    },
    problem: {
      title: "La mente también necesita rutina.",
      body:
        "Tienes rutina para tu cuerpo. Para tu sueño. Hasta para tu nutrición. Pero ¿una para tu mente? Atención, memoria, planificación y decisiones son habilidades. Como cualquier habilidad, se fortalecen con práctica constante.",
      claims: [
        {
          icon: "coach",
          label:
            "Se fortalecen con repetición consciente, no con esfuerzo bruto.",
        },
        {
          icon: "star",
          label: "Mientras antes empieces, más fácil es crear el hábito.",
        },
        {
          icon: "time",
          label: "10 minutos diarios pueden construir un hábito poderoso.",
        },
      ],
    },
    solution: {
      title: "Ajedrez antes del ajedrez.",
      body:
        "No necesitas saber jugar para empezar. En Chesscito conviertes cada pieza en retos cortos, visuales y guiados. Aprendes cómo se mueve, resuelves laberintos con ella, dominas su identidad. Cuando ya juntas todas las piezas, el ajedrez completo se desbloquea solo — sin acantilados, sin clases pesadas, sin frustración.",
    },
    howItWorks: {
      title: "Una escalera, no una pared.",
      body:
        "Cada pieza vive en tres niveles. Los dominas por etapas. El mapa avanza contigo, una pieza a la vez.",
      steps: [
        {
          label: "APRENDE",
          body: "La pieza se mueve así. Simple. Claro. Sin presión.",
        },
        {
          label: "EXPLORA",
          body: "Laberintos con obstáculos. Mínimos movimientos, máximo de estrellas.",
        },
        {
          label: "DOMINA",
          body: "Un reto único por pieza que exprime su identidad.",
        },
        {
          label: "COMBINA",
          body: "Torres y alfiles. Después la dama. Después el caballo. El tablero crece contigo.",
        },
        {
          label: "JUEGA",
          body: "El ajedrez completo se desbloquea solo. Lo lograste tú, paso a paso.",
        },
      ],
    },
    capabilities: {
      title: "Cinco habilidades que te acompañan a lo largo del tiempo.",
      items: [
        {
          icon: "crosshair",
          label: "Atención sostenida",
          body: "Foco que aguanta los distractores.",
        },
        {
          icon: "star",
          label: "Memoria visual",
          body: "Leer y recordar el tablero como patrón.",
        },
        {
          icon: "move",
          label: "Planificación",
          body: "Pensar varios pasos antes de mover.",
        },
        {
          icon: "refresh",
          label: "Reconocimiento de patrones",
          body: "Ver lo familiar en lo nuevo.",
        },
        {
          icon: "crown",
          label: "Toma de decisiones",
          body: "Elegir bajo restricciones simples.",
        },
      ],
    },
    audiences: {
      title: "Hecho para empezar pronto. Útil a cualquier edad.",
      cards: [
        {
          title: "Niños y adolescentes (8–16)",
          body:
            "Una etapa clave para cultivar hábitos cognitivos que pueden acompañar a lo largo del tiempo.",
        },
        {
          title: "Familias",
          body:
            "Una rutina ligera para compartir minutos de juego, conversación y crecimiento personal — sin pantallazos infinitos.",
        },
        {
          title: "Educadores y comunidades",
          body:
            "Material lúdico que complementa actividades de aula, clubes y programas sociales. Sin instalación pesada, sin curva técnica.",
        },
      ],
    },
    plans: {
      title: "Un modelo donde nadie se queda fuera.",
      body:
        "Chesscito puede empezar gratis. Las familias, educadores y aliados ayudan a sostener y ampliar el acceso. Web3 hace que cada aporte sea trazable y útil.",
      tiers: [
        {
          name: "GRATUITO",
          tagline: "Para empezar.",
          bullets: [
            "Acceso al ajedrez introductorio",
            "Las primeras piezas con sus niveles",
            "Insignias de progreso verificables",
            "Leaderboard y comunidad pública",
          ],
          ctaLabel: "Empezar gratis",
          ctaKind: "internal",
        },
        {
          name: "CHESSCITO PRO",
          tagline: "Para sostener tu práctica.",
          priceLabel: "Desde $1.99/mes en stablecoin",
          featured: true,
          bullets: [
            "Coach con IA para analizar tus partidas",
            "Streak Shield incluido — sin compras adicionales",
            "Badge PRO visible en tu perfil",
            "Guarda tus victorias sin costo extra",
            "Tu aporte sostiene el acceso gratuito",
          ],
          ctaLabel: "Quiero acceso PRO",
          ctaKind: "mailto",
          ctaSubject: "Chesscito PRO — Quiero acceso",
        },
        {
          name: "FAMILIA",
          tagline: "Para entrenar juntos en casa.",
          badge: "Próximamente",
          bullets: [
            "Pensado para compartir minutos de juego en casa",
            "Sin publicidad, sin distractores",
            "Early access — tu interés nos ayuda a priorizar",
          ],
          ctaLabel: "Avísame cuando esté listo",
          ctaKind: "mailto",
          ctaSubject: "Plan Familia — Lista de espera",
        },
        {
          name: "EDUCADORES Y ALIADOS",
          tagline: "Para ampliar el acceso.",
          bullets: [
            "Licencias para aulas, clubes y programas",
            "Sponsor-a-player o sponsor-a-school",
            "Acompañamiento de un Maestro FIDE",
            "Trazabilidad pública de cada aporte",
          ],
          ctaLabel: "Conversemos",
          ctaKind: "mailto",
          ctaSubject: "Educadores y Aliados",
        },
      ],
      complement:
        "También puedes probar el coach con Coach Credits desde $0.05.",
    },
    impact: {
      title: "Construido para impacto.",
      body:
        "Cada partida deja huella. Cada aliado abre una puerta. Trazabilidad clara, comunidad creciente, propósito explícito.",
      pillars: [
        {
          icon: "share",
          title: "Trazabilidad",
          body: "Cada badge y aporte queda registrado de forma transparente. Pública. Verificable. Sin opacidad.",
        },
        {
          icon: "trophy",
          title: "Escala",
          body: "El motor pedagógico es reutilizable. Detrás de Chesscito vienen otros verticales cognitivos.",
        },
        {
          icon: "crown",
          title: "Comunidad",
          body: "DAOs, fundaciones, clubes, escuelas. El círculo crece con cada alianza.",
        },
      ],
      alliesPlaceholder: "Próximamente.",
    },
    founders: {
      title: "La gente detrás de Chesscito.",
      lead:
        "Una combinación poco común: tecnología, IA y un Maestro FIDE con décadas de aula. La metodología detrás de Chesscito viene de más de 100 estudiantes acompañados — incluyendo alumnos que compitieron en torneos nacionales e internacionales.",
      cards: [
        {
          name: "Luis Fernando Ushiña",
          handle: "aka Wolfcito",
          title: "Software Developer Architect · Co-Founder Chesscito",
          body: "Lidera producto, tecnología y la visión de plataforma cognitiva escalable.",
        },
        {
          name: "César Litvinov Alarcón",
          handle: null,
          title: "Maestro FIDE · Entrenador · Co-Founder Chesscito",
          body: "Trayectoria en escuelas e instituciones, incluyendo Concentración Deportiva de Pichincha en Ecuador. Aporta la pedagogía y la metodología de cada nivel.",
        },
        {
          name: "Den Labs",
          handle: null,
          title: "Parent brand",
          body: "Laboratorio que combina web2, web3 e IA para construir experiencias digitales con propósito. Chesscito es su primer experimento.",
        },
      ],
    },
    finalCta: {
      headline: "¿Listo para tu primera jugada?",
      subcopy:
        "Sin descargas. Sin registros largos. Solo el tablero, tú y tu próximo movimiento.",
      primaryCta: "Empezar gratis",
      secondaryCta: "Hablar con el equipo",
    },
    footer: {
      brand: "Chesscito · A Den Labs experiment",
      year: "© 2026 Den Labs",
    },
    microcopy: {
      loading: "Preparando…",
      error: "Vuelve a intentarlo",
      confirm: "Listo. Te escribiremos pronto.",
    },
  },
};

export default messages;
