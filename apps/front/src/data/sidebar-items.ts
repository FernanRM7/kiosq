import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
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
  { icon: LayoutDashboard, title: "Dashboard", url: "/dashboard" },
  { icon: Package, title: "Products", url: "/dashboard/products" },
  { icon: DollarSign, title: "Sales", url: "/dashboard/sales" },
  { icon: Truck, title: "Suppliers", url: "/dashboard/suppliers" },
];

export const bottomNavItems: NavItem[] = [
  { icon: Settings, title: "Settings", url: "/dashboard/settings" },
  { icon: LifeBuoy, title: "Support", url: "/dashboard/support" },
];
