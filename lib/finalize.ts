import { db } from "@/lib/db";
import { runTests } from "@/lib/grade";

// Ends an activity and grades every student in the session.
// Multiple choice: full points if the correct choice was picked.
// Code: points × (tests passed ÷ total tests), rounded.
// Returns how many students were graded, or null if the activity was not running.
export async function finalizeActivity(activityId: string) {
  // Only one request can flip 'running' -> 'ended', so grading never runs twice.
  const ended = await db.query(
    "UPDATE activity SET status = 'ended', ended_at = now() WHERE id = $1 AND status = 'running' RETURNING session_id",
    [activityId],
  );
  if (ended.rows.length === 0) return null;
  const sessionId = ended.rows[0].session_id;

  const questions = await db.query(
    `SELECT q.id, q.type, q.points, q.fn_name, q.test_cases,
            (SELECT c.id FROM choice c WHERE c.question_id = q.id AND c.is_correct) AS correct_choice_id
       FROM question q WHERE q.activity_id = $1`,
    [activityId],
  );
  const maxScore = questions.rows.reduce((sum, q) => sum + q.points, 0);

  const students = await db.query("SELECT id FROM student WHERE session_id = $1", [sessionId]);

  for (const student of students.rows) {
    let score = 0;

    for (const q of questions.rows) {
      const answer = (
        await db.query("SELECT choice_id, code_text FROM answer WHERE student_id = $1 AND question_id = $2", [student.id, q.id])
      ).rows[0];
      if (!answer) continue;

      if (q.type === "mcq") {
        if (answer.choice_id === q.correct_choice_id) score += q.points;
      } else {
        const passed = await runTests(answer.code_text ?? "", q.fn_name, q.test_cases);
        score += Math.round((q.points * passed) / q.test_cases.length);
        await db.query("UPDATE answer SET tests_passed = $1, tests_total = $2 WHERE student_id = $3 AND question_id = $4", [
          passed,
          q.test_cases.length,
          student.id,
          q.id,
        ]);
      }
    }

    await db.query(
      `INSERT INTO submission (activity_id, student_id, score, max_score) VALUES ($1, $2, $3, $4)
       ON CONFLICT (activity_id, student_id) DO NOTHING`,
      [activityId, student.id, score, maxScore],
    );
  }

  return students.rows.length;
}

// The activity students should see now: the running one, otherwise the most recent one.
// If its timer has run out, it is ended and graded first.
export async function currentActivity(sessionId: string) {
  const sql = `SELECT id, title, status, duration_minutes, show_score,
                      GREATEST(0, CEIL(EXTRACT(EPOCH FROM started_at + duration_minutes * interval '1 minute' - now())))::int AS seconds_left
                 FROM activity
                WHERE session_id = $1
                ORDER BY status = 'running' DESC, started_at DESC
                LIMIT 1`;

  let activity = (await db.query(sql, [sessionId])).rows[0];
  if (!activity) return null;

  if (activity.status === "running" && activity.seconds_left === 0) {
    await finalizeActivity(activity.id);
    activity = (await db.query(sql, [sessionId])).rows[0];
  }

  // The pages call a running activity "active".
  if (activity.status === "running") activity.status = "active";
  else activity.seconds_left = 0;
  return activity;
}
