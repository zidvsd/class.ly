import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/Brand";
import { getTeacherId } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function TeacherLoginPage() {
  // Already signed in? Go straight to the dashboard.
  if (await getTeacherId()) redirect("/teacher/dashboard");

  return (
    <>
      <TopBar>
        <Link href="/join" className="text-sm text-muted-foreground">I&apos;m a student</Link>
      </TopBar>
      <main className="page-center">
        <LoginForm />
      </main>
    </>
  );
}
