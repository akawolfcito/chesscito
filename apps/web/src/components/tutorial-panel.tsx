"use client";

import { Button } from "@/components/ui/button";

type TutorialCue = {
  direction: string;
  label: string;
};

type TutorialPanelProps = {
  eyebrow: string;
  title: string;
  description: string;
  cues: TutorialCue[];
  ctaLabel: string;
  onStart: () => void;
};

export function TutorialPanel({
  eyebrow,
  title,
  description,
  cues,
  ctaLabel,
  onStart,
}: TutorialPanelProps) {
  return (
    <div className="space-y-4 rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          {eyebrow}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cues.map((cue) => (
          <div
            key={`${cue.direction}-${cue.label}`}
            className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-xl font-semibold text-white">
              {cue.direction}
            </span>
            <p className="text-sm font-medium text-slate-700">{cue.label}</p>
          </div>
        ))}
      </div>

      <Button className="w-full sm:w-auto" onClick={onStart}>
        {ctaLabel}
      </Button>
    </div>
  );
}
