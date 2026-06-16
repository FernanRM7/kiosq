import { useMemo, useState } from "react";

import { getProductColumns } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { DeleteProductDialog } from "@/components/dialogs/delete-product-dialog";
import { EditProductDialog } from "@/components/dialogs/edit-product-dialog";
import { products as initialProducts } from "@/data/products";
import type { Product } from "@/data/products";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);

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
      <DataTable columns={columns} data={products} />

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
