import { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card>
      <div className="mx-auto max-w-md py-10 text-center">
        <h2 className="text-lg font-semibold text-[#102015]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>

        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </Card>
  );
}