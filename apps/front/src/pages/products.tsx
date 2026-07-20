import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { getProductColumns } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { DeleteProductDialog } from "@/components/dialogs/delete-product-dialog";
import { EditProductDialog } from "@/components/dialogs/edit-product-dialog";
import { useProducts } from "@/hooks/queries/use-products";
import type { Product } from "@/lib/products";

export default function ProductsPage() {
  const { data: products = [], error, isLoading } = useProducts();
  const queryClient = useQueryClient();
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

  const handleSaveProduct = () => {
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const handleDeleteProduct = (_product: Product) => {
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const columns = useMemo(
    () =>
      getProductColumns(
        (product) => setEditProduct(product),
        (product) => setDeleteProduct(product)
      ),
    []
  );

  return (
    <div>
      <h1 className="mb-4 font-semibold text-lg">Productos</h1>
      {error && (
        <p className="mb-4 text-destructive text-sm">
          {error instanceof Error
            ? error.message
            : "No se pudieron cargar los productos"}
        </p>
      )}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando productos...</p>
      ) : (
        <DataTable columns={columns} data={products} />
      )}

      <EditProductDialog
        product={editProduct}
        open={editProduct !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditProduct(null);
          }
        }}
        onSave={handleSaveProduct}
      />

      <DeleteProductDialog
        product={deleteProduct}
        open={deleteProduct !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteProduct(null);
          }
        }}
        onDelete={handleDeleteProduct}
      />
    </div>
  );
}
