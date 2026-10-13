// GET /api/state?code=ABC123  -> what the student's phone should show (polled every 3 seconds)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, getStudentId } from "@/lib/auth";
import { currentActivity } from "@/lib/finalize";

export async function GET(req: NextRequest) {
  try {
    const studentId = await getStudentId();
    if (!studentId) return fail(401, "Unauthorized");

    const code = req.nextUrl.searchParams.get("code")?.toUpperCase();
    const session = await db.query("SELECT id FROM class_session WHERE code = $1", [code]);
    if (session.rows.length === 0) return fail(404, "Session not found");
    const sessionId = session.rows[0].id;

    // Also marks the student as online for the teacher's monitor.
    const me = await db.query("UPDATE student SET last_seen_at = now() WHERE id = $1 AND session_id = $2", [studentId, sessionId]);
    if (me.rowCount === 0) return fail(401, "You are not part of this session");

    const activity = await currentActivity(sessionId);
    if (!activity) return NextResponse.json({ activity: null });

    const result = await db.query("SELECT score, max_score FROM submission WHERE activity_id = $1 AND student_id = $2", [
      activity.id,
      studentId,
    ]);
    const submission = result.rows[0];

    if (activity.status === "ended") {
      return NextResponse.json({
        activity: { id: activity.id, title: activity.title, status: "ended" },
        submitted: !!submission,
        score: activity.show_score ? submission?.score : undefined,
        maxScore: submission?.max_score,
      });
    }

    // Never send correct answers or expected results to the phone. For code questions we only send
    // the function name and the first test's inputs, so the Run button can show what the function returns.
    const questions = await db.query(
      `SELECT q.id, q.type, q.text, q.points, q.starter_code, q.fn_name, q.test_cases->0->'args' AS example_args,
              COALESCE((SELECT json_agg(json_build_object('id', c.id, 'text', c.text) ORDER BY c.position)
                          FROM choice c WHERE c.question_id = q.id), '[]') AS choices
         FROM question q WHERE q.activity_id = $1 ORDER BY q.position`,
      [activity.id],
    );

    // The student's saved answers, so a reload doesn't lose anything.
    const saved = await db.query(
      `SELECT a.question_id, COALESCE(a.choice_id::text, a.code_text) AS value
         FROM answer a JOIN question q ON q.id = a.question_id
        WHERE a.student_id = $1 AND q.activity_id = $2`,
      [studentId, activity.id],
    );
    const answers: Record<string, string> = {};
    for (const row of saved.rows) answers[row.question_id] = row.value;

    return NextResponse.json({
      activity: { id: activity.id, title: activity.title, status: "active", questions: questions.rows, answers },
      secondsLeft: activity.seconds_left,
    });
  } catch (e) {
    return fail(500, "Failed to fetch state", e);
  }
}
