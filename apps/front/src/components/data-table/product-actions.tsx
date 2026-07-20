import type { Row } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { canManageCatalog } from "@/lib/access";
import type { Product } from "@/lib/products";

interface ProductActionsProps {
  row: Row<Product>;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export function ProductActions({ row, onEdit, onDelete }: ProductActionsProps) {
  const { user } = useAuth();
  const canEditCatalog = canManageCatalog(user?.role);
  const product = row.original;

  if (!canEditCatalog) {
    return null;
  }

  return (
    <div className="flex gap-2">
      <Button variant="ghost" size="icon" onClick={() => onEdit(product)}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onDelete(product)}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
