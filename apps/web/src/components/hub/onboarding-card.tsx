"use client";
import { HUB_ONBOARDING_COPY } from "@/lib/content/editorial";

type Props = { onDismiss: () => void };

export function HubOnboardingCard({ onDismiss }: Props) {
  return (
    <aside
      className="hub-onboarding-card"
      role="region"
      aria-label={HUB_ONBOARDING_COPY.title}
    >
      <h3 className="hub-onboarding-card-title">{HUB_ONBOARDING_COPY.title}</h3>
      <p className="hub-onboarding-card-body">{HUB_ONBOARDING_COPY.body}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="hub-onboarding-card-dismiss"
      >
        {HUB_ONBOARDING_COPY.dismissLabel}
      </button>
    </aside>
  );
}
