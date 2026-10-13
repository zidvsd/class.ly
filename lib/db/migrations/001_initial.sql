BEGIN;

CREATE TABLE teacher (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL,
  pin_hash  text NOT NULL
);

CREATE TABLE section (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES teacher(id) ON DELETE CASCADE,
  name        text NOT NULL,
  UNIQUE (teacher_id, name)
);

CREATE TABLE class_session (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid NOT NULL REFERENCES section(id) ON DELETE CASCADE,
  code        text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{6}$'),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'ended')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES class_session(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, name)
);

CREATE TABLE activity (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES class_session(id) ON DELETE CASCADE,
  title             text NOT NULL,
  duration_minutes  int  NOT NULL CHECK (duration_minutes BETWEEN 1 AND 180),
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'ended')),
  started_at        timestamptz,
  ended_at          timestamptz
);

CREATE TABLE question (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id   uuid NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
  type          text NOT NULL DEFAULT 'mcq' CHECK (type IN ('mcq', 'code')),
  text          text NOT NULL,
  starter_code  text,                                       -- code questions only
  fn_name       text,                                       -- code questions: function the tests call, e.g. 'sumTo'
  test_cases    jsonb,                                      -- code questions: [{"args":[10],"expected":55}]
  points        int  NOT NULL DEFAULT 1 CHECK (points >= 0),
  position      int  NOT NULL,
  UNIQUE (activity_id, position),
  CHECK (type = 'code' OR (fn_name IS NULL AND test_cases IS NULL))
);

CREATE TABLE choice (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  uuid NOT NULL REFERENCES question(id) ON DELETE CASCADE,
  text         text NOT NULL,
  is_correct   boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX one_correct_choice_per_question
  ON choice (question_id) WHERE is_correct;                 -- at most one correct choice

CREATE TABLE answer (
  student_id    uuid NOT NULL REFERENCES student(id)  ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES question(id) ON DELETE CASCADE,
  choice_id     uuid REFERENCES choice(id) ON DELETE SET NULL,   -- MCQ
  code_text     text CHECK (length(code_text)  <= 20000),        -- code
  run_output    text CHECK (length(run_output) <= 20000),
  tests_passed  int,                                             -- filled by the server at finalize
  tests_total   int,
  saved_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, question_id)
);

CREATE TABLE submission (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id   uuid NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES student(id)  ON DELETE CASCADE,
  score         int NOT NULL,
  max_score     int NOT NULL,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, student_id)
);

CREATE INDEX idx_student_session   ON student (session_id);
CREATE INDEX idx_activity_session  ON activity (session_id, status);
CREATE INDEX idx_question_activity ON question (activity_id);
CREATE INDEX idx_choice_question   ON choice (question_id);

COMMIT;
