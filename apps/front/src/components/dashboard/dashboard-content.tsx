import { format } from "date-fns";
import {
  Banknote,
  DollarSign,
  Package,
  PencilLine,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCashier } from "@/hooks/mutations/use-create-cashier";
import { useUpdateTenantSettings } from "@/hooks/mutations/use-update-tenant-settings";
import { useProducts } from "@/hooks/queries/use-products";
import { useSales } from "@/hooks/queries/use-sales";
import { useMyTenant } from "@/hooks/queries/use-tenants";
import type { MyTenantData } from "@/lib/auth";
import type { Product } from "@/lib/products";
import type { Sale } from "@/lib/sales";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 2,
  style: "currency",
});

const DEFAULT_OPENING_CASH = 500;

type TenantData = NonNullable<MyTenantData["tenant"]>;
type TenantCashierData = TenantData["users"][number];

interface PeriodSummary {
  todaySales: number;
  topProduct: {
    name: string;
    quantity: number;
  };
  weeklyProfit: number;
}

interface CashierSummary extends PeriodSummary {
  lastLoginAt: string | null;
}

interface MetricCardProps {
  action?: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
  value: string;
}

interface CashierCardProps {
  cashier: TenantCashierData;
  summary: CashierSummary;
}

interface CashierCredential {
  cashierName: string;
  temporaryPin: string;
}

interface TopProductCardProps {
  quantity: number;
  title: string;
}

function formatMoney(value: number): string {
  return currencyFormatter.format(value);
}

function getDisplayName(cashier: TenantCashierData): string {
  return cashier.name.trim() || cashier.email || "Cajero";
}

function getInitials(name: string): string {
  const parts = name.split(/[.\s@_-]+/u).filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getWeekStart(reference: Date): Date {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);

  const weekday = start.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;

  start.setDate(start.getDate() + offset);

  return start;
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isRevenueSale(sale: Sale): boolean {
  return sale.status !== "CANCELLED" && sale.status !== "REFUNDED";
}

function getCashierLabel(totalCashiers: number): string {
  if (totalCashiers === 0) {
    return "Aún no hay cajeros registrados";
  }

  if (totalCashiers === 1) {
    return "1 cajero registrado";
  }

  return `${totalCashiers} cajeros registrados`;
}

function normalizeTenantSettings(
  settings: TenantData["settings"]
): Record<string, unknown> {
  if (!settings || typeof settings !== "object") {
    return {};
  }

  return { ...settings };
}

function getOpeningCash(settings: TenantData["settings"]): number {
  const value = normalizeTenantSettings(settings)["cashOpeningAmount"];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : DEFAULT_OPENING_CASH;
}

function getProductCostMap(products: Product[]): Map<string, number> {
  return new Map(products.map((product) => [product.id, product.cost ?? 0]));
}

function sumSalesTotal(sales: Sale[]): number {
  let total = 0;

  for (const sale of sales) {
    total += sale.total;
  }

  return total;
}

function sumEstimatedProfit(
  sales: Sale[],
  productCostMap: Map<string, number>
): number {
  let total = 0;

  for (const sale of sales) {
    let saleProfit = 0;

    for (const item of sale.items) {
      const productCost = productCostMap.get(item.productId) ?? 0;

      saleProfit += item.subtotal - productCost * item.quantity;
    }

    total += saleProfit;
  }

  return total;
}

function getTopProduct(sales: Sale[]): { name: string; quantity: number } {
  const products = new Map<string, { name: string; quantity: number }>();

  for (const sale of sales) {
    for (const item of sale.items) {
      const current = products.get(item.productId);

      if (current) {
        current.quantity += item.quantity;
        continue;
      }

      products.set(item.productId, {
        name: item.product.name,
        quantity: item.quantity,
      });
    }
  }

  let topProduct: { name: string; quantity: number } | null = null;

  for (const product of products.values()) {
    if (topProduct === null || product.quantity > topProduct.quantity) {
      topProduct = product;
    }
  }

  return topProduct ?? { name: "Sin ventas", quantity: 0 };
}

function buildPeriodSummary(
  sales: Sale[],
  reference: Date,
  productCostMap: Map<string, number>
): PeriodSummary {
  const revenueSales = sales.filter(isRevenueSale);
  const weekStart = getWeekStart(reference);
  const todaySales = revenueSales.filter((sale) =>
    isSameLocalDay(new Date(sale.createdAt), reference)
  );
  const weekSales = revenueSales.filter(
    (sale) => new Date(sale.createdAt) >= weekStart
  );

  return {
    todaySales: sumSalesTotal(todaySales),
    topProduct: getTopProduct(weekSales),
    weeklyProfit: sumEstimatedProfit(weekSales, productCostMap),
  };
}

function buildCashierSummary(
  cashier: TenantCashierData,
  sales: Sale[],
  reference: Date,
  productCostMap: Map<string, number>
): CashierSummary {
  const cashierSales = sales.filter((sale) => sale.userId === cashier.id);
  const summary = buildPeriodSummary(cashierSales, reference, productCostMap);

  return {
    ...summary,
    lastLoginAt: cashier.lastLoginAt,
  };
}

function MetricCard({
  action,
  description,
  icon: Icon,
  title,
  value,
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <div className="flex items-center gap-2">
            {action}
            <Icon className="size-4 text-muted-foreground" />
          </div>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardPanel>
        <span className="font-semibold text-2xl tabular-nums">{value}</span>
      </CardPanel>
    </Card>
  );
}

function TopProductCard({ quantity, title }: TopProductCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Producto más vendido</CardTitle>
          <Package className="size-4 text-muted-foreground" />
        </div>
        <CardDescription>Acumulado de la semana</CardDescription>
      </CardHeader>
      <CardPanel className="space-y-2">
        <p className="font-semibold text-lg leading-tight">{title}</p>
        <p className="text-muted-foreground text-sm">
          {quantity} unidades vendidas
        </p>
      </CardPanel>
    </Card>
  );
}

