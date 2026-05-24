/**
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
 *
 * See: docs/superpowers/specs/2026-05-23-i18n-es-en-design.md
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
  },
  HUD_COPY: {
    ...en.HUD_COPY,
    proRemainingFormat: "{days}d",
  },
  PRO_COPY: {
    ...en.PRO_COPY,
    label: "Chesscito PRO",
    kicker: "Pase de entrenamiento",
    tagline:
      "Tu plan de entrenamiento. Tu forma de mantener Chesscito libre para todos.",
    subtitle:
      "Pase mensual que sostiene el acceso abierto. Renueva cuando quieras — sin cobros automáticos.",
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
        chips: ["Errores", "Tips", "Historial"],
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
      "Tu aporte mantiene a Chesscito libre para nuevos jugadores",
    ],
    errors: {
      notConfigured: "PRO aún no está activo. Vuelve a intentarlo pronto.",
      purchaseFailed:
        "No se pudo verificar la compra. Intenta de nuevo.",
      walletRequired: "Conecta tu wallet para comprar PRO.",
      verifyFailedTitle: "Pago confirmado — verificación pendiente.",
      verifyFailedReassurance:
        "Tu transacción quedó registrada en la cadena. Reintentar no genera doble cobro.",
      retryVerifyCta: "Reintentar verificación",
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
    creditTitle: "Créditos del Coach",
    creditExplain: "1 crédito = 1 análisis completo",
    creditPack5: "5 análisis",
    creditPack20: "20 análisis",
    creditBest: "MEJOR",
    buyWithUsdc: "Comprar con stablecoin",
    orQuickReview: "ANÁLISIS",
    getFullAnalysis: "ANÁLISIS PRO",
    getFullAnalysisSub: "Mira tus momentos clave y consejos personalizados",
    analyzing: "Analizando tu partida",
    reviewingMoves: "Revisando tus jugadas",
    canLeave: "Puedes salir — guardamos tu resultado",
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
      "Puedes salir — tu resultado estará listo cuando regreses.",
    creditPackSubtitle: "{count} análisis de partidas",
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
      errorToast: "No se pudo eliminar — intenta de nuevo",
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
        "Abrir análisis {typeLabel} del Coach — {result}, {difficulty}, {moves} jugadas",
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
      "Acción secundaria — Reclamar Victoria arriba es la acción principal.",
    offlineToAnalyze: "Necesitas estar en línea para analizar",
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
    claimed: "Reclamada",
    readyToClaim: "Lista para reclamar",
    ready: "Listo",
    claimBadgeFirst: "Reclama la insignia primero",
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
      "¡Gané la insignia Ascendente de {piece} en Chesscito! {stars}/15 estrellas — permanente en cadena.",
    score:
      "¡Acabo de fijar mi puntaje de Chesscito en cadena! {stars}/15 estrellas — registrado para siempre.",
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
    kicker: "Insignia desbloqueada",
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
  VICTORY_CLAIM_COPY: {
    ...en.VICTORY_CLAIM_COPY,
    challengeText:
      "Resolví esto en {moves} movimientos. ¿Puedes superarme?\nJuega Chesscito en Celo 👉 {url}",
  },
  TROPHY_VITRINE_COPY: {
    pageTitle: "TROFEOS",
    pageDescription: "Tus victorias guardadas.",
    myVictories: "Mis victorias",
    hallOfFame: "Salón de la fama",
    movesLabel: "movimientos",
    shareLabel: "Compartir",
    loadingText: "Cargando trofeos...",
    copiedToast: "¡Link copiado!",
    connectWallet: "Conecta para ver tus trofeos",
    connectWalletButton: "Conectar billetera",
    noVictories: "Aún sin victorias",
    noGlobalVictories: "Aún no hay victorias registradas",
    loadError: "No se pudieron cargar las victorias",
    tapToRetry: "Tocá para reintentar",
    configError: "Trofeos sin conexión",
    roadmap: "Próximamente: Torneos • Pases VIP • Recompensas de temporada",
    arenaLink: "ARENA",
    cardIdPrefix: "Victoria",
    backLabel: "Atrás",
    verifiableVictoryHeadline: "Victoria verificable",
    movesStatLabel: "Movimientos",
    timeStatLabel: "Tiempo",
    playerStatLabel: "Jugador",
    historyHeading: "Historial",
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
    sheetDescription: "Perfil, reclamos, estadísticas y billetera",
    closeLabel: "Cerrar perfil",
    editNameAria: "Editar nombre",
    tierAriaFormat: "Rango {title}, {xp} XP",
    pendingClaimsHeader: "Reclamos pendientes",
    generalStatsHeader: "Estadísticas generales",
    walletLabel: "Billetera",
    networkLabel: "Red",
    disconnect: "Desconectar billetera",
    manage: "Administrar",
    refreshAria: "Actualizar reclamos pendientes",
    statLabels: {
      piecesMastered: "Piezas dominadas",
      dailyStreak: "Racha diaria",
      puzzlesSolved: "Puzzles resueltos",
      arenaWins: "Victorias en Arena",
      trophies: "Trofeos",
      nftsMinted: "NFTs minteados",
    },
  },
  DISPLAY_NAME_COPY: {
    dialogTitle: "Elige tu nombre",
    placeholder: "Hasta 20 caracteres",
    save: "Guardar",
    cancel: "Cancelar",
    visitor: "Visitante",
  },
  CLAIM_COPY: {
    kinds: {
      badge: "Insignia {name}",
      score: "Guardar puntaje · {points} pts",
      victoryNft: "Mintea tu victoria · {difficulty}",
    },
    claimVerb: "Reclamar",
    costGasOnly: "Solo tarifa de red",
    costEstimateUsd: "~${amount}",
    inFlightLabel: "En curso — reconecta para verificar",
    refreshAria: "Actualizar",
    emptyAria: "Sin reclamos pendientes",
  },
  HOME_ANCHOR_COPY: {
    alt: "Reino de Chesscito — Wolfcito el mago con estatuas de piezas de ajedrez",
    attractHint: "Tu entrenamiento te espera en el reino",
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
};

export default messages;
