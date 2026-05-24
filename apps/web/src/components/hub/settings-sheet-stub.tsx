"use client";
import { useTranslations } from "next-intl";

type Props = { buildSha: string };

function DisabledToggle({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <button
      type="button"
      disabled
      title={tooltip}
      className="settings-toggle settings-toggle--disabled"
    >
      {label}
    </button>
  );
}

export function SettingsSheetStub({ buildSha }: Props) {
  const t = useTranslations("SETTINGS_STUB_COPY");
  return (
    <div className="settings-stub">
      <h2 className="settings-stub-title">{t("title")}</h2>
      <div className="settings-stub-version">
        {t("versionChipLabel", { sha: buildSha })}
      </div>
      <div className="settings-stub-toggles">
        <DisabledToggle label={t("themeToggleLabel")} tooltip={t("comingSoonTooltip")} />
        <DisabledToggle label={t("hapticsToggleLabel")} tooltip={t("comingSoonTooltip")} />
        <DisabledToggle label={t("languageToggleLabel")} tooltip={t("comingSoonTooltip")} />
      </div>
    </div>
  );
}