function CashierCard({ cashier, summary }: CashierCardProps) {
  const displayName = getDisplayName(cashier);
  const initials = getInitials(displayName);

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-10 rounded-2xl ring-1 ring-border/60">
              <AvatarFallback className="rounded-2xl bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="truncate text-base">
                {displayName}
              </CardTitle>
              <CardDescription className="truncate">
                {cashier.email ?? "Correo no registrado"}
              </CardDescription>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              cashier.isActive
                ? "bg-emerald-100 text-emerald-800"
                : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {cashier.isActive ? "Activo" : "Inactivo"}
          </span>
        </div>
      </CardHeader>
      <CardPanel className="space-y-3 pt-0">
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Ventas del día</span>
            <span className="font-medium tabular-nums">
              {formatMoney(summary.todaySales)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Ganancia semanal</span>
            <span className="font-medium tabular-nums">
              {formatMoney(summary.weeklyProfit)}
            </span>
          </div>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-muted-foreground text-xs">Producto más vendido</p>
          <p className="font-medium text-sm leading-tight">
            {summary.topProduct.name}
          </p>
          <p className="text-muted-foreground text-xs">
            {summary.topProduct.quantity} unidades
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          Último acceso:{" "}
          {summary.lastLoginAt
            ? format(new Date(summary.lastLoginAt), "dd/MM/yyyy HH:mm")
            : "Nunca"}
        </p>
      </CardPanel>
    </Card>
  );
}

function CashierEmptyState({
  disabled,
  onAddCashier,
}: {
  disabled?: boolean;
  onAddCashier: () => void;
}) {
  return (
    <Card className="border-dashed bg-muted/20">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">
            No hay cajeros registrados
          </CardTitle>
          <Users className="size-4 text-muted-foreground" />
        </div>
        <CardDescription>
          Agrega el primero para empezar a vender.
        </CardDescription>
      </CardHeader>
      <CardPanel className="space-y-3 pt-0">
        <p className="text-sm text-muted-foreground">
          Tu plan permite registrar cajeros y ver su resumen individual.
        </p>
        <Button
          className="w-full"
          disabled={disabled}
          onClick={onAddCashier}
          variant="outline"
        >
          <UserPlus className="size-4" />
          Agregar cajero
        </Button>
      </CardPanel>
    </Card>
  );
}

interface CashierSectionProps {
  canAddCashier: boolean;
  cashierLabel: string;
  cashierLimit: number;
  cashierSlotsLeft: number;
  now: Date;
  onAddCashier: () => void;
  productCostMap: Map<string, number>;
  sales: Sale[];
  tenant: TenantData;
}

