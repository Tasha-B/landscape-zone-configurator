import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";

type SharedProps = {
  variant: Variant;
  inverted?: boolean;
  className?: string;
  children: ReactNode;
};

type Props =
  | ({ as: "a" } & SharedProps & AnchorHTMLAttributes<HTMLAnchorElement>)
  | ({ as?: "button" } & SharedProps & ButtonHTMLAttributes<HTMLButtonElement>);

const BASE =
  "inline-flex min-w-40 items-center justify-center rounded px-7 py-3 font-body text-[15px] font-semibold transition-[filter,background-color,border-color]";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-gold text-forest-dark hover:brightness-105",
  secondary: "border border-forest-dark text-forest-dark hover:bg-forest-dark/[0.06]",
};

const SECONDARY_INVERTED = "border border-ivory/60 text-ivory hover:bg-ivory/[0.06]";

export default function Button({ variant, inverted, className = "", children, as = "button", ...rest }: Props) {
  const variantClass = variant === "secondary" && inverted ? SECONDARY_INVERTED : VARIANTS[variant];
  const classes = [BASE, variantClass, className].filter(Boolean).join(" ");

  if (as === "a") {
    return (
      <a className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
