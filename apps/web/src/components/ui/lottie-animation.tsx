"use client";

import { useEffect, useRef } from "react";
import Lottie from "lottie-react";
import type { LottieRefCurrentProps } from "lottie-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

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

/**
 * Unified Lottie component supporting both formats:
 * - animationData={jsonObj}  → uses lottie-react (existing .json files)
 * - src="/animations/x.lottie" → uses dotlottie-react (.lottie compressed)
 */
export function LottieAnimation({ animationData, src, loop = true, speed = 1, className }: Props) {
  // .lottie file path → use DotLottieReact
  if (src) {
    return (
      <DotLottieReact
        src={src}
        loop={loop}
        speed={speed}
        autoplay
        className={className}
      />
    );
  }

  // JSON data → use lottie-react (backward compatible)
  return <LottieJson animationData={animationData} loop={loop} speed={speed} className={className} />;
}

function LottieJson({ animationData, loop, speed, className }: { animationData: unknown; loop: boolean; speed: number; className?: string }) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    if (lottieRef.current && speed !== 1) {
      lottieRef.current.setSpeed(speed);
    }
  }, [speed]);

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={animationData}
      loop={loop}
      className={className}
      rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
    />
  );
}
