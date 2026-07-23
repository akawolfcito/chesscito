import type { OnboardingMessages } from "./en";

/**
 * Real ES copy for the onboarding slides. Typed against
 * `OnboardingMessages` so it can never silently drift out of shape
 * from the EN source. Branded product names (Season Pass, Chesscito PRO,
 * PRO, Focus Passport, 21 Day Challenge) stay in English; everything else
 * is natural Spanish. No em/en-dashes per the anti-AI-prose rule.
 */
const messages: OnboardingMessages = {
  onboarding: {
    progress: "{current} / {total}",
    slide1: {
      welcomeTo: "Bienvenido a",
      headline: "Dos caminos hacia el ajedrez.",
      support: "Aprende las piezas, o entra directo a una partida.",
      learnPill: "Aprende",
      learnPillSub: "Desde cero",
      playPill: "Juega",
      playPillSub: "Partidas reales",
      cta: "SIGUIENTE",
    },
    slide2: {
      headline: "Decide mejor en 21 días.",
      support: "Un hábito diario que entrena cómo eliges, en el tablero y fuera de él.",
      passportLabel: "Focus Passport",
      passportSub: "21 días de enfoque",
      price: "Season Pass, $0.99",
      cta: "SIGUIENTE",
    },
    slide3: {
      headline: "Chesscito PRO incluye el Season Pass.",
      support: "Tus partidas se revisan, y el 21 Day Challenge viene incluido.",
      savedGamesPill: "Partidas guardadas",
      coachReviewPill: "Revisión del Coach",
      price: "Chesscito PRO, $1.99",
      cta: "SIGUIENTE",
    },
    slide4: {
      headline: "Aprende las piezas primero",
      support: "Juega ajedrez cuando estés listo.",
      learnDescription: "Crea tu hábito diario de ajedrez.",
      cta: "EMPEZAR",
      jumpToPlay: "¿Ya sabes jugar? Ve a Play",
    },
    welcomeBack: {
      headline: "Tu tablero te espera.",
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
