"use client";

import { forwardRef, type ReactNode } from "react";

export type PrincipalButtonSize = "medium" | "large";

export type PrincipalButtonProps = {
  children: ReactNode;
  size?: PrincipalButtonSize;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
};

export const PrincipalButton = forwardRef<
  HTMLButtonElement,
  PrincipalButtonProps
>(function PrincipalButton(
  {
    children,
    size = "medium",
    onClick,
    disabled = false,
    loading = false,
    leadingIcon,
    className = "",
    "aria-label": ariaLabel,
    "data-testid": dataTestId,
  },
  forwardedRef,
) {
  const state = loading ? "loading" : disabled ? "disabled" : "default";

  const classes = [
    "principal-button",
    `principal-button-${size}`,
    loading ? "is-loading" : "",
    disabled ? "is-disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const handleClick = () => {
    if (disabled || loading) return;
    onClick();
  };

  return (
    <button
      ref={forwardedRef}
      type="button"
      data-component="principal-button"
      data-size={size}
      data-state={state}
      data-testid={dataTestId}
      className={classes}
      disabled={disabled || loading}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
    >
      {leadingIcon ? (
        <span className="principal-button-leading-icon">{leadingIcon}</span>
      ) : null}
      <span className="principal-button-label">{children}</span>
      {loading ? (
        <span className="principal-button-spinner" aria-hidden="true" />
      ) : null}
    </button>
  );
});
