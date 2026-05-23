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
    comingSoonLabel: "PRONTO",
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
};

export default messages;
