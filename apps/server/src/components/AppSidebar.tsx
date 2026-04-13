import { Link, useRouterState } from "@tanstack/react-router";
import { HomeIcon, ZapIcon, ServerIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "./ui/sidebar";

const navItems = [
  { title: "Home", to: "/", icon: HomeIcon },
  { title: "Query + Hono", to: "/demo/tanstack-query", icon: ZapIcon },
  { title: "Query + Server Fn", to: "/demo/tanstack-query-server", icon: ServerIcon },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={pathname === item.to}>
                    <Link to={item.to}>
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
    </Sidebar>
  );
}
