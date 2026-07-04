import { useTranslations } from 'next-intl'
import { ArtImage } from '@/components/onboarding/art-image'
import { AvatarWithFade } from '@/components/onboarding/avatar-with-fade'
import { Pill } from '@/components/onboarding/pill'
import { CandyIcon } from '@/components/redesign/candy-icon'
import { ICONS, SLIDE_ASSETS } from '@/lib/onboarding/slides'

function Divider() {
  return (
    <div className="chesito-card-divider w-full" aria-hidden="true">
      <CandyIcon name="star" className="chesito-card-spark" />
    </div>
  )
}

function Heading({ headline, support }: { headline: string; support: string }) {
  return (
    <>
      <h1 className="text-sm font-extrabold text-[#3a2600]">{headline}</h1>
      <Divider />
      <p className="text-xs text-[#5a4520]">{support}</p>
    </>
  )
}

export function Slide1Body() {
  const t = useTranslations('onboarding.slide1')
  const assets = SLIDE_ASSETS[0]
  return (
    <>
      {/* `relative top-3` shifts the wolf down without pushing the rest of
          the stack (a margin/gap change on a flex child would displace
          siblings; `relative` offsets are purely visual). */}
      <AvatarWithFade
        src={assets.avatarSrc}
        alt=""
        className="relative top-9"
      />
      <div className="-mt-4 flex flex-col items-center z-10">
        <span className="text-xl font-extrabold text-[#3a2600]">
          {t('welcomeTo')}
        </span>
        <ArtImage src={assets.titleSrc} alt="Chesscito" className="h-12 w-auto -mt-3" />
      </div>
      <div className="-mt-1 flex flex-col items-center gap-2">
        <Heading headline={t('headline')} support={t('support')} />
      </div>
      <div className="flex w-full justify-center gap-3">
        <Pill
          icon={<ArtImage src={ICONS.learn} alt="" />}
          label={t('learnPill')}
          iconRem={2.3}
        />
        <Pill
          icon={<ArtImage src={ICONS.play} alt="" />}
          label={t('playPill')}
          iconRem={2.3}
        />
      </div>
    </>
  )
}

export function Slide2Body() {
  const t = useTranslations('onboarding.slide2')
  const assets = SLIDE_ASSETS[1]
  return (
    <>
      <AvatarWithFade src={assets.avatarSrc} alt="" className="w-52 mt-9" />
      <ArtImage
        src={assets.titleSrc}
        alt="21-Day Mind Challenge"
        className="h-16 w-full -mt-14 z-10"
      />
      <Heading headline={t('headline')} support={t('support')} />
      <div className="h-2 flex gap-2.5">
      <Pill
        icon={<ArtImage src={ICONS.focusPassport} alt="" />}
        label={t('passportLabel')}
        sublabel={t('passportSub')}
      />
      <Pill
        icon={<ArtImage src={ICONS.seasonPass} alt="" />}
        label={t('seasonPassLabel')}
        sublabel={t('seasonPassPrice')}
      />
      </div>
      <p className="text-xs text-[#5a4520] mt-6">{t('footnote')}</p>
    </>
  )
}

export function Slide3Body() {
  const t = useTranslations('onboarding.slide3')
  const assets = SLIDE_ASSETS[2]
  return (
    <>
      <AvatarWithFade src={assets.avatarSrc} alt="" className="w-52 mt-9" />
      <ArtImage
        src={assets.titleSrc}
        alt="Play Chess Arena"
        className="h-16 w-full -mt-16 z-10"
      />
      <Heading headline={t('headline')} support={t('support')} />
      <div className="flex w-full gap-3">
        <Pill
          icon={<ArtImage src={ICONS.savedGames} alt="" />}
          label={t('savedGamesPill')}
        />
        <Pill
          icon={<ArtImage src={ICONS.coachPro} alt="" />}
          label={t('coachProPill')}
        />
      </div>
      <Pill
        icon={<ArtImage src={ICONS.pro} alt="" className="w-8" />}
        label={t('proPill')}
        tone="gold"
      />
    </>
  )
}

export function Slide4Body() {
  const t = useTranslations('onboarding.slide4')
  const assets = SLIDE_ASSETS[3]
  return (
    <>
      <AvatarWithFade src={assets.avatarSrc} alt="" className="mt-9" />
      <h1 className="text-2xl font-extrabold text-[#3a2600] -mt-16 z-10">
        {t('headline')}
      </h1>
      <Divider />
      <p className="text-sm text-[#5a4520]">{t('support')}</p>

      {/* Sally's fix (slide 4 UX review): price info is a flat, de-emphasized
          footnote strip — no button bevel/shadow — so it reads as context,
          not a 3rd/4th competing action. The 2 real CTAs live outside the
          frame, in the same prominent slot the other slides give "NEXT". */}
      <div className="flex w-full items-center justify-between gap-2 rounded-xl bg-[#fbf1d6] px-4 py-2 text-xs text-[#5a4520]">
        <span>
          <ArtImage
            src={ICONS.seasonPass}
            alt=""
            className="mr-1 inline-block h-4 w-4"
          />
          {t('seasonPassLabel')} {t('seasonPassPrice')}
        </span>
        <span>
          <ArtImage
            src={ICONS.pro}
            alt=""
            className="mr-1 inline-block h-4 w-4"
          />
          {t('proLabel')} {t('proPrice')}
        </span>
      </div>

      <p className="text-xs text-[#5a4520]">{t('footnote')}</p>
    </>
  )
}

export function Slide4Ctas() {
  const t = useTranslations('onboarding.slide4')
  return (
    <div className="flex w-full flex-col gap-3">
      <a
        href="/api/enter?mode=learn"
        className="primary-play-cta primary-play-cta--playhub hub-scaffold-practice-cta"
      >
        <span className="primary-play-cta-label">{t('startLearning')}</span>
      </a>
      <a
        href="/api/enter?mode=play"
        className="primary-play-cta primary-play-cta--playhub hub-scaffold-arena-cta"
      >
        <span className="primary-play-cta-label">{t('enterArena')}</span>
      </a>
    </div>
  )
}
