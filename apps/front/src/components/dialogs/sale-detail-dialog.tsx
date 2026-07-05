import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Sale } from "@/lib/sales";

interface SaleDetailDialogProps {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const paymentMethodLabels: Record<string, string> = {
  CARD: "Tarjeta",
  CASH: "Efectivo",
  CREDIT: "Crédito",
  QR: "QR",
  TRANSFER: "Transferencia",
};

export function SaleDetailDialog({
  sale,
  open,
  onOpenChange,
}: SaleDetailDialogProps) {
  if (!sale) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Venta del {format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm")}
          </DialogTitle>
          <DialogDescription>
            {sale.items.length}{" "}
            {sale.items.length === 1 ? "producto" : "productos"} —{" "}
            {sale.status === "COMPLETED" ? "Completada" : sale.status}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h4 className="mb-2 font-medium text-sm">Productos</h4>
            <div className="divide-y">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 font-medium text-muted-foreground text-xs">
                <span>Producto</span>
                <span className="text-right">Cant.</span>
                <span className="w-20 text-right">Subtotal</span>
              </div>
              {sale.items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-sm"
                >
                  <span className="truncate">{item.product.name}</span>
                  <span className="tabular-nums text-right">
                    ×{item.quantity}
                  </span>
                  <span className="w-20 tabular-nums text-right">
                    ${item.subtotal.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {sale.payments.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium text-sm">Pagos</h4>
              {sale.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span>
                    {paymentMethodLabels[payment.method] ?? payment.method}
                  </span>
                  <span className="tabular-nums font-medium">
                    ${payment.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">${sale.subtotal.toFixed(2)}</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Descuento</span>
                <span className="tabular-nums">
                  -${sale.discountAmount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>IVA</span>
              <span className="tabular-nums">${sale.taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">${sale.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
