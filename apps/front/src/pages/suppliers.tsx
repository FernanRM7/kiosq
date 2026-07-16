import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardPanel,
} from "@/components/ui/card";
import { useSuppliers } from "@/hooks/queries/use-suppliers";

const EMPTY_LIST = { active: [], deleted: [] };

export default function SuppliersPage() {
  const { data: suppliers = EMPTY_LIST, error, isLoading } = useSuppliers();

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
                    <CardTitle>{supplier.name}</CardTitle>
                    <CardDescription>
                      {supplier.email ?? "Sin email"}
                    </CardDescription>
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
    </div>
  );
}
