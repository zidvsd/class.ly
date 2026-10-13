"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DownloadIcon, PlusIcon, SquareIcon, TimerIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { call, mmss, timerClass, usePoll } from "@/lib/client";

// Live view of one session: join code, the current activity, and every student's progress.
export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");

  usePoll(async () => {
    const r = await call("GET", `/api/monitor?sessionId=${id}`);
    if (!r.ok) return setError(r.data.error);
    setError("");
    setData(r.data);
    setSecondsLeft(r.data.activity?.secondsLeft ?? 0);
  });

  // Count the timer down between polls.
  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  async function endActivity() {
    if (!confirm("End the activity now? Saved answers will be graded.")) return;
    const r = await call("POST", `/api/activities/${data.activity.id}/end`);
    if (!r.ok) setError(r.data.error);
  }

  if (!data) return <p className={error ? "error" : "page-description"}>{error || "Loading…"}</p>;

  const { session, activity, students } = data;
  const online = students.filter((s: any) => s.online).length;
  const submitted = students.filter((s: any) => s.score !== null).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{session.name}</h1>
          <p className="page-description">Students open this site on the class Wi-Fi and enter this code:</p>
        </div>
        <span className="join-code">{session.code}</span>
      </div>

      {error && <p className="error">{error}</p>}

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{activity ? activity.title : "No activity yet"}</CardTitle>
            <CardDescription>
              {activity ? `${activity.questionCount} questions · ${activity.minutes} min` : "Create a quiz when everyone has joined."}
            </CardDescription>
          </div>
          {activity?.status === "active" ? (
            <div className="flex items-center gap-2">
              <span className={timerClass(secondsLeft)}><TimerIcon className="size-3.5" />{mmss(secondsLeft)}</span>
              <Button variant="destructive" size="lg" onClick={endActivity}><SquareIcon /> End now</Button>
            </div>
          ) : (
            <Link className={buttonVariants({ size: "lg" })} href={`/teacher/session/${id}/new`}>
              <PlusIcon /> New activity
            </Link>
          )}
        </CardHeader>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card size="sm"><CardContent><div className="stat-value">{students.length}</div><div className="page-description">Joined</div></CardContent></Card>
        <Card size="sm"><CardContent><div className="stat-value">{online}</div><div className="page-description">Online</div></CardContent></Card>
        <Card size="sm"><CardContent><div className="stat-value">{submitted}</div><div className="page-description">Submitted</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Students</CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="page-description">Nobody has joined yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Surname</TableHead>
                  <TableHead>Answered</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="status-dot mr-2" data-online={s.online} />
                      {s.name}
                    </TableCell>
                    <TableCell>{activity ? `${s.answered}/${activity.questionCount}` : "–"}</TableCell>
                    <TableCell>
                      {s.score !== null ? <Badge>Submitted</Badge> : s.answered > 0 ? <Badge variant="secondary">Working</Badge> : <Badge variant="outline">Not started</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{s.score !== null ? `${s.score}/${s.max_score}` : "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data.finished.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Finished activities</CardTitle>
            <CardDescription>Download each student&apos;s surname, score and percentage.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {data.finished.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-2">
                <span className="font-medium">{a.title}</span>
                <a className={buttonVariants({ variant: "outline" })} href={`/api/activities/${a.id}/csv`} download>
                  <DownloadIcon /> Export CSV
                </a>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
