import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// The login cookie is "<id>.<signature>". The signature (HMAC with SESSION_SECRET) proves
// the server issued it, so nobody can just type in another student's or teacher's id.

const EIGHT_HOURS = 8 * 60 * 60;

function sign(id: string) {
  return crypto.createHmac("sha256", process.env.SESSION_SECRET!).update(id).digest("base64url");
}

export function setLogin(res: NextResponse, role: "teacher" | "student", id: string) {
  res.cookies.set(`${role}_session`, `${id}.${sign(id)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: EIGHT_HOURS,
  });
}

export function clearLogin(res: NextResponse, role: "teacher" | "student") {
  res.cookies.set(`${role}_session`, "", { path: "/", maxAge: 0 });
}

async function getLogin(role: "teacher" | "student") {
  const value = (await cookies()).get(`${role}_session`)?.value ?? "";
  const [id, signature] = value.split(".");
  if (!id || signature !== sign(id)) return null;
  return id;
}

export const getTeacherId = () => getLogin("teacher");
export const getStudentId = () => getLogin("student");

export function fail(status: number, error: string, cause?: unknown) {
  if (cause) console.error(error, cause);
  return NextResponse.json({ error }, { status });
}
