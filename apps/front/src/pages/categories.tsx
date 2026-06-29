import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getCategoryColumns,
  getDeletedCategoryColumns,
} from "@/components/data-table/category-columns";
import { DataTable } from "@/components/data-table/data-table";
import { CreateCategoryDialog } from "@/components/dialogs/create-category-dialog";
import { DeleteCategoryDialog } from "@/components/dialogs/delete-category-dialog";
import { EditCategoryDialog } from "@/components/dialogs/edit-category-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CATEGORIES_CHANGED_EVENT,
  listCategories,
  restoreCategory,
} from "@/lib/categories";
import type { Category } from "@/lib/categories";

const EMPTY_LIST = { active: [], deleted: [] };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<{
    active: Category[];
    deleted: Category[];
  }>(EMPTY_LIST);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setError(null);

    try {
      const data = await listCategories();
      setCategories(data);
    } catch (fetchError) {
      console.error("[Categories] Failed to fetch categories", fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudieron cargar las categorías"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const handleCategoriesChanged = () => {
      void fetchCategories();
    };

    window.addEventListener(CATEGORIES_CHANGED_EVENT, handleCategoriesChanged);

    return () => {
      window.removeEventListener(
        CATEGORIES_CHANGED_EVENT,
        handleCategoriesChanged
      );
    };
  }, [fetchCategories]);

  const handleSaveCategory = (updatedCategory: Category) => {
    setCategories((prev) => ({
      active: prev.active.map((c) =>
        c.id === updatedCategory.id ? updatedCategory : c
      ),
      deleted: prev.deleted,
    }));
  };

  const handleDeleteCategory = (category: Category) => {
    setCategories((prev) => ({
      active: prev.active.filter((c) => c.id !== category.id),
      deleted: prev.deleted,
    }));
  };

  const handleRestoreCategory = async (category: Category) => {
    setError(null);
    setRestoringId(category.id);

    try {
      await restoreCategory(category.id);
      window.dispatchEvent(new CustomEvent(CATEGORIES_CHANGED_EVENT));
    } catch (restoreError) {
      console.error("[Categories] Failed to restore category", restoreError);
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "No se pudo restaurar la categoría"
      );
    } finally {
      setRestoringId(null);
    }
  };

  const activeColumns = useMemo(
    () =>
      getCategoryColumns(
        (category) => setEditCategory(category),
        (category) => setDeleteCategory(category)
      ),
    []
  );

  const deletedColumns = useMemo(
    () => getDeletedCategoryColumns(handleRestoreCategory),
    []
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-semibold text-lg">Categorías</h1>
        <Button onClick={() => setCreateOpen(true)}>Nueva categoría</Button>
      </div>
      {error && <p className="mb-4 text-destructive text-sm">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando categorías...</p>
      ) : (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">
              Activas ({categories.active.length})
            </TabsTrigger>
            <TabsTrigger value="deleted">
              Eliminadas ({categories.deleted.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {categories.active.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No hay categorías activas. Crea una con el botón "Nueva
                categoría".
              </p>
            ) : (
              <DataTable columns={activeColumns} data={categories.active} />
            )}
          </TabsContent>

          <TabsContent value="deleted" className="mt-4">
            {categories.deleted.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No hay categorías eliminadas.
              </p>
            ) : (
              <DataTable columns={deletedColumns} data={categories.deleted} />
            )}
          </TabsContent>
        </Tabs>
      )}

      {restoringId && (
        <p className="mt-2 text-muted-foreground text-sm">Restaurando...</p>
      )}

      <CreateCategoryDialog open={createOpen} onOpenChange={setCreateOpen} />

      <EditCategoryDialog
        category={editCategory}
        open={editCategory !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditCategory(null);
          }
        }}
        onSave={handleSaveCategory}
      />

      <DeleteCategoryDialog
        category={deleteCategory}
        open={deleteCategory !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteCategory(null);
          }
        }}
        onDelete={handleDeleteCategory}
      />
    </div>
  );
}
