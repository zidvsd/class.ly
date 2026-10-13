// GET  /api/sessions                   -> the teacher's open sessions (sidebar)
// POST /api/sessions { sectionId, name } -> starts a session with a new 6-character join code
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, getTeacherId } from "@/lib/auth";

// No 0/O or 1/I so codes are easy to read off the board.
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode() {
  let code = "";
  for (let i = 0; i < 6; i++) code += LETTERS[crypto.randomInt(LETTERS.length)];
  return code;
}

export async function GET() {
  try {
    const teacherId = await getTeacherId();
    if (!teacherId) return fail(401, "Unauthorized");

    const res = await db.query(
      `SELECT s.id, s.code, COALESCE(NULLIF(s.name, ''), sec.name) AS name
         FROM class_session s JOIN section sec ON sec.id = s.section_id
        WHERE sec.teacher_id = $1 AND s.status = 'open'
        ORDER BY s.created_at DESC LIMIT 8`,
      [teacherId],
    );
    return NextResponse.json({ sessions: res.rows });
  } catch (e) {
    return fail(500, "Failed to fetch sessions", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const teacherId = await getTeacherId();
    if (!teacherId) return fail(401, "Unauthorized");

    const { sectionId, name } = await req.json();
    const section = await db.query("SELECT 1 FROM section WHERE id = $1 AND teacher_id = $2", [sectionId, teacherId]);
    if (section.rows.length === 0) return fail(404, "Section not found");

    const res = await db.query(
      "INSERT INTO class_session (section_id, name, code) VALUES ($1, $2, $3) RETURNING id, code",
      [sectionId, name?.trim() ?? "", makeCode()],
    );
    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (e) {
    return fail(500, "Failed to create session", e);
  }
}
