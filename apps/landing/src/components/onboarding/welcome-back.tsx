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
            className="w-full rounded-2xl bg-[#e0a021] px-6 py-4 text-center text-lg font-extrabold text-white"
          >
            {t("welcomeBack.cta")}
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
      <AvatarWithFade src={assets.avatarSrc} alt="" />
      <ArtImage src={assets.titleSrc} alt="Welcome to Chesscito" className="h-16 w-full" />
      <h1 className="text-2xl font-extrabold text-[#3a2600]">{t("slide1.headline")}</h1>
    </SlideShell>
  );
}
