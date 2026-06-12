"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import type { LottieComponentProps, LottieRefCurrentProps } from "lottie-react";
import type { DotLottieReactProps } from "@lottiefiles/dotlottie-react";

type JsonProps = {
  animationData: unknown;
  src?: never;
  loop?: boolean;
  speed?: number;
  className?: string;
};

type DotLottieProps = {
  animationData?: never;
  src: string;
  loop?: boolean;
  speed?: number;
  className?: string;
};

type Props = JsonProps | DotLottieProps;

/** Module-level cache: once a renderer chunk resolves, later mounts render
 *  it synchronously instead of flashing the placeholder again. */
let cachedDotLottie: ComponentType<DotLottieReactProps> | null = null;
let cachedLottieJson: ComponentType<LottieComponentProps> | null = null;

/**
 * Unified Lottie component supporting both formats:
 * - animationData={jsonObj}  → uses lottie-react (existing .json files)
 * - src="/animations/x.lottie" → uses dotlottie-react (.lottie compressed)
 *
 * Both renderer libraries are lazy-loaded on first mount: together they are
 * ~109KB gz (lottie-web + dotlottie), and no surface shows an animation at
 * first paint, so they must stay out of every route's first-load bundle.
 * The placeholder div carries `className` to reserve the layout box (CLS).
 */
export function LottieAnimation({ animationData, src, loop = true, speed = 1, className }: Props) {
  if (src) {
    return <DotLottieLazy src={src} loop={loop} speed={speed} className={className} />;
  }

  return <LottieJsonLazy animationData={animationData} loop={loop} speed={speed} className={className} />;
}

function DotLottieLazy({ src, loop, speed, className }: { src: string; loop: boolean; speed: number; className?: string }) {
  const [Renderer, setRenderer] = useState(() => cachedDotLottie);

  useEffect(() => {
    if (Renderer) return;
    let alive = true;
    import("@lottiefiles/dotlottie-react").then((mod) => {
      cachedDotLottie = mod.DotLottieReact;
      if (alive) setRenderer(() => mod.DotLottieReact);
    });
    return () => {
      alive = false;
    };
  }, [Renderer]);

  if (!Renderer) {
    return <div className={className} aria-hidden />;
  }

  return <Renderer src={src} loop={loop} speed={speed} autoplay className={className} />;
}

function LottieJsonLazy({ animationData, loop, speed, className }: { animationData: unknown; loop: boolean; speed: number; className?: string }) {
  const [Renderer, setRenderer] = useState(() => cachedLottieJson);

  useEffect(() => {
    if (Renderer) return;
    let alive = true;
    import("lottie-react").then((mod) => {
      cachedLottieJson = mod.default;
      if (alive) setRenderer(() => mod.default);
    });
    return () => {
      alive = false;
    };
  }, [Renderer]);

  if (!Renderer) {
    return <div className={className} aria-hidden />;
  }

  return <LottieJson Renderer={Renderer} animationData={animationData} loop={loop} speed={speed} className={className} />;
}

function LottieJson({
  Renderer,
  animationData,
  loop,
  speed,
  className,
}: {
  Renderer: ComponentType<LottieComponentProps>;
  animationData: unknown;
  loop: boolean;
  speed: number;
  className?: string;
}) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    if (lottieRef.current && speed !== 1) {
      lottieRef.current.setSpeed(speed);
    }
  }, [speed]);

  return (
    <Renderer
      lottieRef={lottieRef}
      animationData={animationData}
      loop={loop}
      className={className}
      rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
    />
  );
}
