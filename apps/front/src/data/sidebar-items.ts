import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  Tags,
  DollarSign,
  LifeBuoy,
  Truck,
  Settings,
} from "lucide-react";

import type { AppRole } from "@/lib/access";

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  allowedRoles: readonly AppRole[];
}

export const mainNavItems: NavItem[] = [
  {
    allowedRoles: ["CASHIER", "MANAGER", "ADMIN", "SUPER_ADMIN"],
    icon: LayoutDashboard,
    title: "Inicio",
    url: "/dashboard",
  },
  {
    allowedRoles: ["MANAGER", "ADMIN", "SUPER_ADMIN"],
    icon: Package,
    title: "Productos",
    url: "/dashboard/products",
  },
  {
    allowedRoles: ["MANAGER", "ADMIN", "SUPER_ADMIN"],
    icon: Tags,
    title: "Categorías",
    url: "/dashboard/categories",
  },
  {
    allowedRoles: ["CASHIER", "MANAGER", "ADMIN", "SUPER_ADMIN"],
    icon: DollarSign,
    title: "Ventas",
    url: "/dashboard/sales",
  },
  {
    allowedRoles: ["MANAGER", "ADMIN", "SUPER_ADMIN"],
    icon: Truck,
    title: "Proveedores",
    url: "/dashboard/suppliers",
  },
];

export const bottomNavItems: NavItem[] = [
  {
    allowedRoles: ["CASHIER", "MANAGER", "ADMIN", "SUPER_ADMIN"],
    icon: LifeBuoy,
    title: "Soporte",
    url: "/dashboard/support",
  },
  {
    allowedRoles: ["ADMIN", "SUPER_ADMIN"],
    icon: Settings,
    title: "Ajustes",
    url: "/dashboard/settings",
  },
];
