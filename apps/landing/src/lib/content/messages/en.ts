const messages = {
  onboarding: {
    progress: "{current} / {total}",
    slide1: {
      welcomeTo: "Welcome to",
      headline: "Turn chess into your daily focus ritual.",
      support: "Train your mind, build consistency, and grow one move at a time.",
      learnPill: "Learn",
      playPill: "Play",
      cta: "START",
    },
    slide2: {
      headline: "Build a daily chess habit.",
      support: "Train every day and unlock your reward path.",
      passportLabel: "Focus Passport",
      passportSub: "21 focus days",
      seasonPassLabel: "Season Pass",
      seasonPassPrice: "$0.99",
      footnote: "Season Pass unlocks the reward path. PRO includes Season Pass.",
      cta: "NEXT",
    },
    slide3: {
      headline: "Play free. Upgrade for Coach PRO.",
      support: "Play matches, save progress, and improve with Coach PRO.",
      savedGamesPill: "Saved games",
      coachProPill: "Coach PRO",
      proPill: "PRO $1.99 includes Season Pass.",
      cta: "NEXT",
    },
    slide4: {
      headline: "Learn the pieces first",
      support: "Play chess when you're ready.",
      learnDescription: "Build your daily chess habit.",
      startLearning: "Learn Pieces",
      jumpToPlay: "Already know chess? Jump to Play",
    },
    welcomeBack: {
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
