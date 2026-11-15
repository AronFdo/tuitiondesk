"use client";

import { t } from "@/lib/t";

// Every row has the same two buttons, so each one's accessible name carries
// the row's name: "Edit Nimal Perera", not a list of identical "Edit"s.
export function RowActions({
  itemName,
  onEdit,
  onDelete,
}: {
  itemName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <span className="flex shrink-0">
      <button
        type="button"
        className="h-11 px-2 text-sm font-medium text-forest"
        aria-label={`${t("Edit")} ${itemName}`}
        onClick={onEdit}
      >
        {t("Edit")}
      </button>
      <button
        type="button"
        className="h-11 px-2 text-sm font-medium text-destructive"
        aria-label={`${t("Delete")} ${itemName}`}
        onClick={onDelete}
      >
        {t("Delete")}
      </button>
    </span>
  );
}
