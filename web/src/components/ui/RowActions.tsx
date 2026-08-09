import Link from "next/link";

interface RowActionsProps {
  /** Renders Edit as a link when provided. */
  editHref?: string;
  /** Renders Edit as a button when provided (takes precedence over editHref). */
  onEdit?: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
}

const iconClass =
  "inline-flex cursor-pointer items-center justify-center text-[#012f11] transition hover:text-[#073f19]";

const deleteIconClass =
  "inline-flex cursor-pointer items-center justify-center text-red-600 transition hover:text-red-700";

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

export function RowActions({
  editHref,
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
}: RowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-3">
      {onEdit ? (
        <button
          type="button"
          className={iconClass}
          onClick={onEdit}
          aria-label={editLabel}
        >
          <PencilIcon />
        </button>
      ) : editHref ? (
        <Link href={editHref} className={iconClass} aria-label={editLabel}>
          <PencilIcon />
        </Link>
      ) : null}

      <button
        type="button"
        className={deleteIconClass}
        onClick={onDelete}
        aria-label={deleteLabel}
      >
        <TrashIcon />
      </button>
    </div>
  );
}
