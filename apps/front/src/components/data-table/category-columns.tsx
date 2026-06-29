import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";

import type { Category } from "@/lib/categories";

import { CategoryActions, DeletedCategoryActions } from "./category-actions";

const columnHelper = createColumnHelper<Category>();

export function getCategoryColumns(
  onEdit: (category: Category) => void,
  onDelete: (category: Category) => void
) {
  return [
    columnHelper.accessor("name", {
      header: "Nombre",
    }),
    columnHelper.accessor("isActive", {
      cell: (info) => (info.getValue() ? "Activa" : "Inactiva"),
      header: "Estado",
    }),
    columnHelper.display({
      cell: (props) => (
        <CategoryActions row={props.row} onEdit={onEdit} onDelete={onDelete} />
      ),
      header: "Acciones",
      id: "actions",
    }),
  ] as ColumnDef<Category, unknown>[];
}

export function getDeletedCategoryColumns(
  onRestore: (category: Category) => void
) {
  return [
    columnHelper.accessor("name", {
      header: "Nombre",
    }),
    columnHelper.display({
      cell: (props) => (
        <DeletedCategoryActions row={props.row} onRestore={onRestore} />
      ),
      header: "Acciones",
      id: "actions",
    }),
  ] as ColumnDef<Category, unknown>[];
}
