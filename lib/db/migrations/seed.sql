-- seed.sql: demo data for 001_init.sql. Safe to re-run.
--   psql -U postgres -d classly -f seed.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
BEGIN;

DELETE FROM teacher WHERE name = 'Demo Teacher';   -- cascades to everything below

DO $$
DECLARE t uuid; sec uuid; ses1 uuid; ses2 uuid; act uuid; qid uuid; sid uuid;
  names text[] := ARRAY['Ana Reyes','Ben Santos','Carla Lim','Diego Cruz','Ella Tan'];
  j int; i int;
BEGIN
  INSERT INTO teacher (name, pin_hash) VALUES ('Demo Teacher', crypt('1234', gen_salt('bf', 10))) RETURNING id INTO t;
  INSERT INTO section (teacher_id, name) VALUES (t, 'Grade 10 - Newton') RETURNING id INTO sec;
  INSERT INTO class_session (section_id, code, status) VALUES (sec, 'DEMO42', 'open') RETURNING id INTO ses1;
  INSERT INTO class_session (section_id, code, status) VALUES (sec, 'DEMO77', 'open') RETURNING id INTO ses2;

  INSERT INTO activity (session_id, title, duration_minutes, status, started_at, ended_at)
  VALUES (ses2, 'JavaScript basics', 10, 'ended', now() - interval '1 hour', now() - interval '50 minutes') RETURNING id INTO act;

  -- Q1..Q3 multiple choice (correct choice is the first one listed)
  FOR i IN 0 .. 2 LOOP
    INSERT INTO question (activity_id, type, text, points, position)
    VALUES (act, 'mcq', (ARRAY['Which keyword declares a constant?','What does typeof null return?','Which method adds to the end of an array?'])[i+1], 1, i)
    RETURNING id INTO qid;
    INSERT INTO choice (question_id, text, is_correct) VALUES
      (qid, (ARRAY['const','"object"','push()'])[i+1], true),
      (qid, (ARRAY['var','"null"','pop()'])[i+1], false),
      (qid, (ARRAY['let','"undefined"','shift()'])[i+1], false);
  END LOOP;
  -- Q4 code question
  INSERT INTO question (activity_id, type, text, starter_code, fn_name, test_cases, points, position)
  VALUES (act, 'code', 'Write sumTo(n) that returns 1 + 2 + ... + n.', 'function sumTo(n) {\n  // your code\n}', 'sumTo',
          '[{"args":[1],"expected":1},{"args":[10],"expected":55},{"args":[100],"expected":5050}]', 3, 3);

  FOR j IN 1 .. array_length(names, 1) LOOP
    INSERT INTO student (session_id, name) VALUES (ses2, names[j]) RETURNING id INTO sid;
    -- MCQ: wrong on a different question for each of the first three students
    INSERT INTO answer (student_id, question_id, choice_id)
    SELECT sid, q.id, (SELECT c.id FROM choice c WHERE c.question_id = q.id AND c.is_correct = (q.position + 1 <> j) LIMIT 1)
    FROM question q WHERE q.activity_id = act AND q.type = 'mcq';
    -- Code: alternate between a correct solution and an off-by-one
    INSERT INTO answer (student_id, question_id, code_text, tests_passed, tests_total)
    SELECT sid, q.id,
      CASE WHEN j % 2 = 1 THEN 'function sumTo(n) { return n * (n + 1) / 2; }' ELSE 'function sumTo(n) { let s = 0; for (let i = 1; i < n; i++) s += i; return s; }' END,
      CASE WHEN j % 2 = 1 THEN 3 ELSE 0 END, 3
    FROM question q WHERE q.activity_id = act AND q.type = 'code';
  END LOOP;

  -- Score: MCQ = points if correct; code = points * tests_passed / tests_total (rounded)
  INSERT INTO submission (activity_id, student_id, score, max_score)
  SELECT act, s.id,
    COALESCE(SUM(CASE WHEN q.type = 'mcq' THEN CASE WHEN c.is_correct THEN q.points ELSE 0 END
                      ELSE round(q.points * a.tests_passed::numeric / NULLIF(a.tests_total, 0)) END), 0)::int,
    (SELECT SUM(points)::int FROM question WHERE activity_id = act)
  FROM student s JOIN answer a ON a.student_id = s.id JOIN question q ON q.id = a.question_id AND q.activity_id = act
  LEFT JOIN choice c ON c.id = a.choice_id
  WHERE s.session_id = ses2 GROUP BY s.id;
END $$;
COMMIT;
