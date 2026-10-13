// PUT /api/answers  { activityId, answers: { [questionId]: value } }
// value is the picked choice id (multiple choice) or the student's code (code question).
// The phone sends all its answers every time, so a save that failed is fixed by the next one.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, getStudentId } from "@/lib/auth";
import { currentActivity } from "@/lib/finalize";

export async function PUT(req: NextRequest) {
  try {
    const studentId = await getStudentId();
    if (!studentId) return fail(401, "Unauthorized");

    const { activityId, answers } = await req.json();

    const student = await db.query("SELECT session_id FROM student WHERE id = $1", [studentId]);
    const activity = await currentActivity(student.rows[0]?.session_id);
    if (activity?.id !== activityId) return fail(404, "Activity not found");
    if (activity.status !== "active") return fail(409, "Time is up");

    for (const [questionId, value] of Object.entries(answers)) {
      const question = await db.query("SELECT type FROM question WHERE id = $1 AND activity_id = $2", [questionId, activityId]);
      if (question.rows.length === 0) continue;

      if (question.rows[0].type === "code") {
        await db.query(
          `INSERT INTO answer (student_id, question_id, code_text) VALUES ($1, $2, $3)
           ON CONFLICT (student_id, question_id) DO UPDATE SET code_text = $3, saved_at = now()`,
          [studentId, questionId, String(value).slice(0, 20000)],
        );
      } else {
        // Only accept a choice that belongs to this question.
        await db.query(
          `INSERT INTO answer (student_id, question_id, choice_id)
           SELECT $1, $2, id FROM choice WHERE id = $3 AND question_id = $2
           ON CONFLICT (student_id, question_id) DO UPDATE SET choice_id = $3, saved_at = now()`,
          [studentId, questionId, value],
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(500, "Failed to save answers", e);
  }
}
