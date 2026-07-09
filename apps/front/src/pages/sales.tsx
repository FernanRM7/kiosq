import { format } from "date-fns";
import { useState } from "react";
import type { ReactNode } from "react";

import { SaleDetailDialog } from "@/components/dialogs/sale-detail-dialog";
import { Card, CardHeader, CardTitle, CardPanel } from "@/components/ui/card";
import { useSales } from "@/hooks/queries/use-sales";
import type { Sale } from "@/lib/sales";

export default function SalesPage() {
  const { data: sales = [], error, isLoading } = useSales();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  let content: ReactNode;

  if (isLoading) {
    content = (
      <p className="text-muted-foreground text-sm">Cargando ventas...</p>
    );
  } else if (sales.length === 0) {
    content = (
      <p className="text-muted-foreground text-sm">No hay ventas registradas</p>
    );
  } else {
    content = (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sales.map((sale) => (
          <Card
            key={sale.id}
            className="cursor-pointer"
            onClick={() => setSelectedSale(sale)}
          >
            <CardHeader>
              <CardTitle className="text-sm">
                {format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm")}
              </CardTitle>
            </CardHeader>
            <CardPanel>
              <div className="flex flex-col gap-2">
                <span className="font-semibold text-lg tabular-nums">
                  ${sale.total.toFixed(2)}
                </span>

                <div className="flex flex-col text-muted-foreground text-xs leading-relaxed">
                  {sale.items.slice(0, 3).map((item) => (
                    <span key={item.id} className="truncate tabular-nums">
                      {item.product.name}{" "}
                      <span className="text-muted-foreground/60">×</span>
                      {item.quantity}
                    </span>
                  ))}
                  {sale.items.length > 3 && (
                    <span className="font-medium text-foreground/60">
                      +{sale.items.length - 3} más
                    </span>
                  )}
                </div>

                <span className="text-muted-foreground text-xs">
                  Sub: ${sale.subtotal.toFixed(2)} | IVA: $
                  {sale.taxAmount.toFixed(2)}
                </span>
              </div>
            </CardPanel>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 font-semibold text-lg">Sales</h1>
      {error && (
        <p className="mb-4 text-destructive text-sm">
          {error instanceof Error
            ? error.message
            : "No se pudieron cargar las ventas"}
        </p>
      )}
      {content}

      <SaleDetailDialog
        sale={selectedSale}
        open={selectedSale !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSale(null);
          }
        }}
      />
    </div>
  );
}
