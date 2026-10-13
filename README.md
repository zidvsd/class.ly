# Class.ly — how it works

Class.ly runs classroom quizzes **without internet**. The teacher's laptop is the server. Students join from their phones over the classroom Wi-Fi, answer multiple-choice and JavaScript questions, and get graded automatically. The teacher can then download the results as a CSV file.

---

## 1. The big picture

```
 Student phones (browser)                 Teacher laptop
 ┌──────────────┐                ┌───────────────────────────────┐
 │  /join       │  ── Wi-Fi ──▶  │  Next.js app (pages + API)    │
 │  quiz screen │  ◀── JSON ───  │        │                      │
 └──────────────┘                │        ▼                      │
 ┌──────────────┐                │  PostgreSQL (all the data)    │
 │ Teacher page │  ── localhost ▶│                               │
 └──────────────┘                └───────────────────────────────┘
```

- **One app, one machine.** Next.js serves the pages *and* the API, and Postgres stores everything. Nothing goes to the internet.
- **Phones ask, the server answers.** Every 3 seconds each phone asks "what should I show?" (`/api/state`), and the teacher's page asks "how is the class doing?" (`/api/monitor`). This is called **polling**.

## 2. Tech stack (and why)

| Part | Choice | Why |
|---|---|---|
| App | Next.js (React) | Pages and API in one project, one command to run |
| Database | PostgreSQL + `pg` | Reliable, handles many students saving at once, transactions |
| UI | shadcn/ui + Tailwind | Ready-made accessible components; the theme lives in `app/globals.css` |
| Code editor | CodeMirror 6 | Lightweight, works on phones |

## 3. Folder map

```
app/
  join/page.tsx                     Student page: join form, then the quiz (components/Play.tsx)
  teacher/login/                    Teacher PIN sign-in
  teacher/(app)/layout.tsx          Checks the teacher is logged in + sidebar
  teacher/(app)/dashboard/          Sections, start a session, change PIN
  teacher/(app)/session/[id]/       Live monitor: join code, students, timer, CSV export
  teacher/(app)/session/[id]/new/   Quiz builder
  api/...                           The server (one file per endpoint, see section 5)
components/
  Play.tsx          Student quiz screen (polls /api/state, autosaves answers)
  code-editor.tsx   CodeMirror editor
  app-sidebar.tsx   Teacher sidebar + logout
  change-pin.tsx    Change PIN form
  Brand.tsx         Logo and the top bar on student/login pages
  ui/               shadcn components (button, card, input, …)
lib/
  db.ts         Postgres connection pool + tx() for transactions
  auth.ts       Login cookies (signed)
  client.ts     call() fetch helper, usePoll(), timer helpers
  finalize.ts   Ends an activity and grades everyone
  grade.ts      Runs student code against the tests (sandboxed)
  run-js.ts     The "Run" button on the phone (Web Worker)
  db/migrations/  SQL: 001 tables, 002 extra columns, seed demo data
```

## 4. Database (9 tables)

```
teacher ─< section ─< class_session ─< student
                            │
                            └─< activity ─< question ─< choice
student + question  →  answer        (one row per student per question)
student + activity  →  submission    (the final score)
```

- A **section** is a class (e.g. "Grade 10 - Newton").
- A **class_session** is one meeting of that class, with a 6-character **join code**.
- A **student** joins a session with their **surname**.
- An **activity** is a timed quiz in that session. It is `running` or `ended`.
- A **question** is `mcq` (with choices) or `code` (starter code + hidden test cases).

## 5. The API

| Endpoint | Who | What it does |
|---|---|---|
| `POST /api/teacher/login` | teacher | Checks the PIN, sets the login cookie |
| `POST /api/teacher/logout` | teacher | Clears the cookie |
| `POST /api/teacher/pin` | teacher | Change PIN (checks the old PIN first) |
| `GET/POST /api/sections` | teacher | List / add sections |
| `GET/POST /api/sessions` | teacher | List open sessions / start one (makes the join code) |
| `POST /api/activities` | teacher | Create a quiz and start it right away |
| `POST /api/activities/:id/end` | teacher | End early and grade everyone |
| `GET /api/activities/:id/csv` | teacher | Download results: Surname, Score, Percentage |
| `GET /api/monitor` | teacher | Live class view + finished activities (polled) |
| `POST /api/join` | student | Join with code + surname |
| `GET /api/state` | student | What to show: waiting / quiz / score (polled) |
| `PUT /api/answers` | student | Save answers (autosave) |

Every route follows the same pattern: **check the login cookie → check the input → run SQL → return JSON**.

## 6. The main flows

**Starting a class**
1. Teacher logs in with a PIN, creates a section, and clicks *Start session*.
2. The server generates a code like `YFZUFW` (no 0/O or 1/I, so it's easy to read off the board).
3. Students open the laptop's address, type the code and their surname, and get a student cookie.
   The same surname can't be used twice in a session, except from the same phone (so a reload doesn't lock a student out).

