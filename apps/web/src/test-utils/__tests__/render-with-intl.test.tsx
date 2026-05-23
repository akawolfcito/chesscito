import { describe, it, expect } from "vitest";
import { useTranslations } from "next-intl";
import { renderWithIntl, screen } from "../render-with-intl";

function CoachTitleProbe() {
  const t = useTranslations("COACH_COPY");
  return <span>{t("yourSessions")}</span>;
}

function MissingKeyProbe() {
  const t = useTranslations("NONEXISTENT_NAMESPACE");
  return <span>{t("missingKey")}</span>;
}

describe("renderWithIntl", () => {
  it("resolves an EN bundle key via useTranslations", () => {
    renderWithIntl(<CoachTitleProbe />);
    expect(screen.getByText("JOURNAL")).toBeInTheDocument();
  });

  it("falls back to the dotted key path on missing translations", () => {
    renderWithIntl(<MissingKeyProbe />);
    expect(
      screen.getByText("NONEXISTENT_NAMESPACE.missingKey"),
    ).toBeInTheDocument();
  });

  it("accepts a locale override (ES bundle mirrors EN until Stage 4)", () => {
    renderWithIntl(<CoachTitleProbe />, { locale: "es" });
    expect(screen.getByText("JOURNAL")).toBeInTheDocument();
  });
});
