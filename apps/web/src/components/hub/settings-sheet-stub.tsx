"use client";
import { SETTINGS_STUB_COPY } from "@/lib/content/editorial";

type Props = { buildSha: string };

function DisabledToggle({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      title={SETTINGS_STUB_COPY.comingSoonTooltip}
      className="settings-toggle settings-toggle--disabled"
    >
      {label}
    </button>
  );
}

export function SettingsSheetStub({ buildSha }: Props) {
  return (
    <div className="settings-stub">
      <h2 className="settings-stub-title">{SETTINGS_STUB_COPY.title}</h2>
      <div className="settings-stub-version">
        {SETTINGS_STUB_COPY.versionChipLabel.replace("{sha}", buildSha)}
      </div>
      <div className="settings-stub-toggles">
        <DisabledToggle label={SETTINGS_STUB_COPY.themeToggleLabel} />
        <DisabledToggle label={SETTINGS_STUB_COPY.hapticsToggleLabel} />
        <DisabledToggle label={SETTINGS_STUB_COPY.languageToggleLabel} />
      </div>
    </div>
  );
}
