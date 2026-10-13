// GET /api/activities/:id/csv  -> downloads the results of a finished activity as a CSV file
//   Surname,Score (out of 10),Percentage
//   Reyes,8,80%
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { fail, getTeacherId } from "@/lib/auth";

// Wrap every cell in quotes so commas in names don't break columns. A leading ' stops
// Excel from treating names like "=SUM(...)" as formulas.
function cell(value: string | number) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const teacherId = await getTeacherId();
    if (!teacherId) return fail(401, "Unauthorized");

    const { id } = await params;
    const activity = await db.query(
      `SELECT a.title FROM activity a
         JOIN class_session s ON s.id = a.session_id
         JOIN section sec ON sec.id = s.section_id
        WHERE a.id = $1 AND sec.teacher_id = $2 AND a.status = 'ended'`,
      [id, teacherId],
    );
    if (activity.rows.length === 0) return fail(404, "Finished activity not found");

    const results = await db.query(
      `SELECT st.name, sub.score, sub.max_score
         FROM submission sub JOIN student st ON st.id = sub.student_id
        WHERE sub.activity_id = $1
        ORDER BY st.name`,
      [id],
    );

    const maxScore = results.rows[0]?.max_score ?? 0;
    const lines = [[cell("Surname"), cell(`Score (out of ${maxScore})`), cell("Percentage")].join(",")];
    for (const r of results.rows) {
      const percent = r.max_score ? Math.round((r.score / r.max_score) * 100) : 0;
      lines.push([cell(r.name), cell(r.score), cell(`${percent}%`)].join(","));
    }

    const fileName = activity.rows[0].title.replace(/[^\w -]/g, "").trim() || "results";
    return new Response(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}.csv"`,
      },
    });
  } catch (e) {
    return fail(500, "Failed to export results", e);
  }
}
