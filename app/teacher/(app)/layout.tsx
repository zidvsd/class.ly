import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getTeacherId } from "@/lib/auth";
import { db } from "@/lib/db";

// Wraps every teacher page (except login): checks the login cookie, then shows the sidebar.
export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const teacherId = await getTeacherId();
  if (!teacherId) redirect("/teacher/login");

  const teacher = await db.query("SELECT name FROM teacher WHERE id = $1", [teacherId]);
  if (teacher.rows.length === 0) redirect("/teacher/login");

  return (
    <SidebarProvider>
      <AppSidebar teacherName={teacher.rows[0].name} />
      <SidebarInset>
        <header className="app-header">
          <SidebarTrigger />
        </header>
        <div className="page">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
