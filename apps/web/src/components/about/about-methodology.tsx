import { getTranslations } from "next-intl/server";

/** Phase 0.5 C2 — methodology mini-section for /about. Sits between
 *  the identity block and the navigation list to anchor the
 *  "real human team" differentiator (FIDE Master pedagogy + dev
 *  team) right after the user reads what Chesscito is.
 *
 *  Async server component since Stage C migration: copy resolves
 *  through next-intl so /es renders Spanish.
 */
export async function AboutMethodology() {
  const t = await getTranslations("ABOUT_METHODOLOGY_COPY");
  return (
    <section
      role="region"
      aria-label={t("sectionTitle")}
      className="paper-tray flex flex-col gap-2 py-3"
    >
      <h3
        className="fantasy-title text-xs font-extrabold uppercase tracking-[0.12em]"
        style={{
          color: "rgba(110, 65, 15, 0.85)",
          textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
        }}
      >
        {t("sectionTitle")}
      </h3>

      <p
        className="text-xs leading-relaxed"
        style={{ color: "var(--paper-text)" }}
      >
        {t("body")}
      </p>

      <ul
        className="mt-1 flex flex-wrap gap-2"
        aria-label="Team attribution"
      >
        <li>
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
            style={{
              background: "rgba(255, 245, 215, 0.55)",
              borderColor: "rgba(110, 65, 15, 0.28)",
              color: "rgba(63, 34, 8, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
            }}
          >
            {t("cesar")}
          </span>
        </li>
        <li>
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
            style={{
              background: "rgba(255, 245, 215, 0.55)",
              borderColor: "rgba(110, 65, 15, 0.28)",
              color: "rgba(63, 34, 8, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
            }}
          >
            {t("wolfcito")}
          </span>
        </li>
      </ul>
    </section>
  );
}
