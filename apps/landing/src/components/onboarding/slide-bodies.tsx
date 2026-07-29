import { useLocale, useTranslations } from 'next-intl'
import { ArtImage } from '@/components/onboarding/art-image'
import { Pill } from '@/components/onboarding/pill'
import { ProStrip } from '@/components/onboarding/pro-strip'
import { CandyIcon } from '@/components/redesign/candy-icon'
import type { Locale } from '@/i18n/routing'
import { ICONS, SLIDE_VISUALS } from '@/lib/onboarding/slides'
import type { SlideStep } from '@/lib/onboarding/types'

function Divider() {
  return (
    <div className="chesito-card-divider w-full" aria-hidden="true">
      <CandyIcon name="star" className="chesito-card-spark" />
    </div>
  )
}

/**
 * The slide's wordmark, as art. The FILE changes with the locale because the
 * Spanish pictures spell different words (APRENDE / JUEGA / ELIGE TU CAMINO),
 * and so does the `alt` — otherwise a screen reader in Spanish announces
 * "Learn" over a picture that reads APRENDE. Slide 1 is the exception by
 * design: one file, both locales.
 */
function SlideTitle({ step, alt }: { step: SlideStep; alt: string }) {
  const locale = useLocale() as Locale
  return (
    <div data-slide-title={step} className="w-full">
      <ArtImage
        src={SLIDE_VISUALS[step].titleSrc[locale]}
        alt={alt}
        className="mx-auto h-20 w-full"
      />
    </div>
  )
}

/** Support copy carries a real newline; `whitespace-pre-line` renders the
 *  break the art was composed around. */
function Support({ children }: { children: string }) {
  return <p className="onboarding-support">{children}</p>
}

export function Slide1Body() {
  const t = useTranslations('onboarding.slide1')
  return (
    <>
      <span className="onboarding-welcome-to">{t('welcomeTo')}</span>
      <SlideTitle step={1} alt={t('titleAlt')} />
      <Divider />
      <Support>{t('support')}</Support>
    </>
  )
}

export function Slide2Body() {
  const t = useTranslations('onboarding.slide2')
  return (
    <>
      <SlideTitle step={2} alt={t('titleAlt')} />
      <Divider />
      <Support>{t('support')}</Support>
      <Pill
        icon={<ArtImage src={ICONS.seasonPass} alt="" />}
        label={t('passLabel')}
        sublabel={t('passBenefits')}
      />
    </>
  )
}

export function Slide3Body() {
  const t = useTranslations('onboarding.slide3')
  return (
    <>
      <SlideTitle step={3} alt={t('titleAlt')} />
      <Divider />
      <Support>{t('support')}</Support>
      <ProStrip title={t('proTitle')} benefits={t('proBenefits')} />
    </>
  )
}

/**
 * The choice screen. Its control is NOT here — the mode switch lives in the
 * shell's `actionSlot`, at the same height the advance button occupied on the
 * three slides before it.
 */
export function Slide4Body() {
  const t = useTranslations('onboarding.slide4')
  return (
    <>
      <SlideTitle step={4} alt={t('titleAlt')} />
      <Divider />
      <Support>{t('support')}</Support>
    </>
  )
}