function CashierSection({
  canAddCashier,
  cashierLabel,
  cashierLimit,
  cashierSlotsLeft,
  now,
  onAddCashier,
  productCostMap,
  sales,
  tenant,
}: CashierSectionProps) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Cajeros del plan</CardTitle>
            <CardDescription>
              {tenant.plan
                ? `Tu plan ${tenant.plan.name} permite hasta ${cashierLimit} cajeros registrados.`
                : `Tu plan actual permite hasta ${cashierLimit} cajeros registrados.`}
            </CardDescription>
          </div>
          <Button
            disabled={!canAddCashier}
            onClick={onAddCashier}
            size="sm"
            variant="outline"
          >
            <UserPlus className="size-4" />
            Agregar cajero
          </Button>
        </div>
      </CardHeader>
      <CardPanel className="space-y-4">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">{cashierLabel}</p>
          <p className="text-muted-foreground text-xs">
            {cashierSlotsLeft > 0
              ? `Te quedan ${cashierSlotsLeft} espacios para cajeros.`
              : "Límite de cajeros alcanzado con tu plan actual."}
          </p>
        </div>
        {tenant.users.length === 0 ? (
          <CashierEmptyState
            disabled={!canAddCashier}
            onAddCashier={onAddCashier}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tenant.users.map((cashier) => (
              <CashierCard
                key={cashier.id}
                cashier={cashier}
                summary={buildCashierSummary(
                  cashier,
                  sales,
                  now,
                  productCostMap
                )}
              />
            ))}
          </div>
        )}
      </CardPanel>
    </Card>
  );
}

interface OpeningCashDialogProps {
  error: Error | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onValueChange: (value: string) => void;
  open: boolean;
  value: string;
}

function OpeningCashDialog({
  error,
  isPending,
  onOpenChange,
  onSubmit,
  onValueChange,
  open,
  value,
}: OpeningCashDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar fondo inicial</DialogTitle>
          <DialogDescription>
            Cambia el monto con el que inicia el corte de caja del día.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2 text-left">
            <Label htmlFor="cash-opening-amount">Fondo inicial</Label>
            <Input
              id="cash-opening-amount"
              inputMode="decimal"
              min="0"
              step="0.01"
              type="number"
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
            />
          </div>
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error.message}
            </p>
          )}
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Cancelar
            </Button>
            <Button disabled={isPending} type="submit">
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CashierDialogProps {
  error: Error | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onValueChange: (value: string) => void;
  open: boolean;
  value: string;
}

