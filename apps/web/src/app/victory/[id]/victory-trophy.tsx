"use client";

import { LottieAnimation } from "@/components/ui/lottie-animation";
import trophyData from "@/../public/animations/trophy.json";

export function VictoryTrophy() {
  return (
    <div className="relative mb-4 flex items-center justify-center">
      <div className="absolute h-40 w-40 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.22)_0%,rgba(20,184,166,0.08)_40%,rgba(217,180,74,0.04)_65%,transparent_80%)]" />
      <div className="relative h-32 w-32">
        <LottieAnimation animationData={trophyData} loop={false} className="h-full w-full" />
      </div>
    </div>
  );
}
