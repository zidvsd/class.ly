"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2Icon, HourglassIcon, LogOutIcon, PlayIcon, TimerIcon } from "lucide-react";
import { CodeEditor } from "@/components/code-editor";
import { TopBar } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { call, mmss, timerClass, usePoll } from "@/lib/client";
import { runJs } from "@/lib/run-js";

// The quiz screen. Asks the server every 3 seconds what to show (waiting / quiz / results).
export function Play({ code, onLeave }: { code: string; onLeave: () => void }) {
  const [state, setState] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // questionId -> choice id or code
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [saveStatus, setSaveStatus] = useState("");
  const [offline, setOffline] = useState(false);
  const loadedActivity = useRef("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const activity = state?.activity;

  usePoll(async () => {
    const r = await call("GET", `/api/state?code=${code}`);
    if (r.status === 401 || r.status === 404) return onLeave(); // not joined / session gone: back to the join form
    setOffline(!r.ok);
    if (!r.ok) return;

    setState(r.data);
    setSecondsLeft(r.data.secondsLeft ?? 0);
    const latest = r.data.activity;
    if (latest?.status !== "active") return;

    // A new activity started: load the answers already saved on the server.
    if (loadedActivity.current !== latest.id) {
      loadedActivity.current = latest.id;
      setAnswers(latest.answers);
    }
    if (saveStatus === "Not saved") save(latest.id, answers); // retry a save that failed
  });

  // Count the timer down between polls.
  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  async function save(activityId: string, all: Record<string, string>) {
    setSaveStatus("Saving…");
    const r = await call("PUT", "/api/answers", { activityId, answers: all });
    setSaveStatus(r.ok || r.status === 409 ? "Saved" : "Not saved");
  }

  // Every change saves all answers half a second later (typing doesn't send a request per key).
  function answer(questionId: string, value: string) {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(activity.id, next), 500);
  }

  return (
    <>
      <TopBar>
        {activity?.status === "active" && (
          <span className={timerClass(secondsLeft)}>
            <TimerIcon className="size-3.5" />
            {mmss(secondsLeft)}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={onLeave}>
          <LogOutIcon /> Leave
        </Button>
      </TopBar>

      <main className="page page-narrow">
        {offline && <p className="error">Connection lost. Your answers are kept and will send when Wi-Fi is back.</p>}

        {state && !activity && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <HourglassIcon className="size-10 text-primary" />
              <h1 className="page-title">You&apos;re in!</h1>
              <p className="page-description">Waiting for your teacher to start. This page updates by itself.</p>
            </CardContent>
          </Card>
        )}

        {activity?.status === "active" && (
          <>
            <h1 className="page-title">{activity.title}</h1>

            {activity.questions.map((q: any, i: number) => (
              <Card key={q.id}>
                <CardHeader>
                  <CardTitle className="text-base whitespace-pre-wrap">{i + 1}. {q.text}</CardTitle>
                  <CardDescription>{q.points} {q.points === 1 ? "point" : "points"}</CardDescription>
                </CardHeader>
                <CardContent>
                  {q.type === "code" ? (
                    <CodeQuestion question={q} value={answers[q.id] ?? q.starter_code ?? ""} onChange={(text) => answer(q.id, text)} />
                  ) : (
                    <div role="radiogroup" className="grid gap-2">
                      {q.choices.map((c: any) => (
                        <button key={c.id} type="button" role="radio" aria-checked={answers[q.id] === c.id}
                          className="choice" onClick={() => answer(q.id, c.id)}>
                          <span className="choice-dot" />
                          {c.text}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <div className="sticky bottom-4 self-center rounded-full border bg-background px-4 py-2 text-sm shadow-lg">
              {Object.keys(answers).length}/{activity.questions.length} answered {saveStatus && `· ${saveStatus}`}
            </div>
          </>
        )}

        {activity?.status === "ended" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2Icon className="size-10 text-success" />
              <h1 className="page-title">{activity.title}</h1>
              {!state.submitted && <p className="page-description">This activity ended before you joined.</p>}
              {state.submitted && state.score === undefined && <p>Time&apos;s up. Your teacher will share the results.</p>}
              {state.submitted && state.score !== undefined && (
                <div className="text-5xl font-bold">
                  {state.score}<span className="text-2xl text-muted-foreground"> / {state.maxScore}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Waiting for the next activity.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}

// Code editor + Run button + output box for one code question.
function CodeQuestion({ question, value, onChange }: { question: any; value: string; onChange: (text: string) => void }) {
  const [output, setOutput] = useState<{ ok: boolean; output: string } | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setOutput(await runJs(value, question.fn_name, question.example_args ?? []));
    setRunning(false);
  }

  return (
    <div className="grid gap-3">
      <CodeEditor value={value} onChange={onChange} />
      <Button size="lg" className="w-fit" onClick={run} disabled={running}>
        <PlayIcon /> {running ? "Running…" : "Run"}
      </Button>
      {output && <pre className={`output ${output.ok ? "" : "text-destructive"}`}>{output.output}</pre>}
    </div>
  );
}
