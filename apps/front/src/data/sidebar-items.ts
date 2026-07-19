import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  Tags,
  DollarSign,
  Truck,
  Settings,
  LifeBuoy,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

export const mainNavItems: NavItem[] = [
  { icon: LayoutDashboard, title: "Panel", url: "/dashboard" },
  { icon: Package, title: "Productos", url: "/dashboard/products" },
  { icon: Tags, title: "Categorías", url: "/dashboard/categories" },
  { icon: DollarSign, title: "Ventas", url: "/dashboard/sales" },
  { icon: Truck, title: "Proveedores", url: "/dashboard/suppliers" },
];

export const bottomNavItems: NavItem[] = [
  { icon: Settings, title: "Ajustes", url: "/dashboard/settings" },
  { icon: LifeBuoy, title: "Soporte", url: "/dashboard/support" },
];
