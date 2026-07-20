import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { getProductColumns } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { DeleteProductDialog } from "@/components/dialogs/delete-product-dialog";
import { EditProductDialog } from "@/components/dialogs/edit-product-dialog";
import { useProducts } from "@/hooks/queries/use-products";
import { useMyTenant } from "@/hooks/queries/use-tenants";
import type { Product } from "@/lib/products";

export default function ProductsPage() {
  const { data: myTenant, isLoading: isTenantLoading } = useMyTenant();
  const hasTenant = Boolean(myTenant?.tenant);
  const {
    data: products = [],
    error,
    isLoading,
  } = useProducts({
    enabled: hasTenant,
  });
  const queryClient = useQueryClient();
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const columns = useMemo(
    () =>
      getProductColumns(
        (product) => setEditProduct(product),
        (product) => setDeleteProduct(product)
      ),
    []
  );

  const handleSaveProduct = () => {
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const handleDeleteProduct = (_product: Product) => {
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const visibleError = hasTenant ? error : null;
  let statusMessage: ReactNode = null;
  let tableContent: ReactNode = null;

  if (isTenantLoading) {
    statusMessage = (
      <p className="text-muted-foreground text-sm">Verificando tu negocio...</p>
    );
  } else if (!hasTenant) {
    statusMessage = (
      <p className="text-muted-foreground text-sm">
        Crea o activa un negocio para ver y administrar los productos.
      </p>
    );
  }

  if (hasTenant) {
    tableContent = isLoading ? (
      <p className="text-muted-foreground text-sm">Cargando productos...</p>
    ) : (
      <DataTable columns={columns} data={products} />
    );
  }

  return (
    <div>
      <h1 className="mb-4 font-semibold text-lg">Productos</h1>
      {statusMessage}
      {visibleError && (
        <p className="mb-4 text-destructive text-sm">
          {visibleError instanceof Error
            ? visibleError.message
            : "No se pudieron cargar los productos"}
        </p>
      )}
      {tableContent}

      {hasTenant && (
        <>
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
        </>
      )}
    </div>
  );
}
