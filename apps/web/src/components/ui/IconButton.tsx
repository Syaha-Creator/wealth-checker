"use client";

import Link from "next/link";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "info" | "warning" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center shrink-0 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60 disabled:cursor-not-allowed";

// min-h/min-w-11 (44px) keeps the tap target at the recommended minimum even
// though the visible icon inside stays small — the icon doesn't need to grow
// for the hit area to grow.
const sizes: Record<Size, string> = {
  sm: "min-h-9 min-w-9",
  md: "min-h-11 min-w-11",
};

const variants: Record<Variant, string> = {
  default: "text-text-muted hover:text-text-primary hover:bg-surface-hover",
  info: "text-text-muted hover:text-info hover:bg-info-soft",
  warning: "text-text-muted hover:text-warning-text hover:bg-warning-soft",
  danger: "text-text-muted hover:text-danger hover:bg-danger-soft",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  "aria-label": string;
  children: ReactNode;
}

type IconButtonAsButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { href?: undefined };

type IconButtonAsLinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "aria-label"> & { href: string };

export type IconButtonProps = IconButtonAsButtonProps | IconButtonAsLinkProps;

// Shared tappable wrapper for icon-only actions (edit/delete/etc). Enforces a
// minimum 44x44 hit area (36x36 for `sm`, used only in dense header contexts)
// regardless of how small the icon glyph itself is, per WCAG target-size
// guidance — replaces ad-hoc `p-1.5` buttons/links scattered across list rows.
export const IconButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, IconButtonProps>(
  function IconButton(props, ref) {
    const { variant = "default", size = "md", className = "", children, ...rest } = props;
    const classes = `${base} ${sizes[size]} ${variants[variant]} ${className}`;

    if ("href" in rest && rest.href) {
      const { href, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
      return (
        <Link href={href} ref={ref as never} className={classes} {...anchorRest}>
          {children}
        </Link>
      );
    }

    const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button ref={ref as React.Ref<HTMLButtonElement>} type="button" className={classes} {...buttonRest}>
        {children}
      </button>
    );
  }
);
