import { format } from "date-fns";

import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 2,
  style: "currency",
});

const suppliers = [
  {
    amount: 18_450.75,
    category: "Refrescos y bebidas",
    items: 128,
    lastPurchase: "2026-07-18T14:30:00.000Z",
    name: "Coca-Cola FEMSA",
  },
  {
    amount: 12_680.4,
    category: "Pan de caja y repostería",
    items: 94,
    lastPurchase: "2026-07-18T10:15:00.000Z",
    name: "Grupo Bimbo",
  },
  {
    amount: 9880.25,
    category: "Botanas y frituras",
    items: 76,
    lastPurchase: "2026-07-17T18:40:00.000Z",
    name: "Sabritas",
  },
  {
    amount: 11_120.9,
    category: "Lácteos",
    items: 61,
    lastPurchase: "2026-07-17T13:20:00.000Z",
    name: "Lala",
  },
  {
    amount: 7425.3,
    category: "Lácteos y crema",
    items: 48,
    lastPurchase: "2026-07-16T11:05:00.000Z",
    name: "Alpura",
  },
  {
    amount: 9365.6,
    category: "Cárnicos y embutidos",
    items: 53,
    lastPurchase: "2026-07-16T16:50:00.000Z",
    name: "Sigma Alimentos",
  },
  {
    amount: 6580.15,
    category: "Galletas y cereal",
    items: 42,
    lastPurchase: "2026-07-15T09:25:00.000Z",
    name: "Nestlé",
  },
  {
    amount: 7894.2,
    category: "Botanas saladas",
    items: 57,
    lastPurchase: "2026-07-15T17:10:00.000Z",
    name: "PepsiCo",
  },
] as const;

function formatMoney(value: number): string {
  return currencyFormatter.format(value);
}

export default function SuppliersPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-lg">Compras por proveedor</h1>
        <p className="text-muted-foreground text-sm">
          Resumen de lo que se ha surtido para una tienda de abarrotes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {suppliers.map((supplier) => (
          <Card key={supplier.name}>
            <CardHeader className="gap-2">
              <CardTitle className="text-base">{supplier.name}</CardTitle>
              <CardDescription>{supplier.category}</CardDescription>
            </CardHeader>
            <CardPanel className="space-y-2 pt-0">
              <p className="font-semibold text-2xl tabular-nums">
                {formatMoney(supplier.amount)}
              </p>
              <div className="flex items-center justify-between gap-3 text-muted-foreground text-sm">
                <span>{supplier.items} piezas</span>
                <span>
                  {format(new Date(supplier.lastPurchase), "dd/MM/yyyy")}
                </span>
              </div>
            </CardPanel>
          </Card>
        ))}
      </div>
    </div>
  );
}