**Running a quiz**
1. Teacher builds the quiz and presses *Start*. The activity becomes `running` with a start time.
2. Phones poll `/api/state`, see the questions, and show a countdown.
3. Each answer is autosaved half a second after the student changes it. The phone sends **all** its answers every time, so if one save fails because of bad Wi-Fi, the next one fixes it.
4. After a reload, the saved answers come back from the server, so nothing is lost.

**Ending and grading** (`lib/finalize.ts`)
1. The quiz ends when the teacher clicks *End now* **or** when the timer runs out (the next poll notices and ends it).
2. One SQL statement flips `running → ended`. Only one request can win that, so grading never runs twice.
3. Multiple choice: full points for the correct choice.
   Code: `points × tests passed ÷ total tests`.
4. Scores are saved in `submission`, and the phones show the result (if the teacher allowed it).

**Getting the results** (`app/api/activities/[id]/csv/route.ts`)
1. Every finished activity is listed on the session page with an **Export CSV** button.
2. The file has one row per student, sorted by surname:
   ```
   Surname,Score (out of 4),Percentage
   Reyes,4,100%
   "Santos, Jr.",1,25%
   ```
3. The maximum score is in the header, so the score cells are plain numbers (`4/4` would turn into a date in Excel). Every cell is quoted, so commas in names don't break columns, and names starting with `=` get a `'` in front so Excel doesn't run them as formulas.

## 7. Code questions

**Teacher side:** pick *Code* and the form fills in a ready example:
- Starter code: `function add(a, b) { // return the sum of a and b }`
- Tests, one per line: `1, 2 -> 3`, `10, 5 -> 15`, `-4, 4 -> 0`

The server reads the function name (`add`) from the starter code and turns each test line into `{ args: [1, 2], expected: 3 }`.
For a function with no inputs, leave the left side empty: `-> Hello, World!`. Text answers can be typed with or without quotes.

**Student side:**
- **Run** runs the code **on the phone** in a Web Worker (a background thread). It shows two things:
  - anything printed with `console.log`
  - what the function **returns** when called with the first test's inputs, e.g. `add(1, 2) → 3` or `greet() → "Hello, World!"`

  So a student who only uses `return` still sees an answer, and a student who forgot `return` sees `→ undefined`. It stops after 3 seconds if there's an endless loop. The phone gets the test **inputs** but never the expected results.
- **Grading** happens **on the server** (`lib/grade.ts`). A test passes if the function **returns** the expected value **or prints** it, so "return it" and "print it" lessons both work. Each answer runs in a separate Node process with `--permission`, which blocks reading files and starting programs, plus a memory limit and a 1-second limit per test.

## 8. Security, in plain words

- **PINs** are stored as bcrypt hashes and checked by Postgres (`crypt()`). The PIN itself is never stored.
- **Changing the PIN** is one SQL `UPDATE` that only runs if the old PIN matches, so a stolen cookie alone can't change it.
- **Login cookies** are `id.signature`. The signature is an HMAC made with `SESSION_SECRET`, so a student can't fake being someone else, and the cookie is `httpOnly`, so page scripts can't read it.
- **Every teacher query checks ownership**, e.g. `WHERE sec.teacher_id = $teacher`, so a teacher can only see, end or export their own activities.
- **All SQL uses parameters** (`$1, $2`), which prevents SQL injection.
- **Students never receive correct answers or expected test results.**
- **Student code** runs either sandboxed on the phone or in a locked-down process on the server.

## 9. Questions judges may ask

**Why polling instead of WebSockets?**
It's simpler and it survives bad classroom Wi-Fi: if a phone drops, the next poll just works. One request every 3 seconds from 40 phones is about 13 requests a second, which is nothing for one laptop.

**What if the Wi-Fi drops during a quiz?**
Answers stay on the phone and are re-sent on the next successful save. The phone shows "Connection lost" in the meantime.

**What if two requests try to end the quiz at once?**
The `UPDATE … WHERE status = 'running'` only succeeds once, so grading happens exactly once.

**Can a student cheat by reading the page?**
The correct choices and expected test results never leave the server, and grading is done on the server, not the phone.

**How does the teacher get the grades into their records?**
Export CSV on the session page. It opens in Excel or Google Sheets with surname, score and percentage.

**Why does it need no internet?**
Everything (app, database, fonts, editor) runs on the teacher's laptop. Internet is only needed once, for `npm install` and the first build (which downloads the fonts and serves them locally after that). In class it works with no connection at all.

**Limitations / next steps**
Teacher accounts are created in SQL (no sign-up page yet), only JavaScript is supported for code questions, and teachers see scores but not students' code yet.

## 10. Running it

```bash
# 1. Database (once)
createdb classly
psql -d classly -f lib/db/migrations/001_initial.sql
psql -d classly -f lib/db/migrations/seed.sql      # demo teacher, PIN 1234
psql -d classly -f lib/db/migrations/002_mvp.sql

# 2. .env.local
DATABASE_URL="postgresql://postgres:<password>@localhost:5432/classly"
SESSION_SECRET="any-long-random-string"

# 3. Start (listens on the Wi-Fi)
npm install
npm run dev
```

Teacher: `http://localhost:3000/teacher/login` (demo PIN `1234`, change it on the dashboard) · Students: `http://<laptop-ip>:3000` (e.g. `http://10.60.100.40:3000`)
