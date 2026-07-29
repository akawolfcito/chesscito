import type { OnboardingMessages } from "./en";

/**
 * Real ES copy for the onboarding slides. Typed against `OnboardingMessages`
 * so it can never silently drift out of shape from the EN source. Branded
 * product names (Season Pass, Chesscito PRO, PRO, Coach, Shields) stay in
 * English; everything else is natural Spanish. No em/en-dashes per the
 * anti-AI-prose rule.
 *
 * ⚠️ Pendiente de revisión del founder en device (2026-07-29). Dos puntos
 * concretos: `slide1.welcomeTo` se eligió corto por espacio, sobre el
 * wordmark, y `slide4.support` es la línea más larga de las cuatro.
 */
const messages: OnboardingMessages = {
  onboarding: {
    progress: "{current} de {total}",
    nav: {
      previous: "Diapositiva anterior",
      next: "Diapositiva siguiente",
      regionLabel: "Diapositivas de bienvenida",
    },
    language: {
      label: "Idioma",
      switchTo: "Cambiar a {name}",
    },
    slide1: {
      welcomeTo: "Bienvenido a",
      titleAlt: "Chesscito",
      support: "Entrena tu mente.\nConstruye tu enfoque diario.",
      cta: "SIGUIENTE",
    },
    slide2: {
      // El arte dice APRENDE, no LEARN.
      titleAlt: "Aprende",
      support: "Construye tu enfoque,\nun día a la vez.",
      passLabel: "Season Pass de 21 días · $0.99",
      passBenefits:
        "Entrenamiento diario · Recompensas por progreso · 3 Shields de bienvenida",
      cta: "SIGUIENTE",
    },
    slide3: {
      // El arte dice JUEGA.
      titleAlt: "Juega",
      support: "Juega partidas completas.\nAprende de cada jugada.",
      proTitle: "PRO · $1.99 / 30 días",
      proBenefits: "Play completo · Coach ilimitado · Season Pass incluido",
      cta: "SIGUIENTE",
    },
    slide4: {
      // El arte dice ELIGE TU CAMINO.
      titleAlt: "Elige tu camino",
      support: "Empieza con entrenamiento o salta a una partida.",
      learnLabel: "Entrenar",
      playLabel: "Jugar",
      lastUsed: "Última vez",
      switchNote: "Puedes cambiar cuando quieras.",
    },
    legal: {
      privacy: "Privacidad",
      terms: "Términos",
      support: "Soporte",
    },
  },
};

export default messages;
