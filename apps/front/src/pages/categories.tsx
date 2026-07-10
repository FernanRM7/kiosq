import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

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
import { useRestoreCategory } from "@/hooks/mutations/use-restore-category";
import { useCategories } from "@/hooks/queries/use-categories";
import type { Category } from "@/lib/categories";

const EMPTY_LIST = { active: [], deleted: [] };

export default function CategoriesPage() {
  const { data: categories = EMPTY_LIST, error, isLoading } = useCategories();
  const queryClient = useQueryClient();
  const restoreCategoryMutation = useRestoreCategory();
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const handleSaveCategory = () => {
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const handleDeleteCategory = () => {
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const handleRestoreCategory = useCallback(
    (category: Category) => {
      restoreCategoryMutation.mutate(category.id);
    },
    [restoreCategoryMutation]
  );

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
    [handleRestoreCategory]
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-semibold text-lg">Categorías</h1>
        <Button onClick={() => setCreateOpen(true)}>Nueva categoría</Button>
      </div>
      {error && (
        <p className="mb-4 text-destructive text-sm">
          {error instanceof Error
            ? error.message
            : "No se pudieron cargar las categorías"}
        </p>
      )}
      {isLoading ? (
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

      {restoreCategoryMutation.isPending && (
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
