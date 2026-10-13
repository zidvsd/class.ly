// POST /api/teacher/logout
import { NextResponse } from "next/server";
import { clearLogin } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearLogin(response, "teacher");
  return response;
}
