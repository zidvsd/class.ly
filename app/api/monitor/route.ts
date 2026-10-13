// GET /api/monitor?sessionId=...  -> the teacher's live view of a session (polled every 3 seconds)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail, getTeacherId } from "@/lib/auth";
import { currentActivity } from "@/lib/finalize";

export async function GET(req: NextRequest) {
  try {
    const teacherId = await getTeacherId();
    if (!teacherId) return fail(401, "Unauthorized");

    const sessionId = req.nextUrl.searchParams.get("sessionId");
    const session = await db.query(
      `SELECT s.id, s.code, COALESCE(NULLIF(s.name, ''), sec.name) AS name
         FROM class_session s JOIN section sec ON sec.id = s.section_id
        WHERE s.id = $1 AND sec.teacher_id = $2`,
      [sessionId, teacherId],
    );
    if (session.rows.length === 0) return fail(404, "Session not found");

    const activity = await currentActivity(sessionId!);
    let questionCount = 0;
    if (activity) {
      const count = await db.query("SELECT count(*)::int AS n FROM question WHERE activity_id = $1", [activity.id]);
      questionCount = count.rows[0].n;
    }

    // One row per student: online in the last 15s, how many questions answered, and their score.
    const students = await db.query(
      `SELECT st.id, st.name,
              st.last_seen_at > now() - interval '15 seconds' AS online,
              (SELECT count(*)::int FROM answer a JOIN question q ON q.id = a.question_id
                WHERE a.student_id = st.id AND q.activity_id = $2) AS answered,
              sub.score, sub.max_score
         FROM student st
         LEFT JOIN submission sub ON sub.student_id = st.id AND sub.activity_id = $2
        WHERE st.session_id = $1
        ORDER BY st.name`,
      [sessionId, activity?.id ?? null],
    );

    // Finished activities, newest first, for the "Export CSV" buttons.
    const finished = await db.query(
      "SELECT id, title FROM activity WHERE session_id = $1 AND status = 'ended' ORDER BY ended_at DESC",
      [sessionId],
    );

    return NextResponse.json({
      finished: finished.rows,
      session: session.rows[0],
      activity: activity && {
        id: activity.id,
        title: activity.title,
        status: activity.status,
        minutes: activity.duration_minutes,
        secondsLeft: activity.seconds_left,
        questionCount,
      },
      students: students.rows,
    });
  } catch (e) {
    return fail(500, "Failed to fetch monitor", e);
  }
}
