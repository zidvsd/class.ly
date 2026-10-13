// GET  /api/sections            -> the teacher's sections
// POST /api/sections { name, subject? }
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, getTeacherId } from "@/lib/auth";

export async function GET() {
  try {
    const teacherId = await getTeacherId();
    if (!teacherId) return fail(401, "Unauthorized");

    const res = await db.query("SELECT id, name, subject FROM section WHERE teacher_id = $1 ORDER BY name", [teacherId]);
    return NextResponse.json({ sections: res.rows });
  } catch (e) {
    return fail(500, "Failed to fetch sections", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const teacherId = await getTeacherId();
    if (!teacherId) return fail(401, "Unauthorized");

    const { name, subject } = await req.json();
    if (!name?.trim()) return fail(400, "Section name is required");

    const res = await db.query(
      "INSERT INTO section (teacher_id, name, subject) VALUES ($1, $2, $3) RETURNING id, name, subject",
      [teacherId, name.trim(), subject?.trim() || null],
    );
    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (e: any) {
    if (e.code === "23505") return fail(409, "Section name already exists"); // unique violation
    return fail(500, "Failed to create section", e);
  }
}
