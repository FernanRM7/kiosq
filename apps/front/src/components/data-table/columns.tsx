import { createColumnHelper } from "@tanstack/react-table";

import type { Product } from "@/data/products";

import { ProductActions } from "./product-actions";

const columnHelper = createColumnHelper<Product>();

export function getProductColumns(
  onEdit: (product: Product) => void,
  onDelete: (product: Product) => void
) {
  return [
    columnHelper.accessor("id", {
      header: "ID",
    }),
    columnHelper.accessor("nombre", {
      header: "Nombre",
    }),
    columnHelper.accessor("precio", {
      cell: (info) => `$${info.getValue().toFixed(2)}`,
      header: "Precio",
    }),
    columnHelper.accessor("stock", {
      header: "Stock",
    }),
    columnHelper.display({
      cell: (props) => (
        <ProductActions row={props.row} onEdit={onEdit} onDelete={onDelete} />
      ),
      header: "Acciones",
      id: "actions",
    }),
  ];
}
