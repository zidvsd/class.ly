"use client";

// Runs the student's code in a Web Worker (a background thread) and shows:
//   1. everything printed with console.log
//   2. what their function returns, e.g.  add(1, 2) → 3
// so a "just return it" answer still shows something. The worker is killed after 3 seconds,
// so an endless loop can't freeze the phone.
const WORKER = `
const show = (v) => typeof v === "string" ? JSON.stringify(v) : String(JSON.stringify(v) ?? v);

self.onmessage = (e) => {
  const { code, fnName, args } = e.data;
  const lines = [];
  const log = (...values) => lines.push(values.map((v) => typeof v === "string" ? v : show(v)).join(" "));
  try {
    new Function(code); // syntax check first, so errors point at the student's own code
    const findFunction = fnName ? "\\n;return typeof " + fnName + " === 'function' ? " + fnName + " : null;" : "";
    const getFunction = new Function("console", code + findFunction);
    const fn = getFunction({ log, info: log, warn: log, error: log });
    if (fn) lines.push(fnName + "(" + args.map(show).join(", ") + ") → " + show(fn(...args)));
    self.postMessage({ ok: true, lines });
  } catch (err) {
    lines.push(err.name + ": " + err.message);
    self.postMessage({ ok: false, lines });
  }
};`;

export function runJs(code: string, fnName: string | null, args: unknown[] = []): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const worker = new Worker(URL.createObjectURL(new Blob([WORKER], { type: "text/javascript" })));

    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ ok: false, output: "Stopped: your code ran too long. Check for an endless loop." });
    }, 3000);

    worker.onmessage = (e) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ ok: e.data.ok, output: e.data.lines.join("\n") || "No output." });
    };

    worker.postMessage({ code, fnName, args });
  });
}
