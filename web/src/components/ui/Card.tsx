import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-edge bg-panel p-6 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}