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

/**
 * `headlineClassName` exists so slides 2 and 3 can opt their headline into
 * `.fantasy-title` (Rowdies). Slide 1's headline stays on the body face —
 * it already sits under the Rowdies "Welcome to" and the CHESSCITO
 * wordmark, and a third display face there is noise.
 */
function Heading({
  headline,
  support,
  headlineClassName = '',
}: {
  headline: string
  support: string
  headlineClassName?: string
}) {
  return (
    <>
      <h1 className={`text-sm font-extrabold text-[#3a2600] ${headlineClassName}`}>
        {headline}
      </h1>
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
        className="relative top-9 w-48"
      />
      <div className="-mt-4 flex flex-col items-center z-10">
        <span className="fantasy-title text-xl font-extrabold text-[#3a2600]">
          {t('welcomeTo')}
        </span>
        <ArtImage
          src={assets.titleSrc}
          alt="Chesscito"
          className="h-12 w-auto -mt-3"
        />
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
      <AvatarWithFade src={assets.avatarSrc} alt="" className="w-56 mt-9" />
      <ArtImage
        src={assets.titleSrc}
        alt="21-Day Mind Challenge"
        className="h-16 w-full -mt-14 z-10"
      />
      <Heading
        headline={t('headline')}
        support={t('support')}
        headlineClassName="fantasy-title"
      />
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
      <Heading
        headline={t('headline')}
        support={t('support')}
        headlineClassName="fantasy-title"
      />
      <div className="flex w-full gap-3 justify-center">
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

function ModeCard({
  tone,
  artSrc,
  title,
  description,
  priceIconSrc,
  priceLabel,
  price,
  href,
  ctaClassName,
}: {
  tone: 'learn' | 'play'
  artSrc: string
  title: string
  description: string
  priceIconSrc: string
  priceLabel: string
  price: string
  href: string
  ctaClassName: string
}) {
  return (
    <div className={`slide4-mode-card slide4-mode-card--${tone}`}>
      <ArtImage src={artSrc} alt="" className="slide4-mode-card-art h-16" />
      <div className="slide4-mode-card-body">
        <h2 className="fantasy-title text-base font-extrabold leading-tight text-[#3a2600]">
          {title}
        </h2>
        <p className="text-[0.68rem] leading-snug text-[#5a4520]">
          {description}
        </p>
        <div className="candy-tray-pill hub-hud-pill">
          <span className="candy-tray-pill-icon--floating">
            <ArtImage src={priceIconSrc} alt="" />
          </span>
          <span className="text-[0.62rem]">
            {priceLabel}{' '}
            <span className="font-bold text-[#3b9404]">{price}</span>
          </span>
        </div>
        <a
          href={href}
          className={`primary-play-cta primary-play-cta--playhub ${ctaClassName}`}
        >
          <span className="primary-play-cta-label">{title}</span>
        </a>
      </div>
    </div>
  )
}

export function Slide4Body() {
  const t = useTranslations('onboarding.slide4')
  const assets = SLIDE_ASSETS[3]
  return (
    /* `mt-10` is load-bearing. SlideShell's content box starts at the frame
       PNG's own top edge, which is where its crown and ornate border are
       drawn — slides 1-3 hide that by leading with a fade-masked avatar,
       but text placed there collides with the crown. The margin drops the
       header into the flat cream area. `px-2` keeps the header and cards
       off the frame's inner gold bevel, which SlideShell's own px-[9%]
       lands right on. */
    <div className="mt-10 flex w-full flex-col items-center gap-2 px-2">
      {/* The only slide whose heading is not centered: the two cards below
          are left-aligned rows, so a centered title would float free of
          them. The wolf tucks into the right gutter the title leaves. */}
      <div className="flex w-full items-start gap-1 text-left">
        <div className="flex flex-1 flex-col">
          <h1 className="fantasy-title mt-8 text-lg font-extrabold leading-tight text-[#3a2600]">
            {t('headline')}
          </h1>
          <p className="text-xs text-[#5a4520]">{t('support')}</p>
        </div>
        <AvatarWithFade src={assets.avatarSrc} alt="" className="-mt-2 w-20" />
      </div>
      <Divider />
      <ModeCard
        tone="learn"
        artSrc={ICONS.learn}
        title={t('startLearning')}
        description={t('learnDescription')}
        priceIconSrc={ICONS.seasonPass}
        priceLabel={t('seasonPassLabel')}
        price={t('seasonPassPrice')}
        href="/api/enter?mode=learn"
        ctaClassName="hub-scaffold-practice-cta"
      />
      <ModeCard
        tone="play"
        artSrc={ICONS.play}
        title={t('enterArena')}
        description={t('playDescription')}
        priceIconSrc={ICONS.pro}
        priceLabel={t('proLabel')}
        price={t('proPrice')}
        href="/api/enter?mode=play"
        ctaClassName="hub-scaffold-arena-cta"
      />
    </div>
  )
}
