"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboardIcon, LogOutIcon, RadioIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { call } from "@/lib/client";

type LiveSession = { id: string; code: string; name: string };

export function AppSidebar({ teacherName }: { teacherName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessions, setSessions] = useState<LiveSession[]>([]);

  // Reload the list on every page change so a new session shows up right away.
  useEffect(() => {
    call("GET", "/api/sessions").then((r) => r.ok && setSessions(r.data.sessions));
  }, [pathname]);

  async function logout() {
    await call("POST", "/api/teacher/logout");
    router.replace("/teacher/login");
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/teacher/dashboard" />} tooltip="Class.ly">
              <Image src="/Classly_Logo.svg" alt="" width={32} height={32} className="size-8 shrink-0" />
              <span className="text-xs text-muted-foreground">Teacher</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/teacher/dashboard" />}
                isActive={pathname === "/teacher/dashboard"}
                tooltip="Dashboard"
              >
                <LayoutDashboardIcon />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {sessions.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Live sessions</SidebarGroupLabel>
            <SidebarMenu>
              {sessions.map((s) => (
                <SidebarMenuItem key={s.id}>
                  <SidebarMenuButton
                    render={<Link href={`/teacher/session/${s.id}`} />}
                    isActive={pathname.startsWith(`/teacher/session/${s.id}`)}
                    tooltip={s.name}
                  >
                    <RadioIcon />
                    <span>{s.name}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge className="font-mono">{s.code}</SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} tooltip="Log out">
              <LogOutIcon />
              <span>Log out ({teacherName})</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
