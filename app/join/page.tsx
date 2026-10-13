"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Play } from "@/components/Play";
import { TopBar } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { call, clearJoinedCode, getJoinedCode, setJoinedCode } from "@/lib/client";

// The student's only page: the join form, or the quiz once they've joined.
export default function JoinPage() {
  const [joinedCode, setJoined] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // After a reload, go straight back into the quiz.
  useEffect(() => setJoined(getJoinedCode()), []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await call("POST", "/api/join", { code, name });
    setBusy(false);
    if (!r.ok) return setError(r.data.error);
    setJoinedCode(code);
    setJoined(code);
  }

  function leave() {
    clearJoinedCode();
    setJoined(null);
  }

  if (joinedCode) return <Play code={joinedCode} onLeave={leave} />;

  return (
    <>
      <TopBar>
        <Link href="/teacher/login" className="text-sm text-muted-foreground">Teacher sign in</Link>
      </TopBar>
      <main className="page-center">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Join your class</CardTitle>
            <CardDescription>Type the 6-character code on the board and your surname.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={join} className="grid gap-4">
              <div className="field">
                <Label htmlFor="code">Class code</Label>
                <Input id="code" value={code} maxLength={6} placeholder="ABC234" autoComplete="off"
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  className="h-12 text-center font-mono text-2xl font-semibold tracking-[0.4em] placeholder:text-muted-foreground/40" />
              </div>
              <div className="field">
                <Label htmlFor="name">Surname</Label>
                <Input id="name" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} className="h-10" />
              </div>
              {error && <p className="error">{error}</p>}
              <Button type="submit" size="lg" className="h-10" disabled={busy || code.length !== 6 || !name.trim()}>
                {busy ? "Joining…" : "Join class"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
