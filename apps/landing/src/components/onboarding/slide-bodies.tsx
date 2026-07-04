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
      <p className="text-sm text-[#5a4520]">{support}</p>
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
        className="relative top-3"
      />
      <div className="-mt-3 flex flex-col items-center gap-0.5">
        <span className="text-sm font-extrabold text-[#3a2600]">
          {t('welcomeTo')}
        </span>
        <ArtImage src={assets.titleSrc} alt="Chesscito" className="h-14 w-6/12" />
      </div>
      <div className="-mt-2 flex flex-col items-center gap-2">
        <Heading headline={t('headline')} support={t('support')} />
      </div>
      <div className="flex w-full gap-3">
        <Pill
          icon={<ArtImage src={ICONS.learn} alt="" />}
          label={t('learnPill')}
        />
        <Pill
          icon={<ArtImage src={ICONS.play} alt="" />}
          label={t('playPill')}
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
      <AvatarWithFade src={assets.avatarSrc} alt="" />
      <ArtImage
        src={assets.titleSrc}
        alt="21-Day Mind Challenge"
        className="h-16 w-full"
      />
      <Heading headline={t('headline')} support={t('support')} />
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
      <p className="text-xs text-[#5a4520]">{t('footnote')}</p>
    </>
  )
}

export function Slide3Body() {
  const t = useTranslations('onboarding.slide3')
  const assets = SLIDE_ASSETS[2]
  return (
    <>
      <AvatarWithFade src={assets.avatarSrc} alt="" />
      <ArtImage
        src={assets.titleSrc}
        alt="Play Chess Arena"
        className="h-16 w-full"
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
        icon={<ArtImage src={ICONS.pro} alt="" />}
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
      <AvatarWithFade src={assets.avatarSrc} alt="" />
      <h1 className="text-2xl font-extrabold text-[#3a2600]">
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
        className="flex items-center justify-center gap-2 rounded-2xl bg-[#e0a021] px-6 py-4 text-lg font-extrabold text-white"
      >
        {t('startLearning')}
      </a>
      <a
        href="/api/enter?mode=play"
        className="flex items-center justify-center gap-2 rounded-2xl bg-[#2f6fe0] px-6 py-4 text-lg font-extrabold text-white"
      >
        {t('enterArena')}
      </a>
    </div>
  )
}
