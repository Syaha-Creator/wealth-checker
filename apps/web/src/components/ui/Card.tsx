import type { HTMLAttributes, FormHTMLAttributes, ReactNode } from "react";

type Padding = "none" | "sm" | "md" | "lg";

const paddings: Record<Padding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

interface CommonProps {
  padding?: Padding;
  children?: ReactNode;
  hoverable?: boolean;
  className?: string;
}

type CardProps =
  | ({ as?: "div" } & CommonProps & HTMLAttributes<HTMLDivElement>)
  | ({ as: "form" } & CommonProps & FormHTMLAttributes<HTMLFormElement>);

export function Card({ as, padding = "md", hoverable, className = "", children, ...rest }: CardProps) {
  const cardClassName = `bg-surface rounded-2xl border border-border ${paddings[padding]} ${
    hoverable ? "transition-colors hover:border-border-strong" : ""
  } ${className}`;

  if (as === "form") {
    return (
      <form className={cardClassName} {...(rest as FormHTMLAttributes<HTMLFormElement>)}>
        {children}
      </form>
    );
  }

  return (
    <div className={cardClassName} {...(rest as HTMLAttributes<HTMLDivElement>)}>
      {children}
    </div>
  );
}
