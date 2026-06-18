import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";

import type { Product } from "@/lib/products";

import { ProductActions } from "./product-actions";

const columnHelper = createColumnHelper<Product>();

export function getProductColumns(
  onEdit: (product: Product) => void,
  onDelete: (product: Product) => void
) {
  return [
    columnHelper.accessor("sku", {
      header: "SKU",
    }),
    columnHelper.accessor("name", {
      header: "Nombre",
    }),
    columnHelper.accessor("price", {
      cell: (info) => `$${info.getValue().toFixed(2)}`,
      header: "Precio",
    }),
    columnHelper.accessor("totalStock", {
      header: "Stock total",
    }),
    columnHelper.display({
      cell: (props) => (
        <ProductActions row={props.row} onEdit={onEdit} onDelete={onDelete} />
      ),
      header: "Acciones",
      id: "actions",
    }),
  ] as ColumnDef<Product, unknown>[];
}
