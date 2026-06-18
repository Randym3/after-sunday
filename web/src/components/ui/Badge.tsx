import { cn } from "@/lib/utils/cn";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "neutral" | "success" | "warning" | "danger";
}

export function Badge({ children, variant = "neutral" }: BadgeProps) {
  const variants = {
    neutral: "bg-stone-100 text-stone-700",
    success: "bg-green-100 text-green-900",
    warning: "bg-lime-100 text-green-950",
    danger: "bg-red-100 text-red-800",
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