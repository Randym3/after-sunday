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
        "rounded-3xl border border-[#ddd8c8] bg-[#fffdf7] p-6 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}