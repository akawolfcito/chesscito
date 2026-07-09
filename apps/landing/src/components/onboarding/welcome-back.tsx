import { getTranslations } from "next-intl/server";
import { SlideShell } from "@/components/onboarding/slide-shell";
import { AvatarWithFade } from "@/components/onboarding/avatar-with-fade";
import { ArtImage } from "@/components/onboarding/art-image";
import { LegalFooter } from "@/components/onboarding/legal-footer";
import { SLIDE_ASSETS } from "@/lib/onboarding/slides";
import type { PreferredMode } from "@/lib/onboarding/types";

/**
 * Rendered server-side when the visitor already has a valid onboarding
 * cookie — no carousel, no progress counter, straight to their stored
 * destination. See docs/specs/landing-onboarding-slides.md Behavior #4.
 */
export async function WelcomeBack({ preferredMode }: { preferredMode: PreferredMode }) {
  const t = await getTranslations("onboarding");
  const assets = SLIDE_ASSETS[0];

  return (
    <SlideShell
      ctaSlot={
        <div className="flex w-full flex-col items-center gap-2">
          <a
            href={`/api/enter?mode=${preferredMode}`}
            className="primary-play-cta primary-play-cta--playhub hub-scaffold-practice-cta"
          >
            <span className="primary-play-cta-label">{t("welcomeBack.cta")}</span>
          </a>
          <a href="/classic" className="text-sm font-bold text-[#3a2600] underline">
            {t("welcomeBack.notSureLink")}
          </a>
        </div>
      }
      footer={
        <LegalFooter
          privacyLabel={t("legal.privacy")}
          termsLabel={t("legal.terms")}
          supportLabel={t("legal.support")}
        />
      }
    >
      {/* Larger than slide 1's `w-48`: this screen carries no pills, no support
          line and no divider, so the wolf gets the room they were using. */}
      <AvatarWithFade src={assets.avatarSrc} alt="" className="relative top-9 w-56" />
      <div className="-mt-4 flex flex-col items-center z-10">
        <span className="fantasy-title text-xl font-extrabold text-[#3a2600]">
          {t("slide1.welcomeTo")}
        </span>
        {/* `w-auto`, not `w-6/12`: ArtImage is object-contain, so a width cap
            narrower than the wordmark binds before the height does and the art
            never reaches its `h-12`. It rendered small, not stretched. */}
        <ArtImage src={assets.titleSrc} alt="Chesscito" className="h-12 w-auto -mt-3" />
      </div>
      {/* Its own key. Borrowing `slide1.headline` made one string greet a
          returning player and orient a stranger at the same time, and pinned
          slide 1's copy to this screen. */}
      <h1 className="fantasy-title mt-1 text-2xl font-extrabold text-[#3a2600]">
        {t("welcomeBack.headline")}
      </h1>
    </SlideShell>
  );
}
