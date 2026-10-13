# Class.ly

Class.ly was built for the **City College of Calamba Hackathon 2026**.

Run classroom quizzes **without internet**. Your laptop is the server. Students join from their phones over the classroom Wi-Fi, answer multiple-choice and JavaScript questions, and are graded automatically. When the quiz ends you download the results as a CSV file.

- No student accounts: students join with a 6-character code and their surname.
- Works on any Wi-Fi, even one with no internet (a router or your laptop's hotspot is enough).
- Answers are saved as students type, so a dropped connection or a reload loses nothing.
- Everything stays on your laptop.

```
 Student phones (browser)                 Your laptop
 ┌──────────────┐                ┌───────────────────────────────┐
 │  join + quiz │  ── Wi-Fi ──▶  │  Class.ly app + database      │
 └──────────────┘                │                               │
 ┌──────────────┐                │                               │
 │ Teacher page │  ── localhost ▶│                               │
 └──────────────┘                └───────────────────────────────┘
```

---

## 1. Installation

You need one laptop that stays on during class. Students only need a phone with a browser.

**Requirements** (install once; internet is needed for this step only)

| Software | Version | Get it |
|---|---|---|
| Node.js | 20.9 or newer (22 LTS recommended) | nodejs.org |
| PostgreSQL | 14 or newer | postgresql.org (remember the `postgres` password you set) |
| Class.ly | this project folder | unzip it or `git clone` it |

**Step 1: install the packages** (needs internet, once)

```bash
cd classly
npm install
```

**Step 2: create the database**

```bash
psql -U postgres -c "CREATE DATABASE classly"
psql -U postgres -d classly -f lib/db/migrations/001_initial.sql
psql -U postgres -d classly -f lib/db/migrations/seed.sql      # demo teacher, PIN 1234
psql -U postgres -d classly -f lib/db/migrations/002_mvp.sql
```

On Windows use backslashes in the paths (`lib\db\migrations\001_initial.sql`). Each command asks for the `postgres` password.

**Step 3: add the settings file.** Create a file called `.env.local` in the project folder:

```
DATABASE_URL="postgresql://postgres:<your-postgres-password>@localhost:5432/classly"
SESSION_SECRET="<a long random string>"
```

To make the random string, run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste the result. Keep it private: anyone who has it can forge a login.

**Step 4: start it**

```bash
npm run dev
```

Leave this window open for the whole class. Closing it stops the app.

**Step 5: connect the phones**

1. Put the laptop and the phones on the same Wi-Fi.
2. Find the laptop's address: `ipconfig` on Windows (look for *IPv4 Address*), `ipconfig getifaddr en0` on Mac. It looks like `10.60.100.40`.
3. Students open `http://<laptop-address>:3000` in their browser.

**Add a teacher account.** There is no sign-up page. Run this once per teacher in `psql`, with their own name and PIN:

```sql
INSERT INTO teacher (name, pin_hash) VALUES ('Prof. Cruz', crypt('481516', gen_salt('bf')));
```

**Before the first class,** sign in at `http://localhost:3000/teacher/login` with the demo PIN `1234` and **change it on the dashboard**.

---

## 2. How to use it (for professors)

**Before class (5 minutes)**
1. Start the app (Step 4) and open `http://localhost:3000/teacher/login` on the laptop. Sign in with your PIN.
2. On the dashboard, add a **section** for your class, for example "Grade 10 - Newton". You do this once per class.

**Start the class**
1. Click **Start session** on the section. A 6-character **join code** appears in large letters. (It never uses 0/O or 1/I, so it is easy to read off a board.)
2. Write the code and the web address (`http://<laptop-address>:3000`) on the board.
3. Students type the code and their **surname**, then wait on a "You're in" screen. Their names appear on your session page as they join.

**Run a quiz**
1. On the session page, click **New activity**.
2. Give it a title and a time limit in minutes.
3. Add questions:
   - **Multiple choice:** type the question, the choices, and mark the correct one.
   - **Code (JavaScript):** type the question, starter code, and the tests (see below).
4. Choose whether students see their score when they finish, then click **Start**. Their phones show the questions and a countdown right away.
5. Watch the session page: it shows who is online, how many questions each student has answered, and who has finished.
6. The quiz ends by itself when time runs out. To stop earlier, click **End now**. Everyone is graded the moment it ends.

**Code questions**

Pick *Code* and the form fills in a ready example:
- Starter code: `function add(a, b) { // return the sum of a and b }`
- Tests, one per line: `1, 2 -> 3`, `10, 5 -> 15`, `-4, 4 -> 0`

The left side is what the function receives, the right side is what it should give back. For a function with no inputs, leave the left side empty: `-> Hello, World!`. Text answers can be typed with or without quotes.

Students see a **Run** button. It runs their code on their own phone and shows anything they print, plus what their function returns for the first test's inputs. They never see the expected answers. A test passes if the function **returns** the expected value **or prints** it. Points are `points × tests passed ÷ total tests`.

**After the quiz**
1. Finished activities are listed on the session page. Click **Export CSV**.
2. The file opens in Excel or Google Sheets, one row per student, sorted by surname:
   ```
   Surname,Score (out of 4),Percentage
   Reyes,4,100%
   "Santos, Jr.",1,25%
   ```

**Good to know**
- Students can reload or lose Wi-Fi without losing answers. Their phone re-sends them when it reconnects.
- A surname can be used once per session. A student who reloads on the same phone gets back in. A second student with the same surname must add something, for example "Reyes M".
- Only one activity runs at a time in a session. Start another once the first has ended.
- When class is over, close the `npm run dev` window. Your data stays in the database for next time.

---

## 3. Troubleshooting

| Problem | What to do |
|---|---|
| Phones cannot open the address | Check that Windows allowed Node.js through the firewall on **Private** networks. Check that phones and laptop are on the same network (some school Wi-Fi stops devices seeing each other; use your own router or hotspot). Make sure you typed `http://`, not `https://`. |
| "Wrong PIN" | Check Caps Lock. Repeated wrong PINs may make you wait a few seconds. |
| A student cannot join | Check the code, and that their surname is not already taken in this session. |
| "Connection lost" on a phone | The phone lost Wi-Fi. Answers are kept and will send when it reconnects. |
| Forgot your PIN | In `psql`: `UPDATE teacher SET pin_hash = crypt('new-pin', gen_salt('bf')) WHERE name = 'Prof. Cruz';` |

---

## 4. Privacy and safety

- **Your data stays on your laptop.** Class.ly stores only the surname a student types, their answers and their score. Nothing is sent to the internet. You are responsible for keeping the laptop and exported CSV files safe and deleting them according to your school's rules.
- **PINs are never stored.** Only a scrambled version (bcrypt hash) is kept.
- **Students cannot see correct answers or test answers.** They stay on the server, and grading happens there, not on the phone.
- **Teachers only see their own classes** and can only end or export their own quizzes.
- **Student code is contained.** It runs on the phone in a background thread, and on the server in a locked-down process that cannot read files or start programs, with a memory limit and a 1-second limit per test.

## 5. Known limits

- Teacher accounts are created with SQL (no sign-up page yet).
- Only JavaScript is supported for code questions.
- Teachers see scores but not students' submitted code yet.
- Built for a hackathon: please try it with a small group before using it for graded exams.

---

## 6. Licenses

**Class.ly** is released under the **MIT License** (see the `LICENSE` file). You may use, copy, modify and share it, including in a school, as long as the copyright notice stays.

**Open-source software it uses.** All of it is free to use, including for teaching. The licenses are permissive: they ask only that license notices are kept, which `npm install` does for you inside `node_modules`.

| Software | Used for | License |
|---|---|---|
| Next.js and React | App and pages | MIT |
| Node.js | Runs the app | MIT |
| PostgreSQL (and its `pgcrypto` extension) | Database, PIN hashing | PostgreSQL License |
| `pg` (node-postgres) | Talks to the database | MIT |
| Tailwind CSS | Styling | MIT |
| shadcn/ui and Radix UI | Interface components | MIT |
| CodeMirror 6 | Code editor on phones | MIT |
| Lucide icons | Icons | ISC |
| Fonts loaded through Next.js | Text | SIL Open Font License 1.1 or Apache 2.0 (check each font) |

This lists the main packages. To see every package that is installed, run `npx license-checker --summary` in the project folder.
