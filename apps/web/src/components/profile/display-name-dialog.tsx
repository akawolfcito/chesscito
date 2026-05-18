"use client";
import { useState, useEffect } from "react";
import { DISPLAY_NAME_COPY } from "@/lib/content/editorial";

type Props = {
  open: boolean;
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
};

export function DisplayNameDialog({ open, initialValue, onSave, onCancel }: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  if (!open) return null;

  return (
    <div role="dialog" aria-label={DISPLAY_NAME_COPY.dialogTitle} className="profile-name-dialog">
      <div className="profile-name-dialog-card">
        <h3 className="profile-name-dialog-title">{DISPLAY_NAME_COPY.dialogTitle}</h3>
        <input
          type="text"
          value={value}
          maxLength={20}
          placeholder={DISPLAY_NAME_COPY.placeholder}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          className="profile-name-dialog-input"
        />
        <div className="profile-name-dialog-actions">
          <button type="button" onClick={onCancel} className="profile-name-dialog-cancel">
            {DISPLAY_NAME_COPY.cancel}
          </button>
          <button
            type="button"
            onClick={() => onSave(value.trim())}
            className="profile-name-dialog-save"
          >
            {DISPLAY_NAME_COPY.save}
          </button>
        </div>
      </div>
    </div>
  );
}
