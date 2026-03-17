"use client";

import Lottie from "lottie-react";

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  animationData: any;
  loop?: boolean;
  speed?: number;
  className?: string;
};

export function LottieAnimation({ animationData, loop = true, speed = 1, className }: Props) {
  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      speed={speed}
      className={className}
      rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
    />
  );
}
