import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";

import { UserNav } from "@/components/dashboard/user-nav";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { mainNavItems, bottomNavItems } from "@/data/sidebar-items";
import { useAuth } from "@/hooks/use-auth";
import { hasRoleAccess } from "@/lib/access";

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const storedTheme = window.localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    return storedTheme === "dark" || (!storedTheme && prefersDark)
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const handleToggle = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    window.localStorage.setItem("theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={handleToggle}
          variant="outline"
          className="justify-start gap-3"
        >
          {theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
          <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function DashboardSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const visibleMainNavItems = mainNavItems.filter((item) =>
    hasRoleAccess(user?.role, item.allowedRoles)
  );
  const visibleBottomNavItems = bottomNavItems.filter((item) =>
    hasRoleAccess(user?.role, item.allowedRoles)
  );

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="rounded-[2.25rem] border border-sidebar-border/40 bg-sidebar/85 px-3 py-4 shadow-sm shadow-black/10 dark:bg-sidebar/95 dark:border-sidebar-border/30">
        <div className="flex flex-col gap-3">
          <WorkspaceSwitcher />
          <div className="rounded-[1.75rem] border border-sidebar-border/15 bg-sidebar/80 p-2 shadow-sm shadow-black/5 dark:bg-sidebar/15 dark:border-sidebar-border/15">
            <ThemeToggle />
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-[0.25em] text-xs font-semibold text-sidebar-foreground/60">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="mt-auto" />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleBottomNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <UserNav />
      </SidebarFooter>
    </Sidebar>
  );
}