function CashierDialog({
  error,
  isPending,
  onOpenChange,
  onSubmit,
  onValueChange,
  open,
  value,
}: CashierDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar cajero</DialogTitle>
          <DialogDescription>
            Solo registra el usuario por ahora. Después conectamos el bloqueo
            por computadora.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2 text-left">
            <Label htmlFor="cashier-name">Nombre del cajero</Label>
            <Input
              autoComplete="off"
              id="cashier-name"
              minLength={2}
              placeholder="Ej. Ana López"
              required
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
            />
          </div>
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error.message}
            </p>
          )}
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Cancelar
            </Button>
            <Button disabled={isPending} type="submit">
              Crear cajero
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardContent() {
  const {
    data: tenantData,
    error: tenantError,
    isLoading: isTenantLoading,
  } = useMyTenant();
  const {
    data: products = [],
    error: productsError,
    isLoading: isProductsLoading,
  } = useProducts();
  const {
    data: sales = [],
    error: salesError,
    isLoading: isSalesLoading,
  } = useSales();
  const updateTenantSettingsMutation = useUpdateTenantSettings();
  const createCashierMutation = useCreateCashier();
  const [isOpeningCashDialogOpen, setIsOpeningCashDialogOpen] = useState(false);
  const [openingCashDraft, setOpeningCashDraft] = useState(
    String(DEFAULT_OPENING_CASH)
  );
  const [isCashierDialogOpen, setIsCashierDialogOpen] = useState(false);
  const [cashierName, setCashierName] = useState("");
  const [latestCashierCredential, setLatestCashierCredential] =
    useState<CashierCredential | null>(null);

  const isLoading = isTenantLoading || isProductsLoading || isSalesLoading;
  const error = tenantError ?? productsError ?? salesError;

  const tenant = tenantData?.tenant;

  if (isLoading) {
    return (
      <p className="text-muted-foreground text-sm">Cargando estadísticas...</p>
    );
  }

  if (error) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {error instanceof Error
          ? error.message
          : "No se pudieron cargar las estadísticas"}
      </p>
    );
  }

  if (!tenant) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sin negocio activo</CardTitle>
          <CardDescription>
            Crea o selecciona un negocio para ver las métricas del panel.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const now = new Date();
  const productCostMap = getProductCostMap(products);
  const summary = buildPeriodSummary(sales, now, productCostMap);
  const openingCash = getOpeningCash(tenant.settings);
  const cashierLimit = Math.max((tenant.plan?.maxUsers ?? 3) - 1, 0);
  const totalCashiers = tenant.users.length;
  const cashierLabel = getCashierLabel(totalCashiers);
  const cashierSlotsLeft = Math.max(cashierLimit - totalCashiers, 0);
  const canAddCashier = cashierSlotsLeft > 0;

  function handleOpenOpeningCashDialog() {
    updateTenantSettingsMutation.reset();
    setOpeningCashDraft(String(openingCash));
    setIsOpeningCashDialogOpen(true);
  }

  function handleOpeningCashSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    updateTenantSettingsMutation.mutate(
      {
        cashOpeningAmount: Number(openingCashDraft),
      },
      {
        onSuccess: () => {
          setIsOpeningCashDialogOpen(false);
        },
      }
    );
  }

  function handleOpenCashierDialog() {
    if (!canAddCashier) {
      return;
    }

    createCashierMutation.reset();
    setCashierName("");
    setIsCashierDialogOpen(true);
  }

  function handleCashierSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = cashierName.trim();

    if (!trimmedName) {
      return;
    }

    createCashierMutation.mutate(
      {
        name: trimmedName,
      },
      {
        onSuccess: (data) => {
          setIsCashierDialogOpen(false);
          setCashierName("");
          setLatestCashierCredential({
            cashierName: trimmedName,
            temporaryPin: data.temporaryPin,
          });
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          description="Ventas completadas hoy"
          icon={DollarSign}
          title="Ventas del día"
          value={formatMoney(summary.todaySales)}
        />
        <MetricCard
          description="Monto base para el corte de caja"
          icon={Banknote}
          title="Fondo inicial"
          value={formatMoney(openingCash)}
          action={
            <Button
              onClick={handleOpenOpeningCashDialog}
              size="xs"
              variant="outline"
            >
              <PencilLine className="size-4" />
              Editar
            </Button>
          }
        />
        <MetricCard
          description="Utilidad estimada con costos registrados"
          icon={TrendingUp}
          title="Ganancia semanal"
          value={formatMoney(summary.weeklyProfit)}
        />
        <TopProductCard
          quantity={summary.topProduct.quantity}
          title={summary.topProduct.name}
        />
      </div>

      <CashierSection
        canAddCashier={canAddCashier}
        cashierLabel={cashierLabel}
        cashierLimit={cashierLimit}
        cashierSlotsLeft={cashierSlotsLeft}
        now={now}
        onAddCashier={handleOpenCashierDialog}
        productCostMap={productCostMap}
        sales={sales}
        tenant={tenant}
      />

      {latestCashierCredential && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="gap-2">
            <CardTitle className="text-base">
              Credencial temporal del cajero
            </CardTitle>
            <CardDescription>
              Compártela una sola vez con {latestCashierCredential.cashierName}.
              Después podrá entrar como cajero con su rol básico.
            </CardDescription>
          </CardHeader>
          <CardPanel className="space-y-2 pt-0">
            <p className="text-muted-foreground text-xs">PIN temporal</p>
            <p className="font-mono text-2xl tracking-[0.2em]">
              {latestCashierCredential.temporaryPin}
            </p>
            <p className="text-muted-foreground text-xs">
              Guárdalo o compártelo por un canal seguro. Más adelante podremos
              cambiar este flujo por un acceso por dispositivo.
            </p>
          </CardPanel>
        </Card>
      )}

      <OpeningCashDialog
        error={
          updateTenantSettingsMutation.error instanceof Error
            ? updateTenantSettingsMutation.error
            : null
        }
        isPending={updateTenantSettingsMutation.isPending}
        onOpenChange={setIsOpeningCashDialogOpen}
        onSubmit={handleOpeningCashSubmit}
        onValueChange={setOpeningCashDraft}
        open={isOpeningCashDialogOpen}
        value={openingCashDraft}
      />

      <CashierDialog
        error={
          createCashierMutation.error instanceof Error
            ? createCashierMutation.error
            : null
        }
        isPending={createCashierMutation.isPending}
        onOpenChange={setIsCashierDialogOpen}
        onSubmit={handleCashierSubmit}
        onValueChange={setCashierName}
        open={isCashierDialogOpen}
        value={cashierName}
      />
    </div>
  );
}
