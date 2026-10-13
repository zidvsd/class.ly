// POST /api/teacher/login  { pin }
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, setLogin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();
    if (!pin) return fail(400, "PIN is required");

    // PINs are stored as bcrypt hashes; Postgres (pgcrypto) checks them.
    const res = await db.query("SELECT id FROM teacher WHERE pin_hash = crypt($1, pin_hash)", [String(pin)]);
    if (res.rows.length === 0) return fail(401, "Invalid PIN");

    const response = NextResponse.json({ ok: true });
    setLogin(response, "teacher", res.rows[0].id);
    return response;
  } catch (e) {
    return fail(500, "Failed to log in", e);
  }
}
