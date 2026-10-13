"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PlayIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { CodeEditor } from "@/components/code-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { call } from "@/lib/client";

type Choice = { text: string; isCorrect: boolean };
type Question = {
  type: "mcq" | "code";
  text: string;
  points: number;
  choices: Choice[];
  starterCode: string;
  tests: string;
};

const newMcq = (): Question => ({
  type: "mcq",
  text: "",
  points: 1,
  choices: [{ text: "", isCorrect: true }, { text: "", isCorrect: false }],
  starterCode: "",
  tests: "",
});

const newCode = (): Question => ({
  type: "code",
  text: "Write a function add(a, b) that returns the sum of a and b.",
  points: 1,
  choices: [],
  starterCode: "function add(a, b) {\n  // return the sum of a and b\n}\n",
  tests: "1, 2 -> 3\n10, 5 -> 15\n-4, 4 -> 0",
});

export default function NewActivityPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(10);
  const [showScore, setShowScore] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([newMcq()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(index: number, changes: Partial<Question>) {
    setQuestions(questions.map((q, i) => (i === index ? { ...q, ...changes } : q)));
  }

  function updateChoice(qIndex: number, cIndex: number, changes: Partial<Choice>) {
    const choices = questions[qIndex].choices.map((c, i) => (i === cIndex ? { ...c, ...changes } : c));
    update(qIndex, { choices });
  }

  function markCorrect(qIndex: number, cIndex: number) {
    const choices = questions[qIndex].choices.map((c, i) => ({ ...c, isCorrect: i === cIndex }));
    update(qIndex, { choices });
  }

  async function start() {
    setBusy(true);
    const r = await call("POST", "/api/activities", { sessionId: id, title, durationMinutes: minutes, showScore, questions });
    if (r.ok) return router.push(`/teacher/session/${id}`);
    setError(r.data.error);
    setBusy(false);
  }

  return (
    <div className="page-narrow mx-auto grid w-full gap-6">
      <h1 className="page-title">New activity</h1>

      <Card>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <div className="field">
              <Label htmlFor="title">Title</Label>
              <Input id="title" className="h-9" placeholder="e.g. Chapter 3 quiz" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <Label htmlFor="minutes">Minutes</Label>
              <Input id="minutes" className="h-9" type="number" min={1} max={180} value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))} />
            </div>
          </div>
          <Label className="font-normal">
            <Checkbox checked={showScore} onCheckedChange={(checked) => setShowScore(checked)} />
            Students see their score at the end
          </Label>
        </CardContent>
      </Card>

      {questions.map((q, i) => (
        <Card key={i}>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Question {i + 1}</CardTitle>
            <div className="flex gap-1">
              <Button variant={q.type === "mcq" ? "secondary" : "ghost"} size="sm" onClick={() => update(i, { ...newMcq(), points: q.points })}>
                Multiple choice
              </Button>
              <Button variant={q.type === "code" ? "secondary" : "ghost"} size="sm" onClick={() => update(i, { ...newCode(), points: q.points })}>
                Code
              </Button>
              {questions.length > 1 && (
                <Button variant="ghost" size="icon-sm" aria-label="Remove question" onClick={() => setQuestions(questions.filter((_, j) => j !== i))}>
                  <Trash2Icon />
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_100px]">
              <div className="field">
                <Label>Question</Label>
                <Textarea value={q.text} onChange={(e) => update(i, { text: e.target.value })} />
              </div>
              <div className="field content-start">
                <Label>Points</Label>
                <Input className="h-9" type="number" min={1} value={q.points} onChange={(e) => update(i, { points: Number(e.target.value) })} />
              </div>
            </div>

            {q.type === "mcq" && (
              <div className="grid gap-2">
                <Label>Choices (select the correct one)</Label>
                {q.choices.map((c, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input type="radio" name={`correct-${i}`} checked={c.isCorrect} onChange={() => markCorrect(i, k)} className="size-4 accent-primary" />
                    <Input className="h-9" placeholder={`Choice ${k + 1}`} value={c.text} onChange={(e) => updateChoice(i, k, { text: e.target.value })} />
                    {q.choices.length > 2 && (
                      <Button variant="ghost" size="icon" aria-label="Remove choice"
                        onClick={() => update(i, { choices: q.choices.filter((_, j) => j !== k) })}>
                        <XIcon />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-fit" onClick={() => update(i, { choices: [...q.choices, { text: "", isCorrect: false }] })}>
                  <PlusIcon /> Add choice
                </Button>
              </div>
            )}

            {q.type === "code" && (
              <>
                <div className="field">
                  <Label>Starter code</Label>
                  <CodeEditor value={q.starterCode} onChange={(starterCode) => update(i, { starterCode })} minHeight="5rem" />
                </div>
                <div className="field">
                  <Label>Tests (one per line: inputs -&gt; expected result)</Label>
                  <Textarea className="font-mono" value={q.tests} onChange={(e) => update(i, { tests: e.target.value })} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" size="lg" className="w-fit" onClick={() => setQuestions([...questions, newMcq()])}>
        <PlusIcon /> Add question
      </Button>

      {error && <p className="error">{error}</p>}

      <Button size="lg" className="h-10" onClick={start} disabled={busy || !title.trim()}>
        <PlayIcon /> {busy ? "Starting…" : "Start activity"}
      </Button>
    </div>
  );
}
