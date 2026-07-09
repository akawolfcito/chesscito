import type { OnboardingMessages } from "./en";

/**
 * Real ES copy for the onboarding slides. Typed against
 * `OnboardingMessages` so it can never silently drift out of shape
 * from the EN source. Branded product names (Season Pass, Coach PRO,
 * PRO, Focus Passport) stay in English; everything else is natural
 * Spanish. No em/en-dashes per the anti-AI-prose rule.
 */
const messages: OnboardingMessages = {
  onboarding: {
    progress: "{current} / {total}",
    slide1: {
      welcomeTo: "Bienvenido a",
      headline: "Convierte el ajedrez en tu ritual diario de enfoque.",
      support: "Entrena tu mente, gana constancia y crece jugada a jugada.",
      learnPill: "Aprende",
      playPill: "Juega",
      cta: "EMPEZAR",
    },
    slide2: {
      headline: "Crea un hábito diario de ajedrez.",
      support: "Entrena cada día y desbloquea tu camino de recompensas.",
      passportLabel: "Focus Passport",
      passportSub: "21 días de enfoque",
      seasonPassLabel: "Season Pass",
      seasonPassPrice: "$0.99",
      footnote: "El Season Pass desbloquea el camino de recompensas. PRO incluye Season Pass.",
      cta: "SIGUIENTE",
    },
    slide3: {
      headline: "Juega gratis. Mejora con Coach PRO.",
      support: "Juega partidas, guarda tu progreso y mejora con Coach PRO.",
      savedGamesPill: "Partidas guardadas",
      coachProPill: "Coach PRO",
      proPill: "PRO $1.99 incluye Season Pass.",
      cta: "SIGUIENTE",
    },
    slide4: {
      headline: "Elige tu camino",
      support: "Empieza a aprender o salta a jugar.",
      startLearning: "Aprende las piezas",
      enterArena: "Juega ajedrez",
      learnDescription: "Crea tu hábito diario de ajedrez.",
      playDescription: "Juega gratis. Mejora con el Coach.",
      seasonPassLabel: "Season Pass",
      seasonPassPrice: "$0.99",
      proLabel: "PRO",
      proPrice: "$1.99",
      notSureLink: "¿No sabes cuál? Ver otros modos",
    },
    welcomeBack: {
      cta: "EMPEZAR",
      notSureLink: "¿No sabes cuál? Ver otros modos",
    },
    legal: {
      privacy: "Privacidad",
      terms: "Términos",
      support: "Soporte",
    },
  },
};

export default messages;
