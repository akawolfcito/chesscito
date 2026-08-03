/**
 * Slides 2 and 3 are the only place the paid layer is ever explained. Neither
 * has a buy button, so neither converts: they plant one idea the visitor has
 * to recognize weeks later, when the paywall shows up in-game. One idea per
 * screen. A screen carrying four benefits leaves none behind.
 *
 * `titleAlt` is the accessible name of the slide's title ART, so it must say
 * what the picture says. The Spanish files carry different words (APRENDE,
 * JUEGA, ELIGE TU CAMINO), which is exactly why this is a translated key and
 * not a literal in the component.
 *
 * Support lines keep a real newline: the art is composed around a two-line
 * break and `whitespace-pre-line` renders it. A <br/> here would put markup
 * in the copy bundle.
 */
const messages = {
  onboarding: {
    progress: "{current} of {total}",
    nav: {
      previous: "Previous slide",
      next: "Next slide",
      regionLabel: "Onboarding slides",
    },
    language: {
      label: "Language",
      switchTo: "Switch to {name}",
    },
    slide1: {
      welcomeTo: "Welcome to",
      titleAlt: "Chesscito",
      support: "Train your mind.\nBuild your daily focus.",
      // NEXT on all three. The advance button never claims to start anything,
      // so the word keeps one meaning across the carousel.
      cta: "NEXT",
    },
    slide2: {
      titleAlt: "Learn",
      support: "Build your focus,\none day at a time.",
      // The price left this string when the pass became a banner: it now has
      // its own chip, the same one the Play Hub's CTA wears. Spelling it twice
      // read as two different prices.
      passLabel: "21-Day Season Pass",
      passBenefits: "Daily training · Progress rewards · 3 welcome Shields",
      passPrice: "$0.99",
      cta: "NEXT",
    },
    slide3: {
      titleAlt: "Play",
      support: "Play full games.\nLearn from every move.",
      // The price left the title for the corner badge — the same cue slide 2
      // uses. The DURATION stays: it is a term of the plan, not its price.
      proTitle: "PRO · 30 days",
      proBenefits: "Full Play · Unlimited Coach · Season Pass included",
      proPrice: "$1.99",
      cta: "NEXT",
    },
    slide4: {
      titleAlt: "Choose your path",
      support: "Start with training or jump into a game.",
      // Matches the in-app switch, which says Training, not Learn.
      learnLabel: "Training",
      playLabel: "Play",
      // States a fact rather than giving an order, so it survives the visitor
      // changing their mind without sounding like a contradiction.
      lastUsed: "Last used",
      switchNote: "You can switch anytime.",
    },
    legal: {
      privacy: "Privacy",
      terms: "Terms",
      support: "Support",
    },
  },
};

export default messages;
export type OnboardingMessages = typeof messages;
