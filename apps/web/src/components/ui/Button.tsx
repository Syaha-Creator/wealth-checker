"use client";

import Link from "next/link";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "warning" | "info" | "ghost" | "outline" | "outline-danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-text-on hover:bg-brand-hover active:bg-brand-active shadow-sm",
  secondary: "bg-surface-hover text-text-primary border border-border hover:bg-border/40",
  danger: "bg-danger text-white hover:bg-danger-hover shadow-sm",
  warning: "bg-warning text-white hover:bg-warning-hover shadow-sm",
  info: "bg-info text-white hover:opacity-90 shadow-sm",
  ghost: "text-text-secondary hover:text-text-primary hover:bg-surface-hover",
  outline: "border border-border text-text-primary hover:bg-surface-hover",
  "outline-danger": "border border-danger-soft-border text-danger-text hover:bg-danger-soft",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3.5 text-base",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

type ButtonAsButtonProps = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLinkProps = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

function Spinner({ size }: { size: Size }) {
  const dim = size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-5 h-5" : "w-4 h-4";
  return <span className={`${dim} border-2 border-current/30 border-t-current rounded-full animate-spin shrink-0`} aria-hidden="true" />;
}

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const { variant = "primary", size = "md", loading, fullWidth, className = "", children, ...rest } = props;
    const classes = `${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`;

    if ("href" in rest && rest.href) {
      const { href, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
      return (
        <Link href={href} ref={ref as never} className={classes} {...anchorRest}>
          {loading && <Spinner size={size} />}
          {children}
        </Link>
      );
    }

    const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        disabled={loading || buttonRest.disabled}
        {...buttonRest}
      >
        {loading && <Spinner size={size} />}
        {children}
      </button>
    );
  }
);
