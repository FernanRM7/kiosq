import { useCallback, useEffect, useMemo, useState } from "react";

import { getProductColumns } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { DeleteProductDialog } from "@/components/dialogs/delete-product-dialog";
import { EditProductDialog } from "@/components/dialogs/edit-product-dialog";
import { listProducts, PRODUCTS_CHANGED_EVENT } from "@/lib/products";
import type { Product } from "@/lib/products";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setError(null);

    try {
      const data = await listProducts();
      setProducts(data);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudieron cargar los productos"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const handleProductsChanged = () => {
      void fetchProducts();
    };

    window.addEventListener(PRODUCTS_CHANGED_EVENT, handleProductsChanged);

    return () => {
      window.removeEventListener(PRODUCTS_CHANGED_EVENT, handleProductsChanged);
    };
  }, [fetchProducts]);

  const handleSaveProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
  };

  const handleDeleteProduct = (product: Product) => {
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
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
      <h1 className="mb-4 font-semibold text-lg">Products</h1>
      {error && <p className="mb-4 text-destructive text-sm">{error}</p>}
      {loading ? (
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
