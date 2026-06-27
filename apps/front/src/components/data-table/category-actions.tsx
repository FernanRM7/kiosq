import type { Row } from "@tanstack/react-table";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Category } from "@/lib/categories";

interface CategoryActionsProps {
  row: Row<Category>;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

export function CategoryActions({
  row,
  onEdit,
  onDelete,
}: CategoryActionsProps) {
  const category = row.original;

  return (
    <div className="flex gap-2">
      <Button variant="ghost" size="icon" onClick={() => onEdit(category)}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onDelete(category)}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

interface DeletedCategoryActionsProps {
  row: Row<Category>;
  onRestore: (category: Category) => void;
}

export function DeletedCategoryActions({
  row,
  onRestore,
}: DeletedCategoryActionsProps) {
  const category = row.original;

  return (
    <div className="flex gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRestore(category)}
        title="Restaurar"
      >
        <RotateCcw className="size-4" />
      </Button>
    </div>
  );
}
