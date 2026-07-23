/**
 * Slides 2 and 3 are the only place the paid layer is ever explained. The
 * onboarding cookie sends returning visitors straight to their stored mode via
 * `welcome-back.tsx`, so nobody sees this carousel twice. Neither slide has a
 * buy button, which means neither one converts: they plant a single idea the
 * visitor has to recognize weeks later, when the paywall shows up in-game.
 * One idea per screen. A screen carrying four benefits leaves none behind.
 */
const messages = {
  onboarding: {
    progress: "{current} / {total}",
    slide1: {
      welcomeTo: "Welcome to",
      headline: "Two ways into chess.",
      support: "Learn the pieces, or jump straight into a match.",
      learnPill: "Learn",
      // Short enough to hold one line beside a 1.9rem icon at 390px. Two
      // side-by-side pills leave each sublabel very little room, and a wrapped
      // sublabel is the first thing the eye catches as wrong.
      learnPillSub: "From zero",
      playPill: "Play",
      playPillSub: "Full matches",
      cta: "NEXT",
    },
    slide2: {
      // The surviving idea is decision making. Habit, focus, wellbeing and
      // scatter all lost the coin flip, on purpose.
      headline: "Decide better in 21 days.",
      support: "A daily habit that trains how you choose, on the board and off it.",
      passportLabel: "Focus Passport",
      passportSub: "21 focus days",
      price: "Season Pass, $0.99",
      cta: "NEXT",
    },
    slide3: {
      // The inclusion is the whole argument for PRO, so it is the headline.
      // It used to be the label of a gold pill.
      headline: "Chesscito PRO includes the Season Pass.",
      support: "Your games get reviewed, and the 21 Day Challenge comes with it.",
      savedGamesPill: "Saved games",
      coachReviewPill: "Coach review",
      price: "Chesscito PRO, $1.99",
      cta: "NEXT",
    },
    slide4: {
      headline: "Learn the pieces first",
      support: "Play chess when you're ready.",
      learnDescription: "Build your daily chess habit.",
      // NEXT, NEXT, NEXT, START. The advance button never claims to start
      // anything, so START keeps one meaning across the carousel and matches
      // the word `welcome-back.tsx` puts in the same spot.
      cta: "START",
      jumpToPlay: "Already know chess? Jump to Play",
    },
    welcomeBack: {
      // Its own headline. It used to borrow slide 1's, which forced one string
      // to greet a returning player and orient a stranger at the same time.
      headline: "Your board is waiting.",
      cta: "START",
      notSureLink: "Not sure? See other modes",
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
