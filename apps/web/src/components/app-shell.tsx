import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AppShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  cta?: {
    href: string;
    label: string;
  };
  secondaryCta?: {
    href: string;
    label: string;
  };
  children?: ReactNode;
};

export function AppShell({
  eyebrow,
  title,
  description,
  cta,
  secondaryCta,
  children,
}: AppShellProps) {
  return (
    <section className="mx-auto flex w-full max-w-screen-sm flex-1 flex-col gap-4 px-4 pb-8 pt-6 sm:px-6">
      <Card className="overflow-hidden border-white/60 bg-white/90 shadow-[0_20px_60px_rgba(8,15,31,0.08)] backdrop-blur">
        <CardHeader className="gap-3">
          {eyebrow ? (
            <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              {eyebrow}
            </span>
          ) : null}
          <div className="space-y-2">
            <CardTitle className="text-3xl font-semibold tracking-tight text-slate-950">
              {title}
            </CardTitle>
            <CardDescription className="max-w-[32ch] text-sm leading-6 text-slate-600">
              {description}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          {(cta || secondaryCta) ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              {cta ? (
                <Button asChild className="w-full sm:flex-1">
                  <Link href={cta.href}>{cta.label}</Link>
                </Button>
              ) : null}
              {secondaryCta ? (
                <Button asChild variant="outline" className="w-full sm:flex-1">
                  <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
