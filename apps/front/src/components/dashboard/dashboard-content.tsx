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
import { useRef, useState } from "react";
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
import { useUpdateCashier } from "@/hooks/mutations/use-update-cashier";
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
type CashierShiftData = TenantCashierData["cashierShifts"][number];

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
  latestShift: CashierShiftData | null;
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
  canManageCashiers: boolean;
  onEditCashier: (cashier: TenantCashierData) => void;
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

function normalizeMoney(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function getDisplayName(cashier: TenantCashierData): string {
  return cashier.name.trim() || cashier.email || "Cajero";
}

function formatDateTime(value: string | null | undefined): string {
  return value ? format(new Date(value), "dd/MM/yyyy HH:mm") : "Sin registro";
}

function getLatestShift(cashier: TenantCashierData): CashierShiftData | null {
  const [latestShift] = cashier.cashierShifts;

  return latestShift ?? null;
}

function getShiftTopProduct(
  shift: CashierShiftData | null
): { name: string; quantity: number } | null {
  const [product] = shift?.soldProducts ?? [];

  if (!product) {
    return null;
  }

  return {
    name: product.name,
    quantity: product.quantity,
  };
}

function getShiftEndLabel(shift: CashierShiftData | null): string {
  if (!shift) {
    return "Sin registro";
  }

  if (shift.closedAt) {
    return formatDateTime(shift.closedAt);
  }

  return "En curso";
}

function getShiftStatusLabel(shift: CashierShiftData | null): string {
  if (!shift) {
    return "Sin turno";
  }

  if (shift.status === "OPEN") {
    return "Turno abierto";
  }

  if (shift.status === "CLOSED") {
    return "Turno cerrado";
  }

  return "Sin turno";
}

function formatDashboardError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "No se pudieron cargar las estadísticas";
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
    latestShift: getLatestShift(cashier),
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

function CashierCard({
  canManageCashiers,
  cashier,
  onEditCashier,
  summary,
}: CashierCardProps) {
  const displayName = getDisplayName(cashier);
  const initials = getInitials(displayName);
  const { latestShift } = summary;
  const latestShiftTopProduct = getShiftTopProduct(latestShift);

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
              <p className="mt-1 text-muted-foreground text-xs">
                Código: {cashier.cashierCode ?? "Sin código"} ·{" "}
                {getShiftStatusLabel(latestShift)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                cashier.isActive
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {cashier.isActive ? "Activo" : "Inactivo"}
            </span>
            {canManageCashiers ? (
              <Button
                className="shrink-0"
                onClick={() => onEditCashier(cashier)}
                size="sm"
                variant="ghost"
              >
                <PencilLine className="size-4" />
                Editar
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardPanel className="space-y-3 pt-0">
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Inicio de turno</span>
            <span className="font-medium tabular-nums">
              {formatDateTime(latestShift?.openedAt)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Fin de turno</span>
            <span className="font-medium tabular-nums">
              {getShiftEndLabel(latestShift)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Fondo inicial</span>
            <span className="font-medium tabular-nums">
              {formatMoney(
                normalizeMoney(latestShift?.openingCash ?? DEFAULT_OPENING_CASH)
              )}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Ventas del día</span>
            <span className="font-medium tabular-nums">
              {formatMoney(summary.todaySales)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Corte de caja</span>
            <span className="font-medium tabular-nums">
              {latestShift?.status === "CLOSED"
                ? formatMoney(normalizeMoney(latestShift.closingCash))
                : "Pendiente"}
            </span>
          </div>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-muted-foreground text-xs">Producto más vendido</p>
          <p className="font-medium text-sm leading-tight">
            {latestShiftTopProduct?.name ?? summary.topProduct.name}
          </p>
          <p className="text-muted-foreground text-xs">
            {(latestShiftTopProduct?.quantity ?? summary.topProduct.quantity) ||
              0}{" "}
            unidades
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
  canManageCashiers,
  disabled,
  onAddCashier,
}: {
  canManageCashiers: boolean;
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
        {canManageCashiers ? (
          <Button
            className="w-full"
            disabled={disabled}
            onClick={onAddCashier}
            variant="outline"
          >
            <UserPlus className="size-4" />
            Agregar cajero
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Solo el dueño puede agregar cajeros.
          </p>
        )}
      </CardPanel>
    </Card>
  );
}

interface CashierSectionProps {
  canManageCashiers: boolean;
  canAddCashier: boolean;
  cashierLabel: string;
  cashierLimit: number;
  cashierSlotsLeft: number;
  now: Date;
  onAddCashier: () => void;
  onEditCashier: (cashier: TenantCashierData) => void;
  productCostMap: Map<string, number>;
  sales: Sale[];
  tenant: TenantData;
}

function CashierSection({
  canManageCashiers,
  canAddCashier,
  cashierLabel,
  cashierLimit,
  cashierSlotsLeft,
  now,
  onAddCashier,
  onEditCashier,
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
          {canManageCashiers ? (
            <Button
              disabled={!canAddCashier}
              onClick={onAddCashier}
              size="sm"
              variant="outline"
            >
              <UserPlus className="size-4" />
              Agregar cajero
            </Button>
          ) : null}
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
            canManageCashiers={canManageCashiers}
            disabled={!canAddCashier}
            onAddCashier={onAddCashier}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tenant.users.map((cashier) => (
              <CashierCard
                key={cashier.id}
                canManageCashiers={canManageCashiers}
                cashier={cashier}
                onEditCashier={onEditCashier}
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
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              variant="outline"
            >
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
            Se generarán su código y su PIN para que pueda entrar como cajero.
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
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              variant="outline"
            >
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

interface EditCashierDialogProps {
  error: Error | null;
  isPending: boolean;
  onNameChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onPinChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  pinValue: string;
  nameValue: string;
}

function EditCashierDialog({
  error,
  isPending,
  onNameChange,
  onOpenChange,
  onPinChange,
  onSubmit,
  open,
  pinValue,
  nameValue,
}: EditCashierDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cajero</DialogTitle>
          <DialogDescription>
            Cambia el nombre o la contraseña del cajero.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2 text-left">
            <Label htmlFor="edit-cashier-name">Nombre del cajero</Label>
            <Input
              autoComplete="off"
              id="edit-cashier-name"
              minLength={2}
              placeholder="Ej. Ana López"
              required
              value={nameValue}
              onChange={(event) => onNameChange(event.target.value)}
            />
          </div>
          <div className="space-y-2 text-left">
            <Label htmlFor="edit-cashier-pin">Nueva contraseña</Label>
            <Input
              autoComplete="new-password"
              id="edit-cashier-pin"
              inputMode="numeric"
              placeholder="Deja vacío para conservar la actual"
              type="password"
              value={pinValue}
              onChange={(event) => onPinChange(event.target.value)}
            />
          </div>
          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error.message}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              variant="outline"
            >
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
  const updateCashierMutation = useUpdateCashier();
  const [isOpeningCashDialogOpen, setIsOpeningCashDialogOpen] = useState(false);
  const [openingCashDraft, setOpeningCashDraft] = useState(
    String(DEFAULT_OPENING_CASH)
  );
  const [isCashierDialogOpen, setIsCashierDialogOpen] = useState(false);
  const [isEditCashierDialogOpen, setIsEditCashierDialogOpen] = useState(false);
  const [cashierName, setCashierName] = useState("");
  const editingCashierRef = useRef<TenantCashierData | null>(null);
  const [editingCashierName, setEditingCashierName] = useState("");
  const [editingCashierPin, setEditingCashierPin] = useState("");
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
    const errorMessage = formatDashboardError(error);

    return (
      <p className="text-destructive text-sm" role="alert">
        {errorMessage}
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
  const canManageCashiers = tenantData?.role !== "CASHIER";
  const canAddCashier = canManageCashiers && cashierSlotsLeft > 0;

  function handleOpenOpeningCashDialog() {
    if (!canManageCashiers) {
      return;
    }

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

  function handleOpenEditCashierDialog(cashier: TenantCashierData) {
    if (!canManageCashiers) {
      return;
    }

    updateCashierMutation.reset();
    editingCashierRef.current = cashier;
    setEditingCashierName(cashier.name);
    setEditingCashierPin("");
    setIsEditCashierDialogOpen(true);
  }

  function handleEditCashierSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const editingCashier = editingCashierRef.current;

    if (!editingCashier) {
      return;
    }

    const trimmedName = editingCashierName.trim();

    if (!trimmedName) {
      return;
    }

    const trimmedPin = editingCashierPin.trim();

    updateCashierMutation.mutate(
      {
        cashierId: editingCashier.id,
        data: {
          name: trimmedName,
          ...(trimmedPin ? { pin: trimmedPin } : {}),
        },
      },
      {
        onSuccess: (data) => {
          setIsEditCashierDialogOpen(false);
          editingCashierRef.current = null;
          setEditingCashierName("");
          setEditingCashierPin("");

          if (data.temporaryPin) {
            setLatestCashierCredential({
              cashierName: data.cashier.name,
              temporaryPin: data.temporaryPin,
            });
          }
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
            canManageCashiers ? (
              <Button
                onClick={handleOpenOpeningCashDialog}
                size="xs"
                variant="outline"
              >
                <PencilLine className="size-4" />
                Editar
              </Button>
            ) : undefined
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
        canManageCashiers={canManageCashiers}
        canAddCashier={canAddCashier}
        cashierLabel={cashierLabel}
        cashierLimit={cashierLimit}
        cashierSlotsLeft={cashierSlotsLeft}
        now={now}
        onAddCashier={handleOpenCashierDialog}
        onEditCashier={handleOpenEditCashierDialog}
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

      <EditCashierDialog
        error={
          updateCashierMutation.error instanceof Error
            ? updateCashierMutation.error
            : null
        }
        isPending={updateCashierMutation.isPending}
        nameValue={editingCashierName}
        onNameChange={setEditingCashierName}
        onOpenChange={(open) => {
          setIsEditCashierDialogOpen(open);

          if (!open) {
            editingCashierRef.current = null;
            setEditingCashierName("");
            setEditingCashierPin("");
          }
        }}
        onPinChange={setEditingCashierPin}
        onSubmit={handleEditCashierSubmit}
        open={isEditCashierDialogOpen}
        pinValue={editingCashierPin}
      />
    </div>
  );
}
