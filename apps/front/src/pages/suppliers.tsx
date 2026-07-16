import { Trash2 } from "lucide-react";
import { useState } from "react";

import { DeleteSupplierDialog } from "@/components/dialogs/delete-supplier-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardPanel,
} from "@/components/ui/card";
import { useSuppliers } from "@/hooks/queries/use-suppliers";
import type { Supplier } from "@/lib/suppliers";

const EMPTY_LIST = { active: [], deleted: [] };

export default function SuppliersPage() {
  const { data: suppliers = EMPTY_LIST, error, isLoading } = useSuppliers();
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);

  return (
    <div>
      <h1 className="mb-4 font-semibold text-lg">Proveedores</h1>

      {error && (
        <p className="mb-4 text-destructive text-sm">
          {error instanceof Error
            ? error.message
            : "No se pudieron cargar los proveedores"}
        </p>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando proveedores...</p>
      ) : (
        <>
          {suppliers.active.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No hay proveedores registrados.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {suppliers.active.map((supplier) => (
                <Card key={supplier.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate">
                          {supplier.name}
                        </CardTitle>
                        <CardDescription className="truncate">
                          {supplier.email ?? "Sin email"}
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-mr-2 shrink-0"
                        onClick={() => setDeleteSupplier(supplier)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardPanel>
                    <div className="space-y-1 text-sm">
                      {supplier.phone && <p>{supplier.phone}</p>}
                      {supplier.rfc && (
                        <p className="text-muted-foreground">{supplier.rfc}</p>
                      )}
                      {supplier.address && (
                        <p className="text-muted-foreground truncate">
                          {supplier.address}
                        </p>
                      )}
                    </div>
                  </CardPanel>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <DeleteSupplierDialog
        supplier={deleteSupplier}
        open={deleteSupplier !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteSupplier(null);
          }
        }}
        onDelete={() => {
          setDeleteSupplier(null);
        }}
      />
    </div>
  );
}
