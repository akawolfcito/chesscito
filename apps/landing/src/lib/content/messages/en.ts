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
      headline: "Choose your path",
      support: "Start simple and continue your way.",
      startLearning: "Learn Pieces",
      enterArena: "Play",
      seasonPassLabel: "Season Pass",
      seasonPassPrice: "$0.99",
      seasonPassDescription: "Unlock daily rewards and premium benefits.",
      proLabel: "PRO Subscription",
      proPrice: "$1.99 include Season Pass",
      proDescription: "All PRO features plus Season Pass.",
      footnote: "Train pieces first, then enter the arena.",
      notSureLink: "Not sure? See other modes",
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
