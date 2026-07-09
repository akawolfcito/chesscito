/**
 * Non-translated visual contract for the 4 onboarding slides — asset
 * paths only. Translated copy lives in lib/content/messages/{locale}.ts
 * under the matching `onboarding.slideN` key.
 */

export const FRAME_SRC = "/art/landing-slides/bg-slides";
export const MOBILE_SCENE_SRC = "/art/bg-wallpaper-lite";
export const DESKTOP_SCENE_SRC = "/art/landing-slides/bg-slides-web";

export interface SlideAssets {
  step: 1 | 2 | 3 | 4;
  avatarSrc: string;
  titleSrc: string;
}

export const SLIDE_ASSETS: readonly SlideAssets[] = [
  {
    step: 1,
    avatarSrc: "/art/landing-slides/avatar-chesscito-welcome",
    titleSrc: "/art/landing-slides/chesscito-title",
  },
  {
    step: 2,
    avatarSrc: "/art/landing-slides/avatar-21-day-challenge",
    titleSrc: "/art/landing-slides/21-day-challente-title",
  },
  {
    step: 3,
    avatarSrc: "/art/landing-slides/avatar-play-chess",
    titleSrc: "/art/landing-slides/play-chess-title",
  },
  {
    step: 4,
    avatarSrc: "/art/landing-slides/avatar-choice",
    titleSrc: "",
  },
] as const;

export const ICONS = {
  learn: "/art/hub/train-pieces",
  play: "/art/redesign/banners/btn-battle",
  focusPassport: "/art/focus-passport/flame-color",
  seasonPass: "/art/landing-slides/season-pass-icon",
  savedGames: "/art/new-icons-chesscito/save",
  coachPro: "/art/new-assets-chesscito/btns/ask-coach-icon",
  pro: "/art/landing-slides/pro-suscription-icon",
  /** Same Hub asset used by hub-scaffold.tsx's Enter Arena CTA piece icon. */
  enterArenaPiece: "/art/hub/enter-arena",
} as const;
