import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

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
import { useMyTenant } from "@/hooks/queries/use-tenants";
import type { Category } from "@/lib/categories";

const EMPTY_LIST = { active: [], deleted: [] };

export default function CategoriesPage() {
  const { data: myTenant, isLoading: isTenantLoading } = useMyTenant();
  const hasTenant = Boolean(myTenant?.tenant);
  const {
    data: categories = EMPTY_LIST,
    error,
    isLoading,
  } = useCategories({
    enabled: hasTenant,
  });
  const queryClient = useQueryClient();
  const restoreCategoryMutation = useRestoreCategory();
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const visibleError = hasTenant ? error : null;

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

  let statusMessage: ReactNode = null;
  let categoryContent: ReactNode = null;

  if (isTenantLoading) {
    statusMessage = (
      <p className="text-muted-foreground text-sm">Verificando tu negocio...</p>
    );
  } else if (!hasTenant) {
    statusMessage = (
      <p className="text-muted-foreground text-sm">
        Crea o activa un negocio para ver y administrar las categor\u00edas.
      </p>
    );
  }

  if (hasTenant) {
    categoryContent = isLoading ? (
      <p className="text-muted-foreground text-sm">
        Cargando categor\u00edas...
      </p>
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
              No hay categor\u00edas activas. Crea una con el bot\u00f3n{" "}
              <strong>&quot;Nueva categor\u00eda&quot;</strong>.
            </p>
          ) : (
            <DataTable columns={activeColumns} data={categories.active} />
          )}
        </TabsContent>

        <TabsContent value="deleted" className="mt-4">
          {categories.deleted.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No hay categor\u00edas eliminadas.
            </p>
          ) : (
            <DataTable columns={deletedColumns} data={categories.deleted} />
          )}
        </TabsContent>
      </Tabs>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-semibold text-lg">Categor\u00edas</h1>
        {hasTenant && (
          <Button onClick={() => setCreateOpen(true)}>
            Nueva categor\u00eda
          </Button>
        )}
      </div>
      {statusMessage}
      {visibleError && (
        <p className="mb-4 text-destructive text-sm">
          {visibleError instanceof Error
            ? visibleError.message
            : "No se pudieron cargar las categor\u00EDas"}
        </p>
      )}
      {categoryContent}

      {hasTenant && restoreCategoryMutation.isPending && (
        <p className="mt-2 text-muted-foreground text-sm">Restaurando...</p>
      )}

      {hasTenant && (
        <>
          <CreateCategoryDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
          />

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
        </>
      )}
    </div>
  );
}
