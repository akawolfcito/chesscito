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
      <AvatarWithFade src={assets.avatarSrc} alt="" className="relative top-3" />
      <div className="-mt-3 flex flex-col items-center gap-0.5">
        <span className="text-sm font-extrabold text-[#3a2600]">
          {t("slide1.welcomeTo")}
        </span>
        <ArtImage src={assets.titleSrc} alt="Chesscito" className="h-14 w-6/12" />
      </div>
      <h1 className="-mt-2 text-2xl font-extrabold text-[#3a2600]">{t("slide1.headline")}</h1>
    </SlideShell>
  );
}
