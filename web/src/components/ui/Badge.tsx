import { cn } from "@/lib/utils/cn";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "neutral" | "success" | "warning" | "danger";
}

export function Badge({ children, variant = "neutral" }: BadgeProps) {
  const variants = {
    neutral: "bg-panel-2 text-ink-soft",
    success: "bg-mint/15 text-mint",
    warning: "bg-gold/15 text-gold",
    danger: "bg-red-500/15 text-red-400",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-medium",
        variants[variant]
      )}
    >
      {children}
    </span>
  );
}