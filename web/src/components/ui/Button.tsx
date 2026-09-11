import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "danger"
    | "warning"
    | "dark"
    | "mint"
    | "orange";
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

  const variants = {
    primary: "bg-primary text-white shadow-sm hover:bg-primary-strong",
    secondary:
      "border border-edge bg-panel-2 text-ink hover:bg-panel",
    ghost: "text-ink-soft hover:bg-panel-2 hover:text-ink",
    danger: "bg-red-600 text-white hover:bg-red-500",
    warning: "bg-amber-400 text-amber-950 shadow-sm hover:bg-amber-300",
    mint: "border border-mint/30 bg-mint/10 text-mint hover:bg-mint/15",
    orange: "bg-orange-500 text-white shadow-sm hover:bg-orange-600",
    dark: "border border-[#2b2b4a] bg-[#1e1e3a] text-[#f0f0f0] hover:bg-[#2b2b4a]",
  };

  return (
    <button className={cn(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}