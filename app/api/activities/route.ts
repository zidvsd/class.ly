// POST /api/activities  -> creates an activity and starts it right away
// {
//   sessionId, title, durationMinutes, showScore,
//   questions: [
//     { type: "mcq",  text, points, choices: [{ text, isCorrect }] },
//     { type: "code", text, points, starterCode, tests: "1, 2 -> 3\n10, 5 -> 15" },
//   ]
// }
import { NextRequest, NextResponse } from "next/server";
import { db, tx } from "@/lib/db";
import { fail, getTeacherId } from "@/lib/auth";
import { currentActivity } from "@/lib/finalize";

// "function add(a, b) {...}" or "const add = ..." -> "add"
function functionName(code: string) {
  const match = code.match(/function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/);
  return match ? match[1] ?? match[2] : null;
}

// Reads a value the way a teacher types it: 3, true, [1, 2], "Hello" — or Hello without quotes.
function readValue(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text.trim();
  }
}

// "1, 2 -> 3" -> { args: [1, 2], expected: 3 }
// "-> Hello"  -> { args: [], expected: "Hello" }   (a function with no inputs)
// Returns null if a line can't be read.
function parseTests(text: string) {
  const tests = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const [input, expected] = line.split("->");
    if (expected === undefined || !expected.trim()) return null;
    try {
      tests.push({ args: JSON.parse(`[${input}]`), expected: readValue(expected) });
    } catch {
      return null;
    }
  }
  return tests.length > 0 ? tests : null;
}

export async function POST(req: NextRequest) {
  try {
    const teacherId = await getTeacherId();
    if (!teacherId) return fail(401, "Unauthorized");

    const { sessionId, title, durationMinutes, showScore, questions } = await req.json();
    if (!title?.trim()) return fail(400, "Title is required");
    if (!(durationMinutes >= 1 && durationMinutes <= 180)) return fail(400, "Duration must be 1 to 180 minutes");
    if (!questions?.length) return fail(400, "Add at least one question");

    // Check every question before saving anything.
    for (const [i, q] of questions.entries()) {
      if (!q.text?.trim()) return fail(400, `Question ${i + 1} needs text`);
      if (q.type === "code") {
        q.fnName = functionName(q.starterCode ?? "");
        q.testCases = parseTests(q.tests ?? "");
        if (!q.fnName) return fail(400, `Question ${i + 1}: starter code must define a function`);
        if (!q.testCases) return fail(400, `Question ${i + 1}: write tests like "1, 2 -> 3", one per line`);
      } else if (q.choices?.length < 2 || q.choices.filter((c: any) => c.isCorrect).length !== 1) {
        return fail(400, `Question ${i + 1} needs 2+ choices and exactly one correct`);
      }
    }

    const session = await db.query(
      `SELECT s.status FROM class_session s JOIN section sec ON sec.id = s.section_id
        WHERE s.id = $1 AND sec.teacher_id = $2`,
      [sessionId, teacherId],
    );
    if (session.rows.length === 0) return fail(404, "Session not found");
    if ((await currentActivity(sessionId))?.status === "active") return fail(409, "Another activity is already running");

    // All or nothing: if one insert fails, nothing is saved.
    const activityId = await tx(async (client) => {
      const activity = await client.query(
        `INSERT INTO activity (session_id, title, duration_minutes, show_score, status, started_at)
         VALUES ($1, $2, $3, $4, 'running', now()) RETURNING id`,
        [sessionId, title.trim(), durationMinutes, showScore !== false],
      );
      const id = activity.rows[0].id;

      for (const [i, q] of questions.entries()) {
        const points = q.points > 0 ? q.points : 1;

        if (q.type === "code") {
          await client.query(
            `INSERT INTO question (activity_id, type, text, starter_code, fn_name, test_cases, points, position)
             VALUES ($1, 'code', $2, $3, $4, $5, $6, $7)`,
            [id, q.text.trim(), q.starterCode, q.fnName, JSON.stringify(q.testCases), points, i],
          );
        } else {
          const question = await client.query(
            "INSERT INTO question (activity_id, type, text, points, position) VALUES ($1, 'mcq', $2, $3, $4) RETURNING id",
            [id, q.text.trim(), points, i],
          );
          for (const [k, c] of q.choices.entries()) {
            await client.query("INSERT INTO choice (question_id, text, is_correct, position) VALUES ($1, $2, $3, $4)", [
              question.rows[0].id,
              c.text,
              c.isCorrect === true,
              k,
            ]);
          }
        }
      }
      return id;
    });

    return NextResponse.json({ activityId }, { status: 201 });
  } catch (e) {
    return fail(500, "Failed to create activity", e);
  }
}
