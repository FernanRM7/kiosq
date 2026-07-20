import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  Tags,
  DollarSign,
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
    title: "Dashboard",
    url: "/dashboard",
  },
  {
    allowedRoles: ["MANAGER", "ADMIN", "SUPER_ADMIN"],
    icon: Package,
    title: "Products",
    url: "/dashboard/products",
  },
  {
    allowedRoles: ["MANAGER", "ADMIN", "SUPER_ADMIN"],
    icon: Tags,
    title: "Categories",
    url: "/dashboard/categories",
  },
  {
    allowedRoles: ["CASHIER", "MANAGER", "ADMIN", "SUPER_ADMIN"],
    icon: DollarSign,
    title: "Sales",
    url: "/dashboard/sales",
  },
  {
    allowedRoles: ["MANAGER", "ADMIN", "SUPER_ADMIN"],
    icon: Truck,
    title: "Suppliers",
    url: "/dashboard/suppliers",
  },
];

export const bottomNavItems: NavItem[] = [
  {
    allowedRoles: ["ADMIN", "SUPER_ADMIN"],
    icon: Settings,
    title: "Settings",
    url: "/dashboard/settings",
  },
];
