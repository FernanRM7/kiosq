import type { Row } from "@tanstack/react-table";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { canManageCatalog } from "@/lib/access";
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
  const { user } = useAuth();
  const canEditCatalog = canManageCatalog(user?.role);
  const category = row.original;

  if (!canEditCatalog) {
    return null;
  }

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
  const { user } = useAuth();
  const canEditCatalog = canManageCatalog(user?.role);
  const category = row.original;

  if (!canEditCatalog) {
    return null;
  }

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
