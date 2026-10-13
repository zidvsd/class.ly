// POST /api/teacher/pin  { oldPin, newPin }  -> changes the logged-in teacher's PIN
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, getTeacherId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const teacherId = await getTeacherId();
    if (!teacherId) return fail(401, "Unauthorized");

    const { oldPin, newPin } = await req.json();
    if (String(newPin ?? "").length < 4) return fail(400, "New PIN must be at least 4 characters");

    // Only updates if the old PIN is correct. The new PIN is stored as a bcrypt hash.
    const res = await db.query(
      `UPDATE teacher SET pin_hash = crypt($3, gen_salt('bf'))
        WHERE id = $1 AND pin_hash = crypt($2, pin_hash)`,
      [teacherId, String(oldPin ?? ""), String(newPin)],
    );
    if (res.rowCount === 0) return fail(400, "Old PIN is wrong");

    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(500, "Failed to change PIN", e);
  }
}
