// POST /api/join  { code, name }
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, getStudentId, setLogin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code ?? "").trim().toUpperCase();
    const name = String(body.name ?? "").trim();
    if (!code || !name) return fail(400, "Code and name are required");
    if (name.length > 60) return fail(400, "Name is too long");

    const session = await db.query("SELECT id FROM class_session WHERE code = $1 AND status = 'open'", [code]);
    if (session.rows.length === 0) return fail(404, "Invalid or closed session code");
    const sessionId = session.rows[0].id;

    // Same name again: only allowed from the same phone (it still has the student's cookie).
    const existing = await db.query("SELECT id FROM student WHERE session_id = $1 AND name = $2", [sessionId, name]);
    let studentId = existing.rows[0]?.id;
    if (studentId && studentId !== (await getStudentId())) return fail(409, "Name already taken");

    if (!studentId) {
      const created = await db.query("INSERT INTO student (session_id, name) VALUES ($1, $2) RETURNING id", [sessionId, name]);
      studentId = created.rows[0].id;
    }

    const response = NextResponse.json({ ok: true });
    setLogin(response, "student", studentId);
    return response;
  } catch (e) {
    return fail(500, "Failed to join", e);
  }
}
