import { PRO_COPY } from "@/lib/content/editorial";

type CoachProCardProps = {
  active: boolean;
  remainingDays?: number;
  onCtaClick?: () => void;
};

export function CoachProCard({
  active,
  remainingDays = 0,
  onCtaClick,
}: CoachProCardProps) {
  const activeCopy = PRO_COPY.hubCoachCard.active;
  const inactiveCopy = PRO_COPY.hubCoachCard.inactive;
  const title = active ? activeCopy.title(remainingDays) : inactiveCopy.title;
  const body = active ? activeCopy.body : inactiveCopy.body;
  const cta = active ? activeCopy.cta : inactiveCopy.cta;

  return (
    <section
      className={`coach-pro-card${active ? " is-active" : " is-inactive"}`}
      aria-label="Coach PRO training"
    >
      <div className="coach-pro-card-copy">
        <h2 className="coach-pro-card-title">{title}</h2>
        <p className="coach-pro-card-body">{body}</p>
        {!active ? (
          <div className="coach-pro-card-chips" aria-label="Coach PRO includes">
            {PRO_COPY.hubCoachCard.inactive.chips.map((chip) => (
              <span className="coach-pro-card-chip" key={chip}>
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="coach-pro-card-cta"
        onClick={onCtaClick}
      >
        {cta}
      </button>
    </section>
  );
}
