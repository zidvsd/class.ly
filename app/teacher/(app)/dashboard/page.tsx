"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PlayIcon, PlusIcon } from "lucide-react"
import { ChangePin } from "@/components/change-pin"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { call } from "@/lib/client"

type Section = { id: string; name: string; subject: string | null }

export default function DashboardPage() {
  const router = useRouter()
  const [sections, setSections] = useState<Section[]>([])
  const [sessionNames, setSessionNames] = useState<Record<string, string>>({})
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [error, setError] = useState("")

  async function loadSections() {
    const r = await call("GET", "/api/sections")
    if (r.ok) setSections(r.data.sections)
  }

  useEffect(() => {
    loadSections()
  }, [])

  async function addSection(e: React.FormEvent) {
    e.preventDefault()
    const r = await call("POST", "/api/sections", { name, subject })
    if (!r.ok) return setError(r.data.error)
    setName("")
    setSubject("")
    setError("")
    loadSections()
  }

  async function startSession(sectionId: string) {
    const r = await call("POST", "/api/sessions", {
      sectionId,
      name: sessionNames[sectionId],
    })
    if (!r.ok) return setError(r.data.error)
    router.push(`/teacher/session/${r.data.id}`)
  }

  return (
    <>
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">
          Start a session for a section, then share the join code with your
          class.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <section className="grid gap-4">
          <h2 className="text-lg font-semibold">Sections</h2>
          {sections.length === 0 && (
            <p className="page-description">
              No sections yet. Add your first class.
            </p>
          )}

          {sections.map((s) => (
            <Card key={s.id} size="sm">
              <CardHeader>
                <CardTitle>{s.name}</CardTitle>
                {s.subject && <CardDescription>{s.subject}</CardDescription>}
              </CardHeader>
              <CardContent className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Session name, e.g. Quiz 1"
                  className="h-9"
                  value={sessionNames[s.id] ?? ""}
                  onChange={(e) =>
                    setSessionNames({ ...sessionNames, [s.id]: e.target.value })
                  }
                />
                <Button
                  size="lg"
                  onClick={() => startSession(s.id)}
                  disabled={!sessionNames[s.id]?.trim()}
                >
                  <PlayIcon /> Start session
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Add a section</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={addSection} className="grid gap-4">
                <div className="field">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    className="h-9"
                    placeholder="Grade 10 - Newton"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <Label htmlFor="subject">Subject (optional)</Label>
                  <Input
                    id="subject"
                    className="h-9"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <Button type="submit" size="lg" disabled={!name.trim()}>
                  <PlusIcon /> Add section
                </Button>
              </form>
            </CardContent>
          </Card>

          <ChangePin />
        </div>
      </div>
    </>
  )
}
