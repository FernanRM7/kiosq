import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { CreateSupplierDialog } from "@/components/dialogs/create-supplier-dialog";
import { DeleteSupplierDialog } from "@/components/dialogs/delete-supplier-dialog";
import { EditSupplierDialog } from "@/components/dialogs/edit-supplier-dialog";
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
  const [createOpen, setCreateOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-semibold text-lg">Proveedores</h1>
        <Button onClick={() => setCreateOpen(true)}>Nuevo Proveedor</Button>
      </div>

      {error && (
        <p className="mb-4 text-destructive text-sm">
          {error instanceof Error
            ? error.message
            : "No se pudieron cargar los proveedores"}
        </p>
      )}

      {isLoading && (
        <p className="text-muted-foreground text-sm">Cargando proveedores...</p>
      )}
      {!isLoading && suppliers.active.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No hay proveedores registrados.
        </p>
      )}
      {!isLoading && suppliers.active.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {suppliers.active.map((supplier) => (
            <Card key={supplier.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate">{supplier.name}</CardTitle>
                    <CardDescription className="truncate">
                      {supplier.email ?? "Sin email"}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="-mr-2"
                      onClick={() => setEditSupplier(supplier)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="-mr-2"
                      onClick={() => setDeleteSupplier(supplier)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
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
      ))}

      <CreateSupplierDialog open={createOpen} onOpenChange={setCreateOpen} />

      <EditSupplierDialog
        supplier={editSupplier}
        open={editSupplier !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditSupplier(null);
          }
        }}
        onSave={() => {
          setEditSupplier(null);
        }}
      />

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
