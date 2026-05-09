"use client";

import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";

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
  },
  forwardedRef,
) {
  const localRef = useRef<HTMLButtonElement>(null);
  const [isPlaceholder, setIsPlaceholder] = useState(false);

  // Merge the local ref (used by the placeholder probe) with the
  // optional forwarded ref so callers can imperatively focus or measure
  // the button without losing the placeholder fallback.
  const setRefs = (node: HTMLButtonElement | null) => {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  useEffect(() => {
    const node = localRef.current;
    if (!node) return;
    const computed = window.getComputedStyle(node).backgroundImage;
    setIsPlaceholder(!computed || computed === "none" || computed === "");
  }, []);

  const state = loading ? "loading" : disabled ? "disabled" : "default";

  const classes = [
    "principal-button",
    `principal-button-${size}`,
    isPlaceholder ? "is-placeholder" : "",
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
      ref={setRefs}
      type="button"
      data-component="principal-button"
      data-size={size}
      data-state={state}
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
