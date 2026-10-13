// POST /api/activities/:id/end  -> teacher ends the activity early; everyone is graded
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, getTeacherId } from "@/lib/auth";
import { finalizeActivity } from "@/lib/finalize";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacherId = await getTeacherId();
    if (!teacherId) return fail(401, "Unauthorized");

    const { id } = await params;
    const owned = await db.query(
      `SELECT 1 FROM activity a
         JOIN class_session s ON s.id = a.session_id
         JOIN section sec ON sec.id = s.section_id
        WHERE a.id = $1 AND sec.teacher_id = $2`,
      [id, teacherId],
    );
    if (owned.rows.length === 0) return fail(404, "Activity not found");

    const graded = await finalizeActivity(id);
    if (graded === null) return fail(409, "Activity is not running");
    return NextResponse.json({ graded });
  } catch (e) {
    return fail(500, "Failed to end activity", e);
  }
}
